(() => {
  // src/config/platforms.json
  var platforms_default = {
    version: 1,
    platforms: [
      {
        id: "higo",
        name: "HIGO Office",
        enabled: true,
        record: false,
        detection: {
          urlPatterns: ["/home/session/", "/home/workspace/"],
          titleKeywords: ["Higo", "HIGO", "Higo2", "Higo Office", "Echo"],
          domFeatures: {
            required: [".MuiDrawer-root", ".MuiPaper-root"],
            optional: ["textarea[id^='_r_']", "[data-testid='ArrowUpwardIcon']", ".MuiDrawer-anchorRight"]
          },
          contentKeywords: ["higo", "HIGO", "Higo2", "echo", "Echo"]
        },
        headerLauncher: {
          anchorSelectors: [
            "[data-testid='ShareIcon']",
            "[data-testid='ChevronRightIcon']"
          ],
          preferredXRatio: 0.75,
          minXRatio: 0.18,
          maxXRatio: 0.94,
          maxTop: 120,
          logo: "assets/echomem-lockup.png",
          title: "\u6253\u5F00 EchoMem"
        },
        input: {
          selector: "textarea[id^='_r_']"
        },
        messages: {
          messageContainers: [
            "[class*='MessageList']",
            "[class*='message-list']",
            "[class*='chat-messages']",
            "[class*='conversation']",
            ".MuiPaper-root > .MuiList-root",
            ".MuiDrawer-paper > div > div",
            ".MuiPaper-root"
          ],
          userMessages: [
            "[class*='UserMessage']",
            "[class*='user-message']",
            "[class*='user']",
            "[style*='flex-end']"
          ],
          assistantMessages: [
            "[class*='AssistantMessage']",
            "[class*='assistant-message']",
            "[class*='assistant']",
            "[class*='bot-message']",
            "[class*='ai-message']"
          ],
          allMessages: ["div[class*='Mui']", "div"],
          noiseSelectors: [],
          smartContainerHints: [],
          assistant: {
            textSelector: null,
            skipIfMissing: false,
            roleSignals: []
          }
        },
        streaming: {
          strategy: "none"
        },
        panelHost: {
          type: "overlay",
          overlayConfig: {
            position: "right",
            width: "320px",
            backdrop: true
          }
        },
        sessionId: {
          type: "regex",
          pattern: "/home/session/([a-f0-9-]+)",
          flags: "i"
        },
        menuItems: [
          { panelId: "resources" },
          { panelId: "association" },
          { panelId: "feedback" },
          { panelId: "skillStore" },
          { panelId: "performance" }
        ]
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        enabled: true,
        record: true,
        detection: {
          urlPatterns: ["chat.deepseek.com"],
          titleKeywords: ["DeepSeek"],
          domFeatures: {
            required: ["textarea[placeholder*='DeepSeek']", "._24fad49"],
            optional: ["._020ab5b", "[role='button']"]
          },
          contentKeywords: ["deepseek", "\u6DF1\u5EA6\u601D\u8003", "\u667A\u80FD\u641C\u7D22"]
        },
        input: {
          selector: "textarea[placeholder*='DeepSeek']"
        },
        messages: {
          messageContainers: [
            ".ds-virtual-list",
            "[class*='virtual-list']"
          ],
          userMessages: [],
          assistantMessages: [],
          allMessages: [".ds-message"],
          noiseSelectors: [".ds-think-content"],
          smartContainerHints: [".ds-virtual-list"],
          assistant: {
            textSelector: ".ds-assistant-message-main-content",
            skipIfMissing: true,
            roleSignals: [
              ".ds-assistant-message-main-content",
              ".ds-think-content"
            ]
          }
        },
        streaming: {
          strategy: "button-svg-poll",
          params: {
            anchorSelector: "textarea",
            anchorParents: [
              "closest:form",
              "closest:[class*=chat]",
              "closest:[class*=input]",
              "parent:2",
              "parent:3"
            ],
            buttonSelector: ".ds-icon-button--l[role='button']",
            iconSelector: "svg path",
            iconAttr: "d",
            streamingMatch: "startsWith:M2 4.88",
            idleMatch: "startsWith:M8.3125",
            pollIntervalMs: 500,
            timeoutMs: 6e4
          }
        },
        panelHost: {
          type: "overlay",
          overlayConfig: {
            position: "right",
            width: "320px",
            backdrop: true
          }
        },
        sessionId: {
          type: "path",
          segment: -1
        },
        menuItems: [
          { panelId: "resources" },
          { panelId: "association" },
          { panelId: "feedback" },
          { panelId: "skillStore" },
          { panelId: "performance" }
        ]
      }
    ]
  };

  // src/config/loader.js
  var PLATFORM_CONFIGS = {};
  for (const config of platforms_default.platforms || []) {
    PLATFORM_CONFIGS[config.id] = { ...config };
  }

  // src/core/state.js
  var DEFAULT_STATE = {
    platform: null,
    association: {
      enabled: false,
      triggerThreshold: 3,
      debounceMs: 300,
      maxSuggestions: 5
    },
    panel: {
      isOpen: false,
      currentRoute: null
    }
  };
  var state = { ...DEFAULT_STATE };
  function getPlatform() {
    return state.platform;
  }

  // src/core/detection.js
  function getCurrentPlatform() {
    return getPlatform();
  }

  // src/core/content-injector.js
  function findInputElement() {
    var _a, _b, _c, _d, _e;
    const platform = getCurrentPlatform();
    if (!platform) return null;
    const selector = ((_b = (_a = platform.config) == null ? void 0 : _a.input) == null ? void 0 : _b.selector) || ((_e = (_d = (_c = platform.config) == null ? void 0 : _c.launcher) == null ? void 0 : _d.validateSelectors) == null ? void 0 : _e.textarea);
    if (!selector) return null;
    return document.querySelector(selector);
  }
  var MEM_TAG_OPEN = "<relevant-memories>";
  var MEM_TAG_CLOSE = "</relevant-memories>";
  function stripMemoryBlock(text) {
    const start = text.indexOf(MEM_TAG_OPEN);
    if (start === -1) return text.trim();
    const end = text.indexOf(MEM_TAG_CLOSE, start);
    if (end === -1) return text.trim();
    return (text.slice(0, start) + text.slice(end + MEM_TAG_CLOSE.length)).trim();
  }
  function injectContent(content, options = {}) {
    const textarea = findInputElement();
    if (!textarea) {
      console.warn("EchoMem: \u672A\u627E\u5230\u8F93\u5165\u6846\uFF0C\u65E0\u6CD5\u6CE8\u5165\u5185\u5BB9");
      return false;
    }
    const existing = textarea.value || "";
    let base = options.replace ? stripMemoryBlock(existing) : existing;
    const cleanContent = content.replace(new RegExp(MEM_TAG_OPEN, "g"), "").replace(new RegExp(MEM_TAG_CLOSE, "g"), "").trim();
    if (!cleanContent) return false;
    const block = options.asPlainText ? cleanContent : `${MEM_TAG_OPEN}
${cleanContent}
${MEM_TAG_CLOSE}`;
    const next = base ? `${base}

${block}` : block;
    textarea.value = next;
    try {
      textarea.selectionStart = textarea.selectionEnd = next.length;
    } catch (_) {
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    if (options.focus !== false) {
      textarea.focus();
    }
    return true;
  }

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
            reject(new Error((response == null ? void 0 : response.error) || ((response == null ? void 0 : response.status) ? `HTTP ${response.status}` : "Unknown background error")));
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

  // src/services/episode-client.js
  var DEFAULT_ENGINE_ID = "echo0_plugin";
  var EVENT_TYPE_META = {
    observation: { label: "\u89C2\u5BDF", shape: "circle", color: "#4facfe" },
    decision: { label: "\u51B3\u7B56", shape: "diamond", color: "#f6c945" },
    action: { label: "\u52A8\u4F5C", shape: "dot", color: "#5ee6a8" },
    state_change: { label: "\u72B6\u6001\u53D8\u5316", shape: "triangle", color: "#cc66ff" },
    milestone: { label: "\u91CC\u7A0B\u7891", shape: "star", color: "#ff7eb6" }
  };
  function parseTime(value) {
    if (!value) return null;
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  function isCausalLink(prevType, nextType) {
    const causes = prevType === "state_change" || prevType === "decision";
    const effects = nextType === "action" || nextType === "milestone" || nextType === "state_change";
    return causes && effects;
  }
  function normalizeEvent(raw, fallbackIdx) {
    return {
      id: String(raw.event_id || `evt_${fallbackIdx}`),
      type: String(raw.event_type || "observation"),
      description: String(raw.description || ""),
      time: parseTime(raw.timestamp),
      rawTime: String(raw.timestamp || ""),
      precedingId: String(raw.preceding_event_id || ""),
      sourceTurnId: String(raw.source_turn_id || ""),
      confidence: typeof raw.confidence === "number" ? raw.confidence : 1
    };
  }
  function normalizeEpisode(raw) {
    const events = (raw.key_events || []).map((e, i) => normalizeEvent(e, i)).sort((a, b) => {
      if (a.time == null && b.time == null) return 0;
      if (a.time == null) return 1;
      if (b.time == null) return -1;
      return a.time - b.time;
    });
    for (let i = 0; i < events.length - 1; i++) {
      events[i].causalTo = isCausalLink(events[i].type, events[i + 1].type);
    }
    return {
      id: String(raw.episode_id || ""),
      title: String(raw.title || raw.episode_id || "\u672A\u547D\u540D Episode"),
      summary: String(raw.summary || ""),
      rawStartTime: String(raw.start_time || ""),
      rawEndTime: String(raw.end_time || ""),
      rawLastActiveAt: String(raw.last_active_at || ""),
      startTime: parseTime(raw.start_time),
      endTime: parseTime(raw.end_time),
      lastActiveAt: parseTime(raw.last_active_at),
      arcStage: String(raw.arc_stage || "ongoing"),
      status: String(raw.status || "ongoing"),
      salience: typeof raw.salience_score === "number" ? raw.salience_score : 0,
      confidence: typeof raw.confidence === "number" ? raw.confidence : null,
      retentionTier: String(raw.retention_tier || ""),
      turnCount: typeof raw.turn_count === "number" ? raw.turn_count : 0,
      topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [],
      entities: Array.isArray(raw.entities) ? raw.entities.map(String) : [],
      participants: Array.isArray(raw.participants) ? raw.participants.map(String) : [],
      atomRefs: Array.isArray(raw.atom_refs) ? raw.atom_refs.map(String) : [],
      segments: (raw.segments || []).map((s) => ({
        sessionId: String(s.session_id || ""),
        startMsgIdx: Number(s.start_msg_idx || 0),
        endMsgIdx: Number(s.end_msg_idx || 0)
      })),
      followsRefs: Array.isArray(raw.follows_refs) ? raw.follows_refs.map(String) : [],
      branchesToRefs: Array.isArray(raw.branches_to_refs) ? raw.branches_to_refs.map(String) : [],
      events
    };
  }
  async function fetchEpisodeTimeline(options = {}) {
    const cfg = await getEchoMemConfig();
    const client = createClient(cfg);
    const engineId = options.engineId || DEFAULT_ENGINE_ID;
    const baseUri = `echo://engine/${engineId}/memory/.episodes`;
    const tree = await client.fsTree(baseUri, { maxDepth: 3 });
    const entries = (tree == null ? void 0 : tree.entries) || [];
    const bodyFiles = entries.filter(
      (e) => e.kind === "file" && e.uri.includes("/episodes/") && e.uri.endsWith(".json")
    );
    const results = await Promise.all(
      bodyFiles.map(async (entry) => {
        try {
          const text = await client.fsRead(entry.uri);
          return JSON.parse(text);
        } catch (err) {
          console.warn("EchoMem episode: failed to read body", entry.uri, err.message);
          return null;
        }
      })
    );
    const episodes = results.filter(Boolean).map(normalizeEpisode).filter((ep) => ep.id);
    const stamps = [];
    episodes.forEach((ep) => {
      if (ep.startTime != null) stamps.push(ep.startTime);
      if (ep.endTime != null) stamps.push(ep.endTime);
      ep.events.forEach((ev) => {
        if (ev.time != null) stamps.push(ev.time);
      });
    });
    const timeRange = stamps.length > 0 ? { min: Math.min(...stamps), max: Math.max(...stamps) } : { min: null, max: null };
    return { episodes, timeRange };
  }

  // src/panels/feedback/timeline/timeline-view.js
  var STATUS_LABEL = {
    ongoing: "\u8FDB\u884C\u4E2D",
    closed: "\u5DF2\u7ED3\u675F",
    merged: "\u5DF2\u5F52\u5E76",
    stale: "\u5DF2\u6C89\u5BC2"
  };
  var ARC_LABEL = {
    beginning: "\u8D77\u59CB",
    middle: "\u53D1\u5C55",
    end: "\u6536\u5C3E",
    ongoing: "\u957F\u671F"
  };
  var RETENTION_LABEL = {
    hot: "\u9AD8\u6D3B\u8DC3",
    warm: "\u8FD1\u671F\u6D3B\u8DC3",
    cold: "\u4F4E\u9891\u957F\u671F"
  };
  var GENERIC_TAGS = /* @__PURE__ */ new Set(["\u7528\u6237", "user", "agent", "assistant"]);
  var DAY_MS = 24 * 60 * 60 * 1e3;
  function renderTimeline(container, model, options = {}) {
    var _a;
    cleanupTimeline(container);
    container.innerHTML = "";
    container.style.position = "relative";
    const episodes = [...(model == null ? void 0 : model.episodes) || []].sort((a, b) => {
      const aTime = a.startTime ?? a.endTime ?? a.lastActiveAt ?? 0;
      const bTime = b.startTime ?? b.endTime ?? b.lastActiveAt ?? 0;
      return aTime - bTime || (a.endTime ?? 0) - (b.endTime ?? 0);
    });
    if (!episodes.length) {
      renderEmpty(container);
      return;
    }
    const root = node("div", "em-episode-view");
    const compact = (_a = window.matchMedia) == null ? void 0 : _a.call(window, "(max-width: 820px)").matches;
    const state2 = {
      episodes,
      activeId: episodes[0].id,
      detailOpen: !compact,
      selectedEventDate: "",
      options,
      handlers: {}
    };
    const shell = node("div", "em-episode-timeline-shell");
    const main = node("section", "em-timeline-main");
    const detail = node("aside", "em-episode-detail-panel");
    detail.setAttribute("aria-live", "polite");
    detail.setAttribute("aria-label", "Episode \u8BE6\u60C5");
    shell.append(main, detail);
    root.appendChild(shell);
    container.appendChild(root);
    const onClick = (event) => {
      var _a2, _b;
      const trigger = event.target.closest("[data-em-action]");
      if (!trigger || !root.contains(trigger)) return;
      const action = trigger.dataset.emAction;
      const episodeId = trigger.dataset.episodeId || state2.activeId;
      const episode = state2.episodes.find((item) => item.id === episodeId);
      if (action === "select-episode" && episode) {
        state2.activeId = episode.id;
        state2.selectedEventDate = "";
        state2.detailOpen = true;
        syncSelection();
        renderDetail(detail, episode, state2);
        return;
      }
      if (action === "select-event" && episode) {
        state2.activeId = episode.id;
        state2.selectedEventDate = trigger.dataset.eventDate || "";
        state2.detailOpen = true;
        syncSelection();
        renderDetail(detail, episode, state2);
        requestAnimationFrame(() => {
          var _a3;
          (_a3 = detail.querySelector(".em-detail-event.is-selected")) == null ? void 0 : _a3.scrollIntoView({
            block: "nearest",
            behavior: "smooth"
          });
        });
        return;
      }
      if (action === "close-detail") {
        state2.detailOpen = false;
        state2.selectedEventDate = "";
        syncSelection();
        return;
      }
      if (action === "use-episode" && episode) {
        (_b = (_a2 = state2.options).onUseMemory) == null ? void 0 : _b.call(_a2, buildEpisodeContext(episode), "\u8FD9\u6BB5\u8BB0\u5FC6\u5DF2\u5E26\u5165\u5F53\u524D\u5BF9\u8BDD");
        return;
      }
    };
    root.addEventListener("click", onClick);
    state2.handlers = { root, onClick };
    container._timelineState = state2;
    renderTimelineMain(main, episodes, state2);
    renderDetail(detail, episodes[0], state2);
    syncSelection();
    function syncSelection() {
      shell.classList.toggle("is-detail-closed", !state2.detailOpen);
      detail.classList.toggle("is-open", state2.detailOpen);
      detail.setAttribute("aria-hidden", String(!state2.detailOpen));
      root.querySelectorAll("[data-episode-row]").forEach((row) => {
        const selected = row.dataset.episodeRow === state2.activeId;
        row.classList.toggle("is-selected", selected);
      });
      root.querySelectorAll('[data-em-action="select-episode"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.episodeId === state2.activeId));
      });
    }
  }
  function renderTimelineMain(container, episodes, state2) {
    const range = collectionRange(episodes);
    const ticks = buildTicks(range.min, range.max, 6);
    const toolbar = node("header", "em-timeline-toolbar");
    const heading = document.createElement("div");
    const eyebrow = node("div", "em-kicker");
    eyebrow.textContent = "Episode timeline";
    const titleLine = node("div", "em-timeline-title-line");
    const title = document.createElement("h1");
    title.textContent = "\u6309 Episode \u67E5\u770B\u8BB0\u5FC6";
    titleLine.append(title, pill(`${episodes.length} \u6BB5\u6545\u4E8B`));
    const subtitle = document.createElement("p");
    subtitle.textContent = `${formatRangeFromEpisodes(episodes)} \xB7 \u6A2A\u6761\u8868\u793A\u6545\u4E8B\u8DE8\u5EA6\uFF0C\u8282\u70B9\u8868\u793A\u5173\u952E\u4E8B\u4EF6`;
    heading.append(eyebrow, titleLine, subtitle);
    const legend = node("div", "em-timeline-legend");
    legend.append(
      legendItem("em-legend-node", "\u5355\u4E2A\u4E8B\u4EF6"),
      legendItem("em-legend-cluster", "\u540C\u65E5\u4E8B\u4EF6\u7C07"),
      legendItem("em-legend-decision", "\u51B3\u7B56")
    );
    toolbar.append(heading, legend);
    const chart = node("div", "em-timeline-chart");
    const axis = node("div", "em-timeline-axis");
    axis.appendChild(node("span", "em-axis-spacer"));
    const axisTrack = node("div", "em-axis-track");
    ticks.forEach((tick) => {
      const item = textNode("span", formatAxisDate(tick), "em-axis-tick");
      item.style.left = `${toPercent(tick, range.min, range.max)}%`;
      axisTrack.appendChild(item);
    });
    axis.appendChild(axisTrack);
    axis.appendChild(textNode("span", "\u5173\u952E\u70B9", "em-axis-tail"));
    chart.appendChild(axis);
    episodes.forEach((episode) => {
      chart.appendChild(buildEpisodeRow(episode, range, ticks));
    });
    const footnote = node("footer", "em-timeline-footnote");
    footnote.append(
      textNode("span", "\u65F6\u95F4\u4EC5\u6765\u81EA\u4E8B\u4EF6\u53D1\u751F\u65F6\u95F4\uFF1B\u65E5\u671F\u578B\u6570\u636E\u4E0D\u8865\u9020\u5177\u4F53\u65F6\u523B\u3002"),
      textNode("span", "\u70B9\u51FB\u6545\u4E8B\u6216\u8282\u70B9\u67E5\u770B\u53F3\u4FA7\u8BE6\u60C5\u3002")
    );
    container.append(toolbar, chart, footnote);
  }
  function buildEpisodeRow(episode, range, ticks) {
    const row = node("article", "em-timeline-row");
    row.dataset.episodeRow = episode.id;
    const label = document.createElement("button");
    label.type = "button";
    label.className = "em-timeline-row-label";
    label.dataset.emAction = "select-episode";
    label.dataset.episodeId = episode.id;
    label.setAttribute("aria-pressed", "false");
    const labelTop = node("span", "em-row-title");
    labelTop.textContent = episode.title;
    const labelMeta = node("span", "em-row-meta");
    labelMeta.textContent = `${STATUS_LABEL[episode.status] || episode.status} \xB7 ${(episode.atomRefs || []).length} \u6761\u8BC1\u636E`;
    label.append(labelTop, labelMeta);
    const track = node("div", "em-timeline-track");
    ticks.forEach((tick) => {
      const line = node("span", "em-timeline-gridline");
      line.style.left = `${toPercent(tick, range.min, range.max)}%`;
      track.appendChild(line);
    });
    const start = episode.startTime ?? episode.endTime ?? range.min;
    const end = episode.endTime ?? episode.startTime ?? start;
    const left = toPercent(start, range.min, range.max);
    const right = toPercent(end, range.min, range.max);
    const width = Math.max(2.2, right - left);
    const span = document.createElement("button");
    span.type = "button";
    span.className = `em-episode-span is-${episode.arcStage || "ongoing"}`;
    span.dataset.emAction = "select-episode";
    span.dataset.episodeId = episode.id;
    span.setAttribute("aria-label", `\u67E5\u770B Episode\uFF1A${episode.title}`);
    span.style.left = `${Math.min(left, 100 - width)}%`;
    span.style.width = `${Math.min(width, 100)}%`;
    track.appendChild(span);
    const clusters = groupEventsByDate(episode.events);
    clusters.forEach((cluster) => {
      const eventTime = cluster.time ?? start;
      const mark = document.createElement("button");
      mark.type = "button";
      mark.className = `em-timeline-event-mark ${cluster.events.length > 1 ? "is-cluster" : ""}`;
      if (cluster.events.some((item) => item.type === "decision")) mark.classList.add("has-decision");
      mark.dataset.emAction = "select-event";
      mark.dataset.episodeId = episode.id;
      mark.dataset.eventDate = cluster.rawTime;
      mark.style.left = `${toPercent(eventTime, range.min, range.max)}%`;
      mark.textContent = cluster.events.length > 1 ? String(cluster.events.length) : "";
      mark.setAttribute(
        "aria-label",
        `${formatEventDate(cluster)}\uFF0C${cluster.events.length} \u4E2A\u5173\u952E\u4E8B\u4EF6\uFF1A${cluster.events.map((item) => item.description).join("\uFF1B")}`
      );
      track.appendChild(mark);
    });
    const tail = node("div", "em-timeline-row-tail");
    tail.append(
      textNode("strong", String(episode.events.length)),
      textNode("span", "\u4E8B\u4EF6")
    );
    row.append(label, track, tail);
    return row;
  }
  function renderDetail(container, episode, state2) {
    container.innerHTML = "";
    const top = node("div", "em-detail-panel-top");
    const overline = node("div", "em-detail-overline");
    overline.append(
      pill(STATUS_LABEL[episode.status] || episode.status, "em-status-pill"),
      textNode("span", formatEpisodeDateRange(episode))
    );
    const close = iconButton("\xD7", "close-detail", "\u6536\u8D77\u8BE6\u60C5");
    top.append(overline, close);
    const title = document.createElement("h2");
    title.textContent = episode.title;
    const stage = node("div", "em-detail-stage-line");
    stage.append(
      detailDatum("\u751F\u547D\u5468\u671F", STATUS_LABEL[episode.status] || episode.status),
      detailDatum("\u53D9\u4E8B\u9636\u6BB5", ARC_LABEL[episode.arcStage] || episode.arcStage || "\u672A\u8BB0\u5F55")
    );
    const summarySection = node("section", "em-detail-section");
    summarySection.append(
      sectionTitle("\u6545\u4E8B\u6458\u8981"),
      textNode("p", episode.summary || "\u8FD9\u6BB5\u8BB0\u5FC6\u5C1A\u672A\u751F\u6210\u6458\u8981\u3002", "em-detail-summary")
    );
    const stats = node("dl", "em-detail-stats");
    stats.append(
      stat("\u539F\u5B50\u8BC1\u636E", `${(episode.atomRefs || []).length} \u6761`),
      stat("\u5173\u952E\u4E8B\u4EF6", `${episode.events.length} \u4E2A`),
      stat("\u663E\u8457\u5EA6", formatScore(episode.salience)),
      stat("\u751F\u6210\u7F6E\u4FE1", formatOptionalScore(episode.confidence))
    );
    const tags = visibleTags(episode);
    const tagSection = node("section", "em-detail-section");
    tagSection.appendChild(sectionTitle("\u5173\u8054\u5BF9\u8C61\u4E0E\u4E3B\u9898"));
    const tagList = node("div", "em-card-tags");
    if (tags.length) tags.forEach((item) => tagList.appendChild(pill(item)));
    else tagList.appendChild(textNode("span", "\u6682\u65E0\u6709\u6548\u6807\u7B7E", "em-source-note"));
    tagSection.appendChild(tagList);
    const eventSection = node("section", "em-detail-section em-detail-events-section");
    eventSection.appendChild(sectionTitle("\u5173\u952E\u4E8B\u4EF6\u94FE"));
    const chain = node("ol", "em-detail-event-chain");
    if (episode.events.length) {
      episode.events.forEach((event) => chain.appendChild(buildDetailEvent(event, state2.selectedEventDate)));
    } else {
      chain.appendChild(textNode("li", "\u8BE5\u60C5\u8282\u6682\u672A\u63D0\u53D6\u51FA\u5173\u952E\u4E8B\u4EF6\u3002", "em-source-note"));
    }
    eventSection.appendChild(chain);
    const memoryMeta = node("div", "em-detail-memory-meta");
    memoryMeta.append(
      textNode("span", RETENTION_LABEL[episode.retentionTier] || "\u957F\u671F\u8BB0\u5FC6"),
      textNode("span", `${episode.turnCount} \u8F6E\u76F8\u5173\u5BF9\u8BDD`)
    );
    const actions = node("div", "em-detail-actions");
    actions.append(
      actionButton("\u5E26\u5165\u5F53\u524D\u5BF9\u8BDD", "use-episode", "is-primary", episode.id)
    );
    container.append(top, title, stage, summarySection, stats, tagSection, eventSection, memoryMeta, actions);
  }
  function buildDetailEvent(event, selectedDate) {
    const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
    const item = node("li", "em-detail-event");
    item.dataset.eventDate = event.rawTime || "";
    item.classList.toggle("is-selected", Boolean(selectedDate && event.rawTime === selectedDate));
    item.style.setProperty("--event-color", meta.color);
    const marker = node("span", `em-detail-event-node is-${event.type}`);
    const body = document.createElement("div");
    const eventMeta = node("div", "em-detail-event-meta");
    eventMeta.append(
      textNode("span", meta.label, "em-detail-event-type"),
      textNode("time", formatEventDate(event))
    );
    const copy = textNode("p", event.description, "em-detail-event-copy");
    body.append(eventMeta, copy);
    item.append(marker, body);
    return item;
  }
  function groupEventsByDate(events) {
    const groups = /* @__PURE__ */ new Map();
    events.forEach((event, index) => {
      const key = event.rawTime || (event.time != null ? String(event.time) : `unknown-${index}`);
      if (!groups.has(key)) {
        groups.set(key, {
          rawTime: event.rawTime || "",
          time: event.time,
          events: []
        });
      }
      groups.get(key).events.push(event);
    });
    return [...groups.values()];
  }
  function collectionRange(episodes) {
    const values = episodes.flatMap((episode) => [
      episode.startTime,
      episode.endTime,
      ...episode.events.map((event) => event.time)
    ]).filter((value) => value != null);
    if (!values.length) {
      const now = Date.now();
      return { min: now, max: now + DAY_MS };
    }
    const min = Math.min(...values);
    const rawMax = Math.max(...values);
    return { min, max: rawMax === min ? min + DAY_MS : rawMax };
  }
  function buildTicks(min, max, count) {
    const safeCount = Math.max(2, count);
    const step = (max - min) / (safeCount - 1);
    return Array.from({ length: safeCount }, (_, index) => min + step * index);
  }
  function toPercent(value, min, max) {
    if (value == null || max <= min) return 0;
    return Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  }
  function formatAxisDate(value) {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value)).replace("/", ".");
  }
  function formatRangeFromEpisodes(episodes) {
    const first = episodes[0];
    const last = episodes.reduce((latest, episode) => {
      const latestTime = latest.endTime ?? latest.startTime ?? 0;
      const episodeTime = episode.endTime ?? episode.startTime ?? 0;
      return episodeTime > latestTime ? episode : latest;
    }, first);
    const start = first.rawStartTime || first.rawEndTime;
    const end = last.rawEndTime || last.rawStartTime;
    return formatRawDateRange(start, end);
  }
  function formatEpisodeDateRange(episode) {
    return formatRawDateRange(
      episode.rawStartTime || episode.rawEndTime,
      episode.rawEndTime || episode.rawStartTime
    );
  }
  function formatRawDateRange(start, end) {
    if (!start && !end) return "\u65F6\u95F4\u672A\u8BB0\u5F55";
    if (!start) return formatRawDate(end);
    if (!end || start === end) return formatRawDate(start);
    return `${formatRawDate(start)} \u2014 ${formatRawDate(end)}`;
  }
  function formatRawDate(value) {
    const raw = String(value || "");
    const dayMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) return `${dayMatch[1]}\u5E74${Number(dayMatch[2])}\u6708${Number(dayMatch[3])}\u65E5`;
    const monthMatch = raw.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) return `${monthMatch[1]}\u5E74${Number(monthMatch[2])}\u6708`;
    if (/^\d{4}$/.test(raw)) return `${raw}\u5E74`;
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return raw || "\u65F6\u95F4\u672A\u8BB0\u5F55";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(parsed));
  }
  function formatEventDate(eventOrCluster) {
    const raw = eventOrCluster.rawTime || "";
    if (raw) return formatRawDate(raw);
    if (eventOrCluster.time != null) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(new Date(eventOrCluster.time));
    }
    return "\u65F6\u95F4\u672A\u8BB0\u5F55";
  }
  function buildEpisodeContext(episode) {
    const lines = [
      `\u60C5\u8282\u8BB0\u5FC6\uFF1A${episode.title}`,
      `\u65F6\u95F4\uFF1A${formatEpisodeDateRange(episode)}`,
      `\u6458\u8981\uFF1A${episode.summary || "\u6682\u65E0\u6458\u8981"}`
    ];
    if (episode.events.length) {
      lines.push("\u5173\u952E\u4E8B\u4EF6\uFF1A");
      episode.events.forEach((event) => {
        const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
        lines.push(`- [${meta.label} \xB7 ${formatEventDate(event)}] ${event.description}`);
      });
    }
    const tags = visibleTags(episode);
    if (tags.length) lines.push(`\u76F8\u5173\u4EBA\u7269\u4E0E\u4E3B\u9898\uFF1A${tags.join("\u3001")}`);
    return lines.join("\n");
  }
  function visibleTags(episode) {
    return unique([...episode.entities || [], ...episode.topics || []]).filter((item) => item && !GENERIC_TAGS.has(item.toLocaleLowerCase()));
  }
  function unique(items) {
    return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  }
  function sectionTitle(text) {
    return textNode("h3", text, "em-detail-section-title");
  }
  function detailDatum(label, value) {
    const item = node("span", "em-detail-datum");
    item.append(
      textNode("span", label),
      textNode("strong", value)
    );
    return item;
  }
  function stat(label, value) {
    const item = node("div", "em-detail-stat");
    item.append(
      textNode("dt", label),
      textNode("dd", value, "em-detail-stat-value")
    );
    return item;
  }
  function formatScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score.toFixed(2) : "\u672A\u8BB0\u5F55";
  }
  function formatOptionalScore(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return "\u672A\u8BB0\u5F55";
    return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
  }
  function legendItem(className, label) {
    const item = node("span", "em-legend-item");
    item.append(node("i", className), textNode("span", label));
    return item;
  }
  function actionButton(label, action, variant = "", episodeId = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `em-action-btn ${variant}`.trim();
    button.dataset.emAction = action;
    if (episodeId) button.dataset.episodeId = episodeId;
    button.textContent = label;
    return button;
  }
  function iconButton(label, action, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "em-detail-close";
    button.dataset.emAction = action;
    button.setAttribute("aria-label", ariaLabel);
    button.textContent = label;
    return button;
  }
  function pill(text, extraClass = "") {
    const item = node("span", `em-pill ${extraClass}`.trim());
    item.appendChild(textNode("span", text));
    return item;
  }
  function textNode(tag, text, className = "") {
    const element = node(tag, className);
    element.textContent = text;
    return element;
  }
  function renderEmpty(container) {
    const empty = node("div", "em-empty");
    empty.innerHTML = `
    <div class="em-state-orb"></div>
    <p class="em-state-title">\u957F\u671F\u8BB0\u5FC6\u8FD8\u6CA1\u6709\u5F62\u6210\u60C5\u8282</p>
    <p class="em-state-copy">\u76F8\u5173\u4E8B\u4EF6\u79EF\u7D2F\u540E\uFF0CEchoMem \u4F1A\u628A\u5B83\u4EEC\u7EC4\u7EC7\u4E3A\u53EF\u9605\u8BFB\u7684 Episode \u6545\u4E8B\u7EBF\u3002</p>
  `;
    container.appendChild(empty);
  }
  function node(tag, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  }
  function cleanupTimeline(container) {
    var _a;
    const state2 = container == null ? void 0 : container._timelineState;
    if ((_a = state2 == null ? void 0 : state2.handlers) == null ? void 0 : _a.root) {
      state2.handlers.root.removeEventListener("click", state2.handlers.onClick);
    }
    if (container) container._timelineState = null;
  }

  // src/panels/feedback/timeline/timeline-theme.js
  var STYLE_ID = "echomem-episode-theme";
  function injectTimelineTheme(container) {
    if (!container || container.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .echomem-feedback-shell,
    .echomem-feedback-shell * { box-sizing: border-box; }
    .echomem-feedback-shell {
      --em-bg: #05070a; --em-panel: rgba(2,8,20,.92); --em-panel-strong: #07101c;
      --em-line: rgba(0,230,255,.12); --em-line-strong: rgba(0,230,255,.42);
      --em-text: #e7fbff; --em-text-2: #b5d5df; --em-text-3: #7593a1;
      --em-cyan: #00e6ff; --em-blue: #4f8cff; --em-green: #4cd6a1;
      --em-amber: #f2b84b; --em-pink: #e16fa4; --em-purple: #a269ff;
      color: var(--em-text); background: var(--em-bg);
      font-family: Roboto, "Noto Sans SC", sans-serif; color-scheme: dark;
    }
    .em-topbar {
      --em-line: rgba(121,116,126,.24); --em-text: #1d1b20;
      --em-text-2: #49454f; --em-text-3: #79747e; --em-cyan: #6750a4;
      min-height: 64px; display: flex; align-items: center; gap: 24px; padding: 10px 18px;
      border-bottom: 1px solid var(--em-line); color: var(--em-text);
      background: rgba(255,255,255,.96); backdrop-filter: blur(12px); flex: 0 0 auto;
      color-scheme: light;
    }
    .echomem-feedback-shell button,
    .echomem-feedback-shell input { font: inherit; }
    .echomem-feedback-shell button:focus-visible,
    .echomem-feedback-shell input:focus-visible { outline: 2px solid #6750a4; outline-offset: 2px; }
    .em-brand { min-width: 206px; }
    .em-brand-eyebrow { font-size: 10px; font-weight: 500; letter-spacing: .12em; color: #6750a4; text-transform: uppercase; }
    .em-brand-title { margin-top: 4px; font-size: 14px; font-weight: 500; color: #21005d; }
    .em-tabs { display: flex; align-items: center; gap: 5px; margin-left: auto; }
    .em-tab {
      display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 7px 13px;
      color: #79747e; background: transparent; border: 1px solid transparent;
      border-radius: 12px; cursor: pointer; transition: color .2s ease, background .2s ease, border-color .2s ease;
    }
    .em-tab:hover { color: #21005d; background: rgba(103,80,164,.08); }
    .em-tab[aria-selected="true"] { color: #21005d; background: #eaddff; border-color: rgba(103,80,164,.18); }
    .em-tab-mark { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .75; }
    .em-tab[aria-selected="true"] .em-tab-mark { background: #6750a4; box-shadow: 0 0 12px rgba(103,80,164,.42); }
    .em-view-stage { flex: 1 1 auto; min-height: 0; position: relative; }
    .em-view-stage[data-em-view="relation"] {
      color: var(--em-text); background: #05070a; color-scheme: dark; isolation: isolate;
    }
    .em-empty, .em-error, .em-loading {
      height: 100%; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 10px; padding: 28px; text-align: center;
    }
    .em-state-orb { width: 44px; height: 44px; border: 2px solid rgba(103,80,164,.18); border-radius: 50%; background: #fef7ff; }
    .em-loading .em-state-orb { border-top-color: var(--em-cyan); animation: em-spin .9s linear infinite; }
    .em-state-title { margin: 2px 0 0; font-size: 14px; color: var(--em-text); }
    .em-state-copy { margin: 0; max-width: 390px; color: var(--em-text-3); font-size: 12px; line-height: 1.65; }
    .em-primary-btn { margin-top: 5px; min-height: 38px; padding: 8px 20px; border: 0; border-radius: 20px; background: linear-gradient(135deg,#6750a4,#21005d); color: #fff; cursor: pointer; }
    @keyframes em-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .em-loading .em-state-orb { animation: none !important; } }
    @media (max-width: 820px) {
      .em-topbar { align-items: flex-start; flex-direction: column; gap: 8px; }
      .em-brand { min-width: 0; }
      .em-tabs { width: 100%; margin-left: 0; overflow-x: auto; }
      .em-tab { white-space: nowrap; }
    }
  `;
    container.appendChild(style);
  }

  // src/services/toast.js
  function showFloatingToast(message, type = "success", duration = 2500) {
    let toast = document.getElementById("echomem-floating-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "echomem-floating-toast";
      toast.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 40px;
      transform: translateX(-50%) translateY(20px);
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      font-family: Roboto, 'Noto Sans SC', sans-serif;
      color: #fff;
      background: rgba(5, 7, 10, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;
      document.body.appendChild(toast);
    }
    const ACCENTS = {
      success: "#00e6ff",
      error: "#ff6b6b",
      info: "#667eea"
    };
    const ICONS = {
      success: "\u2705",
      error: "\u274C",
      info: "\u23F3"
    };
    const accent = ACCENTS[type] || ACCENTS.info;
    toast.style.borderColor = accent;
    toast.innerHTML = `<span style="color:${accent}; margin-right:6px;">${ICONS[type] || ICONS.info}</span>${message}`;
    clearTimeout(toast._hideTimer);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });
    if (duration > 0) {
      toast._hideTimer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(() => toast.remove(), 200);
      }, duration);
    }
  }

  // src/entry/feedback-episode.js
  function isViewActive(container, viewApi) {
    return container.isConnected && (typeof viewApi.isActive !== "function" || viewApi.isActive());
  }
  function setLoadingState(container) {
    container.innerHTML = `
    <div class="em-loading" role="status" aria-live="polite">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">\u6B63\u5728\u52A0\u8F7D\u60C5\u8282\u8BB0\u5FC6\u2026</p>
      <p class="em-state-copy">EchoMem \u6B63\u5728\u6574\u7406\u76F8\u5173\u8BB0\u5FC6\uFF0C\u8BF7\u7A0D\u5019\u3002</p>
    </div>
  `;
  }
  function setErrorState(container, err, onRetry) {
    var _a;
    container.innerHTML = `
    <div class="em-error" role="alert">
      <div class="em-state-orb" aria-hidden="true"></div>
      <p class="em-state-title">\u52A0\u8F7D\u5931\u8D25</p>
      <p class="em-state-copy"></p>
      <button class="em-primary-btn" type="button">\u91CD\u8BD5</button>
    </div>
  `;
    container.querySelector(".em-state-copy").textContent = (err == null ? void 0 : err.message) || "\u672A\u77E5\u9519\u8BEF";
    (_a = container.querySelector(".em-primary-btn")) == null ? void 0 : _a.addEventListener("click", onRetry);
  }
  function closeFeedbackOverlay() {
    var _a;
    const overlay = Array.from(document.querySelectorAll(".claw-feedback-overlay")).find((element) => element.isConnected && element.style.display !== "none");
    (_a = overlay == null ? void 0 : overlay.querySelector(".claw-close-panel")) == null ? void 0 : _a.click();
  }
  function useMemory(content, message) {
    const success = injectContent(content, { replace: true, focus: true });
    if (!success) {
      showFloatingToast("\u672A\u627E\u5230\u804A\u5929\u8F93\u5165\u6846\uFF0C\u65E0\u6CD5\u5E26\u5165\u8BB0\u5FC6", "error");
      return;
    }
    showFloatingToast(message || "\u8BB0\u5FC6\u5DF2\u5E26\u5165\u5F53\u524D\u5BF9\u8BDD", "success");
    setTimeout(closeFeedbackOverlay, 260);
  }
  async function mountEpisodeView(container, viewApi = {}) {
    try {
      setLoadingState(container);
      let model = container._episodeModel;
      if (!model) {
        model = await fetchEpisodeTimeline();
        container._episodeModel = model;
      }
      if (!isViewActive(container, viewApi)) return;
      renderTimeline(container, model, {
        onUseMemory: (content, message) => useMemory(content, message)
      });
      injectTimelineTheme(container);
    } catch (err) {
      console.error("EchoMem: \u52A0\u8F7D Episode \u5931\u8D25", err);
      if (!isViewActive(container, viewApi)) return;
      setErrorState(container, err, () => {
        if (!isViewActive(container, viewApi)) return;
        container._episodeModel = null;
        mountEpisodeView(container, viewApi);
      });
    }
  }
  var episodeFeedbackView = {
    key: "timeline",
    label: "\u60C5\u8282\u8BB0\u5FC6",
    mount: mountEpisodeView,
    cleanup: (container) => {
      cleanupTimeline(container);
      container._episodeModel = null;
    }
  };
  globalThis.__ECHOMEM_FEEDBACK_VIEWS__ ||= /* @__PURE__ */ new Map();
  globalThis.__ECHOMEM_FEEDBACK_VIEWS__.set(episodeFeedbackView.key, episodeFeedbackView);
})();
