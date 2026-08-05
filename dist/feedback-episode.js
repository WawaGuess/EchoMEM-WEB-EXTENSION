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
    async addSkillPackage(options = {}) {
      if (!options.packageBase64) throw new Error("packageBase64 is required");
      const body = {
        package_base64: options.packageBase64,
        filename: options.filename,
        name: options.name,
        description: options.description,
        tags: options.tags,
        allowed_tools: options.allowedTools,
        metadata: options.metadata
      };
      Object.keys(body).forEach((key) => {
        if (body[key] === void 0) delete body[key];
      });
      if (this.cfg.debug) {
        log("addSkillPackage request", options.filename, JSON.stringify({ ...body, package_base64: void 0 }));
      }
      const result = await this._fetchJson(`${this.cfg.baseUrl}/api/skills/package`, {
        method: "POST",
        headers: this._buildHeaders(true),
        body: JSON.stringify(body)
      });
      if (this.cfg.debug) {
        log("addSkillPackage response", `name=${result == null ? void 0 : result.name}`, `uri=${result == null ? void 0 : result.uri}`);
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
  function renderTimeline(container, model) {
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
    const state = {
      episodes,
      activeId: "",
      detailOpen: false,
      detailPage: "overview",
      detailDirection: "forward",
      detailScroll: { overview: 0, story: 0, evidence: 0 },
      selectedEventDate: "",
      selectedEventId: "",
      expandedEventDates: /* @__PURE__ */ new Set(),
      handlers: {}
    };
    const shell = node("div", "em-episode-timeline-shell");
    const main = node("section", "em-timeline-main");
    const detail = node("aside", "em-episode-detail-panel");
    detail.setAttribute("aria-live", "polite");
    detail.setAttribute("aria-label", "\u60C5\u8282\u8BE6\u60C5");
    shell.append(main, detail);
    root.appendChild(shell);
    container.appendChild(root);
    const onClick = (event) => {
      const trigger = event.target.closest("[data-em-action]");
      if (!trigger || !root.contains(trigger)) return;
      const action = trigger.dataset.emAction;
      const episodeId = trigger.dataset.episodeId || state.activeId;
      const episode = state.episodes.find((item) => item.id === episodeId);
      if (action === "select-episode" && episode) {
        state.activeId = episode.id;
        state.selectedEventDate = "";
        state.selectedEventId = "";
        state.expandedEventDates = /* @__PURE__ */ new Set();
        state.detailPage = "overview";
        state.detailDirection = "forward";
        state.detailScroll = { overview: 0, story: 0, evidence: 0 };
        state.detailOpen = true;
        syncSelection();
        renderDetail(detail, episode, state);
        return;
      }
      if (action === "select-event" && episode) {
        const expandedDates = state.activeId === episode.id ? new Set(state.expandedEventDates) : /* @__PURE__ */ new Set();
        state.activeId = episode.id;
        state.selectedEventDate = trigger.dataset.eventDate || "";
        state.selectedEventId = "";
        if (state.selectedEventDate) expandedDates.add(state.selectedEventDate);
        state.expandedEventDates = expandedDates;
        state.detailPage = "story";
        state.detailDirection = "forward";
        state.detailScroll = { overview: 0, story: 0, evidence: 0 };
        state.detailOpen = true;
        syncSelection();
        renderDetail(detail, episode, state);
        requestAnimationFrame(() => {
          var _a;
          (_a = detail.querySelector(".em-detail-date-group.is-selected")) == null ? void 0 : _a.scrollIntoView({
            block: "nearest",
            behavior: "smooth"
          });
        });
        return;
      }
      if (action === "open-story" && episode) {
        rememberDetailScroll(detail, state);
        state.detailPage = "story";
        state.detailDirection = "forward";
        state.selectedEventId = "";
        if (!state.expandedEventDates.size) {
          groupEventsByDate(episode.events).forEach((group) => {
            state.expandedEventDates.add(group.dateKey);
          });
        }
        renderDetail(detail, episode, state);
        focusDetailPage(detail);
        return;
      }
      if (action === "open-evidence" && episode) {
        rememberDetailScroll(detail, state);
        state.detailPage = "evidence";
        state.detailDirection = "forward";
        state.selectedEventId = "";
        renderDetail(detail, episode, state);
        focusDetailPage(detail);
        return;
      }
      if (action === "toggle-event-date" && episode) {
        const dateKey = trigger.dataset.eventDate || "";
        const expandedDates = new Set(state.expandedEventDates);
        if (expandedDates.has(dateKey)) expandedDates.delete(dateKey);
        else if (dateKey) expandedDates.add(dateKey);
        state.expandedEventDates = expandedDates;
        state.detailDirection = "stay";
        renderDetail(detail, episode, state);
        requestAnimationFrame(() => {
          var _a;
          (_a = [...detail.querySelectorAll("[data-event-group]")].find((item) => item.dataset.eventGroup === dateKey)) == null ? void 0 : _a.focus();
        });
        return;
      }
      if (action === "open-event" && episode) {
        rememberDetailScroll(detail, state);
        state.selectedEventId = trigger.dataset.eventId || "";
        state.selectedEventDate = trigger.dataset.eventDate || "";
        state.detailPage = "event";
        state.detailDirection = "forward";
        renderDetail(detail, episode, state);
        focusDetailPage(detail);
        return;
      }
      if (action === "back-detail" && episode) {
        const previousPage = state.detailPage === "event" ? "story" : "overview";
        state.detailPage = previousPage;
        state.detailDirection = "back";
        state.selectedEventId = "";
        renderDetail(detail, episode, state);
        restoreDetailScroll(detail, state, previousPage);
        focusDetailPage(detail);
        return;
      }
      if (action === "close-detail") {
        state.detailOpen = false;
        state.activeId = "";
        state.selectedEventDate = "";
        state.selectedEventId = "";
        state.expandedEventDates = /* @__PURE__ */ new Set();
        syncSelection();
        return;
      }
    };
    root.addEventListener("click", onClick);
    state.handlers = { root, onClick };
    container._timelineState = state;
    renderTimelineMain(main, episodes, state);
    syncSelection();
    function syncSelection() {
      shell.classList.toggle("is-detail-closed", !state.detailOpen);
      detail.classList.toggle("is-open", state.detailOpen);
      detail.setAttribute("aria-hidden", String(!state.detailOpen));
      root.querySelectorAll("[data-episode-row]").forEach((row) => {
        const selected = row.dataset.episodeRow === state.activeId;
        row.classList.toggle("is-selected", selected);
      });
      root.querySelectorAll('[data-em-action="select-episode"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.episodeId === state.activeId));
      });
    }
  }
  function renderTimelineMain(container, episodes, state) {
    const range = collectionRange(episodes);
    const boundaryDates = episodes.flatMap((episode) => [episode.startTime, episode.endTime]);
    const ticks = buildTicks(range.min, range.max, 8, boundaryDates);
    const toolbar = node("header", "em-timeline-toolbar");
    const heading = document.createElement("div");
    const eyebrow = node("div", "em-kicker");
    eyebrow.textContent = "\u60C5\u8282\u65F6\u95F4\u7EBF";
    const titleLine = node("div", "em-timeline-title-line");
    const title = document.createElement("h1");
    title.textContent = "\u6309\u60C5\u8282\u67E5\u770B\u8BB0\u5FC6";
    titleLine.append(title, pill(`${episodes.length} \u6BB5\u6545\u4E8B`));
    const subtitle = document.createElement("p");
    subtitle.textContent = `${formatRangeFromEpisodes(episodes)} \xB7 \u6A2A\u6761\u8868\u793A\u6545\u4E8B\u8DE8\u5EA6\uFF0C\u77ED\u80F6\u56CA\u8868\u793A\u5355\u65E5\u60C5\u8282\uFF0C\u8282\u70B9\u8868\u793A\u5173\u952E\u4E8B\u4EF6`;
    heading.append(eyebrow, titleLine, subtitle);
    const legend = node("div", "em-timeline-legend");
    legend.append(
      legendItem("em-legend-single-day", "\u5355\u65E5\u60C5\u8282"),
      legendItem("em-legend-node", "\u5355\u4E2A\u4E8B\u4EF6"),
      legendItem("em-legend-cluster", "\u540C\u65E5\u4E8B\u4EF6\u7C07", "2"),
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
      textNode("span", "\u65F6\u95F4\u8F74\u6309\u81EA\u7136\u65E5\u5BF9\u9F50\uFF1B\u540C\u65E5\u591A\u4E2A\u4E8B\u4EF6\u663E\u793A\u4E3A\u7D2B\u8272\u6570\u5B57\u8282\u70B9\uFF0C\u542B\u51B3\u7B56\u65F6\u5916\u5708\u53D8\u9EC4\u3002"),
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
    const rawStart = episode.startTime ?? episode.lastActiveAt ?? episode.endTime ?? range.min;
    const rawEnd = episode.endTime ?? episode.lastActiveAt ?? episode.startTime ?? rawStart;
    const start = toTimelineDay(rawStart) ?? range.min;
    const end = toTimelineDay(rawEnd) ?? start;
    const spanStart = Math.min(start, end);
    const spanEnd = Math.max(start, end);
    const left = toPercent(spanStart, range.min, range.max);
    const right = toPercent(spanEnd, range.min, range.max);
    const isPoint = spanStart === spanEnd;
    const span = document.createElement("button");
    span.type = "button";
    span.className = `em-episode-span is-${episode.arcStage || "ongoing"}`;
    span.classList.toggle("is-point", isPoint);
    span.dataset.emAction = "select-episode";
    span.dataset.episodeId = episode.id;
    span.setAttribute("aria-label", `\u67E5\u770B\u60C5\u8282\uFF1A${episode.title}`);
    span.style.left = `${left}%`;
    if (isPoint) {
      span.style.setProperty("--em-span-shift", "-50%");
    } else {
      span.style.width = `${Math.max(0, right - left)}%`;
    }
    track.appendChild(span);
    const clusters = groupEventsByDate(episode.events);
    clusters.forEach((cluster) => {
      const eventTime = cluster.time ?? start;
      const isCluster = cluster.events.length > 1;
      const hasDecision = cluster.events.some((item) => item.type === "decision");
      const mark = document.createElement("button");
      mark.type = "button";
      mark.className = `em-timeline-event-mark ${isCluster ? "is-cluster" : ""}`;
      if (!isCluster && hasDecision) mark.classList.add("is-decision");
      if (isCluster && hasDecision) mark.classList.add("contains-decision");
      mark.dataset.emAction = "select-event";
      mark.dataset.episodeId = episode.id;
      mark.dataset.eventDate = cluster.dateKey;
      mark.style.left = `${toPercent(eventTime, range.min, range.max)}%`;
      if (isCluster) {
        mark.appendChild(textNode("span", String(cluster.events.length), "em-timeline-event-count"));
      }
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
  function renderDetail(container, episode, state) {
    const page = node("div", `em-detail-page is-${state.detailDirection || "forward"}`);
    page.dataset.detailPage = state.detailPage;
    if (state.detailPage === "story") renderStoryPage(page, episode, state);
    else if (state.detailPage === "evidence") renderEvidencePage(page, episode);
    else if (state.detailPage === "event") renderEventPage(page, episode, state);
    else renderOverviewPage(page, episode);
    container.dataset.detailPage = state.detailPage;
    container.replaceChildren(page);
  }
  function renderOverviewPage(page, episode) {
    page.appendChild(buildDetailHeader(episode));
    page.appendChild(detailHeading(episode.title));
    const summarySection = node("section", "em-detail-section em-detail-summary-card");
    summarySection.append(
      sectionTitle("\u8FD9\u6BB5\u7ECF\u5386"),
      textNode("p", episode.summary || "\u8FD9\u6BB5\u8BB0\u5FC6\u5C1A\u672A\u751F\u6210\u6458\u8981\u3002", "em-detail-summary")
    );
    page.appendChild(summarySection);
    const tags = visibleTags(episode);
    if (tags.length) {
      const tagSection = node("section", "em-detail-section em-detail-tags-section");
      tagSection.appendChild(sectionTitle("\u76F8\u5173\u4EBA\u7269\u4E0E\u4E3B\u9898"));
      const tagList = node("div", "em-card-tags");
      tags.forEach((item) => tagList.appendChild(pill(item)));
      tagSection.appendChild(tagList);
      page.appendChild(tagSection);
    }
    const routes = node("div", "em-detail-routes");
    routes.append(
      detailRouteButton(
        "open-story",
        "\u4E8B\u60C5\u5982\u4F55\u53D1\u5C55",
        `${episode.events.length} \u4E2A\u5173\u952E\u4E8B\u4EF6`,
        "\u6309\u65E5\u671F\u67E5\u770B\u8FD9\u6BB5\u7ECF\u5386\u7684\u63A8\u8FDB\u8FC7\u7A0B"
      ),
      detailRouteButton(
        "open-evidence",
        "\u8BB0\u5FC6\u4F9D\u636E\u4E0E\u7CFB\u7EDF\u5224\u65AD",
        `${(episode.atomRefs || []).length} \u6761\u539F\u5B50\u8BC1\u636E`,
        "\u4E86\u89E3\u8FD9\u6BB5\u60C5\u8282\u7531\u54EA\u4E9B\u8BB0\u5FC6\u4FE1\u606F\u652F\u6491"
      )
    );
    page.appendChild(routes);
  }
  function renderStoryPage(page, episode, state) {
    page.appendChild(buildDetailHeader(episode, "\u8FD4\u56DE\u6982\u89C8"));
    page.append(
      textNode("div", formatEpisodeDateRange(episode), "em-detail-page-kicker"),
      detailHeading("\u4E8B\u60C5\u5982\u4F55\u53D1\u5C55"),
      textNode("p", episode.title, "em-detail-context-title")
    );
    const groups = groupEventsByDate(episode.events);
    const groupList = node("div", "em-detail-date-groups");
    if (!groups.length) {
      groupList.appendChild(textNode("p", "\u8BE5\u60C5\u8282\u6682\u672A\u63D0\u53D6\u51FA\u5173\u952E\u4E8B\u4EF6\u3002", "em-source-note"));
    } else {
      groups.forEach((group) => {
        groupList.appendChild(buildEventDateGroup(group, episode, state));
      });
    }
    page.appendChild(groupList);
  }
  function buildEventDateGroup(group, episode, state) {
    const expanded = state.expandedEventDates.has(group.dateKey);
    const selected = Boolean(state.selectedEventDate && state.selectedEventDate === group.dateKey);
    const section = node("section", "em-detail-date-group");
    section.classList.toggle("is-expanded", expanded);
    section.classList.toggle("is-selected", selected);
    section.dataset.eventDate = group.dateKey;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "em-detail-date-toggle";
    toggle.dataset.emAction = "toggle-event-date";
    toggle.dataset.episodeId = episode.id;
    toggle.dataset.eventDate = group.dateKey;
    toggle.dataset.eventGroup = group.dateKey;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.append(
      textNode("span", formatEventDate(group), "em-detail-date-label"),
      textNode("span", `${group.events.length} \u4E2A\u4E8B\u4EF6`, "em-detail-date-count"),
      textNode("span", "\u203A", "em-detail-route-arrow")
    );
    section.appendChild(toggle);
    if (expanded) {
      const list = node("ol", "em-detail-event-chain");
      group.events.forEach((event) => list.appendChild(buildStoryEvent(event, episode)));
      section.appendChild(list);
    }
    return section;
  }
  function buildStoryEvent(event, episode) {
    const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
    const item = node("li", "em-detail-event");
    const dateKey = eventDateKey(event);
    item.dataset.eventDate = dateKey;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "em-detail-event-button";
    button.dataset.emAction = "open-event";
    button.dataset.episodeId = episode.id;
    button.dataset.eventId = event.id;
    button.dataset.eventDate = dateKey;
    button.style.setProperty("--event-color", meta.color);
    const marker = node("span", `em-detail-event-node is-${event.type}`);
    const body = document.createElement("div");
    const eventMeta = node("div", "em-detail-event-meta");
    eventMeta.append(
      textNode("span", meta.label, "em-detail-event-type"),
      textNode("time", formatEventDate(event))
    );
    const copy = textNode("p", event.description, "em-detail-event-copy");
    body.append(eventMeta, copy);
    button.append(marker, body, textNode("span", "\u203A", "em-detail-event-arrow"));
    item.appendChild(button);
    return item;
  }
  function renderEventPage(page, episode, state) {
    const event = episode.events.find((item) => item.id === state.selectedEventId);
    if (!event) {
      state.detailPage = "story";
      state.detailDirection = "back";
      page.dataset.detailPage = "story";
      renderStoryPage(page, episode, state);
      return;
    }
    const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
    page.appendChild(buildDetailHeader(episode, "\u8FD4\u56DE\u4E8B\u60C5\u7ECF\u8FC7"));
    const context = node("div", "em-detail-event-context");
    context.style.setProperty("--event-color", meta.color);
    context.append(
      textNode("span", meta.label, "em-detail-event-type"),
      textNode("time", formatEventDate(event))
    );
    page.append(
      context,
      detailHeading(event.description),
      detailInfoCard("\u6240\u5C5E\u60C5\u8282", episode.title)
    );
    const facts = node("dl", "em-detail-fact-list");
    facts.append(
      detailFact("\u4E8B\u4EF6\u7C7B\u578B", meta.label),
      detailFact("\u53D1\u751F\u65F6\u95F4", formatEventDate(event)),
      detailFact("\u751F\u6210\u7F6E\u4FE1", formatOptionalScore(event.confidence))
    );
    if (event.sourceTurnId) facts.appendChild(detailFact("\u6765\u6E90\u8F6E\u6B21", event.sourceTurnId));
    page.appendChild(facts);
  }
  function renderEvidencePage(page, episode) {
    var _a;
    page.appendChild(buildDetailHeader(episode, "\u8FD4\u56DE\u6982\u89C8"));
    page.append(
      textNode("div", "\u8BB0\u5FC6\u89E3\u91CA", "em-detail-page-kicker"),
      detailHeading("\u8BB0\u5FC6\u4F9D\u636E\u4E0E\u7CFB\u7EDF\u5224\u65AD"),
      textNode("p", "\u8FD9\u4E9B\u4FE1\u606F\u8BF4\u660E EchoMem \u4E3A\u4EC0\u4E48\u628A\u76F8\u5173\u8BB0\u5FC6\u7EC4\u7EC7\u6210\u8FD9\u4E00\u6BB5\u60C5\u8282\u3002", "em-detail-page-intro")
    );
    const measures = node("dl", "em-detail-evidence-summary");
    measures.append(
      detailMeasure("\u539F\u5B50\u8BC1\u636E", `${(episode.atomRefs || []).length} \u6761`),
      detailMeasure("\u5173\u952E\u4E8B\u4EF6", `${episode.events.length} \u4E2A`)
    );
    page.appendChild(measures);
    const factsSection = node("section", "em-detail-section");
    factsSection.appendChild(sectionTitle("\u7CFB\u7EDF\u5224\u65AD"));
    const facts = node("dl", "em-detail-fact-list");
    facts.append(
      detailFact("\u751F\u547D\u5468\u671F", STATUS_LABEL[episode.status] || episode.status || "\u672A\u8BB0\u5F55"),
      detailFact("\u53D9\u4E8B\u9636\u6BB5", ARC_LABEL[episode.arcStage] || episode.arcStage || "\u672A\u8BB0\u5F55"),
      detailFact("\u8BB0\u5FC6\u72B6\u6001", RETENTION_LABEL[episode.retentionTier] || "\u957F\u671F\u8BB0\u5FC6"),
      detailFact("\u76F8\u5173\u5BF9\u8BDD", `${episode.turnCount} \u8F6E`),
      detailFact("\u663E\u8457\u5EA6", formatScore(episode.salience)),
      detailFact("\u751F\u6210\u7F6E\u4FE1", formatOptionalScore(episode.confidence))
    );
    factsSection.appendChild(facts);
    page.appendChild(factsSection);
    const tags = visibleTags(episode);
    if (tags.length) {
      const tagSection = node("section", "em-detail-section");
      tagSection.appendChild(sectionTitle("\u5173\u8054\u5BF9\u8C61\u4E0E\u4E3B\u9898"));
      const tagList = node("div", "em-card-tags");
      tags.forEach((item) => tagList.appendChild(pill(item)));
      tagSection.appendChild(tagList);
      page.appendChild(tagSection);
    }
    if ((_a = episode.segments) == null ? void 0 : _a.length) {
      const segmentSection = node("section", "em-detail-section");
      segmentSection.appendChild(sectionTitle("\u8986\u76D6\u7684\u4F1A\u8BDD\u7247\u6BB5"));
      const segments = node("div", "em-detail-source-list");
      episode.segments.forEach((segment) => {
        segments.appendChild(detailInfoCard(
          segment.sessionId || "\u672A\u8BB0\u5F55\u4F1A\u8BDD",
          `\u6D88\u606F ${segment.startMsgIdx}\u2014${segment.endMsgIdx}`
        ));
      });
      segmentSection.appendChild(segments);
      page.appendChild(segmentSection);
    }
    const sourcedEvents = episode.events.filter((event) => event.sourceTurnId);
    if (sourcedEvents.length) {
      const sourceSection = node("section", "em-detail-section");
      sourceSection.appendChild(sectionTitle("\u53EF\u8FFD\u6EAF\u4E8B\u4EF6\u6765\u6E90"));
      const sources = node("div", "em-detail-source-list");
      sourcedEvents.forEach((event) => {
        sources.appendChild(detailInfoCard(event.description, event.sourceTurnId));
      });
      sourceSection.appendChild(sources);
      page.appendChild(sourceSection);
    }
  }
  function buildDetailHeader(episode, backLabel = "") {
    const top = node("div", "em-detail-panel-top");
    if (backLabel) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "em-detail-back";
      back.dataset.emAction = "back-detail";
      back.dataset.episodeId = episode.id;
      back.append(
        textNode("span", "\u2039", "em-detail-back-arrow"),
        textNode("span", backLabel)
      );
      top.appendChild(back);
    } else {
      const overline = node("div", "em-detail-overline");
      overline.append(
        pill(STATUS_LABEL[episode.status] || episode.status, "em-status-pill"),
        textNode("span", formatEpisodeDateRange(episode))
      );
      top.appendChild(overline);
    }
    top.appendChild(iconButton("\xD7", "close-detail", "\u6536\u8D77\u8BE6\u60C5"));
    return top;
  }
  function detailHeading(text) {
    const heading = textNode("h2", text, "em-detail-page-title");
    heading.tabIndex = -1;
    return heading;
  }
  function detailRouteButton(action, title, meta, copy) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "em-detail-route";
    button.dataset.emAction = action;
    const body = node("span", "em-detail-route-body");
    body.append(
      textNode("strong", title),
      textNode("span", copy, "em-detail-route-copy")
    );
    button.append(
      body,
      textNode("span", meta, "em-detail-route-meta"),
      textNode("span", "\u203A", "em-detail-route-arrow")
    );
    return button;
  }
  function detailMeasure(label, value) {
    const item = node("div", "em-detail-measure");
    item.append(
      textNode("dt", label),
      textNode("dd", value)
    );
    return item;
  }
  function detailFact(label, value) {
    const item = node("div", "em-detail-fact");
    item.append(
      textNode("dt", label),
      textNode("dd", value)
    );
    return item;
  }
  function detailInfoCard(title, copy) {
    const card = node("div", "em-detail-info-card");
    card.append(
      textNode("strong", title),
      textNode("span", copy)
    );
    return card;
  }
  function groupEventsByDate(events) {
    const groups = /* @__PURE__ */ new Map();
    events.forEach((event, index) => {
      const day = toTimelineDay(event.time);
      const dateKey = day != null ? String(day) : event.rawTime || `unknown-${index}`;
      const key = dateKey;
      if (!groups.has(key)) {
        groups.set(key, {
          dateKey,
          rawTime: event.rawTime || "",
          time: day,
          events: []
        });
      }
      groups.get(key).events.push(event);
    });
    return [...groups.values()];
  }
  function rememberDetailScroll(detail, state) {
    const page = detail.querySelector(".em-detail-page");
    if (page && state.detailPage in state.detailScroll) {
      state.detailScroll[state.detailPage] = page.scrollTop;
    }
  }
  function restoreDetailScroll(detail, state, pageName) {
    requestAnimationFrame(() => {
      const page = detail.querySelector(".em-detail-page");
      if (page) page.scrollTop = state.detailScroll[pageName] || 0;
    });
  }
  function focusDetailPage(detail) {
    requestAnimationFrame(() => {
      var _a;
      (_a = detail.querySelector(".em-detail-page-title")) == null ? void 0 : _a.focus({ preventScroll: true });
    });
  }
  function collectionRange(episodes) {
    const values = episodes.flatMap((episode) => [
      episode.startTime,
      episode.endTime,
      episode.lastActiveAt,
      ...episode.events.map((event) => event.time)
    ]).map(toTimelineDay).filter((value) => value != null);
    if (!values.length) {
      const now = Date.now();
      return { min: now, max: now + DAY_MS };
    }
    const min = Math.min(...values);
    const rawMax = Math.max(...values);
    return { min, max: rawMax === min ? min + DAY_MS : rawMax };
  }
  function buildTicks(min, max, count, boundaryDates = []) {
    const meaningfulDays = [.../* @__PURE__ */ new Set([
      min,
      ...boundaryDates.map(toTimelineDay).filter((value) => value != null),
      max
    ])].sort((a, b) => a - b);
    const safeCount = Math.max(2, count);
    if (meaningfulDays.length <= safeCount) return meaningfulDays;
    const lastIndex = meaningfulDays.length - 1;
    const indexes = Array.from(
      { length: safeCount },
      (_, index) => Math.round(index * lastIndex / (safeCount - 1))
    );
    return [...new Set(indexes)].map((index) => meaningfulDays[index]);
  }
  function toTimelineDay(value) {
    if (value == null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function eventDateKey(event) {
    const day = toTimelineDay(event == null ? void 0 : event.time);
    return day != null ? String(day) : String((event == null ? void 0 : event.rawTime) || "");
  }
  function toPercent(value, min, max) {
    if (value == null || max <= min) return 0;
    return Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  }
  function formatAxisDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC"
    }).format(new Date(value)).replace("/", ".");
  }
  function formatRangeFromEpisodes(episodes) {
    const first = episodes[0];
    const last = episodes.reduce((latest, episode) => {
      const latestTime = latest.endTime ?? latest.lastActiveAt ?? latest.startTime ?? 0;
      const episodeTime = episode.endTime ?? episode.lastActiveAt ?? episode.startTime ?? 0;
      return episodeTime > latestTime ? episode : latest;
    }, first);
    const start = first.rawStartTime || first.rawLastActiveAt || first.rawEndTime;
    const end = last.rawEndTime || last.rawLastActiveAt || last.rawStartTime;
    return formatRawDateRange(start, end);
  }
  function formatEpisodeDateRange(episode) {
    return formatRawDateRange(
      episode.rawStartTime || episode.rawLastActiveAt || episode.rawEndTime,
      episode.rawEndTime || episode.rawLastActiveAt || episode.rawStartTime
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
  function visibleTags(episode) {
    return unique([...episode.entities || [], ...episode.topics || []]).filter((item) => item && !GENERIC_TAGS.has(item.toLocaleLowerCase()));
  }
  function unique(items) {
    return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  }
  function sectionTitle(text) {
    return textNode("h3", text, "em-detail-section-title");
  }
  function formatScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score.toFixed(2) : "\u672A\u8BB0\u5F55";
  }
  function formatOptionalScore(value) {
    if (value == null || value === "") return "\u672A\u8BB0\u5F55";
    const score = Number(value);
    if (!Number.isFinite(score)) return "\u672A\u8BB0\u5F55";
    return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
  }
  function legendItem(className, label, markerText = "") {
    const item = node("span", "em-legend-item");
    const marker = node("i", className);
    if (markerText) marker.textContent = markerText;
    item.append(marker, textNode("span", label));
    return item;
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
    <p class="em-state-copy">\u76F8\u5173\u4E8B\u4EF6\u79EF\u7D2F\u540E\uFF0CEchoMem \u4F1A\u628A\u5B83\u4EEC\u7EC4\u7EC7\u4E3A\u53EF\u9605\u8BFB\u7684\u60C5\u8282\u6545\u4E8B\u7EBF\u3002</p>
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
    const state = container == null ? void 0 : container._timelineState;
    if ((_a = state == null ? void 0 : state.handlers) == null ? void 0 : _a.root) {
      state.handlers.root.removeEventListener("click", state.handlers.onClick);
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
    .em-view-stage[data-em-view="timeline"] {
      --em-bg: #fffbfe; --em-panel: rgba(255,255,255,.96); --em-panel-strong: #ffffff;
      --em-line: rgba(121,116,126,.24); --em-line-strong: rgba(103,80,164,.42);
      --em-text: #1d1b20; --em-text-2: #49454f; --em-text-3: #79747e;
      --em-cyan: #6750a4; --em-blue: #5278c5; --em-green: #3b8f6c;
      --em-amber: #b87a24; --em-pink: #ad557e; --em-purple: #6750a4;
      color: var(--em-text); color-scheme: light;
      background:
        radial-gradient(circle at 8% -12%, rgba(234,221,255,.56), transparent 32%),
        linear-gradient(145deg, #fffbfe 0%, #fef7ff 55%, #f6f1fa 100%);
    }
    .em-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; padding: 3px 9px; border: 1px solid var(--em-line); border-radius: 999px; color: var(--em-text-2); background: rgba(255,255,255,.72); font-size: 11px; }
    .em-kicker { color: var(--em-cyan); font: 600 10px/1.3 var(--em-font-sans); letter-spacing: .08em; }
    .em-episode-view { position: absolute; inset: 0; overflow: hidden; color: var(--em-text); }
    .em-view-stage[data-em-view="timeline"] .em-pill { min-height: 26px; font-size: 12px; }
    .em-view-stage[data-em-view="timeline"] .em-kicker { font-size: 12px; }
    .em-episode-timeline-shell { height: 100%; display: grid; grid-template-columns: minmax(0,1fr) minmax(330px,29%); background: rgba(255,255,255,.28); transition: grid-template-columns .28s cubic-bezier(.2,.7,.2,1); }
    .em-episode-timeline-shell.is-detail-closed { grid-template-columns: minmax(0,1fr) 0; }
    .em-timeline-main { min-width: 0; overflow: auto; background: linear-gradient(150deg,rgba(255,255,255,.72),rgba(254,247,255,.82)); }
    .em-timeline-toolbar { position: sticky; z-index: 8; top: 0; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 24px 28px 19px; border-bottom: 1px solid var(--em-line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
    .em-timeline-title-line { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
    .em-timeline-title-line h1 { margin: 0; color: var(--em-text); font-size: clamp(21px,2.1vw,29px); font-weight: 570; letter-spacing: -.03em; }
    .em-timeline-toolbar p { margin: 7px 0 0; color: var(--em-text-3); font-size: 13px; line-height: 1.55; }
    .em-timeline-legend { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; color: var(--em-text-3); font-size: 12px; }
    .em-legend-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .em-legend-item i { position: relative; display: inline-grid; place-items: center; width: 9px; height: 9px; border-radius: 50%; color: #fff; background: var(--em-blue); font: 700 8px/1 var(--em-font-sans); }
    .em-legend-item .em-legend-single-day { width: 24px; height: 10px; border: 1px solid rgba(103,80,164,.42); border-radius: 999px; background: rgba(103,80,164,.2); }
    .em-legend-item .em-legend-cluster { width: 14px; height: 14px; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(103,80,164,.34); background: var(--em-purple); }
    .em-legend-item .em-legend-decision { width: 9px; height: 9px; border-radius: 2px; background: var(--em-amber); box-shadow: 0 0 0 1px rgba(184,122,36,.18); transform: rotate(45deg); }
    .em-timeline-chart { min-width: 630px; padding: 10px 28px 20px; }
    .em-timeline-axis, .em-timeline-row { display: grid; grid-template-columns: minmax(160px,210px) minmax(300px,1fr) 52px; gap: 14px; align-items: center; }
    .em-timeline-axis { min-height: 42px; color: var(--em-text-3); font: 600 12px/1.2 var(--em-font-sans); font-variant-numeric: tabular-nums; }
    .em-axis-track, .em-timeline-track { position: relative; min-width: 0; }
    .em-axis-track { height: 100%; }
    .em-axis-tick { position: absolute; top: 50%; white-space: nowrap; transform: translate(-50%,-50%); }
    .em-axis-tick:first-child { transform: translate(0,-50%); }
    .em-axis-tick:last-child { transform: translate(-100%,-50%); }
    .em-axis-tail { text-align: center; }
    .em-timeline-row { position: relative; min-height: 94px; border-top: 1px solid rgba(73,50,115,.085); transition: background .16s ease; }
    .em-timeline-row:last-child { border-bottom: 1px solid rgba(73,50,115,.085); }
    .em-timeline-row:hover { background: rgba(103,80,164,.035); }
    .em-timeline-row.is-selected { background: linear-gradient(90deg,rgba(103,80,164,.075),rgba(103,80,164,.018)); }
    .em-timeline-row-label { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 13px 8px 13px 0; border: 0; color: var(--em-text); background: transparent; text-align: left; cursor: pointer; }
    .em-row-title { width: 100%; overflow: hidden; font-size: 15px; font-weight: 650; line-height: 1.42; text-overflow: ellipsis; white-space: nowrap; }
    .em-row-meta { color: var(--em-text-3); font-size: 12px; }
    .em-timeline-track { height: 42px; }
    .em-timeline-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(73,50,115,.13); transform: translateY(-50%); }
    .em-timeline-gridline { position: absolute; top: -26px; bottom: -26px; width: 1px; background: rgba(73,50,115,.07); pointer-events: none; }
    .em-episode-span { position: absolute; z-index: 1; top: 50%; min-width: 0; height: 20px; padding: 0; border: 1px solid rgba(103,80,164,.4); border-radius: 999px; background: linear-gradient(90deg,rgba(103,80,164,.2),rgba(103,80,164,.32)); cursor: pointer; transform: translate(var(--em-span-shift,0%),-50%); transform-origin: center; transition: box-shadow .16s ease,background .16s ease; }
    .em-episode-span.is-point { width: 44px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.38),0 3px 9px rgba(73,50,115,.1); }
    .em-episode-span.is-beginning { border-color: rgba(82,120,197,.42); background: linear-gradient(90deg,rgba(82,120,197,.16),rgba(82,120,197,.3)); }
    .em-episode-span.is-end { border-color: rgba(173,85,126,.4); background: linear-gradient(90deg,rgba(173,85,126,.15),rgba(173,85,126,.28)); }
    .em-episode-span.is-ongoing { border-color: rgba(59,143,108,.42); background: linear-gradient(90deg,rgba(59,143,108,.15),rgba(59,143,108,.3)); }
    .em-timeline-row.is-selected .em-episode-span { border-color: rgba(103,80,164,.72); background: linear-gradient(90deg,rgba(103,80,164,.26),rgba(103,80,164,.38)); box-shadow: inset 0 0 0 1px rgba(103,80,164,.16); transform: translate(var(--em-span-shift,0%),-50%); }
    .em-timeline-event-mark { --em-event-mark-color: var(--em-blue); position: absolute; z-index: 3; top: 50%; display: grid; place-items: center; width: 12px; height: 12px; margin: 0; padding: 0; appearance: none; border: 2px solid #fff; border-radius: 50%; color: #fff; background: var(--em-event-mark-color); font-family: var(--em-font-sans); font-variant-numeric: tabular-nums; line-height: 1; cursor: pointer; box-shadow: 0 0 0 1px rgba(82,120,197,.42),0 2px 5px rgba(36,48,74,.14); transform: translate(-50%,-50%); transition: background .16s ease,box-shadow .16s ease; }
    .em-timeline-event-mark.is-cluster { --em-event-mark-color: var(--em-purple); width: 16px; height: 16px; box-shadow: 0 0 0 1px rgba(103,80,164,.42),0 2px 5px rgba(73,50,115,.14); }
    .em-timeline-event-mark.is-cluster.contains-decision { border-color: var(--em-amber); box-shadow: 0 0 0 1px rgba(184,122,36,.42),0 2px 5px rgba(73,50,115,.14); }
    .em-timeline-event-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; margin: 0; padding: 0; color: #fff; font-family: var(--em-font-sans); font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; line-height: 1; text-align: center; transform: none; pointer-events: none; }
    .em-timeline-event-mark.is-decision { --em-event-mark-color: var(--em-amber); border-radius: 2px; transform: translate(-50%,-50%) rotate(45deg); }
    .em-timeline-event-mark:hover, .em-timeline-event-mark:focus-visible { background: linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,.16)),var(--em-event-mark-color); box-shadow: 0 0 0 2px rgba(103,80,164,.2),0 4px 9px rgba(73,50,115,.2); transform: translate(-50%,-50%); }
    .em-timeline-event-mark.is-decision:hover, .em-timeline-event-mark.is-decision:focus-visible { transform: translate(-50%,-50%) rotate(45deg); }
    .em-timeline-row-tail { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--em-text-3); font-size: 11px; }
    .em-timeline-row-tail strong { color: var(--em-text-2); font: 650 15px/1 var(--em-font-sans); font-variant-numeric: tabular-nums; }
    .em-timeline-footnote { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 22px; padding: 0 28px 26px; color: var(--em-text-3); font-size: 11px; line-height: 1.5; }
    .em-episode-detail-panel { min-width: 0; overflow: hidden; padding: 0; border-left: 1px solid rgba(73,50,115,.13); color: var(--em-text); background: rgba(255,255,255,.96); box-shadow: -18px 0 52px rgba(67,45,86,.08); transform: translateX(0); transition: opacity .22s ease,transform .28s cubic-bezier(.2,.7,.2,1); }
    .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { border-left: 0; opacity: 0; transform: translateX(32px); pointer-events: none; }
    .em-detail-page { height: 100%; overflow-y: auto; padding: 23px 24px 28px; scrollbar-gutter: stable; }
    .em-detail-page.is-forward { animation: em-detail-forward .2s ease-out; }
    .em-detail-page.is-back { animation: em-detail-back .2s ease-out; }
    .em-detail-panel-top { position: sticky; z-index: 5; top: -23px; display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 54px; margin: -23px -24px 0; padding: 13px 24px 9px; background: linear-gradient(180deg,#fff 72%,rgba(255,255,255,.9)); }
    .em-detail-overline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--em-text-3); font-size: 12px; }
    .em-status-pill { color: #3b6f5a; border-color: rgba(59,143,108,.22); background: rgba(59,143,108,.07); }
    .em-detail-close { flex: 0 0 auto; width: 36px; height: 36px; border: 1px solid var(--em-line); border-radius: 10px; color: var(--em-text-3); background: rgba(255,255,255,.82); font-size: 19px; line-height: 1; cursor: pointer; }
    .em-detail-close:hover { color: #493273; border-color: rgba(103,80,164,.28); background: rgba(103,80,164,.06); }
    .em-detail-back { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 7px 8px 7px 4px; border: 0; border-radius: 9px; color: #493273; background: transparent; font: 600 13px/1 var(--em-font-sans); cursor: pointer; }
    .em-detail-back:hover, .em-detail-back:focus-visible { background: rgba(103,80,164,.07); }
    .em-detail-back-arrow { font-size: 22px; font-weight: 400; line-height: .7; }
    .em-detail-page-title { margin: 16px 0 0; color: var(--em-text); font-size: clamp(20px,2vw,27px); font-weight: 570; line-height: 1.4; letter-spacing: -.025em; }
    .em-detail-page-title:focus { outline: none; }
    .em-detail-page-kicker { margin-top: 14px; color: var(--em-text-3); font-size: 12px; font-weight: 600; letter-spacing: .04em; }
    .em-detail-page-intro { margin: 10px 0 0; color: var(--em-text-3); font-size: 14px; line-height: 1.65; }
    .em-detail-context-title { margin: 7px 0 0; color: var(--em-text-3); font-size: 13px; line-height: 1.55; }
    .em-detail-section { margin-top: 22px; }
    .em-detail-section-title { margin: 0 0 9px; color: var(--em-text-3); font: 650 12px/1.3 var(--em-font-sans); letter-spacing: .05em; }
    .em-detail-summary-card { padding: 15px 16px 16px; border: 1px solid rgba(103,80,164,.12); border-radius: 13px; background: linear-gradient(145deg,rgba(103,80,164,.055),rgba(255,255,255,.8)); }
    .em-detail-summary { margin: 0; color: var(--em-text-2); font-size: 15px; line-height: 1.7; }
    .em-card-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .em-detail-section .em-card-tags { margin-top: 0; }
    .em-detail-routes { display: flex; flex-direction: column; gap: 10px; margin-top: 23px; }
    .em-detail-route { display: grid; grid-template-columns: minmax(0,1fr) auto 14px; align-items: center; gap: 10px; width: 100%; min-height: 76px; padding: 13px 14px; border: 1px solid rgba(103,80,164,.14); border-radius: 13px; color: var(--em-text); background: rgba(255,255,255,.82); cursor: pointer; text-align: left; transition: border-color .16s ease,background .16s ease,box-shadow .16s ease; }
    .em-detail-route:hover, .em-detail-route:focus-visible { border-color: rgba(103,80,164,.34); background: rgba(103,80,164,.055); box-shadow: 0 5px 16px rgba(73,50,115,.08); }
    .em-detail-route-body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .em-detail-route-body strong { font-size: 15px; font-weight: 650; }
    .em-detail-route-copy { color: var(--em-text-3); font-size: 12px; line-height: 1.5; }
    .em-detail-route-meta { color: #6750a4; font-size: 12px; white-space: nowrap; }
    .em-detail-route-arrow, .em-detail-event-arrow { color: #8069ae; font-size: 20px; line-height: 1; transition: transform .16s ease; }
    .em-detail-route:hover .em-detail-route-arrow, .em-detail-route:focus-visible .em-detail-route-arrow { transform: translateX(2px); }
    .em-detail-date-groups { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
    .em-detail-date-group { overflow: hidden; border: 1px solid rgba(103,80,164,.12); border-radius: 13px; background: rgba(255,255,255,.76); }
    .em-detail-date-group.is-selected { border-color: rgba(103,80,164,.36); box-shadow: 0 0 0 2px rgba(103,80,164,.06); }
    .em-detail-date-toggle { display: grid; grid-template-columns: minmax(0,1fr) auto 14px; align-items: center; gap: 9px; width: 100%; min-height: 48px; padding: 11px 13px; border: 0; color: var(--em-text); background: transparent; cursor: pointer; text-align: left; }
    .em-detail-date-toggle:hover, .em-detail-date-toggle:focus-visible { background: rgba(103,80,164,.055); }
    .em-detail-date-label { font-size: 14px; font-weight: 650; }
    .em-detail-date-count { color: var(--em-text-3); font-size: 12px; white-space: nowrap; }
    .em-detail-date-group.is-expanded .em-detail-route-arrow { transform: rotate(90deg); }
    .em-detail-event-chain { position: relative; display: flex; flex-direction: column; gap: 0; margin: 0; padding: 3px 10px 10px; border-top: 1px solid rgba(103,80,164,.09); list-style: none; }
    .em-detail-event-chain::before { content: ''; position: absolute; left: 22px; top: 20px; bottom: 24px; width: 1px; background: linear-gradient(rgba(103,80,164,.32),rgba(103,80,164,.08)); }
    .em-detail-event { position: relative; margin: 0; padding: 0; }
    .em-detail-event-button { position: relative; z-index: 1; display: grid; grid-template-columns: 20px minmax(0,1fr) 12px; gap: 9px; align-items: start; width: 100%; min-height: 52px; padding: 10px 6px; border: 0; border-radius: 9px; color: inherit; background: transparent; cursor: pointer; text-align: left; }
    .em-detail-event-button:hover, .em-detail-event-button:focus-visible { background: rgba(103,80,164,.055); }
    .em-detail-event-node { position: relative; z-index: 1; width: 13px; height: 13px; margin: 3px 0 0 1px; border: 3px solid #fff; border-radius: 50%; background: var(--event-color,var(--em-blue)); box-shadow: 0 0 0 1px var(--event-color,var(--em-blue)); }
    .em-detail-event-node.is-decision { border-radius: 3px; transform: rotate(45deg) scale(.9); }
    .em-detail-event-node.is-state_change { clip-path: polygon(50% 0,100% 100%,0 100%); border-radius: 0; }
    .em-detail-event-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 7px; color: var(--em-text-3); font-size: 11px; }
    .em-detail-event-type { color: var(--event-color,var(--em-blue)); font-weight: 650; }
    .em-detail-event-copy { margin: 5px 0 0; color: var(--em-text-2); font-size: 14px; line-height: 1.6; }
    .em-detail-event-arrow { align-self: center; }
    .em-detail-event-context { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 15px; color: var(--em-text-3); font-size: 12px; }
    .em-detail-info-card { display: flex; flex-direction: column; gap: 5px; margin-top: 18px; padding: 13px 14px; border: 1px solid rgba(103,80,164,.12); border-radius: 12px; background: rgba(103,80,164,.045); }
    .em-detail-info-card strong { color: var(--em-text-2); font-size: 14px; font-weight: 650; line-height: 1.5; }
    .em-detail-info-card span { color: var(--em-text-3); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
    .em-detail-evidence-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; margin: 21px 0 0; overflow: hidden; border: 1px solid var(--em-line); border-radius: 12px; background: var(--em-line); }
    .em-detail-measure { min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 13px 14px; background: rgba(255,255,255,.96); }
    .em-detail-measure dt { color: var(--em-text-3); font-size: 11px; }
    .em-detail-measure dd { order: -1; margin: 0; color: var(--em-text); font: 650 16px/1.2 var(--em-font-sans); font-variant-numeric: tabular-nums; }
    .em-detail-fact-list { display: flex; flex-direction: column; margin: 0; overflow: hidden; border: 1px solid rgba(103,80,164,.12); border-radius: 12px; background: rgba(255,255,255,.8); }
    .em-detail-page > .em-detail-fact-list { margin-top: 20px; }
    .em-detail-fact { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; min-height: 41px; padding: 10px 12px; border-bottom: 1px solid rgba(103,80,164,.09); }
    .em-detail-fact:last-child { border-bottom: 0; }
    .em-detail-fact dt { color: var(--em-text-3); font-size: 12px; }
    .em-detail-fact dd { margin: 0; color: var(--em-text-2); font-size: 13px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    .em-detail-source-list { display: flex; flex-direction: column; gap: 8px; }
    .em-detail-source-list .em-detail-info-card { margin-top: 0; }
    .em-source-note { margin: 16px 0 0; color: var(--em-text-3); font-size: 14px; line-height: 1.7; }
    @keyframes em-detail-forward { from { opacity: .45; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes em-detail-back { from { opacity: .45; transform: translateX(-18px); } to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) {
      .em-episode-timeline-shell, .em-episode-detail-panel, .em-episode-span, .em-timeline-event-mark { transition: none !important; }
      .em-detail-page { animation: none !important; }
    }
    @media (max-width: 820px) {
      .em-episode-view { overflow: hidden; }
      .em-episode-timeline-shell, .em-episode-timeline-shell.is-detail-closed { position: relative; display: block; }
      .em-timeline-main { height: 100%; }
      .em-episode-detail-panel {
        position: absolute; z-index: 30; left: 0; right: 0; bottom: 0; max-height: 78%;
        border-top: 1px solid rgba(73,50,115,.14); border-left: 0; border-radius: 20px 20px 0 0;
        opacity: 0; transform: translateY(105%); pointer-events: none;
        box-shadow: 0 -20px 60px rgba(67,45,86,.16);
      }
      .em-episode-detail-panel.is-open { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .em-episode-detail-panel[data-detail-page="story"], .em-episode-detail-panel[data-detail-page="evidence"], .em-episode-detail-panel[data-detail-page="event"] { max-height: 92%; }
      .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { opacity: 0; transform: translateY(105%); }
    }
    @media (max-width: 560px) {
      .em-timeline-toolbar { position: relative; align-items: flex-start; flex-direction: column; padding: 18px 16px 14px; }
      .em-timeline-legend { justify-content: flex-start; }
      .em-timeline-chart { min-width: 0; padding: 2px 16px 18px; }
      .em-timeline-axis { display: none; }
      .em-timeline-row { grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; min-height: 116px; padding: 10px 0 14px; }
      .em-timeline-row-label { grid-column: 1; grid-row: 1; padding: 5px 0; }
      .em-timeline-row-tail { grid-column: 2; grid-row: 1; }
      .em-timeline-track { grid-column: 1/-1; grid-row: 2; height: 38px; }
      .em-timeline-gridline { top: -4px; bottom: -4px; }
      .em-timeline-footnote { padding: 0 16px 22px; }
      .em-detail-page { padding: 20px 18px 24px; }
      .em-detail-panel-top { top: -20px; margin: -20px -18px 0; padding: 10px 18px 8px; }
      .em-detail-route { grid-template-columns: minmax(0,1fr) 14px; }
      .em-detail-route-meta { grid-column: 1; grid-row: 2; }
      .em-detail-route-arrow { grid-column: 2; grid-row: 1/3; }
    }
  `;
    container.appendChild(style);
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
  async function mountEpisodeView(container, viewApi = {}) {
    try {
      setLoadingState(container);
      let model = container._episodeModel;
      if (!model) {
        model = await fetchEpisodeTimeline();
        container._episodeModel = model;
      }
      if (!isViewActive(container, viewApi)) return;
      renderTimeline(container, model);
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
