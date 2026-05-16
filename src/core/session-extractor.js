// 会话内容提取 —— 从页面 DOM 提取当前聊天记录。
//
// 本模块只负责"通用编排"：
//   - 按 config 选择器尝试找消息容器；
//   - 按 config 选择器尝试 user / assistant 分离；
//   - 通用启发式 fallback。
//
// 所有平台特化（噪音过滤、助手文本子元素、思考态判定、智能容器提示）
// 都委托给 adapter（src/adapters/*）或经 platforms.json 配置传入。
// 本文件**不应**出现任何 .ds-*、deepseek、higo 等平台字面量。

import { tokenize, calculateOverlap } from '../utils/text-processor.js';
import { PLATFORM_CONFIGS } from '../platforms/index.js';
import { getAdapter } from '../adapters/registry.js';

function getMessageSelectors(config) {
  return config?.messages || null;
}

function queryWithFallback(selectors) {
  for (const selector of selectors || []) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    } catch {
      continue;
    }
  }
  return [];
}

function findMessagesInContainer(container, selectors) {
  for (const selector of selectors || []) {
    try {
      let elements = Array.from(container.querySelectorAll(selector));
      if (elements.length > 0) {
        // 过滤嵌套：如果一个元素被另一个匹配元素包含，只保留最外层
        elements = elements.filter((el, i, arr) =>
          !arr.some((other, j) => i !== j && other !== el && other.contains(el))
        );
        return elements;
      }
    } catch {
      continue;
    }
  }
  return [];
}

