// 配置管理 — 记忆后端引擎连接配置持久化

const DEFAULT_ECHOMEM_CONFIG = {
  baseUrl: 'http://127.0.0.1:8010',
  authKey: '',
  agentId: '',
};

const DEFAULT_COMPLETION_CONFIG = {
  phraseScoreThreshold: 0.2,
};

const DEFAULT_AGENT_ID = 'echoagent';

const PLATFORM_AGENT_IDS = {
  higo: 'echoagent',
  deepseek: 'echoagent',
};

export async function getEchoMemConfig() {
  try {
    const result = await chrome.storage.local.get('echomemConfig');
    return { ...DEFAULT_ECHOMEM_CONFIG, ...(result.echomemConfig || {}) };
  } catch {
    return { ...DEFAULT_ECHOMEM_CONFIG };
  }
}

export async function setEchoMemConfig(config) {
  await chrome.storage.local.set({ echomemConfig: config });
}

export function getAgentIdForPlatform(platformId) {
  const platformAgentId = PLATFORM_AGENT_IDS[platformId];
  if (platformAgentId) return platformAgentId;
  return DEFAULT_AGENT_ID;
}

export async function getConfiguredAgentId(platformId) {
  try {
    const result = await chrome.storage.local.get('echomemConfig');
    const cfg = result.echomemConfig || {};
    if (cfg.agentId) return cfg.agentId;
  } catch {
    // ignore
  }
  return getAgentIdForPlatform(platformId);
}

export async function getCompletionConfig() {
  try {
    const result = await chrome.storage.local.get('completionConfig');
    return { ...DEFAULT_COMPLETION_CONFIG, ...(result.completionConfig || {}) };
  } catch {
    return { ...DEFAULT_COMPLETION_CONFIG };
  }
}

export async function setCompletionConfig(config) {
  await chrome.storage.local.set({ completionConfig: config });
}
