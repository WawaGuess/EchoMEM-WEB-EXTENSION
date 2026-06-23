// EchoMem HTTP 客户端 — 封装 EchoMem 后端 API
// 文档：docs/flows/backend-migration/实施计划.md
//
// 所有请求通过 background.js 代理发送，避免内容脚本受页面 CORS 策略限制。

const DEFAULT_CONFIG = {
  baseUrl: 'http://127.0.0.1:8010',
  authKey: '',
  timeoutMs: 5000,
  debug: true,
};

function log(prefix, ...args) {
  console.log(`EchoMem client [${prefix}]`, ...args);
}

function fetchViaBackground(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'echoMemRequest',
        url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        timeout: options.timeout,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.success) {
          reject(new Error(response?.error || (response?.status ? `HTTP ${response.status}` : 'Unknown background error')));
          return;
        }
        resolve(response.data);
      }
    );
  });
}

class EchoMemClient {
  constructor(config = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  _buildHeaders(contentType = false) {
    const headers = {};
    if (this.cfg.authKey) {
      headers['X-Auth-Key'] = this.cfg.authKey;
    }
    if (contentType) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  async _fetchJson(url, options = {}) {
    const data = await fetchViaBackground(url, {
      ...options,
      timeout: this.cfg.timeoutMs,
    });

    if (data && data.status === 'error') {
      throw new Error(data.message || data.error?.message || 'EchoMem error');
    }

    return data.result !== undefined ? data.result : data;
  }

  async healthCheck() {
    try {
      const data = await fetchViaBackground(`${this.cfg.baseUrl}/health`, {
        method: 'GET',
        timeout: this.cfg.timeoutMs,
      });
      if (this.cfg.debug) {
        log('health', 'ok', data);
      }
      return true;
    } catch (err) {
      if (this.cfg.debug) {
        log('health', 'failed', err.message);
      }
      throw err;
    }
  }

  async find(query, options = {}) {
    const body = {
      query,
      agent_id: options.agentId,
      limit: options.limit || 5,
      include_explain: options.includeExplain || false,
    };
    // session_id 可选，用于限制召回范围
    if (options.sessionId) body.session_id = options.sessionId;

    if (this.cfg.debug) {
      log('find request', JSON.stringify(body));
    }

    const result = await this._fetchJson(`${this.cfg.baseUrl}/api/retrieval/search`, {
      method: 'POST',
      headers: this._buildHeaders(true),
      body: JSON.stringify(body),
    });

    if (this.cfg.debug) {
      const items = result?.items || [];
      log(
        'find response',
        `items=${items.length}`,
        items[0] ? JSON.stringify(items[0]) : 'empty',
        result?.explain ? `explain=${JSON.stringify(result.explain)}` : 'no explain'
      );
    }

    return result;
  }

  async openSession(options = {}) {
    const body = {
      agent_id: options.agentId,
    };
    if (options.sessionId) body.session_id = options.sessionId;
    if (options.runId) body.run_id = options.runId;
    if (options.metadata) body.metadata = options.metadata;

    if (this.cfg.debug) {
      log('openSession request', JSON.stringify(body));
    }

    const result = await this._fetchJson(`${this.cfg.baseUrl}/api/sessions/open`, {
      method: 'POST',
      headers: this._buildHeaders(true),
      body: JSON.stringify(body),
    });

    // EchoMem 返回 { scope: { session_id } }，统一暴露为顶层 session_id
    const normalized = {
      ...result,
      session_id: result.scope?.session_id || result.session_id || result.id,
    };

    if (this.cfg.debug) {
      log('openSession response', `raw=${JSON.stringify(result)}`, `normalized session_id=${normalized.session_id}`);
    }

    return normalized;
  }

  async addMessage(sessionId, message) {
    const body = {
      role: message.role,
      content: message.text,
    };

    if (this.cfg.debug) {
      log('addMessage request', `session=${sessionId}`, JSON.stringify(body));
    }

    const result = await this._fetchJson(
      `${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        headers: this._buildHeaders(true),
        body: JSON.stringify(body),
      }
    );

    if (this.cfg.debug) {
      log('addMessage response', `session=${sessionId}`, `message.id=${result?.message?.id || result?.id || 'unknown'}`);
    }

    return result;
  }

  async appendMessages(sessionId, messages) {
    if (this.cfg.debug) {
      log('appendMessages', `session=${sessionId}`, `count=${messages.length}`);
    }
    const results = [];
    for (const msg of messages) {
      const result = await this.addMessage(sessionId, msg);
      results.push(result);
    }
    return results;
  }

  async commitSession(sessionId) {
    if (this.cfg.debug) {
      log('commitSession request', `session=${sessionId}`);
    }

    const result = await this._fetchJson(
      `${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/commit`,
      {
        method: 'POST',
        headers: this._buildHeaders(true),
        body: JSON.stringify({}),
      }
    );

    if (this.cfg.debug) {
      log('commitSession response', `session=${sessionId}`, `commit_id=${result?.commit_id}`, `archive_id=${result?.archive_id}`, `status=${result?.status}`);
    }

    return result;
  }

  // ── Resource Management ──

  async addResource(options = {}) {
    const body = {
      content: options.content,
      name: options.name,
      content_type: options.contentType,
      tags: options.tags,
      metadata: options.metadata,
    };
    Object.keys(body).forEach((key) => {
      if (body[key] === undefined) delete body[key];
    });

    if (this.cfg.debug) {
      const preview = body.content
        ? `${String(body.content).slice(0, 100)}...(${String(body.content).length} chars)`
        : 'empty';
      log('addResource request', JSON.stringify({ ...body, content: preview }));
    }

    const result = await this._fetchJson(`${this.cfg.baseUrl}/api/resources`, {
      method: 'POST',
      headers: this._buildHeaders(true),
      body: JSON.stringify(body),
    });

    if (this.cfg.debug) {
      log('addResource response', `resource_id=${result?.resource_id}`, `uri=${result?.uri}`);
    }

    return result;
  }

  async deleteResource(resourceId) {
    if (!resourceId) throw new Error('resourceId is required');
    const url = `${this.cfg.baseUrl}/api/resources/${encodeURIComponent(resourceId)}`;

    if (this.cfg.debug) {
      log('deleteResource request', resourceId);
    }

    const result = await this._fetchJson(url, {
      method: 'DELETE',
      headers: this._buildHeaders(false),
    });

    if (this.cfg.debug) {
      log('deleteResource response', result);
    }

    return result;
  }

  // ── Skill Management ──

  async addSkill(options = {}) {
    const body = {
      data: options.data,
      name: options.name,
      description: options.description,
      tags: options.tags,
      allowed_tools: options.allowedTools,
    };
    Object.keys(body).forEach((key) => {
      if (body[key] === undefined) delete body[key];
    });

    if (this.cfg.debug) {
      log('addSkill request', options.name, JSON.stringify({ ...body, data: undefined }));
    }

    const result = await this._fetchJson(`${this.cfg.baseUrl}/api/skills`, {
      method: 'POST',
      headers: this._buildHeaders(true),
      body: JSON.stringify(body),
    });

    if (this.cfg.debug) {
      log('addSkill response', `name=${result?.name}`, `uri=${result?.uri}`);
    }

    return result;
  }

  async deleteSkill(name) {
    if (!name) throw new Error('name is required');
    const url = `${this.cfg.baseUrl}/api/skills/${encodeURIComponent(name)}`;

    if (this.cfg.debug) {
      log('deleteSkill request', name);
    }

    const result = await this._fetchJson(url, {
      method: 'DELETE',
      headers: this._buildHeaders(false),
    });

    if (this.cfg.debug) {
      log('deleteSkill response', result);
    }

    return result;
  }

  // ── Filesystem ──

  async fsLs(uri, options = {}) {
    const params = new URLSearchParams({ uri });
    if (options.simple) params.set('simple', 'true');
    if (options.recursive) params.set('recursive', 'true');
    if (options.output) params.set('output', options.output);
    if (options.absLimit) params.set('abs_limit', String(options.absLimit));
    if (options.showAllHidden) params.set('show_all_hidden', 'true');
    if (options.nodeLimit) params.set('node_limit', String(options.nodeLimit));

    if (this.cfg.debug) {
      log('fsLs request', uri, JSON.stringify(options));
    }

    const result = await this._fetchJson(`${this.cfg.baseUrl}/fs/ls?${params.toString()}`, {
      method: 'GET',
      headers: this._buildHeaders(false),
    });

    if (this.cfg.debug) {
      const entries = Array.isArray(result) ? result : (result?.entries || []);
      log('fsLs response', `entries=${entries.length}`);
    }

    return result;
  }

  async fsRead(uri, options = {}) {
    const params = new URLSearchParams({ uri });
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    if (options.limit !== undefined) params.set('limit', String(options.limit));

    if (this.cfg.debug) {
      log('fsRead request', uri);
    }

    const result = await this._fetchJson(`${this.cfg.baseUrl}/fs/read?${params.toString()}`, {
      method: 'GET',
      headers: this._buildHeaders(false),
    });

    if (this.cfg.debug) {
      const preview = typeof result === 'string'
        ? `${result.slice(0, 80)}...`
        : JSON.stringify(result).slice(0, 80);
      log('fsRead response', preview);
    }

    // 后端返回 { text: '...' }，也可能直接返回字符串或 { content: '...' }
    if (typeof result === 'string') return result;
    return result?.content ?? result?.text ?? '';
  }

  // ── Usage / Token Statistics (stub for Phase 2) ──

  async fetchUsage() {
    if (this.cfg.debug) {
      log('fetchUsage', 'stub');
    }
    // Phase 3 will implement the real EchoMem usage endpoint.
    return { total: { total_tokens: 0 } };
  }
}

export function createClient(config) {
  return new EchoMemClient(config);
}
