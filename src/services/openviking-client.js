// OpenViking HTTP 客户端 — 配置驱动，Content Script 直接调用

const DEFAULT_CONFIG = {
  baseUrl: 'http://127.0.0.1:1933',
  apiKey: '',
  agentId: 'echomem-extension',
  authEnabled: false,
  accountId: 'default',
  userId: 'default',
  timeoutMs: 5000,
};

class OpenVikingClient {
  constructor(config = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  async find(query, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = { 'Content-Type': 'application/json' };

      if (this.cfg.agentId) {
        headers['X-OpenViking-Agent'] = this.cfg.agentId;
      }
      if (this.cfg.authEnabled) {
        if (this.cfg.apiKey) {
          headers['X-API-Key'] = this.cfg.apiKey;
        }
        if (this.cfg.accountId) {
          headers['X-OpenViking-Account'] = this.cfg.accountId;
        }
        if (this.cfg.userId) {
          headers['X-OpenViking-User'] = this.cfg.userId;
        }
      }

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/search/find`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          target_uri: options.targetUri || 'viking://user/memories',
          limit: options.limit || 5,
          score_threshold: options.scoreThreshold || 0,
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status === 'error') {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data.result || data;
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck() {
    const response = await fetch(`${this.cfg.baseUrl}/health`, {
      method: 'GET',
    });
    return response.ok;
  }

  async createSession(sessionId = null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = { 'Content-Type': 'application/json' };

      if (this.cfg.agentId) {
        headers['X-OpenViking-Agent'] = this.cfg.agentId;
      }
      if (this.cfg.authEnabled) {
        if (this.cfg.apiKey) {
          headers['X-API-Key'] = this.cfg.apiKey;
        }
        if (this.cfg.accountId) {
          headers['X-OpenViking-Account'] = this.cfg.accountId;
        }
        if (this.cfg.userId) {
          headers['X-OpenViking-User'] = this.cfg.userId;
        }
      }

      const body = {};
      if (sessionId) {
        body.session_id = sessionId;
      }

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status === 'error') {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data.result || data;
    } finally {
      clearTimeout(timer);
    }
  }

  async addMessage(sessionId, message) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = { 'Content-Type': 'application/json' };

      if (this.cfg.agentId) {
        headers['X-OpenViking-Agent'] = this.cfg.agentId;
      }
      if (this.cfg.authEnabled) {
        if (this.cfg.apiKey) {
          headers['X-API-Key'] = this.cfg.apiKey;
        }
        if (this.cfg.accountId) {
          headers['X-OpenViking-Account'] = this.cfg.accountId;
        }
        if (this.cfg.userId) {
          headers['X-OpenViking-User'] = this.cfg.userId;
        }
      }

      const response = await fetch(
        `${this.cfg.baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            role: message.role,
            content: message.text,
          }),
          signal: controller.signal,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status === 'error') {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data.result || data;
    } finally {
      clearTimeout(timer);
    }
  }

  async appendMessages(sessionId, messages) {
    const results = [];
    for (const msg of messages) {
      const result = await this.addMessage(sessionId, msg);
      results.push(result);
    }
    return results;
  }

  async commitSession(sessionId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = { 'Content-Type': 'application/json' };

      if (this.cfg.agentId) {
        headers['X-OpenViking-Agent'] = this.cfg.agentId;
      }
      if (this.cfg.authEnabled) {
        if (this.cfg.apiKey) {
          headers['X-API-Key'] = this.cfg.apiKey;
        }
        if (this.cfg.accountId) {
          headers['X-OpenViking-Account'] = this.cfg.accountId;
        }
        if (this.cfg.userId) {
          headers['X-OpenViking-User'] = this.cfg.userId;
        }
      }

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/commit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ wait: true }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status === 'error') {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data.result || data;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createClient(config) {
  return new OpenVikingClient(config);
}
