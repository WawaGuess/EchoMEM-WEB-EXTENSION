// EchoMem Web Extension - Content Script Entry Point

import { addCustomButtons } from '../core/buttons.js';
import { getCurrentPlatform } from '../core/detection.js';
import { createDomLifecycle } from '../core/lifecycle.js';
import {
  isPanelOpen
} from '../core/panel.js';
import { bindPanelNavigation } from '../core/router.js';
import { bindRuntimeMessages } from '../services/messaging.js';
import { initState } from '../core/state.js';
import { startInputTracking, tryBindInputElement } from '../core/input-tracker.js';
import { startRecording } from '../core/session-recorder.js';
import { shouldRecord } from '../config/loader.js';

console.log('EchoMem Extension: Content script loaded');

window.clawExtensionLoaded = true;
window.echoMemExtensionLoaded = true;

function refreshContentScriptMount() {
  addCustomButtons();
  bindPanelNavigation();
  // DOM 变化时尝试绑定输入框监听
  tryBindInputElement();

  // 如果平台刚被检测出来，启动输入联想
  const platform = getCurrentPlatform();
  if (platform && !window.echomemInputTrackingStarted) {
    window.echomemInputTrackingStarted = true;
    console.log('EchoMem: Starting input tracking on DOM change for', platform.config.name);
    startInputTracking(platform.config);
  }

  // 会话记录：每次 DOM 变化都尝试启动/继续记录（startRecording 是幂等的）
  if (platform && shouldRecord(platform.key)) {
    startRecording(platform.key);
  }
}

const lifecycle = createDomLifecycle({
  onDomChange: refreshContentScriptMount
});

async function start() {
  await initState();
  lifecycle.start();
  refreshContentScriptMount();
  bindRuntimeMessages();

  // 启动输入联想监听
  // 注意：平台检测在 addCustomButtons() 中执行，所以这里重新获取
  const platform = getCurrentPlatform();
  if (platform && !window.echomemInputTrackingStarted) {
    window.echomemInputTrackingStarted = true;
    console.log('EchoMem: Starting input tracking for', platform.config.name);
    startInputTracking(platform.config);
  } else if (!platform) {
    console.log('EchoMem: Platform not detected yet, input tracking will start on next DOM change');
  }

  // 启动会话记录（幂等的 startRecording 可多次调用）
  if (platform && shouldRecord(platform.key)) {
    startRecording(platform.key);
  } else if (!platform) {
    console.log('EchoMem: Platform not detected yet, session recording will start on next DOM change');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
