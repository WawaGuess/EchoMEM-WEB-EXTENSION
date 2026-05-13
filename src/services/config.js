// 配置管理 — OpenViking 连接配置持久化

const DEFAULT_OPENVIKING_CONFIG = {
  baseUrl: 'http://127.0.0.1:1933',
  apiKey: '',
  agentId: 'echomem-extension',
  authEnabled: false,
  accountId: 'default',
  userId: 'default',
};

const DEFAULT_COMPLETION_CONFIG = {
  phraseScoreThreshold: 0.2,
};

export async function getOpenVikingConfig() {
  try {
    const result = await chrome.storage.local.get('openvikingConfig');
    return { ...DEFAULT_OPENVIKING_CONFIG, ...(result.openvikingConfig || {}) };
  } catch {
    return { ...DEFAULT_OPENVIKING_CONFIG };
  }
}

export async function setOpenVikingConfig(config) {
  await chrome.storage.local.set({ openvikingConfig: config });
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
