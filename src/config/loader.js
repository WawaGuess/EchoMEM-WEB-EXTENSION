// 平台配置加载器 —— 从 JSON 加载并按通用规则注入运行时函数。
//
// 设计原则：
//   - JSON 是声明式真相源（DOM 选择器、检测特征、流式策略名称等）。
//   - 运行时函数（无法存于 JSON）由本文件按"通用规则"附加，
//     不再按 platformId 写 if 分支。
//   - 新增平台 → 改 JSON，loader 文件**不需要**改动。

import platformData from './platforms.json';

/**
 * 按配置生成 launcher.getBackgroundColor 函数。
 * 仅当 launcher.backgroundColorFrom = { selector, property?, fallback? } 存在时生成。
 */
function buildLauncherBackgroundFn(launcher) {
  const rule = launcher?.backgroundColorFrom;
  if (!rule?.selector) return null;
  const property = rule.property || 'backgroundColor';
  const fallback = rule.fallback || null;
  return () => {
    try {
      const target = document.querySelector(rule.selector);
      if (target) {
        const style = window.getComputedStyle(target);
        const value = style[property];
        if (value && value !== 'rgba(0, 0, 0, 0)') return value;
      }
    } catch {
      // ignore
    }
    return fallback;
  };
}

/**
 * 按通用规则把 JSON 中无法表达的运行时能力挂回配置对象。
 * 任何"按 id 区分"的逻辑应**避免**出现在本函数。
 */
function enrichConfig(config) {
  const enriched = { ...config };

  // launcher.backgroundColorFrom → launcher.getBackgroundColor
  if (enriched.launcher) {
    const bgFn = buildLauncherBackgroundFn(enriched.launcher);
    if (bgFn) {
      enriched.launcher = { ...enriched.launcher, getBackgroundColor: bgFn };
    }
  }

  return enriched;
}

const PLATFORM_CONFIGS = {};
for (const config of platformData.platforms || []) {
  PLATFORM_CONFIGS[config.id] = enrichConfig(config);
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
