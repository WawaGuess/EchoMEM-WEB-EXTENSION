// 会话自动记录器 — 监听聊天消息变化并同步到 OpenViking

import { extractSessionMessages } from './session-extractor.js';
import { createClient } from '../services/openviking-client.js';
import { getOpenVikingConfig } from '../services/config.js';
import { extractSessionId, mapToOpenVikingSessionId } from '../services/session-mapper.js';
import { PLATFORM_CONFIGS, shouldRecord } from '../config/loader.js';

const recorderState = {
  platformId: null,
  rawSessionId: null,
  openVikingSessionId: null,
  lastMessages: [],
  pendingQueue: [],
  observer: null,
  debounceTimer: null,
  isRecording: false,
  ovClient: null,
  assistantStableTimer: null,
  streamingTimeoutTimer: null,
  streamingSnapshot: null,
  streamingWasActive: false,
};

const PENDING_QUEUE_MAX = 100;
const DEBOUNCE_MS = 500;
const STABLE_CHECK_INTERVAL_MS = 500;
const STABLE_COUNT_THRESHOLD = 4; // 2 seconds of stability before sending
const SENT_SIGNATURE_TTL_MS = 600000; // 10 分钟

const sentSignatures = new Map();

function getMessageSignature(msg) {
  return `${msg.role}:${msg.text}`;
}

function filterRecentlySent(messages) {
  const now = Date.now();
  for (const [sig, ts] of sentSignatures) {
    if (now - ts > SENT_SIGNATURE_TTL_MS) sentSignatures.delete(sig);
  }
  return messages.filter(m => {
    const sig = getMessageSignature(m);
    if (sentSignatures.has(sig)) {
      console.log('EchoMem: skip recently sent message', sig.slice(0, 50));
      return false;
    }
    sentSignatures.set(sig, now);
    return true;
  });
}

async function getOvClient() {
  if (!recorderState.ovClient) {
    const config = await getOpenVikingConfig();
    recorderState.ovClient = createClient(config);
  }
  return recorderState.ovClient;
}

function getSessionStorageKey() {
  return `echomem_session_${recorderState.platformId}_${recorderState.rawSessionId}`;
}

