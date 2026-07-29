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
            const error = new Error(
              (response == null ? void 0 : response.error) || ((response == null ? void 0 : response.status) ? `HTTP ${response.status}` : "Unknown background error")
            );
            error.status = response == null ? void 0 : response.status;
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
        throw new Error(data.message || ((_a = data.error) == null ? void 0 : _a.message) || "EchoMem error");
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

  // src/services/summary-client.js
  var DEFAULT_ENGINE_ID = "echo0_plugin";
  function getWeekKey(dateStr) {
    const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00Z");
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d.getTime() + diff * 24 * 60 * 60 * 1e3);
    const year = monday.getUTCFullYear();
    const week = getISOWeek(monday);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  function getISOWeek(d) {
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
  }
  function parseSummary(raw) {
    var _a;
    if (!raw || typeof raw !== "object") return null;
    const type = raw.type === "weekly" ? "weekly" : "daily";
    return {
      type,
      date: raw.date || ((_a = raw.date_range) == null ? void 0 : _a.start) || "",
      year: raw.year || 0,
      week: raw.week || 0,
      dateRange: raw.date_range || null,
      generatedAt: raw.generated_at || "",
      basedOn: raw.based_on || {},
      metrics: raw.metrics || {},
      overview: raw.overview || "",
      narrative: raw.narrative || "",
      keyFacts: Array.isArray(raw.key_facts) ? raw.key_facts.map(_normalizeFact) : [],
      decisions: Array.isArray(raw.decisions) ? raw.decisions.map(_normalizeDecision) : [],
      actionItems: Array.isArray(raw.action_items) ? raw.action_items.map(_normalizeActionItem) : [],
      emotions: Array.isArray(raw.emotions) ? raw.emotions : [],
      topics: Array.isArray(raw.topics) ? raw.topics : [],
      people: Array.isArray(raw.people) ? raw.people : [],
      highlight: _normalizeHighlight(raw.highlight),
      themeClusters: Array.isArray(raw.theme_clusters) ? raw.theme_clusters.map(_normalizeThemeCluster) : [],
      highlights: Array.isArray(raw.highlights) ? raw.highlights.map(_normalizeHighlightItem) : [],
      memoryUpdates: Array.isArray(raw.memory_updates) ? raw.memory_updates.map(_normalizeMemoryUpdate) : [],
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
      agentNote: raw.agent_note || ""
    };
  }
  function _normalizeHighlight(item) {
    if (!item) return null;
    if (typeof item === "string") return { type: "", description: item };
    if (typeof item === "object") {
      return {
        type: item.type || item.category || "",
        description: item.description || item.content || item.text || ""
      };
    }
    return { type: "", description: String(item) };
  }
  function _normalizeFact(item) {
    if (typeof item === "string") {
      return { statement: item, importance: "", is_update: false, previous_version: "", atom_ids: [], source_turn_ids: [] };
    }
    if (item && typeof item === "object") {
      return {
        statement: item.statement || item.fact || item.content || JSON.stringify(item),
        importance: item.importance || "",
        is_update: Boolean(item.is_update),
        previous_version: item.previous_version || "",
        atom_ids: Array.isArray(item.atom_ids) ? item.atom_ids : [],
        source_turn_ids: Array.isArray(item.source_turn_ids) ? item.source_turn_ids : []
      };
    }
    return { statement: String(item || ""), importance: "", is_update: false, previous_version: "", atom_ids: [], source_turn_ids: [] };
  }
  function _normalizeDecision(item) {
    if (typeof item === "string") {
      return { description: item, evidence: "" };
    }
    if (item && typeof item === "object") {
      return {
        description: item.description || item.decision || item.content || JSON.stringify(item),
        evidence: item.evidence || ""
      };
    }
    return { description: String(item || ""), evidence: "" };
  }
  function _normalizeThemeCluster(item) {
    if (typeof item === "string") {
      return { theme: item, keywords: [] };
    }
    if (item && typeof item === "object") {
      return {
        theme: item.theme || item.name || item.title || item.topic || JSON.stringify(item),
        keywords: Array.isArray(item.keywords) ? item.keywords : []
      };
    }
    return { theme: String(item || ""), keywords: [] };
  }
  function _normalizeHighlightItem(item) {
    if (typeof item === "string") {
      return { type: "", description: item };
    }
    if (item && typeof item === "object") {
      return {
        type: item.type || item.category || "",
        description: item.description || item.content || item.text || JSON.stringify(item)
      };
    }
    return { type: "", description: String(item || "") };
  }
  function _normalizeMemoryUpdate(item) {
    if (typeof item === "string") {
      return { statement: item, is_update: false };
    }
    if (item && typeof item === "object") {
      return {
        statement: item.statement || item.fact || item.content || item.description || JSON.stringify(item),
        is_update: Boolean(item.is_update)
      };
    }
    return { statement: String(item || ""), is_update: false };
  }
  function _normalizeActionItem(item) {
    if (typeof item === "string") {
      return { description: item, due: "", source: "" };
    }
    if (item && typeof item === "object") {
      return {
        description: item.description || item.task || item.content || JSON.stringify(item),
        due: item.due || "",
        source: item.source || ""
      };
    }
    return { description: String(item || ""), due: "", source: "" };
  }
  async function fetchSummaryList(options = {}) {
    const cfg = await getEchoMemConfig();
    const client = createClient(cfg);
    const engineId = options.engineId || DEFAULT_ENGINE_ID;
    const dailyUri = `echo://engine/${engineId}/memory/summary/daily`;
    const weeklyUri = `echo://engine/${engineId}/memory/summary/weekly`;
    const [dailyTree, weeklyTree] = await Promise.all([
      emptyTreeOnNotFound(client.fsTree(dailyUri, { maxDepth: 2 })),
      emptyTreeOnNotFound(client.fsTree(weeklyUri, { maxDepth: 2 }))
    ]);
    const dailyFiles = ((dailyTree == null ? void 0 : dailyTree.entries) || []).filter((e) => e.kind === "file" && e.uri.endsWith(".json")).map((e) => e.name.replace(".json", "")).sort();
    const weeklyFiles = ((weeklyTree == null ? void 0 : weeklyTree.entries) || []).filter((e) => e.kind === "file" && e.uri.endsWith(".json")).map((e) => e.name.replace(".json", "")).sort();
    return { daily: dailyFiles, weekly: weeklyFiles };
  }
  async function emptyTreeOnNotFound(request) {
    try {
      return await request;
    } catch (error) {
      if ((error == null ? void 0 : error.status) === 404) return { entries: [] };
      throw error;
    }
  }
  async function fetchDailySummary(dateStr, options = {}) {
    const cfg = await getEchoMemConfig();
    const client = createClient(cfg);
    const engineId = options.engineId || DEFAULT_ENGINE_ID;
    const uri = `echo://engine/${engineId}/memory/summary/daily/${dateStr}.json`;
    const text = await client.fsRead(uri);
    if (!text) return null;
    return parseSummary(JSON.parse(text));
  }
  async function fetchWeeklySummary(weekKey, options = {}) {
    const cfg = await getEchoMemConfig();
    const client = createClient(cfg);
    const engineId = options.engineId || DEFAULT_ENGINE_ID;
    const uri = `echo://engine/${engineId}/memory/summary/weekly/${weekKey}.json`;
    const text = await client.fsRead(uri);
    if (!text) return null;
    return parseSummary(JSON.parse(text));
  }

  // ../EchoMEM-WEB-EXTENSION/node_modules/swiper/shared/ssr-window.esm.mjs
  function isObject(obj) {
    return obj !== null && typeof obj === "object" && "constructor" in obj && obj.constructor === Object;
  }
  function extend(target = {}, src = {}) {
    const noExtend = ["__proto__", "constructor", "prototype"];
    Object.keys(src).filter((key) => noExtend.indexOf(key) < 0).forEach((key) => {
      if (typeof target[key] === "undefined") target[key] = src[key];
      else if (isObject(src[key]) && isObject(target[key]) && Object.keys(src[key]).length > 0) {
        extend(target[key], src[key]);
      }
    });
  }
  var ssrDocument = {
    body: {},
    addEventListener() {
    },
    removeEventListener() {
    },
    activeElement: {
      blur() {
      },
      nodeName: ""
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
    createEvent() {
      return {
        initEvent() {
        }
      };
    },
    createElement() {
      return {
        children: [],
        childNodes: [],
        style: {},
        setAttribute() {
        },
        getElementsByTagName() {
          return [];
        }
      };
    },
    createElementNS() {
      return {};
    },
    importNode() {
      return null;
    },
    location: {
      hash: "",
      host: "",
      hostname: "",
      href: "",
      origin: "",
      pathname: "",
      protocol: "",
      search: ""
    }
  };
  function getDocument() {
    const doc = typeof document !== "undefined" ? document : {};
    extend(doc, ssrDocument);
    return doc;
  }
  var ssrWindow = {
    document: ssrDocument,
    navigator: {
      userAgent: ""
    },
    location: {
      hash: "",
      host: "",
      hostname: "",
      href: "",
      origin: "",
      pathname: "",
      protocol: "",
      search: ""
    },
    history: {
      replaceState() {
      },
      pushState() {
      },
      go() {
      },
      back() {
      }
    },
    CustomEvent: function CustomEvent() {
      return this;
    },
    addEventListener() {
    },
    removeEventListener() {
    },
    getComputedStyle() {
      return {
        getPropertyValue() {
          return "";
        }
      };
    },
    Image() {
    },
    Date() {
    },
    screen: {},
    setTimeout() {
    },
    clearTimeout() {
    },
    matchMedia() {
      return {};
    },
    requestAnimationFrame(callback) {
      if (typeof setTimeout === "undefined") {
        callback();
        return null;
      }
      return setTimeout(callback, 0);
    },
    cancelAnimationFrame(id) {
      if (typeof setTimeout === "undefined") {
        return;
      }
      clearTimeout(id);
    }
  };
  function getWindow() {
    const win = typeof window !== "undefined" ? window : {};
    extend(win, ssrWindow);
    return win;
  }

  // ../EchoMEM-WEB-EXTENSION/node_modules/swiper/shared/utils.mjs
  function classesToTokens(classes2 = "") {
    return classes2.trim().split(" ").filter((c) => !!c.trim());
  }
  function deleteProps(obj) {
    const object = obj;
    Object.keys(object).forEach((key) => {
      try {
        object[key] = null;
      } catch (e) {
      }
      try {
        delete object[key];
      } catch (e) {
      }
    });
  }
  function nextTick(callback, delay = 0) {
    return setTimeout(callback, delay);
  }
  function now() {
    return Date.now();
  }
  function getComputedStyle2(el) {
    const window2 = getWindow();
    let style;
    if (window2.getComputedStyle) {
      style = window2.getComputedStyle(el, null);
    }
    if (!style && el.currentStyle) {
      style = el.currentStyle;
    }
    if (!style) {
      style = el.style;
    }
    return style;
  }
  function getTranslate(el, axis = "x") {
    const window2 = getWindow();
    let matrix;
    let curTransform;
    let transformMatrix;
    const curStyle = getComputedStyle2(el);
    if (window2.WebKitCSSMatrix) {
      curTransform = curStyle.transform || curStyle.webkitTransform;
      if (curTransform.split(",").length > 6) {
        curTransform = curTransform.split(", ").map((a) => a.replace(",", ".")).join(", ");
      }
      transformMatrix = new window2.WebKitCSSMatrix(curTransform === "none" ? "" : curTransform);
    } else {
      transformMatrix = curStyle.MozTransform || curStyle.OTransform || curStyle.MsTransform || curStyle.msTransform || curStyle.transform || curStyle.getPropertyValue("transform").replace("translate(", "matrix(1, 0, 0, 1,");
      matrix = transformMatrix.toString().split(",");
    }
    if (axis === "x") {
      if (window2.WebKitCSSMatrix) curTransform = transformMatrix.m41;
      else if (matrix.length === 16) curTransform = parseFloat(matrix[12]);
      else curTransform = parseFloat(matrix[4]);
    }
    if (axis === "y") {
      if (window2.WebKitCSSMatrix) curTransform = transformMatrix.m42;
      else if (matrix.length === 16) curTransform = parseFloat(matrix[13]);
      else curTransform = parseFloat(matrix[5]);
    }
    return curTransform || 0;
  }
  function isObject2(o) {
    return typeof o === "object" && o !== null && o.constructor && Object.prototype.toString.call(o).slice(8, -1) === "Object";
  }
  function isNode(node2) {
    if (typeof window !== "undefined" && typeof window.HTMLElement !== "undefined") {
      return node2 instanceof HTMLElement;
    }
    return node2 && (node2.nodeType === 1 || node2.nodeType === 11);
  }
  function extend2(...args) {
    const to = Object(args[0]);
    for (let i = 1; i < args.length; i += 1) {
      const nextSource = args[i];
      if (nextSource !== void 0 && nextSource !== null && !isNode(nextSource)) {
        const keysArray = Object.keys(Object(nextSource)).filter((key) => key !== "__proto__" && key !== "constructor" && key !== "prototype");
        for (let nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex += 1) {
          const nextKey = keysArray[nextIndex];
          const desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if (desc !== void 0 && desc.enumerable) {
            if (isObject2(to[nextKey]) && isObject2(nextSource[nextKey])) {
              if (nextSource[nextKey].__swiper__) {
                to[nextKey] = nextSource[nextKey];
              } else {
                extend2(to[nextKey], nextSource[nextKey]);
              }
            } else if (!isObject2(to[nextKey]) && isObject2(nextSource[nextKey])) {
              to[nextKey] = {};
              if (nextSource[nextKey].__swiper__) {
                to[nextKey] = nextSource[nextKey];
              } else {
                extend2(to[nextKey], nextSource[nextKey]);
              }
            } else {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
    }
    return to;
  }
  function setCSSProperty(el, varName, varValue) {
    el.style.setProperty(varName, varValue);
  }
  function animateCSSModeScroll({
    swiper,
    targetPosition,
    side
  }) {
    const window2 = getWindow();
    const startPosition = -swiper.translate;
    let startTime = null;
    let time;
    const duration = swiper.params.speed;
    swiper.wrapperEl.style.scrollSnapType = "none";
    window2.cancelAnimationFrame(swiper.cssModeFrameID);
    const dir = targetPosition > startPosition ? "next" : "prev";
    const isOutOfBound = (current, target) => {
      return dir === "next" && current >= target || dir === "prev" && current <= target;
    };
    const animate = () => {
      time = (/* @__PURE__ */ new Date()).getTime();
      if (startTime === null) {
        startTime = time;
      }
      const progress = Math.max(Math.min((time - startTime) / duration, 1), 0);
      const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      let currentPosition = startPosition + easeProgress * (targetPosition - startPosition);
      if (isOutOfBound(currentPosition, targetPosition)) {
        currentPosition = targetPosition;
      }
      swiper.wrapperEl.scrollTo({
        [side]: currentPosition
      });
      if (isOutOfBound(currentPosition, targetPosition)) {
        swiper.wrapperEl.style.overflow = "hidden";
        swiper.wrapperEl.style.scrollSnapType = "";
        setTimeout(() => {
          swiper.wrapperEl.style.overflow = "";
          swiper.wrapperEl.scrollTo({
            [side]: currentPosition
          });
        });
        window2.cancelAnimationFrame(swiper.cssModeFrameID);
        return;
      }
      swiper.cssModeFrameID = window2.requestAnimationFrame(animate);
    };
    animate();
  }
  function elementChildren(element, selector = "") {
    const window2 = getWindow();
    const children = [...element.children];
    if (window2.HTMLSlotElement && element instanceof HTMLSlotElement) {
      children.push(...element.assignedElements());
    }
    if (!selector) {
      return children;
    }
    return children.filter((el) => el.matches(selector));
  }
  function elementIsChildOfSlot(el, slot) {
    const elementsQueue = [slot];
    while (elementsQueue.length > 0) {
      const elementToCheck = elementsQueue.shift();
      if (el === elementToCheck) {
        return true;
      }
      elementsQueue.push(...elementToCheck.children, ...elementToCheck.shadowRoot ? elementToCheck.shadowRoot.children : [], ...elementToCheck.assignedElements ? elementToCheck.assignedElements() : []);
    }
  }
  function elementIsChildOf(el, parent) {
    const window2 = getWindow();
    let isChild = parent.contains(el);
    if (!isChild && window2.HTMLSlotElement && parent instanceof HTMLSlotElement) {
      const children = [...parent.assignedElements()];
      isChild = children.includes(el);
      if (!isChild) {
        isChild = elementIsChildOfSlot(el, parent);
      }
    }
    return isChild;
  }
  function showWarning(text) {
    try {
      console.warn(text);
      return;
    } catch (err) {
    }
  }
  function createElement(tag, classes2 = []) {
    const el = document.createElement(tag);
    el.classList.add(...Array.isArray(classes2) ? classes2 : classesToTokens(classes2));
    return el;
  }
  function elementOffset(el) {
    const window2 = getWindow();
    const document2 = getDocument();
    const box = el.getBoundingClientRect();
    const body = document2.body;
    const clientTop = el.clientTop || body.clientTop || 0;
    const clientLeft = el.clientLeft || body.clientLeft || 0;
    const scrollTop = el === window2 ? window2.scrollY : el.scrollTop;
    const scrollLeft = el === window2 ? window2.scrollX : el.scrollLeft;
    return {
      top: box.top + scrollTop - clientTop,
      left: box.left + scrollLeft - clientLeft
    };
  }
  function elementPrevAll(el, selector) {
    const prevEls = [];
    while (el.previousElementSibling) {
      const prev = el.previousElementSibling;
      if (selector) {
        if (prev.matches(selector)) prevEls.push(prev);
      } else prevEls.push(prev);
      el = prev;
    }
    return prevEls;
  }
  function elementNextAll(el, selector) {
    const nextEls = [];
    while (el.nextElementSibling) {
      const next = el.nextElementSibling;
      if (selector) {
        if (next.matches(selector)) nextEls.push(next);
      } else nextEls.push(next);
      el = next;
    }
    return nextEls;
  }
  function elementStyle(el, prop) {
    const window2 = getWindow();
    return window2.getComputedStyle(el, null).getPropertyValue(prop);
  }
  function elementIndex(el) {
    let child = el;
    let i;
    if (child) {
      i = 0;
      while ((child = child.previousSibling) !== null) {
        if (child.nodeType === 1) i += 1;
      }
      return i;
    }
    return void 0;
  }
  function elementParents(el, selector) {
    const parents = [];
    let parent = el.parentElement;
    while (parent) {
      if (selector) {
        if (parent.matches(selector)) parents.push(parent);
      } else {
        parents.push(parent);
      }
      parent = parent.parentElement;
    }
    return parents;
  }
  function elementOuterSize(el, size, includeMargins) {
    const window2 = getWindow();
    if (includeMargins) {
      return el[size === "width" ? "offsetWidth" : "offsetHeight"] + parseFloat(window2.getComputedStyle(el, null).getPropertyValue(size === "width" ? "margin-right" : "margin-top")) + parseFloat(window2.getComputedStyle(el, null).getPropertyValue(size === "width" ? "margin-left" : "margin-bottom"));
    }
    return el.offsetWidth;
  }
  function makeElementsArray(el) {
    return (Array.isArray(el) ? el : [el]).filter((e) => !!e);
  }
  function setInnerHTML(el, html = "") {
    if (typeof trustedTypes !== "undefined") {
      el.innerHTML = trustedTypes.createPolicy("html", {
        createHTML: (s) => s
      }).createHTML(html);
    } else {
      el.innerHTML = html;
    }
  }

  // ../EchoMEM-WEB-EXTENSION/node_modules/swiper/shared/swiper-core.mjs
  var support;
  function calcSupport() {
    const window2 = getWindow();
    const document2 = getDocument();
    return {
      smoothScroll: document2.documentElement && document2.documentElement.style && "scrollBehavior" in document2.documentElement.style,
      touch: !!("ontouchstart" in window2 || window2.DocumentTouch && document2 instanceof window2.DocumentTouch)
    };
  }
  function getSupport() {
    if (!support) {
      support = calcSupport();
    }
    return support;
  }
  var deviceCached;
  function calcDevice({
    userAgent
  } = {}) {
    const support2 = getSupport();
    const window2 = getWindow();
    const platform = window2.navigator.platform;
    const ua = userAgent || window2.navigator.userAgent;
    const device = {
      ios: false,
      android: false
    };
    const screenWidth = window2.screen.width;
    const screenHeight = window2.screen.height;
    const android = ua.match(/(Android);?[\s\/]+([\d.]+)?/);
    let ipad = ua.match(/(iPad)(?!\1).*OS\s([\d_]+)/);
    const ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/);
    const iphone = !ipad && ua.match(/(iPhone\sOS|iOS)\s([\d_]+)/);
    const windows = platform === "Win32";
    let macos = platform === "MacIntel";
    const iPadScreens = ["1024x1366", "1366x1024", "834x1194", "1194x834", "834x1112", "1112x834", "768x1024", "1024x768", "820x1180", "1180x820", "810x1080", "1080x810"];
    if (!ipad && macos && support2.touch && iPadScreens.indexOf(`${screenWidth}x${screenHeight}`) >= 0) {
      ipad = ua.match(/(Version)\/([\d.]+)/);
      if (!ipad) ipad = [0, 1, "13_0_0"];
      macos = false;
    }
    if (android && !windows) {
      device.os = "android";
      device.android = true;
    }
    if (ipad || iphone || ipod) {
      device.os = "ios";
      device.ios = true;
    }
    return device;
  }
  function getDevice(overrides = {}) {
    if (!deviceCached) {
      deviceCached = calcDevice(overrides);
    }
    return deviceCached;
  }
  var browser;
  function calcBrowser() {
    const window2 = getWindow();
    const device = getDevice();
    let needPerspectiveFix = false;
    function isSafari() {
      const ua = window2.navigator.userAgent.toLowerCase();
      return ua.indexOf("safari") >= 0 && ua.indexOf("chrome") < 0 && ua.indexOf("android") < 0;
    }
    if (isSafari()) {
      const ua = String(window2.navigator.userAgent);
      if (ua.includes("Version/")) {
        const [major, minor] = ua.split("Version/")[1].split(" ")[0].split(".").map((num) => Number(num));
        needPerspectiveFix = major < 16 || major === 16 && minor < 2;
      }
    }
    const isWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(window2.navigator.userAgent);
    const isSafariBrowser = isSafari();
    const need3dFix = isSafariBrowser || isWebView && device.ios;
    return {
      isSafari: needPerspectiveFix || isSafariBrowser,
      needPerspectiveFix,
      need3dFix,
      isWebView
    };
  }
  function getBrowser() {
    if (!browser) {
      browser = calcBrowser();
    }
    return browser;
  }
  function Resize({
    swiper,
    on,
    emit
  }) {
    const window2 = getWindow();
    let observer = null;
    let animationFrame = null;
    const resizeHandler = () => {
      if (!swiper || swiper.destroyed || !swiper.initialized) return;
      emit("beforeResize");
      emit("resize");
    };
    const createObserver = () => {
      if (!swiper || swiper.destroyed || !swiper.initialized) return;
      observer = new ResizeObserver((entries) => {
        animationFrame = window2.requestAnimationFrame(() => {
          const {
            width,
            height
          } = swiper;
          let newWidth = width;
          let newHeight = height;
          entries.forEach(({
            contentBoxSize,
            contentRect,
            target
          }) => {
            if (target && target !== swiper.el) return;
            newWidth = contentRect ? contentRect.width : (contentBoxSize[0] || contentBoxSize).inlineSize;
            newHeight = contentRect ? contentRect.height : (contentBoxSize[0] || contentBoxSize).blockSize;
          });
          if (newWidth !== width || newHeight !== height) {
            resizeHandler();
          }
        });
      });
      observer.observe(swiper.el);
    };
    const removeObserver = () => {
      if (animationFrame) {
        window2.cancelAnimationFrame(animationFrame);
      }
      if (observer && observer.unobserve && swiper.el) {
        observer.unobserve(swiper.el);
        observer = null;
      }
    };
    const orientationChangeHandler = () => {
      if (!swiper || swiper.destroyed || !swiper.initialized) return;
      emit("orientationchange");
    };
    on("init", () => {
      if (swiper.params.resizeObserver && typeof window2.ResizeObserver !== "undefined") {
        createObserver();
        return;
      }
      window2.addEventListener("resize", resizeHandler);
      window2.addEventListener("orientationchange", orientationChangeHandler);
    });
    on("destroy", () => {
      removeObserver();
      window2.removeEventListener("resize", resizeHandler);
      window2.removeEventListener("orientationchange", orientationChangeHandler);
    });
  }
  function Observer({
    swiper,
    extendParams,
    on,
    emit
  }) {
    const observers = [];
    const window2 = getWindow();
    const attach = (target, options = {}) => {
      const ObserverFunc = window2.MutationObserver || window2.WebkitMutationObserver;
      const observer = new ObserverFunc((mutations) => {
        if (swiper.__preventObserver__) return;
        if (mutations.length === 1) {
          emit("observerUpdate", mutations[0]);
          return;
        }
        const observerUpdate = function observerUpdate2() {
          emit("observerUpdate", mutations[0]);
        };
        if (window2.requestAnimationFrame) {
          window2.requestAnimationFrame(observerUpdate);
        } else {
          window2.setTimeout(observerUpdate, 0);
        }
      });
      observer.observe(target, {
        attributes: typeof options.attributes === "undefined" ? true : options.attributes,
        childList: swiper.isElement || (typeof options.childList === "undefined" ? true : options).childList,
        characterData: typeof options.characterData === "undefined" ? true : options.characterData
      });
      observers.push(observer);
    };
    const init = () => {
      if (!swiper.params.observer) return;
      if (swiper.params.observeParents) {
        const containerParents = elementParents(swiper.hostEl);
        for (let i = 0; i < containerParents.length; i += 1) {
          attach(containerParents[i]);
        }
      }
      attach(swiper.hostEl, {
        childList: swiper.params.observeSlideChildren
      });
      attach(swiper.wrapperEl, {
        attributes: false
      });
    };
    const destroy = () => {
      observers.forEach((observer) => {
        observer.disconnect();
      });
      observers.splice(0, observers.length);
    };
    extendParams({
      observer: false,
      observeParents: false,
      observeSlideChildren: false
    });
    on("init", init);
    on("destroy", destroy);
  }
  var eventsEmitter = {
    on(events2, handler, priority) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (typeof handler !== "function") return self;
      const method = priority ? "unshift" : "push";
      events2.split(" ").forEach((event2) => {
        if (!self.eventsListeners[event2]) self.eventsListeners[event2] = [];
        self.eventsListeners[event2][method](handler);
      });
      return self;
    },
    once(events2, handler, priority) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (typeof handler !== "function") return self;
      function onceHandler(...args) {
        self.off(events2, onceHandler);
        if (onceHandler.__emitterProxy) {
          delete onceHandler.__emitterProxy;
        }
        handler.apply(self, args);
      }
      onceHandler.__emitterProxy = handler;
      return self.on(events2, onceHandler, priority);
    },
    onAny(handler, priority) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (typeof handler !== "function") return self;
      const method = priority ? "unshift" : "push";
      if (self.eventsAnyListeners.indexOf(handler) < 0) {
        self.eventsAnyListeners[method](handler);
      }
      return self;
    },
    offAny(handler) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (!self.eventsAnyListeners) return self;
      const index = self.eventsAnyListeners.indexOf(handler);
      if (index >= 0) {
        self.eventsAnyListeners.splice(index, 1);
      }
      return self;
    },
    off(events2, handler) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (!self.eventsListeners) return self;
      events2.split(" ").forEach((event2) => {
        if (typeof handler === "undefined") {
          self.eventsListeners[event2] = [];
        } else if (self.eventsListeners[event2]) {
          self.eventsListeners[event2].forEach((eventHandler, index) => {
            if (eventHandler === handler || eventHandler.__emitterProxy && eventHandler.__emitterProxy === handler) {
              self.eventsListeners[event2].splice(index, 1);
            }
          });
        }
      });
      return self;
    },
    emit(...args) {
      const self = this;
      if (!self.eventsListeners || self.destroyed) return self;
      if (!self.eventsListeners) return self;
      let events2;
      let data;
      let context;
      if (typeof args[0] === "string" || Array.isArray(args[0])) {
        events2 = args[0];
        data = args.slice(1, args.length);
        context = self;
      } else {
        events2 = args[0].events;
        data = args[0].data;
        context = args[0].context || self;
      }
      data.unshift(context);
      const eventsArray = Array.isArray(events2) ? events2 : events2.split(" ");
      eventsArray.forEach((event2) => {
        if (self.eventsAnyListeners && self.eventsAnyListeners.length) {
          self.eventsAnyListeners.forEach((eventHandler) => {
            eventHandler.apply(context, [event2, ...data]);
          });
        }
        if (self.eventsListeners && self.eventsListeners[event2]) {
          self.eventsListeners[event2].forEach((eventHandler) => {
            eventHandler.apply(context, data);
          });
        }
      });
      return self;
    }
  };
  function updateSize() {
    const swiper = this;
    let width;
    let height;
    const el = swiper.el;
    if (typeof swiper.params.width !== "undefined" && swiper.params.width !== null) {
      width = swiper.params.width;
    } else {
      width = el.clientWidth;
    }
    if (typeof swiper.params.height !== "undefined" && swiper.params.height !== null) {
      height = swiper.params.height;
    } else {
      height = el.clientHeight;
    }
    if (width === 0 && swiper.isHorizontal() || height === 0 && swiper.isVertical()) {
      return;
    }
    width = width - parseInt(elementStyle(el, "padding-left") || 0, 10) - parseInt(elementStyle(el, "padding-right") || 0, 10);
    height = height - parseInt(elementStyle(el, "padding-top") || 0, 10) - parseInt(elementStyle(el, "padding-bottom") || 0, 10);
    if (Number.isNaN(width)) width = 0;
    if (Number.isNaN(height)) height = 0;
    Object.assign(swiper, {
      width,
      height,
      size: swiper.isHorizontal() ? width : height
    });
  }
  function updateSlides() {
    const swiper = this;
    function getDirectionPropertyValue(node2, label) {
      return parseFloat(node2.getPropertyValue(swiper.getDirectionLabel(label)) || 0);
    }
    const params = swiper.params;
    const {
      wrapperEl,
      slidesEl,
      rtlTranslate: rtl,
      wrongRTL
    } = swiper;
    const isVirtual = swiper.virtual && params.virtual.enabled;
    const previousSlidesLength = isVirtual ? swiper.virtual.slides.length : swiper.slides.length;
    const slides = elementChildren(slidesEl, `.${swiper.params.slideClass}, swiper-slide`);
    const slidesLength = isVirtual ? swiper.virtual.slides.length : slides.length;
    let snapGrid = [];
    const slidesGrid = [];
    const slidesSizesGrid = [];
    let offsetBefore = params.slidesOffsetBefore;
    if (typeof offsetBefore === "function") {
      offsetBefore = params.slidesOffsetBefore.call(swiper);
    }
    let offsetAfter = params.slidesOffsetAfter;
    if (typeof offsetAfter === "function") {
      offsetAfter = params.slidesOffsetAfter.call(swiper);
    }
    const previousSnapGridLength = swiper.snapGrid.length;
    const previousSlidesGridLength = swiper.slidesGrid.length;
    const swiperSize = swiper.size - offsetBefore - offsetAfter;
    let spaceBetween = params.spaceBetween;
    let slidePosition = -offsetBefore;
    let prevSlideSize = 0;
    let index = 0;
    if (typeof swiperSize === "undefined") {
      return;
    }
    if (typeof spaceBetween === "string" && spaceBetween.indexOf("%") >= 0) {
      spaceBetween = parseFloat(spaceBetween.replace("%", "")) / 100 * swiperSize;
    } else if (typeof spaceBetween === "string") {
      spaceBetween = parseFloat(spaceBetween);
    }
    swiper.virtualSize = -spaceBetween - offsetBefore - offsetAfter;
    slides.forEach((slideEl) => {
      if (rtl) {
        slideEl.style.marginLeft = "";
      } else {
        slideEl.style.marginRight = "";
      }
      slideEl.style.marginBottom = "";
      slideEl.style.marginTop = "";
    });
    if (params.centeredSlides && params.cssMode) {
      setCSSProperty(wrapperEl, "--swiper-centered-offset-before", "");
      setCSSProperty(wrapperEl, "--swiper-centered-offset-after", "");
    }
    if (params.cssMode) {
      setCSSProperty(wrapperEl, "--swiper-slides-offset-before", `${offsetBefore}px`);
      setCSSProperty(wrapperEl, "--swiper-slides-offset-after", `${offsetAfter}px`);
    }
    const gridEnabled = params.grid && params.grid.rows > 1 && swiper.grid;
    if (gridEnabled) {
      swiper.grid.initSlides(slides);
    } else if (swiper.grid) {
      swiper.grid.unsetSlides();
    }
    let slideSize;
    const shouldResetSlideSize = params.slidesPerView === "auto" && params.breakpoints && Object.keys(params.breakpoints).filter((key) => {
      return typeof params.breakpoints[key].slidesPerView !== "undefined";
    }).length > 0;
    for (let i = 0; i < slidesLength; i += 1) {
      slideSize = 0;
      const slide2 = slides[i];
      if (slide2) {
        if (gridEnabled) {
          swiper.grid.updateSlide(i, slide2, slides);
        }
        if (elementStyle(slide2, "display") === "none") continue;
      }
      if (isVirtual && params.slidesPerView === "auto") {
        if (params.virtual.slidesPerViewAutoSlideSize) {
          slideSize = params.virtual.slidesPerViewAutoSlideSize;
        }
        if (slideSize && slide2) {
          if (params.roundLengths) slideSize = Math.floor(slideSize);
          slide2.style[swiper.getDirectionLabel("width")] = `${slideSize}px`;
        }
      } else if (params.slidesPerView === "auto") {
        if (shouldResetSlideSize) {
          slide2.style[swiper.getDirectionLabel("width")] = ``;
        }
        const slideStyles = getComputedStyle(slide2);
        const currentTransform = slide2.style.transform;
        const currentWebKitTransform = slide2.style.webkitTransform;
        if (currentTransform) {
          slide2.style.transform = "none";
        }
        if (currentWebKitTransform) {
          slide2.style.webkitTransform = "none";
        }
        if (params.roundLengths) {
          slideSize = swiper.isHorizontal() ? elementOuterSize(slide2, "width", true) : elementOuterSize(slide2, "height", true);
        } else {
          const width = getDirectionPropertyValue(slideStyles, "width");
          const paddingLeft = getDirectionPropertyValue(slideStyles, "padding-left");
          const paddingRight = getDirectionPropertyValue(slideStyles, "padding-right");
          const marginLeft = getDirectionPropertyValue(slideStyles, "margin-left");
          const marginRight = getDirectionPropertyValue(slideStyles, "margin-right");
          const boxSizing = slideStyles.getPropertyValue("box-sizing");
          if (boxSizing && boxSizing === "border-box") {
            slideSize = width + marginLeft + marginRight;
          } else {
            const {
              clientWidth,
              offsetWidth
            } = slide2;
            slideSize = width + paddingLeft + paddingRight + marginLeft + marginRight + (offsetWidth - clientWidth);
          }
        }
        if (currentTransform) {
          slide2.style.transform = currentTransform;
        }
        if (currentWebKitTransform) {
          slide2.style.webkitTransform = currentWebKitTransform;
        }
        if (params.roundLengths) slideSize = Math.floor(slideSize);
      } else {
        slideSize = (swiperSize - (params.slidesPerView - 1) * spaceBetween) / params.slidesPerView;
        if (params.roundLengths) slideSize = Math.floor(slideSize);
        if (slide2) {
          slide2.style[swiper.getDirectionLabel("width")] = `${slideSize}px`;
        }
      }
      if (slide2) {
        slide2.swiperSlideSize = slideSize;
      }
      slidesSizesGrid.push(slideSize);
      if (params.centeredSlides) {
        slidePosition = slidePosition + slideSize / 2 + prevSlideSize / 2 + spaceBetween;
        if (prevSlideSize === 0 && i !== 0) slidePosition = slidePosition - swiperSize / 2 - spaceBetween;
        if (i === 0) slidePosition = slidePosition - swiperSize / 2 - spaceBetween;
        if (Math.abs(slidePosition) < 1 / 1e3) slidePosition = 0;
        if (params.roundLengths) slidePosition = Math.floor(slidePosition);
        if (index % params.slidesPerGroup === 0) snapGrid.push(slidePosition);
        slidesGrid.push(slidePosition);
      } else {
        if (params.roundLengths) slidePosition = Math.floor(slidePosition);
        if ((index - Math.min(swiper.params.slidesPerGroupSkip, index)) % swiper.params.slidesPerGroup === 0) snapGrid.push(slidePosition);
        slidesGrid.push(slidePosition);
        slidePosition = slidePosition + slideSize + spaceBetween;
      }
      swiper.virtualSize += slideSize + spaceBetween;
      prevSlideSize = slideSize;
      index += 1;
    }
    swiper.virtualSize = Math.max(swiper.virtualSize, swiperSize) + offsetAfter;
    if (rtl && wrongRTL && (params.effect === "slide" || params.effect === "coverflow")) {
      wrapperEl.style.width = `${swiper.virtualSize + spaceBetween}px`;
    }
    if (params.setWrapperSize) {
      wrapperEl.style[swiper.getDirectionLabel("width")] = `${swiper.virtualSize + spaceBetween}px`;
    }
    if (gridEnabled) {
      swiper.grid.updateWrapperSize(slideSize, snapGrid);
    }
    if (!params.centeredSlides) {
      const isFractionalSlidesPerView = params.slidesPerView !== "auto" && params.slidesPerView % 1 !== 0;
      const shouldSnapToSlideEdge = params.snapToSlideEdge && !params.loop && (params.slidesPerView === "auto" || isFractionalSlidesPerView);
      let lastAllowedSnapIndex = snapGrid.length;
      if (shouldSnapToSlideEdge) {
        let minVisibleSlides;
        if (params.slidesPerView === "auto") {
          minVisibleSlides = 1;
          let accumulatedSize = 0;
          for (let i = slidesSizesGrid.length - 1; i >= 0; i -= 1) {
            accumulatedSize += slidesSizesGrid[i] + (i < slidesSizesGrid.length - 1 ? spaceBetween : 0);
            if (accumulatedSize <= swiperSize) {
              minVisibleSlides = slidesSizesGrid.length - i;
            } else {
              break;
            }
          }
        } else {
          minVisibleSlides = Math.floor(params.slidesPerView);
        }
        lastAllowedSnapIndex = Math.max(slidesLength - minVisibleSlides, 0);
      }
      const newSlidesGrid = [];
      for (let i = 0; i < snapGrid.length; i += 1) {
        let slidesGridItem = snapGrid[i];
        if (params.roundLengths) slidesGridItem = Math.floor(slidesGridItem);
        if (shouldSnapToSlideEdge) {
          if (i <= lastAllowedSnapIndex) {
            newSlidesGrid.push(slidesGridItem);
          }
        } else if (snapGrid[i] <= swiper.virtualSize - swiperSize) {
          newSlidesGrid.push(slidesGridItem);
        }
      }
      snapGrid = newSlidesGrid;
      if (Math.floor(swiper.virtualSize - swiperSize) - Math.floor(snapGrid[snapGrid.length - 1]) > 1) {
        if (!shouldSnapToSlideEdge) {
          snapGrid.push(swiper.virtualSize - swiperSize);
        }
      }
    }
    if (isVirtual && params.loop) {
      const size = slidesSizesGrid[0] + spaceBetween;
      if (params.slidesPerGroup > 1) {
        const groups = Math.ceil((swiper.virtual.slidesBefore + swiper.virtual.slidesAfter) / params.slidesPerGroup);
        const groupSize = size * params.slidesPerGroup;
        for (let i = 0; i < groups; i += 1) {
          snapGrid.push(snapGrid[snapGrid.length - 1] + groupSize);
        }
      }
      for (let i = 0; i < swiper.virtual.slidesBefore + swiper.virtual.slidesAfter; i += 1) {
        if (params.slidesPerGroup === 1) {
          snapGrid.push(snapGrid[snapGrid.length - 1] + size);
        }
        slidesGrid.push(slidesGrid[slidesGrid.length - 1] + size);
        swiper.virtualSize += size;
      }
    }
    if (snapGrid.length === 0) snapGrid = [0];
    if (spaceBetween !== 0) {
      const key = swiper.isHorizontal() && rtl ? "marginLeft" : swiper.getDirectionLabel("marginRight");
      slides.filter((_, slideIndex) => {
        if (!params.cssMode || params.loop) return true;
        if (slideIndex === slides.length - 1) {
          return false;
        }
        return true;
      }).forEach((slideEl) => {
        slideEl.style[key] = `${spaceBetween}px`;
      });
    }
    if (params.centeredSlides && params.centeredSlidesBounds) {
      let allSlidesSize = 0;
      slidesSizesGrid.forEach((slideSizeValue) => {
        allSlidesSize += slideSizeValue + (spaceBetween || 0);
      });
      allSlidesSize -= spaceBetween;
      const maxSnap = allSlidesSize > swiperSize ? allSlidesSize - swiperSize : 0;
      snapGrid = snapGrid.map((snap) => {
        if (snap <= 0) return -offsetBefore;
        if (snap > maxSnap) return maxSnap + offsetAfter;
        return snap;
      });
    }
    if (params.centerInsufficientSlides) {
      let allSlidesSize = 0;
      slidesSizesGrid.forEach((slideSizeValue) => {
        allSlidesSize += slideSizeValue + (spaceBetween || 0);
      });
      allSlidesSize -= spaceBetween;
      if (allSlidesSize < swiperSize) {
        const allSlidesOffset = (swiperSize - allSlidesSize) / 2;
        snapGrid.forEach((snap, snapIndex) => {
          snapGrid[snapIndex] = snap - allSlidesOffset;
        });
        slidesGrid.forEach((snap, snapIndex) => {
          slidesGrid[snapIndex] = snap + allSlidesOffset;
        });
      }
    }
    Object.assign(swiper, {
      slides,
      snapGrid,
      slidesGrid,
      slidesSizesGrid
    });
    if (params.centeredSlides && params.cssMode && !params.centeredSlidesBounds) {
      setCSSProperty(wrapperEl, "--swiper-centered-offset-before", `${-snapGrid[0]}px`);
      setCSSProperty(wrapperEl, "--swiper-centered-offset-after", `${swiper.size / 2 - slidesSizesGrid[slidesSizesGrid.length - 1] / 2}px`);
      const addToSnapGrid = -swiper.snapGrid[0];
      const addToSlidesGrid = -swiper.slidesGrid[0];
      swiper.snapGrid = swiper.snapGrid.map((v) => v + addToSnapGrid);
      swiper.slidesGrid = swiper.slidesGrid.map((v) => v + addToSlidesGrid);
    }
    if (slidesLength !== previousSlidesLength) {
      swiper.emit("slidesLengthChange");
    }
    if (snapGrid.length !== previousSnapGridLength) {
      if (swiper.params.watchOverflow) swiper.checkOverflow();
      swiper.emit("snapGridLengthChange");
    }
    if (slidesGrid.length !== previousSlidesGridLength) {
      swiper.emit("slidesGridLengthChange");
    }
    if (params.watchSlidesProgress) {
      swiper.updateSlidesOffset();
    }
    swiper.emit("slidesUpdated");
    if (!isVirtual && !params.cssMode && (params.effect === "slide" || params.effect === "fade")) {
      const backFaceHiddenClass = `${params.containerModifierClass}backface-hidden`;
      const hasClassBackfaceClassAdded = swiper.el.classList.contains(backFaceHiddenClass);
      if (slidesLength <= params.maxBackfaceHiddenSlides) {
        if (!hasClassBackfaceClassAdded) swiper.el.classList.add(backFaceHiddenClass);
      } else if (hasClassBackfaceClassAdded) {
        swiper.el.classList.remove(backFaceHiddenClass);
      }
    }
  }
  function updateAutoHeight(speed) {
    const swiper = this;
    const activeSlides = [];
    const isVirtual = swiper.virtual && swiper.params.virtual.enabled;
    let newHeight = 0;
    let i;
    if (typeof speed === "number") {
      swiper.setTransition(speed);
    } else if (speed === true) {
      swiper.setTransition(swiper.params.speed);
    }
    const getSlideByIndex = (index) => {
      if (isVirtual) {
        return swiper.slides[swiper.getSlideIndexByData(index)];
      }
      return swiper.slides[index];
    };
    if (swiper.params.slidesPerView !== "auto" && swiper.params.slidesPerView > 1) {
      if (swiper.params.centeredSlides) {
        (swiper.visibleSlides || []).forEach((slide2) => {
          activeSlides.push(slide2);
        });
      } else {
        for (i = 0; i < Math.ceil(swiper.params.slidesPerView); i += 1) {
          const index = swiper.activeIndex + i;
          if (index > swiper.slides.length && !isVirtual) break;
          activeSlides.push(getSlideByIndex(index));
        }
      }
    } else {
      activeSlides.push(getSlideByIndex(swiper.activeIndex));
    }
    for (i = 0; i < activeSlides.length; i += 1) {
      if (typeof activeSlides[i] !== "undefined") {
        const height = activeSlides[i].offsetHeight;
        newHeight = height > newHeight ? height : newHeight;
      }
    }
    if (newHeight || newHeight === 0) swiper.wrapperEl.style.height = `${newHeight}px`;
  }
  function updateSlidesOffset() {
    const swiper = this;
    const slides = swiper.slides;
    const minusOffset = swiper.isElement ? swiper.isHorizontal() ? swiper.wrapperEl.offsetLeft : swiper.wrapperEl.offsetTop : 0;
    for (let i = 0; i < slides.length; i += 1) {
      slides[i].swiperSlideOffset = (swiper.isHorizontal() ? slides[i].offsetLeft : slides[i].offsetTop) - minusOffset - swiper.cssOverflowAdjustment();
    }
  }
  var toggleSlideClasses$1 = (slideEl, condition, className) => {
    if (condition && !slideEl.classList.contains(className)) {
      slideEl.classList.add(className);
    } else if (!condition && slideEl.classList.contains(className)) {
      slideEl.classList.remove(className);
    }
  };
  function updateSlidesProgress(translate2 = this && this.translate || 0) {
    const swiper = this;
    const params = swiper.params;
    const {
      slides,
      rtlTranslate: rtl,
      snapGrid
    } = swiper;
    if (slides.length === 0) return;
    if (typeof slides[0].swiperSlideOffset === "undefined") swiper.updateSlidesOffset();
    let offsetCenter = -translate2;
    if (rtl) offsetCenter = translate2;
    swiper.visibleSlidesIndexes = [];
    swiper.visibleSlides = [];
    let spaceBetween = params.spaceBetween;
    if (typeof spaceBetween === "string" && spaceBetween.indexOf("%") >= 0) {
      spaceBetween = parseFloat(spaceBetween.replace("%", "")) / 100 * swiper.size;
    } else if (typeof spaceBetween === "string") {
      spaceBetween = parseFloat(spaceBetween);
    }
    for (let i = 0; i < slides.length; i += 1) {
      const slide2 = slides[i];
      let slideOffset = slide2.swiperSlideOffset;
      if (params.cssMode && params.centeredSlides) {
        slideOffset -= slides[0].swiperSlideOffset;
      }
      const slideProgress = (offsetCenter + (params.centeredSlides ? swiper.minTranslate() : 0) - slideOffset) / (slide2.swiperSlideSize + spaceBetween);
      const originalSlideProgress = (offsetCenter - snapGrid[0] + (params.centeredSlides ? swiper.minTranslate() : 0) - slideOffset) / (slide2.swiperSlideSize + spaceBetween);
      const slideBefore = -(offsetCenter - slideOffset);
      const slideAfter = slideBefore + swiper.slidesSizesGrid[i];
      const isFullyVisible = slideBefore >= 0 && slideBefore <= swiper.size - swiper.slidesSizesGrid[i];
      const isVisible = slideBefore >= 0 && slideBefore < swiper.size - 1 || slideAfter > 1 && slideAfter <= swiper.size || slideBefore <= 0 && slideAfter >= swiper.size;
      if (isVisible) {
        swiper.visibleSlides.push(slide2);
        swiper.visibleSlidesIndexes.push(i);
      }
      toggleSlideClasses$1(slide2, isVisible, params.slideVisibleClass);
      toggleSlideClasses$1(slide2, isFullyVisible, params.slideFullyVisibleClass);
      slide2.progress = rtl ? -slideProgress : slideProgress;
      slide2.originalProgress = rtl ? -originalSlideProgress : originalSlideProgress;
    }
  }
  function updateProgress(translate2) {
    const swiper = this;
    if (typeof translate2 === "undefined") {
      const multiplier = swiper.rtlTranslate ? -1 : 1;
      translate2 = swiper && swiper.translate && swiper.translate * multiplier || 0;
    }
    const params = swiper.params;
    const translatesDiff = swiper.maxTranslate() - swiper.minTranslate();
    let {
      progress,
      isBeginning,
      isEnd,
      progressLoop
    } = swiper;
    const wasBeginning = isBeginning;
    const wasEnd = isEnd;
    if (translatesDiff === 0) {
      progress = 0;
      isBeginning = true;
      isEnd = true;
    } else {
      progress = (translate2 - swiper.minTranslate()) / translatesDiff;
      const isBeginningRounded = Math.abs(translate2 - swiper.minTranslate()) < 1;
      const isEndRounded = Math.abs(translate2 - swiper.maxTranslate()) < 1;
      isBeginning = isBeginningRounded || progress <= 0;
      isEnd = isEndRounded || progress >= 1;
      if (isBeginningRounded) progress = 0;
      if (isEndRounded) progress = 1;
    }
    if (params.loop) {
      const firstSlideIndex = swiper.getSlideIndexByData(0);
      const lastSlideIndex = swiper.getSlideIndexByData(swiper.slides.length - 1);
      const firstSlideTranslate = swiper.slidesGrid[firstSlideIndex];
      const lastSlideTranslate = swiper.slidesGrid[lastSlideIndex];
      const translateMax = swiper.slidesGrid[swiper.slidesGrid.length - 1];
      const translateAbs = Math.abs(translate2);
      if (translateAbs >= firstSlideTranslate) {
        progressLoop = (translateAbs - firstSlideTranslate) / translateMax;
      } else {
        progressLoop = (translateAbs + translateMax - lastSlideTranslate) / translateMax;
      }
      if (progressLoop > 1) progressLoop -= 1;
    }
    Object.assign(swiper, {
      progress,
      progressLoop,
      isBeginning,
      isEnd
    });
    if (params.watchSlidesProgress || params.centeredSlides && params.autoHeight) swiper.updateSlidesProgress(translate2);
    if (isBeginning && !wasBeginning) {
      swiper.emit("reachBeginning toEdge");
    }
    if (isEnd && !wasEnd) {
      swiper.emit("reachEnd toEdge");
    }
    if (wasBeginning && !isBeginning || wasEnd && !isEnd) {
      swiper.emit("fromEdge");
    }
    swiper.emit("progress", progress);
  }
  var toggleSlideClasses = (slideEl, condition, className) => {
    if (condition && !slideEl.classList.contains(className)) {
      slideEl.classList.add(className);
    } else if (!condition && slideEl.classList.contains(className)) {
      slideEl.classList.remove(className);
    }
  };
  function updateSlidesClasses() {
    const swiper = this;
    const {
      slides,
      params,
      slidesEl,
      activeIndex
    } = swiper;
    const isVirtual = swiper.virtual && params.virtual.enabled;
    const gridEnabled = swiper.grid && params.grid && params.grid.rows > 1;
    const getFilteredSlide = (selector) => {
      return elementChildren(slidesEl, `.${params.slideClass}${selector}, swiper-slide${selector}`)[0];
    };
    let activeSlide;
    let prevSlide;
    let nextSlide;
    if (isVirtual) {
      if (params.loop) {
        let slideIndex = activeIndex - swiper.virtual.slidesBefore;
        if (slideIndex < 0) slideIndex = swiper.virtual.slides.length + slideIndex;
        if (slideIndex >= swiper.virtual.slides.length) slideIndex -= swiper.virtual.slides.length;
        activeSlide = getFilteredSlide(`[data-swiper-slide-index="${slideIndex}"]`);
      } else {
        activeSlide = getFilteredSlide(`[data-swiper-slide-index="${activeIndex}"]`);
      }
    } else {
      if (gridEnabled) {
        activeSlide = slides.find((slideEl) => slideEl.column === activeIndex);
        nextSlide = slides.find((slideEl) => slideEl.column === activeIndex + 1);
        prevSlide = slides.find((slideEl) => slideEl.column === activeIndex - 1);
      } else {
        activeSlide = slides[activeIndex];
      }
    }
    if (activeSlide) {
      if (!gridEnabled) {
        nextSlide = elementNextAll(activeSlide, `.${params.slideClass}, swiper-slide`)[0];
        if (params.loop && !nextSlide) {
          nextSlide = slides[0];
        }
        prevSlide = elementPrevAll(activeSlide, `.${params.slideClass}, swiper-slide`)[0];
        if (params.loop && !prevSlide === 0) {
          prevSlide = slides[slides.length - 1];
        }
      }
    }
    slides.forEach((slideEl) => {
      toggleSlideClasses(slideEl, slideEl === activeSlide, params.slideActiveClass);
      toggleSlideClasses(slideEl, slideEl === nextSlide, params.slideNextClass);
      toggleSlideClasses(slideEl, slideEl === prevSlide, params.slidePrevClass);
    });
    swiper.emitSlidesClasses();
  }
  var processLazyPreloader = (swiper, imageEl) => {
    if (!swiper || swiper.destroyed || !swiper.params) return;
    const slideSelector = () => swiper.isElement ? `swiper-slide` : `.${swiper.params.slideClass}`;
    const slideEl = imageEl.closest(slideSelector());
    if (slideEl) {
      let lazyEl = slideEl.querySelector(`.${swiper.params.lazyPreloaderClass}`);
      if (!lazyEl && swiper.isElement) {
        if (slideEl.shadowRoot) {
          lazyEl = slideEl.shadowRoot.querySelector(`.${swiper.params.lazyPreloaderClass}`);
        } else {
          requestAnimationFrame(() => {
            if (slideEl.shadowRoot) {
              lazyEl = slideEl.shadowRoot.querySelector(`.${swiper.params.lazyPreloaderClass}`);
              if (lazyEl && !lazyEl.lazyPreloaderManaged) lazyEl.remove();
            }
          });
        }
      }
      if (lazyEl && !lazyEl.lazyPreloaderManaged) lazyEl.remove();
    }
  };
  var unlazy = (swiper, index) => {
    if (!swiper.slides[index]) return;
    const imageEl = swiper.slides[index].querySelector('[loading="lazy"]');
    if (imageEl) imageEl.removeAttribute("loading");
  };
  var preload = (swiper) => {
    if (!swiper || swiper.destroyed || !swiper.params) return;
    let amount = swiper.params.lazyPreloadPrevNext;
    const len = swiper.slides.length;
    if (!len || !amount || amount < 0) return;
    amount = Math.min(amount, len);
    const slidesPerView = swiper.params.slidesPerView === "auto" ? swiper.slidesPerViewDynamic() : Math.ceil(swiper.params.slidesPerView);
    const activeIndex = swiper.activeIndex;
    if (swiper.params.grid && swiper.params.grid.rows > 1) {
      const activeColumn = activeIndex;
      const preloadColumns = [activeColumn - amount];
      preloadColumns.push(...Array.from({
        length: amount
      }).map((_, i) => {
        return activeColumn + slidesPerView + i;
      }));
      swiper.slides.forEach((slideEl, i) => {
        if (preloadColumns.includes(slideEl.column)) unlazy(swiper, i);
      });
      return;
    }
    const slideIndexLastInView = activeIndex + slidesPerView - 1;
    if (swiper.params.rewind || swiper.params.loop) {
      for (let i = activeIndex - amount; i <= slideIndexLastInView + amount; i += 1) {
        const realIndex = (i % len + len) % len;
        if (realIndex < activeIndex || realIndex > slideIndexLastInView) unlazy(swiper, realIndex);
      }
    } else {
      for (let i = Math.max(activeIndex - amount, 0); i <= Math.min(slideIndexLastInView + amount, len - 1); i += 1) {
        if (i !== activeIndex && (i > slideIndexLastInView || i < activeIndex)) {
          unlazy(swiper, i);
        }
      }
    }
  };
  function getActiveIndexByTranslate(swiper) {
    const {
      slidesGrid,
      params
    } = swiper;
    const translate2 = swiper.rtlTranslate ? swiper.translate : -swiper.translate;
    let activeIndex;
    for (let i = 0; i < slidesGrid.length; i += 1) {
      if (typeof slidesGrid[i + 1] !== "undefined") {
        if (translate2 >= slidesGrid[i] && translate2 < slidesGrid[i + 1] - (slidesGrid[i + 1] - slidesGrid[i]) / 2) {
          activeIndex = i;
        } else if (translate2 >= slidesGrid[i] && translate2 < slidesGrid[i + 1]) {
          activeIndex = i + 1;
        }
      } else if (translate2 >= slidesGrid[i]) {
        activeIndex = i;
      }
    }
    if (params.normalizeSlideIndex) {
      if (activeIndex < 0 || typeof activeIndex === "undefined") activeIndex = 0;
    }
    return activeIndex;
  }
  function updateActiveIndex(newActiveIndex) {
    const swiper = this;
    const translate2 = swiper.rtlTranslate ? swiper.translate : -swiper.translate;
    const {
      snapGrid,
      params,
      activeIndex: previousIndex,
      realIndex: previousRealIndex,
      snapIndex: previousSnapIndex
    } = swiper;
    let activeIndex = newActiveIndex;
    let snapIndex;
    const getVirtualRealIndex = (aIndex) => {
      let realIndex2 = aIndex - swiper.virtual.slidesBefore;
      if (realIndex2 < 0) {
        realIndex2 = swiper.virtual.slides.length + realIndex2;
      }
      if (realIndex2 >= swiper.virtual.slides.length) {
        realIndex2 -= swiper.virtual.slides.length;
      }
      return realIndex2;
    };
    if (typeof activeIndex === "undefined") {
      activeIndex = getActiveIndexByTranslate(swiper);
    }
    if (snapGrid.indexOf(translate2) >= 0) {
      snapIndex = snapGrid.indexOf(translate2);
    } else {
      const skip = Math.min(params.slidesPerGroupSkip, activeIndex);
      snapIndex = skip + Math.floor((activeIndex - skip) / params.slidesPerGroup);
    }
    if (snapIndex >= snapGrid.length) snapIndex = snapGrid.length - 1;
    if (activeIndex === previousIndex && !swiper.params.loop) {
      if (snapIndex !== previousSnapIndex) {
        swiper.snapIndex = snapIndex;
        swiper.emit("snapIndexChange");
      }
      return;
    }
    if (activeIndex === previousIndex && swiper.params.loop && swiper.virtual && swiper.params.virtual.enabled) {
      swiper.realIndex = getVirtualRealIndex(activeIndex);
      return;
    }
    const gridEnabled = swiper.grid && params.grid && params.grid.rows > 1;
    let realIndex;
    if (swiper.virtual && params.virtual.enabled) {
      if (params.loop) {
        realIndex = getVirtualRealIndex(activeIndex);
      } else {
        realIndex = activeIndex;
      }
    } else if (gridEnabled) {
      const firstSlideInColumn = swiper.slides.find((slideEl) => slideEl.column === activeIndex);
      let activeSlideIndex = parseInt(firstSlideInColumn.getAttribute("data-swiper-slide-index"), 10);
      if (Number.isNaN(activeSlideIndex)) {
        activeSlideIndex = Math.max(swiper.slides.indexOf(firstSlideInColumn), 0);
      }
      realIndex = Math.floor(activeSlideIndex / params.grid.rows);
    } else if (swiper.slides[activeIndex]) {
      const slideIndex = swiper.slides[activeIndex].getAttribute("data-swiper-slide-index");
      if (slideIndex) {
        realIndex = parseInt(slideIndex, 10);
      } else {
        realIndex = activeIndex;
      }
    } else {
      realIndex = activeIndex;
    }
    Object.assign(swiper, {
      previousSnapIndex,
      snapIndex,
      previousRealIndex,
      realIndex,
      previousIndex,
      activeIndex
    });
    if (swiper.initialized) {
      preload(swiper);
    }
    swiper.emit("activeIndexChange");
    swiper.emit("snapIndexChange");
    if (swiper.initialized || swiper.params.runCallbacksOnInit) {
      if (previousRealIndex !== realIndex) {
        swiper.emit("realIndexChange");
      }
      swiper.emit("slideChange");
    }
  }
  function updateClickedSlide(el, path) {
    const swiper = this;
    const params = swiper.params;
    let slide2 = el.closest(`.${params.slideClass}, swiper-slide`);
    if (!slide2 && swiper.isElement && path && path.length > 1 && path.includes(el)) {
      [...path.slice(path.indexOf(el) + 1, path.length)].forEach((pathEl) => {
        if (!slide2 && pathEl.matches && pathEl.matches(`.${params.slideClass}, swiper-slide`)) {
          slide2 = pathEl;
        }
      });
    }
    let slideFound = false;
    let slideIndex;
    if (slide2) {
      for (let i = 0; i < swiper.slides.length; i += 1) {
        if (swiper.slides[i] === slide2) {
          slideFound = true;
          slideIndex = i;
          break;
        }
      }
    }
    if (slide2 && slideFound) {
      swiper.clickedSlide = slide2;
      if (swiper.virtual && swiper.params.virtual.enabled) {
        swiper.clickedIndex = parseInt(slide2.getAttribute("data-swiper-slide-index"), 10);
      } else {
        swiper.clickedIndex = slideIndex;
      }
    } else {
      swiper.clickedSlide = void 0;
      swiper.clickedIndex = void 0;
      return;
    }
    if (params.slideToClickedSlide && swiper.clickedIndex !== void 0 && swiper.clickedIndex !== swiper.activeIndex) {
      swiper.slideToClickedSlide();
    }
  }
  var update = {
    updateSize,
    updateSlides,
    updateAutoHeight,
    updateSlidesOffset,
    updateSlidesProgress,
    updateProgress,
    updateSlidesClasses,
    updateActiveIndex,
    updateClickedSlide
  };
  function getSwiperTranslate(axis = this.isHorizontal() ? "x" : "y") {
    const swiper = this;
    const {
      params,
      rtlTranslate: rtl,
      translate: translate2,
      wrapperEl
    } = swiper;
    if (params.virtualTranslate) {
      return rtl ? -translate2 : translate2;
    }
    if (params.cssMode) {
      return translate2;
    }
    let currentTranslate = getTranslate(wrapperEl, axis);
    currentTranslate += swiper.cssOverflowAdjustment();
    if (rtl) currentTranslate = -currentTranslate;
    return currentTranslate || 0;
  }
  function setTranslate(translate2, byController) {
    const swiper = this;
    const {
      rtlTranslate: rtl,
      params,
      wrapperEl,
      progress
    } = swiper;
    let x = 0;
    let y = 0;
    const z = 0;
    if (swiper.isHorizontal()) {
      x = rtl ? -translate2 : translate2;
    } else {
      y = translate2;
    }
    if (params.roundLengths) {
      x = Math.floor(x);
      y = Math.floor(y);
    }
    swiper.previousTranslate = swiper.translate;
    swiper.translate = swiper.isHorizontal() ? x : y;
    if (params.cssMode) {
      wrapperEl[swiper.isHorizontal() ? "scrollLeft" : "scrollTop"] = swiper.isHorizontal() ? -x : -y;
    } else if (!params.virtualTranslate) {
      if (swiper.isHorizontal()) {
        x -= swiper.cssOverflowAdjustment();
      } else {
        y -= swiper.cssOverflowAdjustment();
      }
      wrapperEl.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
    }
    let newProgress;
    const translatesDiff = swiper.maxTranslate() - swiper.minTranslate();
    if (translatesDiff === 0) {
      newProgress = 0;
    } else {
      newProgress = (translate2 - swiper.minTranslate()) / translatesDiff;
    }
    if (newProgress !== progress) {
      swiper.updateProgress(translate2);
    }
    swiper.emit("setTranslate", swiper.translate, byController);
  }
  function minTranslate() {
    return -this.snapGrid[0];
  }
  function maxTranslate() {
    return -this.snapGrid[this.snapGrid.length - 1];
  }
  function translateTo(translate2 = 0, speed = this.params.speed, runCallbacks = true, translateBounds = true, internal) {
    const swiper = this;
    const {
      params,
      wrapperEl
    } = swiper;
    if (swiper.animating && params.preventInteractionOnTransition) {
      return false;
    }
    const minTranslate2 = swiper.minTranslate();
    const maxTranslate2 = swiper.maxTranslate();
    let newTranslate;
    if (translateBounds && translate2 > minTranslate2) newTranslate = minTranslate2;
    else if (translateBounds && translate2 < maxTranslate2) newTranslate = maxTranslate2;
    else newTranslate = translate2;
    swiper.updateProgress(newTranslate);
    if (params.cssMode) {
      const isH = swiper.isHorizontal();
      if (speed === 0) {
        wrapperEl[isH ? "scrollLeft" : "scrollTop"] = -newTranslate;
      } else {
        if (!swiper.support.smoothScroll) {
          animateCSSModeScroll({
            swiper,
            targetPosition: -newTranslate,
            side: isH ? "left" : "top"
          });
          return true;
        }
        wrapperEl.scrollTo({
          [isH ? "left" : "top"]: -newTranslate,
          behavior: "smooth"
        });
      }
      return true;
    }
    if (speed === 0) {
      swiper.setTransition(0);
      swiper.setTranslate(newTranslate);
      if (runCallbacks) {
        swiper.emit("beforeTransitionStart", speed, internal);
        swiper.emit("transitionEnd");
      }
    } else {
      swiper.setTransition(speed);
      swiper.setTranslate(newTranslate);
      if (runCallbacks) {
        swiper.emit("beforeTransitionStart", speed, internal);
        swiper.emit("transitionStart");
      }
      if (!swiper.animating) {
        swiper.animating = true;
        if (!swiper.onTranslateToWrapperTransitionEnd) {
          swiper.onTranslateToWrapperTransitionEnd = function transitionEnd2(e) {
            if (!swiper || swiper.destroyed) return;
            if (e.target !== this) return;
            swiper.wrapperEl.removeEventListener("transitionend", swiper.onTranslateToWrapperTransitionEnd);
            swiper.onTranslateToWrapperTransitionEnd = null;
            delete swiper.onTranslateToWrapperTransitionEnd;
            swiper.animating = false;
            if (runCallbacks) {
              swiper.emit("transitionEnd");
            }
          };
        }
        swiper.wrapperEl.addEventListener("transitionend", swiper.onTranslateToWrapperTransitionEnd);
      }
    }
    return true;
  }
  var translate = {
    getTranslate: getSwiperTranslate,
    setTranslate,
    minTranslate,
    maxTranslate,
    translateTo
  };
  function setTransition(duration, byController) {
    const swiper = this;
    if (!swiper.params.cssMode) {
      swiper.wrapperEl.style.transitionDuration = `${duration}ms`;
      swiper.wrapperEl.style.transitionDelay = duration === 0 ? `0ms` : "";
    }
    swiper.emit("setTransition", duration, byController);
  }
  function transitionEmit({
    swiper,
    runCallbacks,
    direction,
    step
  }) {
    const {
      activeIndex,
      previousIndex
    } = swiper;
    let dir = direction;
    if (!dir) {
      if (activeIndex > previousIndex) dir = "next";
      else if (activeIndex < previousIndex) dir = "prev";
      else dir = "reset";
    }
    swiper.emit(`transition${step}`);
    if (runCallbacks && dir === "reset") {
      swiper.emit(`slideResetTransition${step}`);
    } else if (runCallbacks && activeIndex !== previousIndex) {
      swiper.emit(`slideChangeTransition${step}`);
      if (dir === "next") {
        swiper.emit(`slideNextTransition${step}`);
      } else {
        swiper.emit(`slidePrevTransition${step}`);
      }
    }
  }
  function transitionStart(runCallbacks = true, direction) {
    const swiper = this;
    const {
      params
    } = swiper;
    if (params.cssMode) return;
    if (params.autoHeight) {
      swiper.updateAutoHeight();
    }
    transitionEmit({
      swiper,
      runCallbacks,
      direction,
      step: "Start"
    });
  }
  function transitionEnd(runCallbacks = true, direction) {
    const swiper = this;
    const {
      params
    } = swiper;
    swiper.animating = false;
    if (params.cssMode) return;
    swiper.setTransition(0);
    transitionEmit({
      swiper,
      runCallbacks,
      direction,
      step: "End"
    });
  }
  var transition = {
    setTransition,
    transitionStart,
    transitionEnd
  };
  function slideTo(index = 0, speed, runCallbacks = true, internal, initial) {
    if (typeof index === "string") {
      index = parseInt(index, 10);
    }
    const swiper = this;
    let slideIndex = index;
    if (slideIndex < 0) slideIndex = 0;
    const {
      params,
      snapGrid,
      slidesGrid,
      previousIndex,
      activeIndex,
      rtlTranslate: rtl,
      wrapperEl,
      enabled
    } = swiper;
    if (!enabled && !internal && !initial || swiper.destroyed || swiper.animating && params.preventInteractionOnTransition) {
      return false;
    }
    if (typeof speed === "undefined") {
      speed = swiper.params.speed;
    }
    const skip = Math.min(swiper.params.slidesPerGroupSkip, slideIndex);
    let snapIndex = skip + Math.floor((slideIndex - skip) / swiper.params.slidesPerGroup);
    if (snapIndex >= snapGrid.length) snapIndex = snapGrid.length - 1;
    const translate2 = -snapGrid[snapIndex];
    if (params.normalizeSlideIndex) {
      for (let i = 0; i < slidesGrid.length; i += 1) {
        const normalizedTranslate = -Math.floor(translate2 * 100);
        const normalizedGrid = Math.floor(slidesGrid[i] * 100);
        const normalizedGridNext = Math.floor(slidesGrid[i + 1] * 100);
        if (typeof slidesGrid[i + 1] !== "undefined") {
          if (normalizedTranslate >= normalizedGrid && normalizedTranslate < normalizedGridNext - (normalizedGridNext - normalizedGrid) / 2) {
            slideIndex = i;
          } else if (normalizedTranslate >= normalizedGrid && normalizedTranslate < normalizedGridNext) {
            slideIndex = i + 1;
          }
        } else if (normalizedTranslate >= normalizedGrid) {
          slideIndex = i;
        }
      }
    }
    if (swiper.initialized && slideIndex !== activeIndex) {
      if (!swiper.allowSlideNext && (rtl ? translate2 > swiper.translate && translate2 > swiper.minTranslate() : translate2 < swiper.translate && translate2 < swiper.minTranslate())) {
        return false;
      }
      if (!swiper.allowSlidePrev && translate2 > swiper.translate && translate2 > swiper.maxTranslate()) {
        if ((activeIndex || 0) !== slideIndex) {
          return false;
        }
      }
    }
    if (slideIndex !== (previousIndex || 0) && runCallbacks) {
      swiper.emit("beforeSlideChangeStart");
    }
    swiper.updateProgress(translate2);
    let direction;
    if (slideIndex > activeIndex) direction = "next";
    else if (slideIndex < activeIndex) direction = "prev";
    else direction = "reset";
    const isVirtual = swiper.virtual && swiper.params.virtual.enabled;
    const isInitialVirtual = isVirtual && initial;
    if (!isInitialVirtual && (rtl && -translate2 === swiper.translate || !rtl && translate2 === swiper.translate)) {
      swiper.updateActiveIndex(slideIndex);
      if (params.autoHeight) {
        swiper.updateAutoHeight();
      }
      swiper.updateSlidesClasses();
      if (params.effect !== "slide") {
        swiper.setTranslate(translate2);
      }
      if (direction !== "reset") {
        swiper.transitionStart(runCallbacks, direction);
        swiper.transitionEnd(runCallbacks, direction);
      }
      return false;
    }
    if (params.cssMode) {
      const isH = swiper.isHorizontal();
      const t = rtl ? translate2 : -translate2;
      if (speed === 0) {
        if (isVirtual) {
          swiper.wrapperEl.style.scrollSnapType = "none";
          swiper._immediateVirtual = true;
        }
        if (isVirtual && !swiper._cssModeVirtualInitialSet && swiper.params.initialSlide > 0) {
          swiper._cssModeVirtualInitialSet = true;
          requestAnimationFrame(() => {
            wrapperEl[isH ? "scrollLeft" : "scrollTop"] = t;
          });
        } else {
          wrapperEl[isH ? "scrollLeft" : "scrollTop"] = t;
        }
        if (isVirtual) {
          requestAnimationFrame(() => {
            swiper.wrapperEl.style.scrollSnapType = "";
            swiper._immediateVirtual = false;
          });
        }
      } else {
        if (!swiper.support.smoothScroll) {
          animateCSSModeScroll({
            swiper,
            targetPosition: t,
            side: isH ? "left" : "top"
          });
          return true;
        }
        wrapperEl.scrollTo({
          [isH ? "left" : "top"]: t,
          behavior: "smooth"
        });
      }
      return true;
    }
    const browser2 = getBrowser();
    const isSafari = browser2.isSafari;
    if (isVirtual && !initial && isSafari && swiper.isElement) {
      swiper.virtual.update(false, false, slideIndex);
    }
    swiper.setTransition(speed);
    swiper.setTranslate(translate2);
    swiper.updateActiveIndex(slideIndex);
    swiper.updateSlidesClasses();
    swiper.emit("beforeTransitionStart", speed, internal);
    swiper.transitionStart(runCallbacks, direction);
    if (speed === 0) {
      swiper.transitionEnd(runCallbacks, direction);
    } else if (!swiper.animating) {
      swiper.animating = true;
      if (!swiper.onSlideToWrapperTransitionEnd) {
        swiper.onSlideToWrapperTransitionEnd = function transitionEnd2(e) {
          if (!swiper || swiper.destroyed) return;
          if (e.target !== this) return;
          swiper.wrapperEl.removeEventListener("transitionend", swiper.onSlideToWrapperTransitionEnd);
          swiper.onSlideToWrapperTransitionEnd = null;
          delete swiper.onSlideToWrapperTransitionEnd;
          swiper.transitionEnd(runCallbacks, direction);
        };
      }
      swiper.wrapperEl.addEventListener("transitionend", swiper.onSlideToWrapperTransitionEnd);
    }
    return true;
  }
  function slideToLoop(index = 0, speed, runCallbacks = true, internal) {
    if (typeof index === "string") {
      const indexAsNumber = parseInt(index, 10);
      index = indexAsNumber;
    }
    const swiper = this;
    if (swiper.destroyed) return;
    if (typeof speed === "undefined") {
      speed = swiper.params.speed;
    }
    const gridEnabled = swiper.grid && swiper.params.grid && swiper.params.grid.rows > 1;
    let newIndex = index;
    if (swiper.params.loop) {
      if (swiper.virtual && swiper.params.virtual.enabled) {
        newIndex = newIndex + swiper.virtual.slidesBefore;
      } else {
        let targetSlideIndex;
        if (gridEnabled) {
          const slideIndex = newIndex * swiper.params.grid.rows;
          targetSlideIndex = swiper.slides.find((slideEl) => slideEl.getAttribute("data-swiper-slide-index") * 1 === slideIndex).column;
        } else {
          targetSlideIndex = swiper.getSlideIndexByData(newIndex);
        }
        const cols = gridEnabled ? Math.ceil(swiper.slides.length / swiper.params.grid.rows) : swiper.slides.length;
        const {
          centeredSlides,
          slidesOffsetBefore,
          slidesOffsetAfter
        } = swiper.params;
        const bothDirections = centeredSlides || !!slidesOffsetBefore || !!slidesOffsetAfter;
        let slidesPerView = swiper.params.slidesPerView;
        if (slidesPerView === "auto") {
          slidesPerView = swiper.slidesPerViewDynamic();
        } else {
          slidesPerView = Math.ceil(parseFloat(swiper.params.slidesPerView, 10));
          if (bothDirections && slidesPerView % 2 === 0) {
            slidesPerView = slidesPerView + 1;
          }
        }
        let needLoopFix = cols - targetSlideIndex < slidesPerView;
        if (bothDirections) {
          needLoopFix = needLoopFix || targetSlideIndex < Math.ceil(slidesPerView / 2);
        }
        if (internal && bothDirections && swiper.params.slidesPerView !== "auto" && !gridEnabled) {
          needLoopFix = false;
        }
        if (needLoopFix) {
          const direction = bothDirections ? targetSlideIndex < swiper.activeIndex ? "prev" : "next" : targetSlideIndex - swiper.activeIndex - 1 < swiper.params.slidesPerView ? "next" : "prev";
          swiper.loopFix({
            direction,
            slideTo: true,
            activeSlideIndex: direction === "next" ? targetSlideIndex + 1 : targetSlideIndex - cols + 1,
            slideRealIndex: direction === "next" ? swiper.realIndex : void 0
          });
        }
        if (gridEnabled) {
          const slideIndex = newIndex * swiper.params.grid.rows;
          newIndex = swiper.slides.find((slideEl) => slideEl.getAttribute("data-swiper-slide-index") * 1 === slideIndex).column;
        } else {
          newIndex = swiper.getSlideIndexByData(newIndex);
        }
      }
    }
    requestAnimationFrame(() => {
      swiper.slideTo(newIndex, speed, runCallbacks, internal);
    });
    return swiper;
  }
  function slideNext(speed, runCallbacks = true, internal) {
    const swiper = this;
    const {
      enabled,
      params,
      animating
    } = swiper;
    if (!enabled || swiper.destroyed) return swiper;
    if (typeof speed === "undefined") {
      speed = swiper.params.speed;
    }
    let perGroup = params.slidesPerGroup;
    if (params.slidesPerView === "auto" && params.slidesPerGroup === 1 && params.slidesPerGroupAuto) {
      perGroup = Math.max(swiper.slidesPerViewDynamic("current", true), 1);
    }
    const increment = swiper.activeIndex < params.slidesPerGroupSkip ? 1 : perGroup;
    const isVirtual = swiper.virtual && params.virtual.enabled;
    if (params.loop) {
      if (animating && !isVirtual && params.loopPreventsSliding) return false;
      swiper.loopFix({
        direction: "next"
      });
      swiper._clientLeft = swiper.wrapperEl.clientLeft;
      if (swiper.activeIndex === swiper.slides.length - 1 && params.cssMode) {
        requestAnimationFrame(() => {
          swiper.slideTo(swiper.activeIndex + increment, speed, runCallbacks, internal);
        });
        return true;
      }
    }
    if (params.rewind && swiper.isEnd) {
      return swiper.slideTo(0, speed, runCallbacks, internal);
    }
    return swiper.slideTo(swiper.activeIndex + increment, speed, runCallbacks, internal);
  }
  function slidePrev(speed, runCallbacks = true, internal) {
    const swiper = this;
    const {
      params,
      snapGrid,
      slidesGrid,
      rtlTranslate,
      enabled,
      animating
    } = swiper;
    if (!enabled || swiper.destroyed) return swiper;
    if (typeof speed === "undefined") {
      speed = swiper.params.speed;
    }
    const isVirtual = swiper.virtual && params.virtual.enabled;
    if (params.loop) {
      if (animating && !isVirtual && params.loopPreventsSliding) return false;
      swiper.loopFix({
        direction: "prev"
      });
      swiper._clientLeft = swiper.wrapperEl.clientLeft;
    }
    const translate2 = rtlTranslate ? swiper.translate : -swiper.translate;
    function normalize(val) {
      if (val < 0) return -Math.floor(Math.abs(val));
      return Math.floor(val);
    }
    const normalizedTranslate = normalize(translate2);
    const normalizedSnapGrid = snapGrid.map((val) => normalize(val));
    const isFreeMode = params.freeMode && params.freeMode.enabled;
    let prevSnap = snapGrid[normalizedSnapGrid.indexOf(normalizedTranslate) - 1];
    if (typeof prevSnap === "undefined" && (params.cssMode || isFreeMode)) {
      let prevSnapIndex;
      snapGrid.forEach((snap, snapIndex) => {
        if (normalizedTranslate >= snap) {
          prevSnapIndex = snapIndex;
        }
      });
      if (typeof prevSnapIndex !== "undefined") {
        prevSnap = isFreeMode ? snapGrid[prevSnapIndex] : snapGrid[prevSnapIndex > 0 ? prevSnapIndex - 1 : prevSnapIndex];
      }
    }
    let prevIndex = 0;
    if (typeof prevSnap !== "undefined") {
      prevIndex = slidesGrid.indexOf(prevSnap);
      if (prevIndex < 0) prevIndex = swiper.activeIndex - 1;
      if (params.slidesPerView === "auto" && params.slidesPerGroup === 1 && params.slidesPerGroupAuto) {
        prevIndex = prevIndex - swiper.slidesPerViewDynamic("previous", true) + 1;
        prevIndex = Math.max(prevIndex, 0);
      }
    }
    if (params.rewind && swiper.isBeginning) {
      const lastIndex = swiper.params.virtual && swiper.params.virtual.enabled && swiper.virtual ? swiper.virtual.slides.length - 1 : swiper.slides.length - 1;
      return swiper.slideTo(lastIndex, speed, runCallbacks, internal);
    } else if (params.loop && swiper.activeIndex === 0 && params.cssMode) {
      requestAnimationFrame(() => {
        swiper.slideTo(prevIndex, speed, runCallbacks, internal);
      });
      return true;
    }
    return swiper.slideTo(prevIndex, speed, runCallbacks, internal);
  }
  function slideReset(speed, runCallbacks = true, internal) {
    const swiper = this;
    if (swiper.destroyed) return;
    if (typeof speed === "undefined") {
      speed = swiper.params.speed;
    }
    return swiper.slideTo(swiper.activeIndex, speed, runCallbacks, internal);
  }
  function slideToClosest(speed, runCallbacks = true, internal, threshold = 0.5) {
    const swiper = this;
    if (swiper.destroyed) return;
    if (typeof speed === "undefined") {
      speed = swiper.params.speed;
    }
    let index = swiper.activeIndex;
    const skip = Math.min(swiper.params.slidesPerGroupSkip, index);
    const snapIndex = skip + Math.floor((index - skip) / swiper.params.slidesPerGroup);
    const translate2 = swiper.rtlTranslate ? swiper.translate : -swiper.translate;
    if (translate2 >= swiper.snapGrid[snapIndex]) {
      const currentSnap = swiper.snapGrid[snapIndex];
      const nextSnap = swiper.snapGrid[snapIndex + 1];
      if (translate2 - currentSnap > (nextSnap - currentSnap) * threshold) {
        index += swiper.params.slidesPerGroup;
      }
    } else {
      const prevSnap = swiper.snapGrid[snapIndex - 1];
      const currentSnap = swiper.snapGrid[snapIndex];
      if (translate2 - prevSnap <= (currentSnap - prevSnap) * threshold) {
        index -= swiper.params.slidesPerGroup;
      }
    }
    index = Math.max(index, 0);
    index = Math.min(index, swiper.slidesGrid.length - 1);
    return swiper.slideTo(index, speed, runCallbacks, internal);
  }
  function slideToClickedSlide() {
    const swiper = this;
    if (swiper.destroyed) return;
    const {
      params,
      slidesEl
    } = swiper;
    const slidesPerView = params.slidesPerView === "auto" ? swiper.slidesPerViewDynamic() : params.slidesPerView;
    let slideToIndex = swiper.getSlideIndexWhenGrid(swiper.clickedIndex);
    let realIndex;
    const slideSelector = swiper.isElement ? `swiper-slide` : `.${params.slideClass}`;
    const isGrid = swiper.grid && swiper.params.grid && swiper.params.grid.rows > 1;
    if (params.loop) {
      if (swiper.animating) return;
      realIndex = parseInt(swiper.clickedSlide.getAttribute("data-swiper-slide-index"), 10);
      if (params.centeredSlides) {
        swiper.slideToLoop(realIndex);
      } else if (slideToIndex > (isGrid ? (swiper.slides.length - slidesPerView) / 2 - (swiper.params.grid.rows - 1) : swiper.slides.length - slidesPerView)) {
        swiper.loopFix();
        slideToIndex = swiper.getSlideIndex(elementChildren(slidesEl, `${slideSelector}[data-swiper-slide-index="${realIndex}"]`)[0]);
        nextTick(() => {
          swiper.slideTo(slideToIndex);
        });
      } else {
        swiper.slideTo(slideToIndex);
      }
    } else {
      swiper.slideTo(slideToIndex);
    }
  }
  var slide = {
    slideTo,
    slideToLoop,
    slideNext,
    slidePrev,
    slideReset,
    slideToClosest,
    slideToClickedSlide
  };
  function loopCreate(slideRealIndex, initial) {
    const swiper = this;
    const {
      params,
      slidesEl
    } = swiper;
    if (!params.loop || swiper.virtual && swiper.params.virtual.enabled) return;
    const initSlides = () => {
      const slides = elementChildren(slidesEl, `.${params.slideClass}, swiper-slide`);
      slides.forEach((el, index) => {
        el.setAttribute("data-swiper-slide-index", index);
      });
    };
    const clearBlankSlides = () => {
      const slides = elementChildren(slidesEl, `.${params.slideBlankClass}`);
      slides.forEach((el) => {
        el.remove();
      });
      if (slides.length > 0) {
        swiper.recalcSlides();
        swiper.updateSlides();
      }
    };
    const gridEnabled = swiper.grid && params.grid && params.grid.rows > 1;
    if (params.loopAddBlankSlides && (params.slidesPerGroup > 1 || gridEnabled)) {
      clearBlankSlides();
    }
    const slidesPerGroup = params.slidesPerGroup * (gridEnabled ? params.grid.rows : 1);
    const shouldFillGroup = swiper.slides.length % slidesPerGroup !== 0;
    const shouldFillGrid = gridEnabled && swiper.slides.length % params.grid.rows !== 0;
    const addBlankSlides = (amountOfSlides) => {
      for (let i = 0; i < amountOfSlides; i += 1) {
        const slideEl = swiper.isElement ? createElement("swiper-slide", [params.slideBlankClass]) : createElement("div", [params.slideClass, params.slideBlankClass]);
        swiper.slidesEl.append(slideEl);
      }
    };
    if (shouldFillGroup) {
      if (params.loopAddBlankSlides) {
        const slidesToAdd = slidesPerGroup - swiper.slides.length % slidesPerGroup;
        addBlankSlides(slidesToAdd);
        swiper.recalcSlides();
        swiper.updateSlides();
      } else {
        showWarning("Swiper Loop Warning: The number of slides is not even to slidesPerGroup, loop mode may not function properly. You need to add more slides (or make duplicates, or empty slides)");
      }
      initSlides();
    } else if (shouldFillGrid) {
      if (params.loopAddBlankSlides) {
        const slidesToAdd = params.grid.rows - swiper.slides.length % params.grid.rows;
        addBlankSlides(slidesToAdd);
        swiper.recalcSlides();
        swiper.updateSlides();
      } else {
        showWarning("Swiper Loop Warning: The number of slides is not even to grid.rows, loop mode may not function properly. You need to add more slides (or make duplicates, or empty slides)");
      }
      initSlides();
    } else {
      initSlides();
    }
    const bothDirections = params.centeredSlides || !!params.slidesOffsetBefore || !!params.slidesOffsetAfter;
    swiper.loopFix({
      slideRealIndex,
      direction: bothDirections ? void 0 : "next",
      initial
    });
  }
  function loopFix({
    slideRealIndex,
    slideTo: slideTo2 = true,
    direction,
    setTranslate: setTranslate2,
    activeSlideIndex,
    initial,
    byController,
    byMousewheel
  } = {}) {
    const swiper = this;
    if (!swiper.params.loop) return;
    swiper.emit("beforeLoopFix");
    const {
      slides,
      allowSlidePrev,
      allowSlideNext,
      slidesEl,
      params
    } = swiper;
    const {
      centeredSlides,
      slidesOffsetBefore,
      slidesOffsetAfter,
      initialSlide
    } = params;
    const bothDirections = centeredSlides || !!slidesOffsetBefore || !!slidesOffsetAfter;
    swiper.allowSlidePrev = true;
    swiper.allowSlideNext = true;
    if (swiper.virtual && params.virtual.enabled) {
      if (slideTo2) {
        if (!bothDirections && swiper.snapIndex === 0) {
          swiper.slideTo(swiper.virtual.slides.length, 0, false, true);
        } else if (bothDirections && swiper.snapIndex < params.slidesPerView) {
          swiper.slideTo(swiper.virtual.slides.length + swiper.snapIndex, 0, false, true);
        } else if (swiper.snapIndex === swiper.snapGrid.length - 1) {
          swiper.slideTo(swiper.virtual.slidesBefore, 0, false, true);
        }
      }
      swiper.allowSlidePrev = allowSlidePrev;
      swiper.allowSlideNext = allowSlideNext;
      swiper.emit("loopFix");
      return;
    }
    let slidesPerView = params.slidesPerView;
    if (slidesPerView === "auto") {
      slidesPerView = swiper.slidesPerViewDynamic();
    } else {
      slidesPerView = Math.ceil(parseFloat(params.slidesPerView, 10));
      if (bothDirections && slidesPerView % 2 === 0) {
        slidesPerView = slidesPerView + 1;
      }
    }
    const slidesPerGroup = params.slidesPerGroupAuto ? slidesPerView : params.slidesPerGroup;
    let loopedSlides = bothDirections ? Math.max(slidesPerGroup, Math.ceil(slidesPerView / 2)) : slidesPerGroup;
    if (loopedSlides % slidesPerGroup !== 0) {
      loopedSlides += slidesPerGroup - loopedSlides % slidesPerGroup;
    }
    loopedSlides += params.loopAdditionalSlides;
    swiper.loopedSlides = loopedSlides;
    const gridEnabled = swiper.grid && params.grid && params.grid.rows > 1;
    if (slides.length < slidesPerView + loopedSlides || swiper.params.effect === "cards" && slides.length < slidesPerView + loopedSlides * 2) {
      showWarning("Swiper Loop Warning: The number of slides is not enough for loop mode, it will be disabled or not function properly. You need to add more slides (or make duplicates) or lower the values of slidesPerView and slidesPerGroup parameters");
    } else if (gridEnabled && params.grid.fill === "row") {
      showWarning("Swiper Loop Warning: Loop mode is not compatible with grid.fill = `row`");
    }
    const prependSlidesIndexes = [];
    const appendSlidesIndexes = [];
    const cols = gridEnabled ? Math.ceil(slides.length / params.grid.rows) : slides.length;
    const isInitialOverflow = initial && cols - initialSlide < slidesPerView && !bothDirections;
    let activeIndex = isInitialOverflow ? initialSlide : swiper.activeIndex;
    if (typeof activeSlideIndex === "undefined") {
      activeSlideIndex = swiper.getSlideIndex(slides.find((el) => el.classList.contains(params.slideActiveClass)));
    } else {
      activeIndex = activeSlideIndex;
    }
    const isNext = direction === "next" || !direction;
    const isPrev = direction === "prev" || !direction;
    let slidesPrepended = 0;
    let slidesAppended = 0;
    const activeColIndex = gridEnabled ? slides[activeSlideIndex].column : activeSlideIndex;
    const activeColIndexWithShift = activeColIndex + (bothDirections && typeof setTranslate2 === "undefined" ? -slidesPerView / 2 + 0.5 : 0);
    if (activeColIndexWithShift < loopedSlides) {
      slidesPrepended = Math.max(loopedSlides - activeColIndexWithShift, slidesPerGroup);
      for (let i = 0; i < loopedSlides - activeColIndexWithShift; i += 1) {
        const index = i - Math.floor(i / cols) * cols;
        if (gridEnabled) {
          const colIndexToPrepend = cols - index - 1;
          for (let i2 = slides.length - 1; i2 >= 0; i2 -= 1) {
            if (slides[i2].column === colIndexToPrepend) prependSlidesIndexes.push(i2);
          }
        } else {
          prependSlidesIndexes.push(cols - index - 1);
        }
      }
    } else if (activeColIndexWithShift + slidesPerView > cols - loopedSlides) {
      slidesAppended = Math.max(activeColIndexWithShift - (cols - loopedSlides * 2), slidesPerGroup);
      if (isInitialOverflow) {
        slidesAppended = Math.max(slidesAppended, slidesPerView - cols + initialSlide + 1);
      }
      for (let i = 0; i < slidesAppended; i += 1) {
        const index = i - Math.floor(i / cols) * cols;
        if (gridEnabled) {
          slides.forEach((slide2, slideIndex) => {
            if (slide2.column === index) appendSlidesIndexes.push(slideIndex);
          });
        } else {
          appendSlidesIndexes.push(index);
        }
      }
    }
    swiper.__preventObserver__ = true;
    requestAnimationFrame(() => {
      swiper.__preventObserver__ = false;
    });
    if (swiper.params.effect === "cards" && slides.length < slidesPerView + loopedSlides * 2) {
      if (appendSlidesIndexes.includes(activeSlideIndex)) {
        appendSlidesIndexes.splice(appendSlidesIndexes.indexOf(activeSlideIndex), 1);
      }
      if (prependSlidesIndexes.includes(activeSlideIndex)) {
        prependSlidesIndexes.splice(prependSlidesIndexes.indexOf(activeSlideIndex), 1);
      }
    }
    if (isPrev) {
      prependSlidesIndexes.forEach((index) => {
        slides[index].swiperLoopMoveDOM = true;
        slidesEl.prepend(slides[index]);
        slides[index].swiperLoopMoveDOM = false;
      });
    }
    if (isNext) {
      appendSlidesIndexes.forEach((index) => {
        slides[index].swiperLoopMoveDOM = true;
        slidesEl.append(slides[index]);
        slides[index].swiperLoopMoveDOM = false;
      });
    }
    swiper.recalcSlides();
    if (params.slidesPerView === "auto") {
      swiper.updateSlides();
    } else if (gridEnabled && (prependSlidesIndexes.length > 0 && isPrev || appendSlidesIndexes.length > 0 && isNext)) {
      swiper.slides.forEach((slide2, slideIndex) => {
        swiper.grid.updateSlide(slideIndex, slide2, swiper.slides);
      });
    }
    if (params.watchSlidesProgress) {
      swiper.updateSlidesOffset();
    }
    if (slideTo2) {
      if (prependSlidesIndexes.length > 0 && isPrev) {
        if (typeof slideRealIndex === "undefined") {
          const currentSlideTranslate = swiper.slidesGrid[activeIndex];
          const newSlideTranslate = swiper.slidesGrid[activeIndex + slidesPrepended];
          const diff = newSlideTranslate - currentSlideTranslate;
          if (byMousewheel) {
            swiper.setTranslate(swiper.translate - diff);
          } else {
            swiper.slideTo(activeIndex + Math.ceil(slidesPrepended), 0, false, true);
            if (setTranslate2) {
              swiper.touchEventsData.startTranslate = swiper.touchEventsData.startTranslate - diff;
              swiper.touchEventsData.currentTranslate = swiper.touchEventsData.currentTranslate - diff;
            }
          }
        } else {
          if (setTranslate2) {
            const shift = gridEnabled ? prependSlidesIndexes.length / params.grid.rows : prependSlidesIndexes.length;
            swiper.slideTo(swiper.activeIndex + shift, 0, false, true);
            swiper.touchEventsData.currentTranslate = swiper.translate;
          }
        }
      } else if (appendSlidesIndexes.length > 0 && isNext) {
        if (typeof slideRealIndex === "undefined") {
          const currentSlideTranslate = swiper.slidesGrid[activeIndex];
          const newSlideTranslate = swiper.slidesGrid[activeIndex - slidesAppended];
          const diff = newSlideTranslate - currentSlideTranslate;
          if (byMousewheel) {
            swiper.setTranslate(swiper.translate - diff);
          } else {
            swiper.slideTo(activeIndex - slidesAppended, 0, false, true);
            if (setTranslate2) {
              swiper.touchEventsData.startTranslate = swiper.touchEventsData.startTranslate - diff;
              swiper.touchEventsData.currentTranslate = swiper.touchEventsData.currentTranslate - diff;
            }
          }
        } else {
          const shift = gridEnabled ? appendSlidesIndexes.length / params.grid.rows : appendSlidesIndexes.length;
          swiper.slideTo(swiper.activeIndex - shift, 0, false, true);
        }
      }
    }
    swiper.allowSlidePrev = allowSlidePrev;
    swiper.allowSlideNext = allowSlideNext;
    if (swiper.controller && swiper.controller.control && !byController) {
      const loopParams = {
        slideRealIndex,
        direction,
        setTranslate: setTranslate2,
        activeSlideIndex,
        byController: true
      };
      if (Array.isArray(swiper.controller.control)) {
        swiper.controller.control.forEach((c) => {
          if (!c.destroyed && c.params.loop) c.loopFix({
            ...loopParams,
            slideTo: c.params.slidesPerView === params.slidesPerView ? slideTo2 : false
          });
        });
      } else if (swiper.controller.control instanceof swiper.constructor && swiper.controller.control.params.loop) {
        swiper.controller.control.loopFix({
          ...loopParams,
          slideTo: swiper.controller.control.params.slidesPerView === params.slidesPerView ? slideTo2 : false
        });
      }
    }
    swiper.emit("loopFix");
  }
  function loopDestroy() {
    const swiper = this;
    const {
      params,
      slidesEl
    } = swiper;
    if (!params.loop || !slidesEl || swiper.virtual && swiper.params.virtual.enabled) return;
    swiper.recalcSlides();
    const newSlidesOrder = [];
    swiper.slides.forEach((slideEl) => {
      const index = typeof slideEl.swiperSlideIndex === "undefined" ? slideEl.getAttribute("data-swiper-slide-index") * 1 : slideEl.swiperSlideIndex;
      newSlidesOrder[index] = slideEl;
    });
    swiper.slides.forEach((slideEl) => {
      slideEl.removeAttribute("data-swiper-slide-index");
    });
    newSlidesOrder.forEach((slideEl) => {
      slidesEl.append(slideEl);
    });
    swiper.recalcSlides();
    swiper.slideTo(swiper.realIndex, 0);
  }
  var loop = {
    loopCreate,
    loopFix,
    loopDestroy
  };
  function setGrabCursor(moving) {
    const swiper = this;
    if (!swiper.params.simulateTouch || swiper.params.watchOverflow && swiper.isLocked || swiper.params.cssMode) return;
    const el = swiper.params.touchEventsTarget === "container" ? swiper.el : swiper.wrapperEl;
    if (swiper.isElement) {
      swiper.__preventObserver__ = true;
    }
    el.style.cursor = "move";
    el.style.cursor = moving ? "grabbing" : "grab";
    if (swiper.isElement) {
      requestAnimationFrame(() => {
        swiper.__preventObserver__ = false;
      });
    }
  }
  function unsetGrabCursor() {
    const swiper = this;
    if (swiper.params.watchOverflow && swiper.isLocked || swiper.params.cssMode) {
      return;
    }
    if (swiper.isElement) {
      swiper.__preventObserver__ = true;
    }
    swiper[swiper.params.touchEventsTarget === "container" ? "el" : "wrapperEl"].style.cursor = "";
    if (swiper.isElement) {
      requestAnimationFrame(() => {
        swiper.__preventObserver__ = false;
      });
    }
  }
  var grabCursor = {
    setGrabCursor,
    unsetGrabCursor
  };
  function closestElement(selector, base = this) {
    function __closestFrom(el) {
      if (!el || el === getDocument() || el === getWindow()) return null;
      if (el.assignedSlot) el = el.assignedSlot;
      const found = el.closest(selector);
      if (!found && !el.getRootNode) {
        return null;
      }
      return found || __closestFrom(el.getRootNode().host);
    }
    return __closestFrom(base);
  }
  function preventEdgeSwipe(swiper, event2, startX) {
    const window2 = getWindow();
    const {
      params
    } = swiper;
    const edgeSwipeDetection = params.edgeSwipeDetection;
    const edgeSwipeThreshold = params.edgeSwipeThreshold;
    if (edgeSwipeDetection && (startX <= edgeSwipeThreshold || startX >= window2.innerWidth - edgeSwipeThreshold)) {
      if (edgeSwipeDetection === "prevent") {
        event2.preventDefault();
        return true;
      }
      return false;
    }
    return true;
  }
  function onTouchStart(event2) {
    const swiper = this;
    const document2 = getDocument();
    let e = event2;
    if (e.originalEvent) e = e.originalEvent;
    const data = swiper.touchEventsData;
    if (e.type === "pointerdown") {
      if (data.pointerId !== null && data.pointerId !== e.pointerId) {
        return;
      }
      data.pointerId = e.pointerId;
    } else if (e.type === "touchstart" && e.targetTouches.length === 1) {
      data.touchId = e.targetTouches[0].identifier;
    }
    if (e.type === "touchstart") {
      preventEdgeSwipe(swiper, e, e.targetTouches[0].pageX);
      return;
    }
    const {
      params,
      touches,
      enabled
    } = swiper;
    if (!enabled) return;
    if (!params.simulateTouch && e.pointerType === "mouse") return;
    if (swiper.animating && params.preventInteractionOnTransition) {
      return;
    }
    if (!swiper.animating && params.cssMode && params.loop) {
      swiper.loopFix();
    }
    let targetEl = e.target;
    if (params.touchEventsTarget === "wrapper") {
      if (!elementIsChildOf(targetEl, swiper.wrapperEl)) return;
    }
    if ("which" in e && e.which === 3) return;
    if ("button" in e && e.button > 0) return;
    if (data.isTouched && data.isMoved) return;
    const swipingClassHasValue = !!params.noSwipingClass && params.noSwipingClass !== "";
    const eventPath = e.composedPath ? e.composedPath() : e.path;
    if (swipingClassHasValue && e.target && e.target.shadowRoot && eventPath) {
      targetEl = eventPath[0];
    }
    const noSwipingSelector = params.noSwipingSelector ? params.noSwipingSelector : `.${params.noSwipingClass}`;
    const isTargetShadow = !!(e.target && e.target.shadowRoot);
    if (params.noSwiping && (isTargetShadow ? closestElement(noSwipingSelector, targetEl) : targetEl.closest(noSwipingSelector))) {
      swiper.allowClick = true;
      return;
    }
    if (params.swipeHandler) {
      if (!targetEl.closest(params.swipeHandler)) return;
    }
    touches.currentX = e.pageX;
    touches.currentY = e.pageY;
    const startX = touches.currentX;
    const startY = touches.currentY;
    if (!preventEdgeSwipe(swiper, e, startX)) {
      return;
    }
    Object.assign(data, {
      isTouched: true,
      isMoved: false,
      allowTouchCallbacks: true,
      isScrolling: void 0,
      startMoving: void 0
    });
    touches.startX = startX;
    touches.startY = startY;
    data.touchStartTime = now();
    swiper.allowClick = true;
    swiper.updateSize();
    swiper.swipeDirection = void 0;
    if (params.threshold > 0) data.allowThresholdMove = false;
    let preventDefault = true;
    if (targetEl.matches(data.focusableElements)) {
      preventDefault = false;
      if (targetEl.nodeName === "SELECT") {
        data.isTouched = false;
      }
    }
    if (document2.activeElement && document2.activeElement.matches(data.focusableElements) && document2.activeElement !== targetEl && (e.pointerType === "mouse" || e.pointerType !== "mouse" && !targetEl.matches(data.focusableElements))) {
      document2.activeElement.blur();
    }
    const shouldPreventDefault = preventDefault && swiper.allowTouchMove && params.touchStartPreventDefault;
    if ((params.touchStartForcePreventDefault || shouldPreventDefault) && !targetEl.isContentEditable) {
      e.preventDefault();
    }
    if (params.freeMode && params.freeMode.enabled && swiper.freeMode && swiper.animating && !params.cssMode) {
      swiper.freeMode.onTouchStart();
    }
    swiper.emit("touchStart", e);
  }
  function onTouchMove(event2) {
    const document2 = getDocument();
    const swiper = this;
    const data = swiper.touchEventsData;
    const {
      params,
      touches,
      rtlTranslate: rtl,
      enabled
    } = swiper;
    if (!enabled) return;
    if (!params.simulateTouch && event2.pointerType === "mouse") return;
    let e = event2;
    if (e.originalEvent) e = e.originalEvent;
    if (e.type === "pointermove") {
      if (data.touchId !== null) return;
      const id = e.pointerId;
      if (id !== data.pointerId) return;
    }
    let targetTouch;
    if (e.type === "touchmove") {
      targetTouch = [...e.changedTouches].find((t) => t.identifier === data.touchId);
      if (!targetTouch || targetTouch.identifier !== data.touchId) return;
    } else {
      targetTouch = e;
    }
    if (!data.isTouched) {
      if (data.startMoving && data.isScrolling) {
        swiper.emit("touchMoveOpposite", e);
      }
      return;
    }
    const pageX = targetTouch.pageX;
    const pageY = targetTouch.pageY;
    if (e.preventedByNestedSwiper) {
      touches.startX = pageX;
      touches.startY = pageY;
      return;
    }
    if (!swiper.allowTouchMove) {
      if (!e.target.matches(data.focusableElements)) {
        swiper.allowClick = false;
      }
      if (data.isTouched) {
        Object.assign(touches, {
          startX: pageX,
          startY: pageY,
          currentX: pageX,
          currentY: pageY
        });
        data.touchStartTime = now();
      }
      return;
    }
    if (params.touchReleaseOnEdges && !params.loop) {
      if (swiper.isVertical()) {
        if (pageY < touches.startY && swiper.translate <= swiper.maxTranslate() || pageY > touches.startY && swiper.translate >= swiper.minTranslate()) {
          data.isTouched = false;
          data.isMoved = false;
          return;
        }
      } else if (rtl && (pageX > touches.startX && -swiper.translate <= swiper.maxTranslate() || pageX < touches.startX && -swiper.translate >= swiper.minTranslate())) {
        return;
      } else if (!rtl && (pageX < touches.startX && swiper.translate <= swiper.maxTranslate() || pageX > touches.startX && swiper.translate >= swiper.minTranslate())) {
        return;
      }
    }
    if (document2.activeElement && document2.activeElement.matches(data.focusableElements) && document2.activeElement !== e.target && e.pointerType !== "mouse") {
      document2.activeElement.blur();
    }
    if (document2.activeElement) {
      if (e.target === document2.activeElement && e.target.matches(data.focusableElements)) {
        data.isMoved = true;
        swiper.allowClick = false;
        return;
      }
    }
    if (data.allowTouchCallbacks) {
      swiper.emit("touchMove", e);
    }
    touches.previousX = touches.currentX;
    touches.previousY = touches.currentY;
    touches.currentX = pageX;
    touches.currentY = pageY;
    const diffX = touches.currentX - touches.startX;
    const diffY = touches.currentY - touches.startY;
    if (swiper.params.threshold && Math.sqrt(diffX ** 2 + diffY ** 2) < swiper.params.threshold) return;
    if (typeof data.isScrolling === "undefined") {
      let touchAngle;
      if (swiper.isHorizontal() && touches.currentY === touches.startY || swiper.isVertical() && touches.currentX === touches.startX) {
        data.isScrolling = false;
      } else {
        if (diffX * diffX + diffY * diffY >= 25) {
          touchAngle = Math.atan2(Math.abs(diffY), Math.abs(diffX)) * 180 / Math.PI;
          data.isScrolling = swiper.isHorizontal() ? touchAngle > params.touchAngle : 90 - touchAngle > params.touchAngle;
        }
      }
    }
    if (data.isScrolling) {
      swiper.emit("touchMoveOpposite", e);
    }
    if (typeof data.startMoving === "undefined") {
      if (touches.currentX !== touches.startX || touches.currentY !== touches.startY) {
        data.startMoving = true;
      }
    }
    if (data.isScrolling || e.type === "touchmove" && data.preventTouchMoveFromPointerMove) {
      data.isTouched = false;
      return;
    }
    if (!data.startMoving) {
      return;
    }
    swiper.allowClick = false;
    if (!params.cssMode && e.cancelable) {
      e.preventDefault();
    }
    if (params.touchMoveStopPropagation && !params.nested) {
      e.stopPropagation();
    }
    let diff = swiper.isHorizontal() ? diffX : diffY;
    let touchesDiff = swiper.isHorizontal() ? touches.currentX - touches.previousX : touches.currentY - touches.previousY;
    if (params.oneWayMovement) {
      diff = Math.abs(diff) * (rtl ? 1 : -1);
      touchesDiff = Math.abs(touchesDiff) * (rtl ? 1 : -1);
    }
    touches.diff = diff;
    diff *= params.touchRatio;
    if (rtl) {
      diff = -diff;
      touchesDiff = -touchesDiff;
    }
    const prevTouchesDirection = swiper.touchesDirection;
    swiper.swipeDirection = diff > 0 ? "prev" : "next";
    swiper.touchesDirection = touchesDiff > 0 ? "prev" : "next";
    const isLoop = swiper.params.loop && !params.cssMode;
    const allowLoopFix = swiper.touchesDirection === "next" && swiper.allowSlideNext || swiper.touchesDirection === "prev" && swiper.allowSlidePrev;
    if (!data.isMoved) {
      if (isLoop && allowLoopFix) {
        swiper.loopFix({
          direction: swiper.swipeDirection
        });
      }
      data.startTranslate = swiper.getTranslate();
      swiper.setTransition(0);
      if (swiper.animating) {
        const evt = new window.CustomEvent("transitionend", {
          bubbles: true,
          cancelable: true,
          detail: {
            bySwiperTouchMove: true
          }
        });
        swiper.wrapperEl.dispatchEvent(evt);
      }
      data.allowMomentumBounce = false;
      if (params.grabCursor && (swiper.allowSlideNext === true || swiper.allowSlidePrev === true)) {
        swiper.setGrabCursor(true);
      }
      swiper.emit("sliderFirstMove", e);
    }
    let loopFixed;
    (/* @__PURE__ */ new Date()).getTime();
    if (params._loopSwapReset !== false && data.isMoved && data.allowThresholdMove && prevTouchesDirection !== swiper.touchesDirection && isLoop && allowLoopFix && Math.abs(diff) >= 1) {
      Object.assign(touches, {
        startX: pageX,
        startY: pageY,
        currentX: pageX,
        currentY: pageY,
        startTranslate: data.currentTranslate
      });
      data.loopSwapReset = true;
      data.startTranslate = data.currentTranslate;
      return;
    }
    swiper.emit("sliderMove", e);
    data.isMoved = true;
    data.currentTranslate = diff + data.startTranslate;
    let disableParentSwiper = true;
    let resistanceRatio = params.resistanceRatio;
    if (params.touchReleaseOnEdges) {
      resistanceRatio = 0;
    }
    if (diff > 0) {
      if (isLoop && allowLoopFix && !loopFixed && data.allowThresholdMove && data.currentTranslate > (params.centeredSlides ? swiper.minTranslate() - swiper.slidesSizesGrid[swiper.activeIndex + 1] - (params.slidesPerView !== "auto" && swiper.slides.length - params.slidesPerView >= 2 ? swiper.slidesSizesGrid[swiper.activeIndex + 1] + swiper.params.spaceBetween : 0) - swiper.params.spaceBetween : swiper.minTranslate())) {
        swiper.loopFix({
          direction: "prev",
          setTranslate: true,
          activeSlideIndex: 0
        });
      }
      if (data.currentTranslate > swiper.minTranslate()) {
        disableParentSwiper = false;
        if (params.resistance) {
          data.currentTranslate = swiper.minTranslate() - 1 + (-swiper.minTranslate() + data.startTranslate + diff) ** resistanceRatio;
        }
      }
    } else if (diff < 0) {
      if (isLoop && allowLoopFix && !loopFixed && data.allowThresholdMove && data.currentTranslate < (params.centeredSlides ? swiper.maxTranslate() + swiper.slidesSizesGrid[swiper.slidesSizesGrid.length - 1] + swiper.params.spaceBetween + (params.slidesPerView !== "auto" && swiper.slides.length - params.slidesPerView >= 2 ? swiper.slidesSizesGrid[swiper.slidesSizesGrid.length - 1] + swiper.params.spaceBetween : 0) : swiper.maxTranslate())) {
        swiper.loopFix({
          direction: "next",
          setTranslate: true,
          activeSlideIndex: swiper.slides.length - (params.slidesPerView === "auto" ? swiper.slidesPerViewDynamic() : Math.ceil(parseFloat(params.slidesPerView, 10)))
        });
      }
      if (data.currentTranslate < swiper.maxTranslate()) {
        disableParentSwiper = false;
        if (params.resistance) {
          data.currentTranslate = swiper.maxTranslate() + 1 - (swiper.maxTranslate() - data.startTranslate - diff) ** resistanceRatio;
        }
      }
    }
    if (disableParentSwiper) {
      e.preventedByNestedSwiper = true;
    }
    if (!swiper.allowSlideNext && swiper.swipeDirection === "next" && data.currentTranslate < data.startTranslate) {
      data.currentTranslate = data.startTranslate;
    }
    if (!swiper.allowSlidePrev && swiper.swipeDirection === "prev" && data.currentTranslate > data.startTranslate) {
      data.currentTranslate = data.startTranslate;
    }
    if (!swiper.allowSlidePrev && !swiper.allowSlideNext) {
      data.currentTranslate = data.startTranslate;
    }
    if (params.threshold > 0) {
      if (Math.abs(diff) > params.threshold || data.allowThresholdMove) {
        if (!data.allowThresholdMove) {
          data.allowThresholdMove = true;
          touches.startX = touches.currentX;
          touches.startY = touches.currentY;
          data.currentTranslate = data.startTranslate;
          touches.diff = swiper.isHorizontal() ? touches.currentX - touches.startX : touches.currentY - touches.startY;
          return;
        }
      } else {
        data.currentTranslate = data.startTranslate;
        return;
      }
    }
    if (!params.followFinger || params.cssMode) return;
    if (params.freeMode && params.freeMode.enabled && swiper.freeMode || params.watchSlidesProgress) {
      swiper.updateActiveIndex();
      swiper.updateSlidesClasses();
    }
    if (params.freeMode && params.freeMode.enabled && swiper.freeMode) {
      swiper.freeMode.onTouchMove();
    }
    swiper.updateProgress(data.currentTranslate);
    swiper.setTranslate(data.currentTranslate);
  }
  function onTouchEnd(event2) {
    const swiper = this;
    const data = swiper.touchEventsData;
    let e = event2;
    if (e.originalEvent) e = e.originalEvent;
    let targetTouch;
    const isTouchEvent = e.type === "touchend" || e.type === "touchcancel";
    if (!isTouchEvent) {
      if (data.touchId !== null) return;
      if (e.pointerId !== data.pointerId) return;
      targetTouch = e;
    } else {
      targetTouch = [...e.changedTouches].find((t) => t.identifier === data.touchId);
      if (!targetTouch || targetTouch.identifier !== data.touchId) return;
    }
    if (["pointercancel", "pointerout", "pointerleave", "contextmenu"].includes(e.type)) {
      const proceed = ["pointercancel", "contextmenu"].includes(e.type) && (swiper.browser.isSafari || swiper.browser.isWebView);
      if (!proceed) {
        return;
      }
    }
    data.pointerId = null;
    data.touchId = null;
    const {
      params,
      touches,
      rtlTranslate: rtl,
      slidesGrid,
      enabled
    } = swiper;
    if (!enabled) return;
    if (!params.simulateTouch && e.pointerType === "mouse") return;
    if (data.allowTouchCallbacks) {
      swiper.emit("touchEnd", e);
    }
    data.allowTouchCallbacks = false;
    if (!data.isTouched) {
      if (data.isMoved && params.grabCursor) {
        swiper.setGrabCursor(false);
      }
      data.isMoved = false;
      data.startMoving = false;
      return;
    }
    if (params.grabCursor && data.isMoved && data.isTouched && (swiper.allowSlideNext === true || swiper.allowSlidePrev === true)) {
      swiper.setGrabCursor(false);
    }
    const touchEndTime = now();
    const timeDiff = touchEndTime - data.touchStartTime;
    if (swiper.allowClick) {
      const pathTree = e.path || e.composedPath && e.composedPath();
      swiper.updateClickedSlide(pathTree && pathTree[0] || e.target, pathTree);
      swiper.emit("tap click", e);
      if (timeDiff < 300 && touchEndTime - data.lastClickTime < 300) {
        swiper.emit("doubleTap doubleClick", e);
      }
    }
    data.lastClickTime = now();
    nextTick(() => {
      if (!swiper.destroyed) swiper.allowClick = true;
    });
    if (!data.isTouched || !data.isMoved || !swiper.swipeDirection || touches.diff === 0 && !data.loopSwapReset || data.currentTranslate === data.startTranslate && !data.loopSwapReset) {
      data.isTouched = false;
      data.isMoved = false;
      data.startMoving = false;
      return;
    }
    data.isTouched = false;
    data.isMoved = false;
    data.startMoving = false;
    let currentPos;
    if (params.followFinger) {
      currentPos = rtl ? swiper.translate : -swiper.translate;
    } else {
      currentPos = -data.currentTranslate;
    }
    if (params.cssMode) {
      return;
    }
    if (params.freeMode && params.freeMode.enabled) {
      swiper.freeMode.onTouchEnd({
        currentPos
      });
      return;
    }
    const swipeToLast = currentPos >= -swiper.maxTranslate() && !swiper.params.loop;
    let stopIndex = 0;
    let groupSize = swiper.slidesSizesGrid[0];
    for (let i = 0; i < slidesGrid.length; i += i < params.slidesPerGroupSkip ? 1 : params.slidesPerGroup) {
      const increment2 = i < params.slidesPerGroupSkip - 1 ? 1 : params.slidesPerGroup;
      if (typeof slidesGrid[i + increment2] !== "undefined") {
        if (swipeToLast || currentPos >= slidesGrid[i] && currentPos < slidesGrid[i + increment2]) {
          stopIndex = i;
          groupSize = slidesGrid[i + increment2] - slidesGrid[i];
        }
      } else if (swipeToLast || currentPos >= slidesGrid[i]) {
        stopIndex = i;
        groupSize = slidesGrid[slidesGrid.length - 1] - slidesGrid[slidesGrid.length - 2];
      }
    }
    let rewindFirstIndex = null;
    let rewindLastIndex = null;
    if (params.rewind) {
      if (swiper.isBeginning) {
        rewindLastIndex = params.virtual && params.virtual.enabled && swiper.virtual ? swiper.virtual.slides.length - 1 : swiper.slides.length - 1;
      } else if (swiper.isEnd) {
        rewindFirstIndex = 0;
      }
    }
    const ratio = (currentPos - slidesGrid[stopIndex]) / groupSize;
    const increment = stopIndex < params.slidesPerGroupSkip - 1 ? 1 : params.slidesPerGroup;
    if (timeDiff > params.longSwipesMs) {
      if (!params.longSwipes) {
        swiper.slideTo(swiper.activeIndex);
        return;
      }
      if (swiper.swipeDirection === "next") {
        if (ratio >= params.longSwipesRatio) swiper.slideTo(params.rewind && swiper.isEnd ? rewindFirstIndex : stopIndex + increment);
        else swiper.slideTo(stopIndex);
      }
      if (swiper.swipeDirection === "prev") {
        if (ratio > 1 - params.longSwipesRatio) {
          swiper.slideTo(stopIndex + increment);
        } else if (rewindLastIndex !== null && ratio < 0 && Math.abs(ratio) > params.longSwipesRatio) {
          swiper.slideTo(rewindLastIndex);
        } else {
          swiper.slideTo(stopIndex);
        }
      }
    } else {
      if (!params.shortSwipes) {
        swiper.slideTo(swiper.activeIndex);
        return;
      }
      const isNavButtonTarget = swiper.navigation && (e.target === swiper.navigation.nextEl || e.target === swiper.navigation.prevEl);
      if (!isNavButtonTarget) {
        if (swiper.swipeDirection === "next") {
          swiper.slideTo(rewindFirstIndex !== null ? rewindFirstIndex : stopIndex + increment);
        }
        if (swiper.swipeDirection === "prev") {
          swiper.slideTo(rewindLastIndex !== null ? rewindLastIndex : stopIndex);
        }
      } else if (e.target === swiper.navigation.nextEl) {
        swiper.slideTo(stopIndex + increment);
      } else {
        swiper.slideTo(stopIndex);
      }
    }
  }
  function onResize() {
    const swiper = this;
    const {
      params,
      el
    } = swiper;
    if (el && el.offsetWidth === 0) return;
    if (params.breakpoints) {
      swiper.setBreakpoint();
    }
    const {
      allowSlideNext,
      allowSlidePrev,
      snapGrid
    } = swiper;
    const isVirtual = swiper.virtual && swiper.params.virtual.enabled;
    swiper.allowSlideNext = true;
    swiper.allowSlidePrev = true;
    swiper.updateSize();
    swiper.updateSlides();
    swiper.updateSlidesClasses();
    const isVirtualLoop = isVirtual && params.loop;
    if ((params.slidesPerView === "auto" || params.slidesPerView > 1) && swiper.isEnd && !swiper.isBeginning && !swiper.params.centeredSlides && !isVirtualLoop) {
      const slides = isVirtual ? swiper.virtual.slides : swiper.slides;
      swiper.slideTo(slides.length - 1, 0, false, true);
    } else {
      if (swiper.params.loop && !isVirtual) {
        swiper.slideToLoop(swiper.realIndex, 0, false, true);
      } else {
        swiper.slideTo(swiper.activeIndex, 0, false, true);
      }
    }
    if (swiper.autoplay && swiper.autoplay.running && swiper.autoplay.paused) {
      clearTimeout(swiper.autoplay.resizeTimeout);
      swiper.autoplay.resizeTimeout = setTimeout(() => {
        if (swiper.autoplay && swiper.autoplay.running && swiper.autoplay.paused) {
          swiper.autoplay.resume();
        }
      }, 500);
    }
    swiper.allowSlidePrev = allowSlidePrev;
    swiper.allowSlideNext = allowSlideNext;
    if (swiper.params.watchOverflow && snapGrid !== swiper.snapGrid) {
      swiper.checkOverflow();
    }
  }
  function onClick(e) {
    const swiper = this;
    if (!swiper.enabled) return;
    if (!swiper.allowClick) {
      if (swiper.params.preventClicks) e.preventDefault();
      if (swiper.params.preventClicksPropagation && swiper.animating) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }
  function onScroll() {
    const swiper = this;
    const {
      wrapperEl,
      rtlTranslate,
      enabled
    } = swiper;
    if (!enabled) return;
    swiper.previousTranslate = swiper.translate;
    if (swiper.isHorizontal()) {
      swiper.translate = -wrapperEl.scrollLeft;
    } else {
      swiper.translate = -wrapperEl.scrollTop;
    }
    if (swiper.translate === 0) swiper.translate = 0;
    swiper.updateActiveIndex();
    swiper.updateSlidesClasses();
    let newProgress;
    const translatesDiff = swiper.maxTranslate() - swiper.minTranslate();
    if (translatesDiff === 0) {
      newProgress = 0;
    } else {
      newProgress = (swiper.translate - swiper.minTranslate()) / translatesDiff;
    }
    if (newProgress !== swiper.progress) {
      swiper.updateProgress(rtlTranslate ? -swiper.translate : swiper.translate);
    }
    swiper.emit("setTranslate", swiper.translate, false);
  }
  function onLoad(e) {
    const swiper = this;
    processLazyPreloader(swiper, e.target);
    if (swiper.params.cssMode || swiper.params.slidesPerView !== "auto" && !swiper.params.autoHeight) {
      return;
    }
    swiper.update();
  }
  function onDocumentTouchStart() {
    const swiper = this;
    if (swiper.documentTouchHandlerProceeded) return;
    swiper.documentTouchHandlerProceeded = true;
    if (swiper.params.touchReleaseOnEdges) {
      swiper.el.style.touchAction = "auto";
    }
  }
  var events = (swiper, method) => {
    const document2 = getDocument();
    const {
      params,
      el,
      wrapperEl,
      device
    } = swiper;
    const capture = !!params.nested;
    const domMethod = method === "on" ? "addEventListener" : "removeEventListener";
    const swiperMethod = method;
    if (!el || typeof el === "string") return;
    document2[domMethod]("touchstart", swiper.onDocumentTouchStart, {
      passive: false,
      capture
    });
    el[domMethod]("touchstart", swiper.onTouchStart, {
      passive: false
    });
    el[domMethod]("pointerdown", swiper.onTouchStart, {
      passive: false
    });
    document2[domMethod]("touchmove", swiper.onTouchMove, {
      passive: false,
      capture
    });
    document2[domMethod]("pointermove", swiper.onTouchMove, {
      passive: false,
      capture
    });
    document2[domMethod]("touchend", swiper.onTouchEnd, {
      passive: true
    });
    document2[domMethod]("pointerup", swiper.onTouchEnd, {
      passive: true
    });
    document2[domMethod]("pointercancel", swiper.onTouchEnd, {
      passive: true
    });
    document2[domMethod]("touchcancel", swiper.onTouchEnd, {
      passive: true
    });
    document2[domMethod]("pointerout", swiper.onTouchEnd, {
      passive: true
    });
    document2[domMethod]("pointerleave", swiper.onTouchEnd, {
      passive: true
    });
    document2[domMethod]("contextmenu", swiper.onTouchEnd, {
      passive: true
    });
    if (params.preventClicks || params.preventClicksPropagation) {
      el[domMethod]("click", swiper.onClick, true);
    }
    if (params.cssMode) {
      wrapperEl[domMethod]("scroll", swiper.onScroll);
    }
    if (params.updateOnWindowResize) {
      swiper[swiperMethod](device.ios || device.android ? "resize orientationchange observerUpdate" : "resize observerUpdate", onResize, true);
    } else {
      swiper[swiperMethod]("observerUpdate", onResize, true);
    }
    el[domMethod]("load", swiper.onLoad, {
      capture: true
    });
  };
  function attachEvents() {
    const swiper = this;
    const {
      params
    } = swiper;
    swiper.onTouchStart = onTouchStart.bind(swiper);
    swiper.onTouchMove = onTouchMove.bind(swiper);
    swiper.onTouchEnd = onTouchEnd.bind(swiper);
    swiper.onDocumentTouchStart = onDocumentTouchStart.bind(swiper);
    if (params.cssMode) {
      swiper.onScroll = onScroll.bind(swiper);
    }
    swiper.onClick = onClick.bind(swiper);
    swiper.onLoad = onLoad.bind(swiper);
    events(swiper, "on");
  }
  function detachEvents() {
    const swiper = this;
    events(swiper, "off");
  }
  var events$1 = {
    attachEvents,
    detachEvents
  };
  var isGridEnabled = (swiper, params) => {
    return swiper.grid && params.grid && params.grid.rows > 1;
  };
  function setBreakpoint() {
    const swiper = this;
    const {
      realIndex,
      initialized,
      params,
      el
    } = swiper;
    const breakpoints2 = params.breakpoints;
    if (!breakpoints2 || breakpoints2 && Object.keys(breakpoints2).length === 0) return;
    const document2 = getDocument();
    const breakpointsBase = params.breakpointsBase === "window" || !params.breakpointsBase ? params.breakpointsBase : "container";
    const breakpointContainer = ["window", "container"].includes(params.breakpointsBase) || !params.breakpointsBase ? swiper.el : document2.querySelector(params.breakpointsBase);
    const breakpoint = swiper.getBreakpoint(breakpoints2, breakpointsBase, breakpointContainer);
    if (!breakpoint || swiper.currentBreakpoint === breakpoint) return;
    const breakpointOnlyParams = breakpoint in breakpoints2 ? breakpoints2[breakpoint] : void 0;
    const breakpointParams = breakpointOnlyParams || swiper.originalParams;
    const wasMultiRow = isGridEnabled(swiper, params);
    const isMultiRow = isGridEnabled(swiper, breakpointParams);
    const wasGrabCursor = swiper.params.grabCursor;
    const isGrabCursor = breakpointParams.grabCursor;
    const wasEnabled = params.enabled;
    if (wasMultiRow && !isMultiRow) {
      el.classList.remove(`${params.containerModifierClass}grid`, `${params.containerModifierClass}grid-column`);
      swiper.emitContainerClasses();
    } else if (!wasMultiRow && isMultiRow) {
      el.classList.add(`${params.containerModifierClass}grid`);
      if (breakpointParams.grid.fill && breakpointParams.grid.fill === "column" || !breakpointParams.grid.fill && params.grid.fill === "column") {
        el.classList.add(`${params.containerModifierClass}grid-column`);
      }
      swiper.emitContainerClasses();
    }
    if (wasGrabCursor && !isGrabCursor) {
      swiper.unsetGrabCursor();
    } else if (!wasGrabCursor && isGrabCursor) {
      swiper.setGrabCursor();
    }
    ["navigation", "pagination", "scrollbar"].forEach((prop) => {
      if (typeof breakpointParams[prop] === "undefined") return;
      const wasModuleEnabled = params[prop] && params[prop].enabled;
      const isModuleEnabled = breakpointParams[prop] && breakpointParams[prop].enabled;
      if (wasModuleEnabled && !isModuleEnabled) {
        swiper[prop].disable();
      }
      if (!wasModuleEnabled && isModuleEnabled) {
        swiper[prop].enable();
      }
    });
    const directionChanged = breakpointParams.direction && breakpointParams.direction !== params.direction;
    const needsReLoop = params.loop && (breakpointParams.slidesPerView !== params.slidesPerView || directionChanged);
    const wasLoop = params.loop;
    if (directionChanged && initialized) {
      swiper.changeDirection();
    }
    extend2(swiper.params, breakpointParams);
    const isEnabled = swiper.params.enabled;
    const hasLoop = swiper.params.loop;
    Object.assign(swiper, {
      allowTouchMove: swiper.params.allowTouchMove,
      allowSlideNext: swiper.params.allowSlideNext,
      allowSlidePrev: swiper.params.allowSlidePrev
    });
    if (wasEnabled && !isEnabled) {
      swiper.disable();
    } else if (!wasEnabled && isEnabled) {
      swiper.enable();
    }
    swiper.currentBreakpoint = breakpoint;
    swiper.emit("_beforeBreakpoint", breakpointParams);
    if (initialized) {
      if (needsReLoop) {
        swiper.loopDestroy();
        swiper.loopCreate(realIndex);
        swiper.updateSlides();
      } else if (!wasLoop && hasLoop) {
        swiper.loopCreate(realIndex);
        swiper.updateSlides();
      } else if (wasLoop && !hasLoop) {
        swiper.loopDestroy();
      }
    }
    swiper.emit("breakpoint", breakpointParams);
  }
  function getBreakpoint(breakpoints2, base = "window", containerEl) {
    if (!breakpoints2 || base === "container" && !containerEl) return void 0;
    let breakpoint = false;
    const window2 = getWindow();
    const currentHeight = base === "window" ? window2.innerHeight : containerEl.clientHeight;
    const points = Object.keys(breakpoints2).map((point) => {
      if (typeof point === "string" && point.indexOf("@") === 0) {
        const minRatio = parseFloat(point.substr(1));
        const value = currentHeight * minRatio;
        return {
          value,
          point
        };
      }
      return {
        value: point,
        point
      };
    });
    points.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
    for (let i = 0; i < points.length; i += 1) {
      const {
        point,
        value
      } = points[i];
      if (base === "window") {
        if (window2.matchMedia(`(min-width: ${value}px)`).matches) {
          breakpoint = point;
        }
      } else if (value <= containerEl.clientWidth) {
        breakpoint = point;
      }
    }
    return breakpoint || "max";
  }
  var breakpoints = {
    setBreakpoint,
    getBreakpoint
  };
  function prepareClasses(entries, prefix) {
    const resultClasses = [];
    entries.forEach((item) => {
      if (typeof item === "object") {
        Object.keys(item).forEach((classNames) => {
          if (item[classNames]) {
            resultClasses.push(prefix + classNames);
          }
        });
      } else if (typeof item === "string") {
        resultClasses.push(prefix + item);
      }
    });
    return resultClasses;
  }
  function addClasses() {
    const swiper = this;
    const {
      classNames,
      params,
      rtl,
      el,
      device
    } = swiper;
    const suffixes = prepareClasses(["initialized", params.direction, {
      "free-mode": swiper.params.freeMode && params.freeMode.enabled
    }, {
      "autoheight": params.autoHeight
    }, {
      "rtl": rtl
    }, {
      "grid": params.grid && params.grid.rows > 1
    }, {
      "grid-column": params.grid && params.grid.rows > 1 && params.grid.fill === "column"
    }, {
      "android": device.android
    }, {
      "ios": device.ios
    }, {
      "css-mode": params.cssMode
    }, {
      "centered": params.cssMode && params.centeredSlides
    }, {
      "watch-progress": params.watchSlidesProgress
    }], params.containerModifierClass);
    classNames.push(...suffixes);
    el.classList.add(...classNames);
    swiper.emitContainerClasses();
  }
  function removeClasses() {
    const swiper = this;
    const {
      el,
      classNames
    } = swiper;
    if (!el || typeof el === "string") return;
    el.classList.remove(...classNames);
    swiper.emitContainerClasses();
  }
  var classes = {
    addClasses,
    removeClasses
  };
  function checkOverflow() {
    const swiper = this;
    const {
      isLocked: wasLocked,
      params
    } = swiper;
    const {
      slidesOffsetBefore
    } = params;
    if (slidesOffsetBefore) {
      const lastSlideIndex = swiper.slides.length - 1;
      const lastSlideRightEdge = swiper.slidesGrid[lastSlideIndex] + swiper.slidesSizesGrid[lastSlideIndex] + slidesOffsetBefore * 2;
      swiper.isLocked = swiper.size > lastSlideRightEdge;
    } else {
      swiper.isLocked = swiper.snapGrid.length === 1;
    }
    if (params.allowSlideNext === true) {
      swiper.allowSlideNext = !swiper.isLocked;
    }
    if (params.allowSlidePrev === true) {
      swiper.allowSlidePrev = !swiper.isLocked;
    }
    if (wasLocked && wasLocked !== swiper.isLocked) {
      swiper.isEnd = false;
    }
    if (wasLocked !== swiper.isLocked) {
      swiper.emit(swiper.isLocked ? "lock" : "unlock");
    }
  }
  var checkOverflow$1 = {
    checkOverflow
  };
  var defaults = {
    init: true,
    direction: "horizontal",
    oneWayMovement: false,
    swiperElementNodeName: "SWIPER-CONTAINER",
    touchEventsTarget: "wrapper",
    initialSlide: 0,
    speed: 300,
    cssMode: false,
    updateOnWindowResize: true,
    resizeObserver: true,
    nested: false,
    createElements: false,
    eventsPrefix: "swiper",
    enabled: true,
    focusableElements: "input, select, option, textarea, button, video, label",
    // Overrides
    width: null,
    height: null,
    //
    preventInteractionOnTransition: false,
    // ssr
    userAgent: null,
    url: null,
    // To support iOS's swipe-to-go-back gesture (when being used in-app).
    edgeSwipeDetection: false,
    edgeSwipeThreshold: 20,
    // Autoheight
    autoHeight: false,
    // Set wrapper width
    setWrapperSize: false,
    // Virtual Translate
    virtualTranslate: false,
    // Effects
    effect: "slide",
    // 'slide' or 'fade' or 'cube' or 'coverflow' or 'flip'
    // Breakpoints
    breakpoints: void 0,
    breakpointsBase: "window",
    // Slides grid
    spaceBetween: 0,
    slidesPerView: 1,
    slidesPerGroup: 1,
    slidesPerGroupSkip: 0,
    slidesPerGroupAuto: false,
    centeredSlides: false,
    centeredSlidesBounds: false,
    slidesOffsetBefore: 0,
    // in px
    slidesOffsetAfter: 0,
    // in px
    normalizeSlideIndex: true,
    centerInsufficientSlides: false,
    snapToSlideEdge: false,
    // Disable swiper and hide navigation when container not overflow
    watchOverflow: true,
    // Round length
    roundLengths: false,
    // Touches
    touchRatio: 1,
    touchAngle: 45,
    simulateTouch: true,
    shortSwipes: true,
    longSwipes: true,
    longSwipesRatio: 0.5,
    longSwipesMs: 300,
    followFinger: true,
    allowTouchMove: true,
    threshold: 5,
    touchMoveStopPropagation: false,
    touchStartPreventDefault: true,
    touchStartForcePreventDefault: false,
    touchReleaseOnEdges: false,
    // Unique Navigation Elements
    uniqueNavElements: true,
    // Resistance
    resistance: true,
    resistanceRatio: 0.85,
    // Progress
    watchSlidesProgress: false,
    // Cursor
    grabCursor: false,
    // Clicks
    preventClicks: true,
    preventClicksPropagation: true,
    slideToClickedSlide: false,
    // loop
    loop: false,
    loopAddBlankSlides: true,
    loopAdditionalSlides: 0,
    loopPreventsSliding: true,
    // rewind
    rewind: false,
    // Swiping/no swiping
    allowSlidePrev: true,
    allowSlideNext: true,
    swipeHandler: null,
    // '.swipe-handler',
    noSwiping: true,
    noSwipingClass: "swiper-no-swiping",
    noSwipingSelector: null,
    // Passive Listeners
    passiveListeners: true,
    maxBackfaceHiddenSlides: 10,
    // NS
    containerModifierClass: "swiper-",
    // NEW
    slideClass: "swiper-slide",
    slideBlankClass: "swiper-slide-blank",
    slideActiveClass: "swiper-slide-active",
    slideVisibleClass: "swiper-slide-visible",
    slideFullyVisibleClass: "swiper-slide-fully-visible",
    slideNextClass: "swiper-slide-next",
    slidePrevClass: "swiper-slide-prev",
    wrapperClass: "swiper-wrapper",
    lazyPreloaderClass: "swiper-lazy-preloader",
    lazyPreloadPrevNext: 0,
    // Callbacks
    runCallbacksOnInit: true,
    // Internals
    _emitClasses: false
  };
  function moduleExtendParams(params, allModulesParams) {
    return function extendParams(obj = {}) {
      const moduleParamName = Object.keys(obj)[0];
      const moduleParams = obj[moduleParamName];
      if (typeof moduleParams !== "object" || moduleParams === null) {
        extend2(allModulesParams, obj);
        return;
      }
      if (params[moduleParamName] === true) {
        params[moduleParamName] = {
          enabled: true
        };
      }
      if (moduleParamName === "navigation" && params[moduleParamName] && params[moduleParamName].enabled && !params[moduleParamName].prevEl && !params[moduleParamName].nextEl) {
        params[moduleParamName].auto = true;
      }
      if (["pagination", "scrollbar"].indexOf(moduleParamName) >= 0 && params[moduleParamName] && params[moduleParamName].enabled && !params[moduleParamName].el) {
        params[moduleParamName].auto = true;
      }
      if (!(moduleParamName in params && "enabled" in moduleParams)) {
        extend2(allModulesParams, obj);
        return;
      }
      if (typeof params[moduleParamName] === "object" && !("enabled" in params[moduleParamName])) {
        params[moduleParamName].enabled = true;
      }
      if (!params[moduleParamName]) params[moduleParamName] = {
        enabled: false
      };
      extend2(allModulesParams, obj);
    };
  }
  var prototypes = {
    eventsEmitter,
    update,
    translate,
    transition,
    slide,
    loop,
    grabCursor,
    events: events$1,
    breakpoints,
    checkOverflow: checkOverflow$1,
    classes
  };
  var extendedDefaults = {};
  var Swiper = class _Swiper {
    constructor(...args) {
      let el;
      let params;
      if (args.length === 1 && args[0].constructor && Object.prototype.toString.call(args[0]).slice(8, -1) === "Object") {
        params = args[0];
      } else {
        [el, params] = args;
      }
      if (!params) params = {};
      params = extend2({}, params);
      if (el && !params.el) params.el = el;
      const document2 = getDocument();
      if (params.el && typeof params.el === "string" && document2.querySelectorAll(params.el).length > 1) {
        const swipers = [];
        document2.querySelectorAll(params.el).forEach((containerEl) => {
          const newParams = extend2({}, params, {
            el: containerEl
          });
          swipers.push(new _Swiper(newParams));
        });
        return swipers;
      }
      const swiper = this;
      swiper.__swiper__ = true;
      swiper.support = getSupport();
      swiper.device = getDevice({
        userAgent: params.userAgent
      });
      swiper.browser = getBrowser();
      swiper.eventsListeners = {};
      swiper.eventsAnyListeners = [];
      swiper.modules = [...swiper.__modules__];
      if (params.modules && Array.isArray(params.modules)) {
        params.modules.forEach((mod) => {
          if (typeof mod === "function" && swiper.modules.indexOf(mod) < 0) {
            swiper.modules.push(mod);
          }
        });
      }
      const allModulesParams = {};
      swiper.modules.forEach((mod) => {
        mod({
          params,
          swiper,
          extendParams: moduleExtendParams(params, allModulesParams),
          on: swiper.on.bind(swiper),
          once: swiper.once.bind(swiper),
          off: swiper.off.bind(swiper),
          emit: swiper.emit.bind(swiper)
        });
      });
      const swiperParams = extend2({}, defaults, allModulesParams);
      swiper.params = extend2({}, swiperParams, extendedDefaults, params);
      swiper.originalParams = extend2({}, swiper.params);
      swiper.passedParams = extend2({}, params);
      if (swiper.params && swiper.params.on) {
        Object.keys(swiper.params.on).forEach((eventName) => {
          swiper.on(eventName, swiper.params.on[eventName]);
        });
      }
      if (swiper.params && swiper.params.onAny) {
        swiper.onAny(swiper.params.onAny);
      }
      Object.assign(swiper, {
        enabled: swiper.params.enabled,
        el,
        // Classes
        classNames: [],
        // Slides
        slides: [],
        slidesGrid: [],
        snapGrid: [],
        slidesSizesGrid: [],
        // isDirection
        isHorizontal() {
          return swiper.params.direction === "horizontal";
        },
        isVertical() {
          return swiper.params.direction === "vertical";
        },
        // Indexes
        activeIndex: 0,
        realIndex: 0,
        //
        isBeginning: true,
        isEnd: false,
        // Props
        translate: 0,
        previousTranslate: 0,
        progress: 0,
        velocity: 0,
        animating: false,
        cssOverflowAdjustment() {
          return Math.trunc(this.translate / 2 ** 23) * 2 ** 23;
        },
        // Locks
        allowSlideNext: swiper.params.allowSlideNext,
        allowSlidePrev: swiper.params.allowSlidePrev,
        // Touch Events
        touchEventsData: {
          isTouched: void 0,
          isMoved: void 0,
          allowTouchCallbacks: void 0,
          touchStartTime: void 0,
          isScrolling: void 0,
          currentTranslate: void 0,
          startTranslate: void 0,
          allowThresholdMove: void 0,
          // Form elements to match
          focusableElements: swiper.params.focusableElements,
          // Last click time
          lastClickTime: 0,
          clickTimeout: void 0,
          // Velocities
          velocities: [],
          allowMomentumBounce: void 0,
          startMoving: void 0,
          pointerId: null,
          touchId: null
        },
        // Clicks
        allowClick: true,
        // Touches
        allowTouchMove: swiper.params.allowTouchMove,
        touches: {
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
          diff: 0
        },
        // Images
        imagesToLoad: [],
        imagesLoaded: 0
      });
      swiper.emit("_swiper");
      if (swiper.params.init) {
        swiper.init();
      }
      return swiper;
    }
    getDirectionLabel(property) {
      if (this.isHorizontal()) {
        return property;
      }
      return {
        "width": "height",
        "margin-top": "margin-left",
        "margin-bottom ": "margin-right",
        "margin-left": "margin-top",
        "margin-right": "margin-bottom",
        "padding-left": "padding-top",
        "padding-right": "padding-bottom",
        "marginRight": "marginBottom"
      }[property];
    }
    getSlideIndex(slideEl) {
      const {
        slidesEl,
        params
      } = this;
      const slides = elementChildren(slidesEl, `.${params.slideClass}, swiper-slide`);
      const firstSlideIndex = elementIndex(slides[0]);
      return elementIndex(slideEl) - firstSlideIndex;
    }
    getSlideIndexByData(index) {
      return this.getSlideIndex(this.slides.find((slideEl) => slideEl.getAttribute("data-swiper-slide-index") * 1 === index));
    }
    getSlideIndexWhenGrid(index) {
      if (this.grid && this.params.grid && this.params.grid.rows > 1) {
        if (this.params.grid.fill === "column") {
          index = Math.floor(index / this.params.grid.rows);
        } else if (this.params.grid.fill === "row") {
          index = index % Math.ceil(this.slides.length / this.params.grid.rows);
        }
      }
      return index;
    }
    recalcSlides() {
      const swiper = this;
      const {
        slidesEl,
        params
      } = swiper;
      swiper.slides = elementChildren(slidesEl, `.${params.slideClass}, swiper-slide`);
    }
    enable() {
      const swiper = this;
      if (swiper.enabled) return;
      swiper.enabled = true;
      if (swiper.params.grabCursor) {
        swiper.setGrabCursor();
      }
      swiper.emit("enable");
    }
    disable() {
      const swiper = this;
      if (!swiper.enabled) return;
      swiper.enabled = false;
      if (swiper.params.grabCursor) {
        swiper.unsetGrabCursor();
      }
      swiper.emit("disable");
    }
    setProgress(progress, speed) {
      const swiper = this;
      progress = Math.min(Math.max(progress, 0), 1);
      const min = swiper.minTranslate();
      const max = swiper.maxTranslate();
      const current = (max - min) * progress + min;
      swiper.translateTo(current, typeof speed === "undefined" ? 0 : speed);
      swiper.updateActiveIndex();
      swiper.updateSlidesClasses();
    }
    emitContainerClasses() {
      const swiper = this;
      if (!swiper.params._emitClasses || !swiper.el) return;
      const cls = swiper.el.className.split(" ").filter((className) => {
        return className.indexOf("swiper") === 0 || className.indexOf(swiper.params.containerModifierClass) === 0;
      });
      swiper.emit("_containerClasses", cls.join(" "));
    }
    getSlideClasses(slideEl) {
      const swiper = this;
      if (swiper.destroyed) return "";
      return slideEl.className.split(" ").filter((className) => {
        return className.indexOf("swiper-slide") === 0 || className.indexOf(swiper.params.slideClass) === 0;
      }).join(" ");
    }
    emitSlidesClasses() {
      const swiper = this;
      if (!swiper.params._emitClasses || !swiper.el) return;
      const updates = [];
      swiper.slides.forEach((slideEl) => {
        const classNames = swiper.getSlideClasses(slideEl);
        updates.push({
          slideEl,
          classNames
        });
        swiper.emit("_slideClass", slideEl, classNames);
      });
      swiper.emit("_slideClasses", updates);
    }
    slidesPerViewDynamic(view = "current", exact = false) {
      const swiper = this;
      const {
        params,
        slides,
        slidesGrid,
        slidesSizesGrid,
        size: swiperSize,
        activeIndex
      } = swiper;
      let spv = 1;
      if (typeof params.slidesPerView === "number") return params.slidesPerView;
      if (params.centeredSlides) {
        let slideSize = slides[activeIndex] ? Math.ceil(slides[activeIndex].swiperSlideSize) : 0;
        let breakLoop;
        for (let i = activeIndex + 1; i < slides.length; i += 1) {
          if (slides[i] && !breakLoop) {
            slideSize += Math.ceil(slides[i].swiperSlideSize);
            spv += 1;
            if (slideSize > swiperSize) breakLoop = true;
          }
        }
        for (let i = activeIndex - 1; i >= 0; i -= 1) {
          if (slides[i] && !breakLoop) {
            slideSize += slides[i].swiperSlideSize;
            spv += 1;
            if (slideSize > swiperSize) breakLoop = true;
          }
        }
      } else {
        if (view === "current") {
          for (let i = activeIndex + 1; i < slides.length; i += 1) {
            const slideInView = exact ? slidesGrid[i] + slidesSizesGrid[i] - slidesGrid[activeIndex] < swiperSize : slidesGrid[i] - slidesGrid[activeIndex] < swiperSize;
            if (slideInView) {
              spv += 1;
            }
          }
        } else {
          for (let i = activeIndex - 1; i >= 0; i -= 1) {
            const slideInView = slidesGrid[activeIndex] - slidesGrid[i] < swiperSize;
            if (slideInView) {
              spv += 1;
            }
          }
        }
      }
      return spv;
    }
    update() {
      const swiper = this;
      if (!swiper || swiper.destroyed) return;
      const {
        snapGrid,
        params
      } = swiper;
      if (params.breakpoints) {
        swiper.setBreakpoint();
      }
      [...swiper.el.querySelectorAll('[loading="lazy"]')].forEach((imageEl) => {
        if (imageEl.complete) {
          processLazyPreloader(swiper, imageEl);
        }
      });
      swiper.updateSize();
      swiper.updateSlides();
      swiper.updateProgress();
      swiper.updateSlidesClasses();
      function setTranslate2() {
        const translateValue = swiper.rtlTranslate ? swiper.translate * -1 : swiper.translate;
        const newTranslate = Math.min(Math.max(translateValue, swiper.maxTranslate()), swiper.minTranslate());
        swiper.setTranslate(newTranslate);
        swiper.updateActiveIndex();
        swiper.updateSlidesClasses();
      }
      let translated;
      if (params.freeMode && params.freeMode.enabled && !params.cssMode) {
        setTranslate2();
        if (params.autoHeight) {
          swiper.updateAutoHeight();
        }
      } else {
        if ((params.slidesPerView === "auto" || params.slidesPerView > 1) && swiper.isEnd && !params.centeredSlides) {
          const slides = swiper.virtual && params.virtual.enabled ? swiper.virtual.slides : swiper.slides;
          translated = swiper.slideTo(slides.length - 1, 0, false, true);
        } else {
          translated = swiper.slideTo(swiper.activeIndex, 0, false, true);
        }
        if (!translated) {
          setTranslate2();
        }
      }
      if (params.watchOverflow && snapGrid !== swiper.snapGrid) {
        swiper.checkOverflow();
      }
      swiper.emit("update");
    }
    changeDirection(newDirection, needUpdate = true) {
      const swiper = this;
      const currentDirection = swiper.params.direction;
      if (!newDirection) {
        newDirection = currentDirection === "horizontal" ? "vertical" : "horizontal";
      }
      if (newDirection === currentDirection || newDirection !== "horizontal" && newDirection !== "vertical") {
        return swiper;
      }
      swiper.el.classList.remove(`${swiper.params.containerModifierClass}${currentDirection}`);
      swiper.el.classList.add(`${swiper.params.containerModifierClass}${newDirection}`);
      swiper.emitContainerClasses();
      swiper.params.direction = newDirection;
      swiper.slides.forEach((slideEl) => {
        if (newDirection === "vertical") {
          slideEl.style.width = "";
        } else {
          slideEl.style.height = "";
        }
      });
      swiper.emit("changeDirection");
      if (needUpdate) swiper.update();
      return swiper;
    }
    changeLanguageDirection(direction) {
      const swiper = this;
      if (swiper.rtl && direction === "rtl" || !swiper.rtl && direction === "ltr") return;
      swiper.rtl = direction === "rtl";
      swiper.rtlTranslate = swiper.params.direction === "horizontal" && swiper.rtl;
      if (swiper.rtl) {
        swiper.el.classList.add(`${swiper.params.containerModifierClass}rtl`);
        swiper.el.dir = "rtl";
      } else {
        swiper.el.classList.remove(`${swiper.params.containerModifierClass}rtl`);
        swiper.el.dir = "ltr";
      }
      swiper.update();
    }
    mount(element) {
      const swiper = this;
      if (swiper.mounted) return true;
      let el = element || swiper.params.el;
      if (typeof el === "string") {
        el = document.querySelector(el);
      }
      if (!el) {
        return false;
      }
      el.swiper = swiper;
      if (el.parentNode && el.parentNode.host && el.parentNode.host.nodeName === swiper.params.swiperElementNodeName.toUpperCase()) {
        swiper.isElement = true;
      }
      const getWrapperSelector = () => {
        return `.${(swiper.params.wrapperClass || "").trim().split(" ").join(".")}`;
      };
      const getWrapper = () => {
        if (el && el.shadowRoot && el.shadowRoot.querySelector) {
          const res = el.shadowRoot.querySelector(getWrapperSelector());
          return res;
        }
        return elementChildren(el, getWrapperSelector())[0];
      };
      let wrapperEl = getWrapper();
      if (!wrapperEl && swiper.params.createElements) {
        wrapperEl = createElement("div", swiper.params.wrapperClass);
        el.append(wrapperEl);
        elementChildren(el, `.${swiper.params.slideClass}`).forEach((slideEl) => {
          wrapperEl.append(slideEl);
        });
      }
      Object.assign(swiper, {
        el,
        wrapperEl,
        slidesEl: swiper.isElement && !el.parentNode.host.slideSlots ? el.parentNode.host : wrapperEl,
        hostEl: swiper.isElement ? el.parentNode.host : el,
        mounted: true,
        // RTL
        rtl: el.dir.toLowerCase() === "rtl" || elementStyle(el, "direction") === "rtl",
        rtlTranslate: swiper.params.direction === "horizontal" && (el.dir.toLowerCase() === "rtl" || elementStyle(el, "direction") === "rtl"),
        wrongRTL: elementStyle(wrapperEl, "display") === "-webkit-box"
      });
      return true;
    }
    init(el) {
      const swiper = this;
      if (swiper.initialized) return swiper;
      const mounted = swiper.mount(el);
      if (mounted === false) return swiper;
      swiper.emit("beforeInit");
      if (swiper.params.breakpoints) {
        swiper.setBreakpoint();
      }
      swiper.addClasses();
      swiper.updateSize();
      swiper.updateSlides();
      if (swiper.params.watchOverflow) {
        swiper.checkOverflow();
      }
      if (swiper.params.grabCursor && swiper.enabled) {
        swiper.setGrabCursor();
      }
      if (swiper.params.loop && swiper.virtual && swiper.params.virtual.enabled) {
        swiper.slideTo(swiper.params.initialSlide + swiper.virtual.slidesBefore, 0, swiper.params.runCallbacksOnInit, false, true);
      } else {
        swiper.slideTo(swiper.params.initialSlide, 0, swiper.params.runCallbacksOnInit, false, true);
      }
      if (swiper.params.loop) {
        swiper.loopCreate(void 0, true);
      }
      swiper.attachEvents();
      const lazyElements = [...swiper.el.querySelectorAll('[loading="lazy"]')];
      if (swiper.isElement) {
        lazyElements.push(...swiper.hostEl.querySelectorAll('[loading="lazy"]'));
      }
      lazyElements.forEach((imageEl) => {
        if (imageEl.complete) {
          processLazyPreloader(swiper, imageEl);
        } else {
          imageEl.addEventListener("load", (e) => {
            processLazyPreloader(swiper, e.target);
          });
        }
      });
      preload(swiper);
      swiper.initialized = true;
      preload(swiper);
      swiper.emit("init");
      swiper.emit("afterInit");
      return swiper;
    }
    destroy(deleteInstance = true, cleanStyles = true) {
      const swiper = this;
      const {
        params,
        el,
        wrapperEl,
        slides
      } = swiper;
      if (typeof swiper.params === "undefined" || swiper.destroyed) {
        return null;
      }
      swiper.emit("beforeDestroy");
      swiper.initialized = false;
      swiper.detachEvents();
      if (params.loop) {
        swiper.loopDestroy();
      }
      if (cleanStyles) {
        swiper.removeClasses();
        if (el && typeof el !== "string") {
          el.removeAttribute("style");
        }
        if (wrapperEl) {
          wrapperEl.removeAttribute("style");
        }
        if (slides && slides.length) {
          slides.forEach((slideEl) => {
            slideEl.classList.remove(params.slideVisibleClass, params.slideFullyVisibleClass, params.slideActiveClass, params.slideNextClass, params.slidePrevClass);
            slideEl.removeAttribute("style");
            slideEl.removeAttribute("data-swiper-slide-index");
          });
        }
      }
      swiper.emit("destroy");
      Object.keys(swiper.eventsListeners).forEach((eventName) => {
        swiper.off(eventName);
      });
      if (deleteInstance !== false) {
        if (swiper.el && typeof swiper.el !== "string") {
          swiper.el.swiper = null;
        }
        deleteProps(swiper);
      }
      swiper.destroyed = true;
      return null;
    }
    static extendDefaults(newDefaults) {
      extend2(extendedDefaults, newDefaults);
    }
    static get extendedDefaults() {
      return extendedDefaults;
    }
    static get defaults() {
      return defaults;
    }
    static installModule(mod) {
      if (!_Swiper.prototype.__modules__) _Swiper.prototype.__modules__ = [];
      const modules = _Swiper.prototype.__modules__;
      if (typeof mod === "function" && modules.indexOf(mod) < 0) {
        modules.push(mod);
      }
    }
    static use(module) {
      if (Array.isArray(module)) {
        module.forEach((m) => _Swiper.installModule(m));
        return _Swiper;
      }
      _Swiper.installModule(module);
      return _Swiper;
    }
  };
  Object.keys(prototypes).forEach((prototypeGroup) => {
    Object.keys(prototypes[prototypeGroup]).forEach((protoMethod) => {
      Swiper.prototype[protoMethod] = prototypes[prototypeGroup][protoMethod];
    });
  });
  Swiper.use([Resize, Observer]);

  // ../EchoMEM-WEB-EXTENSION/node_modules/swiper/modules/keyboard.mjs
  function Keyboard({
    swiper,
    extendParams,
    on,
    emit
  }) {
    const document2 = getDocument();
    const window2 = getWindow();
    swiper.keyboard = {
      enabled: false
    };
    extendParams({
      keyboard: {
        enabled: false,
        onlyInViewport: true,
        pageUpDown: true,
        speed: void 0
      }
    });
    function handle(event2) {
      if (!swiper.enabled) return;
      const {
        rtlTranslate: rtl
      } = swiper;
      let e = event2;
      if (e.originalEvent) e = e.originalEvent;
      const kc = e.keyCode || e.charCode;
      const pageUpDown = swiper.params.keyboard.pageUpDown;
      const isPageUp = pageUpDown && kc === 33;
      const isPageDown = pageUpDown && kc === 34;
      const isArrowLeft = kc === 37;
      const isArrowRight = kc === 39;
      const isArrowUp = kc === 38;
      const isArrowDown = kc === 40;
      if (!swiper.allowSlideNext && (swiper.isHorizontal() && isArrowRight || swiper.isVertical() && isArrowDown || isPageDown)) {
        return false;
      }
      if (!swiper.allowSlidePrev && (swiper.isHorizontal() && isArrowLeft || swiper.isVertical() && isArrowUp || isPageUp)) {
        return false;
      }
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) {
        return void 0;
      }
      if (document2.activeElement && (document2.activeElement.isContentEditable || document2.activeElement.nodeName && (document2.activeElement.nodeName.toLowerCase() === "input" || document2.activeElement.nodeName.toLowerCase() === "textarea"))) {
        return void 0;
      }
      if (swiper.params.keyboard.onlyInViewport && (isPageUp || isPageDown || isArrowLeft || isArrowRight || isArrowUp || isArrowDown)) {
        let inView = false;
        if (elementParents(swiper.el, `.${swiper.params.slideClass}, swiper-slide`).length > 0 && elementParents(swiper.el, `.${swiper.params.slideActiveClass}`).length === 0) {
          return void 0;
        }
        const el = swiper.el;
        const swiperWidth = el.clientWidth;
        const swiperHeight = el.clientHeight;
        const windowWidth = window2.innerWidth;
        const windowHeight = window2.innerHeight;
        const swiperOffset = elementOffset(el);
        if (rtl) swiperOffset.left -= el.scrollLeft;
        const swiperCoord = [[swiperOffset.left, swiperOffset.top], [swiperOffset.left + swiperWidth, swiperOffset.top], [swiperOffset.left, swiperOffset.top + swiperHeight], [swiperOffset.left + swiperWidth, swiperOffset.top + swiperHeight]];
        for (let i = 0; i < swiperCoord.length; i += 1) {
          const point = swiperCoord[i];
          if (point[0] >= 0 && point[0] <= windowWidth && point[1] >= 0 && point[1] <= windowHeight) {
            if (point[0] === 0 && point[1] === 0) continue;
            inView = true;
          }
        }
        if (!inView) return void 0;
      }
      const speed = swiper.params.keyboard.speed;
      if (swiper.isHorizontal()) {
        if (isPageUp || isPageDown || isArrowLeft || isArrowRight) {
          if (e.preventDefault) e.preventDefault();
          else e.returnValue = false;
        }
        if ((isPageDown || isArrowRight) && !rtl || (isPageUp || isArrowLeft) && rtl) swiper.slideNext(speed);
        if ((isPageUp || isArrowLeft) && !rtl || (isPageDown || isArrowRight) && rtl) swiper.slidePrev(speed);
      } else {
        if (isPageUp || isPageDown || isArrowUp || isArrowDown) {
          if (e.preventDefault) e.preventDefault();
          else e.returnValue = false;
        }
        if (isPageDown || isArrowDown) swiper.slideNext(speed);
        if (isPageUp || isArrowUp) swiper.slidePrev(speed);
      }
      emit("keyPress", kc);
      return void 0;
    }
    function enable() {
      if (swiper.keyboard.enabled) return;
      document2.addEventListener("keydown", handle);
      swiper.keyboard.enabled = true;
    }
    function disable() {
      if (!swiper.keyboard.enabled) return;
      document2.removeEventListener("keydown", handle);
      swiper.keyboard.enabled = false;
    }
    on("init", () => {
      if (swiper.params.keyboard.enabled) {
        enable();
      }
    });
    on("destroy", () => {
      if (swiper.keyboard.enabled) {
        disable();
      }
    });
    Object.assign(swiper.keyboard, {
      enable,
      disable
    });
  }

  // ../EchoMEM-WEB-EXTENSION/node_modules/swiper/shared/classes-to-selector.mjs
  function classesToSelector(classes2 = "") {
    return `.${classes2.trim().replace(/([\.:!+\/()[\]#>~*^$|=,'"@{}\\])/g, "\\$1").replace(/ /g, ".")}`;
  }

  // ../EchoMEM-WEB-EXTENSION/node_modules/swiper/modules/a11y.mjs
  function A11y({
    swiper,
    extendParams,
    on
  }) {
    extendParams({
      a11y: {
        enabled: true,
        notificationClass: "swiper-notification",
        prevSlideMessage: "Previous slide",
        nextSlideMessage: "Next slide",
        firstSlideMessage: "This is the first slide",
        lastSlideMessage: "This is the last slide",
        paginationBulletMessage: "Go to slide {{index}}",
        slideLabelMessage: "{{index}} / {{slidesLength}}",
        containerMessage: null,
        containerRoleDescriptionMessage: null,
        containerRole: null,
        itemRoleDescriptionMessage: null,
        slideRole: "group",
        id: null,
        scrollOnFocus: true,
        wrapperLiveRegion: true
      }
    });
    swiper.a11y = {
      clicked: false
    };
    let liveRegion = null;
    let preventFocusHandler;
    let focusTargetSlideEl;
    let visibilityChangedTimestamp = (/* @__PURE__ */ new Date()).getTime();
    function notify(message) {
      const notification = liveRegion;
      if (notification.length === 0) return;
      setInnerHTML(notification, message);
    }
    function getRandomNumber(size = 16) {
      const randomChar = () => Math.round(16 * Math.random()).toString(16);
      return "x".repeat(size).replace(/x/g, randomChar);
    }
    function makeElFocusable(el) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("tabIndex", "0");
      });
    }
    function makeElNotFocusable(el) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("tabIndex", "-1");
      });
    }
    function addElRole(el, role) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("role", role);
      });
    }
    function addElRoleDescription(el, description) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("aria-roledescription", description);
      });
    }
    function addElControls(el, controls) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("aria-controls", controls);
      });
    }
    function addElLabel(el, label) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("aria-label", label);
      });
    }
    function addElId(el, id) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("id", id);
      });
    }
    function addElLive(el, live) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("aria-live", live);
      });
    }
    function disableEl(el) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("aria-disabled", true);
      });
    }
    function enableEl(el) {
      el = makeElementsArray(el);
      el.forEach((subEl) => {
        subEl.setAttribute("aria-disabled", false);
      });
    }
    function onEnterOrSpaceKey(e) {
      if (e.keyCode !== 13 && e.keyCode !== 32) return;
      const params = swiper.params.a11y;
      const targetEl = e.target;
      if (swiper.pagination && swiper.pagination.el && (targetEl === swiper.pagination.el || swiper.pagination.el.contains(e.target))) {
        if (!e.target.matches(classesToSelector(swiper.params.pagination.bulletClass))) return;
      }
      if (swiper.navigation && swiper.navigation.prevEl && swiper.navigation.nextEl) {
        const prevEls = makeElementsArray(swiper.navigation.prevEl);
        const nextEls = makeElementsArray(swiper.navigation.nextEl);
        if (nextEls.includes(targetEl)) {
          if (!(swiper.isEnd && !swiper.params.loop)) {
            swiper.slideNext();
          }
          if (swiper.isEnd) {
            notify(params.lastSlideMessage);
          } else {
            notify(params.nextSlideMessage);
          }
        }
        if (prevEls.includes(targetEl)) {
          if (!(swiper.isBeginning && !swiper.params.loop)) {
            swiper.slidePrev();
          }
          if (swiper.isBeginning) {
            notify(params.firstSlideMessage);
          } else {
            notify(params.prevSlideMessage);
          }
        }
      }
      if (swiper.pagination && targetEl.matches(classesToSelector(swiper.params.pagination.bulletClass))) {
        targetEl.click();
      }
    }
    function updateNavigation() {
      if (swiper.params.loop || swiper.params.rewind || !swiper.navigation) return;
      const {
        nextEl,
        prevEl
      } = swiper.navigation;
      if (prevEl) {
        if (swiper.isBeginning) {
          disableEl(prevEl);
          makeElNotFocusable(prevEl);
        } else {
          enableEl(prevEl);
          makeElFocusable(prevEl);
        }
      }
      if (nextEl) {
        if (swiper.isEnd) {
          disableEl(nextEl);
          makeElNotFocusable(nextEl);
        } else {
          enableEl(nextEl);
          makeElFocusable(nextEl);
        }
      }
    }
    function hasPagination() {
      return swiper.pagination && swiper.pagination.bullets && swiper.pagination.bullets.length;
    }
    function hasClickablePagination() {
      return hasPagination() && swiper.params.pagination.clickable;
    }
    function updatePagination() {
      const params = swiper.params.a11y;
      if (!hasPagination()) return;
      swiper.pagination.bullets.forEach((bulletEl) => {
        if (swiper.params.pagination.clickable) {
          makeElFocusable(bulletEl);
          if (!swiper.params.pagination.renderBullet) {
            addElRole(bulletEl, "button");
            addElLabel(bulletEl, params.paginationBulletMessage.replace(/\{\{index\}\}/, elementIndex(bulletEl) + 1));
          }
        }
        if (bulletEl.matches(classesToSelector(swiper.params.pagination.bulletActiveClass))) {
          bulletEl.setAttribute("aria-current", "true");
        } else {
          bulletEl.removeAttribute("aria-current");
        }
      });
    }
    const initNavEl = (el, wrapperId, message) => {
      makeElFocusable(el);
      if (el.tagName !== "BUTTON") {
        addElRole(el, "button");
        el.addEventListener("keydown", onEnterOrSpaceKey);
      }
      addElLabel(el, message);
      addElControls(el, wrapperId);
    };
    const handlePointerDown = (e) => {
      if (focusTargetSlideEl && focusTargetSlideEl !== e.target && !focusTargetSlideEl.contains(e.target)) {
        preventFocusHandler = true;
      }
      swiper.a11y.clicked = true;
    };
    const handlePointerUp = () => {
      preventFocusHandler = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!swiper.destroyed) {
            swiper.a11y.clicked = false;
          }
        });
      });
    };
    const onVisibilityChange = (e) => {
      visibilityChangedTimestamp = (/* @__PURE__ */ new Date()).getTime();
    };
    const handleFocus = (e) => {
      if (swiper.a11y.clicked || !swiper.params.a11y.scrollOnFocus) return;
      if ((/* @__PURE__ */ new Date()).getTime() - visibilityChangedTimestamp < 100) return;
      const slideEl = e.target.closest(`.${swiper.params.slideClass}, swiper-slide`);
      if (!slideEl || !swiper.slides.includes(slideEl)) return;
      focusTargetSlideEl = slideEl;
      const isVirtual = swiper.virtual && swiper.params.virtual.enabled;
      const isActive = (isVirtual ? parseInt(slideEl.getAttribute("data-swiper-slide-index"), 10) : swiper.slides.indexOf(slideEl)) === swiper.activeIndex;
      const isVisible = swiper.params.watchSlidesProgress && swiper.visibleSlides && swiper.visibleSlides.includes(slideEl);
      if (isActive || isVisible) return;
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      if (swiper.isHorizontal()) {
        swiper.el.scrollLeft = 0;
      } else {
        swiper.el.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        if (preventFocusHandler) return;
        if (swiper.params.loop) {
          swiper.slideToLoop(swiper.getSlideIndexWhenGrid(parseInt(slideEl.getAttribute("data-swiper-slide-index"))), 0);
        } else if (isVirtual) {
          swiper.slideTo(swiper.getSlideIndexWhenGrid(parseInt(slideEl.getAttribute("data-swiper-slide-index"), 10)), 0);
        } else {
          swiper.slideTo(swiper.getSlideIndexWhenGrid(swiper.slides.indexOf(slideEl)), 0);
        }
        preventFocusHandler = false;
      });
    };
    const initSlides = () => {
      const params = swiper.params.a11y;
      if (params.itemRoleDescriptionMessage) {
        addElRoleDescription(swiper.slides, params.itemRoleDescriptionMessage);
      }
      if (params.slideRole) {
        addElRole(swiper.slides, params.slideRole);
      }
      const slidesLength = swiper.slides.length;
      if (params.slideLabelMessage) {
        swiper.slides.forEach((slideEl, index) => {
          const slideIndex = swiper.params.loop ? parseInt(slideEl.getAttribute("data-swiper-slide-index"), 10) : index;
          const ariaLabelMessage = params.slideLabelMessage.replace(/\{\{index\}\}/, slideIndex + 1).replace(/\{\{slidesLength\}\}/, slidesLength);
          addElLabel(slideEl, ariaLabelMessage);
        });
      }
    };
    const init = () => {
      const params = swiper.params.a11y;
      swiper.el.append(liveRegion);
      const containerEl = swiper.el;
      if (params.containerRoleDescriptionMessage) {
        addElRoleDescription(containerEl, params.containerRoleDescriptionMessage);
      }
      if (params.containerMessage) {
        addElLabel(containerEl, params.containerMessage);
      }
      if (params.containerRole) {
        addElRole(containerEl, params.containerRole);
      }
      const wrapperEl = swiper.wrapperEl;
      const wrapperId = params.id || wrapperEl.getAttribute("id") || `swiper-wrapper-${getRandomNumber(16)}`;
      addElId(wrapperEl, wrapperId);
      if (params.wrapperLiveRegion) {
        const live = swiper.params.autoplay && swiper.params.autoplay.enabled ? "off" : "polite";
        addElLive(wrapperEl, live);
      }
      initSlides();
      let {
        nextEl,
        prevEl
      } = swiper.navigation ? swiper.navigation : {};
      nextEl = makeElementsArray(nextEl);
      prevEl = makeElementsArray(prevEl);
      if (nextEl) {
        nextEl.forEach((el) => initNavEl(el, wrapperId, params.nextSlideMessage));
      }
      if (prevEl) {
        prevEl.forEach((el) => initNavEl(el, wrapperId, params.prevSlideMessage));
      }
      if (hasClickablePagination()) {
        const paginationEl = makeElementsArray(swiper.pagination.el);
        paginationEl.forEach((el) => {
          el.addEventListener("keydown", onEnterOrSpaceKey);
        });
      }
      const document2 = getDocument();
      document2.addEventListener("visibilitychange", onVisibilityChange);
      swiper.el.addEventListener("focus", handleFocus, true);
      swiper.el.addEventListener("pointerdown", handlePointerDown, true);
      swiper.el.addEventListener("pointerup", handlePointerUp, true);
    };
    function destroy() {
      if (liveRegion) liveRegion.remove();
      let {
        nextEl,
        prevEl
      } = swiper.navigation ? swiper.navigation : {};
      nextEl = makeElementsArray(nextEl);
      prevEl = makeElementsArray(prevEl);
      if (nextEl) {
        nextEl.forEach((el) => el.removeEventListener("keydown", onEnterOrSpaceKey));
      }
      if (prevEl) {
        prevEl.forEach((el) => el.removeEventListener("keydown", onEnterOrSpaceKey));
      }
      if (hasClickablePagination()) {
        const paginationEl = makeElementsArray(swiper.pagination.el);
        paginationEl.forEach((el) => {
          el.removeEventListener("keydown", onEnterOrSpaceKey);
        });
      }
      const document2 = getDocument();
      document2.removeEventListener("visibilitychange", onVisibilityChange);
      if (swiper.el && typeof swiper.el !== "string") {
        swiper.el.removeEventListener("focus", handleFocus, true);
        swiper.el.removeEventListener("pointerdown", handlePointerDown, true);
        swiper.el.removeEventListener("pointerup", handlePointerUp, true);
      }
    }
    on("beforeInit", () => {
      liveRegion = createElement("span", swiper.params.a11y.notificationClass);
      liveRegion.setAttribute("aria-live", "assertive");
      liveRegion.setAttribute("aria-atomic", "true");
    });
    on("afterInit", () => {
      if (!swiper.params.a11y.enabled) return;
      init();
    });
    on("slidesLengthChange snapGridLengthChange slidesGridLengthChange", () => {
      if (!swiper.params.a11y.enabled) return;
      initSlides();
    });
    on("fromEdge toEdge afterInit lock unlock", () => {
      if (!swiper.params.a11y.enabled) return;
      updateNavigation();
    });
    on("paginationUpdate", () => {
      if (!swiper.params.a11y.enabled) return;
      updatePagination();
    });
    on("destroy", () => {
      if (!swiper.params.a11y.enabled) return;
      destroy();
    });
  }

  // src/panels/feedback/summary/summary-cards.js
  function renderDailyCards(summary) {
    var _a, _b, _c, _d;
    const slides = [];
    slides.push(coverCard({
      eyebrow: "\u4F60\u7684\u6BCF\u65E5\u8BB0\u5FC6",
      title: summary.overview || "\u8FD9\u4E00\u5929\u7684\u8BB0\u5FC6\u5DF2\u7ECF\u6574\u7406\u597D\u4E86",
      period: formatDate(summary.date),
      theme: "ocean"
    }));
    if (summary.metrics) slides.push(metricsCard(summary.metrics, "\u8FD9\u4E00\u5929\uFF0C\u7559\u4E0B\u4E86\u8FD9\u4E9B\u8BB0\u5F55", "violet"));
    if (summary.narrative) slides.push(readingCard("\u8FD9\u4E00\u5929\u53D1\u751F\u4E86\u4EC0\u4E48", summary.narrative, "blue"));
    if ((_a = summary.highlight) == null ? void 0 : _a.description) slides.push(highlightCard(summary.highlight, "amber"));
    if ((_b = summary.keyFacts) == null ? void 0 : _b.length) slides.push(listCard("EchoMem \u8BB0\u4F4F\u4E86", "\u4ECE\u4F1A\u8BDD\u91CC\u6C89\u6DC0\u51FA\u7684\u5173\u952E\u4E8B\u5B9E", summary.keyFacts, factText, "cyan"));
    if (((_c = summary.decisions) == null ? void 0 : _c.length) || ((_d = summary.actionItems) == null ? void 0 : _d.length)) {
      slides.push(actionCard(summary.decisions || [], summary.actionItems || [], "green"));
    }
    if (hasTags(summary)) slides.push(tagsCard(summary, "rose"));
    if (summary.agentNote) slides.push(agentCard(summary.agentNote, "purple"));
    slides.push(sourceCard(summary.basedOn, summary.generatedAt, "daily", "slate"));
    return buildRecap(slides, "\u6BCF\u65E5\u8BB0\u5FC6\u56DE\u987E");
  }
  function renderWeeklyCards(summary) {
    var _a, _b, _c, _d;
    const slides = [];
    const period = summary.dateRange ? `${formatDate(summary.dateRange.start)} \u2014 ${formatDate(summary.dateRange.end)}` : `\u7B2C ${summary.week || ""} \u5468`;
    slides.push(coverCard({
      eyebrow: "\u4F60\u7684\u6BCF\u5468\u8BB0\u5FC6",
      title: "\u8FD9\u4E00\u5468\uFF0C\u4F60\u7ECF\u5386\u4E86\u4EC0\u4E48\uFF1F",
      period,
      theme: "violet",
      note: summary.metrics ? `${summary.metrics.days || 0} \u5929 \xB7 ${summary.metrics.sessions || 0} \u4E2A\u4F1A\u8BDD \xB7 ${summary.metrics.turns || 0} \u8F6E\u5BF9\u8BDD` : ""
    }));
    if (summary.narrative) slides.push(readingCard("\u8FD9\u4E00\u5468\u7684\u6545\u4E8B", summary.narrative, "blue"));
    if (summary.metrics) slides.push(metricsCard(summary.metrics, "\u8FD9\u4E00\u5468\uFF0C\u8BB0\u5FC6\u8FD9\u6837\u751F\u957F", "ocean"));
    if ((_a = summary.themeClusters) == null ? void 0 : _a.length) slides.push(themesCard(summary.themeClusters, "cyan"));
    if ((_b = summary.highlights) == null ? void 0 : _b.length) slides.push(listCard("\u672C\u5468\u5173\u952E\u8F6C\u6298", "\u51B3\u5B9A\u3001\u53D8\u5316\u4E0E\u91CC\u7A0B\u7891", summary.highlights, highlightText, "amber"));
    if ((_c = summary.memoryUpdates) == null ? void 0 : _c.length) slides.push(updatesCard(summary.memoryUpdates, "rose"));
    if ((_d = summary.suggestions) == null ? void 0 : _d.length) slides.push(listCard("\u63A5\u4E0B\u6765\u503C\u5F97\u5173\u6CE8", "\u7531\u672C\u5468\u957F\u671F\u8BB0\u5FC6\u63D0\u70BC", summary.suggestions, String, "green"));
    if (hasTags(summary)) slides.push(tagsCard(summary, "purple"));
    if (summary.agentNote) slides.push(agentCard(summary.agentNote, "violet"));
    slides.push(sourceCard(summary.basedOn, summary.generatedAt, "weekly", "slate"));
    return buildRecap(slides, "\u6BCF\u5468\u8BB0\u5FC6\u56DE\u987E");
  }
  function buildRecap(slides, label) {
    const root = node("section", "em-recap");
    root.classList.add("is-initializing");
    root.setAttribute("aria-label", label);
    const progress = node("div", "em-recap-progress");
    const progressButtons = slides.map((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `\u67E5\u770B\u7B2C ${index + 1} \u5F20\u56DE\u987E\u5361\u7247`);
      button.addEventListener("click", () => goTo(index));
      progress.appendChild(button);
      return button;
    });
    const swiperEl = node("div", "swiper em-recap-swiper");
    const wrapper = node("div", "swiper-wrapper");
    slides.forEach((slide2) => wrapper.appendChild(slide2));
    swiperEl.appendChild(wrapper);
    const prev = navButton("\u2039", "\u4E0A\u4E00\u5F20\u5361\u7247", "is-prev");
    const next = navButton("\u203A", "\u4E0B\u4E00\u5F20\u5361\u7247", "is-next");
    const footer = node("div", "em-recap-footer");
    const count = node("span", "em-recap-count");
    const hint = document.createElement("span");
    hint.textContent = "\u6ED1\u52A8\u5361\u7247\u6216\u4F7F\u7528\u65B9\u5411\u952E";
    footer.append(count, hint);
    root.append(progress, swiperEl, prev, next, footer);
    let swiperInstance = null;
    let initTimer = null;
    let initFrame = null;
    let currentIndex = 0;
    function update2(index = 0) {
      currentIndex = index;
      progressButtons.forEach((button, buttonIndex) => {
        button.classList.toggle("is-complete", buttonIndex < index);
        button.classList.toggle("is-active", buttonIndex === index);
        button.setAttribute("aria-current", buttonIndex === index ? "step" : "false");
      });
      count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      prev.disabled = index === 0;
      next.disabled = index === slides.length - 1;
    }
    function goTo(index) {
      const safeIndex = Math.max(0, Math.min(slides.length - 1, index));
      if (swiperInstance) swiperInstance.slideTo(safeIndex);
      else if (root.classList.contains("is-fallback")) enableFallback(safeIndex);
    }
    function enableFallback(index = 0) {
      const safeIndex = Math.max(0, Math.min(slides.length - 1, index));
      if (swiperInstance) {
        swiperInstance.destroy(true, true);
        swiperInstance = null;
      }
      root.classList.remove("is-initializing", "is-ready");
      root.classList.add("is-fallback");
      wrapper.style.transform = "none";
      slides.forEach((slide2, slideIndex) => {
        slide2.style.display = slideIndex === safeIndex ? "block" : "none";
        slide2.style.width = "100%";
        slide2.style.height = "100%";
        slide2.style.opacity = slideIndex === safeIndex ? "1" : "0";
        slide2.style.transform = "none";
      });
      update2(safeIndex);
    }
    prev.addEventListener("click", () => goTo(currentIndex - 1));
    next.addEventListener("click", () => goTo(currentIndex + 1));
    update2(0);
    function initWhenSized(attempt = 0) {
      if (!root.isConnected) return;
      const rect = swiperEl.getBoundingClientRect();
      if ((rect.width < 120 || rect.height < 180) && attempt < 60) {
        initFrame = requestAnimationFrame(() => initWhenSized(attempt + 1));
        return;
      }
      if (rect.width < 120 || rect.height < 180) {
        enableFallback(0);
        return;
      }
      root.classList.remove("is-initializing");
      try {
        swiperInstance = new Swiper(swiperEl, {
          modules: [Keyboard, A11y],
          effect: "slide",
          slidesPerView: 1,
          spaceBetween: 28,
          roundLengths: true,
          grabCursor: true,
          speed: 480,
          resistanceRatio: 0.68,
          keyboard: { enabled: true, onlyInViewport: true },
          a11y: { enabled: true, prevSlideMessage: "\u4E0A\u4E00\u5F20\u56DE\u987E", nextSlideMessage: "\u4E0B\u4E00\u5F20\u56DE\u987E" },
          observer: true,
          observeParents: true,
          on: { slideChange: (swiper) => update2(swiper.activeIndex) }
        });
        root.classList.add("is-ready");
        requestAnimationFrame(() => swiperInstance == null ? void 0 : swiperInstance.update());
        setTimeout(() => {
          if (!swiperInstance || !root.isConnected) return;
          const active = swiperEl.querySelector(".swiper-slide-active");
          const activeRect = active == null ? void 0 : active.getBoundingClientRect();
          const hostRect = swiperEl.getBoundingClientRect();
          const intersects = activeRect && activeRect.width > 100 && activeRect.height > 180 && activeRect.right > hostRect.left && activeRect.left < hostRect.right && activeRect.bottom > hostRect.top && activeRect.top < hostRect.bottom;
          if (!intersects) enableFallback(swiperInstance.activeIndex || 0);
        }, 120);
      } catch (err) {
        console.error("EchoMem: \u56DE\u987E\u5361\u7247\u7279\u6548\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u9996\u5361\u5C55\u793A", err);
        enableFallback(0);
      }
    }
    initTimer = setTimeout(() => initWhenSized(), 0);
    root._cleanup = () => {
      if (initTimer) clearTimeout(initTimer);
      if (initFrame) cancelAnimationFrame(initFrame);
      swiperInstance == null ? void 0 : swiperInstance.destroy(true, true);
      swiperInstance = null;
    };
    return root;
  }
  function cardShell(theme, eyebrow, title) {
    const slide2 = node("article", `swiper-slide em-recap-card is-${theme}`);
    const card = slide2;
    const glow = node("div", "em-recap-glow");
    const top = node("header", "em-recap-card-head");
    const mark = node("span", "em-recap-mark");
    mark.textContent = "ECHO";
    const eyebrowEl = node("span", "em-recap-eyebrow");
    eyebrowEl.textContent = eyebrow;
    top.append(mark, eyebrowEl);
    card.append(glow, top);
    if (title) {
      const heading = document.createElement("h2");
      heading.className = "em-recap-title";
      heading.textContent = title;
      card.appendChild(heading);
    }
    slide2._card = card;
    return slide2;
  }
  function coverCard({ eyebrow, title, period, theme, note = "" }) {
    const slide2 = cardShell(theme, eyebrow, "");
    const card = slide2._card;
    card.classList.add("is-cover");
    const orb = node("div", "em-recap-orb");
    orb.innerHTML = "<span></span><span></span><span></span>";
    const titleEl = document.createElement("h2");
    titleEl.className = "em-recap-cover-title";
    titleEl.textContent = title;
    const date = node("div", "em-recap-period");
    date.textContent = period;
    card.append(orb, titleEl, date);
    if (note) {
      const noteEl = node("div", "em-recap-cover-note");
      noteEl.textContent = note;
      card.appendChild(noteEl);
    }
    return slide2;
  }
  function metricsCard(metrics, title, theme) {
    const slide2 = cardShell(theme, "\u8BB0\u5FC6\u8DB3\u8FF9", title);
    const grid = node("div", "em-recap-metrics");
    const items = [
      ["sessions", "\u4E2A\u4F1A\u8BDD"],
      ["turns", "\u8F6E\u5BF9\u8BDD"],
      ["user_messages", "\u6761\u7528\u6237\u6D88\u606F"],
      [metrics.days !== void 0 ? "days" : "peak_hour", metrics.days !== void 0 ? "\u4E2A\u8BB0\u5FC6\u65E5" : "\u6700\u6D3B\u8DC3\u65F6\u6BB5"]
    ];
    items.forEach(([key, label], index) => {
      const cell = node("div", "em-recap-metric");
      const value = node("div", "em-recap-metric-value");
      value.textContent = metrics[key] ?? "\u2014";
      const caption = node("div", "em-recap-metric-label");
      caption.textContent = label;
      cell.append(value, caption);
      grid.appendChild(cell);
    });
    slide2._card.appendChild(grid);
    return slide2;
  }
  function readingCard(title, text, theme) {
    const slide2 = cardShell(theme, "\u8BB0\u5FC6\u53D9\u4E8B", title);
    const quote = node("p", "em-recap-reading");
    quote.textContent = text;
    slide2._card.appendChild(quote);
    return slide2;
  }
  function highlightCard(highlight, theme) {
    const slide2 = cardShell(theme, typeLabel(highlight.type) || "\u4ECA\u65E5\u9AD8\u5149", "\u8FD9\u4E00\u523B\uFF0C\u503C\u5F97\u88AB\u8BB0\u4F4F");
    const icon = node("div", "em-recap-big-symbol");
    icon.textContent = "\u2726";
    const copy = node("p", "em-recap-highlight");
    copy.textContent = highlight.description;
    slide2._card.append(icon, copy);
    return slide2;
  }
  function listCard(title, eyebrow, items, formatter, theme) {
    const slide2 = cardShell(theme, eyebrow, title);
    const list = node("div", "em-recap-list");
    items.slice(0, 6).forEach((item, index) => {
      const row = node("div", "em-recap-list-row");
      const number = node("span", "em-recap-list-number");
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      copy.textContent = formatter(item);
      row.append(number, copy);
      list.appendChild(row);
    });
    slide2._card.appendChild(list);
    return slide2;
  }
  function actionCard(decisions, actions, theme) {
    const slide2 = cardShell(theme, "\u4ECE\u8BB0\u5FC6\u8D70\u5411\u4E0B\u4E00\u6B65", "\u51B3\u5B9A\u4E0E\u884C\u52A8");
    const groups = node("div", "em-recap-action-groups");
    if (decisions.length) groups.appendChild(actionGroup("\u5DF2\u7ECF\u51B3\u5B9A", decisions, (item) => item.description || String(item), "\u2713"));
    if (actions.length) groups.appendChild(actionGroup("\u63A5\u4E0B\u6765\u8981\u505A", actions, (item) => item.description || String(item), "\u2192"));
    slide2._card.appendChild(groups);
    return slide2;
  }
  function actionGroup(title, items, formatter, symbol) {
    const group = document.createElement("section");
    const heading = node("div", "em-recap-group-title");
    heading.textContent = title;
    group.appendChild(heading);
    items.slice(0, 4).forEach((item) => {
      const row = node("div", "em-recap-action-row");
      const icon = document.createElement("span");
      icon.textContent = symbol;
      const copy = document.createElement("span");
      copy.textContent = formatter(item);
      row.append(icon, copy);
      group.appendChild(row);
    });
    return group;
  }
  function themesCard(clusters, theme) {
    const slide2 = cardShell(theme, "\u4E3B\u9898\u805A\u7C7B", "\u8FD9\u4E00\u5468\uFF0C\u56F4\u7ED5\u8FD9\u4E9B\u4E8B\u5C55\u5F00");
    const list = node("div", "em-recap-themes");
    clusters.slice(0, 5).forEach((cluster, index) => {
      var _a;
      const item = document.createElement("div");
      const title = node("div", "em-recap-theme-title");
      title.textContent = cluster.theme;
      const keywords = node("div", "em-recap-theme-keywords");
      keywords.textContent = ((_a = cluster.keywords) == null ? void 0 : _a.join(" \xB7 ")) || "";
      item.append(title, keywords);
      list.appendChild(item);
    });
    slide2._card.appendChild(list);
    return slide2;
  }
  function updatesCard(updates, theme) {
    const slide2 = cardShell(theme, "\u8BB0\u5FC6\u6F14\u5316", "\u6709\u4E9B\u7406\u89E3\uFF0C\u5DF2\u7ECF\u6539\u53D8");
    const list = node("div", "em-recap-updates");
    updates.slice(0, 5).forEach((update2) => {
      const item = document.createElement("div");
      if (update2.previous_version) {
        const before = node("div", "em-recap-before");
        before.textContent = update2.previous_version;
        item.appendChild(before);
      }
      const after = node("div", "em-recap-after");
      after.textContent = `${update2.is_update ? "\u66F4\u65B0\u4E3A" : "\u65B0\u589E"}\uFF1A${update2.statement}`;
      item.appendChild(after);
      list.appendChild(item);
    });
    slide2._card.appendChild(list);
    return slide2;
  }
  function tagsCard(summary, theme) {
    const slide2 = cardShell(theme, "\u8BB0\u5FC6\u4E2D\u7684\u7EBF\u7D22", "\u8FD9\u4E9B\u4EBA\u548C\u4E8B\uFF0C\u88AB\u53CD\u590D\u63D0\u8D77");
    const groups = node("div", "em-recap-tag-groups");
    [
      ["\u4E3B\u9898", summary.topics || []],
      ["\u4EBA\u7269", summary.people || []],
      ["\u60C5\u7EEA", summary.emotions || []]
    ].forEach(([label, items]) => {
      if (!items.length) return;
      const group = document.createElement("div");
      const heading = node("div", "em-recap-group-title");
      heading.textContent = label;
      const wrap = node("div", "em-recap-tags");
      items.slice(0, 10).forEach((item) => {
        const tag = document.createElement("span");
        tag.textContent = item;
        wrap.appendChild(tag);
      });
      group.append(heading, wrap);
      groups.appendChild(group);
    });
    slide2._card.appendChild(groups);
    return slide2;
  }
  function agentCard(note, theme) {
    const slide2 = cardShell(theme, "ECHO \u7684\u89C2\u5BDF", "\u6700\u540E\uFF0C\u60F3\u5BF9\u4F60\u8BF4");
    const mark = node("div", "em-recap-agent-mark");
    mark.textContent = "E";
    const quote = node("p", "em-recap-agent-note");
    quote.textContent = note;
    slide2._card.append(mark, quote);
    return slide2;
  }
  function sourceCard(basedOn = {}, generatedAt, type, theme) {
    const slide2 = cardShell(theme, "\u56DE\u987E\u5B8C\u6210", "\u6BCF\u4E00\u6BB5\u8BB0\u5FC6\uFF0C\u90FD\u6709\u6765\u5904");
    const sessions = Array.isArray(basedOn.sessions) ? basedOn.sessions.length : 0;
    const days = Array.isArray(basedOn.daily_dates) ? basedOn.daily_dates.length : 0;
    const atoms = basedOn.atom_count ?? basedOn.total_atom_count ?? 0;
    const messages = basedOn.message_count ?? 0;
    const list = node("div", "em-recap-source");
    [
      ["\u6570\u636E\u6765\u6E90", "EchoMem \u79DF\u6237\u957F\u671F\u8BB0\u5FC6"],
      [type === "daily" ? "\u8986\u76D6\u4F1A\u8BDD" : "\u805A\u5408\u56DE\u987E", type === "daily" ? `${sessions} \u4E2A\u4F1A\u8BDD` : `${days} \u4E2A\u6BCF\u65E5\u56DE\u987E`],
      ["\u4E8B\u5B9E\u8BB0\u5FC6", `${atoms} \u6761${messages ? ` \xB7 ${messages} \u6761\u6D88\u606F` : ""}`],
      ["\u751F\u6210\u65F6\u95F4", generatedAt ? formatDateTime(generatedAt) : "\u672A\u8BB0\u5F55"]
    ].forEach(([label, value]) => {
      const row = document.createElement("div");
      const key = document.createElement("span");
      key.textContent = label;
      const val = document.createElement("strong");
      val.textContent = value;
      row.append(key, val);
      list.appendChild(row);
    });
    slide2._card.appendChild(list);
    return slide2;
  }
  function navButton(symbol, label, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `em-recap-nav ${className}`;
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    return button;
  }
  function factText(item) {
    return typeof item === "string" ? item : item.statement || "";
  }
  function highlightText(item) {
    return typeof item === "string" ? item : item.description || "";
  }
  function typeLabel(type) {
    return { decision: "\u91CD\u8981\u51B3\u5B9A", state_change: "\u72B6\u6001\u53D8\u5316", action: "\u5173\u952E\u884C\u52A8", observation: "\u65B0\u7684\u89C2\u5BDF", milestone: "\u91CC\u7A0B\u7891" }[type] || "";
  }
  function hasTags(summary) {
    var _a, _b, _c;
    return Boolean(((_a = summary.emotions) == null ? void 0 : _a.length) || ((_b = summary.topics) == null ? void 0 : _b.length) || ((_c = summary.people) == null ? void 0 : _c.length));
  }
  function formatDate(value) {
    if (!value) return "\u65E5\u671F\u672A\u8BB0\u5F55";
    const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
  }
  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
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
    .em-summary-stage { flex: 1 1 auto; min-height: 0; overflow: auto; padding: clamp(18px,2.6vw,34px); background: radial-gradient(circle at 12% 14%,rgba(234,221,255,.52),transparent 30%),linear-gradient(145deg,#fffbfe,#fef7ff 55%,#f6f1fa); }
    .em-summary-board { max-width: 1040px; margin: 0 auto; padding-bottom: 22px; }
    .em-summary-hero {
      position: relative; overflow: hidden; padding: clamp(24px,4vw,44px);
      background: radial-gradient(circle at 88% 0%,rgba(85,214,220,.15),transparent 38%), linear-gradient(135deg,rgba(18,39,53,.94),rgba(10,22,32,.9));
    }
    .em-summary-hero::after { content: ''; position: absolute; right: -54px; bottom: -74px; width: 220px; height: 220px; border: 1px solid rgba(85,214,220,.09); border-radius: 50%; box-shadow: 0 0 0 28px rgba(85,214,220,.025),0 0 0 58px rgba(85,214,220,.018); }
    .em-summary-hero > * { position: relative; z-index: 1; }
    .em-summary-hero h1 { max-width: 820px; margin: 15px 0 0; color: var(--em-text); font-size: clamp(21px,2.7vw,30px); font-weight: 570; line-height: 1.55; letter-spacing: -.02em; }
    .em-summary-hero-sub { margin-top: 13px; color: var(--em-text-3); font-size: 11px; }
    .em-summary-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 1px; margin-top: 12px; overflow: hidden; border: 1px solid var(--em-line); border-radius: 13px; background: var(--em-line); }
    .em-summary-metric { min-height: 82px; padding: 16px 18px; background: rgba(10,22,32,.94); }
    .em-summary-metric-value { color: var(--em-text); font: 650 23px/1.1 "JetBrains Mono",monospace; }
    .em-summary-metric-label { margin-top: 8px; color: var(--em-text-3); font-size: 10px; }
    .em-summary-grid { display: grid; grid-template-columns: repeat(12,minmax(0,1fr)); gap: 12px; margin-top: 12px; }
    .em-summary-section { grid-column: span 6; padding: 20px; }
    .em-summary-section.is-wide { grid-column: 1/-1; }
    .em-summary-section.is-third { grid-column: span 4; }
    .em-summary-section-copy { margin: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.78; }
    .em-summary-list { display: flex; flex-direction: column; gap: 9px; }
    .em-summary-row { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; padding: 10px 11px; border-radius: 9px; background: rgba(255,255,255,.025); }
    .em-summary-row-mark { width: 20px; color: var(--row-color,var(--em-cyan)); font: 650 11px/1.6 "JetBrains Mono",monospace; text-align: center; }
    .em-summary-row-copy { color: var(--em-text-2); font-size: 12px; line-height: 1.58; }
    .em-summary-row-meta { margin-top: 4px; color: var(--em-text-3); font-size: 10px; }
    .em-highlight-card { border-color: rgba(239,200,117,.22); background: linear-gradient(135deg,rgba(239,200,117,.09),rgba(14,28,41,.88)); }
    .em-highlight-copy { margin: 4px 0 0; color: #f3dfad; font-size: 17px; line-height: 1.65; }
    .em-theme { padding: 12px 0; border-bottom: 1px solid var(--em-line); }
    .em-theme:first-of-type { padding-top: 0; }
    .em-theme:last-child { padding-bottom: 0; border-bottom: 0; }
    .em-theme-title { color: var(--em-text); font-size: 13px; font-weight: 620; }
    .em-theme-keywords { margin-top: 7px; color: var(--em-text-3); font-size: 10px; line-height: 1.6; }
    .em-memory-update { padding: 12px 13px; border-left: 2px solid var(--em-pink); border-radius: 0 9px 9px 0; background: rgba(233,149,189,.045); }
    .em-memory-update + .em-memory-update { margin-top: 8px; }
    .em-memory-before { color: var(--em-text-3); font-size: 10px; text-decoration: line-through; }
    .em-memory-after { margin-top: 5px; color: var(--em-text-2); font-size: 12px; line-height: 1.55; }
    .em-agent-note { display: flex; gap: 14px; align-items: flex-start; }
    .em-agent-avatar { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(85,214,220,.25); border-radius: 10px; color: var(--em-cyan); background: rgba(85,214,220,.07); font-weight: 700; }
    .em-agent-quote { margin: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.72; }
    .em-summary-provenance { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 13px; padding: 0 3px; color: var(--em-text-3); font-size: 10px; }
    .em-summary-stage { overflow: hidden; }
    .echomem-feedback-shell .swiper { position: relative; display: block; margin: 0 auto; padding: 0; overflow: hidden; list-style: none; z-index: 1; }
    .echomem-feedback-shell .swiper-wrapper { position: relative; display: flex; width: 100%; height: 100%; z-index: 1; transition-property: transform; transition-timing-function: var(--swiper-wrapper-transition-timing-function, initial); box-sizing: content-box; }
    .echomem-feedback-shell .swiper-slide { position: relative; display: block; flex-shrink: 0; width: 100%; height: 100%; transition-property: transform; }
    .echomem-feedback-shell .swiper-3d { perspective: 1200px; }
    .echomem-feedback-shell .swiper-3d .swiper-wrapper,
    .echomem-feedback-shell .swiper-3d .swiper-slide,
    .echomem-feedback-shell .swiper-3d .swiper-slide-shadow { transform-style: preserve-3d; }
    .echomem-feedback-shell .swiper-slide-transform { width: 100%; height: 100%; }
    .echomem-feedback-shell .swiper-slide-shadow { position: absolute; inset: 0; z-index: 10; border-radius: 24px; pointer-events: none; background: rgba(0,0,0,.18); }
    .em-recap { position: relative; width: 100%; height: 100%; min-height: 390px; display: grid; place-items: center; isolation: isolate; }
    .em-recap.is-initializing .swiper-slide:not(:first-child), .em-recap.is-fallback .swiper-slide:not(:first-child) { display: none; }
    .em-recap.is-fallback .swiper-wrapper { transform: none !important; }
    .em-recap::before, .em-recap::after { content: ''; position: absolute; border-radius: 50%; filter: blur(2px); pointer-events: none; }
    .em-recap::before { width: 280px; height: 280px; left: 6%; top: 8%; background: radial-gradient(circle,rgba(85,214,220,.11),transparent 68%); }
    .em-recap::after { width: 320px; height: 320px; right: 4%; bottom: -10%; background: radial-gradient(circle,rgba(182,154,255,.1),transparent 68%); }
    .em-recap-swiper { width: min(480px, calc(100% - 110px)); height: min(500px, calc(100% - 56px)); min-height: 340px; overflow: hidden; border-radius: 24px; filter: drop-shadow(16px 15px 0 rgba(85,214,220,.055)) drop-shadow(28px 27px 0 rgba(182,154,255,.035)); }
    .em-recap-swiper .swiper-slide { opacity: .18; transform: scale(.965); transition: opacity .34s ease, transform .48s cubic-bezier(.2,.75,.25,1); }
    .em-recap-swiper .swiper-slide-active { opacity: 1; transform: scale(1); }
    .em-recap-card { position: relative; width: 100%; height: 100%; overflow: hidden; padding: clamp(24px,4vh,38px); border: 1px solid rgba(255,255,255,.28); border-radius: 24px; color: #fff; box-shadow: 0 24px 64px rgba(33,0,93,.2); background: linear-gradient(145deg,#6750a4,#21005d); }
    .em-recap-card::before { content: ''; position: absolute; inset: 0; opacity: .62; background-image: radial-gradient(rgba(255,255,255,.12) .7px,transparent .7px); background-size: 17px 17px; mask-image: linear-gradient(to bottom,black,transparent 58%); pointer-events: none; }
    .em-recap-card.is-ocean { background: linear-gradient(150deg,#6750a4 0%,#4f378b 52%,#21005d 100%); }
    .em-recap-card.is-violet { background: linear-gradient(150deg,#7b61b5 0%,#6750a4 52%,#3a1860 100%); }
    .em-recap-card.is-blue { background: linear-gradient(150deg,#5278c5 0%,#6750a4 58%,#21005d 100%); }
    .em-recap-card.is-cyan { background: linear-gradient(150deg,#625b71 0%,#6750a4 58%,#21005d 100%); }
    .em-recap-card.is-amber { background: linear-gradient(150deg,#9a6b27 0%,#75567b 54%,#3a285f 100%); }
    .em-recap-card.is-green { background: linear-gradient(150deg,#47735a 0%,#5f587d 54%,#332255 100%); }
    .em-recap-card.is-rose { background: linear-gradient(150deg,#9a5b78 0%,#785b91 54%,#3a285f 100%); }
    .em-recap-card.is-purple { background: linear-gradient(150deg,#7b61b5 0%,#6750a4 54%,#21005d 100%); }
    .em-recap-card.is-slate { background: linear-gradient(150deg,#625b71 0%,#51485f 54%,#2f2738 100%); }
    .em-recap-glow { position: absolute; width: 230px; height: 230px; right: -90px; top: -100px; border-radius: 50%; background: rgba(255,255,255,.13); filter: blur(10px); }
    .em-recap-card-head { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .em-recap-mark { font: 700 9px/1 "JetBrains Mono",monospace; letter-spacing: .18em; opacity: .64; }
    .em-recap-eyebrow { font-size: 10px; letter-spacing: .08em; opacity: .74; }
    .em-recap-title { position: relative; z-index: 2; max-width: 390px; margin: clamp(22px,4vh,34px) 0 0; font-size: clamp(23px,3.4vw,31px); font-weight: 620; line-height: 1.36; letter-spacing: -.025em; }
    .em-recap-card.is-cover { display: flex; flex-direction: column; }
    .em-recap-cover-title { position: relative; z-index: 2; max-width: 410px; margin: auto 0 0; font-size: clamp(26px,4.2vw,38px); font-weight: 570; line-height: 1.42; letter-spacing: -.035em; }
    .em-recap-period { position: relative; z-index: 2; margin-top: 20px; font: 600 12px/1.4 "JetBrains Mono",monospace; letter-spacing: .05em; opacity: .78; }
    .em-recap-cover-note { position: relative; z-index: 2; margin-top: 8px; font-size: 11px; opacity: .58; }
    .em-recap-orb { position: absolute; width: 210px; height: 210px; right: -28px; top: 58px; opacity: .72; }
    .em-recap-orb span { position: absolute; inset: 0; border: 1px solid rgba(255,255,255,.2); border-radius: 48% 52% 62% 38%; animation: em-orbit 13s linear infinite; }
    .em-recap-orb span:nth-child(2) { inset: 24px; animation-duration: 9s; animation-direction: reverse; border-radius: 58% 42% 42% 58%; }
    .em-recap-orb span:nth-child(3) { inset: 53px; animation-duration: 6s; background: rgba(255,255,255,.08); border: 0; }
    .em-recap-progress { position: absolute; z-index: 20; top: 4px; left: 50%; width: min(470px,calc(100% - 120px)); display: flex; gap: 5px; transform: translateX(-50%); }
    .em-recap-progress button { flex: 1 1 0; height: 3px; padding: 0; overflow: hidden; border: 0; border-radius: 999px; background: rgba(36,69,81,.13); cursor: pointer; }
    .em-recap-progress button::after { content: ''; display: block; width: 0; height: 100%; border-radius: inherit; background: linear-gradient(90deg,var(--em-cyan),#c3f4f5); transition: width .35s ease; }
    .em-recap-progress button.is-complete::after, .em-recap-progress button.is-active::after { width: 100%; }
    .em-recap-progress button.is-active::after { box-shadow: 0 0 10px rgba(85,214,220,.7); }
    .em-recap-nav { position: absolute; z-index: 20; top: 50%; width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--em-line); border-radius: 50%; background: rgba(255,255,255,.86); color: var(--em-text-2); font-size: 25px; line-height: 1; cursor: pointer; transform: translateY(-50%); box-shadow: 0 10px 24px rgba(41,72,83,.1); backdrop-filter: blur(12px); transition: .18s ease; }
    .em-recap-nav.is-prev { left: max(10px,calc(50% - 310px)); }
    .em-recap-nav.is-next { right: max(10px,calc(50% - 310px)); }
    .em-recap-nav:hover:not(:disabled) { color: var(--em-cyan); border-color: var(--em-line-strong); transform: translateY(-50%) scale(1.05); }
    .em-recap-nav:disabled { opacity: .22; cursor: default; }
    .em-recap-footer { position: absolute; z-index: 20; bottom: 0; left: 50%; width: min(470px,calc(100% - 120px)); display: flex; align-items: center; justify-content: space-between; color: var(--em-text-3); font-size: 10px; transform: translateX(-50%); }
    .em-recap-count { color: var(--em-text-2); font: 600 10px/1 "JetBrains Mono",monospace; letter-spacing: .08em; }
    .em-recap-metrics { position: relative; z-index: 2; display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-top: clamp(22px,4vh,36px); overflow: auto; }
    .em-recap-metric { padding: 15px; border: 1px solid rgba(255,255,255,.11); border-radius: 14px; background: rgba(255,255,255,.055); backdrop-filter: blur(6px); }
    .em-recap-metric-value { font: 650 clamp(24px,4vw,36px)/1.1 "JetBrains Mono",monospace; }
    .em-recap-metric-label { margin-top: 8px; font-size: 10px; opacity: .64; }
    .em-recap-reading { position: relative; z-index: 2; max-height: calc(100% - 116px); margin: clamp(20px,4vh,34px) 0 0; overflow: auto; font-size: clamp(14px,1.9vw,17px); line-height: 1.9; letter-spacing: .01em; opacity: .91; }
    .em-recap-big-symbol { position: relative; z-index: 2; margin-top: 25px; color: #ffe0a1; font-size: 54px; line-height: 1; text-shadow: 0 0 30px rgba(255,219,145,.4); }
    .em-recap-highlight { position: relative; z-index: 2; margin: 18px 0 0; font-size: clamp(18px,2.6vw,24px); line-height: 1.65; color: #fff1cc; }
    .em-recap-list, .em-recap-action-groups, .em-recap-themes, .em-recap-updates, .em-recap-tag-groups, .em-recap-source { position: relative; z-index: 2; max-height: calc(100% - 118px); margin-top: 22px; overflow: auto; }
    .em-recap-list-row { display: grid; grid-template-columns: 27px 1fr; gap: 10px; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,.1); font-size: 12px; line-height: 1.58; }
    .em-recap-list-row:last-child { border-bottom: 0; }
    .em-recap-list-number { font: 600 10px/1.8 "JetBrains Mono",monospace; opacity: .5; }
    .em-recap-action-groups { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .em-recap-group-title { margin-bottom: 10px; font-size: 10px; letter-spacing: .08em; opacity: .58; }
    .em-recap-action-row { display: grid; grid-template-columns: 20px 1fr; gap: 8px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.09); font-size: 11px; line-height: 1.55; }
    .em-recap-theme-title { font-size: 13px; font-weight: 650; }
    .em-recap-theme-keywords { margin-top: 5px; font-size: 10px; line-height: 1.5; opacity: .58; }
    .em-recap-themes > div, .em-recap-updates > div { padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,.1); }
    .em-recap-before { font-size: 10px; opacity: .45; text-decoration: line-through; }
    .em-recap-after { margin-top: 5px; font-size: 12px; line-height: 1.55; }
    .em-recap-tag-groups { display: flex; flex-direction: column; gap: 19px; }
    .em-recap-tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .em-recap-tags span { padding: 6px 10px; border: 1px solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(255,255,255,.06); font-size: 11px; }
    .em-recap-agent-mark { position: relative; z-index: 2; display: grid; place-items: center; width: 48px; height: 48px; margin-top: 28px; border: 1px solid rgba(255,255,255,.2); border-radius: 15px; background: rgba(255,255,255,.08); font: 700 18px/1 "JetBrains Mono",monospace; }
    .em-recap-agent-note { position: relative; z-index: 2; margin: 24px 0 0; font-size: clamp(18px,2.6vw,24px); line-height: 1.7; }
    .em-recap-source > div { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,.1); }
    .em-recap-source span { font-size: 10px; opacity: .55; }
    .em-recap-source strong { font-size: 12px; font-weight: 600; text-align: right; }
    .em-summary-toolbar { position: relative; overflow: visible; }
    .em-date-control { position: relative; margin-left: auto; }
    .em-calendar-trigger { min-width: 180px; height: 40px; display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid var(--em-line); border-radius: 12px; color: var(--em-text-2); background: #fff; cursor: pointer; box-shadow: none; transition: .2s ease; }
    .em-calendar-trigger:hover, .em-calendar-trigger.is-open { color: #21005d; border-color: var(--em-line-strong); background: rgba(103,80,164,.08); }
    .em-calendar-icon { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; color: var(--em-cyan); background: rgba(85,214,220,.1); font-size: 13px; }
    .em-calendar-label { flex: 1; text-align: left; font-size: 11px; }
    .em-calendar-chevron { color: var(--em-text-3); font-size: 13px; transition: transform .18s ease; }
    .em-calendar-trigger.is-open .em-calendar-chevron { transform: rotate(180deg); }
    .em-date-popover { position: absolute; z-index: 50; top: calc(100% + 9px); right: 0; width: 310px; padding: 16px; visibility: hidden; opacity: 0; transform: translateY(-6px) scale(.98); transform-origin: top right; border: 1px solid var(--em-line); border-radius: 16px; background: rgba(255,255,255,.98); box-shadow: 0 18px 48px rgba(33,0,93,.16); backdrop-filter: blur(18px); transition: opacity .2s ease, transform .2s ease, visibility .2s; }
    .em-date-popover.is-open { visibility: visible; opacity: 1; transform: translateY(0) scale(1); }
    .em-calendar-head { display: grid; grid-template-columns: 30px 1fr 30px; align-items: center; gap: 8px; }
    .em-calendar-head strong { color: var(--em-text); font-size: 13px; text-align: center; }
    .em-calendar-head button { width: 30px; height: 30px; border: 1px solid transparent; border-radius: 8px; color: var(--em-text-2); background: transparent; cursor: pointer; }
    .em-calendar-head button:hover:not(:disabled) { color: var(--em-cyan); border-color: var(--em-line); background: rgba(85,214,220,.06); }
    .em-calendar-head button:disabled { opacity: .22; cursor: default; }
    .em-calendar-weekdays, .em-calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
    .em-calendar-weekdays { margin: 15px 0 7px; }
    .em-calendar-weekdays span { color: var(--em-text-3); font-size: 9px; text-align: center; }
    .em-calendar-grid > span, .em-calendar-grid button { aspect-ratio: 1; }
    .em-calendar-grid button { position: relative; border: 1px solid transparent; border-radius: 9px; color: var(--em-text-2); background: rgba(28,66,78,.045); font-size: 11px; cursor: pointer; transition: .15s ease; }
    .em-calendar-grid button:hover:not(:disabled) { color: var(--em-text); border-color: rgba(85,214,220,.3); background: rgba(85,214,220,.1); transform: translateY(-1px); }
    .em-calendar-grid button:disabled { color: rgba(113,137,151,.25); background: transparent; cursor: default; }
    .em-calendar-grid button:not(:disabled)::after { content: ''; position: absolute; left: 50%; bottom: 4px; width: 3px; height: 3px; border-radius: 50%; background: var(--em-cyan); transform: translateX(-50%); }
    .em-calendar-grid button.is-selected { color: #ffffff; border-color: var(--em-cyan); background: var(--em-cyan); font-weight: 700; box-shadow: 0 7px 18px rgba(15,143,149,.2); }
    .em-calendar-grid button.is-selected::after { background: #ffffff; }
    .em-calendar-grid button.is-today:not(.is-selected) { border-color: rgba(239,200,117,.35); }
    .em-calendar-hint { margin: 12px 0 0; color: var(--em-text-3); font-size: 9px; text-align: center; }
    .em-week-picker-title { color: var(--em-text); font-size: 13px; font-weight: 650; }
    .em-week-picker { max-height: 310px; margin-top: 12px; overflow: auto; display: flex; flex-direction: column; gap: 7px; }
    .em-week-picker button { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 12px; border: 1px solid var(--em-line); border-radius: 10px; color: var(--em-text-2); background: rgba(239,245,246,.72); cursor: pointer; text-align: left; }
    .em-week-picker button:hover { border-color: var(--em-line-strong); background: rgba(85,214,220,.06); }
    .em-week-picker button.is-selected { border-color: rgba(85,214,220,.35); background: rgba(85,214,220,.1); }
    .em-week-picker strong { font-size: 11px; font-weight: 620; }
    .em-week-picker span { color: var(--em-text-3); font-size: 9px; }
    @keyframes em-orbit { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .em-recap-orb span { animation: none !important; }
      .em-recap-nav { transition: none !important; }
    }
    @media (max-width: 820px) {
      .em-summary-section, .em-summary-section.is-third { grid-column: 1/-1; }
      .em-summary-metrics { grid-template-columns: repeat(2,1fr); }
      .em-summary-stage { padding: 14px 10px; }
      .em-recap-swiper { width: min(430px,calc(100% - 38px)); height: min(500px,calc(100% - 50px)); }
      .em-recap-progress, .em-recap-footer { width: min(420px,calc(100% - 48px)); }
      .em-recap-nav { width: 34px; height: 34px; }
      .em-recap-nav.is-prev { left: 0; }
      .em-recap-nav.is-next { right: 0; }
      .em-recap-action-groups { grid-template-columns: 1fr; gap: 18px; }
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
    container.style.position = "relative";
    injectSummaryTheme(container);
    const state = {
      mode: options.mode || "daily",
      currentDate: options.date || todayStr(),
      currentWeek: options.week || getWeekKey(todayStr()),
      calendarMonth: monthKey(options.date || todayStr()),
      calendarOpen: false,
      summary: null,
      available: { daily: [], weekly: [] },
      handlers: {},
      cardsRoot: null,
      loadRevision: 0
    };
    const root = document.createElement("div");
    root.className = "em-summary-view";
    const toolbar = buildToolbar(state);
    const stage = document.createElement("div");
    stage.className = "em-summary-stage";
    root.append(toolbar, stage);
    container.appendChild(root);
    async function load({ preserveKey = false } = {}) {
      const revision = ++state.loadRevision;
      const isCurrent = () => container.isConnected && container._summaryState === state && state.loadRevision === revision;
      setLoading(stage);
      try {
        const available = await fetchSummaryList();
        if (!isCurrent()) return;
        state.available = available;
        alignPeriodWithAvailable(state, preserveKey);
        state.calendarMonth = monthKey(state.currentDate || todayStr());
        const key = currentKey(state);
        const summary = !key ? null : state.mode === "daily" ? await fetchDailySummary(key) : await fetchWeeklySummary(key);
        if (!isCurrent()) return;
        state.summary = summary;
        updateToolbar(toolbar, state);
        draw();
      } catch (err) {
        console.error("EchoMem: \u52A0\u8F7D\u8BB0\u5FC6\u56DE\u987E\u5931\u8D25", err);
        if (isCurrent()) setError(stage, err, () => load({ preserveKey: true }));
      }
    }
    function draw() {
      var _a, _b;
      (_b = (_a = state.cardsRoot) == null ? void 0 : _a._cleanup) == null ? void 0 : _b.call(_a);
      state.cardsRoot = null;
      stage.innerHTML = "";
      if (!state.summary) {
        setEmpty(stage, state.mode);
        return;
      }
      state.cardsRoot = state.mode === "daily" ? renderDailyCards(state.summary) : renderWeeklyCards(state.summary);
      stage.appendChild(state.cardsRoot);
    }
    function switchMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      state.calendarOpen = false;
      alignPeriodWithAvailable(state, false);
      updateToolbar(toolbar, state);
      load();
    }
    function toggleCalendar(force) {
      state.calendarOpen = typeof force === "boolean" ? force : !state.calendarOpen;
      updateToolbar(toolbar, state);
    }
    function selectPeriod(key) {
      setCurrentKey(state, key);
      state.calendarOpen = false;
      updateToolbar(toolbar, state);
      load({ preserveKey: true });
    }
    function shiftCalendarMonth(delta) {
      const months = [...new Set(state.available.daily.map(monthKey))].sort();
      if (!months.length) return;
      const currentIndex = Math.max(0, months.indexOf(state.calendarMonth));
      state.calendarMonth = months[Math.max(0, Math.min(months.length - 1, currentIndex + delta))];
      updateToolbar(toolbar, state);
    }
    const onOutside = (event2) => {
      if (state.calendarOpen && !toolbar.contains(event2.target)) toggleCalendar(false);
    };
    const onEscape = (event2) => {
      if (event2.key === "Escape" && state.calendarOpen) toggleCalendar(false);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    state.handlers = {
      switchMode,
      toggleCalendar,
      selectPeriod,
      shiftCalendarMonth,
      load,
      onOutside,
      onEscape
    };
    container._summaryState = state;
    load();
  }
  function buildToolbar(state) {
    const bar = document.createElement("div");
    bar.className = "em-toolbar em-summary-toolbar";
    const heading = document.createElement("div");
    heading.className = "em-episode-heading";
    const title = document.createElement("strong");
    title.textContent = "\u8BB0\u5FC6\u56DE\u987E";
    heading.appendChild(title);
    const modeWrap = document.createElement("div");
    modeWrap.className = "em-segmented";
    MODE_OPTIONS.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.dataset.key = option.key;
      button.setAttribute("aria-pressed", String(option.key === state.mode));
      button.addEventListener("click", () => state.handlers.switchMode(option.key));
      modeWrap.appendChild(button);
    });
    const dateControl = document.createElement("div");
    dateControl.className = "em-date-control";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "em-calendar-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const icon = document.createElement("span");
    icon.className = "em-calendar-icon";
    icon.textContent = "\u25A6";
    const label = document.createElement("span");
    label.className = "em-calendar-label";
    const chevron = document.createElement("span");
    chevron.className = "em-calendar-chevron";
    chevron.textContent = "\u2304";
    trigger.append(icon, label, chevron);
    trigger.addEventListener("click", (event2) => {
      event2.stopPropagation();
      state.handlers.toggleCalendar();
    });
    const popover = document.createElement("div");
    popover.className = "em-date-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "\u9009\u62E9\u8BB0\u5FC6\u56DE\u987E\u65E5\u671F");
    dateControl.append(trigger, popover);
    bar.append(heading, modeWrap, dateControl);
    bar._modeWrap = modeWrap;
    bar._trigger = trigger;
    bar._label = label;
    bar._popover = popover;
    return bar;
  }
  function updateToolbar(bar, state) {
    bar._modeWrap.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.key === state.mode));
    });
    bar._label.textContent = formatPeriodLabel(state.mode, currentKey(state));
    bar._trigger.setAttribute("aria-expanded", String(state.calendarOpen));
    bar._trigger.classList.toggle("is-open", state.calendarOpen);
    bar._popover.classList.toggle("is-open", state.calendarOpen);
    renderPeriodPicker(bar._popover, state);
  }
  function renderPeriodPicker(container, state) {
    container.innerHTML = "";
    if (state.mode === "weekly") {
      renderWeekPicker(container, state);
      return;
    }
    renderCalendar(container, state);
  }
  function renderCalendar(container, state) {
    const available = new Set(state.available.daily);
    const months = [...new Set(state.available.daily.map(monthKey))].sort();
    const currentMonth = state.calendarMonth || months[months.length - 1] || monthKey(todayStr());
    const monthIndex = months.indexOf(currentMonth);
    const header = document.createElement("div");
    header.className = "em-calendar-head";
    const prev = calendarArrow("\u2039", "\u4E0A\u4E00\u4E2A\u6709\u56DE\u987E\u7684\u6708\u4EFD");
    const title = document.createElement("strong");
    title.textContent = formatMonth(currentMonth);
    const next = calendarArrow("\u203A", "\u4E0B\u4E00\u4E2A\u6709\u56DE\u987E\u7684\u6708\u4EFD");
    prev.disabled = monthIndex <= 0;
    next.disabled = monthIndex < 0 || monthIndex >= months.length - 1;
    prev.addEventListener("click", () => state.handlers.shiftCalendarMonth(-1));
    next.addEventListener("click", () => state.handlers.shiftCalendarMonth(1));
    header.append(prev, title, next);
    const weekdays = document.createElement("div");
    weekdays.className = "em-calendar-weekdays";
    ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"].forEach((day) => {
      const item = document.createElement("span");
      item.textContent = day;
      weekdays.appendChild(item);
    });
    const grid = document.createElement("div");
    grid.className = "em-calendar-grid";
    const [year, month] = currentMonth.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let index = 0; index < offset; index += 1) grid.appendChild(document.createElement("span"));
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(day);
      button.disabled = !available.has(key);
      button.classList.toggle("is-selected", key === state.currentDate);
      button.classList.toggle("is-today", key === todayStr());
      button.setAttribute("aria-label", available.has(key) ? `\u67E5\u770B ${formatPeriodLabel("daily", key)}\u7684\u56DE\u987E` : `${key} \u6CA1\u6709\u56DE\u987E`);
      if (available.has(key)) button.addEventListener("click", () => state.handlers.selectPeriod(key));
      grid.appendChild(button);
    }
    const hint = document.createElement("p");
    hint.className = "em-calendar-hint";
    hint.textContent = "\u4EAE\u8D77\u7684\u65E5\u671F\u5DF2\u6709\u8BB0\u5FC6\u56DE\u987E";
    container.append(header, weekdays, grid, hint);
  }
  function renderWeekPicker(container, state) {
    const title = document.createElement("div");
    title.className = "em-week-picker-title";
    title.textContent = "\u9009\u62E9\u4E00\u5468";
    const list = document.createElement("div");
    list.className = "em-week-picker";
    [...state.available.weekly].reverse().forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("is-selected", key === state.currentWeek);
      const main = document.createElement("strong");
      main.textContent = formatPeriodLabel("weekly", key);
      const range = document.createElement("span");
      range.textContent = weekRange(key);
      button.append(main, range);
      button.addEventListener("click", () => state.handlers.selectPeriod(key));
      list.appendChild(button);
    });
    if (!state.available.weekly.length) {
      const empty = document.createElement("p");
      empty.className = "em-calendar-hint";
      empty.textContent = "\u6682\u65F6\u6CA1\u6709\u6BCF\u5468\u56DE\u987E";
      list.appendChild(empty);
    }
    container.append(title, list);
  }
  function calendarArrow(symbol, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    return button;
  }
  function alignPeriodWithAvailable(state, preserveKey) {
    const keys = availableKeys(state);
    const key = currentKey(state);
    if (!keys.length) {
      setCurrentKey(state, "");
      return;
    }
    if (!preserveKey || !keys.includes(key)) setCurrentKey(state, keys[keys.length - 1]);
  }
  function availableKeys(state) {
    return state.mode === "daily" ? state.available.daily : state.available.weekly;
  }
  function currentKey(state) {
    return state.mode === "daily" ? state.currentDate : state.currentWeek;
  }
  function setCurrentKey(state, key) {
    if (state.mode === "daily") state.currentDate = key;
    else state.currentWeek = key;
  }
  function formatPeriodLabel(mode, key) {
    if (!key) return "\u9009\u62E9\u65E5\u671F";
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
    const fmt = (date) => `${date.getUTCMonth() + 1}\u6708${date.getUTCDate()}\u65E5`;
    return `${fmt(monday)} \u2014 ${fmt(sunday)}`;
  }
  function isoWeekMonday(year, week) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
    return monday;
  }
  function setLoading(container) {
    container.innerHTML = `
    <div class="em-loading">
      <div class="em-state-orb"></div>
      <p class="em-state-title">\u6B63\u5728\u6574\u7406\u8BB0\u5FC6\u56DE\u987E</p>
    </div>
  `;
  }
  function setError(container, err, retry) {
    container.innerHTML = "";
    const root = document.createElement("div");
    root.className = "em-error";
    root.innerHTML = '<div class="em-state-orb"></div><p class="em-state-title">\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u8BB0\u5FC6\u56DE\u987E</p>';
    const copy = document.createElement("p");
    copy.className = "em-state-copy";
    copy.textContent = (err == null ? void 0 : err.message) || "\u8BF7\u786E\u8BA4 EchoMem \u670D\u52A1\u4E0E\u8BB0\u5FC6\u5B58\u50A8\u53EF\u8BBF\u95EE\u3002";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "em-primary-btn";
    button.textContent = "\u91CD\u65B0\u8BFB\u53D6";
    button.addEventListener("click", retry);
    root.append(copy, button);
    container.appendChild(root);
  }
  function setEmpty(container, mode) {
    container.innerHTML = `
    <div class="em-empty">
      <div class="em-state-orb"></div>
      <p class="em-state-title">\u8FD8\u6CA1\u6709${mode === "daily" ? "\u6BCF\u65E5" : "\u6BCF\u5468"}\u8BB0\u5FC6\u56DE\u987E</p>
      <p class="em-state-copy">\u5B8C\u6210\u8BB0\u5FC6\u63D0\u4EA4\u5E76\u7B49\u5F85\u5BF9\u5E94\u5468\u671F\u7684\u56DE\u987E\u751F\u6210\u540E\uFF0C\u8FD9\u91CC\u4F1A\u81EA\u52A8\u51FA\u73B0\u3002</p>
    </div>
  `;
  }
  function todayStr() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  function cleanupSummary(container) {
    var _a, _b, _c, _d;
    const state = container == null ? void 0 : container._summaryState;
    if (state) state.loadRevision += 1;
    (_b = (_a = state == null ? void 0 : state.cardsRoot) == null ? void 0 : _a._cleanup) == null ? void 0 : _b.call(_a);
    if ((_c = state == null ? void 0 : state.handlers) == null ? void 0 : _c.onOutside) document.removeEventListener("pointerdown", state.handlers.onOutside);
    if ((_d = state == null ? void 0 : state.handlers) == null ? void 0 : _d.onEscape) document.removeEventListener("keydown", state.handlers.onEscape);
    if (container) container._summaryState = null;
  }

  // src/entry/feedback-summary.js
  var summaryFeedbackView = {
    key: "summary",
    label: "\u5468\u671F\u603B\u7ED3",
    mount: (container) => renderSummary(container),
    cleanup: (container) => cleanupSummary(container)
  };
  globalThis.__ECHOMEM_FEEDBACK_VIEWS__ ||= /* @__PURE__ */ new Map();
  globalThis.__ECHOMEM_FEEDBACK_VIEWS__.set(summaryFeedbackView.key, summaryFeedbackView);
})();
