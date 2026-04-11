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

- **5 built-in categories** — AI Apps, Android Apps, iOS Apps, Web Apps, Web Services (alphabetical, opinionated)
- **Add your own categories** — name them anything, reorganize as your portfolio grows
- **Drag ideas between categories** — changed your mind? Drop it where it belongs
- **Status workflow** — cycle each idea through `Idea → In Progress → Shipped → Archived` with a single click
- **GitHub repo link** — attach the repo URL to each idea once it's alive

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
- **11 prompt categories** — Brainstorming, UI/UX, Web UI, Swift UI, Kotlin UI, API, Database, Libraries, AI Models, AI Agents, AI Libraries — each with its own color
- **Inline card editing** — type directly on the card; double-tap to open the full editor dialog
- **Full card editor dialog** — same rich text editor used for app ideas, with formatting toolbar, block types, text colors, and slash commands
- **Within-column drag & drop reorder** — drag cards up and down to reprioritize inside a column
- **Cross-column drag & drop** — move a card to any column by dragging

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

Vanilla HTML, CSS, JavaScript. Zero dependencies. Zero frameworks. Zero build tools.

- `index.html` — structure + modals
- `css/styles.css` — dark theme, layout, shared components
- `css/sidebar.css` — category & idea tree
- `css/editor.css` — Notion-style page editor + floating toolbar
- `css/vibeboard.css` — Kanban board, cards, attachments
- `js/app.js` — state, init, utilities
- `js/storage.js` — IndexedDB storage, backup, restore
- `js/sidebar.js` — category/idea CRUD, drag & drop, VibeBoard launch shortcut
- `js/editor.js` — rich text editor, versions, floating toolbar, color menu
- `js/vibeboard.js` — VibeBoard Kanban, card CRUD, drag & drop, clipboard copy, attachments

---

## Part of Local › LaunchPad

This app is part of a collection of offline-first browser tools built for people who don't want to pay $20/month to think.
