// 文档：docs/flows/platform-detection/检测流程.md
// 平台检测逻辑

import { PLATFORM_CONFIGS } from '../platforms/index.js';
import { getPlatform, setPlatform } from './state.js';
import { detectPlatformMultiLayer } from './detection-matcher.mjs';

export { detectPlatformMultiLayer } from './detection-matcher.mjs';

export function getCurrentPlatform() {
  return getPlatform();
}

export function setCurrentPlatform(platform) {
  setPlatform(platform);
}

// 检测当前页面属于哪个平台
export function detectPlatform() {
  for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
    try {
      if (detectPlatformMultiLayer(config.detection)) {
        console.log(`Claw Extension: Detected platform - ${config.name}`);
        return { key, config };
      }
    } catch (e) {
      console.error(`Claw Extension: Detection error for ${key}`, e);
    }
  }
  return null;
}
