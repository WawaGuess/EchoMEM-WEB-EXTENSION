import { getCurrentPlatform } from '../core/detection.js';
import { ensureEchoMemOverlayOpen } from '../core/router.js';

let bound = false;

export function bindRuntimeMessages() {
  if (bound) return;
  bound = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.action !== 'openEchoMemOverlay') return false;

    if (!getCurrentPlatform()) {
      sendResponse({ success: false, error: '当前页面不是 EchoMem 支持的平台' });
      return false;
    }

    const result = ensureEchoMemOverlayOpen();
    sendResponse({ success: true, ...result });
    return false;
  });
}