async function loadSessionMapping() {
  try {
    const key = getSessionStorageKey();
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch {
    return null;
  }
}

async function saveSessionMapping(openVikingSessionId) {
  try {
    const key = getSessionStorageKey();
    await chrome.storage.local.set({ [key]: openVikingSessionId });
  } catch (err) {
    console.warn('EchoMem: failed to save session mapping', err);
  }
}

function diffMessages(newMessages, oldMessages) {
  // 首次提取，全部视为新增
  if (!oldMessages || oldMessages.length === 0) {
    return newMessages;
  }

  // 1. 前缀匹配 — 正常追加消息
  const minLen = Math.min(newMessages.length, oldMessages.length);
  let prefixMatch = true;
  for (let i = 0; i < minLen; i++) {
    if (newMessages[i].role !== oldMessages[i].role) {
      prefixMatch = false;
      break;
    }
  }
  if (prefixMatch) {
    const added = newMessages.slice(oldMessages.length);
    const oldSignatures = new Set(oldMessages.map(m => `${m.role}:${m.text}`));
    const uniqueAdded = added.filter(m => !oldSignatures.has(`${m.role}:${m.text}`));
    if (uniqueAdded.length !== added.length) {
      console.log('EchoMem diag: prefix diff dropped duplicates', added.length - uniqueAdded.length);
    }
    return uniqueAdded;
  }

  // 2. 后缀匹配 — DeepSeek 虚拟列表卸载了前面的消息，
  //    oldMessages 的后半段仍能在 newMessages 开头找到
  for (let oldStart = 0; oldStart < oldMessages.length; oldStart++) {
    const suffix = oldMessages.slice(oldStart);
    if (suffix.length > newMessages.length) continue;

    let match = true;
    for (let i = 0; i < suffix.length; i++) {
      if (newMessages[i].role !== suffix[i].role) {
        match = false;
        break;
      }
    }
    if (match) {
      const added = newMessages.slice(suffix.length);
      const oldSignatures = new Set(oldMessages.map(m => `${m.role}:${m.text}`));
      const uniqueAdded = added.filter(m => !oldSignatures.has(`${m.role}:${m.text}`));
      if (uniqueAdded.length !== added.length) {
        console.log('EchoMem diag: suffix diff dropped duplicates', added.length - uniqueAdded.length);
      }
      return uniqueAdded;
    }
  }

  // 3. 完全无法对齐，保险起见返回全部（仅在极端场景下命中）
  const added = newMessages;

  // 4. 最终防护：丢弃 added 中已经在 oldMessages 里出现过的消息
  const oldSignatures = new Set(oldMessages.map(m => `${m.role}:${m.text}`));
  const uniqueAdded = added.filter(m => !oldSignatures.has(`${m.role}:${m.text}`));

  if (uniqueAdded.length !== added.length) {
    console.log('EchoMem diag: diff dropped duplicates', added.length - uniqueAdded.length);
  }

  return uniqueAdded;
}

function findMessageContainer(platformId) {
  const config = PLATFORM_CONFIGS[platformId];

  // 1. 先尝试配置中的选择器
  if (config?.messages?.messageContainers) {
    for (const selector of config.messages.messageContainers) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          console.log('EchoMem: message container found via selector', selector);
          return el;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // 2. 兜底：智能查找可滚动的大容器（排除输入框区域）
  const smart = findSmartMessageContainer();
  if (smart) {
    console.log('EchoMem: message container found via smart detection', smart.className);
    return smart;
  }

  return null;
}

/**
 * 启发式查找消息容器 — 与 session-extractor.js 中的逻辑保持一致
 */
function findSmartMessageContainer() {
  // DeepSeek 特殊处理：直接找 .ds-virtual-list
  const dsVirtualList = document.querySelector('.ds-virtual-list');
  if (dsVirtualList) {
    return dsVirtualList;
  }

  // 找所有可滚动的 div
  const scrollables = Array.from(document.querySelectorAll('div')).filter(div => {
    const style = window.getComputedStyle(div);
    return style.overflow === 'auto' || style.overflow === 'scroll' ||
           style.overflowY === 'auto' || style.overflowY === 'scroll';
  });

  // 排除太小的；包含输入框的也保留（DeepSeek 的消息容器包含 textarea）
  const candidates = scrollables.filter(div => {
    const rect = div.getBoundingClientRect();
    if (rect.height < 200) return false;
    if (rect.width < 300 && rect.width > 0) return false;
    return true;
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectB.height - rectA.height;
    });
    return candidates[0];
  }

  // 最后的兜底：找页面中最大的 div（排除 body/html/root）
  const allDivs = Array.from(document.querySelectorAll('div')).filter(div => {
    const rect = div.getBoundingClientRect();
    return rect.height > 300 && rect.width > 300;
  });
  if (allDivs.length > 0) {
    allDivs.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return (rectB.height * rectB.width) - (rectA.height * rectA.width);
    });
    return allDivs[0];
  }

  return null;
}

async function flushPendingMessages() {
  if (recorderState.pendingQueue.length === 0) return;

  const messages = [...recorderState.pendingQueue];
  recorderState.pendingQueue = [];

  try {
    if (!recorderState.openVikingSessionId) {
      const client = await getOvClient();
      const result = await client.createSession(recorderState.rawSessionId);
      recorderState.openVikingSessionId = result.session_id || result.id || result;
      await saveSessionMapping(recorderState.openVikingSessionId);
      console.log('EchoMem: session created', recorderState.openVikingSessionId);
    }
    const client = await getOvClient();
    await client.appendMessages(recorderState.openVikingSessionId, messages);
    console.log('EchoMem: flushed pending messages', messages.length);
  } catch (err) {
    console.warn('EchoMem: failed to flush messages, re-queuing', err);
    recorderState.pendingQueue.unshift(...messages);
    if (recorderState.pendingQueue.length > PENDING_QUEUE_MAX) {
      recorderState.pendingQueue = recorderState.pendingQueue.slice(-PENDING_QUEUE_MAX);
    }
  }
}

