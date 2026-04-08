'use strict';

// ─── editor.js: Notion-Style Page Editor, Formatting, Versions ───────────────

// ─── Empty State ──────────────────────────────────────────────────────────────
function renderEditorEmpty() {
  const panel = document.getElementById('editor-panel');
  panel.innerHTML = `
    <div class="editor-empty">
      <div class="editor-empty-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
        </svg>
      </div>
      <h2 class="editor-empty-title">Your Ideas Workspace</h2>
      <p class="editor-empty-desc">Select an app idea from the sidebar to start writing, or click <strong>+</strong> next to a category to create one.</p>
    </div>
  `;
}

// ─── Status Helpers ───────────────────────────────────────────────────────────
function getStatusLabel(status) {
  const labels = {
    'idea':        'Idea',
    'in-progress': 'In Progress',
    'shipped':     'Shipped',
    'archived':    'Archived',
  };
  return labels[status] || 'Idea';
}

const STATUS_CYCLE = ['idea', 'in-progress', 'shipped', 'archived'];

// ─── Render Editor ────────────────────────────────────────────────────────────
function renderEditor() {
  const id = APP.ui.selectedIdea;
  if (!id) { renderEditorEmpty(); return; }

  const idea = APP.state.ideas[id];
  if (!idea) { renderEditorEmpty(); return; }

  const isVersionView   = APP.ui.selectedVersion !== null;
  const currentContent  = isVersionView
    ? getVersionContent(idea, APP.ui.selectedVersion)
    : (idea.draft || '');

  const githubSection = buildGithubSection(idea);
  const statusCls     = `status-${idea.status || 'idea'}`;
  const statusLabel   = getStatusLabel(idea.status);

  const panel = document.getElementById('editor-panel');
  panel.innerHTML = `
    <!-- Scrollable Page -->
    <div class="editor-scroll">
      <div class="editor-page">

        <!-- Meta row: status + github -->
        <div class="idea-meta-row">
          <span class="status-badge ${statusCls}"
                id="status-badge"
                onclick="cycleStatus()"
                title="Click to change status">${statusLabel}</span>
          <div class="github-field" id="github-field">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            ${githubSection}
            <button class="github-edit-btn" onclick="editGithubUrl()" title="Edit GitHub URL">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
          </div>
        </div>

        <!-- Title -->
        <div class="editor-title-wrap">
          <div class="editor-title"
               id="editor-title"
               contenteditable="${isVersionView ? 'false' : 'true'}"
               data-placeholder="Untitled Idea"
               spellcheck="true"
               onblur="onTitleBlur()"
               onkeydown="if(event.key==='Enter'){event.preventDefault();focusContent()}"
          >${escapeHtml(idea.title || '')}</div>
        </div>

        <div class="editor-divider"></div>

        <!-- Content Area -->
        <div class="editor-content${isVersionView ? ' readonly' : ''}"
             id="editor-content"
             contenteditable="${isVersionView ? 'false' : 'true'}"
             spellcheck="true"
             oninput="onEditorInput()"
             onkeydown="editorKeydown(event)"
        ></div>

        ${isVersionView ? `
          <div class="version-view-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
            Viewing a past version &mdash;
            <button class="btn-inline-link" onclick="restoreVersion()">Restore this version</button>
            &nbsp;&middot;&nbsp;
            <button class="btn-inline-link" onclick="viewLatest()">Return to latest</button>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Versions Bar -->
    <div class="editor-versions-bar">
      <div class="versions-label">Versions</div>
      <div class="versions-list" id="versions-list"></div>
      <div class="save-indicator" id="save-indicator"></div>
      ${!isVersionView ? `
      <div class="versions-actions">
        <button class="btn btn-primary" onclick="openSaveVersionModal()" title="Save Version (⌘S)" style="padding:5px 12px;font-size:12px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          Save Version
        </button>
      </div>` : ''}
    </div>
  `;

  // Set content via innerHTML (avoids encoding issues)
  const contentEl = document.getElementById('editor-content');
  if (contentEl) {
    contentEl.innerHTML = currentContent;
    updatePlaceholder(contentEl);
    // Intercept paste to strip background colors & external styling
    if (!isVersionView) {
      contentEl.addEventListener('paste', handleEditorPaste);
    }
  }

  // Set title placeholder state
  const titleEl = document.getElementById('editor-title');
  if (titleEl) updateEditorTitlePlaceholder(titleEl);

  // Render versions list
  renderVersionsList(idea);

  // Focus title if brand new
  if (!idea.title && !isVersionView) {
    setTimeout(() => {
      const t = document.getElementById('editor-title');
      if (t) { t.focus(); placeCursorAtEnd(t); }
    }, 50);
  }
}

function buildGithubSection(idea) {
  if (idea.githubUrl) {
    return `<a href="${escapeAttr(idea.githubUrl)}" target="_blank" rel="noopener" class="github-link"
               title="${escapeAttr(idea.githubUrl)}">${escapeHtml(idea.githubUrl)}</a>`;
  }
  return `<span class="github-placeholder" onclick="editGithubUrl()">+ Add GitHub repository</span>`;
}

// ─── Version Content ──────────────────────────────────────────────────────────
function getVersionContent(idea, versionId) {
  const v = (idea.versions || []).find(v => v.id === versionId);
  return v ? v.content : '';
}

// ─── Render Versions List ─────────────────────────────────────────────────────
function renderVersionsList(idea) {
  const list = document.getElementById('versions-list');
  if (!list) return;

  const versions = (idea.versions || []).slice().reverse(); // newest first

  if (versions.length === 0) {
    list.innerHTML = `<span class="versions-empty">No versions saved yet</span>`;
    return;
  }

  list.innerHTML = '';
  versions.forEach((v, revI) => {
    const vNum     = idea.versions.length - revI;
    const isActive = APP.ui.selectedVersion === v.id;

    const btn = document.createElement('button');
    btn.className = `version-tab${isActive ? ' active' : ''}`;
    btn.title = `${formatDate(v.timestamp)}${v.label ? '\n' + v.label : ''}`;

    btn.innerHTML = `
      <span class="version-tab-label">v${vNum}${v.label ? ` · ${escapeHtml(v.label)}` : ''}</span>
      <span class="version-tab-date">${formatDateShort(v.timestamp)}</span>
    `;
    btn.onclick = () => selectVersion(v.id);

    const delBtn = document.createElement('button');
    delBtn.className = 'version-tab-del';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete this version';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      openDeleteVersionModal(v.id, `v${vNum}`);
    };
    btn.appendChild(delBtn);
    list.appendChild(btn);
  });
}

// ─── Version Selection ────────────────────────────────────────────────────────
function selectVersion(vId) {
  if (APP.ui.isDirty) flushDraft();
  APP.ui.selectedVersion = vId;
  renderEditor();
}

function viewLatest() {
  APP.ui.selectedVersion = null;
  renderEditor();
}

function restoreVersion() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;
  idea.draft = getVersionContent(idea, APP.ui.selectedVersion);
  APP.ui.selectedVersion = null;
  saveAppState();
  renderEditor();
  showToast('Version restored to draft');
}

// ─── Editor Events ────────────────────────────────────────────────────────────
let _draftTimer  = null;
let _lastSavedTs = null;

function onEditorInput() {
  APP.ui.isDirty = true;
  const indicator = document.getElementById('save-indicator');
  if (indicator) { indicator.textContent = 'Editing…'; indicator.className = 'save-indicator'; }

  // Handle active slash menu filtering
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    const idea = APP.state.ideas[APP.ui.selectedIdea];
    if (!idea) return;
    const contentEl = document.getElementById('editor-content');
    if (contentEl) {
      idea.draft = contentEl.innerHTML;
      updatePlaceholder(contentEl);
    }
    saveAppState();
    APP.ui.isDirty = false;
    _lastSavedTs = Date.now();

    if (indicator) { indicator.textContent = 'Draft saved'; indicator.className = 'save-indicator saved'; }
    setTimeout(() => {
      if (indicator) indicator.textContent = '';
    }, 2000);
  }, 600);
}

function onTitleBlur() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;
  const titleEl = document.getElementById('editor-title');
  if (!titleEl) return;

  const newTitle = titleEl.innerText.trim().replace(/\n/g, '');
  updateEditorTitlePlaceholder(titleEl);

  if (newTitle && newTitle !== idea.title) {
    idea.title = newTitle;
    saveAppState();
    renderSidebar();
  } else if (!newTitle) {
    // Restore previous title
    titleEl.textContent = idea.title || '';
    updateEditorTitlePlaceholder(titleEl);
  }
}

function focusContent() {
  const contentEl = document.getElementById('editor-content');
  if (!contentEl) return;
  contentEl.focus();
  placeCursorAtEnd(contentEl);
}

function editorKeydown(e) {
  // Block menu keyboard navigation
  if (_slashActive) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); slashMoveHighlight(1);  return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); slashMoveHighlight(-1); return; }
    if (e.key === 'Enter')      { e.preventDefault(); applyHighlightedSlashItem(); return; }
    if (e.key === 'Escape')     { hideSlashMenu(); return; }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); openSaveVersionModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); fmt('bold'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); fmt('italic'); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); fmt('underline'); }
}

function updatePlaceholder(el) {
  const isEmpty = !el.textContent.trim() && !el.querySelector('img,table,ul,ol,h1,h2,h3,blockquote,pre');
  el.classList.toggle('is-empty', isEmpty);
}

function updateEditorTitlePlaceholder(el) {
  const isEmpty = !el.textContent.trim();
  el.classList.toggle('is-empty', isEmpty);
}

function placeCursorAtEnd(el) {
  const range = document.createRange();
  const sel   = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ─── Paste Handler: Strip External Styles ────────────────────────────────────
function handleEditorPaste(e) {
  e.preventDefault();

  const clipData = e.clipboardData || window.clipboardData;
  const html     = clipData.getData('text/html');
  const text     = clipData.getData('text/plain');

  if (html && html.trim()) {
    const cleaned = cleanPastedHtml(html);
    document.execCommand('insertHTML', false, cleaned);
  } else if (text) {
    // Convert plain text — preserve line breaks as <br> or paragraphs
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r\n|\r/g, '\n')
      .split('\n')
      .map(line => line || '<br>')
      .join('<br>');
    document.execCommand('insertHTML', false, escaped);
  }
}

// Strip background colors, external fonts, and unwanted inline styles from pasted HTML.
// Keeps semantic formatting: bold, italic, underline, links, lists, headings, code.
function cleanPastedHtml(html) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');
  const body   = doc.body;

  // Properties to always remove (external app colors, fonts, spacing)
  const STRIP_PROPS = [
    'background', 'background-color', 'background-image',
    'color', 'font-family', 'font-size', 'font-variant',
    'line-height', 'letter-spacing', 'word-spacing',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'border', 'border-radius', 'box-shadow',
    'white-space', 'tab-size', '-moz-tab-size',
  ];

  body.querySelectorAll('*').forEach(el => {
    // Strip data-* and class attributes (carry external themes)
    el.removeAttribute('class');
    [...el.attributes].filter(a => a.name.startsWith('data-')).forEach(a => el.removeAttribute(a.name));

    // Strip unwanted inline style properties
    if (el.style && el.style.cssText) {
      STRIP_PROPS.forEach(prop => {
        el.style.removeProperty(prop);
      });
      // If style attr is now empty, remove it entirely
      if (!el.style.cssText.trim()) el.removeAttribute('style');
    }

    // Unwrap purely decorative wrapper spans/divs that have no semantic value
    const tag = el.tagName.toLowerCase();
    if ((tag === 'span' || tag === 'div') && !el.hasAttribute('style') && !el.className) {
      if (tag === 'div') {
        // Replace block div with line break to preserve line structure
        const br = doc.createElement('br');
        el.parentNode.insertBefore(br, el.nextSibling);
      }
    }
  });

  // Remove MS Office / Google Docs / VSCode meta tags
  body.querySelectorAll('meta, link, style, script, head').forEach(el => el.remove());

  return body.innerHTML;
}

// ─── Formatting Commands ──────────────────────────────────────────────────────
function fmt(cmd) {
  document.execCommand(cmd, false, null);
  const contentEl = document.getElementById('editor-content');
  if (contentEl) contentEl.focus();
}

function fmtBlock(tag) {
  document.execCommand('formatBlock', false, tag);
  const contentEl = document.getElementById('editor-content');
  if (contentEl) contentEl.focus();
}

function fmtCode() {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) {
    document.execCommand('insertHTML', false,
      `<code style="font-family:var(--font-mono);background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:1px 6px;color:#c4b5fd">${sel.toString()}</code>`
    );
  } else {
    document.execCommand('formatBlock', false, 'pre');
  }
  const contentEl = document.getElementById('editor-content');
  if (contentEl) contentEl.focus();
}

function insertHR() {
  document.execCommand('insertHTML', false, '<hr>');
  const contentEl = document.getElementById('editor-content');
  if (contentEl) contentEl.focus();
}

function fmtLink() {
  const sel = window.getSelection();
  const selectedText = sel && !sel.isCollapsed ? sel.toString() : '';
  const url = prompt('Enter URL:', 'https://');
  if (!url || url === 'https://') return;

  if (selectedText) {
    document.execCommand('createLink', false, url);
    // Ensure external links open in new tab
    const contentEl = document.getElementById('editor-content');
    if (contentEl) {
      contentEl.querySelectorAll('a').forEach(a => {
        if (a.href === url) { a.target = '_blank'; a.rel = 'noopener'; }
      });
    }
  } else {
    document.execCommand('insertHTML', false,
      `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
    );
  }
  const contentEl = document.getElementById('editor-content');
  if (contentEl) contentEl.focus();
}

