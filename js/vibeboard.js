'use strict';

// ─── VibeBoard: Kanban-style board per App Idea ───────────────────────────────

const VIBE_DEFAULT_COLUMNS = [
  { id: 'vbc-1', name: 'Prompts' },
  { id: 'vbc-2', name: 'Vibe Coding' },
  { id: 'vbc-3', name: 'Testing' },
  { id: 'vbc-4', name: 'Shipped' },
];

const VIBE_DEFAULT_CATEGORIES = [
  { id: 'vbcat-0',  name: 'AI Init Commit', color: '#10b981' },
  { id: 'vbcat-1',  name: 'Brainstorming', color: '#f59e0b' },
  { id: 'vbcat-2',  name: 'UI/UX',         color: '#a78bfa' },
  { id: 'vbcat-3',  name: 'Web UI',         color: '#3b82f6' },
  { id: 'vbcat-4',  name: 'Swift UI',       color: '#f97316' },
  { id: 'vbcat-5',  name: 'Kotlin UI',      color: '#22c55e' },
  { id: 'vbcat-6',  name: 'API',            color: '#06b6d4' },
  { id: 'vbcat-7',  name: 'Database',       color: '#ec4899' },
  { id: 'vbcat-8',  name: 'Libraries',      color: '#84cc16' },
  { id: 'vbcat-9',  name: 'AI Models',      color: '#6366f1' },
  { id: 'vbcat-10', name: 'AI Agents',      color: '#ef4444' },
  { id: 'vbcat-11', name: 'AI Libraries',   color: '#8b5cf6' },
];

// ─── Feature Themes (per-idea, computed from each repo's README) ─────────────
// Source: window.APP_FEATURES (from data/app-features.js, built by
// tools/build-app-features.js on each install-hooks.sh run).
const FEATURE_UNCLASSIFIED = 'Unclassified';

const _FEATURE_COLOR_PALETTE = [
  '#10b981', '#06b6d4', '#3b82f6', '#a78bfa', '#f97316',
  '#ec4899', '#8b5cf6', '#fbbf24', '#22c55e', '#ef4444',
  '#6366f1', '#84cc16', '#64748b', '#f59e0b', '#14b8a6',
];

function _featureColorFor(name) {
  if (!name || name === FEATURE_UNCLASSIFIED) return '#888';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return _FEATURE_COLOR_PALETTE[Math.abs(hash) % _FEATURE_COLOR_PALETTE.length];
}