async function doSendMessages(messages) {
  if (!messages || messages.length === 0) return;

  messages = filterRecentlySent(messages);
  if (messages.length === 0) return;

  console.log('EchoMem diag: posting=', messages.map(m => m.role + ':' + m.text.slice(0, 30)));
  console.log('EchoMem: detected', messages.length, 'new messages');

  await flushPendingMessages();

  if (recorderState.openVikingSessionId) {
    try {
      const client = await getOvClient();
      await client.appendMessages(recorderState.openVikingSessionId, messages);
      console.log('EchoMem: appended', messages.length, 'messages');
    } catch (err) {
      console.warn('EchoMem: append failed, queueing', err);
      recorderState.pendingQueue.push(...messages);
    }
  } else {
    try {
      const client = await getOvClient();
      const result = await client.createSession(recorderState.rawSessionId);
      recorderState.openVikingSessionId = result.session_id || result.id || result;
      await saveSessionMapping(recorderState.openVikingSessionId);
      console.log('EchoMem: session created', recorderState.openVikingSessionId);
      await client.appendMessages(recorderState.openVikingSessionId, messages);
      console.log('EchoMem: appended', messages.length, 'messages');
    } catch (err) {
      console.warn('EchoMem: create session failed, queueing', err);
      recorderState.pendingQueue.push(...messages);
    }
  }
}

/**
 * 在 textarea 附近的容器中查找 DeepSeek 发送按钮
 * 不使用变量 CSS 类名，而是通过稳定的 ds-icon-button--l + role="button" + SVG path 特征定位
 */
