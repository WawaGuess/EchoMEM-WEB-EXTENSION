// 会话内容提取 — 从页面 DOM 提取当前聊天记录

import { tokenize, calculateOverlap } from '../utils/text-processor.js';
import { PLATFORM_CONFIGS } from '../platforms/index.js';

/**
 * 获取平台的消息选择器配置
 * @param {string} platformId
 * @returns {Object|null}
 */
function getMessageSelectors(platformId) {
  const config = PLATFORM_CONFIGS[platformId];
  return config?.messages || null;
}

/**
 * 尝试多个选择器，返回第一个匹配的元素列表
 * @param {string[]} selectors
 * @returns {Element[]}
 */
function queryWithFallback(selectors) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    } catch (e) {
      // 无效选择器，跳过
      continue;
    }
  }
  return [];
}

/**
 * 从容器中查找消息元素
 * @param {Element} container
 * @param {string[]} selectors
 * @returns {Element[]}
 */
function findMessagesInContainer(container, selectors) {
  for (const selector of selectors) {
    try {
      const elements = container.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    } catch (e) {
      continue;
    }
  }
  return [];
}

/**
 * 提取元素的文本内容
 * @param {Element} element
 * @returns {string}
 */
function extractText(element) {
  // 优先使用 textContent，过滤掉代码块、按钮等
  const clone = element.cloneNode(true);

  // 移除常见的非内容元素
  const noiseSelectors = [
    'button', 'svg', 'img', 'script', 'style',
    '[class*="copy"]',
    '[class*="action"]',
    '[class*="toolbar"]'
  ];

  for (const sel of noiseSelectors) {
    clone.querySelectorAll?.(sel)?.forEach(el => el.remove());
  }

  return clone.textContent?.trim() || '';
}

/**
 * 启发式判断元素是否为用户消息（HIGO 中用户消息通常在右侧）
 * @param {Element} el
 * @returns {boolean}
 */
function isUserMessageHeuristic(el) {
  // 检查 class 名（最可靠的标志）
  const className = el.className || '';
  if (className.includes('user') || className.includes('User')) {
    return true;
  }

  // 检查是否靠右对齐
  try {
    const style = window.getComputedStyle(el);
    const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : null;

    if (style.alignSelf === 'flex-end' || style.marginLeft === 'auto') {
      return true;
    }

    if (parentStyle && (parentStyle.justifyContent === 'flex-end' || parentStyle.alignItems === 'flex-end')) {
      return true;
    }
  } catch (e) {
    // 忽略 getComputedStyle 错误
  }

  return false;
}

/**
 * 从滚动容器中提取消息
 * HIGO 的消息通常在可滚动的 div 中
 * @param {Element} container
 * @returns {Array<{role: string, text: string}>}
 */
function extractMessagesFromScrollContainer(container) {
  const messages = [];

  // 获取容器的直接子元素（消息通常是容器的直接子元素）
  const children = Array.from(container.children);

  for (const child of children) {
    // 跳过输入框区域
    if (child.querySelector('textarea, input')) continue;
    if (child.tagName === 'TEXTAREA' || child.tagName === 'INPUT') continue;

    const text = extractText(child);
    if (text.length < 3 || text.length > 500) continue;

    // 判断角色
    const isUser = isUserMessageHeuristic(child);

    messages.push({
      role: isUser ? 'user' : 'assistant',
      text,
      el: child
    });
  }

  return messages;
}

/**
 * 智能查找消息容器
 * 优先找滚动区域，排除输入框和侧边栏
 * @returns {Element|null}
 */
function findSmartMessageContainer() {
  // 1. 找所有可滚动的 div
  const scrollables = Array.from(document.querySelectorAll('div')).filter(div => {
    const style = window.getComputedStyle(div);
    return style.overflow === 'auto' || style.overflow === 'scroll' ||
           style.overflowY === 'auto' || style.overflowY === 'scroll';
  });

  // 2. 排除太小的（不是消息列表）和包含输入框的
  const candidates = scrollables.filter(div => {
    // 排除包含 textarea 的（可能是输入框容器）
    if (div.querySelector('textarea')) return false;

    // 排除太小的
    const rect = div.getBoundingClientRect();
    if (rect.height < 200) return false;

    // 排除侧边栏（通常较窄）
    if (rect.width < 300 && rect.width > 0) return false;

    return true;
  });

  // 3. 找包含最多文本内容的
  if (candidates.length > 0) {
    // 按高度排序，取最大的（通常是消息列表）
    candidates.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectB.height - rectA.height;
    });

    return candidates[0];
  }

  return null;
}

/**
 * 提取当前页面的会话消息
 * @param {string} platformId - 平台 ID ('higo' | 'deepseek')
 * @returns {Array<{role: string, text: string, timestamp: number}>
 */