// Extract the repo basename from a GitHub URL — e.g.
//   https://github.com/mindobix/local-trading-journal      → local-trading-journal
//   git@github.com:mindobix/local-trading-journal.git      → local-trading-journal
function _repoNameFromUrl(url) {
  if (!url) return '';
  const m = String(url).trim().match(/[:/]([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
  return m ? m[1] : '';
}

// Parse {owner, repo} from a GitHub URL — needed for the GitHub API fetch fallback.
function _parseGithubUrl(url) {
  if (!url) return null;
  const m = String(url).trim().match(/github\.com[:/]+([^/]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// ── Browser-side README parser (mirror of tools/build-app-features.js) ───────
const _GH_STOPWORDS = new Set(['the','and','for','with','from','into','your','their','this','that','using','each','any','all','one','two','too','app','apps','these','those','have','has','will','can']);
const _GH_SKIP_HEADINGS = /^(getting started|tech stack|installation|usage|license|setup|requirements|prerequisites|contributing|credits|acknowledgments|part of|why this exists|who this is for|keyboard shortcuts|common commands|hard rules|important context|skills and routines|coding standards|project structure|security defaults|git workflow|what i am building|how i want you to work|what this is)/i;

function _ghBuildKeywords(name) {
  return [...new Set(
    name.toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !_GH_STOPWORDS.has(w))
  )];
}

function _ghCleanHeading(raw) {
  return raw
    .replace(/[*_`]/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/—.*$/, '')
    .replace(/--.*$/, '')
    .replace(/:\s.*$/, '')
    .trim();
}

function _extractFeaturesFromMarkdown(md) {
  const lines = (md || '').split('\n');
  const out = [];
  let inFeatures = false;

  for (const line of lines) {
    const h2 = line.match(/^## +(.+?)\s*$/);
    if (h2) { inFeatures = /feature/i.test(_ghCleanHeading(h2[1])); continue; }
    if (!inFeatures) continue;
    const h3 = line.match(/^### +(.+?)\s*$/);
    if (h3) { const n = _ghCleanHeading(h3[1]); if (n && !_GH_SKIP_HEADINGS.test(n)) out.push(n); continue; }
    const h4 = line.match(/^#### +(.+?)\s*$/);
    if (h4) { const n = _ghCleanHeading(h4[1]); if (n && !_GH_SKIP_HEADINGS.test(n)) out.push(n); }
  }
  if (out.length === 0) {
    for (const line of lines) {
      const h2 = line.match(/^## +(.+?)\s*$/);
      if (!h2) continue;
      const n = _ghCleanHeading(h2[1]);
      if (!n || _GH_SKIP_HEADINGS.test(n)) continue;
      out.push(n);
    }
  }
  const seen = new Set();
  return out
    .filter(n => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(name => ({ name, keywords: _ghBuildKeywords(name) }))
    .filter(f => f.keywords.length > 0);
}

// ── GitHub fetch + IndexedDB cache (used when no local taxonomy exists) ──────
function _saveGhFeatureCache(cache) {
  try {
    const req = indexedDB.open('vibecoding_db', 1);
    req.onsuccess = (e) => {
      e.target.result.transaction('appstate', 'readwrite').objectStore('appstate').put(cache, '_ghFeatureCache');
    };
  } catch (_) {}
}

function _loadGhFeatureCache() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('vibecoding_db', 1);
      req.onsuccess = (e) => {
        const r = e.target.result.transaction('appstate', 'readonly').objectStore('appstate').get('_ghFeatureCache');
        r.onsuccess = () => resolve(r.result || {});
        r.onerror   = () => resolve({});
      };
      req.onerror = () => resolve({});
    } catch (_) { resolve({}); }
  });
}

let _ghCachePromise = null;
function ensureGhFeatureCacheLoaded() {
  if (window.APP_FEATURES?._ghLoaded) return Promise.resolve();
  if (!_ghCachePromise) {
    _ghCachePromise = _loadGhFeatureCache().then(cache => {
      if (!window.APP_FEATURES) window.APP_FEATURES = { apps: {} };
      if (!window.APP_FEATURES.apps) window.APP_FEATURES.apps = {};
      Object.entries(cache).forEach(([repo, entry]) => {
        if (!window.APP_FEATURES.apps[repo]) window.APP_FEATURES.apps[repo] = entry;
      });
      window.APP_FEATURES._ghLoaded = true;
    });
  }
  return _ghCachePromise;
}

const _ghFetchInFlight = new Set();
const _ghFetchFailed   = new Set();

async function _fetchAndStoreGhFeatures(owner, repo) {
  if (_ghFetchInFlight.has(repo) || _ghFetchFailed.has(repo)) return null;
  _ghFetchInFlight.add(repo);
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { 'Accept': 'application/vnd.github.raw' },
    });
    if (!r.ok) { _ghFetchFailed.add(repo); return null; }
    const md = await r.text();
    const features = _extractFeaturesFromMarkdown(md);
    if (!features.length) { _ghFetchFailed.add(repo); return null; }

    const entry = { repoName: repo, features, _source: 'github' };
    if (!window.APP_FEATURES) window.APP_FEATURES = { apps: {} };
    if (!window.APP_FEATURES.apps) window.APP_FEATURES.apps = {};
    window.APP_FEATURES.apps[repo] = entry;

    const cache = await _loadGhFeatureCache();
    cache[repo] = entry;
    _saveGhFeatureCache(cache);

    // Re-render timeline so the catalog appears
    const ideaId = _boardIdeaId();
    if (ideaId && APP.ui.vbView === 'timeline') renderVibeBoard(ideaId);
    return entry;
  } catch (_) {
    _ghFetchFailed.add(repo);
    return null;
  } finally {
    _ghFetchInFlight.delete(repo);
  }
}

// Returns the feature catalog (array of {name, keywords}) for an idea,
// drawn from the global APP_FEATURES via the idea's githubUrl.
function _getIdeaFeatures(idea) {
  const repo = _repoNameFromUrl(idea?.githubUrl);
  if (!repo) return [];
  const apps = (typeof window !== 'undefined' && window.APP_FEATURES?.apps) || {};
  return apps[repo]?.features || [];
}

function _classifyCardText(card) {
  const meta = card.commitMeta || {};
  return [card.text, meta.appName, meta.commitHash, (card.commitFiles || []).join(' ')].filter(Boolean).join('\n');
}

// Score the card against this idea's feature catalog by keyword hits.
// Specificity tie-breaker: longer matched keyword wins.
function _classifyCardForIdea(card, idea) {
  const features = _getIdeaFeatures(idea);
  if (features.length === 0) return FEATURE_UNCLASSIFIED;

  const haystack = _classifyCardText(card).toLowerCase();
  let best = { name: FEATURE_UNCLASSIFIED, score: 0, length: 0 };
  for (const f of features) {
    let score = 0;
    let matchedLen = 0;
    for (const kw of (f.keywords || [])) {
      if (haystack.includes(kw)) { score++; matchedLen += kw.length; }
    }
    if (score > best.score || (score === best.score && score > 0 && matchedLen > best.length)) {
      best = { name: f.name, score, length: matchedLen };
    }
  }
  return best.name;
}

// ─── Commit Card Rich Render ─────────────────────────────────────────────────
// Build a GitHub-style structured render of a commit card. Goes into card.draft.
// Designed to be re-render-safe via the data-commit-render="1" marker.

function _formatCommitBodyHtml(body) {
  if (!body) return '';
  const lines = body.split('\n');
  const out = [];
  let bullets = [];
  let para    = [];

  function flushBullets() {
    if (!bullets.length) return;
    out.push(`<ul class="vb-commit-bullets">${
      bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')
    }</ul>`);
    bullets = [];
  }
  function flushPara() {
    if (!para.length) return;
    out.push(`<p>${para.map(escapeHtml).join('<br>')}</p>`);
    para = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushBullets(); flushPara(); continue; }
    if (/^Co-Authored-By:/i.test(line)) {
      // Co-author trailers handled separately by the caller
      flushBullets();
      flushPara();
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      bullets.push(bullet[1]);
    } else {
      flushBullets();
      para.push(line);
    }
  }
  flushBullets();
  flushPara();
  return out.join('');
}

function _commitUrlFromIdea(githubUrl, fullHash) {
  if (!githubUrl || !fullHash) return '';
  const base = String(githubUrl).trim().replace(/\.git\/?$/, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) return '';
  return `${base}/commit/${fullHash}`;
}

function _formatCommitDateAbs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function _buildCommitCardDraft(meta, githubUrl) {
  if (!meta) return '';
  const fullHash  = meta.fullHash || '';
  const shortHash = meta.commitHash || (fullHash ? fullHash.slice(0, 7) : '');
  const author    = meta.author    || '';
  const message   = meta.message   || '';
  const body      = meta.body      || '';
  const statLine  = meta.statLine  || '';

  const dateRel   = meta.timestamp ? (typeof formatDateShort === 'function' ? formatDateShort(meta.timestamp) : '') : '';
  const dateAbs   = _formatCommitDateAbs(meta.timestamp);
  const commitUrl = _commitUrlFromIdea(githubUrl, fullHash);

  // Extract co-authors from body
  const coAuthors = [];
  body.split('\n').forEach(line => {
    const m = line.match(/^Co-Authored-By:\s*(.+?)\s*<(.+)>\s*$/i);
    if (m) coAuthors.push({ name: m[1], email: m[2] });
  });

  const headerHtml = (author || dateRel || dateAbs)
    ? `<div class="vb-commit-header">${
        author ? `<strong>${escapeHtml(author)}</strong>` : ''
      }${author && (dateRel || dateAbs) ? ', ' : ''}${
        dateRel ? `<span class="vb-commit-rel">${escapeHtml(dateRel)}</span>` : ''
      }${dateAbs ? ` <span class="vb-commit-abs">(${escapeHtml(dateAbs)})</span>` : ''}</div>`
    : '';

  const coAuthorTopHtml = coAuthors.map(co =>
    `<div class="vb-commit-coauthor"><span class="vb-commit-coauthor-icon">↳</span> <strong>${escapeHtml(co.name)}</strong> <em>(Co-author)</em></div>`
  ).join('');

  const subjectHtml = message
    ? `<div class="vb-commit-subject"><strong>${escapeHtml(message)}</strong></div>`
    : '';

  const bodyHtml = _formatCommitBodyHtml(body);

  const coAuthorTrailerHtml = coAuthors.map(co =>
    `<div class="vb-commit-trailer">Co-Authored-By: ${escapeHtml(co.name)} <a class="vb-commit-email" href="mailto:${escapeAttr(co.email)}">${escapeHtml(co.email)}</a></div>`
  ).join('');

  const statHtml = statLine
    ? `<div class="vb-commit-stat">${escapeHtml(statLine)}</div>`
    : '';

  const hashHtml = shortHash
    ? (commitUrl
        ? `<a class="vb-commit-hash-link" href="${escapeAttr(commitUrl)}" target="_blank" rel="noopener">⌥ ${escapeHtml(shortHash)}</a>`
        : `<span class="vb-commit-hash">⌥ ${escapeHtml(shortHash)}</span>`)
    : '';
  const ghHtml = commitUrl
    ? `<a class="vb-commit-gh-link" href="${escapeAttr(commitUrl)}" target="_blank" rel="noopener">
         <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
         Open on GitHub
       </a>`
    : '';

  const footerHtml = (hashHtml || ghHtml)
    ? `<div class="vb-commit-footer">${hashHtml}${hashHtml && ghHtml ? '<span class="vb-commit-sep">|</span>' : ''}${ghHtml}</div>`
    : '';

  return `<div class="vb-commit-render" data-commit-render="1">
${headerHtml}
${coAuthorTopHtml}
${subjectHtml}
${bodyHtml}
${coAuthorTrailerHtml}
${statHtml}
${footerHtml}
</div>`;
}

// Recover message/body/statLine/files from old card.text (best-effort)
// so we can re-render existing imported cards in the rich format.
function _recoverCommitFieldsFromText(text) {
  const out = { message: '', body: '', statLine: '', files: [] };
  if (!text) return out;
  const lines = text.split('\n');
  out.message = lines[0] || '';

  const statRegex = /^\s*\d+\s+files?\s+changed/i;
  const statIdx   = lines.findIndex((l, i) => i > 0 && statRegex.test(l));
  const filesIdx  = lines.findIndex((l, i) => i > 0 && /^Files:\s*$/.test(l));

  if (statIdx >= 0) out.statLine = lines[statIdx].trim();
  if (filesIdx >= 0) out.files = lines.slice(filesIdx + 1).filter(Boolean);

  const bodyEnd = filesIdx >= 0 ? filesIdx : (statIdx >= 0 ? statIdx : lines.length);
  out.body = lines.slice(1, bodyEnd).join('\n').replace(/^\n+|\n+$/g, '');
  return out;
}

// Lazy-migration: ensure a commit card has a rich-rendered draft.
// Idempotent — won't overwrite an existing rich render.
function _ensureCommitCardDraft(card, idea) {
  if (!card?.commitMeta) return;
  const hasRich = typeof card.draft === 'string' && card.draft.includes('data-commit-render="1"');
  if (hasRich) return;

  // If commitMeta lacks the new fields, recover from card.text
  const meta = { ...card.commitMeta };
  if (!meta.message || meta.message.length === 0) {
    const recovered = _recoverCommitFieldsFromText(card.text || '');
    meta.message  = meta.message  || recovered.message;
    meta.body     = meta.body     || recovered.body;
    meta.statLine = meta.statLine || recovered.statLine;
    meta.files    = meta.files    || recovered.files;
    card.commitMeta = meta;
  }

  card.draft = _buildCommitCardDraft(meta, idea?.githubUrl);
}

// Re-seed featureTheme on every shipped card for an idea (called when
// Timeline opens — so README updates flow through automatically).
function _reseedFeatureThemes(idea) {
  if (!idea) return;
  const cards = idea.vibeCards || [];
  let mutated = false;
  cards.forEach(c => {
    if (!_isShippedCol(c.columnId)) return;
    const next = _classifyCardForIdea(c, idea);
    if (c.featureTheme !== next) { c.featureTheme = next; mutated = true; }
  });
  if (mutated) saveAppState();
}

const VIBE_COLOR_PALETTE = [
  '#3b82f6', '#22c55e', '#a78bfa', '#f59e0b',
  '#ec4899', '#f97316', '#06b6d4', '#84cc16',
  '#ef4444', '#6366f1',
];

let _vbNewCatColor  = VIBE_COLOR_PALETTE[0];
let _vbDragCardId   = null;
let _vbDragIdeaId   = null;

// ─── State Helpers ─────────────────────────────────────────────────────────────
function ensureVibeBoardState() {
  if (!APP.state.vibeBoard) {
    APP.state.vibeBoard = {
      columns:          VIBE_DEFAULT_COLUMNS.map(c => ({ ...c })),
      promptCategories: VIBE_DEFAULT_CATEGORIES.map(c => ({ ...c })),
    };
    saveAppState();
    return;
  }
  if (!Array.isArray(APP.state.vibeBoard.columns) || APP.state.vibeBoard.columns.length === 0) {
    APP.state.vibeBoard.columns = VIBE_DEFAULT_COLUMNS.map(c => ({ ...c }));
  }
  if (!Array.isArray(APP.state.vibeBoard.promptCategories)) {
    APP.state.vibeBoard.promptCategories = [];
  }

  // Backfill any default categories missing by id (first-time only — never duplicates)
  const existing = APP.state.vibeBoard.promptCategories;
  const existingIds = new Set(existing.map(c => c.id));
  let added = false;
  VIBE_DEFAULT_CATEGORIES.forEach(def => {
    if (!existingIds.has(def.id)) {
      existing.push({ ...def });
      added = true;
    }
  });
  if (added) saveAppState();
}

function ensureIdeaVibeCards(ideaId) {
  const idea = APP.state.ideas[ideaId];
  if (idea && !Array.isArray(idea.vibeCards)) {
    idea.vibeCards = [];
  }
}

// Returns true once the idea has at least one card in the Shipped column.
function _hasShippedCard(ideaId) {
  const shippedCol = APP.state.vibeBoard?.columns?.find(c => /shipped/i.test(c.name));
  if (!shippedCol) return false;
  return APP.state.ideas[ideaId]?.vibeCards?.some(c => c.columnId === shippedCol.id) ?? false;
}

function _isShippedCol(colId) {
  const col = APP.state.vibeBoard?.columns?.find(c => c.id === colId);
  return !!col && /shipped/i.test(col.name);
}

// Shipped column orders by drop time (oldest first). Other columns use `order`.
function _sortColCards(cards, colId) {
  if (_isShippedCol(colId)) {
    return cards.slice().sort((a, b) =>
      (a.shippedAt || a.createdAt || 0) - (b.shippedAt || b.createdAt || 0));
  }
  return cards.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}

// ─── Render VibeBoard ─────────────────────────────────────────────────────────
function renderVibeBoard(ideaId) {
  ensureVibeBoardState();
  ensureIdeaVibeCards(ideaId);

  const idea = APP.state.ideas[ideaId];
  if (!idea) { renderEditorEmpty(); return; }

  const { columns, promptCategories } = APP.state.vibeBoard;
  const cards = idea.vibeCards;

  const view  = APP.ui.vbView === 'timeline' ? 'timeline' : 'board';
  const panel = document.getElementById('editor-panel');
  panel.innerHTML = `
    <div class="vibeboard" id="vibeboard" data-idea="${escapeAttr(ideaId)}">

      <div class="vibeboard-header">
        <button class="vibeboard-back" onclick="vibeboardBackToEditor()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back
        </button>
        <div class="vibeboard-title">
          VibeBoard &mdash; <span class="vibeboard-title-idea">${escapeHtml(idea.title || 'Untitled')}</span>
        </div>
        <div class="vibeboard-view-tabs">
          <button class="vibeboard-view-tab${view === 'board' ? ' active' : ''}" onclick="setVbView('board')">Board</button>
          <button class="vibeboard-view-tab${view === 'timeline' ? ' active' : ''}" onclick="setVbView('timeline')">Timeline</button>
        </div>
        <div class="vibeboard-search-wrap">
          <svg class="vibeboard-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" id="vb-search" class="vibeboard-search-input"
                 placeholder="Search cards…"
                 value="${escapeAttr(APP.ui.vbSearch || '')}"
                 oninput="onVbSearchInput(this.value)">
        </div>
        ${view === 'board' ? `
        <button class="vibeboard-cats-btn" id="vb-cats-toggle" onclick="toggleVibeCatPanel()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          Prompt Categories
        </button>` : ''}
      </div>

      ${view === 'board' ? `
      <div class="vibeboard-cats-panel" id="vb-cats-panel">
        ${_renderCatPanel(promptCategories)}
      </div>

      <div class="vibeboard-cols" id="vb-cols">
        ${columns.map(col => _renderColumn(col, cards, promptCategories, ideaId)).join('')}
      </div>
      ` : _renderTimelineView(idea, cards, ideaId)}

    </div>
  `;

  // Hydrate all card text areas with their draft/text content (board only)
  if (view === 'board') {
    const boardEl = document.getElementById('vibeboard');
    if (boardEl) _hydrateCardContent(boardEl, cards);
  }
  _applyVbSearchFilter();

  document.addEventListener('click', _vbOutsideClick, { capture: true });
}

function setVbView(view) {
  APP.ui.vbView = view === 'timeline' ? 'timeline' : 'board';
  const ideaId = _boardIdeaId();
  if (ideaId) renderVibeBoard(ideaId);
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function _renderTimelineView(idea, cards, ideaId) {
  const shippedCol = APP.state.vibeBoard?.columns?.find(c => /shipped/i.test(c.name));
  if (!shippedCol) {
    return `<div class="vb-timeline-empty">No Shipped column found in this board.</div>`;
  }

  // Backfill shippedAt + re-seed every shipped card's featureTheme against the
  // current per-idea catalog (so README updates reflow without manual action).
  const shipped0 = (cards || []).filter(c => c.columnId === shippedCol.id);
  shipped0.forEach(c => { if (!c.shippedAt) c.shippedAt = c.createdAt || Date.now(); });
  _reseedFeatureThemes(idea);
  const shipped = (idea.vibeCards || []).filter(c => c.columnId === shippedCol.id);

  // Idea isn't linked to a repo (or repo has no taxonomy yet)
  const repoName       = _repoNameFromUrl(idea.githubUrl);
  const ghParsed       = _parseGithubUrl(idea.githubUrl);
  const featureCatalog = _getIdeaFeatures(idea);
  const lacksCatalog   = featureCatalog.length === 0;

  let banner = '';
  if (!repoName) {
    banner = `<div class="vb-tl-banner">
      Set this idea's <strong>GitHub URL</strong> to enable feature classification.
      Cards will stay <em>Unclassified</em> until then.
    </div>`;
  } else if (lacksCatalog) {
    if (ghParsed && !_ghFetchFailed.has(ghParsed.repo)) {
      // Kick off async fetch + cache. Re-renders timeline when ready.
      ensureGhFeatureCacheLoaded()
        .then(() => {
          if (_getIdeaFeatures(idea).length > 0) {
            const ideaId = _boardIdeaId();
            if (ideaId && APP.ui.vbView === 'timeline') renderVibeBoard(ideaId);
          } else {
            _fetchAndStoreGhFeatures(ghParsed.owner, ghParsed.repo);
          }
        });
      banner = `<div class="vb-tl-banner">
        Fetching feature catalog for <code>${escapeHtml(repoName)}</code> from GitHub…
      </div>`;
    } else {
      banner = `<div class="vb-tl-banner">
        No feature taxonomy found for <code>${escapeHtml(repoName)}</code>.
        Run <code>bash tools/install-hooks.sh</code> if cloned locally, or check the GitHub URL is correct.
      </div>`;
    }
  }

  if (shipped.length === 0) {
    return `<div class="vibeboard-timeline">${banner}
      <div class="vb-timeline-empty">
        <div class="vb-timeline-empty-title">Nothing shipped yet</div>
        <div class="vb-timeline-empty-sub">Drop cards into the Shipped column on the Board tab to see them here, grouped by feature.</div>
      </div>
    </div>`;
  }

  // Stats
  const oneWeekAgo      = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const shippedThisWeek = shipped.filter(c => (c.shippedAt || 0) >= oneWeekAgo).length;
  const themesUsed      = new Set(shipped.map(c => c.featureTheme || FEATURE_UNCLASSIFIED));

  const sub = APP.ui.vbTimelineSub === 'categorized' ? 'categorized' : 'recent';

  // Eagerly migrate any commit cards lacking a rich draft so the expanded
  // panel renders correctly the first time the user toggles it open.
  let mutated = false;
  shipped.forEach(c => {
    if (!c.commitMeta) return;
    const before = c.draft;
    _ensureCommitCardDraft(c, idea);
    if (c.draft !== before) mutated = true;
  });
  if (mutated) saveAppState();

  const body = sub === 'categorized'
    ? _renderTimelineCategorized(shipped, featureCatalog, idea)
    : _renderTimelineRecent(shipped, idea);

  return `
    <div class="vibeboard-timeline">
      ${banner}
      <div class="vb-tl-toolbar">
        <div class="vb-tl-stats">
          <span class="vb-tl-stat"><strong>${shipped.length}</strong> shipped</span>
          <span class="vb-tl-stat-sep">•</span>
          <span class="vb-tl-stat"><strong>${themesUsed.size}</strong> features</span>
          <span class="vb-tl-stat-sep">•</span>
          <span class="vb-tl-stat"><strong>${shippedThisWeek}</strong> this week</span>
        </div>
        <div class="vb-tl-subtabs">
          <button class="vb-tl-subtab${sub === 'recent' ? ' active' : ''}"      onclick="setVbTimelineSub('recent')">Latest → Oldest</button>
          <button class="vb-tl-subtab${sub === 'categorized' ? ' active' : ''}" onclick="setVbTimelineSub('categorized')">By Feature</button>
        </div>
      </div>
      ${body}
    </div>
  `;
}

function setVbTimelineSub(sub) {
  APP.ui.vbTimelineSub = sub === 'categorized' ? 'categorized' : 'recent';
  const ideaId = _boardIdeaId();
  if (ideaId) renderVibeBoard(ideaId);
}

// Tracks which timeline cards are expanded (in-memory only, per session).
const _vbTlExpanded = new Set();

// First non-empty line of a string, trimmed.
function _firstLineOf(s) {
  return (s || '').split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
}

// First non-empty line ≥ minLen chars (so we skip tiny stubs like "Need").
function _firstLongLineOf(s, minLen) {
  return (s || '').split('\n').map(l => l.trim()).find(l => l.length >= minLen) || '';
}

// Strip HTML tags to plain text — used for non-commit cards whose content
// lives in card.draft (rich editor HTML) and whose card.text may be empty.
function _stripHtmlToText(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Pull a likely-title from the rich HTML: prefer first heading, then a
// substantial bold block, then the longest paragraph-like block.
function _extractTitleFromHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Don't pick up commit-card meta noise (date/hash) when scanning drafts.
  tmp.querySelectorAll('.vb-commit-render').forEach(el => {
    const subj = el.querySelector('.vb-commit-subject');
    if (subj) {
      const t = (subj.textContent || '').trim();
      if (t.length >= 3) {
        // Hoist commit subject as the title of this draft
        const span = document.createElement('span');
        span.textContent = t;
        el.parentNode?.insertBefore(span, el);
      }
    }
    el.remove();
  });

  // 1. First heading (h1-h6)
  const h = tmp.querySelector('h1, h2, h3, h4, h5, h6');
  if (h) {
    const t = (h.textContent || '').trim();
    if (t.length >= 3) return t;
  }
  // 2. First bold element with substantive text
  for (const b of tmp.querySelectorAll('strong, b')) {
    const t = (b.textContent || '').trim();
    if (t.length >= 8) return t;
  }
  // 3. First reasonably long paragraph-like block
  for (const blk of tmp.querySelectorAll('p, div, li, blockquote')) {
    const t = (blk.textContent || '').trim();
    if (t.length >= 10) return t;
  }
  // 4. Longest line of overall text
  const lines = (tmp.textContent || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length) {
    const longest = lines.reduce((a, b) => a.length >= b.length ? a : b, '');
    if (longest.length >= 5) return longest;
  }
  return '';
}

// At least 2 alphanumeric chars, so a stray period or comma doesn't qualify.
function _isUsefulSubject(s) {
  return (s || '').replace(/[^A-Za-z0-9]/g, '').length >= 2;
}

function _bestCardSubject(card) {
  const meta = card.commitMeta || {};

  // 1. Commit message wins for commit cards.
  if (_isUsefulSubject(meta.message)) return meta.message.trim();

  // 2. Title-like text from the rich draft (heading > bold > long block).
  const fromDraft = _extractTitleFromHtml(card.draft);
  if (_isUsefulSubject(fromDraft)) return fromDraft;

  // 3. Plain card.text lines, but skip stubs <5 chars before falling back.
  const longText = _firstLongLineOf(card.text, 5);
  if (_isUsefulSubject(longText)) return longText;

  // 4. Last resort: any first non-empty line from text or stripped draft.
  const fallbacks = [
    _firstLineOf(card.text),
    _firstLineOf(_stripHtmlToText(card.draft)),
  ];
  for (const c of fallbacks) {
    if (_isUsefulSubject(c)) return c.trim();
  }
  return '(no description)';
}

function vbToggleTimelineCard(cardId) {
  const cardEl = document.querySelector(`.vb-tl-card[data-card-id="${cardId}"]`);
  if (!cardEl) return;
  const isOpen = !_vbTlExpanded.has(cardId);
  if (isOpen) _vbTlExpanded.add(cardId); else _vbTlExpanded.delete(cardId);

  cardEl.classList.toggle('expanded', isOpen);
  const expEl = cardEl.querySelector('.vb-tl-card-expanded');
  if (expEl) expEl.style.display = isOpen ? '' : 'none';
  const tgEl = cardEl.querySelector('.vb-tl-card-toggle');
  if (tgEl) tgEl.textContent = isOpen ? '▾' : '▸';
}

// Returns the rich HTML body to render in the expanded card, ensuring commit
// cards have their structured draft generated.
function _timelineRichHtml(card, idea) {
  if (card.commitMeta) {
    _ensureCommitCardDraft(card, idea);
    if (card.draft) return card.draft;
  }
  if (card.draft) return card.draft;
  return escapeHtml(card.text || '').replace(/\n/g, '<br>');
}

// Unified timeline-card renderer. Always shows a clickable summary row;
// toggle expands to the full rich HTML.  opts.showTheme adds the feature
// chip on the right of the meta row (used by Latest → Oldest sub-view).
function _renderTimelineCard(c, idea, opts = {}) {
  const meta    = c.commitMeta || {};
  const date    = c.shippedAt ? new Date(c.shippedAt) : null;
  const dateStr = date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const timeStr = date ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  const subject = _bestCardSubject(c);
  const snippet = subject.slice(0, 200);
  const hash    = meta.commitHash ? `<span class="vb-tl-card-hash">${escapeHtml(meta.commitHash)}</span>` : '';
  const app     = meta.appName    ? `<span class="vb-tl-card-app">${escapeHtml(meta.appName)}</span>`    : '';

  const theme   = c.featureTheme || FEATURE_UNCLASSIFIED;
  const tColor  = _featureColorFor(theme);
  const themeChip = opts.showTheme
    ? `<span class="vb-tl-recent-theme" style="background:${tColor}22;color:${tColor};border-color:${tColor}55">${escapeHtml(theme)}</span>`
    : '';

  const isOpen   = _vbTlExpanded.has(c.id);
  const richHtml = _timelineRichHtml(c, idea);
  const borderStyle = opts.showTheme ? ` style="border-left:3px solid ${tColor}"` : '';

  return `
    <div class="vb-tl-card${isOpen ? ' expanded' : ''}" data-card-id="${escapeAttr(c.id)}"${borderStyle}>
      <div class="vb-tl-card-summary" onclick="vbToggleTimelineCard('${escapeAttr(c.id)}')">
        <div class="vb-tl-card-meta">
          <span class="vb-tl-card-date">${escapeHtml(dateStr)}</span>
          <span class="vb-tl-card-time">${escapeHtml(timeStr)}</span>
          ${app}${hash}
          ${themeChip}
        </div>
        <div class="vb-tl-card-text">
          <span class="vb-tl-card-toggle">${isOpen ? '▾' : '▸'}</span>
          <span class="vb-tl-card-subject">${escapeHtml(snippet)}${(subject || '').length > 200 ? '…' : ''}</span>
        </div>
      </div>
      <div class="vb-tl-card-expanded" style="display:${isOpen ? '' : 'none'}">
        <div class="vb-tl-card-rich">${richHtml}</div>
      </div>
    </div>
  `;
}

// Sub-view: flat chronological list, latest first, day-grouped.
function _renderTimelineRecent(shipped, idea) {
  const sorted = shipped.slice().sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0));

  const dayGroups = new Map();
  sorted.forEach(c => {
    const d   = new Date(c.shippedAt || c.createdAt || Date.now());
    const key = d.toISOString().slice(0, 10);
    if (!dayGroups.has(key)) dayGroups.set(key, []);
    dayGroups.get(key).push(c);
  });

  const sections = [...dayGroups.entries()].map(([key, list]) => {
    const d        = new Date(key + 'T00:00:00');
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const items    = list.map(c => _renderTimelineCard(c, idea, { showTheme: true })).join('');
    return `
      <div class="vb-tl-day">
        <div class="vb-tl-day-label">${escapeHtml(dayLabel)} <span class="vb-tl-day-count">${list.length}</span></div>
        <div class="vb-tl-day-cards">${items}</div>
      </div>
    `;
  }).join('');

  return `<div class="vb-tl-recent">${sections}</div>`;
}

// Sub-view: grouped by feature catalog.
function _renderTimelineCategorized(shipped, featureCatalog, idea) {
  const groups = new Map();
  shipped.forEach(c => {
    const theme = c.featureTheme || FEATURE_UNCLASSIFIED;
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme).push(c);
  });
  groups.forEach(arr => arr.sort((a, b) => (b.shippedAt || 0) - (a.shippedAt || 0)));

  const catalogNames = featureCatalog.map(f => f.name);
  const orderedThemes = [];
  catalogNames.forEach(name => { if (groups.has(name)) orderedThemes.push([name, groups.get(name)]); });
  [...groups.entries()]
    .filter(([name]) => !catalogNames.includes(name))
    .forEach(entry => orderedThemes.push(entry));

  const sectionsHtml = orderedThemes.map(([theme, cardsInGroup]) => {
    const color = _featureColorFor(theme);
    const items = cardsInGroup.map(c => _renderTimelineCard(c, idea)).join('');
    return `
      <div class="vb-tl-section" style="border-left:3px solid ${color}">
        <div class="vb-tl-section-header">
          <span class="vb-tl-section-dot" style="background:${color}"></span>
          <span class="vb-tl-section-name">${escapeHtml(theme)}</span>
          <span class="vb-tl-section-count">${cardsInGroup.length}</span>
        </div>
        <div class="vb-tl-section-cards">${items}</div>
      </div>
    `;
  }).join('');

  return `<div class="vb-tl-sections">${sectionsHtml}</div>`;
}

// ─── VibeBoard Search ─────────────────────────────────────────────────────────
function onVbSearchInput(value) {
  APP.ui.vbSearch = value;
  _applyVbSearchFilter();
}

function _applyVbSearchFilter() {
  const ideaId = _boardIdeaId();
  if (!ideaId) return;
  const cards = APP.state.ideas[ideaId]?.vibeCards || [];
  const q     = (APP.ui.vbSearch || '').trim().toLowerCase();

  function matches(card) {
    if (!q) return true;
    const text  = (card.text || '').toLowerCase() + ' ' + (card.draft || '').toLowerCase();
    const meta  = card.commitMeta || {};
    const theme = (card.featureTheme || '').toLowerCase();
    return text.includes(q)
        || (meta.commitHash || '').toLowerCase().includes(q)
        || (meta.fullHash   || '').toLowerCase().includes(q)
        || (meta.appName    || '').toLowerCase().includes(q)
        || theme.includes(q);
  }

  // Board view: kanban cards
  cards.forEach(card => {
    const el = document.getElementById(`vb-card-${card.id}`);
    if (el) el.style.display = matches(card) ? '' : 'none';
  });

  // Timeline view: vb-tl-card[data-card-id]
  document.querySelectorAll('.vb-tl-card[data-card-id]').forEach(el => {
    const cardId = el.dataset.cardId;
    const card   = cards.find(c => c.id === cardId);
    el.style.display = (card && matches(card)) ? '' : 'none';
  });

  // Hide empty containers in the timeline
  const isCardVisible = (el) => el.style.display !== 'none';
  document.querySelectorAll('.vb-tl-day').forEach(day => {
    const any = [...day.querySelectorAll('.vb-tl-card[data-card-id]')].some(isCardVisible);
    day.style.display = any ? '' : 'none';
  });
  document.querySelectorAll('.vb-tl-section').forEach(sec => {
    const any = [...sec.querySelectorAll('.vb-tl-card[data-card-id]')].some(isCardVisible);
    sec.style.display = any ? '' : 'none';
  });

  // Column counts (board view only — Timeline doesn't have these elements)
  (APP.state.vibeBoard?.columns || []).forEach(col => {
    const colCards = cards.filter(c => c.columnId === col.id);
    const visible  = colCards.filter(matches).length;
    const countEl  = document.getElementById(`vb-count-${col.id}`);
    if (countEl) countEl.textContent = q ? `${visible}/${colCards.length}` : `${colCards.length}`;
  });
}

// ─── Back to Editor ────────────────────────────────────────────────────────────
function vibeboardBackToEditor() {
  document.removeEventListener('click', _vbOutsideClick, { capture: true });
  renderEditor();
}

// ─── Toggle Category Panel ─────────────────────────────────────────────────────
function toggleVibeCatPanel() {
  const panel  = document.getElementById('vb-cats-panel');
  const toggle = document.getElementById('vb-cats-toggle');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (toggle) toggle.classList.toggle('active', isOpen);
}

// ─── Outside Click (dismiss popups) ───────────────────────────────────────────
function _vbOutsideClick(e) {
  if (!e.target.closest('.vb-cat-picker') && !e.target.closest('.vb-card-cat-btn')) {
    document.querySelectorAll('.vb-cat-picker').forEach(p => p.remove());
  }
  if (!e.target.closest('.vb-move-picker') && !e.target.closest('.vb-card-move-btn')) {
    document.querySelectorAll('.vb-move-picker').forEach(p => p.remove());
  }
}

// ─── Render: Category Panel ────────────────────────────────────────────────────
function _renderCatPanel(cats) {
  const swatches = VIBE_COLOR_PALETTE.map(color => `
    <div class="vb-color-swatch${color === _vbNewCatColor ? ' selected' : ''}"
         style="background:${color}"
         data-color="${color}"
         onclick="vbSelectColor('${color}')"
         title="${color}"></div>
  `).join('');

  const chips = cats.map(cat => `
    <div class="vb-cat-chip" style="border-left:3px solid ${cat.color}">
      <div class="vb-cat-swatch" style="background:${cat.color}"></div>
      <span class="vb-cat-chip-name"
            contenteditable="true"
            spellcheck="false"
            data-cat-id="${escapeAttr(cat.id)}"
            onblur="vbRenameCat(this)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
      >${escapeHtml(cat.name)}</span>
      <button class="vb-cat-del"
              onclick="vbDeleteCat('${escapeAttr(cat.id)}')"
              title="Delete category">✕</button>
    </div>
  `).join('');

  return `
    <div class="vibeboard-cats-title">Prompt Categories</div>
    <div class="vibeboard-cats-list" id="vb-cats-list">
      ${chips || '<span style="font-size:12px;color:var(--text-3)">No categories yet — add one below</span>'}
    </div>
    <div class="vb-add-cat-row">
      <div class="vb-color-swatches">${swatches}</div>
      <input class="vb-add-cat-input"
             id="vb-add-cat-input"
             type="text"
             placeholder="Category name…"
             maxlength="30"
             onkeydown="if(event.key==='Enter'){event.preventDefault();vbAddCat()}">
      <button class="vb-add-cat-btn" onclick="vbAddCat()">+ Add</button>
    </div>
  `;
}

// ─── Render: Column ────────────────────────────────────────────────────────────
function _colAddBtn(colId, ideaId) {
  return `<button class="vb-col-add-inline"
          onclick="vbAddCard('${escapeAttr(colId)}','${escapeAttr(ideaId)}')"
          title="Add card">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    Add card
  </button>`;
}

function _renderColumn(col, cards, cats, ideaId) {
  const colCards = _sortColCards(cards.filter(c => c.columnId === col.id), col.id);

  const cardsHtml = colCards.length > 0
    ? colCards.map(card => _renderCard(card, cats, col.id)).join('')
    : `<div class="vb-col-empty">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.25">
           <path d="M4 6h16v2H4zm2 5h12v2H6zm3 5h6v2H9z"/>
         </svg>
         <span>No cards yet</span>
       </div>`;

  return `
    <div class="vb-col"
         id="vb-col-${escapeAttr(col.id)}"
         data-col-id="${escapeAttr(col.id)}"
         ondragover="vbColDragOver(event,'${escapeAttr(col.id)}')"
         ondrop="vbColDrop(event,'${escapeAttr(col.id)}','${escapeAttr(ideaId)}')"
         ondragleave="vbColDragLeave(event)">

      <div class="vb-col-header">
        <span class="vb-col-name"
              contenteditable="true"
              spellcheck="false"
              data-col-id="${escapeAttr(col.id)}"
              onblur="vbRenameColumn(this)"
              onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
        >${escapeHtml(col.name)}</span>
        <span class="vb-col-count" id="vb-count-${escapeAttr(col.id)}">${colCards.length}</span>
        <button class="vb-col-add"
                onclick="vbAddCard('${escapeAttr(col.id)}','${escapeAttr(ideaId)}')"
                title="Add card">+</button>
      </div>

      <div class="vb-cards" id="vb-cards-${escapeAttr(col.id)}">
        ${cardsHtml}
        ${_colAddBtn(col.id, ideaId)}
      </div>
    </div>
  `;
}

// ─── Render: Card ──────────────────────────────────────────────────────────────
function _renderCard(card, cats, currentColId) {
  const cat      = cats.find(c => c.id === card.categoryId);
  const catColor = cat ? cat.color : null;
  const catName  = cat ? cat.name  : '';

  const borderStyle = catColor
    ? `style="border-left-color:${catColor}"`
    : `style="border-left-color:var(--border-2)"`;

  // Editor icon — lives in the actions row (bottom-right, before copy)
  const expandBtn = `
    <button class="vb-card-expand-btn"
            onclick="vbOpenCardModal('${escapeAttr(card.id)}')"
            title="Open full editor">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </button>`;

  // Category selector — always visible at top
  const catSel = cat ? `
    <button class="vb-card-cat-sel vb-card-cat-sel--set"
            style="color:${catColor};border-color:${catColor}28"
            onclick="vbOpenCatPicker(event,'${escapeAttr(card.id)}')"
            title="Change category">
      <span class="vb-card-cat-sel-dot" style="background:${catColor}"></span>
      ${escapeHtml(catName)}
    </button>` : `
    <button class="vb-card-cat-sel vb-card-cat-sel--empty"
            onclick="vbOpenCatPicker(event,'${escapeAttr(card.id)}')"
            title="Set category">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.4">
        <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
      </svg>
      Category
    </button>`;

  return `
    <div class="vb-card"
         id="vb-card-${escapeAttr(card.id)}"
         data-card-id="${escapeAttr(card.id)}"
         data-col-id="${escapeAttr(currentColId)}"
         ${borderStyle}
         draggable="true"
         ondragstart="vbCardDragStart(event,'${escapeAttr(card.id)}')"
         ondragend="vbCardDragEnd(event)"
         ondragover="vbCardDragOver(event,'${escapeAttr(card.id)}')"
         ondrop="vbCardDrop(event,'${escapeAttr(card.id)}','${escapeAttr(currentColId)}')">
      ${catSel}
      <div class="vb-card-text${card.draft ? ' vb-card-text--preview' : ''}"
           contenteditable="${card.draft ? 'false' : 'true'}"
           spellcheck="true"
           data-card-id="${escapeAttr(card.id)}"
           data-placeholder="Write a prompt…"
           onblur="vbSaveCardText(this)"
           onkeydown="vbCardKeydown(event,this)"
           onclick="${card.draft ? `vbOpenCardModal('${escapeAttr(card.id)}')` : ''}"
           ondblclick="${!card.draft ? `vbOpenCardModal('${escapeAttr(card.id)}')` : ''}"
      ></div>
      <div class="vb-card-actions">
        <button class="vb-card-move-btn"
                onclick="vbOpenMovePicker(event,'${escapeAttr(card.id)}')"
                title="Move to column">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
          </svg>
          Move
        </button>
        <button class="vb-card-dup-btn"
                onclick="vbDuplicateCard('${escapeAttr(card.id)}')"
                title="Duplicate card">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
        <button class="vb-card-del-btn"
                onclick="vbDeleteCard('${escapeAttr(card.id)}')"
                title="Delete card">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
        ${expandBtn}
        ${(card.attachments && card.attachments.length > 0) ? `
        <span class="vb-card-att-badge" title="${card.attachments.length} attachment${card.attachments.length > 1 ? 's' : ''}">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
          </svg>
          ${card.attachments.length}
        </span>` : ''}
        <button class="vb-card-copy-btn vb-card-copy-btn--right"
                onclick="vbCopyCard('${escapeAttr(card.id)}')"
                title="Copy text to clipboard">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// ─── Column: Rename ────────────────────────────────────────────────────────────
function vbRenameColumn(el) {
  const colId   = el.dataset.colId;
  const newName = el.textContent.trim();
  const col     = APP.state.vibeBoard.columns.find(c => c.id === colId);
  if (!col) return;
  if (!newName) { el.textContent = col.name; return; }
  if (col.name !== newName) {
    col.name = newName;
    saveAppState();
  }
}

// ─── Card: Add ─────────────────────────────────────────────────────────────────
function vbAddCard(colId, ideaId) {
  ensureIdeaVibeCards(ideaId);
  const cards    = APP.state.ideas[ideaId].vibeCards;
  const colCards = cards.filter(c => c.columnId === colId);

  const newCard = {
    id:         generateId(),
    columnId:   colId,
    text:       '',
    categoryId: _hasShippedCard(ideaId) ? null : 'vbcat-0',
    createdAt:  Date.now(),
    order:      colCards.length,
  };

  cards.push(newCard);
  saveAppState();

  _refreshColumn(colId, ideaId);
  renderSidebar();

  // Focus the new card's text area
  requestAnimationFrame(() => {
    const cardEl = document.getElementById(`vb-card-${newCard.id}`);
    if (cardEl) cardEl.querySelector('.vb-card-text')?.focus();
  });
}

// ─── Card: Save Text ───────────────────────────────────────────────────────────
function vbSaveCardText(el) {
  const cardId = el.dataset.cardId;
  const ideaId = _boardIdeaId();
  if (!ideaId) return;

  const card = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  const newText = el.textContent.trim();
  if (card.text !== newText) {
    card.text = newText;
    saveAppState();
  }
}

// ─── Card: Keydown ─────────────────────────────────────────────────────────────
function vbCardKeydown(event, el) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    el.blur();
  }
  if (event.key === 'Escape') {
    el.blur();
  }
}

/// ─── Card: Copy to Clipboard ──────────────────────────────────────────────────
function vbCopyCard(cardId) {
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card?.text) return;

  navigator.clipboard.writeText(card.text).then(() => {
    // Briefly swap the icon to a checkmark to confirm
    const btn = document.querySelector(`#vb-card-${cardId} .vb-card-copy-btn--right`);
    if (btn) {
      btn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
      </svg>`;
      btn.style.color = 'var(--success)';
      setTimeout(() => {
        btn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>`;
        btn.style.color = '';
      }, 1500);
    }
    showToast('Copied to clipboard');
  }).catch(() => showToast('Copy failed', 'error'));
}

// ─── Card: Delete ──────────────────────────────────────────────────────────────
function vbDeleteCard(cardId) {
  const ideaId = _boardIdeaId();
  if (!ideaId) return;

  const idea = APP.state.ideas[ideaId];
  if (!idea?.vibeCards) return;

  const idx = idea.vibeCards.findIndex(c => c.id === cardId);
  if (idx === -1) return;

  const colId = idea.vibeCards[idx].columnId;
  idea.vibeCards.splice(idx, 1);
  saveAppState();

  _refreshColumn(colId, ideaId);
  renderSidebar();
}

// ─── Card: Duplicate ──────────────────────────────────────────────────────────
function vbDuplicateCard(cardId) {
  const ideaId = _boardIdeaId();
  if (!ideaId) return;

  const idea = APP.state.ideas[ideaId];
  const src  = idea?.vibeCards?.find(c => c.id === cardId);
  if (!src) return;

  // Deep-clone the card, give it a new id, place it immediately after the source
  const colCards = idea.vibeCards
    .filter(c => c.columnId === src.columnId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const srcIdx = colCards.findIndex(c => c.id === cardId);

  const dupe = {
    ...src,
    id:          generateId(),
    createdAt:   Date.now(),
    attachments: (src.attachments || []).map(a => ({ ...a })),
  };

  // Shift order of all cards after the source to make room
  colCards.forEach(c => { if ((c.order || 0) > (src.order || 0)) c.order++; });
  dupe.order = (src.order || 0) + 1;

  idea.vibeCards.splice(idea.vibeCards.indexOf(src) + 1, 0, dupe);
  saveAppState();

  _refreshColumn(src.columnId, ideaId);
  renderSidebar();
}

// ─── Card: Move ────────────────────────────────────────────────────────────────
function vbMoveCard(cardId, newColId) {
  const ideaId = _boardIdeaId();
  if (!ideaId) return;

  const idea = APP.state.ideas[ideaId];
  const card = idea?.vibeCards?.find(c => c.id === cardId);
  if (!card || card.columnId === newColId) return;

  const oldColId  = card.columnId;
  card.columnId   = newColId;
  card.order      = idea.vibeCards.filter(c => c.columnId === newColId).length - 1;
  if (_isShippedCol(newColId)) {
    card.shippedAt   = Date.now();
    card.featureTheme = _classifyCardForIdea(card, idea);
  }
  saveAppState();

  document.querySelectorAll('.vb-move-picker').forEach(p => p.remove());

  _refreshColumn(oldColId, ideaId);
  _refreshColumn(newColId, ideaId);
  renderSidebar();
}

// ─── Card: Set Category ────────────────────────────────────────────────────────
function vbSetCardCategory(cardId, catId) {
  const ideaId = _boardIdeaId();
  if (!ideaId) return;

  const idea = APP.state.ideas[ideaId];
  const card = idea?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  card.categoryId = catId;
  saveAppState();

  _refreshColumn(card.columnId, ideaId);
}

// ─── Category Picker Popup ─────────────────────────────────────────────────────
function vbOpenCatPicker(event, cardId) {
  event.stopPropagation();
  document.querySelectorAll('.vb-cat-picker').forEach(p => p.remove());

  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  const cats   = APP.state.vibeBoard.promptCategories;

  const picker = document.createElement('div');
  picker.className = 'vb-cat-picker';

  const lbl = document.createElement('span');
  lbl.className   = 'vb-picker-label';
  lbl.textContent = 'Set category';
  picker.appendChild(lbl);

  // None option
  const none = document.createElement('div');
  none.className = 'vb-cat-picker-item' + (!card?.categoryId ? ' selected' : '');
  none.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:var(--border-3);flex-shrink:0"></div><span>None</span>`;
  none.onclick   = () => { vbSetCardCategory(cardId, null); picker.remove(); };
  picker.appendChild(none);

  cats.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'vb-cat-picker-item' + (card?.categoryId === cat.id ? ' selected' : '');
    item.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${cat.color};flex-shrink:0"></div><span>${escapeHtml(cat.name)}</span>`;
    item.onclick   = () => { vbSetCardCategory(cardId, cat.id); picker.remove(); };
    picker.appendChild(item);
  });

  document.body.appendChild(picker);
  _positionPopup(picker, event.currentTarget);
}

// ─── Move Picker Popup ─────────────────────────────────────────────────────────
function vbOpenMovePicker(event, cardId) {
  event.stopPropagation();
  document.querySelectorAll('.vb-move-picker').forEach(p => p.remove());

  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  const cols   = APP.state.vibeBoard.columns;

  const picker = document.createElement('div');
  picker.className = 'vb-move-picker';

  const lbl = document.createElement('div');
  lbl.className   = 'vb-picker-label';
  lbl.textContent = 'Move to column';
  picker.appendChild(lbl);

  cols.forEach(col => {
    const isCurrent = card?.columnId === col.id;
    const item      = document.createElement('div');
    item.className  = 'vb-move-picker-item' + (isCurrent ? ' current' : '');

    const dot = `<div style="width:6px;height:6px;border-radius:50%;background:${isCurrent ? 'var(--text-3)' : 'var(--border-3)'};flex-shrink:0"></div>`;
    item.innerHTML = dot + escapeHtml(col.name);

    if (!isCurrent) item.onclick = () => vbMoveCard(cardId, col.id);
    picker.appendChild(item);
  });

  document.body.appendChild(picker);
  _positionPopup(picker, event.currentTarget);
}

// ─── Category CRUD ─────────────────────────────────────────────────────────────
function vbSelectColor(color) {
  _vbNewCatColor = color;
  document.querySelectorAll('.vb-color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === color);
  });
}

function vbAddCat() {
  const input = document.getElementById('vb-add-cat-input');
  const name  = input?.value.trim();
  if (!name) { input?.focus(); return; }

  APP.state.vibeBoard.promptCategories.push({
    id:    generateId(),
    name:  name,
    color: _vbNewCatColor,
  });
  saveAppState();
  if (input) input.value = '';

  // Re-render the panel
  const panel = document.getElementById('vb-cats-panel');
  if (panel) panel.innerHTML = _renderCatPanel(APP.state.vibeBoard.promptCategories);
  if (panel) panel.classList.add('open');

  showToast('Category added');
}

function vbRenameCat(el) {
  const catId   = el.dataset.catId;
  const newName = el.textContent.trim();
  const cat     = APP.state.vibeBoard.promptCategories.find(c => c.id === catId);
  if (!cat) return;
  if (!newName) { el.textContent = cat.name; return; }
  if (cat.name !== newName) {
    cat.name = newName;
    saveAppState();
  }
}

function vbDeleteCat(catId) {
  const cats = APP.state.vibeBoard.promptCategories;
  const idx  = cats.findIndex(c => c.id === catId);
  if (idx === -1) return;
  cats.splice(idx, 1);

  // Unlink any cards using this category
  const ideaId = _boardIdeaId();
  if (ideaId && APP.state.ideas[ideaId]?.vibeCards) {
    APP.state.ideas[ideaId].vibeCards.forEach(card => {
      if (card.categoryId === catId) card.categoryId = null;
    });
  }

  saveAppState();

  // Re-render panel
  const panel = document.getElementById('vb-cats-panel');
  if (panel) {
    panel.innerHTML = _renderCatPanel(APP.state.vibeBoard.promptCategories);
    panel.classList.add('open');
  }

  // Re-render all columns to update card colors
  if (ideaId) {
    APP.state.vibeBoard.columns.forEach(col => _refreshColumn(col.id, ideaId));
  }

  showToast('Category deleted');
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────
function vbCardDragStart(event, cardId) {
  _vbDragCardId = cardId;
  _vbDragIdeaId = _boardIdeaId();
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.getElementById(`vb-card-${cardId}`);
    if (el) el.classList.add('dragging');
  }, 0);
}