function findDeepSeekSendButton() {
  // 先通过 SVG path 特征过滤所有候选按钮
  const isSendBtn = (btn) => {
    const path = btn.querySelector('svg path')?.getAttribute('d') || '';
    return path.startsWith('M8.3125') || path.startsWith('M2 4.88');
  };

  // 1. 优先在 textarea 附近搜索（最可靠）
  const textarea = document.querySelector('textarea');
  if (textarea) {
    const containers = [
      textarea.closest('form'),
      textarea.closest('[class*="chat"]'),
      textarea.closest('[class*="input"]'),
      textarea.parentElement?.parentElement,
      textarea.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    for (const container of containers) {
      const btns = container.querySelectorAll('.ds-icon-button--l[role="button"]');
      for (const btn of btns) {
        if (isSendBtn(btn)) return btn;
      }
    }
  }

  // 2. 附近找不到，在整个文档中搜索，取最下方的一个
  const allBtns = document.querySelectorAll('.ds-icon-button--l[role="button"]');
  const candidates = [];
  for (const btn of allBtns) {
    if (isSendBtn(btn)) {
      candidates.push({ btn, top: btn.getBoundingClientRect().top });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.top - a.top);
  return candidates[0].btn;
}

/**
 * 判断 DeepSeek 是否处于流式生成中
 * SVG path 为 M2 4.88（正方形）= 流式中；M8.3125（箭头）= 已完成
 */
function isDeepSeekStreaming() {
  const btn = findDeepSeekSendButton();
  if (!btn) return false;
  const path = btn.querySelector('svg path')?.getAttribute('d') || '';
  return path.startsWith('M2 4.88');
}

function startStreamingCheck() {
  // 清理已有的轮询，防止重复创建
  stopStreamingCheck();

  // 竞态条件防护：如果调用时按钮已经是箭头（流式已结束），直接发送，不要启动轮询
  if (!isDeepSeekStreaming()) {
    console.log('EchoMem: streaming already finished, sending immediately');
    const currentMessages = extractSessionMessages(recorderState.platformId);
    sendStreamingResult(currentMessages);
    return;
  }

  recorderState.streamingWasActive = true;

  // 超时回退：60 秒后无论按钮状态如何都强制发送
  recorderState.streamingTimeoutTimer = setTimeout(() => {
    console.log('EchoMem: streaming check timeout, forcing send');
    stopStreamingCheck();
    const currentMessages = extractSessionMessages(recorderState.platformId);
    sendStreamingResult(currentMessages);
  }, 60000);

  recorderState.assistantStableTimer = setInterval(async () => {
    const streaming = isDeepSeekStreaming();

    if (streaming) {
      recorderState.streamingWasActive = true;
      console.log('EchoMem: assistant streaming detected');
    } else if (recorderState.streamingWasActive) {
      // 之前是流式，现在按钮变回箭头 → 流式完成
      console.log('EchoMem: assistant streaming finished (button back to arrow)');
      stopStreamingCheck();
      const currentMessages = extractSessionMessages(recorderState.platformId);
      await sendStreamingResult(currentMessages);
    }
  }, STABLE_CHECK_INTERVAL_MS);
}

function stopStreamingCheck() {
  if (recorderState.assistantStableTimer) {
    clearInterval(recorderState.assistantStableTimer);
    recorderState.assistantStableTimer = null;
  }
  if (recorderState.streamingTimeoutTimer) {
    clearTimeout(recorderState.streamingTimeoutTimer);
    recorderState.streamingTimeoutTimer = null;
  }
  recorderState.streamingWasActive = false;
}

async function sendStreamingResult(currentMessages) {
  if (!recorderState.streamingSnapshot) return;

  const changes = [];
  for (let i = recorderState.streamingSnapshot.length; i < currentMessages.length; i++) {
    changes.push(currentMessages[i]);
  }

  recorderState.lastMessages = currentMessages;
  recorderState.streamingSnapshot = null;

  if (changes.length > 0) {
    await doSendMessages(changes);
  }
}

async function onMessagesChanged() {
  const newMessages = extractSessionMessages(recorderState.platformId);
  console.log('EchoMem diag: newMessages=', newMessages.map(m => m.role + ':' + m.text.slice(0, 30)));

  // === 流式状态中：assistant 正在输出，等待按钮 SVG 变回箭头 ===
  if (recorderState.streamingSnapshot) {
    const lastNew = newMessages[newMessages.length - 1];

    // 用户发送新消息 → 立即认为上一条 assistant 已完成
    if (lastNew?.role === 'user') {
      stopStreamingCheck();
      recorderState.streamingSnapshot = null;
      // 不 return，继续执行到下方正常 diff 分支
    } else {
      // 流式完成检测由 startStreamingCheck 中的按钮 SVG 状态轮询负责
      return;
    }
  }

  // === 非流式状态 ===
  const lastNew = newMessages[newMessages.length - 1];
  const lastOld = recorderState.lastMessages[recorderState.lastMessages.length - 1];

  // 新的 assistant 出现 → 进入流式状态，启动按钮 SVG 状态检测
  const isNewAssistant = lastNew?.role === 'assistant' &&
    (!lastOld || lastOld.role !== 'assistant');

  if (isNewAssistant) {
    recorderState.streamingSnapshot = [...recorderState.lastMessages];
    startStreamingCheck();
    return;
  }

  // 正常 diff（user 消息或其他非 assistant 变化）
  const added = diffMessages(newMessages, recorderState.lastMessages);
  recorderState.lastMessages = newMessages;

  if (added.length === 0) return;

  await doSendMessages(added);
}

function debouncedOnChange() {
  clearTimeout(recorderState.debounceTimer);
  recorderState.debounceTimer = setTimeout(() => {
    onMessagesChanged().catch(err => {
      console.warn('EchoMem: onMessagesChanged error', err);
    });
  }, DEBOUNCE_MS);
}

function isMeaningfulMutation(mutation) {
  if (mutation.type !== 'childList') return false;
  for (const node of mutation.addedNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      // 忽略 EchoMem 自身添加的元素
      if (node.classList?.contains('claw-echomem-launcher-bar')) continue;
      if (node.closest?.('.claw-echomem-launcher-bar')) continue;
      return true;
    }
  }
  for (const node of mutation.removedNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) return true;
  }
  return false;
}

function attachObserver(container) {
  if (recorderState.observer) {
    recorderState.observer.disconnect();
  }

  recorderState.observer = new MutationObserver((mutations) => {
    const hasMeaningfulChange = mutations.some(isMeaningfulMutation);
    if (!hasMeaningfulChange) return;
    debouncedOnChange();
  });

  recorderState.observer.observe(container, {
    childList: true,
    subtree: true,
  });

  console.log('EchoMem: MutationObserver attached to message container');

  // 初始提取一次现有消息
  const currentMessages = extractSessionMessages(recorderState.platformId);

  if (recorderState.openVikingSessionId) {
    // 恢复的会话：设基线，避免重复发送
    recorderState.lastMessages = currentMessages;
    console.log('EchoMem: restored session baseline, skipping', currentMessages.length, 'existing messages');
  } else {
    // 全新会话：设空基线，然后主动发送现有消息
    recorderState.lastMessages = [];
    console.log('EchoMem: new session, will send', currentMessages.length, 'existing messages');
    if (currentMessages.length > 0) {
      // 直接触发一次消息处理，把已有消息全部发过去
      onMessagesChanged().catch(err => {
        console.warn('EchoMem: initial message send failed', err);
      });
    }
  }
}

