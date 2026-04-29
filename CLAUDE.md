# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Chrome Extension (Manifest V3)** project called "Claw Web Extension". It is a browser extension for web automation and data extraction that can be loaded directly into Chrome in developer mode.

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
└── assets/                # Web-accessible resources
```

## Key Architecture

### Manifest V3
- Uses `manifest_version: 3`
- Background script runs as a **service worker** (event-based, not persistent)
- Content scripts inject into all URLs via `<all_urls>`
- Permissions: `activeTab`, `storage`, `scripting`

### Communication Flow
- **Popup** (`popup.js`) communicates with **Content Scripts** via `chrome.scripting.executeScript()`
- **Popup/Content** can send messages to **Background** via `chrome.runtime.sendMessage()`
- **Background** listens via `chrome.runtime.onMessage.addListener()`

### Data Flow
1. User clicks button in popup
2. Popup calls `chrome.scripting.executeScript()` to run code in the active tab
3. Content script or injected function extracts data from the DOM
4. Results are displayed in the popup UI

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
- **Get Page Info**: Extracts title, URL, meta description, keywords, H1, link count, image count
- **Extract Links**: Scrapes all anchor tags (text + href) from the current page
- **Extract Images**: Scrapes all images (src, alt, dimensions) from the current page
- **Copy Results**: Copies extracted data to clipboard

## Notes

- No build step required — this is a vanilla JavaScript extension
- No package manager (npm/yarn) is used
- Icons directory (`icons/`) needs PNG files: `icon16.png`, `icon48.png`, `icon128.png`
- The extension uses Chinese (zh-CN) UI text