function vbCardDragEnd(_event) {
  if (_vbDragCardId) {
    const el = document.getElementById(`vb-card-${_vbDragCardId}`);
    if (el) el.classList.remove('dragging');
  }
  _vbDragCardId = null;
  document.querySelectorAll('.vb-col.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelectorAll('.vb-card.drop-before, .vb-card.drop-after')
    .forEach(el => el.classList.remove('drop-before', 'drop-after'));
}

function vbCardDragOver(event, targetCardId) {
  if (!_vbDragCardId || _vbDragCardId === targetCardId) return;
  event.preventDefault();

  const cardEl = document.getElementById(`vb-card-${targetCardId}`);
  if (!cardEl) return;

  // Clear all existing indicators
  document.querySelectorAll('.vb-card.drop-before, .vb-card.drop-after')
    .forEach(el => el.classList.remove('drop-before', 'drop-after'));

  const rect = cardEl.getBoundingClientRect();
  cardEl.classList.add(event.clientY < rect.top + rect.height / 2 ? 'drop-before' : 'drop-after');
}

function vbCardDrop(event, targetCardId, colId) {
  event.preventDefault();
  event.stopPropagation(); // prevent vbColDrop from also firing

  document.querySelectorAll('.vb-card.drop-before, .vb-card.drop-after')
    .forEach(el => el.classList.remove('drop-before', 'drop-after'));
  document.querySelectorAll('.vb-col.drag-over').forEach(el => el.classList.remove('drag-over'));

  if (!_vbDragCardId || _vbDragCardId === targetCardId) return;

  const ideaId = _vbDragIdeaId;
  if (!ideaId) return;

  const idea       = APP.state.ideas[ideaId];
  const allCards   = idea?.vibeCards;
  if (!allCards) return;

  const dragCard   = allCards.find(c => c.id === _vbDragCardId);
  const targetCard = allCards.find(c => c.id === targetCardId);
  if (!dragCard || !targetCard) return;

  // Determine insert position (above or below target)
  const cardEl      = document.getElementById(`vb-card-${targetCardId}`);
  const rect        = cardEl?.getBoundingClientRect();
  const insertBefore = rect ? event.clientY < rect.top + rect.height / 2 : false;

  const oldColId    = dragCard.columnId;
  dragCard.columnId = colId;
  if (oldColId !== colId && _isShippedCol(colId)) {
    dragCard.shippedAt   = Date.now();
    dragCard.featureTheme = _classifyCardForIdea(dragCard, idea);
  }

  // Sorted cards in target column excluding the drag card
  const colCards = allCards
    .filter(c => c.columnId === colId && c.id !== _vbDragCardId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const targetIdx = colCards.findIndex(c => c.id === targetCardId);
  colCards.splice(insertBefore ? targetIdx : targetIdx + 1, 0, dragCard);

  // Re-assign sequential order values
  colCards.forEach((c, i) => { c.order = i; });

  saveAppState();

  const movedId = _vbDragCardId;
  _vbDragCardId = null;

  _refreshColumn(colId, ideaId);
  if (oldColId !== colId) {
    _refreshColumn(oldColId, ideaId);
    renderSidebar();
  }

  _vbCopyCardToClipboard(movedId);
}

function vbColDragOver(event, colId) {
  if (!_vbDragCardId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const colEl = document.getElementById(`vb-col-${colId}`);
  if (colEl) colEl.classList.add('drag-over');
}

function vbColDragLeave(event) {
  const col = event.currentTarget;
  if (!col.contains(event.relatedTarget)) {
    col.classList.remove('drag-over');
  }
}

function vbColDrop(event, colId, ideaId) {
  event.preventDefault();
  document.querySelectorAll('.vb-col.drag-over').forEach(el => el.classList.remove('drag-over'));
  if (!_vbDragCardId || _vbDragIdeaId !== ideaId) return;

  const cardId  = _vbDragCardId;
  _vbDragCardId = null;

  vbMoveCard(cardId, colId);
  _vbCopyCardToClipboard(cardId);
}

// ─── Private: copy card text to clipboard + show pill nudge ──────────────────
function _vbCopyCardToClipboard(cardId) {
  const ideaId = _boardIdeaId();
  const idea   = APP.state.ideas[ideaId];
  const card   = idea?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  const catColor = card.categoryId
    ? (APP.state.vibeBoard?.promptCategories?.find(c => c.id === card.categoryId)?.color || null)
    : null;

  const textToCopy = card.draft
    ? card.draft.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    : (card.text || '').trim();

  if (!textToCopy) return;

  navigator.clipboard.writeText(textToCopy).then(() => {
    const cardEl = document.getElementById(`vb-card-${cardId}`);
    if (!cardEl) return;

    // Remove any existing train on this card
    cardEl.querySelector('.vb-copy-train')?.remove();

    const train = document.createElement('span');
    train.className = 'vb-copy-train';
    train.textContent = 'copied to clipboard';
    if (catColor) {
      train.style.borderColor = catColor + '66';
      train.style.color = catColor;
    }
    cardEl.appendChild(train);

    // Slide in (next frame so transition fires)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => train.classList.add('vb-copy-train--in'));
    });

    // Slide back out after 1.8s, then remove
    setTimeout(() => {
      train.classList.remove('vb-copy-train--in');
      train.addEventListener('transitionend', () => train.remove(), { once: true });
    }, 1800);
  }).catch(() => {/* silent — clipboard denied */});
}

// ─── Private: Column Refresh ───────────────────────────────────────────────────
function _refreshColumn(colId, ideaId) {
  const cardsEl = document.getElementById(`vb-cards-${colId}`);
  const countEl = document.getElementById(`vb-count-${colId}`);
  if (!cardsEl) return;

  const idea    = APP.state.ideas[ideaId];
  const cats    = APP.state.vibeBoard.promptCategories;
  const colCards = _sortColCards((idea?.vibeCards || []).filter(c => c.columnId === colId), colId);

  const emptyHtml = `<div class="vb-col-empty">
       <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.25">
         <path d="M4 6h16v2H4zm2 5h12v2H6zm3 5h6v2H9z"/>
       </svg>
       <span>No cards yet</span>
     </div>`;

  cardsEl.innerHTML = (colCards.length > 0
    ? colCards.map(card => _renderCard(card, cats, colId)).join('')
    : emptyHtml)
    + _colAddBtn(colId, ideaId);

  if (countEl) countEl.textContent = colCards.length;

  // Hydrate card text areas (draft HTML can't live in template literals)
  _hydrateCardContent(cardsEl, idea?.vibeCards || []);

  _applyVbSearchFilter();
}

// ─── Private: Hydrate card text with draft/text content ──────────────────────
// Must run AFTER innerHTML is set on a container, because HTML from card.draft
// cannot be safely embedded in a template literal.
function _hydrateCardContent(container, allCards) {
  // Lazy-migrate any commit cards still on the old text-only format
  const ideaId = _boardIdeaId();
  const idea   = ideaId ? APP.state.ideas[ideaId] : null;
  let mutated  = false;
  allCards.forEach(card => {
    if (!card.commitMeta) return;
    const before = card.draft;
    _ensureCommitCardDraft(card, idea);
    if (card.draft !== before) mutated = true;
  });
  if (mutated) saveAppState();

  container.querySelectorAll('.vb-card-text[data-card-id]').forEach(el => {
    const card = allCards.find(c => c.id === el.dataset.cardId);
    if (!card) return;
    if (card.draft) {
      el.innerHTML = card.draft;
    } else {
      el.innerText = card.text || '';
    }
  });
}

// ─── Private: Get current board idea ID ───────────────────────────────────────
function _boardIdeaId() {
  return document.getElementById('vibeboard')?.dataset.idea || null;
}

// ─── Private: Position popup near trigger element ─────────────────────────────
function _positionPopup(popup, trigger) {
  const rect       = trigger.getBoundingClientRect();
  const popupRect  = popup.getBoundingClientRect();
  let top  = rect.bottom + 5;
  let left = rect.left;

  if (left + popupRect.width > window.innerWidth - 8) {
    left = window.innerWidth - popupRect.width - 8;
  }
  if (top + popupRect.height > window.innerHeight - 8) {
    top = rect.top - popupRect.height - 5;
  }
  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';
}

// ─── Card Modal: Full Editor ───────────────────────────────────────────────────
let _vbModalDraftTimer = null;

function vbOpenCardModal(cardId) {
  const ideaId = _boardIdeaId();
  if (!ideaId) return;

  const idea = APP.state.ideas[ideaId];
  const card = idea?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  // Ensure draft field exists
  if (!('draft' in card)) card.draft = '';

  // Lazy-migrate old commit cards into the rich render (idempotent)
  if (card.commitMeta) {
    const before = card.draft;
    _ensureCommitCardDraft(card, idea);
    if (card.draft !== before) saveAppState();
  }

  const cats     = APP.state.vibeBoard.promptCategories;
  const cat      = cats.find(c => c.id === card.categoryId);
  const catColor = cat ? cat.color : null;


  // Category selector for modal header
  const catSelHtml = cat ? `
    <button class="vb-modal-cat-sel vb-modal-cat-sel--set"
            style="color:${catColor};border-color:${catColor}28"
            onclick="vbModalCatPicker(event,'${escapeAttr(cardId)}')" title="Change category">
      <span style="width:7px;height:7px;border-radius:50%;background:${catColor};flex-shrink:0;display:inline-block"></span>
      ${escapeHtml(cat.name)}
    </button>` : `
    <button class="vb-modal-cat-sel vb-modal-cat-sel--empty"
            onclick="vbModalCatPicker(event,'${escapeAttr(cardId)}')" title="Set category">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.4">
        <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
      </svg>
      Category
    </button>`;


  const overlay = document.createElement('div');
  overlay.className = 'vb-card-modal-overlay';
  overlay.id        = 'vb-card-modal-overlay';
  overlay.dataset.cardId  = cardId;
  overlay.dataset.ideaId  = ideaId;

  overlay.innerHTML = `
    <div class="vb-card-modal" id="vb-card-modal">
      <div class="vb-card-modal-header">
        <div class="vb-card-modal-header-left">
          ${catSelHtml}
        </div>
        <div class="vb-card-modal-header-right">
          <button class="vb-modal-action-btn"
                  onclick="vbModalExportPdf('${escapeAttr(cardId)}')" title="Export card as PDF">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
            </svg>
            Export PDF
          </button>
          <button class="vb-modal-action-btn"
                  onclick="vbModalExportZip('${escapeAttr(cardId)}')" title="Export card + attachments as ZIP">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.54 15.5.05 12.45.05 10.26.05 8.39 1.3 7.42 3.09L7 4H4c-2.21 0-4 1.79-4 4v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3v3.5l-3 3-3-3V9h2v3l1 1 1-1V9h2z"/>
            </svg>
            Export ZIP
          </button>
          <button class="vb-modal-action-btn"
                  id="vb-modal-copy-btn"
                  onclick="vbModalCopy('${escapeAttr(cardId)}')" title="Copy to clipboard">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copy
          </button>
          <button class="vb-modal-action-btn"
                  onclick="vbModalTriggerAttach('${escapeAttr(cardId)}')" title="Add attachment (max 4)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
            Attach
          </button>
          <button class="vb-modal-action-btn vb-modal-action-btn--danger"
                  onclick="vbModalDelete('${escapeAttr(cardId)}')" title="Delete card">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Delete
          </button>
          <div class="vb-card-modal-sep"></div>
          <button class="vb-modal-close-btn" onclick="vbCloseCardModal()" title="Close (Esc)">✕</button>
        </div>
      </div>
      <div class="vb-card-modal-body">
        <div class="vb-card-modal-editor editor-content"
             id="vb-card-modal-editor"
             contenteditable="true"
             spellcheck="true"
             data-placeholder="Write detailed notes, prompts, ideas…"
             oninput="vbModalDraftInput()"
        ></div>
        <div class="vb-modal-attachments" id="vb-modal-attachments"></div>
      </div>
    </div>
    <input type="file" id="vb-attach-input" style="display:none"
           multiple accept="image/*,.pdf,.txt,.md,.json,.csv"
           onchange="vbModalAttachFiles(event,'${escapeAttr(cardId)}')">
  `;

  document.body.appendChild(overlay);

  // Set rich content via innerHTML (not template literal to avoid escaping issues)
  const editorEl = document.getElementById('vb-card-modal-editor');
  if (card.draft) {
    editorEl.innerHTML = card.draft;
  } else if (card.text) {
    editorEl.textContent = card.text;  // plain text fallback
  }
  _updateVbEditorPlaceholder(editorEl);
  _vbRenderAttachments(cardId);

  // Focus at end
  requestAnimationFrame(() => {
    editorEl.focus();
    const sel   = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  });

  // Overlay click intentionally does NOT close modal — use the X button

  // Keyboard: slash menu nav only — modal closes via X button only
  overlay.addEventListener('keydown', e => {
    if (typeof editorKeydown === 'function') editorKeydown(e);
  });

  // Paste handler (reuse app's paste cleanup if available)
  if (typeof handleEditorPaste === 'function') {
    editorEl.addEventListener('paste', handleEditorPaste);
  }
}

function vbModalDraftInput() {
  const editorEl = document.getElementById('vb-card-modal-editor');
  const overlay  = document.getElementById('vb-card-modal-overlay');
  if (!editorEl || !overlay) return;
  _updateVbEditorPlaceholder(editorEl);

  clearTimeout(_vbModalDraftTimer);
  _vbModalDraftTimer = setTimeout(() => {
    const cardId = overlay.dataset.cardId;
    const ideaId = overlay.dataset.ideaId;
    const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
    if (card) {
      card.draft = editorEl.innerHTML;
      saveAppState();
    }
  }, 400);
}

function vbCloseCardModal() {
  clearTimeout(_vbModalDraftTimer);

  const overlay  = document.getElementById('vb-card-modal-overlay');
  const editorEl = document.getElementById('vb-card-modal-editor');
  if (!overlay || !editorEl) return;

  // Final save
  const cardId = overlay.dataset.cardId;
  const ideaId = overlay.dataset.ideaId;
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (card) {
    card.draft = editorEl.innerHTML;
    saveAppState();
  }

  overlay.remove();

  // Refresh column so the card shows the updated draft preview
  if (card) _refreshColumn(card.columnId, ideaId);
}

// ─── Modal: Category picker (re-uses vbOpenCatPicker infrastructure) ──────────
function vbModalCatPicker(event, cardId) {
  // Temporarily make the board ideaId available via the overlay data attribute
  const overlay = document.getElementById('vb-card-modal-overlay');
  const ideaId  = overlay?.dataset.ideaId;
  if (!ideaId) return;

  event.stopPropagation();
  document.querySelectorAll('.vb-cat-picker').forEach(p => p.remove());

  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  const cats   = APP.state.vibeBoard.promptCategories;

  const picker = document.createElement('div');
  picker.className = 'vb-cat-picker';

  const lbl = document.createElement('span');
  lbl.className   = 'vb-picker-label';
  lbl.textContent = 'Set category';
  picker.appendChild(lbl);

  const none = document.createElement('div');
  none.className = 'vb-cat-picker-item' + (!card?.categoryId ? ' selected' : '');
  none.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:var(--border-3);flex-shrink:0"></div><span>None</span>`;
  none.onclick   = () => { _vbSetCardCategoryById(cardId, ideaId, null); picker.remove(); _vbRefreshModalHeader(cardId, ideaId); };
  picker.appendChild(none);

  cats.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'vb-cat-picker-item' + (card?.categoryId === cat.id ? ' selected' : '');
    item.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${cat.color};flex-shrink:0"></div><span>${escapeHtml(cat.name)}</span>`;
    item.onclick   = () => { _vbSetCardCategoryById(cardId, ideaId, cat.id); picker.remove(); _vbRefreshModalHeader(cardId, ideaId); };
    picker.appendChild(item);
  });

  document.body.appendChild(picker);
  _positionPopup(picker, event.currentTarget);
}

