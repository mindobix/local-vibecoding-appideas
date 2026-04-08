'use strict';

// ─── sidebar.js: Category & Idea Tree, CRUD ───────────────────────────────────

// ─── Category Color & Icon Map ────────────────────────────────────────────────
const CATEGORY_META = {
  'AI Apps':        { color: '#a78bfa', icon: 'M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7zm0 2a5 5 0 0 0-5 5c0 1.9.97 3.59 2.5 4.56V16h5v-2.44A5.02 5.02 0 0 0 17 9a5 5 0 0 0-5-5zm1 12h-2v1h2v-1zm3-9a4 4 0 0 1-1.56 3.14l-.44.33V9h-2v2H9V9H7a5 5 0 0 1 0-2h2V5h2v2h2V5h.56A4 4 0 0 1 16 7z' },
  'Android Apps':   { color: '#34d399', icon: 'M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11 23.33 11 22.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zM15.53 2.16l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.87.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z' },
  'iOS Apps':       { color: '#60a5fa', icon: 'M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.37.74 3.17.8 1.2-.24 2.37-.96 3.65-.84 1.56.14 2.73.78 3.47 1.96-3.2 1.93-2.44 5.97.71 7.04-.47 1.08-1 2.12-2 2.92zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z' },
  'Web Apps':       { color: '#fb923c', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' },
  'Web Services':   { color: '#fbbf24', icon: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z' },
};

function getCategoryMeta(name) {
  return CATEGORY_META[name] || { color: '#888', icon: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' };
}

// ─── Render Sidebar ───────────────────────────────────────────────────────────
function renderSidebar() {
  const tree = document.getElementById('sidebar-tree');
  tree.innerHTML = '';

  APP.state.categories.forEach(cat => {
    tree.appendChild(buildCategoryEl(cat));
  });

  // Add Category button
  const btn = document.createElement('button');
  btn.className = 'sidebar-add-cat-btn';
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    Add Category
  `;
  btn.onclick = openAddCategoryModal;
  tree.appendChild(btn);
}

function buildCategoryEl(category) {
  const isOpen  = APP.ui.openCategories.has(category);
  const ideas   = getIdeasInCategory(category);
  const meta    = getCategoryMeta(category);

  const div = document.createElement('div');
  div.className = 'sidebar-cat';
  div.dataset.category = category;

  const hdr = document.createElement('div');
  hdr.className = `sidebar-cat-hdr${isOpen ? ' open' : ''}`;

  hdr.innerHTML = `
    <span class="sidebar-caret">${isOpen ? '▾' : '▸'}</span>
    <span class="sidebar-cat-icon" style="color:${meta.color}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="${meta.icon}"/></svg>
    </span>
    <span class="sidebar-cat-name">${escapeHtml(category)}</span>
    ${ideas.length > 0 ? `<span class="sidebar-cat-count">${ideas.length}</span>` : ''}
    <div class="sidebar-cat-actions">
      <button class="sidebar-icon-btn" title="Add app idea"
        onclick="openAddIdeaModal('${escapeAttr(category)}'); event.stopPropagation()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
      <button class="sidebar-icon-btn" title="Rename category"
        onclick="openRenameCategoryModal('${escapeAttr(category)}'); event.stopPropagation()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="sidebar-icon-btn danger" title="Delete category"
        onclick="openDeleteCategoryModal('${escapeAttr(category)}'); event.stopPropagation()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  `;

  hdr.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar-cat-actions')) return;
    toggleCategory(category);
  });

  const ideasDiv = document.createElement('div');
  ideasDiv.className = 'sidebar-ideas';
  ideasDiv.style.display = isOpen ? '' : 'none';

  if (ideas.length === 0) {
    ideasDiv.innerHTML = `<div class="sidebar-empty">No ideas yet — click + to add</div>`;
  } else {
    ideas.forEach(([id, idea]) => {
      ideasDiv.appendChild(buildIdeaEl(id, idea));
    });
  }

  // ── Drop target: category header (works even when section is collapsed)
  hdr.addEventListener('dragover', (e) => {
    if (!_dragIdeaId) return;
    const draggedIdea = APP.state.ideas[_dragIdeaId];
    if (!draggedIdea || draggedIdea.category === category) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    hdr.classList.add('drag-over');
  });
  hdr.addEventListener('dragleave', (e) => {
    if (!hdr.contains(e.relatedTarget)) hdr.classList.remove('drag-over');
  });
  hdr.addEventListener('drop', (e) => {
    e.preventDefault();
    hdr.classList.remove('drag-over');
    dropIdeaIntoCategory(category);
  });

  // ── Drop target: ideas list (when section is open)
  ideasDiv.addEventListener('dragover', (e) => {
    if (!_dragIdeaId) return;
    const draggedIdea = APP.state.ideas[_dragIdeaId];
    if (!draggedIdea || draggedIdea.category === category) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    ideasDiv.classList.add('drag-over');
  });
  ideasDiv.addEventListener('dragleave', (e) => {
    if (!ideasDiv.contains(e.relatedTarget)) ideasDiv.classList.remove('drag-over');
  });
  ideasDiv.addEventListener('drop', (e) => {
    e.preventDefault();
    ideasDiv.classList.remove('drag-over');
    dropIdeaIntoCategory(category);
  });

  div.appendChild(hdr);
  div.appendChild(ideasDiv);
  return div;
}

function buildIdeaEl(id, idea) {
  const isSelected = APP.ui.selectedIdea === id;
  const vCount     = Array.isArray(idea.versions) ? idea.versions.length : 0;

  const statusDots = {
    'idea':        '#888',
    'in-progress': '#3b82f6',
    'shipped':     '#22c55e',
    'archived':    '#ef4444',
  };
  const dotColor = statusDots[idea.status || 'idea'] || '#888';

  const div = document.createElement('div');
  div.className = `sidebar-idea${isSelected ? ' selected' : ''}`;
  div.dataset.id = id;
  div.setAttribute('draggable', 'true');

  div.innerHTML = `
    <span class="sidebar-drag-handle" title="Drag to move to another category">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
      </svg>
    </span>
    <span class="sidebar-idea-dot" style="background:${dotColor}; box-shadow: 0 0 4px ${dotColor}44"></span>
    <span class="sidebar-idea-name">${escapeHtml(idea.title)}</span>
    ${vCount > 0 ? `<span class="sidebar-version-badge">v${vCount}</span>` : ''}
    <div class="sidebar-idea-actions">
      <button class="sidebar-icon-btn" title="Rename"
        onclick="openRenameIdeaModal('${escapeAttr(id)}'); event.stopPropagation()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="sidebar-icon-btn danger" title="Delete"
        onclick="openDeleteIdeaModal('${escapeAttr(id)}'); event.stopPropagation()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  `;

  // ── Drag events
  div.addEventListener('dragstart', (e) => {
    _dragIdeaId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    // Slight delay so the ghost image renders before the class dims the element
    requestAnimationFrame(() => div.classList.add('dragging'));
  });

  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    _dragIdeaId = null;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  div.addEventListener('click', () => selectIdea(id));
  return div;
}

// ─── Drag & Drop State ────────────────────────────────────────────────────────
let _dragIdeaId = null;

function dropIdeaIntoCategory(targetCategory) {
  if (!_dragIdeaId) return;
  const idea = APP.state.ideas[_dragIdeaId];
  if (!idea || idea.category === targetCategory) return;

  idea.category = targetCategory;
  APP.ui.openCategories.add(targetCategory);
  saveAppState();
  renderSidebar();
  showToast(`Moved to "${targetCategory}"`);
  _dragIdeaId = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getIdeasInCategory(category) {
  return Object.entries(APP.state.ideas)
    .filter(([, idea]) => idea.category === category)
    .sort(([, a], [, b]) => a.title.localeCompare(b.title));
}

function toggleCategory(cat) {
  if (APP.ui.openCategories.has(cat)) {
    APP.ui.openCategories.delete(cat);
  } else {
    APP.ui.openCategories.add(cat);
  }
  renderSidebar();
}

function selectIdea(id) {
  if (APP.ui.isDirty) {
    // Auto-save draft before switching
    flushDraft();
  }
  APP.ui.selectedIdea    = id;
  APP.ui.selectedVersion = null;
  APP.ui.isDirty         = false;
  renderSidebar();
  renderEditor();
}

function flushDraft() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;
  const contentEl = document.getElementById('editor-content');
  if (contentEl) idea.draft = contentEl.innerHTML;
  saveAppState();
  APP.ui.isDirty = false;
}

// ─── Add Category ─────────────────────────────────────────────────────────────
function openAddCategoryModal() {
  document.getElementById('add-cat-name').value = '';
  openModal('add-category-modal');
  setTimeout(() => document.getElementById('add-cat-name').focus(), 60);
}

function confirmAddCategory() {
  const name = document.getElementById('add-cat-name').value.trim();
  if (!name) { showToast('Enter a category name', 'error'); return; }

  if (APP.state.categories.includes(name)) {
    showToast('A category with that name already exists', 'error');
    return;
  }

  APP.state.categories.push(name);
  APP.state.categories.sort((a, b) => a.localeCompare(b));
  APP.ui.openCategories.add(name);
  saveAppState();
  closeModal('add-category-modal');
  renderSidebar();
  showToast(`Category "${name}" created`);
}

// ─── Rename Category ──────────────────────────────────────────────────────────
let _renameCatOld = null;

function openRenameCategoryModal(cat) {
  _renameCatOld = cat;
  document.getElementById('rename-cat-name').value = cat;
  openModal('rename-category-modal');
  setTimeout(() => {
    const el = document.getElementById('rename-cat-name');
    el.focus(); el.select();
  }, 60);
}

function confirmRenameCategory() {
  const newName = document.getElementById('rename-cat-name').value.trim();
  if (!newName) return;
  if (newName === _renameCatOld) { closeModal('rename-category-modal'); return; }

  if (APP.state.categories.includes(newName)) {
    showToast('A category with that name already exists', 'error');
    return;
  }

  const idx = APP.state.categories.indexOf(_renameCatOld);
  if (idx === -1) return;
  APP.state.categories[idx] = newName;
  APP.state.categories.sort((a, b) => a.localeCompare(b));

  // Update all ideas in this category
  Object.values(APP.state.ideas).forEach(idea => {
    if (idea.category === _renameCatOld) idea.category = newName;
  });

  if (APP.ui.openCategories.has(_renameCatOld)) {
    APP.ui.openCategories.delete(_renameCatOld);
    APP.ui.openCategories.add(newName);
  }

  saveAppState();
  closeModal('rename-category-modal');
  renderSidebar();
  showToast(`Renamed to "${newName}"`);
}

// ─── Delete Category ──────────────────────────────────────────────────────────
let _deleteCat = null;

function openDeleteCategoryModal(cat) {
  _deleteCat = cat;
  document.getElementById('del-cat-name').textContent = cat;
  const count = getIdeasInCategory(cat).length;
  document.getElementById('del-cat-count').textContent =
    count > 0 ? ` and its ${count} app idea${count !== 1 ? 's' : ''}` : '';
  openModal('delete-category-modal');
}

function confirmDeleteCategory() {
  // Remove all ideas in this category
  Object.keys(APP.state.ideas).forEach(id => {
    if (APP.state.ideas[id].category === _deleteCat) delete APP.state.ideas[id];
  });

  APP.state.categories = APP.state.categories.filter(c => c !== _deleteCat);
  APP.ui.openCategories.delete(_deleteCat);

  // If selected idea was in deleted category
  if (APP.ui.selectedIdea && !APP.state.ideas[APP.ui.selectedIdea]) {
    APP.ui.selectedIdea    = null;
    APP.ui.selectedVersion = null;
  }

  saveAppState();
  closeModal('delete-category-modal');
  renderSidebar();
  if (!APP.ui.selectedIdea) renderEditorEmpty();
  showToast('Category deleted');
}

// ─── Add Idea ─────────────────────────────────────────────────────────────────
let _addIdeaCat = null;

function openAddIdeaModal(cat) {
  _addIdeaCat = cat;
  document.getElementById('add-idea-cat').textContent = cat;
  document.getElementById('add-idea-title').value = '';
  openModal('add-idea-modal');
  setTimeout(() => document.getElementById('add-idea-title').focus(), 60);
}

function confirmAddIdea() {
  const title = document.getElementById('add-idea-title').value.trim();
  if (!title) { showToast('Enter an idea title', 'error'); return; }

  const id = generateId();
  APP.state.ideas[id] = {
    title,
    category:  _addIdeaCat,
    githubUrl: '',
    status:    'idea',
    versions:  [],
    draft:     '',
    createdAt: Date.now(),
  };

  saveAppState();
  closeModal('add-idea-modal');
  APP.ui.openCategories.add(_addIdeaCat);
  selectIdea(id);
  showToast(`"${title}" created`);
}

// ─── Rename Idea ──────────────────────────────────────────────────────────────
let _renameIdeaId = null;

function openRenameIdeaModal(id) {
  _renameIdeaId = id;
  const idea = APP.state.ideas[id];
  document.getElementById('rename-idea-title').value = idea ? idea.title : '';
  openModal('rename-idea-modal');
  setTimeout(() => {
    const el = document.getElementById('rename-idea-title');
    el.focus(); el.select();
  }, 60);
}

function confirmRenameIdea() {
  const title = document.getElementById('rename-idea-title').value.trim();
  if (!title) return;
  const idea = APP.state.ideas[_renameIdeaId];
  if (!idea) return;

  idea.title = title;
  saveAppState();
  closeModal('rename-idea-modal');
  renderSidebar();

  // Update title in editor if currently selected
  if (APP.ui.selectedIdea === _renameIdeaId) {
    const titleEl = document.getElementById('editor-title');
    if (titleEl) {
      titleEl.textContent = title;
      updateEditorTitlePlaceholder(titleEl);
    }
  }
  showToast('Renamed');
}

// ─── Delete Idea ──────────────────────────────────────────────────────────────
let _deleteIdeaId = null;

function openDeleteIdeaModal(id) {
  _deleteIdeaId = id;
  const idea = APP.state.ideas[id];
  document.getElementById('del-idea-name').textContent = idea ? idea.title : id;
  const vCount = idea && Array.isArray(idea.versions) ? idea.versions.length : 0;
  document.getElementById('del-idea-versions').textContent =
    vCount > 0 ? ` and ${vCount} saved version${vCount !== 1 ? 's' : ''}` : '';
  openModal('delete-idea-modal');
}

function confirmDeleteIdea() {
  delete APP.state.ideas[_deleteIdeaId];

  if (APP.ui.selectedIdea === _deleteIdeaId) {
    APP.ui.selectedIdea    = null;
    APP.ui.selectedVersion = null;
    APP.ui.isDirty         = false;
  }

  saveAppState();
  closeModal('delete-idea-modal');
  renderSidebar();
  if (!APP.ui.selectedIdea) renderEditorEmpty();
  showToast('Idea deleted');
}
