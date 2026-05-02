// 平台检测逻辑

import { PLATFORM_CONFIGS } from '../platforms/index.js';
import { getPlatform, setPlatform } from './state.js';

export function getCurrentPlatform() {
  return getPlatform();
}

export function setCurrentPlatform(platform) {
  setPlatform(platform);
}

// 多层平台检测函数（4层全部满足才判定为目标页面）
export function detectPlatformMultiLayer(detection) {
  const logs = [];

  // 第一层：URL 路径检测
  if (detection.urlPatterns) {
    const urlMatch = detection.urlPatterns.some(pattern =>
      window.location.href.includes(pattern)
    );
    if (!urlMatch) {
      console.log('Claw Extension: 平台检测未通过 - URL不匹配');
      return false;
    }
    logs.push('✓ URL匹配');
  }

  // 第二层：页面标题检测
  if (detection.titleKeywords) {
    const titleMatch = detection.titleKeywords.some(keyword =>
      document.title.includes(keyword)
    );
    if (!titleMatch) {
      console.log('Claw Extension: 平台检测未通过 - 标题关键字不匹配');
      return false;
    }
    logs.push('✓ 标题关键字匹配');
  }

  // 第三层：DOM 特征检测
  if (detection.domFeatures) {
    const { required, optional } = detection.domFeatures;

    if (required && required.length > 0) {
      for (const feature of required) {
        const exists = document.querySelector(feature.selector) !== null;
        if (!exists) {
          console.log(`Claw Extension: 平台检测未通过 - 缺少必要DOM: ${feature.description}`);
          return false;
        }
      }
      logs.push('✓ 必要DOM元素全部存在');
    }

    if (optional && optional.length > 0) {
      const optionalMatch = optional.some(feature =>
        document.querySelector(feature.selector) !== null
      );
      if (!optionalMatch) {
        console.log('Claw Extension: 平台检测未通过 - 无可选DOM特征匹配');
        return false;
      }
      logs.push('✓ 可选DOM特征匹配');
    }
  }

  // 第四层：页面内容关键字
  if (detection.contentKeywords && document.body) {
    const bodyText = document.body.innerText || '';
    if (bodyText.length > 0) {
      const contentMatch = detection.contentKeywords.some(keyword =>
        bodyText.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!contentMatch) {
        console.log('Claw Extension: 平台检测未通过 - 页面内容关键字不匹配');
        return false;
      }
      logs.push('✓ 页面内容关键字匹配');
    }
  }

  console.log('Claw Extension: 平台检测全部通过:', logs.join(' | '));
  return true;
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
