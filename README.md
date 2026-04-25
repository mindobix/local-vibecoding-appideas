# VibeCoding — App Ideas

> Your private idea workspace. No cloud. No accounts. No distractions.

Built for vibe coders who generate ideas faster than they can ship them — a Notion-style writing environment that lives entirely in your browser, stores everything locally, and gets out of your way.

---

## Why This Exists

You're in the zone. An app idea hits. You need somewhere to capture it _right now_ — not a Notion workspace that needs loading, not a Notes app with no structure, not a Google Doc you'll never find again.

VibeCoding App Ideas is a single HTML file. Open it. Start writing. Close the tab. It's still there next time.

---

## Features

### Idea Organization

- **6 built-in categories** — AI Init Commit, AI Apps, Android Apps, iOS Apps, Web Apps, Web Services (alphabetical after the init bucket)
- **Add your own categories** — name them anything, reorganize as your portfolio grows
- **Drag ideas between categories** — changed your mind? Drop it where it belongs
- **Status workflow** — cycle each idea through `Idea → In Progress → Shipped → Archived` with a single click
- **GitHub repo link** — attach the repo URL to each idea once it's alive (also powers the Timeline classifier)
- **Sidebar tabs** — toggle between **All App Ideas** and **Vibe Coding Ideas** (only ideas with active Vibe Coding cards) so you can focus on what's actually in flight
- **Sidebar search** — live-filter categories and ideas by name; matching categories auto-expand
- **Prompt count badge** — each idea row shows the number of cards across the first three VibeBoard columns (Prompts + Vibe Coding + Testing) — drops the moment you ship one to Shipped
- **Rotating header chip** — the title pill cycles through every category with a slow cross-fade every 15 seconds so you remember what's in your portfolio

### Writing Experience

- **Notion-style centered editor** — clean, distraction-free, focused on the words
- **Rich text formatting** — Bold, Italic, Underline, Strikethrough, Inline code, Hyperlinks
- **Block types** — Text, Heading 1–3, Bulleted list, Numbered list, Quote, Code block, Divider
- **Turn into** — select any text, hit the `⠿` button in the floating toolbar, pick a block type to transform it instantly
- **Text & background colors** — 10 text colors + 10 background highlight colors via the floating toolbar
- **Floating format toolbar** — appears on text selection with all formatting options in one place; works inside VibeBoard card editors too
- **Auto-save** — drafts save automatically 600ms after you stop typing. No save button needed.

### Version History

- **Save named versions** — snapshot any idea: `Initial concept`, `MVP plan`, `Revised scope`
- **Browse past versions** — version tabs at the bottom, click any snapshot to view
- **Restore** — bring any version back as your current draft in one click
- **Delete versions** — clean up snapshots you no longer need

### VibeBoard — Kanban for Every Idea

Each app idea has its own private Kanban board for managing the prompts that power it. Open it from the sidebar with a single tap.

- **4 built-in columns** — Prompts, Vibe Coding, Testing, Shipped
- **Inline-renameable columns** — click any column header to rename it
- **Post-it style cards** — square cards with a colored left border per prompt category
- **12 prompt categories** — AI Init Commit, Brainstorming, UI/UX, Web UI, Swift UI, Kotlin UI, API, Database, Libraries, AI Models, AI Agents, AI Libraries — each with its own color
- **AI Init Commit default** — until an idea has its first card in Shipped, every newly added card defaults to the **AI Init Commit** prompt category, so brand-new ideas don't sit unclassified
- **Inline card editing** — type directly on the card; double-tap to open the full editor dialog
- **Full card editor dialog** — same rich text editor used for app ideas, with formatting toolbar, block types, text colors, and slash commands
- **Within-column drag & drop reorder** — drag cards up and down to reprioritize inside a column
- **Cross-column drag & drop** — move a card to any column by dragging
- **Shipped column sorting** — cards in Shipped are ordered earliest → latest by drop time (everywhere else uses manual order)
- **Live VibeBoard search** — filter cards by text, commit hash, app name, or feature theme; column counts switch to `visible/total` while a query is active

#### Automatic Clipboard Copy on Drop

> **Drop a card onto any column and its text is instantly copied to your clipboard.**

When you drag a card from one column to another, the card's full text is silently copied to the clipboard the moment it lands. A subtle confirmation message appears inside the category pill in the card's own category color — no toast popups, no interruptions. Just drag, drop, and paste straight into your AI tool or code editor.

