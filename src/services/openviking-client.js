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

  _buildHeaders() {
    const headers = this._buildAuthHeaders();
    headers['Content-Type'] = 'application/json';
    return headers;
  }

  _buildAuthHeaders() {
    const headers = {};
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
    return headers;
  }

  async find(query, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = this._buildHeaders();

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
    const headers = this._buildAuthHeaders();
    const response = await fetch(`${this.cfg.baseUrl}/health`, {
      method: 'GET',
      headers,
    });
    return response.ok;
  }

  async createSession(sessionId = null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = this._buildHeaders();

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
      const headers = this._buildHeaders();

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
      const headers = this._buildHeaders();

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

  // ── Resource Management ──

  async tempUpload(file) {
    const controller = new AbortController();
    const uploadTimeoutMs = this.cfg.uploadTimeoutMs || 120000;
    const timer = setTimeout(() => controller.abort(), uploadTimeoutMs);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('telemetry', 'false');

      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/resources/temp_upload`, {
        method: 'POST',
        headers,
        body: formData,
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

  async addResource(options = {}) {
    const controller = new AbortController();
    const resourceTimeoutMs = this.cfg.resourceTimeoutMs || 300000;
    const timer = setTimeout(() => controller.abort(), resourceTimeoutMs);

    try {
      const headers = this._buildHeaders();
      const response = await fetch(`${this.cfg.baseUrl}/api/v1/resources`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          path: options.path || undefined,
          temp_file_id: options.tempFileId || undefined,
          to: options.to || undefined,
          parent: options.parent || undefined,
          reason: options.reason || 'EchoMem extension upload',
          instruction: options.instruction || '',
          wait: options.wait ?? true,
          timeout: options.timeout || undefined,
          strict: options.strict ?? false,
          source_name: options.sourceName || undefined,
          keep_original: options.keepOriginal ?? false,
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

  async addSkill(options = {}) {
    const controller = new AbortController();
    const resourceTimeoutMs = this.cfg.resourceTimeoutMs || 300000;
    const timer = setTimeout(() => controller.abort(), resourceTimeoutMs);

    try {
      const headers = this._buildHeaders();
      const response = await fetch(`${this.cfg.baseUrl}/api/v1/skills`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: options.data || undefined,
          temp_file_id: options.tempFileId || undefined,
          wait: options.wait ?? false,
          timeout: options.timeout || undefined,
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

  // ── Filesystem ──

  async fsLs(uri, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const params = new URLSearchParams({ uri });
      if (options.simple) params.set('simple', 'true');
      if (options.recursive) params.set('recursive', 'true');
      if (options.output) params.set('output', options.output);
      if (options.absLimit) params.set('abs_limit', String(options.absLimit));
      if (options.showAllHidden) params.set('show_all_hidden', 'true');
      if (options.nodeLimit) params.set('node_limit', String(options.nodeLimit));

      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/fs/ls?${params.toString()}`, {
        method: 'GET',
        headers,
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

  async fsStat(uri) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const params = new URLSearchParams({ uri });
      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/fs/stat?${params.toString()}`, {
        method: 'GET',
        headers,
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

  async fsMkdir(uri, description = '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const headers = this._buildHeaders();
      const response = await fetch(`${this.cfg.baseUrl}/api/v1/fs/mkdir`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ uri, description }),
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

  async fsRm(uri, recursive = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const params = new URLSearchParams({ uri });
      if (recursive) params.set('recursive', 'true');
      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/fs?${params.toString()}`, {
        method: 'DELETE',
        headers,
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

  // ── Content ──

  async contentRead(uri, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const params = new URLSearchParams({ uri });
      if (options.offset !== undefined) params.set('offset', String(options.offset));
      if (options.limit !== undefined) params.set('limit', String(options.limit));
      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/content/read?${params.toString()}`, {
        method: 'GET',
        headers,
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

  async contentOverview(uri) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const params = new URLSearchParams({ uri });
      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/content/overview?${params.toString()}`, {
        method: 'GET',
        headers,
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

  async contentAbstract(uri) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const params = new URLSearchParams({ uri });
      const headers = this._buildAuthHeaders();

      const response = await fetch(`${this.cfg.baseUrl}/api/v1/content/abstract?${params.toString()}`, {
        method: 'GET',
        headers,
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
