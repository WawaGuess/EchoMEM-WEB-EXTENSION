// EchoAgent 认证客户端

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

function resolveLoginPath(baseUrl) {
  try {
    const { hostname } = new URL(normalizeBaseUrl(baseUrl));
    const isLoopback = hostname === '127.0.0.1'
      || hostname === 'localhost'
      || hostname === '[::1]';
    return isLoopback ? '/v1/auth/login' : '/api/auth/login';
  } catch {
    return '/api/auth/login';
  }
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
        credentials: options.credentials,
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

export async function login(
  { baseUrl, username, password },
  { shouldPersistAuth = () => true } = {}
) {
  const payload = await request(baseUrl, resolveLoginPath(baseUrl), {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  if (!payload || !payload.user || typeof payload.csrfToken !== 'string') {
    throw new Error('登录响应中缺少用户或 CSRF 会话信息');
  }

  const auth = {
    baseUrl: normalizeBaseUrl(baseUrl),
    csrfToken: payload.csrfToken,
    user: payload.user,
    loggedInAt: Date.now(),
  };
  if (shouldPersistAuth()) {
    await setOpenViewAuth(auth);
  }
  return auth;
}
