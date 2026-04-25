#!/usr/bin/env node
// ─── build-app-features.js ───────────────────────────────────────────────────
// Walks every sibling vibecode repo, parses its README + project structure,
// and emits a per-app feature taxonomy used by the App Ideas Timeline view.
//
// Outputs:
//   data/incoming/app-features.json   — human-inspectable, version-controllable
//   data/app-features.js              — `window.APP_FEATURES = {...}` for browser
//
// Re-run any time via tools/install-hooks.sh or directly: `node tools/build-app-features.js`
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const TOOLS_DIR    = __dirname;
const APPIDEAS_DIR = path.dirname(TOOLS_DIR);
const VIBECODE_DIR = path.dirname(APPIDEAS_DIR);

// README ## sections that aren't real features — skip them.
const SKIP_HEADINGS = /^(getting started|tech stack|installation|usage|license|setup|requirements|prerequisites|contributing|credits|acknowledgments|part of|why this exists|who this is for|keyboard shortcuts|common commands|hard rules|important context|skills and routines|coding standards|project structure|security defaults|git workflow|what i am building|how i want you to work|what this is)/i;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'your', 'their', 'this', 'that',
  'using', 'each', 'any', 'all', 'one', 'two', 'too', 'app', 'apps',
  'these', 'those', 'have', 'has', 'will', 'can',
]);

const GENERIC_FILENAMES = /^(index|app|main|utils?|helpers?|constants?|config|types?|index\d*)$/i;

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function titleCase(s) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function cleanHeading(raw) {
  return raw
    .replace(/[*_`]/g, '')
    .replace(/&[a-z]+;/gi, ' ')   // strip HTML entities
    .replace(/—.*$/, '')          // drop em-dash tails
    .replace(/--.*$/, '')         // drop double-hyphen tails
    .replace(/:\s.*$/, '')        // drop ": subtitle" tails
    .trim();
}

function buildKeywords(name) {
  const tokens = name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(tokens)];
}

// ── Extract features from README.md ──────────────────────────────────────────
function extractFromReadme(repoDir) {
  const text = readSafe(path.join(repoDir, 'README.md'));
  if (!text) return [];
  const lines = text.split('\n');

  const features = [];
  let inFeatureSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const h2 = line.match(/^## +(.+?)\s*$/);
    if (h2) {
      const name = cleanHeading(h2[1]);
      inFeatureSection = /feature/i.test(name);
      // If this ## itself is a real feature section name (not "Features"), still skip — too coarse
      continue;
    }

    if (!inFeatureSection) continue;

    const h3 = line.match(/^### +(.+?)\s*$/);
    if (h3) {
      const name = cleanHeading(h3[1]);
      if (name && !SKIP_HEADINGS.test(name)) features.push(name);
      continue;
    }

    const h4 = line.match(/^#### +(.+?)\s*$/);
    if (h4) {
      const name = cleanHeading(h4[1]);
      if (name && !SKIP_HEADINGS.test(name)) features.push(name);
    }
  }

  // Fallback: if no Features section, take top-level ## sections (filtered)
  if (features.length === 0) {
    for (const line of lines) {
      const h2 = line.match(/^## +(.+?)\s*$/);
      if (!h2) continue;
      const name = cleanHeading(h2[1]);
      if (!name || SKIP_HEADINGS.test(name)) continue;
      features.push(name);
    }
  }

  return features;
}

// ── Augment with project-structure clues ─────────────────────────────────────
function extractFromStructure(repoDir) {
  const out = [];
  const codeDirs = ['src', 'js', 'lib', 'app', 'pages', 'components', 'features', 'modules'];
  for (const dir of codeDirs) {
    const dirPath = path.join(repoDir, dir);
    if (!fs.existsSync(dirPath)) continue;
    let entries = [];
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (GENERIC_FILENAMES.test(entry.name)) continue;
        out.push(titleCase(entry.name));
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|py|rb|go|swift|kt)$/.test(entry.name)) {
        const base = entry.name.replace(/\.[^.]+$/, '');
        if (GENERIC_FILENAMES.test(base)) continue;
        out.push(titleCase(base));
      }
    }
  }
  return out;
}

function processRepo(repoDir) {
  const repoName = path.basename(repoDir);
  const readmeFs = extractFromReadme(repoDir);
  const structFs = extractFromStructure(repoDir);

  // Merge: README order wins, structure entries appended only if novel
  const seen     = new Set();
  const features = [];
  [...readmeFs, ...structFs].forEach(name => {
    const key = name.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const keywords = buildKeywords(name);
    if (keywords.length === 0) return;
    features.push({ name, keywords });
  });

  return { repoName, features };
}

// ── Walk all sibling repos ───────────────────────────────────────────────────
const apps  = {};
let dirs    = [];
try { dirs = fs.readdirSync(VIBECODE_DIR, { withFileTypes: true }); } catch {}

for (const d of dirs) {
  if (!d.isDirectory()) continue;
  const repoDir = path.join(VIBECODE_DIR, d.name);
  if (!fs.existsSync(path.join(repoDir, '.git'))) continue;
  apps[d.name] = processRepo(repoDir);
}

const payload = {
  computedAt: new Date().toISOString(),
  apps,
};

// ── Write outputs ────────────────────────────────────────────────────────────
const incomingDir = path.join(APPIDEAS_DIR, 'data', 'incoming');
fs.mkdirSync(incomingDir, { recursive: true });
fs.writeFileSync(
  path.join(incomingDir, 'app-features.json'),
  JSON.stringify(payload, null, 2)
);

const dataDir = path.join(APPIDEAS_DIR, 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'app-features.js'),
  '// Auto-generated by tools/build-app-features.js — do not edit.\n' +
  'window.APP_FEATURES = ' + JSON.stringify(payload, null, 2) + ';\n'
);

const totalFeatures = Object.values(apps).reduce((n, a) => n + a.features.length, 0);
console.log(`[VibeCoding] ✓ Built feature taxonomy: ${Object.keys(apps).length} apps, ${totalFeatures} features.`);