// ─── Modal: Move picker ────────────────────────────────────────────────────────
function vbModalMovePicker(event, cardId) {
  const overlay = document.getElementById('vb-card-modal-overlay');
  const ideaId  = overlay?.dataset.ideaId;
  if (!ideaId) return;

  event.stopPropagation();
  document.querySelectorAll('.vb-move-picker').forEach(p => p.remove());

  const card = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  const cols = APP.state.vibeBoard.columns;

  const picker = document.createElement('div');
  picker.className = 'vb-move-picker';

  const lbl = document.createElement('div');
  lbl.className   = 'vb-picker-label';
  lbl.textContent = 'Move to column';
  picker.appendChild(lbl);

  cols.forEach(col => {
    const isCurrent = card?.columnId === col.id;
    const item      = document.createElement('div');
    item.className  = 'vb-move-picker-item' + (isCurrent ? ' current' : '');
    item.innerHTML  = `<div style="width:6px;height:6px;border-radius:50%;background:${isCurrent ? 'var(--text-3)' : 'var(--border-3)'};flex-shrink:0"></div>${escapeHtml(col.name)}`;
    if (!isCurrent) item.onclick = () => { vbCloseCardModal(); setTimeout(() => vbMoveCard(cardId, col.id), 50); };
    picker.appendChild(item);
  });

  document.body.appendChild(picker);
  _positionPopup(picker, event.currentTarget);
}

