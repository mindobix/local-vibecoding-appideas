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
- **Block types** — Text, Heading 1, Heading 2, Heading 3, Bulleted list, Numbered list, Quote, Code block, Divider
- **Turn into** — select any text, hit the `⠿` button in the toolbar, pick a block type to transform it instantly
- **Text & background colors** — 10 text colors + 10 background highlight colors, applied to any selection via the floating toolbar
- **Floating format toolbar** — appears on text selection with all formatting options in one place
- **Auto-save** — drafts save to localStorage 600ms after you stop typing. No save button needed.

### Version History

- **Save named versions** — snapshot any idea at any point: `Initial concept`, `MVP plan`, `Revised scope`
- **Browse past versions** — version tabs at the bottom, click to view any snapshot
- **Restore** — bring any version back as your current draft in one click
- **Delete versions** — clean up snapshots you no longer need

### Data & Privacy

- **100% offline** — no server, no API, no account. Works with no internet connection.
- **localStorage** — all data lives in your browser, private by default
- **Backup** — download a full JSON backup of all categories, ideas, versions, and drafts
- **Restore** — import any backup file to pick up exactly where you left off
- **Resizable sidebar** — drag the divider to give the editor more room

---

## Who This Is For

- **Vibe coders** who generate more app ideas than hours in the day
- **Solo builders** who want to track what they're building and what's next
- **Indie hackers** managing a backlog of projects across platforms
- **Anyone** who thinks Notion is overkill for a scratch pad

---

## Getting Started

```
Open local-vibecoding-appideas/index.html in any browser
```

That's it. No install. No build step. No npm. No account.

---

## Keyboard Shortcuts

| Action       | Shortcut        |
| ------------ | --------------- |
| Save version | `⌘S` / `Ctrl+S` |
| Bold         | `⌘B` / `Ctrl+B` |
| Italic       | `⌘I` / `Ctrl+I` |
| Underline    | `⌘U` / `Ctrl+U` |

---

## Tech Stack

Vanilla HTML, CSS, JavaScript. Zero dependencies. Zero frameworks. Zero build tools.

The whole app is four files:

- `index.html` — structure + modals
- `css/styles.css` — dark theme, layout, shared components
- `css/sidebar.css` — category & idea tree
- `css/editor.css` — Notion-style page editor
- `js/app.js` — state, init, utilities
- `js/storage.js` — localStorage, backup, restore
- `js/sidebar.js` — category/idea CRUD, drag & drop
- `js/editor.js` — rich text editor, versions, color menu

---

## Part of Local › LaunchPad

This app is part of a collection of offline-first browser tools built for people who don't want to pay $20/month to think.