export function extractSessionMessages(platformId) {
  const selectors = getMessageSelectors(platformId);
  if (!selectors) {
    console.log('EchoMem: no message selectors for platform', platformId);
    return [];
  }

  const messages = [];

  // 1. 尝试找到消息容器（使用配置的选择器）
  const containers = queryWithFallback(selectors.messageContainers);

  if (containers.length > 0) {
    // 使用第一个找到的容器
    const container = containers[0];

    // 2. 尝试区分用户/AI 消息
    const userMsgs = findMessagesInContainer(container, selectors.userMessages);
    const assistantMsgs = findMessagesInContainer(container, selectors.assistantMessages);

    if (userMsgs.length > 0 || assistantMsgs.length > 0) {
      // 能区分角色，按 DOM 顺序合并
      const allElements = [];

      for (const el of userMsgs) {
        const text = extractText(el);
        if (text.length >= 3) {
          allElements.push({ el, role: 'user', text });
        }
      }

      for (const el of assistantMsgs) {
        const text = extractText(el);
        if (text.length >= 3) {
          allElements.push({ el, role: 'assistant', text });
        }
      }

      // 按 DOM 位置排序
      allElements.sort((a, b) => {
        const posA = a.el.compareDocumentPosition(b.el);
        return posA & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      for (const item of allElements) {
        messages.push({
          role: item.role,
          text: item.text,
          timestamp: Date.now()
        });
      }

      console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from selectors)');
      return messages;
    }

    // 3. 无法区分角色，使用通用选择器
    let genericMsgs = findMessagesInContainer(container, selectors.allMessages);

    // 如果匹配的 div 太多（超过50个），说明匹配了嵌套 div，改用直接子元素
    if (genericMsgs.length > 50) {
      console.log('EchoMem: too many generic matches (' + genericMsgs.length + '), using direct children');
      genericMsgs = Array.from(container.children).filter(el => {
        const text = extractText(el);
        return text.length >= 3 && text.length <= 500;
      });
    }

    if (genericMsgs.length > 0) {
      for (let i = 0; i < genericMsgs.length; i++) {
        const text = extractText(genericMsgs[i]);
        if (text.length >= 3) {
          messages.push({
            role: i % 2 === 0 ? 'user' : 'assistant',
            text,
            timestamp: Date.now()
          });
        }
      }

      console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from generic selectors)');
      return messages;
    }
  }

  // 4. 兜底：智能查找消息容器
  console.log('EchoMem: no message container found via selectors, trying smart detection');
  const smartContainer = findSmartMessageContainer();

  if (smartContainer) {
    const extracted = extractMessagesFromScrollContainer(smartContainer);

    for (const m of extracted) {
      messages.push({
        role: m.role,
        text: m.text,
        timestamp: Date.now()
      });
    }

    console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from smart detection)');
    return messages;
  }

  console.log('EchoMem: failed to extract session messages for', platformId);
  return messages;
}

/**
 * 处理会话上下文，提取与用户输入相关的句子
 * @param {Array} messages - extractSessionMessages 的返回
 * @param {string} userInput - 当前用户输入
 * @param {number} maxResults - 最多返回几条
 * @returns {Array<{text: string, score: number, source: string, role: string}>}
 */
export function processSessionContext(messages, userInput, maxResults = 5) {
  if (!messages.length || !userInput) return [];

  const inputWords = new Set(tokenize(userInput));
  if (inputWords.size === 0) return [];

  // 取最近的消息（最多最近 10 条）
  const recentMessages = messages.slice(-10);

  const candidates = [];

  for (const msg of recentMessages) {
    const text = msg.text;
    const textWords = new Set(tokenize(text));

    if (textWords.size === 0) continue;

    // 计算相关性
    const overlap = calculateOverlap(inputWords, textWords);
    const jaccard = (() => {
      const intersection = new Set([...inputWords].filter(x => textWords.has(x))).size;
      const union = new Set([...inputWords, ...textWords]).size;
      return union > 0 ? intersection / union : 0;
    })();

    // 综合分数：用户消息权重更高
    const roleWeight = msg.role === 'user' ? 1.2 : 1.0;
    const score = (jaccard * 0.5 + (overlap / (inputWords.size * 2)) * 0.5) * roleWeight;

    if (score > 0.01) { // 进一步降低阈值
      candidates.push({
        text,
        score: Math.min(score, 1.0),
        source: 'session',
        role: msg.role
      });
    }
  }

  // 按分数排序，取前 N
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * 获取当前会话的纯文本摘要（用于调试）
 * @param {string} platformId
 * @returns {string}
 */
export function getSessionSummary(platformId) {
  const messages = extractSessionMessages(platformId);
  if (!messages.length) return '';

  return messages.map(m => `${m.role}: ${m.text.slice(0, 50)}...`).join('\n');
}
