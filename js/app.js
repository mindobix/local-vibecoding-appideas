'use strict';

// ─── Global App State ──────────────────────────────────────────────────────
const APP = {
  state: null,    // { categories: [], ideas: {} }
  ui: {
    selectedIdea:    null,   // idea ID string
    selectedVersion: null,   // version id or null (latest)
    openCategories:  new Set(),
    isDirty:         false,
    activeTab:       'all',  // 'all' | 'vibecoding'
  }
};

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  APP.state = await loadAppState();
  APP.ui.activeTab = localStorage.getItem('vibecoding_active_tab') || 'all';
  APP.state.categories.forEach(c => APP.ui.openCategories.add(c));

  document.getElementById('restore-input').addEventListener('change', restoreData);

  initResizeHandle();
  initFloatToolbar();
  renderSidebar();
  renderEditorEmpty();
  initChipRotation();
});

// ─── Chip Rotation ────────────────────────────────────────────────────────
function initChipRotation() {
  const el = document.getElementById('logo-chip-text');
  if (!el) return;

  function chipHtml(cat) {
    let prefix;
    if (cat === null) return 'App <span class="logo-sub-accent">Ideas</span>';
    if (cat.endsWith(' Apps')) prefix = cat.slice(0, -5) + ' App';
    else if (cat.endsWith('Apps')) prefix = cat.slice(0, -4) + 'App';
    else prefix = cat;
    return prefix + ' <span class="logo-sub-accent">Ideas</span>';
  }

  const labels = [null, ...APP.state.categories].map(chipHtml);
  let idx = 0;

  setInterval(() => {
    idx = (idx + 1) % labels.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.innerHTML = labels[idx];
      el.style.opacity = '1';
    }, 1400); // wait for fade-out to finish before swapping text
  }, 15000);
}

// ─── Toast ────────────────────────────────────────────────────────────────
let _toastTimer = null;

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── HTML Escaping ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// ─── ID & Date ─────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr < 24)   return `${diffHr}h ago`;
  if (diffDay < 7)   return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Modal Helpers ─────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function overlayClick(e, id) {
  if (e.target.id === id) closeModal(id);
}

// ─── Resizable Sidebar ──────────────────────────────────────────────────────
function initResizeHandle() {
  const STORAGE_KEY_WIDTH = 'vibecoding_sidebar_width';
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 520;

  function setSidebarWidth(px) {
    document.documentElement.style.setProperty('--sidebar-width', px + 'px');
  }

  const saved = parseInt(localStorage.getItem(STORAGE_KEY_WIDTH), 10);
  if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) setSidebarWidth(saved);

  const handle = document.getElementById('resize-handle');
  if (!handle) return;

  let startX, startWidth;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const sidebar = document.getElementById('sidebar');
    startX     = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;

    handle.classList.add('dragging');
    document.body.classList.add('resizing');

    function onMouseMove(e) {
      const delta    = e.clientX - startX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setSidebarWidth(newWidth);
    }

    function onMouseUp() {
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      const sidebar = document.getElementById('sidebar');
      localStorage.setItem(STORAGE_KEY_WIDTH, Math.round(sidebar.getBoundingClientRect().width));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}
