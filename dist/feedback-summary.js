(() => {
  // src/services/echomem-client.js
  var DEFAULT_CONFIG = {
    baseUrl: "http://127.0.0.1:8010",
    authKey: "",
    timeoutMs: 5e3,
    debug: true
  };
  function log(prefix, ...args) {
    console.log(`EchoMem client [${prefix}]`, ...args);
  }
  function fetchViaBackground(url, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "echoMemRequest",
          url,
          method: options.method || "GET",
          headers: options.headers,
          body: options.body,
          timeout: options.timeout
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response || !response.success) {
            const error = new Error((response == null ? void 0 : response.error) || ((response == null ? void 0 : response.status) ? `HTTP ${response.status}` : "Unknown background error"));
            error.status = response == null ? void 0 : response.status;
            error.payload = response == null ? void 0 : response.data;
            reject(error);
            return;
          }
          resolve(response);
        }
      );
    });
  }
  var EchoMemClient = class {
    constructor(config = {}) {
      this.cfg = { ...DEFAULT_CONFIG, ...config };
    }
    _buildHeaders(contentType = false) {
      const headers = {};
      if (this.cfg.authKey) {
        headers["X-Auth-Key"] = this.cfg.authKey;
      }
      if (contentType) {
        headers["Content-Type"] = "application/json";
      }
      return headers;
    }
    async _fetchJson(url, options = {}) {
      var _a;
      const response = await fetchViaBackground(url, {
        ...options,
        timeout: this.cfg.timeoutMs
      });
      const data = response.data ?? response.text;
      if (data && data.status === "error") {
        const error = new Error(data.message || ((_a = data.error) == null ? void 0 : _a.message) || "EchoMem error");
        error.status = response.status;
        error.payload = data;
        throw error;
      }
      return data.result !== void 0 ? data.result : data;
    }
    async healthCheck() {
      try {
        const response = await fetchViaBackground(`${this.cfg.baseUrl}/health`, {
          method: "GET",
          timeout: this.cfg.timeoutMs
        });
        const data = response.data ?? response.text;
        if (this.cfg.debug) {
          log("health", "ok", data);
        }
        return true;
      } catch (err) {
        if (this.cfg.debug) {
          log("health", "failed", err.message);
        }
        throw err;
      }
    }
    async find(query, options = {}) {
      const body = {
        query,
        agent_id: options.agentId,
        limit: options.limit || 5,
        include_explain: options.includeExplain || false
      };
      if (options.sessionId) body.session_id = options.sessionId;
      if (this.cfg.debug) {
        log("find request", JSON.stringify(body));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/api/retrieval/search`, {
        method: "POST",
        headers: this._buildHeaders(true),
        body: JSON.stringify(body)
      });
      if (this.cfg.debug) {
        const items = (result == null ? void 0 : result.items) || [];
        log(
          "find response",
          `items=${items.length}`,
          items[0] ? JSON.stringify(items[0]) : "empty",
          (result == null ? void 0 : result.explain) ? `explain=${JSON.stringify(result.explain)}` : "no explain"
        );
      }
      return result;
    }
    async openSession(options = {}) {
      var _a;
      const body = {
        agent_id: options.agentId
      };
      if (options.sessionId) body.session_id = options.sessionId;
      if (options.runId) body.run_id = options.runId;
      if (options.metadata) body.metadata = options.metadata;
      if (this.cfg.debug) {
        log("openSession request", JSON.stringify(body));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/api/sessions/open`, {
        method: "POST",
        headers: this._buildHeaders(true),
        body: JSON.stringify(body)
      });
      const normalized = {
        ...result,
        session_id: ((_a = result.scope) == null ? void 0 : _a.session_id) || result.session_id || result.id
      };
      if (this.cfg.debug) {
        log("openSession response", `raw=${JSON.stringify(result)}`, `normalized session_id=${normalized.session_id}`);
      }
      return normalized;
    }
    async addMessage(sessionId, message) {
      var _a;
      const body = {
        role: message.role,
        content: message.text
      };
      if (this.cfg.debug) {
        log("addMessage request", `session=${sessionId}`, JSON.stringify(body));
      }
      const result = await this._fetchJson(
        `${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: "POST",
          headers: this._buildHeaders(true),
          body: JSON.stringify(body)
        }
      );
      if (this.cfg.debug) {
        log("addMessage response", `session=${sessionId}`, `message.id=${((_a = result == null ? void 0 : result.message) == null ? void 0 : _a.id) || (result == null ? void 0 : result.id) || "unknown"}`);
      }
      return result;
    }
    async appendMessages(sessionId, messages) {
      if (this.cfg.debug) {
        log("appendMessages", `session=${sessionId}`, `count=${messages.length}`);
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
        log("commitSession request", `session=${sessionId}`);
      }
      const result = await this._fetchJson(
        `${this.cfg.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/commit`,
        {
          method: "POST",
          headers: this._buildHeaders(true),
          body: JSON.stringify({})
        }
      );
      if (this.cfg.debug) {
        log("commitSession response", `session=${sessionId}`, `commit_id=${result == null ? void 0 : result.commit_id}`, `archive_id=${result == null ? void 0 : result.archive_id}`, `status=${result == null ? void 0 : result.status}`);
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
        metadata: options.metadata
      };
      Object.keys(body).forEach((key) => {
        if (body[key] === void 0) delete body[key];
      });
      if (this.cfg.debug) {
        const preview = body.content ? `${String(body.content).slice(0, 100)}...(${String(body.content).length} chars)` : "empty";
        log("addResource request", JSON.stringify({ ...body, content: preview }));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/api/resources`, {
        method: "POST",
        headers: this._buildHeaders(true),
        body: JSON.stringify(body)
      });
      if (this.cfg.debug) {
        log("addResource response", `resource_id=${result == null ? void 0 : result.resource_id}`, `uri=${result == null ? void 0 : result.uri}`);
      }
      return result;
    }
    async deleteResource(resourceId) {
      if (!resourceId) throw new Error("resourceId is required");
      const url = `${this.cfg.baseUrl}/api/resources/${encodeURIComponent(resourceId)}`;
      if (this.cfg.debug) {
        log("deleteResource request", resourceId);
      }
      const result = await this._fetchJson(url, {
        method: "DELETE",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        log("deleteResource response", result);
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
        allowed_tools: options.allowedTools
      };
      Object.keys(body).forEach((key) => {
        if (body[key] === void 0) delete body[key];
      });
      if (this.cfg.debug) {
        log("addSkill request", options.name, JSON.stringify({ ...body, data: void 0 }));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/api/skills`, {
        method: "POST",
        headers: this._buildHeaders(true),
        body: JSON.stringify(body)
      });
      if (this.cfg.debug) {
        log("addSkill response", `name=${result == null ? void 0 : result.name}`, `uri=${result == null ? void 0 : result.uri}`);
      }
      return result;
    }
    async deleteSkill(name) {
      if (!name) throw new Error("name is required");
      const url = `${this.cfg.baseUrl}/api/skills/${encodeURIComponent(name)}`;
      if (this.cfg.debug) {
        log("deleteSkill request", name);
      }
      const result = await this._fetchJson(url, {
        method: "DELETE",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        log("deleteSkill response", result);
      }
      return result;
    }
    async listSkillVersions(name) {
      var _a;
      if (!name) throw new Error("name is required");
      const url = `${this.cfg.baseUrl}/api/skills/${encodeURIComponent(name)}/versions`;
      if (this.cfg.debug) {
        log("listSkillVersions request", name);
      }
      const result = await this._fetchJson(url, {
        method: "GET",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        log("listSkillVersions response", `name=${name}`, `versions=${((_a = result == null ? void 0 : result.versions) == null ? void 0 : _a.length) || 0}`);
      }
      return result;
    }
    async readSkillVersion(name, version) {
      if (!name) throw new Error("name is required");
      if (!Number.isInteger(version) || version <= 0) {
        throw new Error("version must be a positive integer");
      }
      const url = `${this.cfg.baseUrl}/api/skills/${encodeURIComponent(name)}/versions/${version}`;
      if (this.cfg.debug) {
        log("readSkillVersion request", name, `version=${version}`);
      }
      const result = await this._fetchJson(url, {
        method: "GET",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        log("readSkillVersion response", `name=${name}`, `version=${version}`);
      }
      return result;
    }
    async rollbackSkillVersion(name, version) {
      if (!name) throw new Error("name is required");
      if (!Number.isInteger(version) || version <= 0) {
        throw new Error("version must be a positive integer");
      }
      const url = `${this.cfg.baseUrl}/api/skills/${encodeURIComponent(name)}/rollback`;
      if (this.cfg.debug) {
        log("rollbackSkillVersion request", name, `version=${version}`);
      }
      const result = await this._fetchJson(url, {
        method: "POST",
        headers: this._buildHeaders(true),
        body: JSON.stringify({ version })
      });
      if (this.cfg.debug) {
        log("rollbackSkillVersion response", `name=${name}`, `version=${version}`, `rolled_back=${result == null ? void 0 : result.rolled_back}`);
      }
      return result;
    }
    // ── Filesystem ──
    async fsLs(uri, options = {}) {
      const params = new URLSearchParams({ uri });
      if (options.simple) params.set("simple", "true");
      if (options.recursive) params.set("recursive", "true");
      if (options.output) params.set("output", options.output);
      if (options.absLimit) params.set("abs_limit", String(options.absLimit));
      if (options.showAllHidden) params.set("show_all_hidden", "true");
      if (options.nodeLimit) params.set("node_limit", String(options.nodeLimit));
      if (this.cfg.debug) {
        log("fsLs request", uri, JSON.stringify(options));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/fs/ls?${params.toString()}`, {
        method: "GET",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        const entries = Array.isArray(result) ? result : (result == null ? void 0 : result.entries) || [];
        log("fsLs response", `entries=${entries.length}`);
      }
      return result;
    }
    async fsTree(uri, options = {}) {
      const params = new URLSearchParams({ uri });
      if (options.maxDepth !== void 0) {
        params.set("max_depth", String(options.maxDepth));
      }
      if (this.cfg.debug) {
        log("fsTree request", uri, JSON.stringify(options));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/fs/tree?${params.toString()}`, {
        method: "GET",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        const entries = Array.isArray(result) ? result : (result == null ? void 0 : result.entries) || [];
        log("fsTree response", `entries=${entries.length}`);
      }
      return result;
    }
    async fsRead(uri, options = {}) {
      const params = new URLSearchParams({ uri });
      if (options.offset !== void 0) params.set("offset", String(options.offset));
      if (options.limit !== void 0) params.set("limit", String(options.limit));
      if (this.cfg.debug) {
        log("fsRead request", uri);
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/fs/read?${params.toString()}`, {
        method: "GET",
        headers: this._buildHeaders(false)
      });
      if (this.cfg.debug) {
        const preview = typeof result === "string" ? `${result.slice(0, 80)}...` : JSON.stringify(result).slice(0, 80);
        log("fsRead response", preview);
      }
      if (typeof result === "string") return result;
      return (result == null ? void 0 : result.content) ?? (result == null ? void 0 : result.text) ?? "";
    }
    // ── Metrics / Token Statistics ──
    async fetchMetrics() {
      const url = `${this.cfg.baseUrl}/metrics`;
      if (this.cfg.debug) {
        log("fetchMetrics request", url);
      }
      const response = await fetchViaBackground(url, {
        method: "GET",
        timeout: this.cfg.timeoutMs
      });
      const text = response.text ?? "";
      if (this.cfg.debug) {
        log("fetchMetrics response", `${String(text).length} chars`);
      }
      return text;
    }
    async fetchUsage() {
      const metricsText = await this.fetchMetrics();
      const totalTokens = this._sumTokenCounters(metricsText, [
        "echomem_router_llm_input_tokens_total",
        "echomem_router_llm_output_tokens_total",
        "echomem_engine_llm_input_tokens_total",
        "echomem_engine_llm_output_tokens_total"
      ]);
      if (this.cfg.debug) {
        log("fetchUsage", `total_tokens=${totalTokens}`);
      }
      return { total: { total_tokens: totalTokens } };
    }
    _sumTokenCounters(metricsText, counterNames) {
      if (typeof metricsText !== "string" || metricsText.length === 0) {
        return 0;
      }
      const names = new Set(counterNames);
      let total = 0;
      for (const line of metricsText.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([^{\s]+)(?:\{[^}]*\})?\s+(\S+)$/);
        if (!match) continue;
        const [, name, valueStr] = match;
        if (!names.has(name)) continue;
        const value = parseFloat(valueStr);
        if (!Number.isNaN(value)) {
          total += value;
        }
      }
      return Math.round(total);
    }
  };
  function createClient(config) {
    return new EchoMemClient(config);
  }

  // src/services/config.js
  var DEFAULT_ECHOMEM_CONFIG = {
    baseUrl: "http://127.0.0.1:8010",
    authKey: "",
    agentId: ""
  };
  async function getEchoMemConfig() {
    try {
      const result = await chrome.storage.local.get("echomemConfig");
      const stored = result.echomemConfig || {};
      return { ...DEFAULT_ECHOMEM_CONFIG, ...stored };
    } catch {
      return { ...DEFAULT_ECHOMEM_CONFIG };
    }
  }

  // src/panels/feedback/summary/summary-client.js
  var DEFAULT_ENGINE_ID = "echo0_plugin";
  var TOPIC_COLORS = ["#6750a4", "#3b8f6c", "#b87a24", "#d47463", "#5b78a8"];
  var WEEKDAYS = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
  function colorFor(index) {
    return TOPIC_COLORS[index % TOPIC_COLORS.length];
  }
  function normalizeTrendSeries(series) {
    return Array.isArray(series) ? series : [];
  }
  function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  function weekdayFor(key) {
    return WEEKDAYS[parseDateKey(key).getUTCDay()];
  }
  function formatMonthDay(key) {
    const d = parseDateKey(key);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")} / ${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function formatChineseDate(key) {
    const d = parseDateKey(key);
    return `${d.getUTCFullYear()} \u5E74 ${d.getUTCMonth() + 1} \u6708 ${d.getUTCDate()} \u65E5`;
  }
  function safeJson(text) {
    try {
      return JSON.parse(text || "{}");
    } catch {
      return {};
    }
  }
  async function listJsonFiles(client, uri) {
    const tree = await client.fsTree(uri, { maxDepth: 2 });
    return ((tree == null ? void 0 : tree.entries) || []).filter(
      (e) => e.kind === "file" && e.uri.endsWith(".json")
    );
  }
  async function readBodies(client, uri) {
    let files;
    try {
      files = await listJsonFiles(client, uri);
    } catch (err) {
      if (err.status === 404) return [];
      throw err;
    }
    const results = await Promise.all(
      files.map(async (entry) => {
        try {
          const text = await client.fsRead(entry.uri);
          return { key: entry.uri.split("/").pop().replace(/\.json$/, ""), body: safeJson(text) };
        } catch (err) {
          console.warn("EchoMem summary: failed to read", entry.uri, err.message);
          return null;
        }
      })
    );
    return results.filter(Boolean);
  }
  function mapDailyToReview(raw) {
    var _a, _b;
    const date = raw.date || "";
    const based = raw.based_on || {};
    const recap = raw.recap || {};
    const attention = raw.attention || { expression_count: 0, items: [] };
    const facts = Array.isArray(raw.facts) ? raw.facts : [];
    const openItems = Array.isArray(raw.open_items) ? raw.open_items : [];
    return {
      modeLabel: "DAILY RECAP",
      railTitle: "\u4ECA\u5929\uFF0C\u503C\u5F97\u770B\u6E05\u4EC0\u4E48",
      period: formatChineseDate(date),
      evidenceLabel: `${((_a = based.sessions) == null ? void 0 : _a.length) || 0} \u6BB5\u4F1A\u8BDD \xB7 ${based.atom_count || 0} \u6761\u539F\u5B50 \xB7 ${based.message_count || 0} \u6761\u6D88\u606F`,
      cards: {
        overview: {
          label: "\u4ECA\u65E5\u6982\u89C8",
          kicker: `${date.slice(0, 4)} \xB7 ${formatMonthDay(date)} \xB7 ${weekdayFor(date)}`,
          title: recap.title || "\u8FD9\u4E00\u5929",
          subtitle: recap.subtitle || "",
          agentLabel: "ECHO \u6CE8\u610F\u5230",
          agentText: recap.observation || ""
        },
        topics: {
          label: "\u5173\u6CE8\u5206\u5E03",
          kicker: "\u4ECA\u65E5\u5173\u6CE8\u5206\u5E03",
          title: "\u4ECA\u5929\uFF0C\u4F60\u4E3B\u8981\u5173\u6CE8\u4E86\u4EC0\u4E48",
          note: `\u6309\u4F60\u7684 ${attention.expression_count || 0} \u6761\u8868\u8FBE\u5F52\u5165 ${((_b = attention.items) == null ? void 0 : _b.length) || 0} \u4E2A\u4E3B\u4E3B\u9898 \xB7 \u539F\u5B50\u7528\u4E8E\u6821\u51C6\u4E8B\u5B9E`,
          items: (attention.items || []).map((item, index) => ({
            label: item.label || "\u5176\u4ED6",
            countLabel: `${item.count || 0} \u6761\u8868\u8FBE`,
            percent: item.percent || 0,
            insight: item.insight || "",
            color: colorFor(index)
          }))
        },
        facts: {
          label: "\u4ECA\u5929\u786E\u5B9A\u4E86\u4EC0\u4E48",
          kicker: "\u503C\u5F97\u8BB0\u4F4F",
          title: "\u4ECA\u5929\u771F\u6B63\u786E\u5B9A\u4E86\u4EC0\u4E48",
          items: facts.map((fact) => ({
            tag: fact.tag || "\u4E8B\u5B9E",
            text: fact.text || "",
            evidence: fact.evidence || ""
          }))
        },
        next: {
          label: "\u63A5\u4E0B\u6765",
          kicker: "\u5F00\u653E\u4E8B\u9879",
          title: openItems.length ? "\u8FD9\u4E9B\u4E8B\u60C5\uFF0C\u8FD8\u503C\u5F97\u7EE7\u7EED\u63A8\u8FDB" : "\u6682\u65F6\u6CA1\u6709\u660E\u786E\u7684\u540E\u7EED\u4E8B\u9879",
          items: openItems.map((item) => ({
            title: item.title || "",
            detail: item.detail || "",
            status: item.status || "\u5F85\u8DDF\u8FDB"
          })),
          agentLabel: "ECHO \u7684\u6574\u7406",
          agentText: raw.next_observation || ""
        }
      }
    };
  }
  function mapWeeklyToReview(raw) {
    var _a;
    const year = Number(raw.year || 0);
    const week = Number(raw.week || 0);
    const range = raw.date_range || {};
    const recap = raw.recap || {};
    const trend = raw.attention_trend || { series: [], rows: [] };
    const highlights = Array.isArray(raw.highlights) ? raw.highlights : [];
    const changes = Array.isArray(raw.changes) ? raw.changes : [];
    const openItems = Array.isArray(raw.open_items) ? raw.open_items : [];
    return {
      modeLabel: "WEEKLY RECAP",
      railTitle: "\u8FD9\u4E00\u5468\uFF0C\u4EC0\u4E48\u6700\u91CD\u8981",
      period: `${year} \u5E74\u7B2C ${week} \u5468`,
      evidenceLabel: `${range.start || ""} \u2014 ${range.end || ""} \xB7 ${((_a = raw.metrics) == null ? void 0 : _a.days) || 0} \u5929\u8BB0\u5F55`,
      cards: {
        overview: {
          label: "\u672C\u5468\u6982\u89C8",
          kicker: `${year} \xB7 WEEK ${week} \xB7 ${formatMonthDay(range.start)} \u2014 ${formatMonthDay(range.end)}`,
          title: recap.title || "\u8FD9\u4E00\u5468",
          subtitle: recap.subtitle || "",
          agentLabel: "ECHO \u7684\u5468\u5EA6\u89C2\u5BDF",
          agentText: recap.observation || ""
        },
        highlights: {
          label: "\u672C\u5468\u9AD8\u5149",
          kicker: "\u672C\u5468\u9AD8\u5149",
          title: "\u771F\u6B63\u6539\u53D8\u4E86\u540E\u7EED\u65B9\u5411\u7684\u8282\u70B9",
          items: highlights.map((h) => ({
            date: h.date ? `${formatMonthDay(h.date)} \xB7 ${weekdayFor(h.date)}` : "",
            title: h.title || "",
            text: h.text || ""
          }))
        },
        trend: {
          label: "\u5173\u6CE8\u53D8\u5316",
          kicker: "\u672C\u5468\u5173\u6CE8\u53D8\u5316",
          title: "\u4F60\u7684\u6CE8\u610F\u529B\uFF0C\u5982\u4F55\u4E00\u6B65\u6B65\u8F6C\u79FB",
          ariaLabel: `\u672C\u5468\u5173\u6CE8\u8D8B\u52BF\uFF1A${normalizeTrendSeries(trend.series).map((s) => s.label).join("\u3001")}`,
          series: normalizeTrendSeries(trend.series).map((s, index) => ({ label: s.label || "", color: colorFor(index) })),
          rows: (trend.rows || []).map((row) => ({
            day: row.day || (row.date ? weekdayFor(row.date) : ""),
            values: Array.isArray(row.values) ? row.values : []
          })),
          agentLabel: "ECHO \u6CE8\u610F\u5230",
          agentText: trend.observation || ""
        },
        changes: {
          label: "\u5F62\u6210\u7684\u53D8\u5316",
          kicker: "\u672C\u5468\u5F62\u6210\u7684\u53D8\u5316",
          title: "\u76EE\u6807\u3001\u534F\u4F5C\u548C\u98CE\u63A7\u90FD\u53D1\u751F\u4E86\u5177\u4F53\u53D8\u5316",
          items: changes.map((change) => ({
            tag: change.tag || "\u53D8\u5316",
            text: change.text || ""
          }))
        },
        next: {
          label: "\u5C1A\u672A\u7ED3\u675F",
          kicker: "\u5F00\u653E\u4E8B\u9879",
          title: "\u8FD9\u4E9B\u4E8B\u60C5\uFF0C\u8FD8\u503C\u5F97\u7EE7\u7EED\u63A8\u8FDB",
          items: openItems.map((item) => ({
            title: item.title || "",
            detail: item.detail || "",
            status: item.status || "\u5F85\u8DDF\u8FDB"
          })),
          agentLabel: "ECHO \u7684\u5EFA\u8BAE",
          agentText: raw.next_observation || ""
        }
      }
    };
  }
  function latestKey(keys) {
    return keys.length ? keys.sort().pop() : "";
  }
  async function fetchPeriodicReview(options = {}) {
    const cfg = await getEchoMemConfig();
    const client = createClient(cfg);
    const engineId = options.engineId || DEFAULT_ENGINE_ID;
    const [dailyEntries, weeklyEntries] = await Promise.all([
      readBodies(client, `echo://engine/${engineId}/memory/summary/daily`),
      readBodies(client, `echo://engine/${engineId}/memory/summary/weekly`)
    ]);
    const dailyItems = {};
    dailyEntries.forEach(({ key, body }) => {
      if (body.date) dailyItems[key] = mapDailyToReview(body);
    });
    const weeklyItems = {};
    weeklyEntries.forEach(({ key, body }) => {
      if (body.year && body.week) weeklyItems[key] = mapWeeklyToReview(body);
    });
    const dailyKeys = Object.keys(dailyItems).sort();
    const weeklyKeys = Object.keys(weeklyItems).sort();
    const dailyDefault = (options.date && dailyItems[options.date] ? options.date : "") || latestKey(dailyKeys);
    const weeklyDefault = (options.week && weeklyItems[options.week] ? options.week : "") || latestKey(weeklyKeys);
    return {
      daily: { defaultKey: dailyDefault, items: dailyItems },
      weekly: { defaultKey: weeklyDefault, items: weeklyItems }
    };
  }

  // src/panels/feedback/summary/summary-cards.js
  function renderDailyCards(review) {
    const cards = review.cards;
    return buildReview(review, [
      overviewCard(cards.overview),
      topicCard(cards.topics),
      memoryCard(cards.facts),
      actionCard(cards.next)
    ], "\u6BCF\u65E5\u56DE\u987E");
  }
  function renderWeeklyCards(review) {
    const cards = review.cards;
    return buildReview(review, [
      overviewCard(cards.overview),
      highlightsCard(cards.highlights),
      trendCard(cards.trend),
      memoryCard(cards.changes),
      actionCard(cards.next)
    ], "\u6BCF\u5468\u56DE\u987E");
  }
  function buildReview(review, cards, label) {
    const root = node("section", "em-periodic-review");
    root.tabIndex = 0;
    root.setAttribute("aria-label", label);
    const rail = node("aside", "em-periodic-rail");
    const railHeading = node("div", "em-periodic-rail-heading");
    const kicker = node("span", "em-periodic-rail-kicker");
    kicker.textContent = review.modeLabel;
    const title = document.createElement("h2");
    title.textContent = review.railTitle;
    railHeading.append(kicker, title);
    const steps = node("nav", "em-periodic-steps");
    steps.setAttribute("aria-label", "\u56DE\u987E\u5361\u7247");
    const stepButtons = cards.map((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "em-periodic-step";
      button.setAttribute("aria-label", `\u67E5\u770B\u7B2C ${index + 1} \u5F20\uFF1A${card.dataset.label}`);
      const number = node("span", "em-periodic-step-index");
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = node("span", "em-periodic-step-label");
      copy.textContent = card.dataset.label;
      button.append(number, copy);
      steps.appendChild(button);
      return button;
    });
    rail.append(railHeading, steps);
    const stage = node("div", "em-periodic-stage");
    const cardStack = node("div", "em-periodic-card-stack");
    cards.forEach((card) => cardStack.appendChild(card));
    const navRow = node("div", "em-periodic-nav-row");
    const count = node("span", "em-periodic-page-count");
    count.setAttribute("aria-live", "polite");
    const navButtons = node("div", "em-periodic-nav-buttons");
    const prev = navButton("prev", "\u4E0A\u4E00\u5F20\u5361\u7247");
    const next = navButton("next", "\u4E0B\u4E00\u5F20\u5361\u7247");
    navButtons.append(prev, next);
    navRow.append(count, navButtons);
    stage.append(cardStack, navRow);
    root.append(rail, stage);
    let currentIndex = 0;
    function update(index) {
      currentIndex = Math.max(0, Math.min(cards.length - 1, index));
      cards.forEach((card, cardIndex) => {
        const active = cardIndex === currentIndex;
        card.hidden = !active;
        card.classList.toggle("is-active", active);
        card.setAttribute("aria-hidden", String(!active));
        if (active) card.scrollTop = 0;
      });
      stepButtons.forEach((button, buttonIndex) => {
        const active = buttonIndex === currentIndex;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "step" : "false");
      });
      count.textContent = `${String(currentIndex + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
      prev.disabled = currentIndex === 0;
      next.disabled = currentIndex === cards.length - 1;
    }
    stepButtons.forEach((button, index) => button.addEventListener("click", () => update(index)));
    prev.addEventListener("click", () => update(currentIndex - 1));
    next.addEventListener("click", () => update(currentIndex + 1));
    root.addEventListener("keydown", (event) => {
      var _a, _b;
      if ((_b = (_a = event.target).closest) == null ? void 0 : _b.call(_a, ".em-periodic-topic-button")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        update(currentIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        update(currentIndex + 1);
      }
    });
    root._cleanup = () => {
    };
    update(0);
    return root;
  }
  function overviewCard(data) {
    const card = cardShell(data);
    const title = cardTitle(data.title, "em-periodic-hero-title");
    const subtitle = node("p", "em-periodic-subtitle");
    subtitle.textContent = data.subtitle;
    card.append(title, subtitle, agentLine(data.agentLabel, data.agentText));
    return card;
  }
  function topicCard(data) {
    var _a;
    const card = cardShell(data);
    card.appendChild(cardTitle(data.title));
    const layout = node("div", "em-periodic-attention-layout");
    const chartWrap = node("div", "em-periodic-donut-wrap");
    const donut = node("div", "em-periodic-donut");
    donut.setAttribute("role", "img");
    donut.setAttribute("aria-label", data.items.map((item) => `${item.label} ${item.percent}%`).join("\uFF0C"));
    donut.style.background = conicGradient(data.items);
    const donutCenter = node("div", "em-periodic-donut-center");
    const donutValue = node("strong", "em-periodic-donut-value");
    const donutTopic = node("span", "em-periodic-donut-topic");
    donutCenter.append(donutValue, donutTopic);
    donut.appendChild(donutCenter);
    const note = node("p", "em-periodic-chart-note");
    note.textContent = data.note;
    chartWrap.append(donut, note);
    const detail = node("div", "em-periodic-topic-detail");
    const legend = node("div", "em-periodic-topic-legend");
    const insight = agentLine("ECHO \u7684\u89E3\u8BFB", ((_a = data.items[0]) == null ? void 0 : _a.insight) || "");
    const insightCopy = insight.querySelector(".em-periodic-agent-text");
    const buttons = data.items.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "em-periodic-topic-button";
      button.setAttribute("aria-pressed", String(index === 0));
      const dot = node("span", "em-periodic-topic-dot");
      dot.style.background = item.color;
      const copy = node("span", "em-periodic-topic-copy");
      const name = document.createElement("strong");
      name.textContent = item.label;
      const count = document.createElement("span");
      count.textContent = item.countLabel;
      copy.append(name, count);
      const value = node("span", "em-periodic-topic-value");
      value.textContent = `${item.percent}%`;
      button.append(dot, copy, value);
      button.addEventListener("click", () => {
        buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        donutValue.textContent = `${item.percent}%`;
        donutTopic.textContent = item.label;
        insightCopy.textContent = item.insight;
      });
      legend.appendChild(button);
      return button;
    });
    detail.append(legend, insight);
    layout.append(chartWrap, detail);
    card.appendChild(layout);
    if (data.items[0]) {
      donutValue.textContent = `${data.items[0].percent}%`;
      donutTopic.textContent = data.items[0].label;
    }
    return card;
  }
  function memoryCard(data) {
    const card = cardShell(data);
    card.appendChild(cardTitle(data.title));
    const grid = node("div", "em-periodic-memory-grid");
    data.items.forEach((item) => {
      const memory = node("section", "em-periodic-memory-item");
      const tag = node("span", "em-periodic-memory-tag");
      tag.textContent = item.tag;
      const copy = document.createElement("p");
      copy.textContent = item.text;
      memory.append(tag, copy);
      if (item.evidence) {
        const evidence = document.createElement("small");
        evidence.textContent = item.evidence;
        memory.appendChild(evidence);
      }
      grid.appendChild(memory);
    });
    card.appendChild(grid);
    return card;
  }
  function actionCard(data) {
    const card = cardShell(data);
    card.appendChild(cardTitle(data.title));
    const list = node("div", "em-periodic-action-list");
    data.items.forEach((item) => {
      const row = node("div", "em-periodic-action-item");
      const mark = node("span", "em-periodic-action-mark");
      mark.appendChild(arrowIcon("right"));
      const copy = node("span", "em-periodic-action-copy");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const detail = document.createElement("span");
      detail.textContent = item.detail;
      copy.append(title, detail);
      const status = node("span", "em-periodic-status");
      status.textContent = item.status;
      row.append(mark, copy, status);
      list.appendChild(row);
    });
    card.appendChild(list);
    if (data.agentText) card.appendChild(agentLine(data.agentLabel, data.agentText));
    return card;
  }
  function highlightsCard(data) {
    const card = cardShell(data);
    card.appendChild(cardTitle(data.title));
    const list = node("div", "em-periodic-highlight-list");
    data.items.forEach((item) => {
      const highlight = node("section", "em-periodic-highlight");
      const date = node("span", "em-periodic-highlight-date");
      date.textContent = item.date;
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const text = document.createElement("p");
      text.textContent = item.text;
      copy.append(title, text);
      highlight.append(date, copy);
      list.appendChild(highlight);
    });
    card.appendChild(list);
    return card;
  }
  function trendCard(data) {
    const card = cardShell(data);
    card.appendChild(cardTitle(data.title));
    const chart = node("div", "em-periodic-trend");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", data.ariaLabel);
    data.rows.forEach((row) => {
      const item = node("div", "em-periodic-trend-row");
      const day = document.createElement("span");
      day.textContent = row.day;
      const bar = node("div", "em-periodic-trend-bar");
      row.values.forEach((value, index) => {
        if (!value) return;
        const segment = document.createElement("span");
        segment.style.width = `${value}%`;
        segment.style.background = data.series[index].color;
        segment.title = `${data.series[index].label} ${value}%`;
        bar.appendChild(segment);
      });
      item.append(day, bar);
      chart.appendChild(item);
    });
    const legend = node("div", "em-periodic-trend-legend");
    data.series.forEach((series) => {
      const item = document.createElement("span");
      const dot = document.createElement("i");
      dot.style.background = series.color;
      item.append(dot, document.createTextNode(series.label));
      legend.appendChild(item);
    });
    chart.append(legend, trendTable(data));
    card.append(chart, agentLine(data.agentLabel, data.agentText));
    return card;
  }
  function trendTable(data) {
    const table = document.createElement("table");
    table.className = "em-sr-only";
    const caption = document.createElement("caption");
    caption.textContent = "\u672C\u5468\u6BCF\u65E5\u5173\u6CE8\u4E3B\u9898\u5360\u6BD4";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["\u65E5\u671F", ...data.series.map((series) => series.label)].forEach((label) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    data.rows.forEach((row) => {
      const tableRow = document.createElement("tr");
      [row.day, ...row.values.map((value) => `${value}%`)].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        tableRow.appendChild(cell);
      });
      body.appendChild(tableRow);
    });
    table.append(caption, head, body);
    return table;
  }
  function cardShell(data) {
    const card = node("article", "em-periodic-card");
    card.dataset.label = data.label;
    const kicker = node("span", "em-periodic-card-kicker");
    kicker.textContent = data.kicker;
    card.appendChild(kicker);
    return card;
  }
  function cardTitle(text, className = "") {
    const title = document.createElement("h2");
    title.className = ["em-periodic-card-title", className].filter(Boolean).join(" ");
    title.textContent = text;
    return title;
  }
  function agentLine(label, text) {
    const line = node("div", "em-periodic-agent-line");
    const avatar = node("span", "em-periodic-agent-avatar");
    avatar.textContent = "E";
    avatar.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    const heading = document.createElement("small");
    heading.textContent = label;
    const content = node("span", "em-periodic-agent-text");
    content.textContent = text;
    copy.append(heading, content);
    line.append(avatar, copy);
    return line;
  }
  function navButton(direction, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "em-periodic-nav-button";
    button.setAttribute("aria-label", label);
    button.appendChild(arrowIcon(direction === "prev" ? "left" : "right"));
    return button;
  }
  function arrowIcon(direction) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6");
    svg.appendChild(path);
    return svg;
  }
  function conicGradient(items) {
    let start = 0;
    const segments = items.map((item) => {
      const end = start + item.percent;
      const segment = `${item.color} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }
  function node(tag, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  }

  // src/panels/feedback/summary/summary-theme.js
  var STYLE_ID = "echomem-summary-theme";
  function injectSummaryTheme(container) {
    if (!container || container.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .em-view-stage[data-em-view="summary"] {
      --em-bg: #fffbfe; --em-panel: rgba(255,255,255,.96); --em-panel-strong: #ffffff;
      --em-line: rgba(121,116,126,.24); --em-line-strong: rgba(103,80,164,.42);
      --em-text: #1d1b20; --em-text-2: #49454f; --em-text-3: #79747e;
      --em-cyan: #6750a4; --em-blue: #5278c5; --em-green: #3b8f6c;
      --em-amber: #b87a24; --em-pink: #ad557e; --em-purple: #6750a4;
      color: var(--em-text);
      color-scheme: light;
      background:
        radial-gradient(circle at 8% -12%, rgba(234,221,255,.56), transparent 32%),
        linear-gradient(145deg, #fffbfe 0%, #fef7ff 55%, #f6f1fa 100%);
    }
    .em-summary-view { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }
    .em-summary-stage { flex: 1 1 auto; min-height: 0; overflow: auto; padding: clamp(14px,2.2vw,28px); }
    .em-toolbar {
      min-height: 58px; display: flex; align-items: center; gap: 12px; padding: 10px 18px;
      border-bottom: 1px solid var(--em-line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); z-index: 10;
    }
    .em-segmented { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--em-line); border-radius: 12px; background: #fef7ff; }
    .em-segmented button { padding: 6px 11px; border: 0; border-radius: 9px; color: var(--em-text-3); background: transparent; cursor: pointer; }
    .em-segmented button[aria-selected="true"] { color: #21005d; background: #eaddff; box-shadow: none; }
    .em-summary-toolbar { position: relative; min-height: 78px; overflow: visible; gap: 18px; padding: 12px clamp(18px,2.2vw,28px); }
    .em-summary-heading { min-width: 185px; display: flex; flex-direction: column; gap: 5px; }
    .em-summary-heading h1 { margin: 0; color: var(--em-text); font-size: 18px; font-weight: 670; letter-spacing: -.02em; }
    .em-summary-heading span { width: fit-content; min-height: 22px; display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; color: #6750a4; background: #f2eaff; font-size: 9px; font-weight: 600; }
    .em-summary-mode-tabs { margin-left: auto; }
    .em-summary-mode-tabs button { min-height: 42px; padding: 8px 16px; font-size: 12px; font-weight: 600; }
    .em-summary-mode-tabs button[aria-selected="true"] { color: #21005d; background: #eaddff; }
    .em-summary-date-control { margin-left: 0; }
    .em-date-control { position: relative; }
    .em-calendar-trigger { min-width: 250px; height: 54px; display: flex; align-items: center; gap: 11px; padding: 6px 12px 6px 9px; border: 1px solid rgba(103,80,164,.18); border-radius: 15px; color: var(--em-text-2); background: #fff; cursor: pointer; box-shadow: 0 3px 12px rgba(73,50,115,.055); transition: color .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease; }
    .em-calendar-trigger:hover, .em-calendar-trigger.is-open { color: #21005d; border-color: rgba(103,80,164,.38); background: #fef7ff; box-shadow: 0 7px 20px rgba(73,50,115,.09); }
    .em-calendar-icon { flex: 0 0 auto; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; color: #6750a4; background: #f2eaff; }
    .em-calendar-icon svg { width: 19px; height: 19px; }
    .em-summary-period-label { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; text-align: left; }
    .em-summary-period-label strong { color: var(--em-text); font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; }
    .em-summary-period-label span { overflow: hidden; color: var(--em-text-3); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .em-date-popover { position: absolute; z-index: 50; top: calc(100% + 10px); right: 0; width: 360px; padding: 18px; visibility: hidden; opacity: 0; transform: translateY(-6px) scale(.985); transform-origin: top right; border: 1px solid rgba(103,80,164,.18); border-radius: 18px; background: #fff; box-shadow: 0 22px 56px rgba(47,35,70,.18); transition: opacity .18s ease,transform .18s ease,visibility .18s; }
    .em-date-popover.is-open { visibility: visible; opacity: 1; transform: translateY(0) scale(1); }
    .em-calendar-head { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; gap: 8px; }
    .em-calendar-head strong { color: var(--em-text); font-size: 13px; font-weight: 650; text-align: center; }
    .em-calendar-head button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid transparent; border-radius: 11px; color: var(--em-text-2); background: transparent; cursor: pointer; }
    .em-calendar-head button svg { width: 18px; height: 18px; }
    .em-calendar-head button:hover:not(:disabled) { color: #6750a4; border-color: rgba(103,80,164,.14); background: #f2eaff; }
    .em-calendar-head button:disabled { opacity: .22; cursor: default; }
    .em-calendar-weekdays, .em-calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
    .em-calendar-weekdays { margin: 16px 0 8px; }
    .em-calendar-weekdays span { color: var(--em-text-3); font-size: 10px; font-weight: 600; text-align: center; }
    .em-calendar-grid > span, .em-calendar-grid button { aspect-ratio: 1; }
    .em-calendar-grid button { position: relative; min-width: 0; border: 1px solid transparent; border-radius: 11px; color: var(--em-text-2); background: #faf7fc; font-size: 11px; cursor: pointer; transition: color .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease; }
    .em-calendar-grid button:hover:not(:disabled) { color: #21005d; border-color: rgba(103,80,164,.28); background: #f2eaff; }
    .em-calendar-grid button:disabled { color: rgba(121,116,126,.28); background: transparent; cursor: default; }
    .em-calendar-grid button:not(:disabled)::after { content: ''; position: absolute; left: 50%; bottom: 5px; width: 3px; height: 3px; border-radius: 50%; background: #6750a4; transform: translateX(-50%); }
    .em-calendar-grid button.is-selected { color: #ffffff; border-color: #6750a4; background: #6750a4; font-weight: 700; box-shadow: 0 7px 18px rgba(103,80,164,.22); }
    .em-calendar-grid button.is-selected::after { background: #ffffff; }
    .em-calendar-hint { margin: 14px 0 0; color: var(--em-text-3); font-size: 10px; text-align: center; }
    .em-week-picker-title { color: var(--em-text); font-size: 13px; font-weight: 650; }
    .em-week-picker { max-height: 310px; margin-top: 12px; overflow: auto; display: flex; flex-direction: column; gap: 7px; }
    .em-week-picker button { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 13px; border: 1px solid rgba(103,80,164,.13); border-radius: 12px; color: var(--em-text-2); background: #faf7fc; cursor: pointer; text-align: left; transition: border-color .15s ease,background .15s ease; }
    .em-week-picker button:hover { border-color: rgba(103,80,164,.3); background: #f2eaff; }
    .em-week-picker button.is-selected { border-color: rgba(103,80,164,.34); background: #f2eaff; }
    .em-week-picker strong { font-size: 12px; font-weight: 650; }
    .em-week-picker span { color: var(--em-text-3); font-size: 10px; }
    .em-periodic-review { width: min(1140px,100%); height: 100%; min-height: 0; display: grid; grid-template-columns: minmax(230px,270px) minmax(0,1fr); margin: 0 auto; overflow: hidden; border: 1px solid rgba(103,80,164,.14); border-radius: 22px; color: var(--em-text); background: rgba(255,255,255,.96); box-shadow: 0 18px 48px rgba(73,50,115,.085),0 2px 8px rgba(73,50,115,.045); }
    .em-periodic-review:focus { outline: none; }
    .em-periodic-review:focus-visible { outline: 2px solid #6750a4; outline-offset: 2px; }
    .em-periodic-rail { min-width: 0; display: flex; flex-direction: column; padding: clamp(24px,3vw,36px); border-right: 1px solid rgba(103,80,164,.1); background: linear-gradient(160deg,#fff 0%,#fbf7ff 100%); }
    .em-periodic-rail-kicker, .em-periodic-card-kicker { color: #6750a4; font-size: 10px; font-weight: 700; letter-spacing: .12em; }
    .em-periodic-rail-heading h2 { margin: 10px 0 0; color: #21005d; font-size: clamp(21px,2.2vw,28px); font-weight: 570; line-height: 1.35; letter-spacing: -.03em; }
    .em-periodic-steps { display: flex; flex-direction: column; gap: 5px; margin-top: clamp(28px,5vh,48px); padding-top: 0; }
    .em-periodic-step { min-height: 48px; display: grid; grid-template-columns: 28px minmax(0,1fr); align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid transparent; border-radius: 11px; color: var(--em-text-3); background: transparent; cursor: pointer; text-align: left; transition: color .16s ease,background .16s ease,border-color .16s ease; }
    .em-periodic-step:hover { color: #493273; background: rgba(103,80,164,.055); }
    .em-periodic-step.is-active { color: #21005d; border-color: rgba(103,80,164,.14); background: #f2eaff; box-shadow: inset 3px 0 #6750a4; }
    .em-periodic-step-index { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .em-periodic-step-label { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .em-periodic-stage { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(0,1fr) auto; gap: 16px; padding: clamp(24px,3.4vw,42px); background: #fff; }
    .em-periodic-card-stack { min-width: 0; min-height: 0; }
    .em-periodic-card { height: 100%; overflow-y: auto; padding: 2px 4px 8px; scrollbar-gutter: stable; animation: em-periodic-card-in .2s ease-out; }
    .em-periodic-card[hidden] { display: none; }
    .em-periodic-card-title { max-width: 760px; margin: 12px 0 0; color: var(--em-text); font-size: clamp(23px,3.2vw,36px); font-weight: 570; line-height: 1.32; letter-spacing: -.035em; white-space: pre-line; }
    .em-periodic-hero-title { color: #21005d; font-size: clamp(27px,3.8vw,43px); }
    .em-periodic-subtitle { max-width: 740px; margin: 18px 0 0; color: var(--em-text-2); font-size: clamp(14px,1.55vw,17px); line-height: 1.8; }
    .em-periodic-agent-line { display: grid; grid-template-columns: 38px minmax(0,1fr); align-items: start; gap: 12px; margin-top: 24px; padding-top: 18px; border-top: 1px solid rgba(103,80,164,.12); }
    .em-periodic-agent-avatar { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(103,80,164,.2); border-radius: 11px; color: #6750a4; background: #f2eaff; font-size: 14px; font-weight: 750; }
    .em-periodic-agent-line > div { min-width: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.7; }
    .em-periodic-agent-line small { display: block; margin-bottom: 4px; color: #6750a4; font-size: 10px; font-weight: 750; letter-spacing: .06em; }
    .em-periodic-agent-text { display: block; }
    .em-periodic-attention-layout { display: grid; grid-template-columns: minmax(210px,.76fr) minmax(290px,1.24fr); align-items: center; gap: clamp(24px,4vw,48px); margin-top: 22px; }
    .em-periodic-donut-wrap { display: grid; justify-items: center; }
    .em-periodic-donut { width: min(220px,72%); aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(103,80,164,.08),0 12px 30px rgba(73,50,115,.1); }
    .em-periodic-donut-center { width: 66%; aspect-ratio: 1; display: grid; place-content: center; justify-items: center; padding: 12px; border-radius: 50%; background: #fff; box-shadow: 0 5px 18px rgba(73,50,115,.08); text-align: center; }
    .em-periodic-donut-value { color: #21005d; font-size: clamp(28px,3.4vw,42px); font-weight: 570; font-variant-numeric: tabular-nums; line-height: 1; }
    .em-periodic-donut-topic { margin-top: 7px; color: var(--em-text-3); font-size: 10px; line-height: 1.35; }
    .em-periodic-chart-note { max-width: 260px; margin: 13px 0 0; color: var(--em-text-3); font-size: 10px; line-height: 1.5; text-align: center; }
    .em-periodic-topic-legend { display: flex; flex-direction: column; gap: 7px; }
    .em-periodic-topic-button { min-height: 58px; display: grid; grid-template-columns: 10px minmax(0,1fr) auto; align-items: center; gap: 11px; padding: 10px 12px; border: 1px solid rgba(103,80,164,.1); border-radius: 12px; color: var(--em-text-2); background: rgba(255,255,255,.78); cursor: pointer; text-align: left; transition: border-color .16s ease,background .16s ease,box-shadow .16s ease; }
    .em-periodic-topic-button:hover, .em-periodic-topic-button[aria-pressed="true"] { border-color: rgba(103,80,164,.28); background: #fff; box-shadow: 0 5px 18px rgba(73,50,115,.07); }
    .em-periodic-topic-dot { width: 9px; height: 9px; border-radius: 50%; }
    .em-periodic-topic-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .em-periodic-topic-copy strong { color: var(--em-text); font-size: 12px; font-weight: 650; }
    .em-periodic-topic-copy span { color: var(--em-text-3); font-size: 10px; }
    .em-periodic-topic-value { color: #6750a4; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .em-periodic-topic-detail .em-periodic-agent-line { margin-top: 15px; padding-top: 15px; }
    .em-periodic-memory-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 22px; }
    .em-periodic-memory-item { min-width: 0; padding: 15px 16px; border: 1px solid rgba(103,80,164,.12); border-radius: 13px; background: linear-gradient(145deg,rgba(103,80,164,.045),rgba(255,255,255,.92)); }
    .em-periodic-memory-tag { display: inline-flex; min-height: 23px; align-items: center; padding: 3px 8px; border-radius: 999px; color: #493273; background: #f2eaff; font-size: 9px; font-weight: 750; letter-spacing: .04em; }
    .em-periodic-memory-item p { margin: 11px 0 0; color: var(--em-text-2); font-size: 13px; line-height: 1.65; }
    .em-periodic-memory-item small { display: block; margin-top: 11px; color: var(--em-text-3); font-size: 9px; line-height: 1.45; }
    .em-periodic-action-list { display: flex; flex-direction: column; gap: 8px; margin-top: 22px; }
    .em-periodic-action-item { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 12px 13px; border: 1px solid rgba(103,80,164,.11); border-radius: 12px; background: rgba(255,255,255,.82); }
    .em-periodic-action-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; color: #6750a4; background: #f2eaff; }
    .em-periodic-action-mark svg { width: 16px; height: 16px; }
    .em-periodic-action-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .em-periodic-action-copy strong { color: var(--em-text); font-size: 12px; font-weight: 650; }
    .em-periodic-action-copy > span { color: var(--em-text-3); font-size: 10px; line-height: 1.5; }
    .em-periodic-status { min-height: 24px; display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid rgba(184,122,36,.16); border-radius: 999px; color: #8a5b1e; background: rgba(184,122,36,.07); font-size: 9px; white-space: nowrap; }
    .em-periodic-highlight-list { display: flex; flex-direction: column; margin-top: 20px; }
    .em-periodic-highlight { display: grid; grid-template-columns: 66px minmax(0,1fr); gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(103,80,164,.12); }
    .em-periodic-highlight:last-child { border-bottom: 0; }
    .em-periodic-highlight-date { color: #8a5b1e; font-size: 11px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .em-periodic-highlight strong { color: var(--em-text); font-size: 14px; font-weight: 650; }
    .em-periodic-highlight p { margin: 6px 0 0; color: var(--em-text-3); font-size: 11px; line-height: 1.62; }
    .em-periodic-trend { margin-top: 20px; padding: 16px; border: 1px solid rgba(103,80,164,.11); border-radius: 14px; background: rgba(255,255,255,.82); }
    .em-periodic-trend-row { display: grid; grid-template-columns: 40px minmax(0,1fr); align-items: center; gap: 10px; margin: 8px 0; }
    .em-periodic-trend-row > span { color: var(--em-text-3); font-size: 10px; }
    .em-periodic-trend-bar { height: 14px; display: flex; overflow: hidden; border-radius: 999px; background: #ede7f3; }
    .em-periodic-trend-bar span { height: 100%; }
    .em-periodic-trend-legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 14px; color: var(--em-text-3); font-size: 10px; }
    .em-periodic-trend-legend span { display: inline-flex; align-items: center; gap: 6px; }
    .em-periodic-trend-legend i { width: 7px; height: 7px; border-radius: 50%; }
    .em-periodic-nav-row { display: flex; align-items: center; justify-content: space-between; min-height: 46px; padding-top: 12px; border-top: 1px solid rgba(103,80,164,.1); }
    .em-periodic-page-count { color: var(--em-text-3); font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .08em; }
    .em-periodic-nav-buttons { display: flex; gap: 8px; }
    .em-periodic-nav-button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid rgba(103,80,164,.16); border-radius: 12px; color: #493273; background: #fff; cursor: pointer; transition: color .16s ease,background .16s ease,border-color .16s ease; }
    .em-periodic-nav-button:hover:not(:disabled) { color: #21005d; border-color: rgba(103,80,164,.34); background: #f2eaff; }
    .em-periodic-nav-button:disabled { opacity: .35; cursor: default; }
    .em-periodic-nav-button svg { width: 20px; height: 20px; }
    .em-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }
    @keyframes em-periodic-card-in { from { opacity: .45; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) {
      .em-date-popover, .em-calendar-trigger, .em-periodic-card { transition: none !important; }
      .em-periodic-step, .em-periodic-topic-button, .em-periodic-nav-button { transition: none !important; }
      .em-periodic-card { animation: none !important; }
    }
    @media (max-width: 820px) {
      .em-summary-toolbar { min-height: 0; flex-wrap: wrap; gap: 10px 14px; }
      .em-summary-heading { flex: 1 1 180px; }
      .em-summary-mode-tabs { margin-left: 0; }
      .em-summary-date-control { margin-left: auto; }
      .em-summary-stage { padding: 14px 10px; }
      .em-periodic-review { grid-template-columns: 1fr; grid-template-rows: auto minmax(0,1fr); }
      .em-periodic-rail { padding: 12px 16px; border-right: 0; border-bottom: 1px solid rgba(103,80,164,.12); }
      .em-periodic-rail-heading { display: none; }
      .em-periodic-steps { flex-direction: row; gap: 6px; margin: 0; padding: 0; overflow-x: auto; }
      .em-periodic-step { flex: 0 0 auto; min-height: 44px; grid-template-columns: 24px auto; padding: 6px 9px; }
      .em-periodic-stage { padding: 20px; }
      .em-periodic-attention-layout { grid-template-columns: minmax(180px,.7fr) minmax(260px,1.3fr); gap: 22px; }
    }
    @media (max-width: 560px) {
      .em-summary-toolbar { align-items: flex-start; padding: 12px 14px; }
      .em-summary-heading { width: 100%; }
      .em-summary-mode-tabs { margin-left: 0; }
      .em-summary-date-control { flex: 1 1 100%; width: 100%; margin-left: 0; }
      .em-summary-period-trigger { width: 100%; min-width: 0; }
      .em-date-popover { width: min(360px,calc(100vw - 28px)); }
      .em-summary-stage { padding: 8px; }
      .em-periodic-review { border-radius: 16px; }
      .em-periodic-stage { gap: 10px; padding: 17px 15px; }
      .em-periodic-step-label { display: none; }
      .em-periodic-step { grid-template-columns: 1fr; min-width: 44px; min-height: 44px; text-align: center; }
      .em-periodic-card-title { font-size: 24px; }
      .em-periodic-hero-title { font-size: 28px; }
      .em-periodic-subtitle { font-size: 14px; }
      .em-periodic-attention-layout { grid-template-columns: 1fr; }
      .em-periodic-donut { width: 180px; }
      .em-periodic-memory-grid { grid-template-columns: 1fr; }
      .em-periodic-action-item { grid-template-columns: 32px minmax(0,1fr); }
      .em-periodic-status { grid-column: 2; width: fit-content; }
      .em-periodic-agent-line { grid-template-columns: 34px minmax(0,1fr); }
      .em-periodic-agent-avatar { width: 34px; height: 34px; }
    }
  `;
    container.prepend(style);
  }

  // src/panels/feedback/summary/summary-view.js
  var MODE_OPTIONS = [
    { key: "daily", label: "\u6BCF\u65E5\u56DE\u987E" },
    { key: "weekly", label: "\u6BCF\u5468\u56DE\u987E" }
  ];
  function renderSummary(container, options = {}) {
    cleanupSummary(container);
    container.innerHTML = "";
    injectSummaryTheme(container);
    container.style.position = "relative";
    const isActive = () => {
      var _a;
      if (typeof ((_a = options.api) == null ? void 0 : _a.isActive) === "function") return options.api.isActive();
      return container.isConnected;
    };
    const root = document.createElement("div");
    root.className = "em-summary-view";
    container.appendChild(root);
    const loading = document.createElement("div");
    loading.className = "em-summary-loading";
    loading.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;min-height:240px;color:#e3e3e3;font-size:14px;";
    loading.textContent = "\u6B63\u5728\u52A0\u8F7D\u5468\u671F\u603B\u7ED3\u2026";
    root.appendChild(loading);
    fetchPeriodicReview({
      engineId: options.engineId,
      date: options.date,
      week: options.week
    }).then((model) => {
      if (!isActive()) return;
      loading.remove();
      init(model, root, container, options);
    }).catch((err) => {
      console.error("EchoMem summary: \u52A0\u8F7D\u5931\u8D25", err);
      if (!isActive()) return;
      loading.remove();
      renderError(root, err, () => renderSummary(container, options));
    });
  }
  function renderError(root, err, onRetry) {
    root.innerHTML = "";
    const box = document.createElement("div");
    box.className = "em-summary-error";
    box.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:240px;color:#e3e3e3;gap:12px;";
    const title = document.createElement("p");
    title.textContent = "\u52A0\u8F7D\u5468\u671F\u603B\u7ED3\u5931\u8D25";
    title.style.cssText = "margin:0;font-weight:500;";
    const copy = document.createElement("p");
    copy.textContent = (err == null ? void 0 : err.message) || "\u8BF7\u786E\u8BA4 EchoMem \u540E\u7AEF\u5DF2\u542F\u52A8\u5E76\u5DF2\u751F\u6210\u603B\u7ED3";
    copy.style.cssText = "margin:0;font-size:13px;opacity:0.8;";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "em-primary-btn";
    retry.textContent = "\u91CD\u8BD5";
    retry.addEventListener("click", onRetry);
    box.append(title, copy, retry);
    root.appendChild(box);
  }
  function init(model, root, container, options) {
    var _a, _b;
    const hasMode = (m) => {
      var _a2;
      return Boolean(((_a2 = model[m]) == null ? void 0 : _a2.items) && Object.keys(model[m].items).length);
    };
    const initialMode = options.mode === "weekly" && hasMode("weekly") ? "weekly" : "daily";
    const state = {
      model,
      mode: initialMode,
      currentKeys: {
        daily: validKey("daily", options.date, model) || ((_a = model.daily) == null ? void 0 : _a.defaultKey) || "",
        weekly: validKey("weekly", options.week, model) || ((_b = model.weekly) == null ? void 0 : _b.defaultKey) || ""
      },
      calendarMonth: "",
      calendarOpen: false,
      handlers: {},
      cardsRoot: null
    };
    if (state.currentKeys.daily) {
      state.calendarMonth = monthKey(state.currentKeys.daily);
    }
    root.innerHTML = "";
    const toolbar = buildToolbar(state);
    const stage = document.createElement("div");
    stage.className = "em-summary-stage";
    stage.id = "em-summary-review-panel";
    stage.setAttribute("role", "tabpanel");
    stage.setAttribute("aria-live", "polite");
    root.append(toolbar, stage);
    function draw() {
      var _a2, _b2;
      (_b2 = (_a2 = state.cardsRoot) == null ? void 0 : _a2._cleanup) == null ? void 0 : _b2.call(_a2);
      stage.replaceChildren();
      const review = currentReview(state);
      if (!review) {
        stage.textContent = "\u6240\u9009\u5468\u671F\u6682\u65E0\u603B\u7ED3";
        stage.style.color = "#e3e3e3";
        stage.style.display = "flex";
        stage.style.alignItems = "center";
        stage.style.justifyContent = "center";
        stage.style.minHeight = "200px";
        return;
      }
      stage.style = "";
      state.cardsRoot = state.mode === "daily" ? renderDailyCards(review) : renderWeeklyCards(review);
      stage.appendChild(state.cardsRoot);
      updateToolbar(toolbar, state, review);
    }
    function switchMode(mode) {
      if (!model[mode] || mode === state.mode) return;
      state.mode = mode;
      state.calendarOpen = false;
      draw();
    }
    function toggleCalendar(force) {
      state.calendarOpen = typeof force === "boolean" ? force : !state.calendarOpen;
      updateToolbar(toolbar, state, currentReview(state));
    }
    function selectPeriod(key) {
      var _a2;
      if (!validKey(state.mode, key, model)) return;
      state.currentKeys[state.mode] = key;
      if (state.mode === "daily") state.calendarMonth = monthKey(key);
      state.calendarOpen = false;
      draw();
      (_a2 = toolbar._trigger) == null ? void 0 : _a2.focus();
    }
    function shiftCalendarMonth(delta) {
      const months = availableMonths(model);
      const currentIndex = Math.max(0, months.indexOf(state.calendarMonth));
      state.calendarMonth = months[Math.max(0, Math.min(months.length - 1, currentIndex + delta))];
      updateToolbar(toolbar, state, currentReview(state));
    }
    const onOutside = (event) => {
      if (state.calendarOpen && !toolbar.contains(event.target)) toggleCalendar(false);
    };
    const onEscape = (event) => {
      var _a2;
      if (event.key !== "Escape" || !state.calendarOpen) return;
      toggleCalendar(false);
      (_a2 = toolbar._trigger) == null ? void 0 : _a2.focus();
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    state.handlers = {
      switchMode,
      toggleCalendar,
      selectPeriod,
      shiftCalendarMonth,
      onOutside,
      onEscape
    };
    container._summaryState = state;
    draw();
  }
  function buildToolbar(state) {
    const bar = document.createElement("div");
    bar.className = "em-toolbar em-summary-toolbar";
    const heading = document.createElement("div");
    heading.className = "em-summary-heading";
    const title = document.createElement("h1");
    title.textContent = "\u5468\u671F\u603B\u7ED3";
    const note = document.createElement("span");
    note.textContent = "\u771F\u5B9E\u8BB0\u5FC6\u8BC1\u636E \xB7 LLM \u751F\u6210";
    heading.append(title, note);
    const modeWrap = document.createElement("div");
    modeWrap.className = "em-segmented em-summary-mode-tabs";
    modeWrap.setAttribute("role", "tablist");
    modeWrap.setAttribute("aria-label", "\u56DE\u987E\u5468\u671F");
    MODE_OPTIONS.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.dataset.key = option.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "em-summary-review-panel");
      button.addEventListener("click", () => state.handlers.switchMode(option.key));
      modeWrap.appendChild(button);
    });
    const dateControl = document.createElement("div");
    dateControl.className = "em-date-control em-summary-date-control";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "em-calendar-trigger em-summary-period-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const icon = document.createElement("span");
    icon.className = "em-calendar-icon";
    icon.appendChild(calendarIcon());
    const label = document.createElement("span");
    label.className = "em-summary-period-label";
    trigger.append(icon, label);
    trigger.addEventListener("click", () => state.handlers.toggleCalendar());
    dateControl.appendChild(trigger);
    const popover = document.createElement("div");
    popover.className = "em-date-popover";
    dateControl.appendChild(popover);
    bar._trigger = trigger;
    bar._label = label;
    bar._popover = popover;
    bar.append(heading, modeWrap, dateControl);
    return bar;
  }
  function updateToolbar(toolbar, state, review) {
    const mode = state.mode;
    const activeKey = state.currentKeys[mode];
    toolbar.querySelectorAll('.em-summary-mode-tabs [role="tab"]').forEach((btn) => {
      const selected = btn.dataset.key === mode;
      btn.setAttribute("aria-selected", String(selected));
      btn.tabIndex = selected ? 0 : -1;
      btn.classList.toggle("is-active", selected);
    });
    toolbar._trigger.setAttribute("aria-expanded", String(state.calendarOpen));
    toolbar._popover.classList.toggle("is-open", state.calendarOpen);
    toolbar._trigger.classList.toggle("is-open", state.calendarOpen);
    toolbar._label.textContent = (review == null ? void 0 : review.period) || formatPeriodLabel(mode, activeKey);
    if (state.calendarOpen) {
      toolbar._popover.replaceChildren();
      if (mode === "daily") {
        renderCalendar(toolbar._popover, state);
      } else {
        renderWeekPicker(toolbar._popover, state);
      }
    }
  }
  function renderCalendar(container, state) {
    const months = availableMonths(state.model);
    const currentMonth = state.calendarMonth || months[0] || "";
    const header = document.createElement("div");
    header.className = "em-calendar-head";
    const prev = calendarArrow("left", "\u4E0A\u4E2A\u6708");
    const next = calendarArrow("right", "\u4E0B\u4E2A\u6708");
    const title = document.createElement("strong");
    title.textContent = formatMonth(currentMonth);
    prev.addEventListener("click", () => state.handlers.shiftCalendarMonth(-1));
    next.addEventListener("click", () => state.handlers.shiftCalendarMonth(1));
    header.append(prev, title, next);
    const weekdays = document.createElement("div");
    weekdays.className = "em-calendar-weekdays";
    ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"].forEach((d) => {
      const cell = document.createElement("span");
      cell.textContent = d;
      weekdays.appendChild(cell);
    });
    const grid = document.createElement("div");
    grid.className = "em-calendar-grid";
    const available = new Set(availableKeys("daily", state.model));
    const [year, month] = currentMonth.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const startOffset = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = 0; i < startOffset; i++) {
      const pad = document.createElement("span");
      grid.appendChild(pad);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const enabled = available.has(key);
      const selected = key === state.currentKeys.daily;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(day);
      button.disabled = !enabled;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-label", enabled ? `\u67E5\u770B ${formatPeriodLabel("daily", key)}` : `${key} \u6CA1\u6709\u56DE\u987E`);
      if (selected) button.setAttribute("aria-current", "date");
      if (enabled) button.addEventListener("click", () => state.handlers.selectPeriod(key));
      grid.appendChild(button);
    }
    const hint = document.createElement("p");
    hint.className = "em-calendar-hint";
    hint.textContent = "\u6709\u5706\u70B9\u7684\u65E5\u671F\u53EF\u4EE5\u67E5\u770B\u6BCF\u65E5\u56DE\u987E";
    container.append(header, weekdays, grid, hint);
  }
  function renderWeekPicker(container, state) {
    const title = document.createElement("div");
    title.className = "em-week-picker-title";
    title.textContent = "\u9009\u62E9\u4E00\u5468";
    const list = document.createElement("div");
    list.className = "em-week-picker";
    availableKeys("weekly", state.model).reverse().forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      const selected = key === state.currentKeys.weekly;
      button.classList.toggle("is-selected", selected);
      if (selected) button.setAttribute("aria-current", "true");
      const main = document.createElement("strong");
      main.textContent = formatPeriodLabel("weekly", key);
      const range = document.createElement("span");
      range.textContent = weekRange(key);
      button.append(main, range);
      button.addEventListener("click", () => state.handlers.selectPeriod(key));
      list.appendChild(button);
    });
    container.append(title, list);
  }
  function calendarArrow(direction, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.appendChild(directionIcon(direction));
    return button;
  }
  function currentReview(state) {
    var _a;
    const items = (_a = state.model[state.mode]) == null ? void 0 : _a.items;
    if (!items) return null;
    return items[state.currentKeys[state.mode]] || null;
  }
  function validKey(mode, key, model) {
    var _a;
    return key && ((_a = model[mode]) == null ? void 0 : _a.items[key]) ? key : "";
  }
  function availableKeys(mode, model) {
    var _a;
    return Object.keys(((_a = model[mode]) == null ? void 0 : _a.items) || {}).sort();
  }
  function availableMonths(model) {
    return [...new Set(availableKeys("daily", model).map(monthKey))];
  }
  function formatPeriodLabel(mode, key) {
    if (mode === "weekly") {
      const [year, week] = key.split("-W");
      return `${year} \u5E74\u7B2C ${Number(week)} \u5468`;
    }
    const date = /* @__PURE__ */ new Date(`${key}T00:00:00Z`);
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
  }
  function formatMonth(key) {
    const [year, month] = key.split("-").map(Number);
    return `${year} \u5E74 ${month} \u6708`;
  }
  function monthKey(dateKey) {
    return String(dateKey || "").slice(0, 7);
  }
  function weekRange(key) {
    const [year, week] = key.split("-W").map(Number);
    const monday = isoWeekMonday(year, week);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const format = (date) => `${date.getUTCMonth() + 1}\u6708${date.getUTCDate()}\u65E5`;
    return `${format(monday)} \u2014 ${format(sunday)}`;
  }
  function isoWeekMonday(year, week) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
    return monday;
  }
  function calendarIcon() {
    return svgIcon("M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z");
  }
  function directionIcon(direction) {
    return svgIcon(direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6");
  }
  function svgIcon(pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  }
  function cleanupSummary(container) {
    var _a, _b, _c, _d;
    const state = container == null ? void 0 : container._summaryState;
    (_b = (_a = state == null ? void 0 : state.cardsRoot) == null ? void 0 : _a._cleanup) == null ? void 0 : _b.call(_a);
    if ((_c = state == null ? void 0 : state.handlers) == null ? void 0 : _c.onOutside) document.removeEventListener("pointerdown", state.handlers.onOutside);
    if ((_d = state == null ? void 0 : state.handlers) == null ? void 0 : _d.onEscape) document.removeEventListener("keydown", state.handlers.onEscape);
    if (container) container._summaryState = null;
  }

  // src/entry/feedback-summary.js
  var summaryFeedbackView = {
    key: "summary",
    label: "\u5468\u671F\u603B\u7ED3",
    mount: (container, api) => {
      renderSummary(container, { api });
    },
    cleanup: (container) => cleanupSummary(container)
  };
  globalThis.__ECHOMEM_FEEDBACK_VIEWS__ ||= /* @__PURE__ */ new Map();
  globalThis.__ECHOMEM_FEEDBACK_VIEWS__.set(summaryFeedbackView.key, summaryFeedbackView);
})();