// ─── GitHub URL Editing ───────────────────────────────────────────────────────
function editGithubUrl() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;

  const field      = document.getElementById('github-field');
  const currentUrl = idea.githubUrl || '';

  // Replace content with an inline input
  const existingInput = field.querySelector('.github-url-input');
  if (existingInput) { existingInput.focus(); existingInput.select(); return; }

  // Clear and rebuild with input
  field.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
    <input type="url" id="github-url-input" class="github-url-input"
           value="${escapeAttr(currentUrl)}"
           placeholder="https://github.com/user/repo"
           onblur="saveGithubUrl()"
           onkeydown="if(event.key==='Enter'){saveGithubUrl()}; if(event.key==='Escape'){cancelGithubEdit()}">
  `;

  setTimeout(() => {
    const input = document.getElementById('github-url-input');
    if (input) { input.focus(); input.select(); }
  }, 20);
}

function saveGithubUrl() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;
  const input = document.getElementById('github-url-input');
  if (!input) return;

  idea.githubUrl = input.value.trim();
  saveAppState();

  // Re-render just the github field
  const field = document.getElementById('github-field');
  if (field) {
    const githubSection = buildGithubSection(idea);
    field.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
      ${githubSection}
      <button class="github-edit-btn" onclick="editGithubUrl()" title="Edit GitHub URL">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
    `;
  }

  if (idea.githubUrl) showToast('GitHub URL saved');
}

