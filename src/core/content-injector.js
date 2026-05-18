// 内容注入工具 — 将资源内容插入聊天输入框

import { getCurrentPlatform } from './detection.js';

function findInputElement() {
  const platform = getCurrentPlatform();
  if (!platform) return null;
  const selector = platform.config?.launcher?.validateSelectors?.textarea;
  if (!selector) return null;
  return document.querySelector(selector);
}

const MEM_TAG_OPEN = '<relevant-memories>';
const MEM_TAG_CLOSE = '</relevant-memories>';

function stripMemoryBlock(text) {
  const start = text.indexOf(MEM_TAG_OPEN);
  if (start === -1) return text.trim();
  const end = text.indexOf(MEM_TAG_CLOSE, start);
  if (end === -1) return text.trim();
  return (text.slice(0, start) + text.slice(end + MEM_TAG_CLOSE.length)).trim();
}

/**
 * 将内容注入到聊天输入框
 * @param {string} content 要注入的内容
 * @param {Object} options
 * @param {boolean} options.replace 是否替换已有的 <relevant-memories> 块
 * @param {boolean} options.focus 注入后是否聚焦输入框
 */
export function injectContent(content, options = {}) {
  const textarea = findInputElement();
  if (!textarea) {
    console.warn('EchoMem: 未找到输入框，无法注入内容');
    return false;
  }

  const existing = textarea.value || '';
  let base = options.replace ? stripMemoryBlock(existing) : existing;

  // 清理内容中的标签，避免嵌套
  const cleanContent = content
    .replace(new RegExp(MEM_TAG_OPEN, 'g'), '')
    .replace(new RegExp(MEM_TAG_CLOSE, 'g'), '')
    .trim();

  if (!cleanContent) return false;

  const block = `${MEM_TAG_OPEN}\n${cleanContent}\n${MEM_TAG_CLOSE}`;

  // 如果 base 为空，直接放入；否则换行追加
  const next = base ? `${base}\n\n${block}` : block;

  textarea.value = next;

  try {
    textarea.selectionStart = textarea.selectionEnd = next.length;
  } catch (_) {
    // ignore
  }

  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  if (options.focus !== false) {
    textarea.focus();
  }

  return true;
}

/**
 * 获取当前输入框中 <relevant-memories> 块内的内容
 */
export function extractInjectedContent() {
  const textarea = findInputElement();
  if (!textarea) return null;
  const text = textarea.value || '';
  const start = text.indexOf(MEM_TAG_OPEN);
  if (start === -1) return null;
  const end = text.indexOf(MEM_TAG_CLOSE, start);
  if (end === -1) return null;
  return text.slice(start + MEM_TAG_OPEN.length, end).trim();
}
