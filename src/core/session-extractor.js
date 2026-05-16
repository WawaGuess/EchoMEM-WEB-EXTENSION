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
      let elements = Array.from(container.querySelectorAll(selector));
      if (elements.length > 0) {
        // 过滤嵌套：如果一个元素被另一个匹配元素包含，只保留最外层
        elements = elements.filter((el, i, arr) =>
          !arr.some((other, j) => i !== j && other !== el && other.contains(el))
        );
        return elements;
      }
    } catch (e) {
      continue;
    }
  }
  return [];
}

/**
 * 检查元素是否在 DOM 中且占据布局空间（排除 display:none 和 detached）
 * 使用 getBoundingClientRect 比 offsetParent 更可靠，避免 position:fixed 误报
 * @param {Element} el
 * @returns {boolean}
 */
function isElementVisible(el) {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * 清理元素后提取文本
 * @param {Element} element
 * @returns {string}
 */
function getCleanText(element) {
  const clone = element.cloneNode(true);
  const noiseSelectors = [
    'button', 'svg', 'img', 'script', 'style',
    '.ds-think-content'   // DeepSeek: 排除思考过程
  ];
  for (const sel of noiseSelectors) {
    clone.querySelectorAll?.(sel)?.forEach(el => el.remove());
  }
  return clone.textContent?.trim() || '';
}

/**
 * 提取元素的文本内容
 * @param {Element} element
 * @returns {string}
 */
function extractText(element) {
  // 通用文本提取：清理噪音后返回元素文本
  return getCleanText(element);
}

/**
 * 启发式判断元素是否为用户消息
 * @param {Element} el
 * @returns {boolean}
 */
function isUserMessageHeuristic(el) {
  // DeepSeek: 包含 .ds-think-content（思考过程）或 .ds-assistant-message-main-content（最终答案）的是助手消息
  if (el.querySelector('.ds-assistant-message-main-content, .ds-think-content')) {
    return false;
  }

  // 检查 class 名（最可靠的标志）
  const className = el.className || '';
  if (className.includes('user') || className.includes('User')) {
    return true;
  }

  // 检查是否靠右对齐（HIGO 等平台的特征）
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

  // 默认假设是用户消息（当无法确定时，让不包含助手特征的消息成为用户消息）
  return true;
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

    // 过滤不可见的元素
    if (!isElementVisible(child)) continue;

    // 判断角色
    const isUser = isUserMessageHeuristic(child);
    const role = isUser ? 'user' : 'assistant';

    let text;
    if (role === 'assistant') {
      // DeepSeek 助手消息：最终答案只在 .ds-assistant-message-main-content 中
      // .ds-markdown 在思考过程里也有，不能作为 fallback，否则会误提取思考内容
      const answerEl = child.querySelector('.ds-assistant-message-main-content');
      if (!answerEl) continue; // 还在思考阶段，跳过
      text = getCleanText(answerEl);
    } else {
      text = extractText(child);
    }
    if (!text) continue;

    messages.push({
      role,
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
  // DeepSeek 特殊处理
  const dsVirtualList = document.querySelector('.ds-virtual-list');
  if (dsVirtualList) {
    return dsVirtualList;
  }

  // 1. 找所有可滚动的 div
  const scrollables = Array.from(document.querySelectorAll('div')).filter(div => {
    const style = window.getComputedStyle(div);
    return style.overflow === 'auto' || style.overflow === 'scroll' ||
           style.overflowY === 'auto' || style.overflowY === 'scroll';
  });

  // 2. 排除太小的；保留包含输入框的（DeepSeek 的消息容器包含 textarea）
  const candidates = scrollables.filter(div => {
    const rect = div.getBoundingClientRect();
    if (rect.height < 200) return false;
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
      timestamp: Date.now()
    });
  }
  return result;
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
        if (!isElementVisible(el)) continue;
        const text = extractText(el);
        if (text) {
          allElements.push({ el, role: 'user', text });
        }
      }

      for (const el of assistantMsgs) {
        if (!isElementVisible(el)) continue;
        const text = extractText(el);
        if (text) {
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
          el: item.el,
          role: item.role,
          text: item.text,
          timestamp: Date.now()
        });
      }

      console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from selectors)');
      return finalizeMessages(messages);
    }

    // 3. 无法区分角色，使用通用选择器
    let genericMsgs = findMessagesInContainer(container, selectors.allMessages);

    // 如果匹配的 div 太多（超过50个），说明匹配了嵌套 div，改用直接子元素
    if (genericMsgs.length > 50) {
      console.log('EchoMem: too many generic matches (' + genericMsgs.length + '), using direct children');
      genericMsgs = Array.from(container.children).filter(el => {
        if (!isElementVisible(el)) return false;
        const text = extractText(el);
        return !!text;
      });
    }

    if (genericMsgs.length > 0) {
      let skippedInvisible = 0;
      let skippedShort = 0;
      let skippedNoAnswer = 0;
      for (let i = 0; i < genericMsgs.length; i++) {
        const el = genericMsgs[i];
        // 过滤不可见的元素（虚拟列表可能缓存了旧会话的隐藏消息）
        if (!isElementVisible(el)) {
          skippedInvisible++;
          continue;
        }

        const isUser = isUserMessageHeuristic(el);
        const role = isUser ? 'user' : 'assistant';

        let text;
        if (role === 'assistant') {
          // DeepSeek 助手消息：最终答案只在 .ds-assistant-message-main-content 中
          // .ds-markdown 在思考过程里也有，不能作为 fallback，否则会误提取思考内容
          const answerEl = el.querySelector('.ds-assistant-message-main-content');
          if (!answerEl) {
            // 还在思考阶段，没有答案元素，跳过
            skippedNoAnswer++;
            console.log('EchoMem: msg[' + i + '] role=assistant skipped=no-answer-element');
            continue;
          }
          text = getCleanText(answerEl);
        } else {
          text = extractText(el);
        }

        if (!text) {
          skippedShort++;
          continue;
        }
        console.log('EchoMem: msg[' + i + '] role=' + role +
          ' visible=' + isElementVisible(el) + ' textLen=' + text.length +
          ' cls=' + (el.className || '').split(' ').slice(0, 3).join(' '));
        messages.push({
          el,
          role,
          text,
          timestamp: Date.now()
        });
      }

      console.log('EchoMem: extracted', messages.length, 'session messages for', platformId,
        '(from generic selectors, total=' + genericMsgs.length,
        'skipped invisible=' + skippedInvisible,
        'skipped short=' + skippedShort,
        'skipped no-answer=' + skippedNoAnswer + ')');
      return finalizeMessages(messages);
    }
  }

  // 4. 兜底：智能查找消息容器
  console.log('EchoMem: no message container found via selectors, trying smart detection');
  const smartContainer = findSmartMessageContainer();

  if (smartContainer) {
    const extracted = extractMessagesFromScrollContainer(smartContainer);

    for (const m of extracted) {
      messages.push({
        el: m.el,
        role: m.role,
        text: m.text,
        timestamp: Date.now()
      });
    }

    console.log('EchoMem: extracted', messages.length, 'session messages for', platformId, '(from smart detection)');
    return finalizeMessages(messages);
  }

  console.log('EchoMem: failed to extract session messages for', platformId);
  return finalizeMessages(messages);
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