// ─── Modal: Copy ───────────────────────────────────────────────────────────────
function vbModalCopy(_cardId) {
  const editorEl = document.getElementById('vb-card-modal-editor');
  const text     = editorEl ? editorEl.innerText.trim() : '';
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('vb-modal-copy-btn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Copied!`;
      btn.style.color = 'var(--success)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1500);
    }
    showToast('Copied to clipboard');
  }).catch(() => showToast('Copy failed', 'error'));
}

// ─── Modal: Delete ─────────────────────────────────────────────────────────────
function vbModalDelete(cardId) {
  vbCloseCardModal();
  setTimeout(() => vbDeleteCard(cardId), 50);
}

// ─── Private: set category (works from both board and modal context) ──────────
function _vbSetCardCategoryById(cardId, ideaId, catId) {
  const card = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;
  card.categoryId = catId;
  saveAppState();
  _refreshColumn(card.columnId, ideaId);
}

// ─── Private: Refresh modal header after category change ──────────────────────
function _vbRefreshModalHeader(cardId, ideaId) {
  const overlay = document.getElementById('vb-card-modal-overlay');
  if (!overlay) return;
  // Re-open is the simplest way; close and reopen preserving draft
  const editorEl = document.getElementById('vb-card-modal-editor');
  const card     = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (card && editorEl) card.draft = editorEl.innerHTML;
  overlay.remove();
  vbOpenCardModal(cardId);
}

