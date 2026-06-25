// OpenView 后端认证与统计客户端
// 用于从 OpenView agent 拉取用户会话 Token 统计

const AUTH_STORAGE_KEY = 'openviewAuth';

function normalizeBaseUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return 'http://127.0.0.1:31020';
  return trimmed.replace(/\/$/, '');
}

function resolveUrl(baseUrl, path) {
  const normalized = normalizeBaseUrl(baseUrl);
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${normalized}${safePath}`;
}

async function parseResponse(response) {
  const text = await response.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  // OpenView 使用统一响应包装：{ code: 0, data: ... }
  const payload = data && typeof data.code === 'number' && 'data' in data ? data.data : data;

  return { ok: response.ok, status: response.status, payload, text };
}

function fetchViaBackground(url, options = {}) {
  // Service Worker 内部不能通过 chrome.runtime.sendMessage 给自己发消息，
  // 因此直接在 background 里发起 fetch。
  const isServiceWorker =
    typeof window === 'undefined' &&
    typeof self !== 'undefined' &&
    typeof ServiceWorkerGlobalScope !== 'undefined' &&
    self instanceof ServiceWorkerGlobalScope;

  if (isServiceWorker) {
    return fetch(url, options)
      .then(async (response) => {
        const text = await response.text().catch(() => '');
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
        if (!response.ok) {
          return {
            success: false,
            status: response.status,
            error: data.message || data.error?.message || `HTTP ${response.status}`,
            data,
            text,
          };
        }
        return { success: true, status: response.status, data, text };
      })
      .catch((err) => ({ success: false, error: err.message }));
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'openViewRequest',
        url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      }
    );
  });
}

async function request(baseUrl, path, options = {}) {
  const url = resolveUrl(baseUrl, path);
  const response = await fetchViaBackground(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response || !response.success) {
    const message =
      response?.error ||
      `HTTP ${response?.status || 'unknown'}`;
    const error = new Error(message);
    error.status = response?.status;
    error.payload = response?.data;
    throw error;
  }

  const parsed = await parseResponse({
    ok: response.success,
    status: response.status,
    text: async () => response.text || '',
  });

  return parsed.payload;
}

export async function getOpenViewAuth() {
  try {
    const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    return result[AUTH_STORAGE_KEY] || null;
  } catch {
    return null;
  }
}

export async function setOpenViewAuth(auth) {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
}

export async function clearOpenViewAuth() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

export async function login({ baseUrl, username, password }) {
  const payload = await request(baseUrl, '/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (!payload.accessToken || !payload.refreshToken) {
    throw new Error('登录响应中缺少 token');
  }

  const auth = {
    baseUrl: normalizeBaseUrl(baseUrl),
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user || null,
    loggedInAt: Date.now(),
  };
  await setOpenViewAuth(auth);
  return auth;
}

export async function refreshToken({ baseUrl, refreshToken }) {
  const payload = await request(baseUrl, '/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  if (!payload.accessToken || !payload.refreshToken) {
    throw new Error('刷新 token 响应中缺少 token');
  }

  const auth = {
    baseUrl: normalizeBaseUrl(baseUrl),
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user || null,
    loggedInAt: Date.now(),
  };
  await setOpenViewAuth(auth);
  return auth;
}

export async function fetchStatsSummary({ baseUrl, accessToken }) {
  return request(baseUrl, '/v1/stats/summary', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