- Works for every column drop, every time
- Handles both plain inline text and rich editor content (HTML stripped to clean text)
- Confirmation fades out automatically after 1.8 seconds

#### Export Card as ZIP

Every card editor dialog has an **Export ZIP** button in the header. One tap packages the card's full text content and all its attachments into a single `.zip` file and downloads it instantly — no server required.

- Card text is saved as `card.txt` (rich editor content is stripped to clean plain text)
- All attachments are included at their original filenames
- The ZIP filename is auto-generated from the first 30 characters of the card text
- Works entirely in-browser using a zero-dependency ZIP builder

#### Card Attachments

- **Up to 4 attachments per card** — images, PDFs, text files, Markdown, JSON, CSV
- **Attach button** in the card editor dialog header
- **Image thumbnails** shown inline — click to open a full lightbox
- **Non-image files** trigger a download on click
- **Remove** any attachment with the ✕ button on its chip
- **Attachment count badge** with a paperclip icon always visible on the card when attachments exist — invisible when empty

### Timeline View — The Pace of What You Shipped

Every VibeBoard has a second view designed for one job: **understanding what got delivered, when, and which feature it served**. Toggle between **Board** and **Timeline** in the VibeBoard header.

Timeline shows only the cards in your **Shipped** column, classified per-idea against that repo's real feature catalog (see [Per-App Feature Taxonomy](#per-app-feature-taxonomy) below).

#### Two sub-views

- **Latest → Oldest** _(default)_ — flat chronological list of every shipped card, newest first, grouped by day for fast scanning. Each card carries a colored feature chip on the right.
- **By Feature** — sections grouped by feature theme, ordered to match the repo's README (so the natural feature list of the app dictates the layout). Cards inside each section show newest-first.

#### Stats bar

A header above the cards shows: **`X shipped · F features touched · Z this week`** — the bare-minimum signal to reflect on velocity.

#### Collapsible cards with full GitHub-style render

Each timeline card is collapsed by default to a one-line summary: date, time, app badge, hash, feature chip, and message subject. **Tap the row** to expand and see the full structured commit display:

- Author + relative date + absolute date
- Co-Authored-By trailers (parsed from commit body)
- **Bold subject** as the message line
- Body parsed into paragraphs and bulleted lists
- `X files changed, Y insertions(+), Z deletions(-)` stat line
- Hash badge linked to GitHub + **Open on GitHub** button

The expanded state is preserved as you switch between sub-views, so you can spread out a few cards in "By Feature" and they stay open when you flip to "Latest → Oldest".

Search works in both sub-views — type a feature name, app name, hash, or message text and non-matching cards (and any empty days/sections) hide instantly.

### Per-App Feature Taxonomy

Timeline classification is **per-idea**, not generic. Each idea's shipped cards are classified against the **real feature list of its own repo** — drawn from that repo's README and project structure.

**How it's built:**

1. Run `bash tools/install-hooks.sh`. After installing the post-commit hook in every sibling `vibecode/*/` repo, it executes `tools/build-app-features.js`.
2. The builder walks every repo, parses its README's `## Features` section (recursing through `### / ####` subheadings, with a fallback to top-level `##` sections that aren't boilerplate), and augments with significant filenames + folders under `src|js|lib|app|pages|components|features|modules`.
3. Output goes to two files:
   - `data/incoming/app-features.json` — human-inspectable, version-controllable
   - `data/app-features.js` — `window.APP_FEATURES = {...}`, loaded by the browser via a `<script>` tag (works on `file://` where `fetch()` is restricted)

**How it's used:**

- The classifier matches each shipped card's text + commit message + changed files against the keywords of every feature in the idea's catalog. Specificity tie-breaker: longest matched keyword wins.
- Cards are re-classified every time the Timeline opens, so README updates flow through automatically — no manual retagging.
- Manual override is intentionally **not** offered. Update the README, re-run `install-hooks.sh`, refresh.

**For repos that aren't cloned locally:**

If you set an idea's GitHub URL to a repo that doesn't exist in `vibecode/`, the browser fetches its README directly from `api.github.com/repos/{owner}/{repo}/readme` (public, unauthenticated, ~60 req/hr), runs the same heading-extraction logic in-browser, and **caches the result in IndexedDB** so reloads don't re-fetch. The Timeline shows a "Fetching feature catalog from GitHub…" banner during the brief request.

### Import Commit Cards

Every time you ship something in a vibecode app, the commit gets written to `data/incoming/pending.json`. The **Import Commits** button pulls those commits in as VibeBoard cards — one tap, no copy-paste.