function cancelGithubEdit() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;
  const field = document.getElementById('github-field');
  if (!field) return;

  const githubSection = buildGithubSection(idea);
  field.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
    ${githubSection}
    <button class="github-edit-btn" onclick="editGithubUrl()" title="Edit GitHub URL">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
    </button>
  `;
}

// ─── Status Cycling ───────────────────────────────────────────────────────────
function cycleStatus() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;

  const idx = STATUS_CYCLE.indexOf(idea.status || 'idea');
  idea.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  saveAppState();

  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.className = `status-badge status-${idea.status}`;
    badge.textContent = getStatusLabel(idea.status);
  }

  renderSidebar(); // Update dot color
  showToast(`Status → ${getStatusLabel(idea.status)}`);
}

// ─── Save Version Modal ───────────────────────────────────────────────────────
function openSaveVersionModal() {
  if (!APP.ui.selectedIdea) return;
  document.getElementById('version-label').value = '';
  openModal('save-version-modal');
  setTimeout(() => document.getElementById('version-label').focus(), 60);
}

function confirmSaveVersion() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea) return;

  const label     = document.getElementById('version-label').value.trim();
  const contentEl = document.getElementById('editor-content');
  const content   = contentEl ? contentEl.innerHTML : (idea.draft || '');

  const v = {
    id:        generateId(),
    timestamp: Date.now(),
    content,
    label:     label || '',
  };

  if (!Array.isArray(idea.versions)) idea.versions = [];
  idea.versions.push(v);
  idea.draft = content;
  APP.ui.isDirty = false;

  saveAppState();
  closeModal('save-version-modal');

  // Update versions bar and sidebar badge
  renderVersionsList(idea);
  renderSidebar();

  const vNum = idea.versions.length;
  showToast(`Saved as v${vNum}${label ? ` · ${label}` : ''}`);

  // Clear save indicator
  const indicator = document.getElementById('save-indicator');
  if (indicator) indicator.textContent = '';
}

// ─── Delete Version ───────────────────────────────────────────────────────────
let _deleteVersionId = null;

function openDeleteVersionModal(vId, label) {
  _deleteVersionId = vId;
  document.getElementById('del-ver-label').textContent = label;
  openModal('delete-version-modal');
}

function confirmDeleteVersion() {
  const idea = APP.state.ideas[APP.ui.selectedIdea];
  if (!idea || !_deleteVersionId) return;

  idea.versions = idea.versions.filter(v => v.id !== _deleteVersionId);

  if (APP.ui.selectedVersion === _deleteVersionId) {
    APP.ui.selectedVersion = null;
    saveAppState();
    closeModal('delete-version-modal');
    renderEditor();
    renderSidebar();
    showToast('Version deleted');
    return;
  }

  saveAppState();
  closeModal('delete-version-modal');
  renderVersionsList(idea);
  renderSidebar();
  showToast('Version deleted');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK TYPE MENU  (opened via ⠿ in the float toolbar when text is selected)
// ═══════════════════════════════════════════════════════════════════════════════


function openBlockMenu() {
  // Position below the float toolbar
  const tb   = document.getElementById('float-toolbar');
  const menu = document.getElementById('slash-menu');
  if (!menu) return;

  _slashNode       = null;
  _slashNodeOffset = 0;
  _slashHighlight  = 0;
  _slashActive     = true;

  renderSlashItems('');

  const mw = 240;
  let left = 8, top = 8;
  if (tb && tb.style.display !== 'none') {
    const tr = tb.getBoundingClientRect();
    left = tr.left;
    top  = tr.bottom + 6;
  }
  if (left + mw > window.innerWidth - 12) left = window.innerWidth - mw - 12;
  if (top + 320 > window.innerHeight - 12) top  = (tb ? tb.getBoundingClientRect().top - 326 : window.innerHeight - 332);

  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';
  showSlashMenu();
}

function addBlockBelow() {
  const contentEl = document.getElementById('editor-content');
  if (!contentEl) return;
  contentEl.focus();

  // Move cursor to end of hovered block (or end of content)
  const target = _hoveredBlock || contentEl.lastElementChild;
  if (target) {
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(target);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Insert a new blank paragraph and place cursor in it
  document.execCommand('insertParagraph');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLASH COMMAND MENU  (triggered by typing '/' or clicking +)
// ═══════════════════════════════════════════════════════════════════════════════

let _slashActive      = false;
let _slashNode        = null;   // text node containing '/'
let _slashNodeOffset  = 0;      // index of '/' in that text node
let _slashHighlight   = 0;

const SLASH_ITEMS = [
  { id: 'text',    label: 'Text',          hint: 'Default paragraph',
    icon: '<path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>',
    action: () => document.execCommand('formatBlock', false, 'p') },
  { id: 'h1',      label: 'Heading 1',     hint: 'Big section heading',
    icon: '<path d="M19 3H5v2h6v14h2V5h6V3zm-2 8h-2v2h2v4h2v-4h2v-2h-2V7h-2v4z"/>',
    action: () => document.execCommand('formatBlock', false, 'h1') },
  { id: 'h2',      label: 'Heading 2',     hint: 'Medium section heading',
    icon: '<path d="M5 4v3h5.5v12h3V7H19V4H5zm14 11.5c0 .83-.67 1.5-1.5 1.5H14v1.5h5V19h-5c-.28 0-.5-.22-.5-.5v-2c0-.28.22-.5.5-.5h3.5v-1.5H14V13h3.5c.83 0 1.5.67 1.5 1.5v1z"/>',
    action: () => document.execCommand('formatBlock', false, 'h2') },
  { id: 'h3',      label: 'Heading 3',     hint: 'Small section heading',
    icon: '<path d="M14 7v3h-3V7H9v10h2v-5h3v5h2V7zM5 4v3h5.5v12h3V7H19V4H5z"/>',
    action: () => document.execCommand('formatBlock', false, 'h3') },
  { id: 'bullet',  label: 'Bulleted list', hint: 'Simple bullet points',
    icon: '<path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>',
    action: () => document.execCommand('insertUnorderedList') },
  { id: 'number',  label: 'Numbered list', hint: 'Ordered numbered list',
    icon: '<path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>',
    action: () => document.execCommand('insertOrderedList') },
  { id: 'quote',   label: 'Quote',         hint: 'Capture a quote or callout',
    icon: '<path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>',
    action: () => document.execCommand('formatBlock', false, 'blockquote') },
  { id: 'code',    label: 'Code block',    hint: 'Code with monospace font',
    icon: '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>',
    action: () => document.execCommand('formatBlock', false, 'pre') },
  { id: 'divider', label: 'Divider',       hint: 'Visual horizontal rule',
    icon: '<path d="M19 13H5v-2h14v2z"/>',
    action: () => document.execCommand('insertHTML', false, '<hr>') },
];

function showSlashMenu() {
  const menu = document.getElementById('slash-menu');
  if (menu) { menu.style.display = 'block'; menu.style.opacity = '1'; }
}

function hideSlashMenu() {
  const menu = document.getElementById('slash-menu');
  if (menu) menu.style.display = 'none';
  _slashActive     = false;
  _slashNode       = null;
  _slashHighlight  = 0;
}


function renderSlashItems(query) {
  const list = document.getElementById('slash-items');
  if (!list) return;

  const q = query.toLowerCase();
  const filtered = q
    ? SLASH_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
    : SLASH_ITEMS;

  if (!filtered.length) { hideSlashMenu(); return; }

  // Clamp highlight index
  _slashHighlight = Math.min(_slashHighlight, filtered.length - 1);

  list.innerHTML = filtered.map((item, i) => `
    <div class="slash-item${i === _slashHighlight ? ' highlighted' : ''}"
         data-idx="${i}"
         onmousedown="event.preventDefault()"
         onclick="applySlashItem('${item.id}')">
      <span class="slash-item-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">${item.icon}</svg>
      </span>
      <span class="slash-item-text">
        <span class="slash-item-label">${item.label}</span>
        <span class="slash-item-hint">${item.hint}</span>
      </span>
    </div>
  `).join('');
}

function slashMoveHighlight(dir) {
  const list = document.getElementById('slash-items');
  if (!list) return;
  const count = list.children.length;
  _slashHighlight = (_slashHighlight + dir + count) % count;
  [...list.children].forEach((el, i) => el.classList.toggle('highlighted', i === _slashHighlight));
  list.children[_slashHighlight]?.scrollIntoView({ block: 'nearest' });
}

function applyHighlightedSlashItem() {
  const list = document.getElementById('slash-items');
  if (!list || !list.children[_slashHighlight]) return;
  const id = list.children[_slashHighlight].getAttribute('onclick').match(/'([^']+)'/)?.[1];
  if (id) applySlashItem(id);
}

function applySlashItem(id) {
  const item = SLASH_ITEMS.find(i => i.id === id);
  if (!item) return;

  const contentEl = document.getElementById('editor-content');
  if (!contentEl) return;
  contentEl.focus();

  // Delete '/' + any query text typed after it
  if (_slashNode && _slashNode.parentNode) {
    const sel = window.getSelection();
    if (sel) {
      const curOffset = (sel.rangeCount && sel.getRangeAt(0).startContainer === _slashNode)
        ? sel.getRangeAt(0).startOffset
        : _slashNode.textContent.length;
      const del = document.createRange();
      del.setStart(_slashNode, _slashNodeOffset);
      del.setEnd(_slashNode, curOffset);
      del.deleteContents();
    }
  }

  // Apply the block format
  item.action();
  hideSlashMenu();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING INLINE TOOLBAR  (appears above text selection)
// ═══════════════════════════════════════════════════════════════════════════════

function initFloatToolbar() {
  document.addEventListener('selectionchange', () => {
    const contentEl = document.getElementById('editor-content');
    if (!contentEl || APP.ui.selectedVersion !== null) { hideFloatToolbar(); return; }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hideFloatToolbar(); return; }

    // Check selection is inside editor-content
    const range = sel.getRangeAt(0);
    if (!contentEl.contains(range.commonAncestorContainer)) { hideFloatToolbar(); return; }

    // Small delay so rect is accurate after browser renders selection
    requestAnimationFrame(() => {
      const r = sel.getRangeAt(0);
      showFloatToolbar(r.getBoundingClientRect());
    });
  });

  // Prevent clicking toolbar buttons from collapsing selection
  const tb = document.getElementById('float-toolbar');
  if (tb) tb.addEventListener('mousedown', e => e.preventDefault());

  // Close menus when clicking outside
  document.addEventListener('mousedown', (e) => {
    const slashMenu = document.getElementById('slash-menu');
    if (slashMenu && slashMenu.style.display !== 'none' && !slashMenu.contains(e.target)) {
      hideSlashMenu();
    }
    const colorMenu = document.getElementById('color-menu');
    if (colorMenu && colorMenu.style.display !== 'none' &&
        !colorMenu.contains(e.target) && e.target.id !== 'ft-color-btn' &&
        !e.target.closest('#ft-color-btn')) {
      hideColorMenu();
    }
  });
}

function showFloatToolbar(rect) {
  const tb = document.getElementById('float-toolbar');
  if (!tb || !rect || rect.width === 0) return;

  tb.style.display = 'flex';

  // Position above the selection, centered
  const tbW = tb.offsetWidth || 240;
  const tbH = tb.offsetHeight || 36;

  let left = rect.left + rect.width / 2 - tbW / 2;
  let top  = rect.top - tbH - 10;

  if (left < 8) left = 8;
  if (left + tbW > window.innerWidth - 8) left = window.innerWidth - tbW - 8;
  if (top < 8) top = rect.bottom + 10;

  tb.style.left = left + 'px';
  tb.style.top  = top  + 'px';
}

function hideFloatToolbar() {
  const tb = document.getElementById('float-toolbar');
  if (tb) tb.style.display = 'none';
}

function floatFmt(cmd) {
  document.execCommand(cmd, false, null);
}

function floatFmtCode() {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    document.execCommand('insertHTML', false,
      `<code style="font-family:var(--font-mono);background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:1px 6px;color:#c4b5fd">${escapeHtml(sel.toString())}</code>`
    );
  }
}

function floatFmtLink() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const url = prompt('Enter URL:', 'https://');
  if (!url || url === 'https://') return;
  document.execCommand('createLink', false, url);
  document.getElementById('editor-content')?.querySelectorAll('a').forEach(a => {
    if (a.href === url) { a.target = '_blank'; a.rel = 'noopener'; }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR MENU  (text & background colors, opened from float toolbar)
// ═══════════════════════════════════════════════════════════════════════════════

const TEXT_COLORS = [
  { name: 'Default text',  text: '#d4d4d4', value: null },
  { name: 'Gray',          text: '#9b9b9b', value: '#9b9b9b' },
  { name: 'Brown',         text: '#b5906a', value: '#b5906a' },
  { name: 'Orange',        text: '#d97841', value: '#d97841' },
  { name: 'Yellow',        text: '#c9a227', value: '#c9a227' },
  { name: 'Green',         text: '#4a9a6f', value: '#4a9a6f' },
  { name: 'Blue',          text: '#4a8fcc', value: '#4a8fcc' },
  { name: 'Purple',        text: '#9b6bcc', value: '#9b6bcc' },
  { name: 'Pink',          text: '#cc6b9b', value: '#cc6b9b' },
  { name: 'Red',           text: '#cc4b4b', value: '#cc4b4b' },
];

const BG_COLORS = [
  { name: 'Default background', bg: 'transparent',           value: null },
  { name: 'Gray',               bg: 'rgba(155,155,155,0.25)', value: 'rgba(155,155,155,0.25)' },
  { name: 'Brown',              bg: 'rgba(181,144,106,0.25)', value: 'rgba(181,144,106,0.25)' },
  { name: 'Orange',             bg: 'rgba(217,120,65,0.25)',  value: 'rgba(217,120,65,0.25)' },
  { name: 'Yellow',             bg: 'rgba(201,162,39,0.25)',  value: 'rgba(201,162,39,0.25)' },
  { name: 'Green',              bg: 'rgba(74,154,111,0.25)',  value: 'rgba(74,154,111,0.25)' },
  { name: 'Blue',               bg: 'rgba(74,143,204,0.25)',  value: 'rgba(74,143,204,0.25)' },
  { name: 'Purple',             bg: 'rgba(155,107,204,0.25)', value: 'rgba(155,107,204,0.25)' },
  { name: 'Pink',               bg: 'rgba(204,107,155,0.25)', value: 'rgba(204,107,155,0.25)' },
  { name: 'Red',                bg: 'rgba(204,75,75,0.25)',   value: 'rgba(204,75,75,0.25)' },
];

let _savedRange = null;

function openColorMenu(e) {
  e.preventDefault();
  e.stopPropagation();

  // Save selection so we can restore it before applying color
  const sel = window.getSelection();
  if (sel && sel.rangeCount) _savedRange = sel.getRangeAt(0).cloneRange();

  const menu = document.getElementById('color-menu');
  if (!menu) return;

  // Build menu HTML
  menu.innerHTML =
    `<div class="color-section-label">Text color</div>` +
    TEXT_COLORS.map(c => `
      <div class="color-item" onmousedown="event.preventDefault()" onclick="applyTextColor(${c.value ? `'${c.value}'` : 'null'}, '${c.text}')">
        <div class="color-swatch" style="background:${c.value || 'var(--surface-4)'}; color:${c.value ? '#fff' : 'var(--text)'}">A</div>
        <span class="color-item-name">${c.name}</span>
      </div>`).join('') +
    `<div class="color-section-label" style="margin-top:6px">Background color</div>` +
    BG_COLORS.map(c => `
      <div class="color-item" onmousedown="event.preventDefault()" onclick="applyBgColor(${c.value ? `'${c.value}'` : 'null'}, '${c.bg}')">
        <div class="color-swatch" style="background:${c.bg}; border-color:rgba(255,255,255,0.18)"><span style="font-size:11px;font-weight:700;color:var(--text)">A</span></div>
        <span class="color-item-name">${c.name}</span>
      </div>`).join('');

  // Position below the color button
  const btn = document.getElementById('ft-color-btn');
  const br  = btn ? btn.getBoundingClientRect() : { left: 8, bottom: 8 };
  let left  = br.left;
  let top   = br.bottom + 6;
  if (left + 220 > window.innerWidth - 8) left = window.innerWidth - 228;
  if (top + 400  > window.innerHeight - 8) top  = br.top - 406;

  menu.style.left    = left + 'px';
  menu.style.top     = top  + 'px';
  menu.style.display = 'block';
}

function hideColorMenu() {
  const menu = document.getElementById('color-menu');
  if (menu) menu.style.display = 'none';
}

function _restoreSelection() {
  if (!_savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(_savedRange);
}

function applyTextColor(color, swatchColor) {
  _restoreSelection();
  if (!color) {
    document.execCommand('removeFormat');
  } else {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, color);
    document.execCommand('styleWithCSS', false, false);
  }
  // Update the A indicator color in the toolbar
  const ind = document.getElementById('ft-color-indicator');
  if (ind) ind.style.borderBottomColor = swatchColor || '#d4d4d4';
  hideColorMenu();
}

function applyBgColor(color, bgColor) {
  _restoreSelection();
  if (!color) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('styleWithCSS', false, false);
  } else {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, color);
    document.execCommand('styleWithCSS', false, false);
  }
  // Update the A indicator to show bg color
  const ind = document.getElementById('ft-color-indicator');
  if (ind) ind.style.borderBottomColor = bgColor !== 'transparent' ? bgColor : '#d4d4d4';
  hideColorMenu();
}