// ─── Private: Placeholder for modal editor ────────────────────────────────────
function _updateVbEditorPlaceholder(el) {
  el.classList.toggle('is-empty', el.innerHTML === '' || el.innerHTML === '<br>');
}

// ─── Card Modal: Attachments ───────────────────────────────────────────────────
const VB_MAX_ATTACHMENTS = 4;

function _vbRenderAttachments(cardId) {
  const strip = document.getElementById('vb-modal-attachments');
  if (!strip) return;
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  const atts = card.attachments || [];
  strip.innerHTML = atts.map(att => {
    const isImg = att.type && att.type.startsWith('image/');
    const thumb = isImg
      ? `<img class="vb-att-thumb" src="${escapeAttr(att.dataUrl)}" alt="${escapeAttr(att.name)}">`
      : `<div class="vb-att-icon">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
             <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
           </svg>
         </div>`;
    return `
      <div class="vb-att-chip" title="${escapeAttr(att.name)}">
        <button class="vb-att-preview-btn" onclick="vbAttView('${escapeAttr(att.id)}','${escapeAttr(cardId)}')" type="button">
          ${thumb}
          <span class="vb-att-name">${escapeHtml(att.name)}</span>
        </button>
        <button class="vb-att-del-btn" onclick="vbAttDelete('${escapeAttr(att.id)}','${escapeAttr(cardId)}')" type="button" title="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  // Add-more chip (shown when under limit)
  if (atts.length < VB_MAX_ATTACHMENTS) {
    const add = document.createElement('button');
    add.className = 'vb-att-add-chip';
    add.title = `Add attachment (${atts.length}/${VB_MAX_ATTACHMENTS})`;
    add.type  = 'button';
    add.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>${atts.length}/${VB_MAX_ATTACHMENTS}</span>`;
    add.onclick = () => vbModalTriggerAttach(cardId);
    strip.appendChild(add);
  }
}

function vbModalTriggerAttach(cardId) {
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;
  if ((card.attachments || []).length >= VB_MAX_ATTACHMENTS) {
    showToast(`Max ${VB_MAX_ATTACHMENTS} attachments per card`, 'error'); return;
  }
  const input = document.getElementById('vb-attach-input');
  if (input) input.click();
}

function vbModalAttachFiles(event, cardId) {
  const files  = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;

  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;
  if (!Array.isArray(card.attachments)) card.attachments = [];

  const slots = VB_MAX_ATTACHMENTS - card.attachments.length;
  if (slots <= 0) { showToast(`Max ${VB_MAX_ATTACHMENTS} attachments reached`, 'error'); return; }

  const toAdd = files.slice(0, slots);
  let loaded  = 0;

  toAdd.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      card.attachments.push({
        id:      'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name:    file.name,
        type:    file.type,
        size:    file.size,
        dataUrl: e.target.result,
      });
      loaded++;
      if (loaded === toAdd.length) {
        saveAppState();
        _vbRenderAttachments(cardId);
        if (files.length > slots)
          showToast(`Added ${slots} of ${files.length} — max ${VB_MAX_ATTACHMENTS} reached`, 'error');
      }
    };
    reader.readAsDataURL(file);
  });
}

