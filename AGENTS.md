# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

This is a **Chrome Extension (Manifest V3)** project called "EchoMem Web Extension". It enhances supported Claw/AI chat workflows by injecting a single `EchoMem` launcher near the chat input. The launcher opens a right-side navigation panel for resources, input association, cognitive feedback, Skill store, and productivity overview features.

Currently supported platforms:
- HIGO Office
- DeepSeek

## Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select this project directory (`EchoMEM-WEB-EXTENSION/`)
5. The extension icon will appear in the Chrome toolbar

## Project Structure

```
EchoMEM-WEB-EXTENSION/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html             # Popup UI markup
├── popup.css              # Popup styles
├── popup.js               # Popup logic and user interactions
├── background.js          # Service worker (background script)
├── content.css            # Styles injected into web pages
├── dist/
│   └── content.js         # Bundled content script loaded by Chrome
├── icons/                 # Extension icons (16x16, 48x48, 128x128)
├── src/                   # Modular content script source
│   ├── entry/             # Content script source entry
│   ├── core/              # Detection, injection, routing, state, panel host
│   ├── panels/            # EchoMem feature panel modules
│   ├── platforms/         # Platform registry and configs
│   └── services/          # Chrome API wrappers
└── docs/                  # Documentation index, current design, architecture, and legacy docs
    ├── architecture/      # Platform detection and runtime architecture
    ├── design/            # Current interaction design
    ├── proposals/         # Draft, discussion, and validation plans
    └── legacy/            # Historical 4-button design records
```

## Key Architecture

### Manifest V3
- Uses `manifest_version: 3`
- Background script runs as a **service worker** (event-based, not persistent)
- Content scripts inject into all URLs via `<all_urls>`, then platform detection gates EchoMem UI injection
- Permissions: `activeTab`, `storage`, `scripting`

### Runtime Entry
- Runtime source is `src/entry/content.js`.
- Chrome loads the bundled `dist/content.js` from `manifest.json`.
- Runtime behavior changes should be made in `src/`, then rebuilt with `npm run build`.
- Keep `dist/content.js` committed so the unpacked extension can be loaded without a local build step.

### Documentation Maintenance
- Do not re-audit every document after each code change.
- Use `docs/proposals/` for draft or unconfirmed feature/architecture plans.
- Update `docs/design/` only when accepted user-facing behavior, entry points, interaction flow, or acceptance criteria change.
- Update `docs/architecture/` only when runtime entry, platform detection, injection flow, data flow, or structural decisions change.
- Move replaced but useful records to `docs/legacy/`; keep legacy docs as historical references rather than current truth.
- Update `docs/README.md` only when adding, moving, deleting, or reclassifying documentation.

### Communication Flow
- **Popup** (`popup.js`) is currently an information-only UI.
- **Content Script** (`src/entry/content.js` -> `dist/content.js`) injects the EchoMem launcher and panels on supported pages.
- **Background** (`background.js`) initializes storage and exposes basic message handlers such as `getTabInfo` and `saveToHistory`.

### Data Flow
1. Content script observes DOM changes with `MutationObserver`
2. Platform detection checks URL, title, DOM features, and content keywords
3. On supported pages, the script injects one `EchoMem` launcher near the chat input
4. Clicking the launcher opens a right-side sidebar or overlay panel
5. Menu items open the corresponding feature panels, with back navigation to the EchoMem home panel

## Common Development Tasks

### Reload Extension After Changes
After modifying files under `src/`, run `npm run build`, then go to `chrome://extensions/` and click the refresh icon on the extension card, or use the "Update" button.

### Debug Popup
- Right-click the extension icon → "Inspect popup"
- Opens DevTools for the popup context

### Debug Content Script
- Open DevTools on any web page
- Look for messages in the Console from `dist/content.js`
- Content script runs in the page's isolated world

### Debug Background Script
- Go to `chrome://extensions/`
- Click "service worker" link on the extension card
- Opens DevTools for the background context

### Add New Permissions
If you need new permissions (e.g., `tabs`, `bookmarks`), add them to `manifest.json` under the `permissions` array, then reload the extension.

## Extension Capabilities

Current features implemented:
- **EchoMem Launcher**: A single launcher button near the chat input
- **Feature Navigation**: Right-side EchoMem home panel with 5 feature entries
- **Resource Management**: Placeholder upload area and resource list
- **Input Association**: Toggleable on/off state panel
- **Cognitive Feedback**: Placeholder session stats and report action
- **Skill Store**: Store home and detail pages with back navigation
- **Productivity Overview**: Placeholder usage metrics and empty state

Feature panel source modules live under `src/panels/` as one directory per primary EchoMem entry:
`echomem/`, `resource/`, `association/`, `feedback/`, `skill-store/`, and `performance/`.
Keep new subfeatures inside the corresponding feature directory unless they become shared runtime services.

## Notes

- Build step required for content script changes: `npm run build`
- esbuild bundles `src/entry/content.js` into `dist/content.js`
- Icons directory (`icons/`) needs PNG files: `icon16.png`, `icon48.png`, `icon128.png`
- The extension uses Chinese (zh-CN) UI text