- **Auto-open** — after the first pick, the file picker remembers `pending.json` and reads it directly on every subsequent tap. No navigation, no extra clicks.
- **Smart card preview** — a modal lists every pending commit with its message, app name, changed files, and timestamp before anything is imported
- **Per-card controls** — choose which column to land in (default: **Shipped**, since commits are already shipped code), assign a prompt category (default: **Web UI**), and uncheck any commits you want to skip
- **Auto-match to idea** — the importer matches the commit's app name to an existing idea in the sidebar and pre-selects it; override any match before confirming
- **Idea propagation** — set the idea on row 1 and any subsequent row that didn't auto-match inherits it (label shows "copied from row 1"); rows you've already touched are preserved
- **Auto-classify on import** — when a commit lands in Shipped, it's classified against the target idea's feature catalog instantly, so it's already grouped correctly the moment you flip to the Timeline
- **GitHub-style rich render** — imported cards render with author, co-authors, bold subject, bulleted body, stat line, hash badge, and an Open-on-GitHub link. Existing imports lazy-migrate to the rich layout the first time you view them.
- **Clears after import** — once you confirm, the imported entries are removed from `pending.json` automatically so the queue stays clean
- **Graceful fallback** — browsers without the File System Access API fall back to a standard file picker; clearing the queue is skipped silently

### Data & Privacy

- **100% offline** — no server, no API, no account. Works with no internet connection.
- **IndexedDB storage** — all data lives in your browser with no size restrictions (scales to gigabytes vs the ~5 MB localStorage cap). Existing localStorage data is auto-migrated on first load — nothing lost.
- **Backup** — download a full JSON backup of all categories, ideas, versions, VibeBoard cards, and attachments
- **Restore** — import any backup file to pick up exactly where you left off
- **Resizable sidebar** — drag the divider to give the editor more room

---

## Who This Is For

- **Vibe coders** who generate more app ideas than hours in the day
- **Solo builders** who want to track what they're building and what's next
- **Indie hackers** managing a backlog of projects across platforms
- **AI-assisted developers** who need prompts ready to paste the moment inspiration strikes
- **Anyone** who thinks Notion is overkill for a scratch pad

---

## Getting Started

```
Open local-vibecoding-appideas/index.html in any browser
```

That's it. No install. No build step. No npm. No account.

---

## Keyboard Shortcuts

| Action           | Shortcut        |
| ---------------- | --------------- |
| Save version     | `⌘S` / `Ctrl+S` |
| Bold             | `⌘B` / `Ctrl+B` |
| Italic           | `⌘I` / `Ctrl+I` |
| Underline        | `⌘U` / `Ctrl+U` |

---

## Tech Stack

Vanilla HTML, CSS, JavaScript. Zero dependencies. Zero frameworks. Zero build tools. **Node.js** is only needed once, when you run `tools/install-hooks.sh` to seed git hooks and the per-app feature taxonomy.

- `index.html` — structure + modals
- `css/styles.css` — dark theme, layout, shared components
- `css/sidebar.css` — category & idea tree, sidebar tabs, search input
- `css/editor.css` — Notion-style page editor + floating toolbar
- `css/vibeboard.css` — Kanban board, cards, attachments, view tabs, Timeline view, commit-card rich render
- `js/app.js` — state, init, utilities, header chip rotation
- `js/storage.js` — IndexedDB storage, backup, restore
- `js/sidebar.js` — category/idea CRUD, drag & drop, sidebar tabs, search, VibeBoard launch shortcut
- `js/editor.js` — rich text editor, versions, floating toolbar, color menu
- `js/vibeboard.js` — VibeBoard Kanban + Timeline view, card CRUD, drag & drop, clipboard copy, attachments, feature classifier, GitHub README fetch fallback, commit-card rich renderer
- `data/app-features.js` — auto-generated `window.APP_FEATURES` taxonomy (regenerated by `tools/build-app-features.js`)
- `data/incoming/app-features.json` — same taxonomy, human-inspectable
- `data/incoming/pending.json` — queue of commit cards waiting to be imported
- `tools/install-hooks.sh` — installs the post-commit hook in every sibling vibecode repo, then builds the feature taxonomy
- `tools/commit-card.js` — runs in each post-commit hook; appends a commit card to `pending.json`
- `tools/build-app-features.js` — walks sibling repos, extracts per-app feature catalogs from README + project structure

---

## Part of Local › LaunchPad

This app is part of a collection of offline-first browser tools built for people who don't want to pay $20/month to think.
