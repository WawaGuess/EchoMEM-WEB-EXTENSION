# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Chrome Extension (Manifest V3)** project called "EchoMem Web Extension". It enhances supported Claw/AI chat workflows by injecting a single `EchoMem` launcher near the chat input. The launcher opens a right-side navigation panel for resources, input association, cognitive feedback, Skill store, and productivity overview features.

Currently supported platforms:
- HIGO Office
- DeepSeek

## Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select this project directory (`claw-web-extension/`)
5. The extension icon will appear in the Chrome toolbar

## Project Structure

```
claw-web-extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html             # Popup UI markup
├── popup.css              # Popup styles
├── popup.js               # Popup logic and user interactions
├── background.js          # Service worker (background script)
├── content.js             # Content script injected into web pages
├── content.css            # Styles injected into web pages
├── icons/                 # Extension icons (16x16, 48x48, 128x128)
├── src/                   # Modular source mirror / future structure
└── docs/                  # Design documents
```

## Key Architecture

### Manifest V3
- Uses `manifest_version: 3`
- Background script runs as a **service worker** (event-based, not persistent)
- Content scripts inject into all URLs via `<all_urls>`, then platform detection gates EchoMem UI injection
- Permissions: `activeTab`, `storage`, `scripting`

### Runtime Entry
- Chrome currently loads root-level `content.js` directly from `manifest.json`.
- The `src/` modules mirror the same architecture, but they are not loaded by Chrome unless a build step or manifest change is added.
- Runtime behavior changes must be made in `content.js`; if keeping the modular copy useful, mirror the same change in `src/`.

### Communication Flow
- **Popup** (`popup.js`) is currently an information-only UI.
- **Content Script** (`content.js`) injects the EchoMem launcher and panels on supported pages.
- **Background** (`background.js`) initializes storage and exposes basic message handlers such as `getTabInfo` and `saveToHistory`.

### Data Flow
1. Content script observes DOM changes with `MutationObserver`
2. Platform detection checks URL, title, DOM features, and content keywords
3. On supported pages, the script injects one `EchoMem` launcher near the chat input
4. Clicking the launcher opens a right-side sidebar or overlay panel
5. Menu items open the corresponding feature panels, with back navigation to the EchoMem home panel

## Common Development Tasks

### Reload Extension After Changes
After modifying any file, go to `chrome://extensions/` and click the refresh icon on the extension card, or use the "Update" button.

### Debug Popup
- Right-click the extension icon → "Inspect popup"
- Opens DevTools for the popup context

### Debug Content Script
- Open DevTools on any web page
- Look for messages in the Console from `content.js`
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

## Notes

- No build step required — this is a vanilla JavaScript extension loaded from root files
- No package manager (npm/yarn) is used
- Keep `content.js` and the `src/` mirror in sync when changing runtime logic, or explicitly decide to deprecate one of them
- Icons directory (`icons/`) needs PNG files: `icon16.png`, `icon48.png`, `icon128.png`
- The extension uses Chinese (zh-CN) UI text
