// EchoMem Web Extension - Content Script Entry Point

import { addCustomButtons } from '../core/buttons.js';
import { getCurrentPlatform } from '../core/detection.js';
import { createDomLifecycle } from '../core/lifecycle.js';
import {
  getPanelConfig,
  isPanelOpen,
  setOriginalPanelContent
} from '../core/panel.js';
import { bindPanelNavigation } from '../core/router.js';
import { bindRuntimeMessages } from '../services/messaging.js';

console.log('EchoMem Extension: Content script loaded');

window.clawExtensionLoaded = true;
window.echoMemExtensionLoaded = true;

function syncOriginalSidebarContent() {
  const platform = getCurrentPlatform();
  const panelConfig = getPanelConfig(platform);

  if (!panelConfig || panelConfig.type !== 'sidebar') return;

  const container = document.querySelector(panelConfig.containerSelector);
  if (container && !isPanelOpen() && !container.querySelector('.claw-custom-panel')) {
    setOriginalPanelContent(container.innerHTML);
  }
}

function refreshContentScriptMount() {
  addCustomButtons();
  syncOriginalSidebarContent();
  bindPanelNavigation();
}

const lifecycle = createDomLifecycle({
  onDomChange: refreshContentScriptMount
});

function start() {
  lifecycle.start();
  refreshContentScriptMount();
  bindRuntimeMessages();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