function vbAttDelete(attId, cardId) {
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;
  card.attachments = (card.attachments || []).filter(a => a.id !== attId);
  saveAppState();
  _vbRenderAttachments(cardId);
}

function vbAttView(attId, cardId) {
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  const att    = card?.attachments?.find(a => a.id === attId);
  if (!att) return;

  const isImg = att.type && att.type.startsWith('image/');
  if (isImg) {
    // Lightbox
    const lb = document.createElement('div');
    lb.className = 'vb-att-lightbox';
    lb.innerHTML = `
      <div class="vb-att-lightbox-inner">
        <button class="vb-att-lightbox-close" onclick="this.closest('.vb-att-lightbox').remove()">✕</button>
        <img src="${escapeAttr(att.dataUrl)}" alt="${escapeAttr(att.name)}">
        <div class="vb-att-lightbox-name">${escapeHtml(att.name)}</div>
      </div>`;
    lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
  } else {
    // Download
    const a = document.createElement('a');
    a.href     = att.dataUrl;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// ─── Card Modal: Export PDF ────────────────────────────────────────────────────

function vbModalExportPdf(cardId) {
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  const cats     = APP.state.vibeBoard?.promptCategories || [];
  const cat      = cats.find(c => c.id === card.categoryId);
  const catName  = cat ? escapeHtml(cat.name)  : '';
  const catColor = cat ? cat.color : '#888';

  // Rich content: prefer draft HTML, fall back to plain text
  const bodyHtml = card.draft
    ? card.draft
    : `<p>${escapeHtml(card.text || '')}</p>`;

  // Image attachments to inline below the text
  const imageAtts = (card.attachments || []).filter(a => a.type && a.type.startsWith('image/'));
  const imagesHtml = imageAtts.map(a => `
    <figure>
      <img src="${a.dataUrl}" alt="${escapeHtml(a.name)}">
      <figcaption>${escapeHtml(a.name)}</figcaption>
    </figure>`).join('');

  const title = (card.text || card.draft || 'VibeCard')
    .replace(/<[^>]*>/g, '').slice(0, 60).trim() || 'VibeCard';

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { showToast('Allow pop-ups to export PDF', 'error'); return; }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.65;
      color: #1a1a1a;
      background: #fff;
      padding: 48px 56px;
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 2px solid ${catColor};
    }
    .cat-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid ${catColor}55;
      color: ${catColor};
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .cat-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: ${catColor};
      flex-shrink: 0;
    }
    .app-label {
      margin-left: auto;
      font-size: 11px;
      color: #999;
    }
    .content { margin-bottom: 32px; }
    .content p  { margin: 0 0 0.75em; }
    .content h1, .content h2, .content h3 {
      font-weight: 700; margin: 1.2em 0 0.4em;
    }
    .content h1 { font-size: 1.5em; }
    .content h2 { font-size: 1.25em; }
    .content h3 { font-size: 1.1em; }
    .content ul, .content ol { padding-left: 1.4em; margin: 0.5em 0; }
    .content li { margin: 0.2em 0; }
    .content code {
      background: #f3f4f6;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.88em;
    }
    .content pre {
      background: #f3f4f6;
      border-radius: 6px;
      padding: 12px 16px;
      overflow-x: auto;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85em;
      margin: 0.75em 0;
    }
    .content blockquote {
      border-left: 3px solid ${catColor};
      padding-left: 14px;
      color: #555;
      margin: 0.75em 0;
    }
    .images { display: flex; flex-wrap: wrap; gap: 16px; }
    figure { margin: 0; max-width: 340px; }
    figure img { max-width: 100%; border-radius: 6px; border: 1px solid #e5e7eb; display: block; }
    figcaption { font-size: 11px; color: #888; margin-top: 4px; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  <header>
    ${catName ? `<span class="cat-pill"><span class="cat-dot"></span>${catName}</span>` : ''}
    <span class="app-label">VibeCard</span>
  </header>
  <div class="content">${bodyHtml}</div>
  ${imagesHtml ? `<div class="images">${imagesHtml}</div>` : ''}
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  <\/script>
</body>
</html>`);
  win.document.close();
}

// ─── Card Modal: Export ZIP ────────────────────────────────────────────────────

function vbModalExportZip(cardId) {
  const ideaId = _boardIdeaId();
  const card   = APP.state.ideas[ideaId]?.vibeCards?.find(c => c.id === cardId);
  if (!card) return;

  const enc = new TextEncoder();

  // Build plain-text version of card content
  const plainText = card.draft
    ? card.draft
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n').replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n').trim()
    : (card.text || '').trim();

  const files = [
    { name: 'card.txt', data: enc.encode(plainText) },
  ];

  (card.attachments || []).forEach(att => {
    files.push({ name: att.name, data: _dataUrlToBytes(att.dataUrl) });
  });

  const zipBytes = _buildZip(files);
  const slug     = (plainText.slice(0, 30).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()) || 'card';
  const filename = `vibecard-${slug}.zip`;

  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${files.length} file${files.length > 1 ? 's' : ''} as ${filename}`);
}

// ─── ZIP builder (no dependencies) ────────────────────────────────────────────

function _dataUrlToBytes(dataUrl) {
  const b64    = dataUrl.split(',')[1] || '';
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function _crc32(data) {
  // Build table on first call
  if (!_crc32._tbl) {
    _crc32._tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crc32._tbl[i] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = _crc32._tbl[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _buildZip(files) {
  const enc         = new TextEncoder();
  const localParts  = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : enc.encode(file.data);
    const crc  = _crc32(data);
    const size = data.length;

    // Local file header (30 bytes) + name + data
    const lh = new Uint8Array(30 + name.length + size);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0,  0x04034b50, true); // signature
    lv.setUint16(4,  20,         true); // version needed
    lv.setUint16(6,  0,          true); // flags
    lv.setUint16(8,  0,          true); // compression (stored)
    lv.setUint16(10, 0,          true); // mod time
    lv.setUint16(12, 0,          true); // mod date
    lv.setUint32(14, crc,        true); // CRC-32
    lv.setUint32(18, size,       true); // compressed size
    lv.setUint32(22, size,       true); // uncompressed size
    lv.setUint16(26, name.length,true); // filename length
    lv.setUint16(28, 0,          true); // extra length
    lh.set(name, 30);
    lh.set(data, 30 + name.length);
    localParts.push(lh);

    // Central directory header (46 bytes) + name
    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0,  0x02014b50, true);
    cv.setUint16(4,  20,         true); // version made by
    cv.setUint16(6,  20,         true); // version needed
    cv.setUint16(8,  0,          true);
    cv.setUint16(10, 0,          true);
    cv.setUint16(12, 0,          true);
    cv.setUint16(14, 0,          true);
    cv.setUint32(16, crc,        true);
    cv.setUint32(20, size,       true);
    cv.setUint32(24, size,       true);
    cv.setUint16(28, name.length,true);
    cv.setUint16(30, 0,          true); // extra length
    cv.setUint16(32, 0,          true); // comment length
    cv.setUint16(34, 0,          true); // disk number start
    cv.setUint16(36, 0,          true); // internal attrs
    cv.setUint32(38, 0,          true); // external attrs
    cv.setUint32(42, offset,     true); // local header offset
    ch.set(name, 46);
    centralParts.push(ch);

    offset += lh.length;
  }

  const cdSize  = centralParts.reduce((s, p) => s + p.length, 0);
  const eocdr   = new Uint8Array(22);
  const ev      = new DataView(eocdr.buffer);
  ev.setUint32(0,  0x06054b50,    true);
  ev.setUint16(4,  0,             true);
  ev.setUint16(6,  0,             true);
  ev.setUint16(8,  files.length,  true);
  ev.setUint16(10, files.length,  true);
  ev.setUint32(12, cdSize,        true);
  ev.setUint32(16, offset,        true);
  ev.setUint16(20, 0,             true);

  const total  = offset + cdSize + eocdr.length;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of localParts)   { result.set(p, pos); pos += p.length; }
  for (const p of centralParts) { result.set(p, pos); pos += p.length; }
  result.set(eocdr, pos);
  return result;
}

// ─── COMMIT CARD IMPORT ────────────────────────────────────────────────────────
//
// Flow:
//   1. User clicks "Import Commits" in the header
//   2. File picker opens — they select pending.json from
//      vibecode/local-vibecoding-appideas/data/incoming/pending.json
//   3. A review modal appears showing each pending commit card with:
//        • app name badge, commit hash, message, stat line, file list
//        • idea selector  (which idea should this card go into?)
//        • column selector (default: "Vibe Coding")
//        • category selector
//        • checkbox to skip individual cards
//   4. On confirm the selected cards are added to their chosen ideas,
//      the modal closes, and if the current view is the vibeboard for
//      one of the affected ideas it re-renders.
// ──────────────────────────────────────────────────────────────────────────────

let _importPending    = [];    // raw cards parsed from the JSON file
let _importFileHandle = null;  // FileSystemFileHandle — used to clear file after import

// Persist the last-used file handle so showOpenFilePicker reopens in the same dir.
function _saveImportHandle(handle) {
  try {
    const req = indexedDB.open('vibecoding_db', 1);
    req.onsuccess = (e) => {
      const tx = e.target.result.transaction('appstate', 'readwrite');
      tx.objectStore('appstate').put(handle, '_importFileHandle');
    };
  } catch (_) {}
}

function _loadImportHandle() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('vibecoding_db', 1);
      req.onsuccess = (e) => {
        const r = e.target.result.transaction('appstate', 'readonly')
                    .objectStore('appstate').get('_importFileHandle');
        r.onsuccess = () => resolve(r.result || null);
        r.onerror   = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch (_) { resolve(null); }
  });
}

