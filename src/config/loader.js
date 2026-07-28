// 平台配置加载器 —— 从 JSON 加载平台声明。
//
// 设计原则：
//   - JSON 是声明式真相源（DOM 选择器、检测特征、流式策略名称等）。
//   - 新增平台 → 改 JSON，loader 文件**不需要**改动。

import platformData from './platforms.json';

const PLATFORM_CONFIGS = {};
for (const config of platformData.platforms || []) {
  PLATFORM_CONFIGS[config.id] = { ...config };
}

export function getPlatformConfig(id) {
  return PLATFORM_CONFIGS[id] || null;
}

export function getAllEnabledPlatforms() {
  return Object.values(PLATFORM_CONFIGS).filter((p) => p.enabled !== false);
}

export function shouldRecord(platformId) {
  const config = PLATFORM_CONFIGS[platformId];
  return config?.record === true && config?.enabled !== false;
}

export { PLATFORM_CONFIGS };