function isElementVisible(el) {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * 从滚动容器中按直接子元素提取消息（兜底路径）。
 */
function extractMessagesFromScrollContainer(container, adapter, config) {
  const messages = [];
  const children = Array.from(container.children);

  for (const child of children) {
    // 跳过输入框区域
    if (child.querySelector?.('textarea, input')) continue;
    if (child.tagName === 'TEXTAREA' || child.tagName === 'INPUT') continue;

    if (!isElementVisible(child)) continue;

    const role = adapter.isUserMessage(child, config) ? 'user' : 'assistant';

    let text;
    if (role === 'assistant') {
      if (adapter.isAssistantPending(child, config)) continue;
      text = adapter.extractAssistantText(child, config);
    } else {
      text = adapter.extractUserText(child, config);
    }
    if (!text) continue;

    messages.push({ role, text, el: child });
  }

  return messages;
}

/**
 * 去重并清理消息数组
 * - 按 DOM 元素引用去重（同一节点只保留第一次出现）
 * - 相邻同 role + text 合并
 */
function finalizeMessages(raw) {
  const seenEls = new WeakSet();
  const result = [];
  for (const m of raw) {
    if (m.el) {
      if (seenEls.has(m.el)) continue;
      seenEls.add(m.el);
    }
    const last = result[result.length - 1];
    if (last && last.role === m.role && last.text === m.text) continue;
    result.push({
      role: m.role,
      text: m.text,
      timestamp: Date.now(),
    });
  }
  return result;
}

/**
 * 提取当前页面的会话消息
 * @param {string} platformId
 * @returns {Array<{role: string, text: string, timestamp: number}>}
 */
export function extractSessionMessages(platformId) {
  const config = PLATFORM_CONFIGS[platformId];
  const adapter = getAdapter(platformId);
  const selectors = getMessageSelectors(config);
  if (!selectors) {
    console.log('EchoMem: no message selectors for platform', platformId);
    return [];
  }

  const messages = [];

  // 1. 尝试找到消息容器（使用配置的选择器）
  const containers = queryWithFallback(selectors.messageContainers);

  if (containers.length > 0) {
    const container = containers[0];

    // 2. 按角色选择器分离 user / assistant
    const userMsgs = findMessagesInContainer(container, selectors.userMessages);
    const assistantMsgs = findMessagesInContainer(container, selectors.assistantMessages);

    if (userMsgs.length > 0 || assistantMsgs.length > 0) {
      const allElements = [];

      for (const el of userMsgs) {
        if (!isElementVisible(el)) continue;
        const text = adapter.extractUserText(el, config);
        if (text) allElements.push({ el, role: 'user', text });
      }

      for (const el of assistantMsgs) {
        if (!isElementVisible(el)) continue;
        if (adapter.isAssistantPending(el, config)) continue;
        const text = adapter.extractAssistantText(el, config);
        if (text) allElements.push({ el, role: 'assistant', text });
      }

      allElements.sort((a, b) => {
        const posA = a.el.compareDocumentPosition(b.el);
        return posA & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      for (const item of allElements) {
        messages.push({
          el: item.el,
          role: item.role,
          text: item.text,
          timestamp: Date.now(),
        });
      }

      console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from selectors)');
      return finalizeMessages(messages);
    }

    // 3. 无法区分角色，使用通用选择器 + adapter 角色启发
    let genericMsgs = findMessagesInContainer(container, selectors.allMessages);

    if (genericMsgs.length > 50) {
      console.log('EchoMem: too many generic matches (' + genericMsgs.length + '), using direct children');
      genericMsgs = Array.from(container.children).filter((el) => {
        if (!isElementVisible(el)) return false;
        const text = adapter.cleanText(el, config);
        return !!text;
      });
    }

    if (genericMsgs.length > 0) {
      let skippedInvisible = 0;
      let skippedShort = 0;
      let skippedPending = 0;

      for (let i = 0; i < genericMsgs.length; i++) {
        const el = genericMsgs[i];
        if (!isElementVisible(el)) {
          skippedInvisible++;
          continue;
        }

        const role = adapter.isUserMessage(el, config) ? 'user' : 'assistant';

        let text;
        if (role === 'assistant') {
          if (adapter.isAssistantPending(el, config)) {
            skippedPending++;
            console.log('EchoMem: msg[' + i + '] role=assistant skipped=pending');
            continue;
          }
          text = adapter.extractAssistantText(el, config);
        } else {
          text = adapter.extractUserText(el, config);
        }

        if (!text) {
          skippedShort++;
          continue;
        }

        console.log(
          'EchoMem: msg[' + i + '] role=' + role +
          ' visible=' + isElementVisible(el) +
          ' textLen=' + text.length +
          ' cls=' + (el.className || '').split(' ').slice(0, 3).join(' ')
        );

        messages.push({ el, role, text, timestamp: Date.now() });
      }

      console.log(
        'EchoMem: extracted', messages.length, 'session messages for', platformId,
        '(from generic selectors, total=' + genericMsgs.length,
        'skipped invisible=' + skippedInvisible,
        'skipped short=' + skippedShort,
        'skipped pending=' + skippedPending + ')'
      );
      return finalizeMessages(messages);
    }
  }

  // 4. 兜底：智能查找消息容器（由 adapter 负责，平台特化 hint 走 config）
  console.log('EchoMem: no message container found via selectors, trying smart detection');
  const smartContainer = adapter.findSmartMessageContainer(config);

  if (smartContainer) {
    const extracted = extractMessagesFromScrollContainer(smartContainer, adapter, config);
    for (const m of extracted) {
      messages.push({ el: m.el, role: m.role, text: m.text, timestamp: Date.now() });
    }
    console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from smart detection)');
    return finalizeMessages(messages);
  }

  console.log('EchoMem: failed to extract session messages for', platformId);
  return finalizeMessages(messages);
}

/**
 * 处理会话上下文，提取与用户输入相关的句子
 * @param {Array} messages
 * @param {string} userInput
 * @param {number} maxResults
 * @returns {Array<{text: string, score: number, source: string, role: string}>}
 */
export function processSessionContext(messages, userInput, maxResults = 5) {
  if (!messages.length || !userInput) return [];

  const inputWords = new Set(tokenize(userInput));
  if (inputWords.size === 0) return [];

  const recentMessages = messages.slice(-10);
  const candidates = [];

  for (const msg of recentMessages) {
    const text = msg.text;
    const textWords = new Set(tokenize(text));
    if (textWords.size === 0) continue;

    const overlap = calculateOverlap(inputWords, textWords);
    const jaccard = (() => {
      const intersection = new Set([...inputWords].filter((x) => textWords.has(x))).size;
      const union = new Set([...inputWords, ...textWords]).size;
      return union > 0 ? intersection / union : 0;
    })();

    const roleWeight = msg.role === 'user' ? 1.2 : 1.0;
    const score = (jaccard * 0.5 + (overlap / (inputWords.size * 2)) * 0.5) * roleWeight;

    if (score > 0.01) {
      candidates.push({
        text,
        score: Math.min(score, 1.0),
        source: 'session',
        role: msg.role,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

/**
 * 获取当前会话的纯文本摘要（用于调试）
 */
export function getSessionSummary(platformId) {
  const messages = extractSessionMessages(platformId);
  if (!messages.length) return '';
  return messages.map((m) => `${m.role}: ${m.text.slice(0, 50)}...`).join('\n');
}