async function openImportCommits() {
  // Prefer File System Access API (gives a writable handle so we can clear after import)
  if (typeof window.showOpenFilePicker === 'function') {
    const savedHandle = await _loadImportHandle();

    // If we have a saved handle, try to read the file directly — no picker needed.
    if (savedHandle) {
      try {
        // Re-request permission if needed (may show a one-time browser prompt).
        let perm = await savedHandle.queryPermission({ mode: 'read' });
        if (perm === 'prompt') perm = await savedHandle.requestPermission({ mode: 'read' });
        if (perm === 'granted') {
          _importFileHandle = savedHandle;
          const file = await savedHandle.getFile();
          const text = await file.text();
          _parseImportData(text);
          return;
        }
      } catch (_) {
        // Handle gone or permission denied — fall through to picker below.
      }
    }

    // First time (or handle lost): show the picker and save the chosen handle.
    window.showOpenFilePicker({
      types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
      multiple: false,
      ...(savedHandle ? { startIn: savedHandle } : {}),
    }).then(async ([handle]) => {
      _importFileHandle = handle;
      _saveImportHandle(handle);
      const file = await handle.getFile();
      const text = await file.text();
      _parseImportData(text);
    }).catch(err => {
      if (err.name !== 'AbortError') showToast('Could not open file: ' + err.message, 'error');
    });
  } else {
    // Fallback for browsers without File System Access API (no write-back possible)
    _importFileHandle = null;
    document.getElementById('import-commits-input').click();
  }
}

function onImportFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _parseImportData(e.target.result);
    event.target.value = '';
  };
  reader.readAsText(file);
}

function _parseImportData(text) {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Expected a JSON array of cards');
    _importPending = data.filter(c => c && c.source === 'git-commit' && c.message);
    if (_importPending.length === 0) {
      showToast('No pending commit cards found in that file', 'error');
      return;
    }
    _renderImportModal();
    openModal('import-commits-modal');
  } catch (err) {
    showToast('Could not read file: ' + err.message, 'error');
  }
}

async function _clearPendingFile() {
  if (!_importFileHandle) return;
  try {
    const writable = await _importFileHandle.createWritable();
    await writable.write('[]');
    await writable.close();
  } catch (err) {
    // Non-fatal — file may have moved or permission revoked
    console.warn('[VibeCoding] Could not clear pending.json:', err.message);
  } finally {
    _importFileHandle = null;
  }
}

// Fuzzy-match an app repo name (e.g. "local-trading-journal") to the best
// matching idea title.  Returns the idea ID with the highest word-overlap
// score, or '' if no ideas exist.
function _guessIdeaId(appName, ideaIds, ideas) {
  if (!ideaIds.length) return '';

  // Normalise: strip "local-" prefix, split on hyphens/underscores
  const words = appName.replace(/^local-/, '').split(/[-_\s]+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length > 2);

  let bestId    = '';
  let bestScore = 0;

  for (const id of ideaIds) {
    const title = (ideas[id].title || '').toLowerCase();
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score++;
    }
    if (score > bestScore) { bestScore = score; bestId = id; }
  }

  return bestId;  // '' if no word matched any idea title
}

// When the user picks an idea on row 1, propagate it to any subsequent
// rows whose selector is still blank (untouched by the user).
function _propagateFirstRowIdea(ideaId) {
  if (!ideaId) return;
  document.querySelectorAll('.import-idea-sel').forEach(sel => {
    if (sel.dataset.idx === '0') return;
    if (!sel.value) sel.value = ideaId;
  });
}

function _renderImportModal() {
  ensureVibeBoardState();
  const ideas   = APP.state.ideas;
  const ideaIds = Object.keys(ideas);
  const columns = APP.state.vibeBoard.columns;
  const cats      = APP.state.vibeBoard.promptCategories;

  // Default column: Shipped (commit cards represent shipped code)
  const defaultColId = columns.find(c => /shipped/i.test(c.name))?.id || columns[0]?.id || '';

  // Default category: Web UI
  const webUiCatId = cats.find(c => /web ui/i.test(c.name))?.id || '';

  const colOptions = columns
    .map(c => `<option value="${escapeAttr(c.id)}"${c.id === defaultColId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('');

  // First-row idea: any subsequent row that fails to auto-match falls back to this.
  const firstRowIdeaId = _importPending.length
    ? _guessIdeaId(_importPending[0].appName || '', ideaIds, ideas)
    : '';

  const cardsHtml = _importPending.map((card, idx) => {
    const files    = Array.isArray(card.files) ? card.files : [];
    const fileList = files.slice(0, 5).join(', ') + (files.length > 5 ? ` +${files.length - 5} more` : '');

    // Auto-match app name → idea title (best-effort fuzzy)
    let matchedId = _guessIdeaId(card.appName || '', ideaIds, ideas);
    let inheritedFromFirst = false;
    if (!matchedId && idx > 0 && firstRowIdeaId) {
      matchedId = firstRowIdeaId;
      inheritedFromFirst = true;
    }

    const ideaOptions = ideaIds.length
      ? '<option value="">— Select idea —</option>' +
        ideaIds.map(id =>
          `<option value="${escapeAttr(id)}"${id === matchedId ? ' selected' : ''}>${escapeHtml(ideas[id].title || 'Untitled')}</option>`
        ).join('')
      : '<option value="">— No ideas yet —</option>';

    const matchLabel = matchedId
      ? (inheritedFromFirst
          ? `<span class="import-match-hint">copied from row 1</span>`
          : `<span class="import-match-hint">auto-matched</span>`)
      : `<span class="import-match-hint import-match-hint--warn">no match — please select</span>`;

    // Default category: Web UI for commit cards
    const catOptions = '<option value="">— No category —</option>' +
      cats.map(c => `<option value="${escapeAttr(c.id)}"${c.id === webUiCatId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

    return `
<div class="import-card-row" data-idx="${idx}">
  <label class="import-card-check">
    <input type="checkbox" checked data-idx="${idx}" class="import-card-cb">
  </label>
  <div class="import-card-info">
    <div class="import-card-top">
      <span class="import-app-badge">${escapeHtml(card.appName || '?')}</span>
      <span class="import-hash">${escapeHtml(card.commitHash || '')}</span>
      <span class="import-ts">${card.timestamp ? new Date(card.timestamp).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : ''}</span>
    </div>
    <div class="import-card-msg">${escapeHtml(card.message || '')}</div>
    ${card.statLine ? `<div class="import-card-stat">${escapeHtml(card.statLine)}</div>` : ''}
    ${fileList ? `<div class="import-card-files">${escapeHtml(fileList)}</div>` : ''}
  </div>
  <div class="import-card-selectors">
    <label class="import-sel-label">Idea ${matchLabel}</label>
    <select class="import-sel import-idea-sel" data-idx="${idx}"${idx === 0 ? ' onchange="_propagateFirstRowIdea(this.value)"' : ''}>${ideaOptions}</select>
    <label class="import-sel-label">Column</label>
    <select class="import-sel import-col-sel" data-idx="${idx}">${colOptions}</select>
    <label class="import-sel-label">Category</label>
    <select class="import-sel import-cat-sel" data-idx="${idx}">${catOptions}</select>
  </div>
</div>`;
  }).join('');

  const list = document.getElementById('import-cards-list');
  if (list) list.innerHTML = cardsHtml;

  const count = document.getElementById('import-modal-count');
  if (count) count.textContent = `${_importPending.length} commit card${_importPending.length !== 1 ? 's' : ''} pending`;
}

function confirmImportCards() {
  ensureVibeBoardState();

  let added = 0;
  const affectedIdeas = new Set();

  _importPending.forEach((card, idx) => {
    const cb     = document.querySelector(`.import-card-cb[data-idx="${idx}"]`);
    if (!cb?.checked) return;   // user unchecked this card

    const ideaSel = document.querySelector(`.import-idea-sel[data-idx="${idx}"]`);
    const colSel  = document.querySelector(`.import-col-sel[data-idx="${idx}"]`);
    const catSel  = document.querySelector(`.import-cat-sel[data-idx="${idx}"]`);

    const ideaId  = ideaSel?.value;
    const colId   = colSel?.value;
    const catId   = catSel?.value || null;

    if (!ideaId || !APP.state.ideas[ideaId]) return;

    ensureIdeaVibeCards(ideaId);
    const cards = APP.state.ideas[ideaId].vibeCards;

    // Skip if already imported (match by fullHash stored in commitMeta)
    if (cards.some(c => c.commitMeta?.fullHash === card.fullHash)) return;

    const colCards = cards.filter(c => c.columnId === colId);

    // Build card text: message + stat line + file list
    const fileList = Array.isArray(card.files) ? card.files.slice(0, 8).join('\n') : '';
    const textParts = [
      card.message,
      card.body ? `\n${card.body}` : '',
      card.statLine ? `\n${card.statLine}` : '',
      fileList ? `\nFiles:\n${fileList}` : '',
    ].filter(Boolean);
    const text = textParts.join('').trim();

    const createdAt = card.timestamp ? new Date(card.timestamp).getTime() : Date.now();
    const idea      = APP.state.ideas[ideaId];
    const commitMeta = {
      appName:    card.appName,
      fullHash:   card.fullHash,
      commitHash: card.commitHash,
      branch:     card.branch,
      author:     card.author,
      timestamp:  card.timestamp,
      message:    card.message  || '',
      body:       card.body     || '',
      statLine:   card.statLine || '',
      files:      Array.isArray(card.files) ? card.files : [],
    };
    const vibeCard = {
      id:           generateId(),
      columnId:     colId,
      text,
      categoryId:   catId,
      createdAt,
      order:        colCards.length,
      shippedAt:    _isShippedCol(colId) ? createdAt : undefined,
      commitFiles:  commitMeta.files,
      commitMeta,
      // Rich draft renders as the GitHub-style commit display in the modal/board
      draft:        _buildCommitCardDraft(commitMeta, idea?.githubUrl),
    };
    // Classify against THIS idea's feature catalog (post-construction so the
    // classifier sees commitFiles/commitMeta on the card).
    vibeCard.featureTheme = _classifyCardForIdea(vibeCard, idea);

    cards.push(vibeCard);
    affectedIdeas.add(ideaId);
    added++;
  });

  if (added === 0) {
    showToast('Nothing to import — all cards were unchecked or already imported', 'error');
    return;
  }

  saveAppState();
  closeModal('import-commits-modal');
  _importPending = [];
  _clearPendingFile();  // write [] back to pending.json (no-op if handle unavailable)

  // Re-render the board if we're currently viewing one of the affected ideas
  const currentBoardIdea = _boardIdeaId();
  if (currentBoardIdea && affectedIdeas.has(currentBoardIdea)) {
    renderVibeBoard(currentBoardIdea);
  }
  renderSidebar();

  showToast(`${added} commit card${added !== 1 ? 's' : ''} imported`);
}
