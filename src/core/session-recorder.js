// 会话自动记录器 —— 监听聊天消息变化并同步到 OpenViking
//
// 本模块只负责"编排"：
//   - MutationObserver 挂载与防抖
//   - 消息 diff（前缀/后缀/签名）
//   - 流式开始 / 完成的状态切换
//   - 失败重试队列与已发签名缓存
//
// 所有平台差异（如何找按钮、SVG 路径、容器智能查找、文本噪音等）都委托给 adapter，
// 或通过 platforms.json 配置驱动。本文件**不应**出现任何平台字面量。

import { extractSessionMessages } from './session-extractor.js';
import { createClient } from '../services/openviking-client.js';
import { getOpenVikingConfig } from '../services/config.js';
import { extractSessionId } from '../services/session-mapper.js';
import { PLATFORM_CONFIGS, shouldRecord } from '../config/loader.js';
import { getAdapter } from '../adapters/registry.js';

const recorderState = {
  platformId: null,
  config: null,
  adapter: null,
  rawSessionId: null,
  openVikingSessionId: null,
  lastMessages: [],
  pendingQueue: [],
  observer: null,
  debounceTimer: null,
  isRecording: false,
  ovClient: null,
  streamingDetector: null,
  streamingSnapshot: null,
};

const PENDING_QUEUE_MAX = 100;
const DEBOUNCE_MS = 500;
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
  return messages.filter((m) => {
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

  // 1. 前缀匹配 —— 正常追加消息
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
    const oldSignatures = new Set(oldMessages.map((m) => `${m.role}:${m.text}`));
    const uniqueAdded = added.filter((m) => !oldSignatures.has(`${m.role}:${m.text}`));
    if (uniqueAdded.length !== added.length) {
      console.log('EchoMem diag: prefix diff dropped duplicates', added.length - uniqueAdded.length);
    }
    return uniqueAdded;
  }

  // 2. 后缀匹配 —— 虚拟列表卸载了前面的消息时，
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
      const oldSignatures = new Set(oldMessages.map((m) => `${m.role}:${m.text}`));
      const uniqueAdded = added.filter((m) => !oldSignatures.has(`${m.role}:${m.text}`));
      if (uniqueAdded.length !== added.length) {
        console.log('EchoMem diag: suffix diff dropped duplicates', added.length - uniqueAdded.length);
      }
      return uniqueAdded;
    }
  }

  // 3. 完全无法对齐，保险起见返回全部
  const added = newMessages;

  // 4. 最终防护：丢弃 added 中已经在 oldMessages 里出现过的消息
  const oldSignatures = new Set(oldMessages.map((m) => `${m.role}:${m.text}`));
  const uniqueAdded = added.filter((m) => !oldSignatures.has(`${m.role}:${m.text}`));

  if (uniqueAdded.length !== added.length) {
    console.log('EchoMem diag: diff dropped duplicates', added.length - uniqueAdded.length);
  }

  return uniqueAdded;
}

function findMessageContainer() {
  const { adapter, config } = recorderState;
  if (!adapter || !config) return null;
  const el = adapter.findMessageContainer(config);
  if (el) {
    console.log('EchoMem: message container found via adapter');
    return el;
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

  console.log('EchoMem diag: posting=', messages.map((m) => m.role + ':' + m.text.slice(0, 30)));
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

function disposeStreamingDetector() {
  if (recorderState.streamingDetector) {
    try {
      recorderState.streamingDetector.stop();
    } catch (err) {
      console.warn('EchoMem: streaming detector stop threw', err);
    }
    recorderState.streamingDetector = null;
  }
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

function startStreamingDetection() {
  disposeStreamingDetector();
  const detector = recorderState.adapter?.createStreamingDetector?.(recorderState.config);
  if (!detector) {
    // 无流式检测策略：立即把当前消息当作完成态处理
    const currentMessages = extractSessionMessages(recorderState.platformId);
    sendStreamingResult(currentMessages).catch((err) => {
      console.warn('EchoMem: immediate streaming send failed', err);
    });
    return;
  }
  recorderState.streamingDetector = detector;
  detector.start(() => {
    recorderState.streamingDetector = null;
    const currentMessages = extractSessionMessages(recorderState.platformId);
    sendStreamingResult(currentMessages).catch((err) => {
      console.warn('EchoMem: streaming send failed', err);
    });
  });
}

async function onMessagesChanged() {
  const newMessages = extractSessionMessages(recorderState.platformId);
  console.log('EchoMem diag: newMessages=', newMessages.map((m) => m.role + ':' + m.text.slice(0, 30)));

  // === 流式中：等待检测器回调 ===
  if (recorderState.streamingSnapshot) {
    const lastNew = newMessages[newMessages.length - 1];
    // 用户发送了新消息 → 立刻视为上一条 assistant 已完成
    if (lastNew?.role === 'user') {
      disposeStreamingDetector();
      recorderState.streamingSnapshot = null;
      // 不 return，继续走下方的 diff 分支
    } else {
      // 仍在流式，由 detector 内部决定何时回调
      return;
    }
  }

  // === 非流式状态 ===
  const lastNew = newMessages[newMessages.length - 1];
  const lastOld = recorderState.lastMessages[recorderState.lastMessages.length - 1];

  // 新出现一条 assistant 消息 → 启动流式检测
  const isNewAssistant =
    lastNew?.role === 'assistant' && (!lastOld || lastOld.role !== 'assistant');

  if (isNewAssistant) {
    recorderState.streamingSnapshot = [...recorderState.lastMessages];
    startStreamingDetection();
    return;
  }

  // 正常 diff
  const added = diffMessages(newMessages, recorderState.lastMessages);
  recorderState.lastMessages = newMessages;

  if (added.length === 0) return;

  await doSendMessages(added);
}

function debouncedOnChange() {
  clearTimeout(recorderState.debounceTimer);
  recorderState.debounceTimer = setTimeout(() => {
    onMessagesChanged().catch((err) => {
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
    console.log(
      'EchoMem: restored session baseline, skipping',
      currentMessages.length,
      'existing messages'
    );
  } else {
    // 全新会话：设空基线，然后主动发送现有消息
    recorderState.lastMessages = [];
    console.log('EchoMem: new session, will send', currentMessages.length, 'existing messages');
    if (currentMessages.length > 0) {
      onMessagesChanged().catch((err) => {
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
    console.log(
      'EchoMem: session id changed',
      recorderState.rawSessionId,
      '->',
      newRawSessionId,
      ', resetting recorder'
    );
    if (recorderState.observer) {
      recorderState.observer.disconnect();
      recorderState.observer = null;
    }
    clearTimeout(recorderState.debounceTimer);
    recorderState.debounceTimer = null;
    disposeStreamingDetector();
    recorderState.rawSessionId = newRawSessionId;
    recorderState.openVikingSessionId = null;
    recorderState.lastMessages = [];
    recorderState.pendingQueue = [];
    recorderState.streamingSnapshot = null;
  }

  // 2. 首次启动
  if (!recorderState.isRecording) {
    recorderState.platformId = platformId;
    recorderState.config = PLATFORM_CONFIGS[platformId] || null;
    recorderState.adapter = getAdapter(platformId);
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
    const container = findMessageContainer();
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
  disposeStreamingDetector();
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
 * 当前不自动调用，仅预留口子
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
  recorderState.config = null;
  recorderState.adapter = null;
  recorderState.rawSessionId = null;
  recorderState.openVikingSessionId = null;
  recorderState.lastMessages = [];
  recorderState.pendingQueue = [];
  recorderState.ovClient = null;
  recorderState.streamingSnapshot = null;
}
