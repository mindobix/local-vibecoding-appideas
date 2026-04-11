'use strict';

// ─── storage.js: IndexedDB CRUD, Backup & Restore ───────────────────────────

const STORAGE_KEY = 'vibecoding_appideas_v1'; // kept for localStorage migration

const _IDB_NAME    = 'vibecoding_db';
const _IDB_VERSION = 1;
const _IDB_STORE   = 'appstate';
const _IDB_KEY     = 'main';

let _db = null;

function _openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_IDB_STORE)) {
        db.createObjectStore(_IDB_STORE);
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

function _idbGet(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(_IDB_STORE, 'readonly').objectStore(_IDB_STORE).get(_IDB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function _idbPut(db, value) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(_IDB_STORE, 'readwrite').objectStore(_IDB_STORE).put(value, _IDB_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

const DEFAULT_CATEGORIES = [
  'AI Init Commit',
  'AI Apps',
  'Android Apps',
  'iOS Apps',
  'Web Apps',
  'Web Services'
];

function getDefaultState() {
  return {
    categories: [...DEFAULT_CATEGORIES],
    ideas:      {},
    vibeBoard:  null,   // initialized lazily by ensureVibeBoardState()
  };
}

function _normalizeState(parsed) {
  if (!Array.isArray(parsed.categories)) parsed.categories = getDefaultState().categories;
  if (typeof parsed.ideas !== 'object' || Array.isArray(parsed.ideas)) parsed.ideas = {};

  Object.entries(parsed.ideas).forEach(([id, idea]) => {
    if (typeof idea !== 'object' || idea === null) { delete parsed.ideas[id]; return; }
    if (!idea.title) idea.title = 'Untitled Idea';
    if (!idea.category) idea.category = parsed.categories[0] || 'Web Apps';
    if (!idea.status) idea.status = 'idea';
    if (!Array.isArray(idea.versions)) idea.versions = [];
    if (typeof idea.draft !== 'string') idea.draft = '';
    if (!idea.githubUrl) idea.githubUrl = '';
    if (!Array.isArray(idea.vibeCards)) idea.vibeCards = [];
    idea.vibeCards.forEach(card => {
      if (!('draft' in card)) card.draft = '';
      if (!Array.isArray(card.attachments)) card.attachments = [];
    });
  });

  if (!('vibeBoard' in parsed)) parsed.vibeBoard = null;

  return parsed;
}

async function loadAppState() {
  try {
    const db    = await _openDB();
    const state = await _idbGet(db);

    if (state) return _normalizeState(state);

    // ── Migrate from localStorage if present ─────────────────────────────────
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = _normalizeState(JSON.parse(raw));
      await _idbPut(db, migrated);
      localStorage.removeItem(STORAGE_KEY);
      return migrated;
    }
  } catch (e) {
    console.error('VibeCoding: failed to load state', e);
  }
  return getDefaultState();
}

// Fire-and-forget — callers stay synchronous, no cascading async changes needed.
function saveAppState() {
  _openDB()
    .then(db => _idbPut(db, APP.state))
    .catch(e  => console.error('saveAppState failed:', e));
}

// ─── Backup ──────────────────────────────────────────────────────────────────
function backupData() {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10);

  const payload = JSON.stringify({
    _version:    1,
    _exportedAt: now.toISOString(),
    _app:        'vibecoding-appideas',
    ...APP.state,
  }, null, 2);

  const blob = new Blob([payload], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  a.href     = url;
  a.download = `vibecoding-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Backup downloaded');
}

// ─── Restore ──────────────────────────────────────────────────────────────────
function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!Array.isArray(data.categories) || typeof data.ideas !== 'object' || Array.isArray(data.ideas)) {
        throw new Error('Invalid backup format — missing categories or ideas');
      }

      // Normalize ideas
      Object.entries(data.ideas).forEach(([id, idea]) => {
        if (typeof idea !== 'object' || idea === null) { delete data.ideas[id]; return; }
        if (!idea.title)    idea.title    = 'Untitled Idea';
        if (!idea.status)   idea.status   = 'idea';
        if (!Array.isArray(idea.versions)) idea.versions = [];
        if (typeof idea.draft !== 'string') idea.draft = '';
        if (!idea.githubUrl) idea.githubUrl = '';
        if (!Array.isArray(idea.vibeCards)) idea.vibeCards = [];
        idea.vibeCards.forEach(card => {
          if (!('draft' in card)) card.draft = '';
          if (!Array.isArray(card.attachments)) card.attachments = [];
        });
      });

      APP.state = {
        categories: data.categories,
        ideas:      data.ideas,
        vibeBoard:  data.vibeBoard || null,
      };
      saveAppState();

      APP.ui.selectedIdea    = null;
      APP.ui.selectedVersion = null;
      APP.ui.openCategories  = new Set(APP.state.categories);
      APP.ui.isDirty         = false;

      renderSidebar();
      renderEditorEmpty();

      const fromVersion = data._version ? ` (backup v${data._version})` : '';
      showToast(`Data restored successfully${fromVersion}`);
    } catch (err) {
      console.error('Restore failed:', err);
      showToast('Invalid backup file — could not restore', 'error');
    }
    event.target.value = '';
  };

  reader.readAsText(file);
}