export async function startRecording(platformId) {
  if (!shouldRecord(platformId)) {
    return;
  }

  const newRawSessionId = extractSessionId(platformId);

  // 没有 session ID（如首页），如果在录制则停止
  if (!newRawSessionId) {
    if (recorderState.isRecording) {
      stopRecording();
    }
    return;
  }

  // 1. 如果 session ID 变了，需要重置
  if (recorderState.isRecording && recorderState.rawSessionId !== newRawSessionId) {
    console.log('EchoMem: session id changed', recorderState.rawSessionId, '->', newRawSessionId, ', resetting recorder');
    if (recorderState.observer) {
      recorderState.observer.disconnect();
      recorderState.observer = null;
    }
    clearTimeout(recorderState.debounceTimer);
    recorderState.debounceTimer = null;
    stopStreamingCheck();
    recorderState.rawSessionId = newRawSessionId;
    recorderState.openVikingSessionId = null;
    recorderState.lastMessages = [];
    recorderState.pendingQueue = [];
    recorderState.streamingSnapshot = null;
  }

  // 2. 首次启动
  if (!recorderState.isRecording) {
    recorderState.platformId = platformId;
    recorderState.rawSessionId = newRawSessionId;
    recorderState.isRecording = true;
    console.log('EchoMem: start recording for', platformId, 'session', newRawSessionId);

    // 尝试恢复已有的 session 映射
    const savedSessionId = await loadSessionMapping();
    if (savedSessionId) {
      recorderState.openVikingSessionId = savedSessionId;
      console.log('EchoMem: restored session mapping', savedSessionId);
    }
  }

  // 3. 如果 observer 未 attach（首次或 session 切换后），尝试 attach
  if (!recorderState.observer) {
    const container = findMessageContainer(platformId);
    if (container) {
      attachObserver(container);
    }
    // 没找到容器也不报错，等待下次 DOM 变化时再尝试
  }
}

export function stopRecording() {
  if (recorderState.observer) {
    recorderState.observer.disconnect();
    recorderState.observer = null;
  }
  clearTimeout(recorderState.debounceTimer);
  recorderState.debounceTimer = null;
  stopStreamingCheck();
  recorderState.isRecording = false;
  recorderState.rawSessionId = null;
  recorderState.openVikingSessionId = null;
  recorderState.lastMessages = [];
  recorderState.pendingQueue = [];
  recorderState.streamingSnapshot = null;
  sentSignatures.clear();
  console.log('EchoMem: recording stopped');
}

export function getRecordingState() {
  return {
    platformId: recorderState.platformId,
    rawSessionId: recorderState.rawSessionId,
    openVikingSessionId: recorderState.openVikingSessionId,
    isRecording: recorderState.isRecording,
    pendingCount: recorderState.pendingQueue.length,
  };
}

/**
 * 提交当前会话（触发记忆提取）
 * ⚠️ 当前不自动调用，仅预留口子
 */
export async function commitCurrentSession() {
  if (!recorderState.openVikingSessionId) {
    console.log('EchoMem: no session to commit');
    return;
  }
  try {
    const client = await getOvClient();
    await client.commitSession(recorderState.openVikingSessionId);
    console.log('EchoMem: session committed', recorderState.openVikingSessionId);
  } catch (err) {
    console.warn('EchoMem: session commit failed', err);
  }
}

export function resetRecorder() {
  stopRecording();
  recorderState.platformId = null;
  recorderState.rawSessionId = null;
  recorderState.openVikingSessionId = null;
  recorderState.lastMessages = [];
  recorderState.pendingQueue = [];
  recorderState.ovClient = null;
  recorderState.streamingSnapshot = null;
  recorderState.streamingWasActive = false;
}
