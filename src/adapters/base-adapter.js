// 平台 adapter 基类 —— 所有方法都有可工作的默认实现，子类只需重写差异点。
//
// 设计原则：
//   1. 行为优先来自 `platforms.json` 的声明式配置；
//   2. 默认实现按"配置驱动"工作（noise 选择器、角色信号、文本子元素等都从 config 读）；
//   3. 仅当 JSON 无法表达时，对应平台 adapter 才需要重写方法。
//
// 任何 DeepSeek / HIGO 字面量都不应出现在本文件中。

import { createStreamingDetector } from '../streaming/registry.js';

const DEFAULT_NOISE_SELECTORS = ['button', 'svg', 'img', 'script', 'style'];

function safeQuery(selector) {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

export const BaseAdapter = {
  /**
   * 查找消息容器：先尝试配置中的 messageContainers，再交给 smart container。
   */
  findMessageContainer(config) {
    const containers = config?.messages?.messageContainers || [];
    for (const selector of containers) {
      const el = safeQuery(selector);
      if (el) return el;
    }
    return this.findSmartMessageContainer(config);
  },

  /**
   * 通用智能容器：先按 smartContainerHints 找，再按可滚动 + 尺寸启发。
   */
  findSmartMessageContainer(config) {
    const hints = config?.messages?.smartContainerHints || [];
    for (const selector of hints) {
      const el = safeQuery(selector);
      if (el) return el;
    }

    const scrollables = Array.from(document.querySelectorAll('div')).filter((div) => {
      const style = window.getComputedStyle(div);
      return (
        style.overflow === 'auto' ||
        style.overflow === 'scroll' ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll'
      );
    });

    const candidates = scrollables.filter((div) => {
      const rect = div.getBoundingClientRect();
      if (rect.height < 200) return false;
      if (rect.width < 300 && rect.width > 0) return false;
      return true;
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);
      return candidates[0];
    }

    const fallback = Array.from(document.querySelectorAll('div')).filter((div) => {
      const rect = div.getBoundingClientRect();
      return rect.height > 300 && rect.width > 300;
    });
    if (fallback.length > 0) {
      fallback.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.height * rb.width - ra.height * ra.width;
      });
      return fallback[0];
    }

    return null;
  },

  /**
   * 噪音选择器：清理元素文本前要剔除的子元素。从 config 拿，附加默认通用项。
   */
  getNoiseSelectors(config) {
    const extra = config?.messages?.noiseSelectors || [];
    return [...DEFAULT_NOISE_SELECTORS, ...extra];
  },

  /**
   * 角色判定：助手 / 用户。
   * 默认规则：
   *   - 元素内含 config.messages.assistant.roleSignals 任一选择器 → 助手
   *   - className 含 'user' 或样式右对齐 → 用户
   *   - 否则默认 user（保守策略）
   */
  isUserMessage(el, config) {
    if (!el) return true;
    const assistantSignals = config?.messages?.assistant?.roleSignals || [];
    for (const sel of assistantSignals) {
      try {
        if (el.querySelector(sel)) return false;
      } catch {
        // 无效选择器忽略
      }
    }

    const className = typeof el.className === 'string' ? el.className : '';
    if (className.includes('user') || className.includes('User')) return true;

    try {
      const style = window.getComputedStyle(el);
      if (style.alignSelf === 'flex-end' || style.marginLeft === 'auto') return true;
      const parent = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
      if (parent && (parent.justifyContent === 'flex-end' || parent.alignItems === 'flex-end')) {
        return true;
      }
    } catch {
      // ignore
    }
    return true;
  },

  /**
   * 助手消息是否仍在"思考中"（不应作为完整消息提取）。
   * 默认：如果配置了 assistant.textSelector 且 skipIfMissing=true，
   * 但元素内找不到对应子元素，则视为思考中。
   */
  isAssistantPending(el, config) {
    const sel = config?.messages?.assistant?.textSelector;
    const skip = config?.messages?.assistant?.skipIfMissing;
    if (!sel || !skip) return false;
    try {
      return !el.querySelector(sel);
    } catch {
      return false;
    }
  },

  /**
   * 助手最终文本所在子元素：用于"思考过程在外层，最终答案在子元素"的平台。
   * 返回 null 表示直接用整个 el。
   */
  getAssistantTextElement(el, config) {
    const sel = config?.messages?.assistant?.textSelector;
    if (!sel) return el;
    try {
      return el.querySelector(sel) || null;
    } catch {
      return null;
    }
  },

  /**
   * 通用文本提取：克隆 → 剔除噪音 → trim。
   */
  cleanText(el, config) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    const noise = this.getNoiseSelectors(config);
    for (const sel of noise) {
      try {
        clone.querySelectorAll(sel).forEach((n) => n.remove());
      } catch {
        // ignore
      }
    }
    return clone.textContent?.trim() || '';
  },

  /**
   * 提取用户消息文本：默认使用 cleanText。
   */
  extractUserText(el, config) {
    return this.cleanText(el, config);
  },

  /**
   * 提取助手消息文本：先取 textSelector 子元素再清理。
   * 如果 skipIfMissing=true 且子元素不存在，返回 null 表示该消息应跳过。
   */
  extractAssistantText(el, config) {
    if (this.isAssistantPending(el, config)) return null;
    const target = this.getAssistantTextElement(el, config) || el;
    return this.cleanText(target, config);
  },

  /**
   * 创建流式完成检测器。基于 config.streaming 调用策略注册表。
   * 返回 null 表示不需要流式检测（每次 DOM 变化直接 diff）。
   */
  createStreamingDetector(config) {
    return createStreamingDetector(config?.streaming);
  },

  /**
   * 启动器背景色：用于 launcher 主题适配。
   * 默认按 config.launcher.backgroundColorFrom = { selector, property } 读取。
   * 没配置则返回 null（launcher 自己使用默认值）。
   */
  getLauncherBackground(config) {
    const rule = config?.launcher?.backgroundColorFrom;
    if (!rule?.selector) return null;
    const target = safeQuery(rule.selector);
    if (!target) return null;
    const style = window.getComputedStyle(target);
    const value = style[rule.property || 'backgroundColor'];
    if (!value || value === 'rgba(0, 0, 0, 0)') return null;
    return value;
  },
};
