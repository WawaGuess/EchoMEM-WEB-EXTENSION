// 流式完成检测策略注册表
//
// 平台配置中 `streaming.strategy` 的值即此处的 key。
// 添加新策略：导入工厂函数并注册即可。
//
// `none` / 未设置 / 未知策略 → 返回 null（recorder 视为不需要流式检测，
// 每次消息变化都直接走 diff 分支）。

import { createButtonSvgPollDetector } from './button-svg-poll.js';
import { createTextStabilityDetector } from './text-stability.js';
import { createSelectorStateDetector } from './selector-state.js';

const strategies = {
  'button-svg-poll': createButtonSvgPollDetector,
  'text-stability': createTextStabilityDetector,
  'selector-state': createSelectorStateDetector,
};

export function registerStreamingStrategy(name, factory) {
  if (typeof factory !== 'function') {
    throw new Error('Streaming strategy factory must be a function');
  }
  strategies[name] = factory;
}

export function getStreamingStrategy(name) {
  return strategies[name] || null;
}

/**
 * 根据 config.streaming 创建检测器实例。
 * @param {Object|undefined} streamingConfig - { strategy, params }
 * @returns {Object|null} detector 实例或 null
 */
export function createStreamingDetector(streamingConfig) {
  if (!streamingConfig) return null;
  const name = streamingConfig.strategy;
  if (!name || name === 'none') return null;
  const factory = strategies[name];
  if (!factory) {
    console.warn('EchoMem: unknown streaming strategy', name);
    return null;
  }
  try {
    return factory(streamingConfig.params || {});
  } catch (err) {
    console.warn('EchoMem: failed to create streaming detector', name, err);
    return null;
  }
}
