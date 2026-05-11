(() => {
  // src/platforms/higo.js
  var higoConfig = {
    id: "higo",
    name: "HIGO Office",
    detection: {
      urlPatterns: ["/home/session/", "/home/workspace/"],
      titleKeywords: ["Higo", "HIGO", "Higo2", "Higo Office"],
      domFeatures: {
        required: [
          { selector: ".MuiDrawer-root", description: "MUI \u62BD\u5C49\u7EC4\u4EF6" },
          { selector: ".MuiPaper-root", description: "MUI Paper \u5BB9\u5668" }
        ],
        optional: [
          { selector: 'textarea[id^="_r_"]', description: "React \u8F93\u5165\u6846" },
          { selector: '[data-testid="ArrowUpwardIcon"]', description: "\u53D1\u9001\u6309\u94AE\u56FE\u6807" },
          { selector: ".MuiDrawer-anchorRight", description: "\u53F3\u4FA7\u62BD\u5C49" }
        ]
      },
      contentKeywords: ["higo", "HIGO", "Higo2"]
    },
    launcher: {
      text: "EchoMem",
      containerSelector: ".MuiPaper-root",
      validateSelectors: {
        textarea: 'textarea[id^="_r_"]',
        sendButton: '[data-testid="ArrowUpwardIcon"]'
      },
      style: {
        display: "flex",
        gap: "8px",
        padding: "0 12px 8px",
        background: "rgb(255, 251, 254)",
        alignItems: "center",
        justifyContent: "flex-start"
      },
      insertPosition: "before"
    },
    messages: {
      // 聊天消息 DOM 选择器（多候选，按优先级排序）
      // HIGO 使用 MUI 组件，消息通常在滚动容器内
      messageContainers: [
        // 常见消息列表容器
        '[class*="MessageList"]',
        '[class*="message-list"]',
        '[class*="chat-messages"]',
        '[class*="conversation"]',
        // MUI 滚动容器
        ".MuiPaper-root > .MuiList-root",
        ".MuiDrawer-paper > div > div",
        // 更宽泛的兜底
        ".MuiPaper-root"
      ],
      userMessages: [
        // HIGO 通常通过布局区分用户/AI，右侧为用户
        '[class*="UserMessage"]',
        '[class*="user-message"]',
        '[class*="user"]',
        // 通过 align-items: flex-end 等样式特征
        '[style*="flex-end"]'
      ],
      assistantMessages: [
        '[class*="AssistantMessage"]',
        '[class*="assistant-message"]',
        '[class*="assistant"]',
        '[class*="bot-message"]',
        '[class*="ai-message"]'
      ],
      allMessages: [
        // 兜底：所有包含文本的 div
        'div[class*="Mui"]',
        "div"
      ]
    },
    panelHost: {
      type: "sidebar",
      containerSelector: ".MuiDrawer-anchorRight .MuiDrawer-paper",
      overlayConfig: null
    },
    menuItems: [
      { panelId: "resources" },
      { panelId: "association" },
      { panelId: "feedback" },
      { panelId: "skillStore" },
      { panelId: "performance" }
    ]
  };

  // src/platforms/deepseek.js
  var deepseekConfig = {
    id: "deepseek",
    name: "DeepSeek",
    detection: {
      urlPatterns: ["chat.deepseek.com"],
      titleKeywords: ["DeepSeek"],
      domFeatures: {
        required: [
          { selector: 'textarea[placeholder*="DeepSeek"]', description: "DeepSeek \u8F93\u5165\u6846" },
          { selector: "._24fad49", description: "\u8F93\u5165\u6846\u5BB9\u5668" }
        ],
        optional: [
          { selector: "._020ab5b", description: "\u5E95\u90E8\u6309\u94AE\u533A\u57DF" },
          { selector: '[role="button"]', description: "\u529F\u80FD\u6309\u94AE" }
        ]
      },
      contentKeywords: ["deepseek", "\u6DF1\u5EA6\u601D\u8003", "\u667A\u80FD\u641C\u7D22"]
    },
    launcher: {
      text: "EchoMem",
      containerSelector: "._77cefa5, ._24fad49",
      validateSelectors: {
        textarea: 'textarea[placeholder*="DeepSeek"]'
      },
      getBackgroundColor: () => {
        const inputArea = document.querySelector("._77cefa5");
        if (inputArea) {
          const style = window.getComputedStyle(inputArea);
          if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
            return style.backgroundColor;
          }
        }
        return "#fff";
      },
      style: {
        display: "flex",
        gap: "8px",
        padding: "0 12px 8px",
        alignItems: "center",
        justifyContent: "flex-start"
      },
      insertPosition: "before"
    },
    messages: {
      messageContainers: [
        ".ds-chat-message-list",
        '[class*="chat-message-list"]',
        '[class*="ChatMessageList"]',
        "main > div > div"
      ],
      userMessages: [
        ".ds-chat-message-user",
        '[class*="message-user"]',
        '[class*="MessageUser"]'
      ],
      assistantMessages: [
        ".ds-chat-message-assistant",
        '[class*="message-assistant"]',
        '[class*="MessageAssistant"]'
      ],
      allMessages: [
        '[class*="chat-message"]',
        '[class*="ChatMessage"]'
      ]
    },
    panelHost: {
      type: "overlay",
      containerSelector: null,
      overlayConfig: {
        position: "right",
        width: "400px",
        backdrop: true
      }
    },
    menuItems: [
      { panelId: "resources" },
      { panelId: "association" },
      { panelId: "feedback" },
      { panelId: "skillStore" },
      { panelId: "performance" }
    ]
  };

  // src/platforms/registry.js
  var platformRegistry = {
    higo: higoConfig,
    deepseek: deepseekConfig
  };

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
  var initialized = false;
  async function initState() {
    if (initialized) return;
    try {
      const result = await chrome.storage.local.get("echomemState");
      if (result.echomemState) {
        const saved = result.echomemState;
        state = {
          ...DEFAULT_STATE,
          ...saved,
          platform: null
          // 平台需要每次重新检测，不持久化
        };
      }
    } catch (err) {
      console.warn("EchoMem: failed to load state", err);
    }
    initialized = true;
  }
  function persistState() {
    try {
      chrome.storage.local.set({ echomemState: state });
    } catch (err) {
      console.warn("EchoMem: failed to persist state", err);
    }
  }
  function getPlatform() {
    return state.platform;
  }
  function setPlatform(platform) {
    state.platform = platform;
  }
  function getAssociationEnabled() {
    return state.association.enabled;
  }
  function toggleAssociationEnabled() {
    state.association.enabled = !state.association.enabled;
    persistState();
    return state.association.enabled;
  }
  function setPanelOpen(isOpen) {
    state.panel.isOpen = isOpen;
  }
  function setCurrentRoute(route) {
    state.panel.currentRoute = route;
  }

  // src/core/detection.js
  function getCurrentPlatform() {
    return getPlatform();
  }
  function setCurrentPlatform(platform) {
    setPlatform(platform);
  }
  function detectPlatformMultiLayer(detection) {
    const logs = [];
    if (detection.urlPatterns) {
      const urlMatch = detection.urlPatterns.some(
        (pattern) => window.location.href.includes(pattern)
      );
      if (!urlMatch) {
        console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - URL\u4E0D\u5339\u914D");
        return false;
      }
      logs.push("\u2713 URL\u5339\u914D");
    }
    if (detection.titleKeywords) {
      const titleMatch = detection.titleKeywords.some(
        (keyword) => document.title.includes(keyword)
      );
      if (!titleMatch) {
        console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u6807\u9898\u5173\u952E\u5B57\u4E0D\u5339\u914D");
        return false;
      }
      logs.push("\u2713 \u6807\u9898\u5173\u952E\u5B57\u5339\u914D");
    }
    if (detection.domFeatures) {
      const { required, optional } = detection.domFeatures;
      if (required && required.length > 0) {
        for (const feature of required) {
          const exists = document.querySelector(feature.selector) !== null;
          if (!exists) {
            console.log(`Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u7F3A\u5C11\u5FC5\u8981DOM: ${feature.description}`);
            return false;
          }
        }
        logs.push("\u2713 \u5FC5\u8981DOM\u5143\u7D20\u5168\u90E8\u5B58\u5728");
      }
      if (optional && optional.length > 0) {
        const optionalMatch = optional.some(
          (feature) => document.querySelector(feature.selector) !== null
        );
        if (!optionalMatch) {
          console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u65E0\u53EF\u9009DOM\u7279\u5F81\u5339\u914D");
          return false;
        }
        logs.push("\u2713 \u53EF\u9009DOM\u7279\u5F81\u5339\u914D");
      }
    }
    if (detection.contentKeywords && document.body) {
      const bodyText = document.body.innerText || "";
      if (bodyText.length > 0) {
        const contentMatch = detection.contentKeywords.some(
          (keyword) => bodyText.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!contentMatch) {
          console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u9875\u9762\u5185\u5BB9\u5173\u952E\u5B57\u4E0D\u5339\u914D");
          return false;
        }
        logs.push("\u2713 \u9875\u9762\u5185\u5BB9\u5173\u952E\u5B57\u5339\u914D");
      }
    }
    console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u5168\u90E8\u901A\u8FC7:", logs.join(" | "));
    return true;
  }
  function detectPlatform() {
    for (const [key, config] of Object.entries(platformRegistry)) {
      try {
        if (detectPlatformMultiLayer(config.detection)) {
          console.log(`Claw Extension: Detected platform - ${config.name}`);
          return { key, config };
        }
      } catch (e) {
        console.error(`Claw Extension: Detection error for ${key}`, e);
      }
    }
    return null;
  }

  // src/core/panel-host.js
  var originalPanelContent = null;
  var isCustomPanelOpen = false;
  var currentOverlayPanel = null;
  function getPanelConfig(platform = getCurrentPlatform()) {
    var _a, _b;
    return ((_a = platform == null ? void 0 : platform.config) == null ? void 0 : _a.panelHost) || ((_b = platform == null ? void 0 : platform.config) == null ? void 0 : _b.panel) || null;
  }
  function getPanelContainer() {
    const platform = getCurrentPlatform();
    if (!platform) return null;
    const panelConfig = getPanelConfig(platform);
    if (!panelConfig) return null;
    if (panelConfig.type === "sidebar") {
      return document.querySelector(panelConfig.containerSelector);
    } else if (panelConfig.type === "overlay") {
      return currentOverlayPanel;
    }
    return null;
  }
  function isPanelOpen() {
    return isCustomPanelOpen;
  }
  function setOriginalPanelContent(content) {
    originalPanelContent = content;
  }
  function buildPanelHeader(title, showBack, onBack) {
    if (showBack) {
      return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #fafafa;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="claw-back-btn" style="
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            transition: background 0.2s;
          " title="\u8FD4\u56DE">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h6 style="
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #333;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">${title}</h6>
        </div>
        <button class="claw-close-panel" style="
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: background 0.2s;
        " title="\u5173\u95ED">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    } else {
      return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #fafafa;
      ">
        <h6 style="
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">${title}</h6>
        <button class="claw-close-panel" style="
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: background 0.2s;
        " title="\u5173\u95ED">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    }
  }
  function bindPanelEvents(container, showBack, onBack) {
    if (showBack) {
      const backBtn = container.querySelector(".claw-back-btn");
      if (backBtn) {
        backBtn.addEventListener("mouseenter", () => {
          backBtn.style.background = "#f0f0f0";
        });
        backBtn.addEventListener("mouseleave", () => {
          backBtn.style.background = "none";
        });
        backBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onBack) onBack();
        });
      }
    }
    const closeBtn = container.querySelector(".claw-close-panel");
    if (closeBtn) {
      closeBtn.addEventListener("mouseenter", () => {
        closeBtn.style.background = "#f0f0f0";
      });
      closeBtn.addEventListener("mouseleave", () => {
        closeBtn.style.background = "none";
      });
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        restoreOriginalPanel();
      });
    }
  }
  function openCustomPanel(title, contentHtml, options = {}) {
    const platform = getCurrentPlatform();
    if (!platform) return;
    const panelConfig = getPanelConfig(platform);
    if (!panelConfig) return;
    const { showBack = false, onBack = null } = options;
    const headerHtml = buildPanelHeader(title, showBack, onBack);
    const panelHtml = `
    <div class="claw-custom-panel" style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
    ">
      ${headerHtml}
      <div class="claw-custom-panel-body" style="
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      ">
        ${contentHtml}
      </div>
    </div>
  `;
    if (panelConfig.type === "sidebar") {
      const container = document.querySelector(panelConfig.containerSelector);
      if (!container) return;
      if (!originalPanelContent) {
        originalPanelContent = container.innerHTML;
      }
      container.innerHTML = panelHtml;
      bindPanelEvents(container, showBack, onBack);
      isCustomPanelOpen = true;
      setPanelOpen(true);
    } else if (panelConfig.type === "overlay") {
      createOverlayPanel(panelHtml, panelConfig.overlayConfig);
      bindPanelEvents(currentOverlayPanel, showBack, onBack);
      isCustomPanelOpen = true;
      setPanelOpen(true);
    }
  }
  function createOverlayPanel(panelHtml, overlayConfig) {
    if (currentOverlayPanel) {
      currentOverlayPanel.remove();
      currentOverlayPanel = null;
    }
    document.querySelectorAll(".claw-overlay-backdrop").forEach((b) => b.remove());
    let backdrop = null;
    if (overlayConfig.backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "claw-overlay-backdrop";
      backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
      backdrop.addEventListener("click", restoreOriginalPanel);
      document.body.appendChild(backdrop);
    }
    const overlay = document.createElement("div");
    overlay.className = "claw-overlay-panel";
    const position = overlayConfig.position || "right";
    const width = overlayConfig.width || "400px";
    let positionStyles = "";
    if (position === "right") {
      positionStyles = `
      top: 0;
      right: 0;
      bottom: 0;
      width: ${width};
      transform: translateX(100%);
    `;
    } else if (position === "left") {
      positionStyles = `
      top: 0;
      left: 0;
      bottom: 0;
      width: ${width};
      transform: translateX(-100%);
    `;
    } else if (position === "center") {
      positionStyles = `
      top: 50%;
      left: 50%;
      width: ${width};
      max-height: 80vh;
      transform: translate(-50%, -50%) scale(0.9);
      border-radius: 12px;
    `;
    }
    overlay.style.cssText = `
    position: fixed;
    ${positionStyles}
    background: #fff;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s ease;
    overflow: hidden;
  `;
    overlay.innerHTML = panelHtml;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      if (position === "right" || position === "left") {
        overlay.style.transform = "translateX(0)";
      } else if (position === "center") {
        overlay.style.transform = "translate(-50%, -50%) scale(1)";
      }
    });
    currentOverlayPanel = overlay;
  }
  function restoreOriginalPanel() {
    var _a;
    const platform = getCurrentPlatform();
    if (!platform) return;
    const panelConfig = getPanelConfig(platform);
    if (!panelConfig) return;
    if (panelConfig.type === "sidebar") {
      const container = document.querySelector(panelConfig.containerSelector);
      if (container && originalPanelContent) {
        container.innerHTML = originalPanelContent;
        isCustomPanelOpen = false;
        setPanelOpen(false);
        console.log("Claw Extension: Sidebar panel restored");
      }
    } else if (panelConfig.type === "overlay") {
      if (currentOverlayPanel) {
        const position = ((_a = panelConfig.overlayConfig) == null ? void 0 : _a.position) || "right";
        if (position === "right") {
          currentOverlayPanel.style.transform = "translateX(100%)";
        } else if (position === "left") {
          currentOverlayPanel.style.transform = "translateX(-100%)";
        } else if (position === "center") {
          currentOverlayPanel.style.transform = "translate(-50%, -50%) scale(0.9)";
          currentOverlayPanel.style.opacity = "0";
        }
        setTimeout(() => {
          if (currentOverlayPanel) {
            currentOverlayPanel.remove();
            currentOverlayPanel = null;
          }
        }, 300);
      }
      document.querySelectorAll(".claw-overlay-backdrop").forEach((b) => {
        b.style.opacity = "0";
        setTimeout(() => b.remove(), 300);
      });
      isCustomPanelOpen = false;
      setPanelOpen(false);
      console.log("Claw Extension: Overlay panel closed");
    }
  }
  function getPanelBodyElement() {
    const container = getPanelContainer();
    return (container == null ? void 0 : container.querySelector(".claw-custom-panel-body")) || null;
  }

  // src/panels/resource/index.js
  function getResourceContent() {
    return `
    <div style="color: #666;">
      <p style="margin-bottom: 12px;">\u{1F4C1} \u8D44\u6E90\u7BA1\u7406\u9762\u677F</p>
      <div style="
        border: 1px dashed #ccc;
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        color: #999;
      ">
        <p>\u62D6\u62FD\u6587\u4EF6\u5230\u6B64\u5904\u4E0A\u4F20</p>
        <p style="font-size: 12px; margin-top: 8px;">\u652F\u6301 PDF, DOC, TXT, MD \u7B49\u683C\u5F0F</p>
      </div>
      <div style="margin-top: 16px;">
        <p style="font-weight: 500; margin-bottom: 8px; color: #333;">\u5DF2\u4E0A\u4F20\u8D44\u6E90</p>
        <div style="
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 13px;
          color: #999;
        ">\u6682\u65E0\u8D44\u6E90</div>
      </div>
    </div>
  `;
  }

  // src/services/config.js
  var DEFAULT_OPENVIKING_CONFIG = {
    baseUrl: "http://127.0.0.1:1933",
    apiKey: "",
    agentId: "echomem-extension",
    accountId: "",
    userId: ""
  };
  var DEFAULT_COMPLETION_CONFIG = {
    phraseScoreThreshold: 0.2
  };
  async function getOpenVikingConfig() {
    try {
      const result = await chrome.storage.local.get("openvikingConfig");
      return { ...DEFAULT_OPENVIKING_CONFIG, ...result.openvikingConfig || {} };
    } catch {
      return { ...DEFAULT_OPENVIKING_CONFIG };
    }
  }
  async function setOpenVikingConfig(config) {
    await chrome.storage.local.set({ openvikingConfig: config });
  }
  async function getCompletionConfig() {
    try {
      const result = await chrome.storage.local.get("completionConfig");
      return { ...DEFAULT_COMPLETION_CONFIG, ...result.completionConfig || {} };
    } catch {
      return { ...DEFAULT_COMPLETION_CONFIG };
    }
  }
  async function setCompletionConfig(config) {
    await chrome.storage.local.set({ completionConfig: config });
  }

  // src/services/openviking-client.js
  var DEFAULT_CONFIG = {
    baseUrl: "http://127.0.0.1:1933",
    apiKey: "",
    agentId: "echomem-extension",
    accountId: "",
    userId: "",
    timeoutMs: 5e3
  };
  var OpenVikingClient = class {
    constructor(config = {}) {
      this.cfg = { ...DEFAULT_CONFIG, ...config };
    }
    async find(query, options = {}) {
      var _a;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      try {
        const headers = { "Content-Type": "application/json" };
        if (this.cfg.apiKey) {
          headers["X-API-Key"] = this.cfg.apiKey;
        }
        if (this.cfg.accountId) {
          headers["X-OpenViking-Account"] = this.cfg.accountId;
        }
        if (this.cfg.userId) {
          headers["X-OpenViking-User"] = this.cfg.userId;
        }
        if (this.cfg.agentId) {
          headers["X-OpenViking-Agent"] = this.cfg.agentId;
        }
        const response = await fetch(`${this.cfg.baseUrl}/api/v1/search/find`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query,
            target_uri: options.targetUri || "viking://user/memories",
            limit: options.limit || 5,
            score_threshold: options.scoreThreshold || 0
          }),
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status === "error") {
          throw new Error(((_a = data.error) == null ? void 0 : _a.message) || `HTTP ${response.status}`);
        }
        return data.result || data;
      } finally {
        clearTimeout(timer);
      }
    }
    async healthCheck() {
      const response = await fetch(`${this.cfg.baseUrl}/health`, {
        method: "GET"
      });
      return response.ok;
    }
  };
  function createClient(config) {
    return new OpenVikingClient(config);
  }

  // src/utils/text-processor.js
  var STOP_WORDS = /* @__PURE__ */ new Set([
    // 中文停用词
    "\u7684",
    "\u4E86",
    "\u662F",
    "\u5728",
    "\u6211",
    "\u6709",
    "\u548C",
    "\u5C31",
    "\u4E0D",
    "\u4EBA",
    "\u90FD",
    "\u4E00",
    "\u4E00\u4E2A",
    "\u4E0A",
    "\u4E5F",
    "\u5F88",
    "\u5230",
    "\u8BF4",
    "\u8981",
    "\u53BB",
    "\u4F60",
    "\u4F1A",
    "\u7740",
    "\u6CA1\u6709",
    "\u770B",
    "\u597D",
    "\u81EA\u5DF1",
    "\u8FD9",
    "\u90A3",
    "\u4E2D",
    "\u4E3A",
    "\u6765",
    "\u4E2A",
    "\u4EE5",
    "\u5927",
    "\u5730",
    "\u5230",
    "\u53CA",
    "\u4E0E",
    "\u6216",
    "\u7B49",
    "\u4E4B",
    "\u800C",
    "\u53EF\u4EE5",
    "\u8FD9\u4E2A",
    "\u90A3\u4E2A",
    "\u4EC0\u4E48",
    "\u600E\u4E48",
    "\u5982\u4F55",
    "\u8FD8\u662F",
    "\u4F46\u662F",
    "\u56E0\u4E3A",
    "\u6240\u4EE5",
    // 英文停用词
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "his",
    "its",
    "our",
    "their",
    "this",
    "that",
    "these",
    "those",
    "and",
    "or",
    "but",
    "if",
    "then",
    "else",
    "when",
    "where",
    "why",
    "how",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "can",
    "just",
    "should",
    "now",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "from",
    "by",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once"
  ]);
  function tokenize(text) {
    if (!text || typeof text !== "string") return [];
    const tokens = [];
    const regex = /[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]{2,}/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push(match[0].toLowerCase());
    }
    return tokens;
  }
  function filterStopWords(tokens) {
    return tokens.filter((w) => !STOP_WORDS.has(w));
  }
  function tokenizeAndFilter(text) {
    return filterStopWords(tokenize(text));
  }
  function truncate(text, maxLength = 60) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  }
  function calculateOverlap(inputWords, textWords) {
    if (!inputWords.size || !textWords.size) return 0;
    let exactMatch = 0;
    let partialMatch = 0;
    for (const iw of inputWords) {
      if (textWords.has(iw)) {
        exactMatch += 2;
        continue;
      }
      for (const tw of textWords) {
        if (tw.includes(iw) || iw.includes(tw)) {
          partialMatch += 1;
          break;
        }
      }
    }
    return exactMatch + partialMatch;
  }
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // src/panels/association/suggestions.js
  var MEM_HEADER = "\u5F53\u524D\u6211\u7684\u76F8\u5173\u8BB0\u5FC6\u5982\u4E0B\uFF1A";
  var selectedIndex = -1;
  var currentSuggestions = [];
  var checkedKeys = /* @__PURE__ */ new Set();
  var currentInputElement = null;
  var keyboardBound = false;
  var collapsed = false;
  var suppressBlurClose = false;
  var committedItems = /* @__PURE__ */ new Map();
  function getItemKey(c, i) {
    return c.sourceUri || c.insertText || `idx-${i}`;
  }
  function renderCompletions(inputElement, completions) {
    currentSuggestions = completions;
    currentInputElement = inputElement;
    selectedIndex = completions.length > 0 ? 0 : -1;
    checkedKeys = /* @__PURE__ */ new Set();
    const container = getOrCreateContainer();
    if (!completions.length) {
      hideSuggestions();
      return;
    }
    container.innerHTML = buildContainerHtml(completions);
    container.style.display = "block";
    positionContainer(container, inputElement);
    bindContainerEvents(container, inputElement);
    bindOutsideClick(container);
  }
  function bindOutsideClick(container) {
    if (container._outsideClickHandler) {
      document.removeEventListener("mousedown", container._outsideClickHandler);
      container._outsideClickHandler = null;
    }
    const handler = (e) => {
      if (!container.contains(e.target)) {
        hideSuggestions();
        document.removeEventListener("mousedown", handler);
        container._outsideClickHandler = null;
      }
    };
    setTimeout(() => {
      document.addEventListener("mousedown", handler);
      container._outsideClickHandler = handler;
    }, 0);
  }
  function buildContainerHtml(completions) {
    const headerHtml = `
    <div class="echomem-suggestion-header">
      <label class="echomem-suggestion-select-all">
        <input type="checkbox" class="echomem-suggestion-check-all" />
        <span>\u5168\u9009</span>
      </label>
      <span class="echomem-suggestion-title">\u76F8\u5173\u8BB0\u5FC6 (${completions.length})</span>
      <button type="button" class="echomem-suggestion-toggle" title="${collapsed ? "\u5C55\u5F00" : "\u6298\u53E0"}">
        ${collapsed ? "\u25B8" : "\u25BE"}
      </button>
    </div>
  `;
    const itemsHtml = completions.map((c, i) => {
      const isActive = i === selectedIndex;
      const key = getItemKey(c, i);
      const sourceBadge = c.source === "memory" ? '<span class="echomem-source-badge memory">\u8BB0\u5FC6</span>' : '<span class="echomem-source-badge session">\u4F1A\u8BDD</span>';
      return `
      <div class="echomem-suggestion-item ${isActive ? "echomem-suggestion-active" : ""}"
           data-index="${i}"
           data-key="${escapeHtml(key)}">
        <input type="checkbox" class="echomem-suggestion-check" tabindex="-1" />
        <span class="suggestion-text">${escapeHtml(c.displayText || "")}</span>
        <div class="suggestion-meta">
          ${sourceBadge}
          <span class="suggestion-score">${(c.score || 0).toFixed(2)}</span>
        </div>
      </div>
    `;
    }).join("");
    const bodyHtml = `
    <div class="echomem-suggestion-list" style="${collapsed ? "display:none;" : ""}">
      ${itemsHtml}
    </div>
  `;
    const actionsHtml = `
    <div class="echomem-suggestion-actions" style="${collapsed ? "display:none;" : ""}">
      <button type="button" class="echomem-btn-cancel">\u53D6\u6D88</button>
      <button type="button" class="echomem-btn-confirm" disabled>\u786E\u5B9A (0)</button>
    </div>
  `;
    return headerHtml + bodyHtml + actionsHtml;
  }
  function bindContainerEvents(container, inputElement) {
    container.addEventListener("mousedown", (e) => {
      suppressBlurClose = true;
      setTimeout(() => {
        suppressBlurClose = false;
      }, 50);
      const target = e.target;
      const isInteractive = target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("label");
      if (!isInteractive) {
        e.preventDefault();
      }
    });
    container.querySelectorAll(".echomem-suggestion-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const key = item.dataset.key;
        const checkbox = item.querySelector(".echomem-suggestion-check");
        if (e.target === checkbox) {
          if (checkbox.checked) {
            checkedKeys.add(key);
          } else {
            checkedKeys.delete(key);
          }
        } else {
          toggleKey(key);
        }
        syncUi(container);
      });
      item.addEventListener("mouseenter", () => {
        selectedIndex = Number(item.dataset.index);
        updateHighlight(container);
      });
    });
    const checkAll = container.querySelector(".echomem-suggestion-check-all");
    checkAll.addEventListener("click", (e) => {
      e.stopPropagation();
      const allKeys = currentSuggestions.map((c, i) => getItemKey(c, i));
      if (e.target.checked) {
        checkedKeys = new Set(allKeys);
      } else {
        checkedKeys = /* @__PURE__ */ new Set();
      }
      syncUi(container);
    });
    const toggleBtn = container.querySelector(".echomem-suggestion-toggle");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      collapsed = !collapsed;
      const list = container.querySelector(".echomem-suggestion-list");
      const actions = container.querySelector(".echomem-suggestion-actions");
      if (list) list.style.display = collapsed ? "none" : "";
      if (actions) actions.style.display = collapsed ? "none" : "";
      toggleBtn.textContent = collapsed ? "\u25B8" : "\u25BE";
      toggleBtn.title = collapsed ? "\u5C55\u5F00" : "\u6298\u53E0";
      positionContainer(container, inputElement);
    });
    container.querySelector(".echomem-btn-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      hideSuggestions();
    });
    container.querySelector(".echomem-btn-confirm").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!checkedKeys.size) return;
      const selected = [];
      currentSuggestions.forEach((c, i) => {
        const key = getItemKey(c, i);
        if (checkedKeys.has(key)) {
          selected.push({ key, item: c });
        }
      });
      if (!selected.length) return;
      composeAndInsert(currentInputElement, currentInputElement.value || "", selected);
      hideSuggestions();
    });
  }
  function toggleKey(key) {
    if (checkedKeys.has(key)) {
      checkedKeys.delete(key);
    } else {
      checkedKeys.add(key);
    }
  }
  function syncUi(container) {
    container.querySelectorAll(".echomem-suggestion-item").forEach((item) => {
      const key = item.dataset.key;
      const checkbox = item.querySelector(".echomem-suggestion-check");
      const checked = checkedKeys.has(key);
      if (checkbox) checkbox.checked = checked;
      item.classList.toggle("echomem-suggestion-checked", checked);
    });
    const allKeys = currentSuggestions.map((c, i) => getItemKey(c, i));
    const allChecked = allKeys.length > 0 && allKeys.every((k) => checkedKeys.has(k));
    const someChecked = allKeys.some((k) => checkedKeys.has(k));
    const checkAll = container.querySelector(".echomem-suggestion-check-all");
    if (checkAll) {
      checkAll.checked = allChecked;
      checkAll.indeterminate = !allChecked && someChecked;
    }
    const confirmBtn = container.querySelector(".echomem-btn-confirm");
    if (confirmBtn) {
      const n = checkedKeys.size;
      confirmBtn.textContent = `\u786E\u5B9A (${n})`;
      confirmBtn.disabled = n === 0;
    }
    updateHighlight(container);
  }
  function updateHighlight(container) {
    const items = container.querySelectorAll(".echomem-suggestion-item");
    items.forEach((item, i) => {
      if (i === selectedIndex) {
        item.classList.add("echomem-suggestion-active");
      } else {
        item.classList.remove("echomem-suggestion-active");
      }
    });
  }
  function formatItem(it) {
    return (it.insertText || "").trim().replace(/\s+/g, " ");
  }
  function stripMemoryBlock(userText) {
    const text = userText || "";
    const headerCount = (text.match(new RegExp(MEM_HEADER, "g")) || []).length;
    if (headerCount === 0) {
      committedItems.clear();
      return text.replace(/\s+$/, "");
    }
    if (headerCount > 1) {
      committedItems.clear();
      const idx2 = text.indexOf(MEM_HEADER);
      return idx2 !== -1 ? text.slice(0, idx2).replace(/\s+$/, "") : text.replace(/\s+$/, "");
    }
    const idx = text.lastIndexOf(MEM_HEADER);
    return idx !== -1 ? text.slice(0, idx).replace(/\s+$/, "") : text.replace(/\s+$/, "");
  }
  function composeAndInsert(textarea, userText, selected) {
    if (!textarea) return;
    const basePart = stripMemoryBlock(userText);
    for (const { key, item } of selected) {
      if (committedItems.has(key)) continue;
      const body = formatItem(item);
      if (!body) continue;
      committedItems.set(key, body);
    }
    const bodies = Array.from(committedItems.values());
    if (!bodies.length) return;
    const lines = bodies.map((b, i) => `${i + 1}. ${b}`);
    const prefix = basePart ? `${basePart}

` : "";
    const next = `${prefix}${MEM_HEADER}
${lines.join("\n")}`;
    textarea.value = next;
    try {
      textarea.selectionStart = textarea.selectionEnd = next.length;
    } catch (_) {
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }
  function hideSuggestions() {
    const container = document.getElementById("echomem-suggestions");
    if (container) {
      container.style.display = "none";
    }
    selectedIndex = -1;
    currentSuggestions = [];
    checkedKeys = /* @__PURE__ */ new Set();
  }
  function isSuggestionsVisible() {
    const container = document.getElementById("echomem-suggestions");
    return !!(container && container.style.display !== "none");
  }
  function shouldSuppressBlurClose() {
    return suppressBlurClose;
  }
  function bindKeyboardNavigation(textarea) {
    if (keyboardBound) return;
    keyboardBound = true;
    textarea.addEventListener("keydown", (e) => {
      if (!isSuggestionsVisible()) return;
      const container = document.getElementById("echomem-suggestions");
      if (!container) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
          updateHighlight(container);
          break;
        case "ArrowUp":
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateHighlight(container);
          break;
        case " ":
          if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
            e.preventDefault();
            const key = getItemKey(currentSuggestions[selectedIndex], selectedIndex);
            toggleKey(key);
            syncUi(container);
          }
          break;
        case "Enter":
          if (checkedKeys.size > 0) {
            e.preventDefault();
            const selected = [];
            currentSuggestions.forEach((c, i) => {
              const key = getItemKey(c, i);
              if (checkedKeys.has(key)) {
                selected.push({ key, item: c });
              }
            });
            composeAndInsert(textarea, textarea.value || "", selected);
            hideSuggestions();
          }
          break;
        case "Escape":
          e.preventDefault();
          hideSuggestions();
          break;
      }
    });
  }
  function getOrCreateContainer() {
    let container = document.getElementById("echomem-suggestions");
    if (!container) {
      container = document.createElement("div");
      container.id = "echomem-suggestions";
      container.className = "echomem-suggestions-container";
      document.body.appendChild(container);
    }
    return container;
  }
  function positionContainer(container, inputElement) {
    if (!inputElement) return;
    const rect = inputElement.getBoundingClientRect();
    const prevVisibility = container.style.visibility;
    container.style.visibility = "hidden";
    container.style.display = "block";
    const containerHeight = Math.min(container.offsetHeight || 160, 320);
    container.style.visibility = prevVisibility || "";
    container.style.position = "fixed";
    container.style.left = `${rect.left}px`;
    container.style.top = `${rect.top - containerHeight - 8}px`;
    container.style.width = `${rect.width}px`;
    container.style.zIndex = "999999";
  }

  // src/core/completion-engine.js
  var phraseScoreThreshold = 0.2;
  async function refreshThreshold() {
    const config = await getCompletionConfig();
    phraseScoreThreshold = config.phraseScoreThreshold;
  }
  function extractKeywords(text, userInput, maxKeywords = 3) {
    if (!text) return [];
    const words = tokenizeAndFilter(text);
    const userWords = new Set(tokenize(userInput));
    const freq = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }
    const scored = Object.entries(freq).map(([word, count]) => ({
      word,
      score: count * (userWords.has(word) ? 3 : 1)
    }));
    return scored.sort((a, b) => b.score - a.score).slice(0, maxKeywords).map((x) => x.word);
  }
  function extractPhrases(overview, userInput) {
    if (!overview) {
      console.log("EchoMem: extractPhrases overview is empty");
      return [];
    }
    const lines = overview.split("\n");
    const phrases = [];
    const inputWords = new Set(tokenize(userInput));
    console.log("EchoMem: extractPhrases inputWords", [...inputWords], "threshold", phraseScoreThreshold);
    console.log("EchoMem: overview lines count", lines.length);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;
      const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (listMatch) {
        const phrase = listMatch[1].trim();
        const phraseWords = new Set(tokenize(phrase));
        const score = calculatePhraseScore(inputWords, phraseWords, phrase);
        console.log("EchoMem: list item", phrase.slice(0, 40), "score", score, "threshold", phraseScoreThreshold);
        if (score > phraseScoreThreshold) {
          phrases.push({ phrase, score, type: "bullet" });
        }
        continue;
      }
      const quoteMatch = trimmed.match(/^[""'](.+)[""']\s*\(/);
      if (quoteMatch) {
        const phrase = quoteMatch[1].trim();
        const phraseWords = new Set(tokenize(phrase));
        const score = calculatePhraseScore(inputWords, phraseWords, phrase);
        console.log("EchoMem: quote", phrase.slice(0, 40), "score", score);
        if (score > phraseScoreThreshold) {
          phrases.push({ phrase, score, type: "quote" });
        }
        continue;
      }
      if (!trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.startsWith("*")) {
        const phraseWords = new Set(tokenize(trimmed));
        const score = calculatePhraseScore(inputWords, phraseWords, trimmed);
        console.log("EchoMem: text line", trimmed.slice(0, 40), "score", score, "threshold", phraseScoreThreshold + 0.25);
        if (score > phraseScoreThreshold + 0.25) {
          phrases.push({ phrase: trimmed, score, type: "text" });
        }
      }
    }
    console.log("EchoMem: extractPhrases result", phrases.length, "phrases");
    return phrases.sort((a, b) => b.score - a.score).slice(0, 3);
  }
  function calculatePhraseScore(inputWords, phraseWords, phrase) {
    if (!inputWords.size || !phraseWords.size) return 0;
    const overlap = calculateOverlap(inputWords, phraseWords);
    const intersection = new Set([...inputWords].filter((x) => phraseWords.has(x))).size;
    const union = (/* @__PURE__ */ new Set([...inputWords, ...phraseWords])).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const lengthPenalty = Math.min(phrase.length / 150, 1);
    return (jaccard * 0.4 + overlap / (inputWords.size * 2) * 0.6) * (1 - lengthPenalty * 0.15);
  }
  function buildSuggestion(userInput, memory) {
    var _a, _b;
    const inputTrimmed = userInput.trim();
    if (((_a = memory == null ? void 0 : memory.phrases) == null ? void 0 : _a.length) > 0) {
      const bestPhrase = memory.phrases[0];
      return {
        type: "phrase",
        displayText: `...${truncate(bestPhrase.phrase, 40)}`,
        insertText: bestPhrase.phrase,
        source: "memory",
        sourceUri: memory.uri || "",
        score: (memory.score || 0.5) * 0.7 + bestPhrase.score * 0.3,
        fullText: memory.abstract || bestPhrase.phrase
      };
    }
    if (((_b = memory == null ? void 0 : memory.keywords) == null ? void 0 : _b.length) > 0) {
      const continuation = memory.keywords.join("\u3001");
      return {
        type: "keyword",
        displayText: `...${truncate(continuation, 40)}`,
        insertText: continuation,
        source: "memory",
        sourceUri: memory.uri || "",
        score: memory.score || 0.5,
        fullText: memory.abstract || ""
      };
    }
    return null;
  }
  function processMemories(userInput, memories) {
    const suggestions = [];
    for (const memory of memories.slice(0, 5)) {
      const semanticScore = memory.score || 0;
      if (semanticScore < phraseScoreThreshold) {
        console.log("EchoMem: memory filtered out by semantic score", semanticScore, "<", phraseScoreThreshold, memory.uri);
        continue;
      }
      const sourceText = memory.overview || memory.abstract || "";
      const phrases = extractPhrases(sourceText, userInput);
      console.log("EchoMem: memory", memory.uri, "semanticScore", semanticScore, "phrases", phrases.length);
      const keywords = extractKeywords(memory.abstract || "", userInput, 3);
      const enrichedMemory = { ...memory, phrases, keywords };
      const suggestion = buildSuggestion(userInput, enrichedMemory);
      if (suggestion) {
        suggestions.push(suggestion);
      } else {
        console.log("EchoMem: no suggestion generated for", memory.uri);
      }
    }
    return suggestions;
  }
  function rankAndDeduplicate(suggestions, maxResults = 3) {
    suggestions.sort((a, b) => b.score - a.score);
    const seen = /* @__PURE__ */ new Set();
    const unique = [];
    for (const s of suggestions) {
      const key = s.insertText.slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    return unique.slice(0, maxResults);
  }
  async function generateCompletions(userInput, memories, maxResults = 3) {
    if (!userInput || !(memories == null ? void 0 : memories.length)) {
      return [];
    }
    await refreshThreshold();
    console.log("EchoMem: phraseScoreThreshold =", phraseScoreThreshold);
    const suggestions = processMemories(userInput, memories);
    console.log("EchoMem: raw suggestions =", suggestions.map((s) => ({ type: s.type, score: s.score, display: s.displayText })));
    return rankAndDeduplicate(suggestions, maxResults);
  }

  // src/core/input-tracker.js
  var client = null;
  var debounceTimer = null;
  var trackingPlatformConfig = null;
  var keyboardNavBound = false;
  async function getClient() {
    if (!client) {
      const config = await getOpenVikingConfig();
      client = createClient(config);
    }
    return client;
  }
  function resetClient() {
    client = null;
  }
  function startInputTracking(platformConfig) {
    trackingPlatformConfig = platformConfig;
    tryBindInputElement();
  }
  function tryBindInputElement() {
    if (!trackingPlatformConfig) return;
    const textarea = findInputElement(trackingPlatformConfig);
    if (!textarea) {
      console.log("EchoMem: input element not found, will retry on next DOM change");
      return;
    }
    if (textarea.dataset.echomemTracking) return;
    textarea.dataset.echomemTracking = "true";
    console.log("EchoMem: input tracking started on", textarea);
    if (!keyboardNavBound) {
      bindKeyboardNavigation(textarea);
      keyboardNavBound = true;
    }
    textarea.addEventListener("input", (e) => {
      if (!getAssociationEnabled()) {
        hideSuggestions();
        return;
      }
      if (!e.isTrusted) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const text = e.target.value.trim();
        if (text.length >= 3) {
          try {
            await handleInput(textarea, text);
          } catch (err) {
            console.warn("EchoMem: recall failed", err);
            hideSuggestions();
          }
        } else {
          hideSuggestions();
        }
      }, 300);
    });
    textarea.addEventListener("blur", () => {
      setTimeout(() => {
        if (shouldSuppressBlurClose()) return;
        const active = document.activeElement;
        const container = document.getElementById("echomem-suggestions");
        if (container && active && container.contains(active)) return;
        hideSuggestions();
      }, 200);
    });
  }
  async function handleInput(textarea, userInput) {
    let memories = [];
    try {
      const ovClient = await getClient();
      console.log("EchoMem: recall triggered, query=", userInput);
      const result = await ovClient.find(userInput, { limit: 5 });
      memories = result.memories || [];
      console.log("EchoMem: found", memories.length, "memories");
      if (memories.length > 0) {
        console.log("EchoMem: first memory keys", Object.keys(memories[0]));
        console.log("EchoMem: first memory overview", memories[0].overview ? "present" : "missing");
      }
    } catch (err) {
      console.warn("EchoMem: OpenViking recall failed", err);
      hideSuggestions();
      return;
    }
    if (!memories.length) {
      hideSuggestions();
      return;
    }
    const completions = await generateCompletions(userInput, memories, 3);
    console.log("EchoMem: generated", completions.length, "completions");
    if (completions.length > 0) {
      renderCompletions(textarea, completions);
    } else {
      hideSuggestions();
    }
  }
  function findInputElement(platformConfig) {
    var _a, _b;
    const selector = (_b = (_a = platformConfig.launcher) == null ? void 0 : _a.validateSelectors) == null ? void 0 : _b.textarea;
    if (!selector) return null;
    return document.querySelector(selector);
  }

  // src/panels/association/index.js
  function getInputAssociationContent() {
    const inputAssociationEnabled = getAssociationEnabled();
    const btnText = inputAssociationEnabled ? "\u5173\u95ED\u8054\u60F3" : "\u786E\u8BA4\u5F00\u542F";
    const btnBg = inputAssociationEnabled ? "#ffebee" : "#667eea";
    const btnColor = inputAssociationEnabled ? "#c62828" : "#fff";
    const statusText = inputAssociationEnabled ? "\u2705 \u8F93\u5165\u8054\u60F3\u5DF2\u5F00\u542F" : "\u274C \u8F93\u5165\u8054\u60F3\u672A\u5F00\u542F";
    const statusColor = inputAssociationEnabled ? "#2e7d32" : "#888";
    return `
    <div style="color: #666;">
      <div style="margin-bottom: 20px;">
        <button id="claw-toggle-association" style="
          width: 100%;
          padding: 12px;
          background: ${btnBg};
          color: ${btnColor};
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        "
        >${btnText}</button>
      </div>
      <div style="
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
      ">
        <p id="claw-association-status" style="
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: ${statusColor};
        ">${statusText}</p>
      </div>
      <div style="margin-bottom: 16px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">\u{1F4A1} \u529F\u80FD\u8BF4\u660E</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8; margin: 0;">
          <li>\u5386\u53F2\u8BB0\u5FC6\u53EC\u56DE\uFF1A\u6839\u636E\u8F93\u5165\u5B9E\u65F6\u53EC\u56DE OpenViking \u4E2D\u7684\u76F8\u5173\u8BB0\u5FC6</li>
          <li>\u8BED\u4E49\u641C\u7D22\uFF1A\u652F\u6301\u8FD1\u4E49\u8BCD\u548C\u8BED\u4E49\u76F8\u5173\u5185\u5BB9\u7684\u53EC\u56DE</li>
          <li>\u70B9\u51FB\u63D2\u5165\uFF1A\u70B9\u51FB\u5EFA\u8BAE\u5FEB\u901F\u63D2\u5165\u5230\u8F93\u5165\u6846</li>
        </ul>
      </div>
      <div id="echomem-ov-config" style="display: none;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">\u2699\uFE0F OpenViking \u914D\u7F6E</p>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">\u670D\u52A1\u5730\u5740</label>
          <input id="ov-base-url" type="text" value="http://127.0.0.1:1933"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">API Key\uFF08\u53EF\u9009\uFF09</label>
          <input id="ov-api-key" type="password" value=""
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">Agent ID</label>
          <input id="ov-agent-id" type="text" value="echomem-extension"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <p style="font-weight: 600; color: #333; margin: 16px 0 10px; font-size: 14px;">\u{1F9E0} \u8865\u5168\u7B97\u6CD5\u914D\u7F6E</p>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">
            \u77ED\u8BED\u8FC7\u6EE4\u9608\u503C
            <span style="color: #bbb; font-size: 11px;">\uFF08\u8D8A\u5C0F\u663E\u793A\u8D8A\u591A\uFF0C\u8D8A\u5927\u8D8A\u4E25\u683C\uFF09</span>
          </label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input id="completion-threshold" type="range" min="0.2" max="0.8" step="0.01" value="0.2"
              style="flex: 1; cursor: pointer;"
            />
            <input id="completion-threshold-number" type="number" min="0.2" max="0.8" step="0.01" value="0.2"
              style="width: 60px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; text-align: center;"
            />
          </div>
        </div>

        <button id="ov-save-config" style="
          width: 100%;
          padding: 10px;
          background: #667eea;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        ">\u4FDD\u5B58\u914D\u7F6E</button>
      </div>
      <div style="margin-top: 12px; text-align: center;">
        <a id="echomem-toggle-config" href="#" style="font-size: 12px; color: #667eea; text-decoration: none;">\u663E\u793A\u9AD8\u7EA7\u914D\u7F6E</a>
      </div>
      <div style="
        padding: 12px;
        background: #f0f7ff;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #667eea;
        color: #666;
        margin-top: 12px;
      ">
        \u{1F4A1} \u63D0\u793A\uFF1A\u8F93\u5165\u65F6\u81EA\u52A8\u53EC\u56DE\u76F8\u5173\u8BB0\u5FC6\uFF0C\u70B9\u51FB\u5EFA\u8BAE\u5373\u53EF\u63D2\u5165
      </div>
    </div>
  `;
  }
  function toggleInputAssociation() {
    return toggleAssociationEnabled();
  }
  function bindToggleButton(callback) {
    const toggleBtn = document.getElementById("claw-toggle-association");
    if (toggleBtn && !toggleBtn.dataset.clawBound) {
      toggleBtn.dataset.clawBound = "true";
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (callback) callback();
      });
    }
  }
  function bindConfigUI() {
    const toggleLink = document.getElementById("echomem-toggle-config");
    const configDiv = document.getElementById("echomem-ov-config");
    if (toggleLink && configDiv && !toggleLink.dataset.bound) {
      toggleLink.dataset.bound = "true";
      toggleLink.addEventListener("click", (e) => {
        e.preventDefault();
        const isHidden = configDiv.style.display === "none";
        configDiv.style.display = isHidden ? "block" : "none";
        toggleLink.textContent = isHidden ? "\u9690\u85CF\u9AD8\u7EA7\u914D\u7F6E" : "\u663E\u793A\u9AD8\u7EA7\u914D\u7F6E";
      });
    }
    const thresholdInput = document.getElementById("completion-threshold");
    const thresholdNumber = document.getElementById("completion-threshold-number");
    if (thresholdInput && thresholdNumber && !thresholdInput.dataset.bound) {
      thresholdInput.dataset.bound = "true";
      thresholdInput.addEventListener("input", () => {
        thresholdNumber.value = thresholdInput.value;
      });
      thresholdNumber.addEventListener("input", () => {
        let val = parseFloat(thresholdNumber.value);
        if (isNaN(val)) return;
        if (val < 0.2) val = 0.2;
        if (val > 0.8) val = 0.8;
        thresholdInput.value = val;
      });
    }
    const saveBtn = document.getElementById("ov-save-config");
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "true";
      saveBtn.addEventListener("click", async (e) => {
        var _a, _b, _c, _d, _e, _f, _g;
        e.preventDefault();
        e.stopPropagation();
        const baseUrl = (_b = (_a = document.getElementById("ov-base-url")) == null ? void 0 : _a.value) == null ? void 0 : _b.trim();
        const apiKey = (_d = (_c = document.getElementById("ov-api-key")) == null ? void 0 : _c.value) == null ? void 0 : _d.trim();
        const agentId = (_f = (_e = document.getElementById("ov-agent-id")) == null ? void 0 : _e.value) == null ? void 0 : _f.trim();
        const phraseScoreThreshold2 = parseFloat(((_g = document.getElementById("completion-threshold")) == null ? void 0 : _g.value) || "0.2");
        await setOpenVikingConfig({ baseUrl, apiKey, agentId });
        await setCompletionConfig({ phraseScoreThreshold: phraseScoreThreshold2 });
        resetClient();
        alert("\u914D\u7F6E\u5DF2\u4FDD\u5B58");
      });
    }
  }
  async function loadConfigValues() {
    const ovConfig = await getOpenVikingConfig();
    const completionConfig = await getCompletionConfig();
    const baseUrlInput = document.getElementById("ov-base-url");
    const apiKeyInput = document.getElementById("ov-api-key");
    const agentIdInput = document.getElementById("ov-agent-id");
    const thresholdInput = document.getElementById("completion-threshold");
    const thresholdNumber = document.getElementById("completion-threshold-number");
    if (baseUrlInput) baseUrlInput.value = ovConfig.baseUrl;
    if (apiKeyInput) apiKeyInput.value = ovConfig.apiKey;
    if (agentIdInput) agentIdInput.value = ovConfig.agentId;
    if (thresholdInput) thresholdInput.value = completionConfig.phraseScoreThreshold;
    if (thresholdNumber) thresholdNumber.value = completionConfig.phraseScoreThreshold;
  }

  // src/panels/feedback/index.js
  function getFeedbackContent() {
    return `
    <div style="color: #666;">
      <p style="margin-bottom: 12px;">\u{1F9E0} \u8BA4\u77E5\u53CD\u9988\u9762\u677F</p>
      <div style="
        padding: 16px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 12px;
      ">
        <p style="font-weight: 500; color: #333; margin-bottom: 8px;">\u5F53\u524D\u4F1A\u8BDD\u5206\u6790</p>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span>\u5BF9\u8BDD\u8F6E\u6B21</span>
          <span style="color: #333; font-weight: 500;">0</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span>\u5E73\u5747\u54CD\u5E94\u65F6\u95F4</span>
          <span style="color: #333; font-weight: 500;">--</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
          <span>Token \u6D88\u8017</span>
          <span style="color: #333; font-weight: 500;">0</span>
        </div>
      </div>
      <button style="
        width: 100%;
        padding: 10px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">\u751F\u6210\u53CD\u9988\u62A5\u544A</button>
    </div>
  `;
  }

  // src/panels/performance/index.js
  function getPerformanceContent() {
    const metrics = [
      { label: "\u4ECA\u65E5\u4F1A\u8BDD", value: "0" },
      { label: "Skill \u4F7F\u7528", value: "0" },
      { label: "\u8054\u60F3\u89E6\u53D1", value: "0" },
      { label: "\u8D44\u6E90\u5F15\u7528", value: "0" },
      { label: "\u53CD\u9988\u62A5\u544A", value: "0" }
    ];
    const metricCards = metrics.map((metric) => `
    <div style="
      padding: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    ">
      <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280;">${metric.label}</p>
      <p style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">${metric.value}</p>
    </div>
  `).join("");
    return `
    <div style="color: #374151;">
      <p style="margin: 0 0 14px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        \u5F53\u524D\u4E3A\u6548\u80FD\u6982\u89C8\u5360\u4F4D\uFF0C\u540E\u7EED\u53EF\u63A5\u5165\u771F\u5B9E\u4F1A\u8BDD\u3001Skill\u3001\u8054\u60F3\u3001\u8D44\u6E90\u5F15\u7528\u548C\u53CD\u9988\u62A5\u544A\u6570\u636E\u3002
      </p>
      <div style="
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      ">
        ${metricCards}
      </div>
      <div style="
        padding: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
      ">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #111827;">\u6700\u8FD1\u72B6\u6001</p>
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">\u6682\u65E0\u6548\u80FD\u6570\u636E</p>
      </div>
    </div>
  `;
  }

  // src/panels/skill-store/index.js
  function getSkillStoreHomeContent() {
    const sections = [
      { id: "history", title: "\u{1F4DC} \u7528\u6237\u5386\u53F2 Skill", desc: "\u67E5\u770B\u548C\u7BA1\u7406\u4F60\u4F7F\u7528\u8FC7\u7684 Skill", color: "#667eea" },
      { id: "upload", title: "\u2B06\uFE0F \u4E0A\u4F20 Skill \u5230\u5546\u5E97", desc: "\u4E0A\u4F20\u4F60\u7684\u81EA\u5B9A\u4E49 Skill \u5230\u5546\u5E97", color: "#42a5f5" },
      { id: "purchase", title: "\u{1F6D2} \u5546\u5E97 Skill \u8D2D\u4E70", desc: "\u6D4F\u89C8\u548C\u8D2D\u4E70\u5546\u5E97\u4E2D\u7684 Skill", color: "#66bb6a" },
      { id: "merchant", title: "\u{1F3EA} \u5546\u5BB6\u63D0\u4F9B\u7684 Skill", desc: "\u5B98\u65B9\u548C\u8BA4\u8BC1\u5546\u5BB6\u7684 Skill", color: "#ffa726" },
      { id: "manage", title: "\u2699\uFE0F Skill \u5B89\u88C5\u7BA1\u7406", desc: "\u7BA1\u7406\u5DF2\u5B89\u88C5\u7684 Skill", color: "#ef5350" }
    ];
    const cards = sections.map((s) => `
    <div class="claw-skill-section" data-section="${s.id}" style="
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 12px;
    " onmouseenter="this.style.borderColor='${s.color}';this.style.background='#fafafa';this.style.transform='translateX(4px)'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none';this.style.transform='none'"
    >
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: ${s.color}15;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      ">${s.title.split(" ")[0]}</div>
      <div style="flex: 1;">
        <p style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 2px;">${s.title.split(" ").slice(1).join(" ")}</p>
        <p style="font-size: 12px; color: #888;">${s.desc}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `).join("");
    return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cards}
    </div>
  `;
  }
  function getSkillHistoryContent() {
    return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="
          padding: 12px;
          background: #f0f7ff;
          border: 1px solid #c7d8f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <p style="font-weight: 500; color: #333; font-size: 14px;">SQL \u67E5\u8BE2\u52A9\u624B</p>
            <p style="font-size: 12px; color: #888;">\u4E0A\u6B21\u4F7F\u7528: 2\u5929\u524D \xB7 \u4F7F\u7528 15 \u6B21</p>
          </div>
          <span style="padding: 3px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 11px;">\u5DF2\u542F\u7528</span>
        </div>
        <div style="
          padding: 12px;
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <p style="font-weight: 500; color: #333; font-size: 14px;">JSON \u683C\u5F0F\u5316</p>
            <p style="font-size: 12px; color: #888;">\u4E0A\u6B21\u4F7F\u7528: 1\u5468\u524D \xB7 \u4F7F\u7528 8 \u6B21</p>
          </div>
          <span style="padding: 3px 10px; background: #999; color: white; border-radius: 10px; font-size: 11px;">\u5DF2\u505C\u7528</span>
        </div>
        <div style="
          padding: 12px;
          background: #f0f7ff;
          border: 1px solid #c7d8f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <p style="font-weight: 500; color: #333; font-size: 14px;">\u6B63\u5219\u8868\u8FBE\u5F0F\u5DE5\u5177</p>
            <p style="font-size: 12px; color: #888;">\u4E0A\u6B21\u4F7F\u7528: 3\u5929\u524D \xB7 \u4F7F\u7528 23 \u6B21</p>
          </div>
          <span style="padding: 3px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 11px;">\u5DF2\u542F\u7528</span>
        </div>
      </div>
    </div>
  `;
  }
  function getSkillUploadContent() {
    return `
    <div style="color: #666;">
      <div style="
        border: 2px dashed #ccc;
        border-radius: 12px;
        padding: 40px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 20px;
      " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#ccc';this.style.background='none'"
      >
        <p style="font-size: 36px; margin-bottom: 8px;">\u{1F4E4}</p>
        <p style="font-size: 14px; color: #333; font-weight: 500; margin-bottom: 4px;">\u70B9\u51FB\u6216\u62D6\u62FD\u4E0A\u4F20 Skill \u6587\u4EF6</p>
        <p style="font-size: 12px; color: #999;">\u652F\u6301 .skill .json .yaml \u683C\u5F0F\uFF0C\u6700\u5927 10MB</p>
      </div>
      <div style="margin-bottom: 20px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">\u4E0A\u4F20\u987B\u77E5</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8;">
          <li>Skill \u6587\u4EF6\u9700\u5305\u542B\u5B8C\u6574\u7684\u914D\u7F6E\u4FE1\u606F</li>
          <li>\u4E0A\u4F20\u540E\u9700\u8981\u7ECF\u8FC7\u5BA1\u6838\u624D\u80FD\u4E0A\u67B6</li>
          <li>\u7981\u6B62\u4E0A\u4F20\u5305\u542B\u6076\u610F\u4EE3\u7801\u7684 Skill</li>
          <li>\u5BA1\u6838\u901A\u5E38\u9700\u8981 1-3 \u4E2A\u5DE5\u4F5C\u65E5</li>
        </ul>
      </div>
      <div>
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">\u6211\u7684\u4E0A\u4F20\u8BB0\u5F55</p>
        <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 13px; color: #888;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>\u4EE3\u7801\u5BA1\u67E5\u52A9\u624B</span>
            <span style="color: #ffa726;">\u5BA1\u6838\u4E2D</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>API \u6587\u6863\u751F\u6210\u5668</span>
            <span style="color: #ffa726;">\u5BA1\u6838\u4E2D</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>\u65E5\u5FD7\u5206\u6790\u5DE5\u5177</span>
            <span style="color: #66bb6a;">\u5DF2\u901A\u8FC7</span>
          </div>
        </div>
      </div>
    </div>
  `;
  }
  function getSkillPurchaseContent() {
    return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="
          padding: 14px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none'"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">\u{1F4CA}</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">\u6570\u636E\u5206\u6790\u5927\u5E08</p>
              <p style="font-size: 11px; color: #888;">\u2B50 4.8 \xB7 \u5DF2\u552E 1.2k \xB7 \u5F00\u53D1\u8005: DataLab</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">\xA5 9.9</span>
        </div>
        <div style="
          padding: 14px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none'"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #f3e5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">\u{1F4DD}</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">\u667A\u80FD\u5199\u4F5C\u52A9\u624B</p>
              <p style="font-size: 11px; color: #888;">\u2B50 4.6 \xB7 \u5DF2\u552E 856 \xB7 \u5F00\u53D1\u8005: WriteAI</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">\xA5 19.9</span>
        </div>
        <div style="
          padding: 14px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none'"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #e8f5e9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">\u{1F3A8}</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">\u56FE\u50CF\u751F\u6210\u5668</p>
              <p style="font-size: 11px; color: #888;">\u2B50 4.9 \xB7 \u5DF2\u552E 2.3k \xB7 \u5F00\u53D1\u8005: ArtGen</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">\xA5 29.9</span>
        </div>
      </div>
    </div>
  `;
  }
  function getSkillMerchantContent() {
    return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          color: white;
          cursor: pointer;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">\u{1F3E2}</div>
              <p style="font-weight: 600; font-size: 15px;">\u4F01\u4E1A\u7EA7\u77E5\u8BC6\u5E93</p>
            </div>
            <span style="padding: 3px 10px; background: rgba(255,255,255,0.2); border-radius: 10px; font-size: 11px;">\u5B98\u65B9</span>
          </div>
          <p style="font-size: 13px; opacity: 0.9; line-height: 1.5;">\u96C6\u6210\u4F01\u4E1A\u5185\u90E8\u6587\u6863\u3001\u6D41\u7A0B\u3001\u89C4\u8303\u7684\u667A\u80FD\u52A9\u624B\uFF0C\u652F\u6301\u591A\u90E8\u95E8\u534F\u4F5C\u548C\u6743\u9650\u7BA1\u7406\u3002</p>
        </div>
        <div style="
          padding: 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f0f7ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='#f8f9fa'"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">\u{1F4CB}</div>
              <p style="font-weight: 600; color: #333; font-size: 15px;">\u9879\u76EE\u7BA1\u7406\u52A9\u624B</p>
            </div>
            <span style="padding: 3px 10px; background: #e3f2fd; color: #1976d2; border-radius: 10px; font-size: 11px;">\u8BA4\u8BC1\u5546\u5BB6</span>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.5;">\u652F\u6301 Jira\u3001Trello\u3001Notion \u7B49\u9879\u76EE\u7BA1\u7406\u5DE5\u5177\uFF0C\u81EA\u52A8\u751F\u6210\u9879\u76EE\u62A5\u544A\u548C\u8FDB\u5EA6\u8DDF\u8E2A\u3002</p>
        </div>
        <div style="
          padding: 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f0f7ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='#f8f9fa'"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: #fff3e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">\u{1F512}</div>
              <p style="font-weight: 600; color: #333; font-size: 15px;">\u5B89\u5168\u5BA1\u8BA1\u52A9\u624B</p>
            </div>
            <span style="padding: 3px 10px; background: #e3f2fd; color: #1976d2; border-radius: 10px; font-size: 11px;">\u8BA4\u8BC1\u5546\u5BB6</span>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.5;">\u81EA\u52A8\u5316\u5B89\u5168\u6F0F\u6D1E\u626B\u63CF\u548C\u4EE3\u7801\u5BA1\u8BA1\uFF0C\u652F\u6301\u591A\u79CD\u7F16\u7A0B\u8BED\u8A00\u548C\u6846\u67B6\u3002</p>
        </div>
      </div>
    </div>
  `;
  }
  function getSkillManageContent() {
    return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">\u{1F4CA}</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">\u6570\u636E\u5206\u6790\u5927\u5E08</p>
              <p style="font-size: 12px; color: #888;">v2.1.0 \xB7 \u5360\u7528 12MB \xB7 \u4E0A\u6B21\u66F4\u65B0: 3\u5929\u524D</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">\u66F4\u65B0</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">\u5378\u8F7D</button>
          </div>
        </div>
        <div style="
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: #f3e5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">\u{1F4DD}</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">\u667A\u80FD\u5199\u4F5C\u52A9\u624B</p>
              <p style="font-size: 12px; color: #888;">v1.5.2 \xB7 \u5360\u7528 8MB \xB7 \u5DF2\u662F\u6700\u65B0\u7248\u672C</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #e8f5e9; color: #2e7d32; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">\u6700\u65B0</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">\u5378\u8F7D</button>
          </div>
        </div>
        <div style="
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: #fff3e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">\u{1F50D}</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">\u6B63\u5219\u8868\u8FBE\u5F0F\u5DE5\u5177</p>
              <p style="font-size: 12px; color: #888;">v1.0.0 \xB7 \u5360\u7528 3MB \xB7 \u4E0A\u6B21\u66F4\u65B0: 1\u5468\u524D</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">\u66F4\u65B0</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">\u5378\u8F7D</button>
          </div>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
          <span>\u5DF2\u5B89\u88C5: 5 \u4E2A Skill</span>
          <span>\u603B\u5360\u7528: 45MB</span>
        </div>
        <button style="
          width: 100%;
          margin-top: 12px;
          padding: 10px;
          background: #ffebee;
          color: #c62828;
          border: 1px solid #ef9a9a;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        ">\u4E00\u952E\u5378\u8F7D\u5168\u90E8 Skill</button>
      </div>
    </div>
  `;
  }

  // src/panels/registry.js
  var panelRegistry = {
    resources: {
      id: "resources",
      title: "\u8D44\u6E90\u7BA1\u7406",
      description: "\u7BA1\u7406\u6587\u4EF6\u8D44\u6E90\u4E0E\u4E0A\u4F20\u5185\u5BB9",
      render: getResourceContent
    },
    association: {
      id: "association",
      title: "\u8F93\u5165\u8054\u60F3",
      description: "\u5F00\u542F\u6216\u5173\u95ED\u667A\u80FD\u8054\u60F3",
      render: getInputAssociationContent
    },
    feedback: {
      id: "feedback",
      title: "\u8BA4\u77E5\u53CD\u9988",
      description: "\u67E5\u770B\u4F1A\u8BDD\u5206\u6790\u4E0E\u53CD\u9988\u62A5\u544A",
      render: getFeedbackContent
    },
    skillStore: {
      id: "skillStore",
      title: "skill\u5546\u5E97",
      description: "\u6D4F\u89C8\u3001\u4E0A\u4F20\u3001\u5B89\u88C5 Skill",
      render: getSkillStoreHomeContent
    },
    performance: {
      id: "performance",
      title: "\u6548\u80FD",
      description: "\u67E5\u770B\u4F7F\u7528\u6548\u7387\u4E0E\u5DE5\u4F5C\u8868\u73B0",
      render: getPerformanceContent
    }
  };
  var legacyPanelIds = {
    "\u8D44\u6E90\u7BA1\u7406": "resources",
    "\u8F93\u5165\u8054\u60F3": "association",
    "\u8BA4\u77E5\u53CD\u9988": "feedback",
    "skill\u5546\u5E97": "skillStore",
    "\u6548\u80FD": "performance"
  };
  function resolvePanelId(panelIdOrTitle) {
    if (panelRegistry[panelIdOrTitle]) {
      return panelIdOrTitle;
    }
    return legacyPanelIds[panelIdOrTitle] || panelIdOrTitle;
  }
  function getPanelDefinition(panelIdOrTitle) {
    return panelRegistry[resolvePanelId(panelIdOrTitle)] || null;
  }
  function getPanelContent(panelIdOrTitle) {
    const panel = getPanelDefinition(panelIdOrTitle);
    return panel ? panel.render() : "<p>\u6682\u65E0\u5185\u5BB9</p>";
  }

  // src/panels/echomem/index.js
  function getEchoMemMenuItems() {
    var _a;
    const platform = getCurrentPlatform();
    const menuItems = ((_a = platform == null ? void 0 : platform.config) == null ? void 0 : _a.menuItems) || [
      { panelId: "resources" },
      { panelId: "association" },
      { panelId: "feedback" },
      { panelId: "skillStore" },
      { panelId: "performance" }
    ];
    return menuItems.map((item) => {
      const panelId = item.panelId || item.panel;
      const panel = getPanelDefinition(panelId);
      if (!panel) return null;
      return {
        panelId: panel.id,
        text: item.text || panel.title,
        description: item.description || panel.description
      };
    }).filter(Boolean);
  }
  function getEchoMemHomeContent() {
    const colors = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#dc2626"];
    const cards = getEchoMemMenuItems().map((item, index) => {
      const color = colors[index % colors.length];
      return `
      <button class="claw-echomem-menu-item" data-panel-id="${item.panelId}" data-panel="${item.panelId}" style="
        width: 100%;
        padding: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.2s;
      " onmouseenter="this.style.borderColor='${color}';this.style.background='#f9fafb';this.style.transform='translateX(3px)'" onmouseleave="this.style.borderColor='#e5e7eb';this.style.background='#fff';this.style.transform='none'">
        <span style="
          width: 10px;
          height: 32px;
          border-radius: 999px;
          background: ${color};
          flex-shrink: 0;
        "></span>
        <span style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
          <span style="font-size: 14px; font-weight: 600; color: #111827;">${item.text}</span>
          <span style="font-size: 12px; color: #6b7280; line-height: 1.45;">${item.description}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    `;
    }).join("");
    return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cards}
    </div>
  `;
  }

  // src/core/router.js
  var skillStoreRoutes = {
    history: {
      title: "\u7528\u6237\u5386\u53F2 Skill",
      render: getSkillHistoryContent
    },
    upload: {
      title: "\u4E0A\u4F20 Skill \u5230\u5546\u5E97",
      render: getSkillUploadContent
    },
    purchase: {
      title: "\u5546\u5E97 Skill \u8D2D\u4E70",
      render: getSkillPurchaseContent
    },
    merchant: {
      title: "\u5546\u5BB6\u63D0\u4F9B\u7684 Skill",
      render: getSkillMerchantContent
    },
    manage: {
      title: "Skill \u5B89\u88C5\u7BA1\u7406",
      render: getSkillManageContent
    }
  };
  function openEchoMemHomePanel() {
    setCurrentRoute({ type: "home" });
    openCustomPanel("EchoMem", getEchoMemHomeContent());
    bindPanelNavigation();
  }
  async function navigateToEchoMemPanel(panelIdOrTitle) {
    const panel = getPanelDefinition(panelIdOrTitle);
    if (!panel) return;
    setCurrentRoute({ type: "panel", panelId: panel.id });
    openCustomPanel(panel.title, getPanelContent(panel.id), {
      showBack: true,
      onBack: openEchoMemHomePanel
    });
    bindPanelNavigation();
    if (panel.id === "association") {
      await loadConfigValues();
      bindConfigUI();
    }
  }
  function navigateToSkillSection(sectionId) {
    const route = skillStoreRoutes[sectionId];
    if (!route) return;
    setCurrentRoute({
      type: "panel",
      panelId: "skillStore",
      route: sectionId
    });
    openCustomPanel(route.title, route.render(), {
      showBack: true,
      onBack: () => {
        openCustomPanel("skill\u5546\u5E97", getSkillStoreHomeContent(), {
          showBack: true,
          onBack: openEchoMemHomePanel
        });
        bindPanelNavigation();
      }
    });
    bindPanelControls();
  }
  async function refreshInputAssociationPanel() {
    const contentDiv = getPanelBodyElement();
    if (contentDiv) {
      contentDiv.innerHTML = getInputAssociationContent();
      bindToggleButton(handleInputAssociationToggle);
      await loadConfigValues();
      bindConfigUI();
    }
  }
  function handleInputAssociationToggle() {
    toggleInputAssociation();
    refreshInputAssociationPanel();
  }
  function bindPanelControls() {
    bindToggleButton(handleInputAssociationToggle);
    bindConfigUI();
  }
  function bindPanelNavigation(root = document) {
    const customPanel = root.querySelector(".claw-custom-panel");
    if (!customPanel || customPanel.dataset.clawEventsBound) {
      bindPanelControls();
      return;
    }
    customPanel.dataset.clawEventsBound = "true";
    customPanel.addEventListener("click", (e) => {
      const menuItem = e.target.closest(".claw-echomem-menu-item");
      if (menuItem) {
        const panelId = menuItem.dataset.panelId || menuItem.dataset.panel;
        if (panelId) {
          navigateToEchoMemPanel(panelId);
        }
        return;
      }
      const card = e.target.closest(".claw-skill-section");
      if (card) {
        const sectionId = card.dataset.section;
        if (sectionId) {
          navigateToSkillSection(sectionId);
        }
      }
    });
    bindPanelControls();
  }

  // src/core/buttons.js
  function addCustomButtons() {
    let platform = getCurrentPlatform();
    if (!platform) {
      const detected = detectPlatform();
      if (detected) {
        setCurrentPlatform(detected);
        platform = detected;
        console.log("Claw Extension: Platform detected -", platform.config.name);
      } else {
        return;
      }
    }
    const config = platform.config;
    const launcherConfig = config.launcher || config.buttonBar;
    if (!launcherConfig) return;
    if (document.querySelector(".claw-echomem-launcher-bar")) return;
    const inputContainers = document.querySelectorAll(launcherConfig.containerSelector);
    for (const container of inputContainers) {
      if (container.dataset.clawLauncherAdded) continue;
      let isValidContainer = true;
      for (const [key, selector] of Object.entries(launcherConfig.validateSelectors || {})) {
        if (!container.querySelector(selector)) {
          isValidContainer = false;
          break;
        }
      }
      if (!isValidContainer) continue;
      container.dataset.clawLauncherAdded = "true";
      const launcherBar = document.createElement("div");
      launcherBar.className = "claw-echomem-launcher-bar";
      const launcher = document.createElement("button");
      launcher.className = "claw-echomem-launcher";
      launcher.textContent = launcherConfig.text || "EchoMem";
      const style = {
        display: "flex",
        gap: "8px",
        padding: "0 12px 8px",
        background: "transparent",
        alignItems: "center",
        justifyContent: "flex-start",
        ...launcherConfig.style || {}
      };
      if (launcherConfig.getBackgroundColor && typeof launcherConfig.getBackgroundColor === "function") {
        try {
          const dynamicBg = launcherConfig.getBackgroundColor();
          if (dynamicBg) {
            style.background = dynamicBg;
          }
        } catch (e) {
          console.log("Claw Extension: getBackgroundColor failed, using default", e);
        }
      }
      launcherBar.style.cssText = Object.entries(style).map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `${cssKey}: ${value}`;
      }).join("; ");
      launcher.style.cssText = `
      height: 28px;
      padding: 0 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      background: #fff;
      color: #1f2937;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 26px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    `;
      launcher.addEventListener("mouseenter", () => {
        launcher.style.borderColor = "#2563eb";
        launcher.style.color = "#2563eb";
        launcher.style.boxShadow = "0 2px 6px rgba(37, 99, 235, 0.18)";
      });
      launcher.addEventListener("mouseleave", () => {
        launcher.style.borderColor = "rgba(0, 0, 0, 0.12)";
        launcher.style.color = "#1f2937";
        launcher.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.08)";
      });
      launcher.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEchoMemHomePanel();
      });
      launcherBar.appendChild(launcher);
      if (launcherConfig.insertAfter) {
        const insertTarget = document.querySelector(launcherConfig.insertAfter);
        if (insertTarget && insertTarget.parentNode) {
          insertTarget.parentNode.insertBefore(launcherBar, insertTarget.nextSibling);
        } else {
          container.parentNode.insertBefore(launcherBar, container);
        }
      } else if (launcherConfig.insertPosition === "after") {
        container.parentNode.insertBefore(launcherBar, container.nextSibling);
      } else if (launcherConfig.insertPosition === "append") {
        container.appendChild(launcherBar);
      } else {
        container.parentNode.insertBefore(launcherBar, container);
      }
      console.log(`Claw Extension: EchoMem launcher added for ${config.name}`);
      break;
    }
  }

  // src/core/lifecycle.js
  function createDomLifecycle({ onDomChange, delay = 120 }) {
    let timer = null;
    const run = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        onDomChange();
      }, delay);
    };
    const observer = new MutationObserver(run);
    return {
      start(root = document.body) {
        if (!root) return;
        observer.observe(root, {
          childList: true,
          subtree: true
        });
      },
      stop() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        observer.disconnect();
      },
      flush() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        onDomChange();
      }
    };
  }

  // src/services/messaging.js
  function bindRuntimeMessages() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return true;
    });
  }

  // src/entry/content.js
  console.log("EchoMem Extension: Content script loaded");
  window.clawExtensionLoaded = true;
  window.echoMemExtensionLoaded = true;
  function syncOriginalSidebarContent() {
    const platform = getCurrentPlatform();
    const panelConfig = getPanelConfig(platform);
    if (!panelConfig || panelConfig.type !== "sidebar") return;
    const container = document.querySelector(panelConfig.containerSelector);
    if (container && !isPanelOpen() && !container.querySelector(".claw-custom-panel")) {
      setOriginalPanelContent(container.innerHTML);
    }
  }
  function refreshContentScriptMount() {
    addCustomButtons();
    syncOriginalSidebarContent();
    bindPanelNavigation();
    tryBindInputElement();
    const platform = getCurrentPlatform();
    if (platform && !window.echomemInputTrackingStarted) {
      window.echomemInputTrackingStarted = true;
      console.log("EchoMem: Starting input tracking on DOM change for", platform.config.name);
      startInputTracking(platform.config);
    }
  }
  var lifecycle = createDomLifecycle({
    onDomChange: refreshContentScriptMount
  });
  async function start() {
    await initState();
    lifecycle.start();
    refreshContentScriptMount();
    bindRuntimeMessages();
    const platform = getCurrentPlatform();
    if (platform && !window.echomemInputTrackingStarted) {
      window.echomemInputTrackingStarted = true;
      console.log("EchoMem: Starting input tracking for", platform.config.name);
      startInputTracking(platform.config);
    } else if (!platform) {
      console.log("EchoMem: Platform not detected yet, input tracking will start on next DOM change");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
