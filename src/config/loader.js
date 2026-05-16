// 平台配置加载器 — 从 JSON 加载并注入平台特定函数

import platformData from './platforms.json';

/**
 * 为特定平台注入运行时函数（JSON 无法存储函数）
 */
function enrichConfig(config) {
  const enriched = { ...config };

  // DeepSeek 动态背景色
  if (enriched.id === 'deepseek' && enriched.launcher?.dynamicBackground) {
    enriched.launcher = { ...enriched.launcher };
    enriched.launcher.getBackgroundColor = () => {
      const inputArea = document.querySelector('._77cefa5');
      if (inputArea) {
        const style = window.getComputedStyle(inputArea);
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          return style.backgroundColor;
        }
      }
      return '#fff';
    };
  }

  return enriched;
}

// 构建平台配置映射表
const PLATFORM_CONFIGS = {};
for (const config of platformData.platforms || []) {
  PLATFORM_CONFIGS[config.id] = enrichConfig(config);
}

export function getPlatformConfig(id) {
  return PLATFORM_CONFIGS[id] || null;
}

export function getAllEnabledPlatforms() {
  return Object.values(PLATFORM_CONFIGS).filter(p => p.enabled !== false);
}

export function shouldRecord(platformId) {
  const config = PLATFORM_CONFIGS[platformId];
  return config?.record === true && config?.enabled !== false;
}

export { PLATFORM_CONFIGS };
