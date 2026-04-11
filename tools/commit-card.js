#!/usr/bin/env node
// ─── commit-card.js ──────────────────────────────────────────────────────────
// Called by a post-commit git hook in any vibecode app.
// Reads the latest commit, generates a card JSON, and appends it to
//   ../local-vibecoding-appideas/data/incoming/pending.json
//
// Requirements: Node.js 18+ (same as news-crawler)
// ─────────────────────────────────────────────────────────────────────────────

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const repoDir     = process.cwd();
const appName     = path.basename(repoDir);
const vibecodeDir = path.resolve(repoDir, '..');
const pendingDir  = path.join(vibecodeDir, 'local-vibecoding-appideas', 'data', 'incoming');
const pendingFile = path.join(pendingDir, 'pending.json');

// ── Git helpers ───────────────────────────────────────────────────────────────
function git(cmd) {
  try { return execSync(cmd, { cwd: repoDir }).toString().trim(); }
  catch { return ''; }
}

// ── Gather commit data ────────────────────────────────────────────────────────
const fullHash  = git('git log -1 --format=%H');
const shortHash = git('git log -1 --format=%h');
const message   = git('git log -1 --format=%s');
const body      = git('git log -1 --format=%b');
const author    = git('git log -1 --format=%an');
const timestamp = git('git log -1 --format=%cI');        // ISO 8601
const branch    = git('git rev-parse --abbrev-ref HEAD');

// Diff stat (may fail on first commit — safe fallback)
const statLine  = git('git diff --shortstat HEAD~1 HEAD 2>/dev/null') ||
                  git('git diff --shortstat 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD');

// Changed file paths (up to 30)
const changedFiles = git('git diff-tree --no-commit-id -r --name-only HEAD')
  .split('\n')
  .filter(Boolean)
  .slice(0, 30);

if (!fullHash) {
  console.error('[VibeCoding] commit-card.js: could not read git commit. Skipping.');
  process.exit(0);
}

// ── Build card payload ────────────────────────────────────────────────────────
const card = {
  id:           `commit-${fullHash}`,
  source:       'git-commit',
  appName,
  commitHash:   shortHash,
  fullHash,
  message,
  body,
  author,
  branch,
  timestamp,
  statLine,
  files:        changedFiles,
};

// ── Append to pending.json ────────────────────────────────────────────────────
try {
  fs.mkdirSync(pendingDir, { recursive: true });

  let cards = [];
  if (fs.existsSync(pendingFile)) {
    try { cards = JSON.parse(fs.readFileSync(pendingFile, 'utf8')); }
    catch { cards = []; }
  }

  // Skip duplicates
  if (cards.some(c => c.fullHash === fullHash)) {
    console.log(`[VibeCoding] Card already pending for ${shortHash} — skipped.`);
    process.exit(0);
  }

  cards.push(card);
  fs.writeFileSync(pendingFile, JSON.stringify(cards, null, 2));

  console.log(`[VibeCoding] ✓ Commit card queued → ${appName}: ${message} (${shortHash})`);
} catch (err) {
  // Never fail the commit — just warn
  console.warn(`[VibeCoding] Could not write commit card: ${err.message}`);
}
