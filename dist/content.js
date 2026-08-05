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
          hostnames: ["localhost", "127.0.0.1", "echo-agent.online", "www.echo-agent.online", "higo.world", "<ip>"],
          pathnamePrefixes: ["/home"],
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
          selector: "textarea[id^='_r_'], [contenteditable='true'][role='textbox']"
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
  function shouldRecord(platformId) {
    const config = PLATFORM_CONFIGS[platformId];
    return (config == null ? void 0 : config.record) === true && (config == null ? void 0 : config.enabled) !== false;
  }

  // src/platforms/registry.js
  var platformRegistry = PLATFORM_CONFIGS;

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

  // src/core/location-matcher.mjs
  function normalizeHostname(hostname) {
    return String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  }
  function isIPv4Address(hostname) {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  }
  function normalizePathPrefix(prefix) {
    const normalized = String(prefix || "").trim();
    if (!normalized || normalized === "/") return normalized;
    return normalized.replace(/\/+$/, "");
  }
  function matchesAllowedHostname(hostname, allowedHostnames) {
    if (!Array.isArray(allowedHostnames) || allowedHostnames.length === 0) return true;
    const normalizedHostname = normalizeHostname(hostname);
    return allowedHostnames.some((allowedHostname) => {
      const normalizedAllowed = normalizeHostname(allowedHostname);
      if (normalizedAllowed === "<ip>") return isIPv4Address(normalizedHostname);
      return normalizedHostname === normalizedAllowed;
    });
  }
  function matchesPathnamePrefixes(pathname, pathnamePrefixes) {
    if (!Array.isArray(pathnamePrefixes) || pathnamePrefixes.length === 0) return true;
    const normalizedPathname = String(pathname || "");
    return pathnamePrefixes.some((prefix) => {
      const normalizedPrefix = normalizePathPrefix(prefix);
      if (!normalizedPrefix) return false;
      if (normalizedPrefix === "/") return normalizedPathname.startsWith("/");
      return normalizedPathname === normalizedPrefix || normalizedPathname.startsWith(`${normalizedPrefix}/`);
    });
  }

  // src/core/detection.js
  function getCurrentPlatform() {
    return getPlatform();
  }
  function setCurrentPlatform(platform) {
    setPlatform(platform);
  }
  function getSelector(feature) {
    if (typeof feature === "string") return feature;
    if (feature && typeof feature === "object") return feature.selector;
    return null;
  }
  function detectPlatformMultiLayer(detection) {
    const logs = [];
    if (detection.hostnames) {
      const hostMatch = matchesAllowedHostname(window.location.hostname, detection.hostnames);
      if (!hostMatch) {
        console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u4E3B\u673A\u4E0D\u5339\u914D");
        return false;
      }
      logs.push("\u2713 \u4E3B\u673A\u5339\u914D");
    }
    if (detection.pathnamePrefixes) {
      const pathMatch = matchesPathnamePrefixes(window.location.pathname, detection.pathnamePrefixes);
      if (!pathMatch) {
        console.log("Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u8DEF\u5F84\u4E0D\u5339\u914D");
        return false;
      }
      logs.push("\u2713 \u8DEF\u5F84\u5339\u914D");
    }
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
          const selector = getSelector(feature);
          if (!selector) continue;
          const exists = document.querySelector(selector) !== null;
          if (!exists) {
            const desc = typeof feature === "object" ? feature.description : selector;
            console.log(`Claw Extension: \u5E73\u53F0\u68C0\u6D4B\u672A\u901A\u8FC7 - \u7F3A\u5C11\u5FC5\u8981DOM: ${desc}`);
            return false;
          }
        }
        logs.push("\u2713 \u5FC5\u8981DOM\u5143\u7D20\u5168\u90E8\u5B58\u5728");
      }
      if (optional && optional.length > 0) {
        const optionalMatch = optional.some((feature) => {
          const selector = getSelector(feature);
          return selector && document.querySelector(selector) !== null;
        });
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
  var isCustomPanelOpen = false;
  var currentOverlayPanel = null;
  function getPanelConfig(platform = getCurrentPlatform()) {
    var _a, _b;
    return ((_a = platform == null ? void 0 : platform.config) == null ? void 0 : _a.panelHost) || ((_b = platform == null ? void 0 : platform.config) == null ? void 0 : _b.panel) || null;
  }
  function getPanelContainer() {
    return currentOverlayPanel;
  }
  function isPanelOpen() {
    return isCustomPanelOpen;
  }
  function buildPanelHeader(title, showBack, onBack, compact = false) {
    if (showBack) {
      return `
      <div class="claw-panel-header claw-panel-header--with-back${compact ? " claw-panel-header--compact" : ""}" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: ${compact ? "56px" : "64px"};
        padding: 0 ${compact ? "16px" : "20px"};
      ">
        <div class="claw-panel-header-leading" style="display: flex; align-items: center; gap: ${compact ? "8px" : "12px"};">
          <button type="button" class="claw-back-btn" style="
            width: ${compact ? "36px" : "40px"};
            height: ${compact ? "36px" : "40px"};
            border-radius: 50%;
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #49454f;
            transition: background-color 200ms ease, color 200ms ease, transform 200ms ease;
          " title="\u8FD4\u56DE">
            <svg width="${compact ? "16" : "18"}" height="${compact ? "16" : "18"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h6 class="claw-panel-title" style="
            margin: 0;
            font-size: ${compact ? "16px" : "18px"};
            font-weight: 500;
            color: #21005d;
            font-family: Roboto, 'Noto Sans SC', sans-serif;
            letter-spacing: -0.01em;
          ">${title}</h6>
        </div>
        <button type="button" class="claw-close-panel" style="
          width: ${compact ? "36px" : "40px"};
          height: ${compact ? "36px" : "40px"};
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #49454f;
          transition: background-color 200ms ease, color 200ms ease, transform 200ms ease;
        " title="\u5173\u95ED">
          <svg width="${compact ? "16" : "18"}" height="${compact ? "16" : "18"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    } else {
      return `
      <div class="claw-panel-header" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 64px;
        padding: 0 20px;
      ">
        <h6 class="claw-panel-title" style="
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: #21005d;
          font-family: Roboto, 'Noto Sans SC', sans-serif;
          letter-spacing: -0.01em;
        ">${title}</h6>
        <button type="button" class="claw-close-panel" style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #49454f;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 200ms ease, color 200ms ease, transform 200ms ease;
        " title="\u5173\u95ED">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    }
  }
  function bindPanelEvents(container, showBack, onBack, closeMode = "restore") {
    if (showBack) {
      const backBtn = container.querySelector(".claw-back-btn");
      if (backBtn) {
        backBtn.addEventListener("mouseenter", () => {
          backBtn.style.background = "#EADDFF";
          backBtn.style.color = "#21005D";
        });
        backBtn.addEventListener("mouseleave", () => {
          backBtn.style.background = "transparent";
          backBtn.style.color = "#49454F";
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
        closeBtn.style.background = "#EADDFF";
        closeBtn.style.color = "#21005D";
      });
      closeBtn.addEventListener("mouseleave", () => {
        closeBtn.style.background = "transparent";
        closeBtn.style.color = "#49454F";
      });
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (closeMode === "overlay-only") {
          closeOverlayPanel();
        } else {
          restoreOriginalPanel();
        }
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
      background: linear-gradient(180deg, #FFFBFE 0%, #FEF7FF 100%);
    ">
      ${headerHtml}
      <div class="claw-custom-panel-body" style="
        flex: 1;
        overflow-y: auto;
        padding: 20px 20px 28px;
      ">
        ${contentHtml}
      </div>
    </div>
  `;
    createOverlayPanel(panelHtml, panelConfig.overlayConfig);
    bindPanelEvents(currentOverlayPanel, showBack, onBack);
    isCustomPanelOpen = true;
    setPanelOpen(true);
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
      opacity: 0;
      transition: opacity 200ms ease;
      z-index: 9998;
    `;
      backdrop.addEventListener("click", restoreOriginalPanel);
      document.body.appendChild(backdrop);
    }
    const overlay = document.createElement("div");
    overlay.className = "claw-overlay-panel";
    const position = overlayConfig.position || "right";
    const width = overlayConfig.width || "400px";
    overlay.classList.add(`claw-overlay-panel--${position}`);
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
    background: #FFFBFE;
    z-index: 9999;
    box-shadow: 0 12px 36px rgba(33, 0, 93, 0.16);
    transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease;
    overflow: hidden;
  `;
    overlay.innerHTML = panelHtml;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      if (backdrop) {
        backdrop.style.opacity = "1";
      }
      if (position === "right" || position === "left") {
        overlay.style.transform = "translateX(0)";
      } else if (position === "center") {
        overlay.style.transform = "translate(-50%, -50%) scale(1)";
      }
    });
    currentOverlayPanel = overlay;
  }
  function closeOverlayPanel() {
    const overlayToClose = currentOverlayPanel;
    const previousOverlay = overlayToClose == null ? void 0 : overlayToClose._previousOverlay;
    if (previousOverlay) {
      previousOverlay.style.display = "";
      currentOverlayPanel = previousOverlay;
      isCustomPanelOpen = true;
      setPanelOpen(true);
      console.log("Claw Extension: Restored previous overlay");
    } else {
      currentOverlayPanel = null;
      isCustomPanelOpen = false;
      setPanelOpen(false);
    }
    if (overlayToClose) {
      const transform = overlayToClose.style.transform;
      if (transform && transform.includes("translateX(0)")) {
        const isRight = overlayToClose.style.right === "0px" || overlayToClose.style.right === "";
        overlayToClose.style.transform = isRight ? "translateX(100%)" : "translateX(-100%)";
      } else {
        overlayToClose.style.transform = "translate(-50%, -50%) scale(0.9)";
        overlayToClose.style.opacity = "0";
      }
      setTimeout(() => {
        overlayToClose.remove();
      }, 300);
    }
    document.querySelectorAll(".claw-overlay-backdrop").forEach((b) => {
      b.style.pointerEvents = "none";
      b.style.opacity = "0";
      setTimeout(() => b.remove(), 300);
    });
  }
  function restoreOriginalPanel() {
    if (currentOverlayPanel) {
      closeOverlayPanel();
    }
    document.querySelectorAll(".claw-overlay-backdrop").forEach((b) => b.remove());
  }
  function getPanelBodyElement() {
    const container = getPanelContainer();
    return (container == null ? void 0 : container.querySelector(".claw-custom-panel-body")) || null;
  }
  function openCenterOverlay(title, contentHtml, options = {}) {
    const {
      showBack = false,
      onBack = null,
      width,
      height,
      maxWidth,
      maxHeight,
      compactHeader = false,
      panelClass = ""
    } = options;
    const existingOverlay = currentOverlayPanel;
    if (existingOverlay) {
      existingOverlay.style.display = "none";
      currentOverlayPanel = null;
    }
    document.querySelectorAll(".claw-overlay-backdrop").forEach((b) => b.remove());
    const headerHtml = buildPanelHeader(title, showBack, onBack, compactHeader);
    const panelHtml = `
    <div class="claw-custom-panel" style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: linear-gradient(180deg, #FFFBFE 0%, #FEF7FF 100%);
    ">
      ${headerHtml}
      <div class="claw-custom-panel-body" style="
        flex: 1;
        overflow-y: auto;
        padding: 0;
      ">
        ${contentHtml}
      </div>
    </div>
  `;
    createOverlayPanel(panelHtml, {
      position: "center",
      width: width || "85vw",
      backdrop: true
    });
    if (currentOverlayPanel) {
      if (typeof panelClass === "string" && panelClass.trim()) {
        currentOverlayPanel.classList.add(...panelClass.trim().split(/\s+/));
      }
      currentOverlayPanel.style.maxWidth = maxWidth || "1000px";
      currentOverlayPanel.style.height = height || "80vh";
      currentOverlayPanel.style.maxHeight = maxHeight || "700px";
      currentOverlayPanel.style.borderRadius = "16px";
      currentOverlayPanel.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2)";
      currentOverlayPanel._previousOverlay = existingOverlay;
    }
    bindPanelEvents(currentOverlayPanel, showBack, onBack, "overlay-only");
    isCustomPanelOpen = true;
    setPanelOpen(true);
  }

  // src/services/config.js
  var DEFAULT_ECHOMEM_CONFIG = {
    baseUrl: "http://127.0.0.1:8010",
    authKey: "",
    agentId: ""
  };
  var DEFAULT_OPENVIEW_CONFIG = {
    baseUrl: "http://127.0.0.1:31020",
    username: "",
    password: ""
  };
  var DEFAULT_COMPLETION_CONFIG = {
    phraseScoreThreshold: 0.2
  };
  var DEFAULT_AGENT_ID = "echoagent";
  var PLATFORM_AGENT_IDS = {
    higo: "echoagent",
    deepseek: "echoagent"
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
  async function setEchoMemConfig(config) {
    await chrome.storage.local.set({ echomemConfig: config });
  }
  async function getOpenViewConfig() {
    try {
      const result = await chrome.storage.local.get("openviewConfig");
      return { ...DEFAULT_OPENVIEW_CONFIG, ...result.openviewConfig || {} };
    } catch {
      return { ...DEFAULT_OPENVIEW_CONFIG };
    }
  }
  async function setOpenViewConfig(config) {
    await chrome.storage.local.set({ openviewConfig: config });
  }
  function getAgentIdForPlatform(platformId) {
    const platformAgentId = PLATFORM_AGENT_IDS[platformId];
    if (platformAgentId) return platformAgentId;
    return DEFAULT_AGENT_ID;
  }
  async function getConfiguredAgentId(platformId) {
    try {
      const result = await chrome.storage.local.get("echomemConfig");
      const cfg = result.echomemConfig || {};
      if (cfg.agentId) return cfg.agentId;
    } catch {
    }
    return getAgentIdForPlatform(platformId);
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

  // src/core/text-insertion.js
  function composePlainTextInsertion(existingValue, content, selectionStart, selectionEnd) {
    const existing = String(existingValue ?? "");
    const cleanContent = String(content ?? "").trim();
    if (!cleanContent) return null;
    const clamp = (value) => Math.max(0, Math.min(existing.length, value));
    const start2 = Number.isInteger(selectionStart) ? clamp(selectionStart) : existing.length;
    const end = Number.isInteger(selectionEnd) ? clamp(selectionEnd) : start2;
    const from = Math.min(start2, end);
    const to = Math.max(start2, end);
    const before = existing.slice(0, from);
    const after = existing.slice(to);
    const prefix = before && !/\s$/.test(before) ? " " : "";
    const suffix = after && /^\s/.test(after) ? "" : " ";
    const inserted = `${prefix}${cleanContent}${suffix}`;
    return {
      value: `${before}${inserted}${after}`,
      cursor: before.length + inserted.length
    };
  }

  // src/core/editable-control.js
  function isTextControl(control) {
    const tagName = String((control == null ? void 0 : control.tagName) || "").toUpperCase();
    return tagName === "TEXTAREA" || tagName === "INPUT";
  }
  function isContentEditableControl(control) {
    var _a;
    if (!control) return false;
    if (control.isContentEditable === true) return true;
    return ((_a = control.getAttribute) == null ? void 0 : _a.call(control, "contenteditable")) === "true";
  }
  function readEditableText(control) {
    if (isTextControl(control)) return String(control.value ?? "");
    if (isContentEditableControl(control)) return String(control.textContent ?? "");
    return "";
  }
  function setTextControlValue(control, value) {
    var _a, _b, _c, _d;
    const view = (_a = control.ownerDocument) == null ? void 0 : _a.defaultView;
    const prototype = String(control.tagName || "").toUpperCase() === "TEXTAREA" ? (_b = view == null ? void 0 : view.HTMLTextAreaElement) == null ? void 0 : _b.prototype : (_c = view == null ? void 0 : view.HTMLInputElement) == null ? void 0 : _c.prototype;
    const nativeSetter = prototype ? (_d = Object.getOwnPropertyDescriptor(prototype, "value")) == null ? void 0 : _d.set : null;
    if (nativeSetter) nativeSetter.call(control, value);
    else control.value = value;
  }
  function createInputEvent(control, data = null, inputType = "insertText") {
    var _a;
    const view = (_a = control.ownerDocument) == null ? void 0 : _a.defaultView;
    if (view == null ? void 0 : view.InputEvent) {
      try {
        return new view.InputEvent("input", { bubbles: true, inputType, data });
      } catch (_) {
      }
    }
    const EventConstructor = (view == null ? void 0 : view.Event) || Event;
    return new EventConstructor("input", { bubbles: true });
  }
  function dispatchEditableInput(control, options = {}) {
    control.dispatchEvent(createInputEvent(control, options.data, options.inputType));
  }
  function placeContentEditableCaret(control, offset) {
    var _a;
    const documentRef = control.ownerDocument;
    const view = documentRef == null ? void 0 : documentRef.defaultView;
    if (!(documentRef == null ? void 0 : documentRef.createRange) || !(view == null ? void 0 : view.getSelection)) return;
    const range = documentRef.createRange();
    const textNode = control.firstChild;
    if ((textNode == null ? void 0 : textNode.nodeType) === 3) {
      range.setStart(textNode, Math.min(offset, ((_a = textNode.textContent) == null ? void 0 : _a.length) || 0));
    } else {
      range.selectNodeContents(control);
      range.collapse(false);
    }
    range.collapse(true);
    const selection = view.getSelection();
    selection == null ? void 0 : selection.removeAllRanges();
    selection == null ? void 0 : selection.addRange(range);
  }
  function setEditableText(control, value, options = {}) {
    var _a;
    if (!control) return false;
    const text = String(value ?? "");
    const cursor = Number.isInteger(options.cursor) ? options.cursor : text.length;
    if (isTextControl(control)) {
      setTextControlValue(control, text);
      try {
        control.selectionStart = control.selectionEnd = cursor;
      } catch (_) {
      }
    } else if (isContentEditableControl(control)) {
      control.textContent = text;
      placeContentEditableCaret(control, cursor);
    } else {
      return false;
    }
    if (options.dispatch !== false) {
      dispatchEditableInput(control, {
        data: options.data ?? text,
        inputType: options.inputType || "insertText"
      });
    }
    if (options.focus !== false) (_a = control.focus) == null ? void 0 : _a.call(control);
    return true;
  }
  function isRangeWithin(control, range) {
    if (!range) return false;
    const contains = (node) => {
      var _a;
      return node === control || ((_a = control.contains) == null ? void 0 : _a.call(control, node));
    };
    return contains(range.startContainer) && contains(range.endContainer);
  }
  function createEndRange(control) {
    var _a, _b;
    const range = (_b = (_a = control.ownerDocument) == null ? void 0 : _a.createRange) == null ? void 0 : _b.call(_a);
    if (!range) return null;
    range.selectNodeContents(control);
    range.collapse(false);
    return range;
  }
  function textAroundRange(control, range) {
    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(control);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(control);
    afterRange.setStart(range.endContainer, range.endOffset);
    return { before: beforeRange.toString(), after: afterRange.toString() };
  }
  function insertIntoContentEditable(control, content, options = {}) {
    var _a, _b;
    const cleanContent = String(content ?? "").trim();
    if (!cleanContent) return false;
    const documentRef = control.ownerDocument;
    const view = documentRef == null ? void 0 : documentRef.defaultView;
    const selection = (_a = view == null ? void 0 : view.getSelection) == null ? void 0 : _a.call(view);
    const selectedRange = (selection == null ? void 0 : selection.rangeCount) ? selection.getRangeAt(0) : null;
    const range = isRangeWithin(control, selectedRange) ? selectedRange.cloneRange() : createEndRange(control);
    if (!range || !(documentRef == null ? void 0 : documentRef.createTextNode)) {
      const result = composePlainTextInsertion(readEditableText(control), cleanContent);
      return result ? setEditableText(control, result.value, {
        ...options,
        cursor: result.cursor,
        data: cleanContent
      }) : false;
    }
    const { before, after } = textAroundRange(control, range);
    const prefix = before && !/\s$/.test(before) ? " " : "";
    const suffix = after && /^\s/.test(after) ? "" : " ";
    const inserted = `${prefix}${cleanContent}${suffix}`;
    if (options.focus !== false) (_b = control.focus) == null ? void 0 : _b.call(control);
    range.deleteContents();
    const textNode = documentRef.createTextNode(inserted);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection == null ? void 0 : selection.removeAllRanges();
    selection == null ? void 0 : selection.addRange(range);
    dispatchEditableInput(control, { data: inserted, inputType: "insertText" });
    return true;
  }
  function insertEditableText(control, content, options = {}) {
    if (isContentEditableControl(control)) {
      return insertIntoContentEditable(control, content, options);
    }
    if (!isTextControl(control)) return false;
    const result = composePlainTextInsertion(
      readEditableText(control),
      content,
      control.selectionStart,
      control.selectionEnd
    );
    return result ? setEditableText(control, result.value, {
      ...options,
      cursor: result.cursor,
      data: String(content ?? "").trim()
    }) : false;
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
    const start2 = text.indexOf(MEM_TAG_OPEN);
    if (start2 === -1) return text.trim();
    const end = text.indexOf(MEM_TAG_CLOSE, start2);
    if (end === -1) return text.trim();
    return (text.slice(0, start2) + text.slice(end + MEM_TAG_CLOSE.length)).trim();
  }
  function insertPlainText(content, options = {}) {
    const inputElement = findInputElement();
    if (!inputElement) {
      console.warn("EchoMem: \u672A\u627E\u5230\u8F93\u5165\u6846\uFF0C\u65E0\u6CD5\u63D2\u5165\u6587\u672C");
      return false;
    }
    return insertEditableText(inputElement, content, options);
  }
  function injectContent(content, options = {}) {
    const inputElement = findInputElement();
    if (!inputElement) {
      console.warn("EchoMem: \u672A\u627E\u5230\u8F93\u5165\u6846\uFF0C\u65E0\u6CD5\u6CE8\u5165\u5185\u5BB9");
      return false;
    }
    const existing = readEditableText(inputElement);
    let base = options.replace ? stripMemoryBlock(existing) : existing;
    const cleanContent = content.replace(new RegExp(MEM_TAG_OPEN, "g"), "").replace(new RegExp(MEM_TAG_CLOSE, "g"), "").trim();
    if (!cleanContent) return false;
    const block = `${MEM_TAG_OPEN}
${cleanContent}
${MEM_TAG_CLOSE}`;
    const next = base ? `${base}

${block}` : block;
    return setEditableText(inputElement, next, { focus: options.focus, cursor: next.length });
  }

  // src/panels/resource/import.js
  function normalizeUri(uri) {
    return uri.replace(/\/$/, "");
  }
  function getRootDirUri() {
    return "echo://resources";
  }
  function getParentUri(uri) {
    const clean = normalizeUri(uri);
    const parts = clean.split("/");
    if (parts.length <= 3) return null;
    return parts.slice(0, -1).join("/");
  }
  function getResourceImportContent() {
    return `
    <style>
      #claw-resource-import-root {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      #claw-resource-import-root, #claw-resource-import-root * { box-sizing: border-box; }
      #claw-resource-import-root .resource-import-card {
        padding: 15px;
        border: 1px solid #E7E0EC;
        border-radius: 18px;
        background: #FFFFFF;
      }
      #claw-resource-import-root .resource-section-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
        color: #1D1B20;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.45;
      }
      #claw-resource-import-root .resource-section-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 10px;
        background: #F3EDF7;
        color: #6750A4;
        flex: 0 0 auto;
      }
      #claw-resource-import-root #claw-resource-dropzone {
        min-height: 118px;
        padding: 18px 14px;
        border-color: #B9AFC2;
        border-radius: 16px;
        background: #FEF7FF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      #claw-resource-import-root #claw-resource-dropzone:hover {
        border-color: #6750A4;
        background: #F3EDF7;
        box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.08);
      }
      #claw-resource-import-root #claw-resource-dropzone:focus-visible,
      #claw-resource-import-root button:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      #claw-resource-import-root .resource-drop-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 14px;
        background: #EADDFF;
        color: #6750A4;
      }
      #claw-resource-import-root .resource-drop-title {
        margin: 1px 0 0;
        color: #1D1B20;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.45;
      }
      #claw-resource-import-root .resource-drop-meta {
        margin: 0;
        color: #79747E;
        font-size: 10px;
        line-height: 1.45;
      }
      #claw-resource-import-root #claw-resource-import-status {
        padding: 11px 13px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        line-height: 1.5;
      }
      #claw-resource-import-root .resource-remote-card { background: #FFFBFE; }
      #claw-resource-import-root .resource-remote-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      #claw-resource-import-root .resource-remote-header .resource-section-heading { margin: 0; }
      #claw-resource-import-root #claw-remote-path {
        min-width: 0;
        max-width: 54%;
        overflow: hidden;
        padding: 5px 8px;
        border-radius: 8px;
        background: #F3EDF7;
        color: #625B71;
        font: 500 10px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #claw-resource-import-root #claw-remote-back {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 6px 12px !important;
        border: 1px solid #E0D4F1 !important;
        border-radius: 999px !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
        font-family: inherit !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        line-height: 1.3 !important;
        cursor: pointer;
      }
      #claw-resource-import-root #claw-remote-back:hover { background: #EADDFF !important; }
      #claw-resource-import-root .resource-loading,
      #claw-resource-import-root .resource-empty-state,
      #claw-resource-import-root .resource-error-state {
        padding: 22px 14px !important;
        border: 1px dashed #D8D0DC;
        border-radius: 14px;
        background: #FFFFFF;
        color: #79747E !important;
        text-align: center;
        font-size: 12px;
        line-height: 1.55;
      }
      #claw-resource-import-root .resource-loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        margin-bottom: 7px;
        border: 2px solid #E7E0EC;
        border-top-color: #6750A4;
        border-radius: 50%;
        animation: resource-import-spin 0.8s linear infinite;
      }
      @keyframes resource-import-spin { to { transform: rotate(360deg); } }
      #claw-resource-import-root .resource-empty-icon,
      #claw-resource-import-root .resource-error-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        margin-bottom: 8px;
        border-radius: 14px;
        background: #F3EDF7;
        color: #6750A4;
      }
      #claw-resource-import-root .resource-error-state {
        border-color: #F2B8B5;
        background: #FFF8F7;
        color: #B3261E !important;
      }
      #claw-resource-import-root .resource-error-icon {
        background: #F9DEDC;
        color: #B3261E;
      }
      #claw-resource-import-root .resource-file-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      #claw-resource-import-root .claw-remote-folder,
      #claw-resource-import-root .claw-remote-file {
        min-width: 0;
        padding: 10px 11px !important;
        border: 1px solid #E7E0EC !important;
        border-radius: 13px !important;
        background: #FFFFFF !important;
        gap: 8px !important;
        transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
      }
      #claw-resource-import-root .claw-remote-folder:hover {
        border-color: #C9B8DE !important;
        background: #FEF7FF !important;
        box-shadow: 0 3px 10px rgba(103, 80, 164, 0.08);
      }
      #claw-resource-import-root .resource-entry-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        background: #F3EDF7;
        font-size: 14px !important;
        flex: 0 0 auto;
      }
      #claw-resource-import-root .resource-entry-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        color: #1D1B20 !important;
        font-weight: 500 !important;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #claw-resource-import-root .resource-entry-size,
      #claw-resource-import-root .resource-entry-date {
        color: #79747E !important;
        font-size: 10px;
      }
      #claw-resource-import-root .claw-remote-btn-view,
      #claw-resource-import-root .claw-remote-btn-delete {
        min-height: 30px;
        padding: 5px 10px !important;
        border-radius: 999px !important;
        font-family: inherit !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        line-height: 1.25 !important;
      }
      #claw-resource-import-root .claw-remote-btn-view {
        border: 1px solid #E0D4F1 !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
      }
      #claw-resource-import-root .claw-remote-btn-delete {
        border: 1px solid #F2B8B5 !important;
        background: #F9DEDC !important;
        color: #B3261E !important;
      }
      #claw-resource-import-root button:disabled { cursor: wait !important; opacity: 0.58; }
      @media (max-width: 360px) {
        #claw-resource-import-root .resource-import-card { padding: 13px; border-radius: 16px; }
        #claw-resource-import-root .resource-remote-header { align-items: flex-start; flex-direction: column; }
        #claw-resource-import-root #claw-remote-path { max-width: 100%; width: 100%; }
        #claw-resource-import-root .resource-entry-date { display: none; }
        #claw-resource-import-root .claw-remote-folder,
        #claw-resource-import-root .claw-remote-file { padding: 9px !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        #claw-resource-import-root .resource-loading-spinner { animation: none; }
        #claw-resource-import-root .claw-remote-folder,
        #claw-resource-import-root .claw-remote-file { transition: none; }
      }
    </style>
    <div id="claw-resource-import-root">
      <!-- \u672C\u5730\u6587\u4EF6\u4E0A\u4F20 -->
      <div class="resource-import-card">
        <p class="resource-section-heading">
          <span class="resource-section-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
          </span>
          \u672C\u5730\u6587\u4EF6\u4E0A\u4F20
        </p>
        <div id="claw-resource-dropzone" style="
          border: 1.5px dashed #B9AFC2;
          border-radius: 16px;
          padding: 18px 14px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #FEF7FF;
        " onmouseenter="this.style.borderColor='#6750A4';this.style.background='#F3EDF7'"
           onmouseleave="this.style.borderColor='#B9AFC2';this.style.background='#FEF7FF'">
          <span class="resource-drop-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
          </span>
          <p class="resource-drop-title">\u70B9\u51FB\u6216\u62D6\u62FD\u6587\u4EF6\u5230\u6B64\u5904</p>
          <p class="resource-drop-meta">\u652F\u6301 PDF\u3001DOC\u3001TXT \u4E0E MD</p>
          <input type="file" id="claw-resource-file-input" style="display: none;" />
        </div>
      </div>

      <!-- \u72B6\u6001\u63D0\u793A -->
      <div id="claw-resource-import-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

      <!-- \u5904\u7406\u7ED3\u679C\u533A -->
      <div id="claw-resource-import-result" style="display: none;"></div>

      <!-- \u8FDC\u7A0B\u6587\u4EF6\u5217\u8868 -->
      <div class="resource-import-card resource-remote-card">
        <div class="resource-remote-header">
          <p class="resource-section-heading">
            <span class="resource-section-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>
            </span>
            \u8FDC\u7A0B\u6587\u4EF6
          </p>
          <p id="claw-remote-path" style="margin: 0;">echo://resources</p>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <div id="claw-remote-back-btn" style="display: none;">
            <button id="claw-remote-back" style="
              padding: 4px 10px;
              background: #F3EDF7;
              border: 1px solid #E0D4F1;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              color: #6750A4;
            ">\u2190 \u8FD4\u56DE\u4E0A\u7EA7</button>
          </div>
        </div>
        <div id="claw-backup-list-loading" class="resource-loading">
          <span class="resource-loading-spinner" aria-hidden="true"></span>
          <div>\u6B63\u5728\u52A0\u8F7D\u8FDC\u7A0B\u6587\u4EF6\u2026</div>
        </div>
        <div id="claw-backup-list-content" style="display: none;"></div>
      </div>
    </div>
  `;
  }
  async function initImportPanel(bodyElement) {
    if (!bodyElement) return;
    const dropzone = bodyElement.querySelector("#claw-resource-dropzone");
    const fileInput = bodyElement.querySelector("#claw-resource-file-input");
    const statusEl = bodyElement.querySelector("#claw-resource-import-status");
    const resultEl = bodyElement.querySelector("#claw-resource-import-result");
    const backupLoadingEl = bodyElement.querySelector("#claw-backup-list-loading");
    const backupContentEl = bodyElement.querySelector("#claw-backup-list-content");
    const pathEl = bodyElement.querySelector("#claw-remote-path");
    const backBtnContainer = bodyElement.querySelector("#claw-remote-back-btn");
    const backBtn = bodyElement.querySelector("#claw-remote-back");
    if (!dropzone || !fileInput) return;
    let currentDirUri = getRootDirUri();
    function formatSize2(bytes) {
      if (!bytes || bytes < 0) return "-";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    function formatDate2(ts) {
      if (!ts) return "-";
      const d = typeof ts === "string" ? new Date(ts) : new Date(ts * 1e3);
      if (isNaN(d.getTime())) return "-";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function isDirectory2(entry) {
      var _a, _b;
      if (entry.kind) return entry.kind === "directory";
      return entry.isDir || entry.is_dir || ((_a = entry.stat) == null ? void 0 : _a.isDir) || ((_b = entry.stat) == null ? void 0 : _b.is_dir) || false;
    }
    function isFile(entry) {
      if (entry.kind) return entry.kind === "file";
      return !isDirectory2(entry);
    }
    function getEntryName2(entry) {
      var _a;
      return entry.name || ((_a = entry.uri) == null ? void 0 : _a.split("/").pop()) || "\u672A\u547D\u540D";
    }
    function getEntryUpdatedAt3(entry) {
      return entry.updated_at || entry.modTime || entry.mtime || entry.modifiedAt;
    }
    function getEntrySize2(entry) {
      var _a;
      return entry.size ?? ((_a = entry.stat) == null ? void 0 : _a.size);
    }
    function isRootDir(uri) {
      return normalizeUri(uri) === getRootDirUri();
    }
    async function loadRemoteFileList(dirUri = currentDirUri) {
      if (!backupLoadingEl || !backupContentEl) return;
      backupLoadingEl.style.display = "block";
      backupContentEl.style.display = "none";
      currentDirUri = dirUri;
      if (pathEl) pathEl.textContent = dirUri;
      if (backBtnContainer) {
        backBtnContainer.style.display = dirUri === getRootDirUri() ? "none" : "flex";
      }
      try {
        const client2 = createClient(await getEchoMemConfig());
        const lsResult = await client2.fsLs(dirUri, { output: "agent", absLimit: 128, showAllHidden: true });
        let entries = Array.isArray(lsResult) ? lsResult : (lsResult == null ? void 0 : lsResult.entries) || [];
        entries = entries.filter((e) => getEntryName2(e) !== ".DS_Store");
        if (entries.length === 0) {
          backupLoadingEl.style.display = "none";
          backupContentEl.style.display = "block";
          backupContentEl.innerHTML = `
          <div class="resource-empty-state">
            <span class="resource-empty-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>
            </span>
            <p style="margin: 0; color: #49454F; font-weight: 500;">\u6682\u65E0\u6587\u4EF6</p>
            <p style="margin: 3px 0 0; font-size: 11px;">\u4E0A\u4F20\u6587\u4EF6\u540E\u5C06\u5728\u6B64\u5904\u663E\u793A</p>
          </div>
        `;
          return;
        }
        const dirs = entries.filter((e) => isDirectory2(e));
        const files = entries.filter((e) => isFile(e));
        const sortByModTime = (a, b) => {
          const ta = getEntryUpdatedAt3(a) ? new Date(getEntryUpdatedAt3(a)).getTime() : 0;
          const tb = getEntryUpdatedAt3(b) ? new Date(getEntryUpdatedAt3(b)).getTime() : 0;
          return tb - ta;
        };
        dirs.sort(sortByModTime);
        files.sort(sortByModTime);
        const allEntries = [...dirs, ...files];
        const itemsHtml = allEntries.map((entry) => {
          const name = getEntryName2(entry);
          const isDir = isDirectory2(entry);
          const icon = isDir ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6750A4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6750A4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
          const size = isDir ? "" : formatSize2(getEntrySize2(entry));
          const date = formatDate2(getEntryUpdatedAt3(entry));
          const atRoot = isRootDir(currentDirUri);
          if (isDir) {
            const deleteBtn = atRoot ? `<button class="claw-remote-btn-delete" data-resource-id="${name}" style="
                padding: 3px 8px;
                background: #F9DEDC;
                color: #B3261E;
                border: 1px solid #F2B8B5;
                border-radius: 999px;
                font-size: 11px;
                cursor: pointer;
                white-space: nowrap;
                margin-left: 8px;
              ">\u5220\u9664</button>` : "";
            return `
            <div class="claw-remote-folder" data-uri="${entry.uri}" style="
              padding: 8px 10px;
              background: #FFFFFF;
              border: 1px solid #E7E0EC;
              border-radius: 13px;
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 12px;
              cursor: pointer;
            " title="\u70B9\u51FB\u8FDB\u5165\u6587\u4EF6\u5939">
              <span class="resource-entry-icon">${icon}</span>
              <span class="resource-entry-name" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1D1B20; font-weight: 500;"
                >${name}</span>
              <span class="resource-entry-date" style="color: #79747E; white-space: nowrap; width: 80px; text-align: right;">${date}</span>
              ${deleteBtn}
            </div>
          `;
          }
          return `
          <div class="claw-remote-file" data-uri="${entry.uri}" style="
            padding: 8px 10px;
            background: #FFFFFF;
            border: 1px solid #E7E0EC;
            border-radius: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
          ">
            <span class="resource-entry-icon">${icon}</span>
            <span class="resource-entry-name" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1D1B20;"
              title="${name}">${name}</span>
            <span class="resource-entry-size" style="color: #79747E; white-space: nowrap; width: 60px; text-align: right;">${size}</span>
            <span class="resource-entry-date" style="color: #79747E; white-space: nowrap; width: 80px; text-align: right;">${date}</span>
            <button class="claw-remote-btn-view" data-uri="${entry.uri}" style="
              padding: 3px 8px;
              background: #F3EDF7;
              color: #6750A4;
              border: 1px solid #E0D4F1;
              border-radius: 999px;
              font-size: 11px;
              cursor: pointer;
              white-space: nowrap;
            ">\u67E5\u770B</button>
          </div>
        `;
        }).join("");
        backupLoadingEl.style.display = "none";
        backupContentEl.style.display = "block";
        backupContentEl.innerHTML = `
        <div class="resource-file-list">
          ${itemsHtml}
        </div>
      `;
        backupContentEl.querySelectorAll(".claw-remote-folder").forEach((folder) => {
          folder.addEventListener("click", (e) => {
            if (e.target.closest(".claw-remote-btn-delete")) return;
            const uri = folder.dataset.uri;
            if (uri) loadRemoteFileList(normalizeUri(uri));
          });
        });
        backupContentEl.querySelectorAll(".claw-remote-btn-view").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const uri = btn.dataset.uri;
            if (!uri) return;
            btn.textContent = "\u52A0\u8F7D\u4E2D...";
            try {
              const client3 = createClient(await getEchoMemConfig());
              const result = await client3.fsRead(uri);
              const text = typeof result === "string" ? result : (result == null ? void 0 : result.content) || JSON.stringify(result, null, 2);
              const name = uri.split("/").pop() || uri;
              const previewHtml = `<div style="padding: 18px; border-radius: 14px; background: #FFFBFE; color: #49454F; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.72; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
              openCenterOverlay(name, previewHtml, {
                showBack: true,
                onBack: () => closeOverlayPanel()
              });
            } catch (err) {
              alert(`\u67E5\u770B\u5931\u8D25: ${err.message}`);
            }
            btn.textContent = "\u67E5\u770B";
          });
        });
        backupContentEl.querySelectorAll(".claw-remote-btn-delete").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const resourceId = btn.dataset.resourceId;
            if (!resourceId) {
              alert("\u65E0\u6CD5\u5220\u9664\uFF1A\u7F3A\u5C11\u8D44\u6E90 ID");
              return;
            }
            const dialogHtml = `
            <div class="echomem-confirm-dialog" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; color: #1D1B20; font-family: Roboto, 'Noto Sans SC', sans-serif;">
              <div style="text-align: center;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 16px; background: #F9DEDC; color: #B3261E;" aria-hidden="true">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>
                </span>
                <p style="font-size: 15px; color: #1D1B20; font-weight: 600; margin: 8px 0 4px;">\u786E\u8BA4\u5220\u9664\u8D44\u6E90</p>
                <p style="font-size: 12px; color: #625F66; line-height: 1.55; margin: 0;">\u786E\u5B9A\u5220\u9664\u8D44\u6E90\u300C<strong style="color: #1D1B20; word-break: break-all;">${resourceId}</strong>\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002</p>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                <button id="claw-resource-del-cancel" style="
                  min-width: 104px;
                  min-height: 40px;
                  padding: 8px 18px;
                  background: #F3EDF7;
                  color: #6750A4;
                  border: 1px solid #E0D4F1;
                  border-radius: 999px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 600;
                ">\u53D6\u6D88</button>
                <button id="claw-resource-del-ok" style="
                  min-width: 104px;
                  min-height: 40px;
                  padding: 8px 18px;
                  background: #B3261E;
                  color: #FFFFFF;
                  border: 1px solid #B3261E;
                  border-radius: 999px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 600;
                ">\u786E\u8BA4\u5220\u9664</button>
              </div>
            </div>
          `;
            openCenterOverlay("\u5220\u9664\u786E\u8BA4", dialogHtml, {
              width: "min(360px, calc(100vw - 24px))",
              maxWidth: "calc(100vw - 24px)",
              height: "240px",
              maxHeight: "280px"
            });
            setTimeout(() => {
              const cancelBtn = document.getElementById("claw-resource-del-cancel");
              const okBtn = document.getElementById("claw-resource-del-ok");
              cancelBtn == null ? void 0 : cancelBtn.addEventListener("click", () => {
                closeOverlayPanel();
              });
              okBtn == null ? void 0 : okBtn.addEventListener("click", async () => {
                closeOverlayPanel();
                btn.textContent = "\u5220\u9664\u4E2D...";
                btn.disabled = true;
                try {
                  const client3 = createClient(await getEchoMemConfig());
                  await client3.deleteResource(resourceId);
                  await loadRemoteFileList();
                } catch (err) {
                  alert(`\u5220\u9664\u5931\u8D25: ${err.message}`);
                  btn.textContent = "\u5220\u9664";
                  btn.disabled = false;
                }
              });
            }, 50);
          });
        });
      } catch (err) {
        backupLoadingEl.style.display = "none";
        backupContentEl.style.display = "block";
        backupContentEl.innerHTML = `
        <div class="resource-error-state">
          <span class="resource-error-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>
          </span>
          <p style="margin: 0; font-weight: 600;">\u52A0\u8F7D\u6587\u4EF6\u5217\u8868\u5931\u8D25</p>
          <p style="margin: 4px 0 0; color: #79747E; word-break: break-word;">${err.message}</p>
        </div>
      `;
      }
    }
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        const parent = getParentUri(currentDirUri);
        if (parent) loadRemoteFileList(parent);
      });
    }
    loadRemoteFileList();
    function showStatus(msg, type = "info") {
      if (!statusEl) return;
      statusEl.style.display = "block";
      const colors = {
        info: { bg: "#F3EDF7", border: "#E0D4F1", text: "#6750A4" },
        success: { bg: "#E8F5E9", border: "#B7DDB9", text: "#1B5E20" },
        error: { bg: "#F9DEDC", border: "#F2B8B5", text: "#B3261E" }
      };
      const c = colors[type] || colors.info;
      statusEl.style.background = c.bg;
      statusEl.style.border = `1px solid ${c.border}`;
      statusEl.style.color = c.text;
      statusEl.textContent = msg;
    }
    function showResult(html) {
      if (!resultEl) return;
      resultEl.style.display = "block";
      resultEl.innerHTML = html;
    }
    function hideResult() {
      if (!resultEl) return;
      resultEl.style.display = "none";
      resultEl.innerHTML = "";
    }
    function formatError(err) {
      var _a, _b, _c, _d;
      if (err.name === "AbortError" || ((_a = err.message) == null ? void 0 : _a.includes("aborted"))) {
        return "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u540E\u7AEF\u662F\u5426\u6B63\u5E38\u8FD0\u884C\u6216\u7F51\u7EDC\u8FDE\u63A5";
      }
      if ((_b = err.message) == null ? void 0 : _b.includes("Failed to fetch")) {
        return "\u65E0\u6CD5\u8FDE\u63A5\u5230\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5730\u5740\u548C\u8BA4\u8BC1\u914D\u7F6E";
      }
      if (((_c = err.message) == null ? void 0 : _c.includes("401")) || ((_d = err.message) == null ? void 0 : _d.includes("403"))) {
        return "\u8BA4\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5728 EchoMem \u4E3B\u9875\u7684\u300C\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\u8FDE\u63A5\u914D\u7F6E\u300D\u4E2D\u68C0\u67E5 API Key";
      }
      return err.message;
    }
    function isTextFile(file) {
      var _a;
      if ((_a = file.type) == null ? void 0 : _a.startsWith("text/")) return true;
      const ext = file.name.split(".").pop().toLowerCase();
      return ["md", "txt", "json", "csv"].includes(ext);
    }
    function readFileContent(file) {
      return new Promise((resolve, reject) => {
        if (isTextFile(file)) {
          file.text().then((text) => resolve({
            content: text,
            contentType: file.type || "text/plain"
          })).catch(reject);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
          resolve({
            content: base64,
            contentType: file.type || "application/octet-stream",
            encoding: "base64"
          });
        };
        reader.onerror = () => reject(new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25"));
        reader.readAsDataURL(file);
      });
    }
    async function doUpload(file) {
      hideResult();
      showStatus("\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6...", "info");
      try {
        const { content, contentType, encoding } = await readFileContent(file);
        const metadata = encoding ? { encoding, source: "EchoMem extension" } : { source: "EchoMem extension" };
        showStatus("\u6B63\u5728\u4E0A\u4F20...", "info");
        const config = await getEchoMemConfig();
        const client2 = createClient(config);
        const result = await client2.addResource({
          content,
          name: file.name,
          contentType,
          tags: [],
          metadata
        });
        showStatus(`\u2705 \u300C${file.name}\u300D\u4E0A\u4F20\u6210\u529F`, "success");
        await loadRemoteFileList();
      } catch (err) {
        showStatus(`\u274C \u4E0A\u4F20\u5931\u8D25: ${formatError(err)}`, "error");
      }
    }
    dropzone.addEventListener("click", (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });
    fileInput.addEventListener("change", () => {
      var _a;
      const file = (_a = fileInput.files) == null ? void 0 : _a[0];
      if (file) doUpload(file);
      fileInput.value = "";
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#6750A4";
      dropzone.style.background = "#F3EDF7";
    });
    dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#B9AFC2";
      dropzone.style.background = "#FEF7FF";
    });
    dropzone.addEventListener("drop", (e) => {
      var _a, _b;
      e.preventDefault();
      dropzone.style.borderColor = "#B9AFC2";
      dropzone.style.background = "#FEF7FF";
      const file = (_b = (_a = e.dataTransfer) == null ? void 0 : _a.files) == null ? void 0 : _b[0];
      if (file) doUpload(file);
    });
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

  // src/panels/association/index.js
  function getInputAssociationContent() {
    const inputAssociationEnabled = getAssociationEnabled();
    const btnText = inputAssociationEnabled ? "\u5173\u95ED\u8054\u60F3" : "\u786E\u8BA4\u5F00\u542F";
    const btnBg = inputAssociationEnabled ? "#F9DEDC" : "#6750A4";
    const btnColor = inputAssociationEnabled ? "#B3261E" : "#FFFFFF";
    const statusText = inputAssociationEnabled ? "\u2705 \u8F93\u5165\u8054\u60F3\u5DF2\u5F00\u542F" : "\u274C \u8F93\u5165\u8054\u60F3\u672A\u5F00\u542F";
    const statusColor = inputAssociationEnabled ? "#1B5E20" : "#625B71";
    const statusBg = inputAssociationEnabled ? "#E8F5E9" : "#F3EDF7";
    const statusBorder = inputAssociationEnabled ? "#B7DDB9" : "#E7E0EC";
    return `
    <style>
      .echomem-association {
        color: #1D1B20;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      .echomem-association, .echomem-association * { box-sizing: border-box; }
      .echomem-association .association-action,
      .echomem-association .association-card,
      .echomem-association .association-config {
        border: 1px solid #E7E0EC;
        border-radius: 16px;
        background: #FFFFFF;
      }
      .echomem-association .association-action { padding: 14px; }
      .echomem-association .association-status {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid ${statusBorder};
        border-radius: 12px;
        background: ${statusBg};
        text-align: center;
      }
      .echomem-association .association-toggle,
      .echomem-association .association-primary-button {
        min-height: 42px;
        border-radius: 999px;
        font-family: inherit;
        letter-spacing: 0.01em;
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
      }
      .echomem-association .association-toggle:hover,
      .echomem-association .association-primary-button:hover {
        filter: brightness(0.97);
        box-shadow: 0 4px 12px rgba(103, 80, 164, 0.18);
      }
      .echomem-association button:active { transform: scale(0.985); }
      .echomem-association button:focus-visible,
      .echomem-association a:focus-visible,
      .echomem-association input:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      .echomem-association .association-card { padding: 15px 16px; }
      .echomem-association .association-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
        color: #1D1B20;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.45;
      }
      .echomem-association .association-heading-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 10px;
        background: #F3EDF7;
        color: #6750A4;
        flex: 0 0 auto;
      }
      .echomem-association .association-feature-list {
        list-style: none;
        margin: 0;
        padding: 0;
        color: #49454F;
        font-size: 12px;
        line-height: 1.65;
      }
      .echomem-association .association-feature-list li {
        position: relative;
        padding: 7px 0 7px 18px;
        border-top: 1px solid #F1ECF4;
      }
      .echomem-association .association-feature-list li:first-child {
        padding-top: 2px;
        border-top: 0;
      }
      .echomem-association .association-feature-list li::before {
        content: '';
        position: absolute;
        top: 14px;
        left: 2px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #6750A4;
      }
      .echomem-association .association-feature-list li:first-child::before { top: 9px; }
      .echomem-association .association-config {
        padding: 15px 16px;
        background: #FEF7FF;
      }
      .echomem-association .association-label {
        display: block;
        margin-bottom: 8px;
        color: #49454F;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.5;
      }
      .echomem-association .association-label span {
        display: block;
        margin-top: 2px;
        color: #79747E;
        font-size: 11px;
        font-weight: 400;
      }
      .echomem-association .association-range { accent-color: #6750A4; }
      .echomem-association .association-number {
        width: 68px;
        min-height: 36px;
        padding: 6px 8px;
        border: 1px solid #CAC4D0;
        border-radius: 10px;
        background: #FFFFFF;
        color: #1D1B20;
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        text-align: center;
      }
      .echomem-association .association-number:hover { border-color: #79747E; }
      .echomem-association .association-config-toggle {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        color: #6750A4;
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
      }
      .echomem-association .association-config-toggle:hover { background: #F3EDF7; }
      .echomem-association .association-tip {
        padding: 12px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #F3EDF7;
        color: #49454F;
        font-size: 12px;
        line-height: 1.6;
      }
      @media (max-width: 360px) {
        .echomem-association .association-action,
        .echomem-association .association-card,
        .echomem-association .association-config { padding: 13px; }
        .echomem-association .association-threshold-row { gap: 8px !important; }
        .echomem-association .association-number { width: 62px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .echomem-association button { transition: none !important; }
      }
    </style>
    <div class="echomem-association">
      <div class="association-action">
        <div class="association-status">
          <p id="claw-association-status" style="
            margin: 0;
            color: ${statusColor};
            font-size: 13px;
            font-weight: 600;
            line-height: 1.5;
          ">${statusText}</p>
        </div>
        <button id="claw-toggle-association" class="association-toggle" style="
          width: 100%;
          margin-top: 10px;
          padding: 10px 18px;
          background: ${btnBg};
          color: ${btnColor};
          border: 1px solid ${inputAssociationEnabled ? "#F2B8B5" : "#6750A4"};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        "
        >${btnText}</button>
      </div>

      <div class="association-card">
        <p class="association-heading">
          <span class="association-heading-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M8.4 15.5A7 7 0 1 1 15.6 15.5C14.6 16.2 14 17 14 18h-4c0-1-.6-1.8-1.6-2.5Z"/></svg>
          </span>
          \u529F\u80FD\u8BF4\u660E
        </p>
        <ul class="association-feature-list">
          <li>\u5386\u53F2\u8BB0\u5FC6\u53EC\u56DE\uFF1A\u6839\u636E\u8F93\u5165\u5B9E\u65F6\u53EC\u56DE\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\u4E2D\u7684\u76F8\u5173\u8BB0\u5FC6</li>
          <li>\u8BED\u4E49\u641C\u7D22\uFF1A\u652F\u6301\u8FD1\u4E49\u8BCD\u548C\u8BED\u4E49\u76F8\u5173\u5185\u5BB9\u7684\u53EC\u56DE</li>
          <li>\u70B9\u51FB\u63D2\u5165\uFF1A\u70B9\u51FB\u5EFA\u8BAE\u5FEB\u901F\u63D2\u5165\u5230\u8F93\u5165\u6846</li>
        </ul>
      </div>

      <div id="echomem-ov-config" class="association-config" style="display: none;">
        <p class="association-heading">
          <span class="association-heading-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.35.7.6 1 .3.28.7.42 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>
          </span>
          \u8865\u5168\u7B97\u6CD5\u914D\u7F6E
        </p>
        <div style="margin-bottom: 12px;">
          <label class="association-label">
            \u77ED\u8BED\u8FC7\u6EE4\u9608\u503C
            <span>\u8D8A\u5C0F\u663E\u793A\u8D8A\u591A\uFF0C\u8D8A\u5927\u8D8A\u4E25\u683C</span>
          </label>
          <div class="association-threshold-row" style="display: flex; align-items: center; gap: 12px;">
            <input id="completion-threshold" class="association-range" type="range" min="0.2" max="0.8" step="0.01" value="0.2"
              style="flex: 1; cursor: pointer;"
            />
            <input id="completion-threshold-number" class="association-number" type="number" min="0.2" max="0.8" step="0.01" value="0.2" />
          </div>
        </div>

        <button id="ov-save-config" class="association-primary-button" style="
          width: 100%;
          padding: 10px 18px;
          background: #6750A4;
          color: #FFFFFF;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        ">\u4FDD\u5B58\u914D\u7F6E</button>
      </div>

      <div style="text-align: center;">
        <a id="echomem-toggle-config" class="association-config-toggle" href="#">\u663E\u793A\u9AD8\u7EA7\u914D\u7F6E</a>
      </div>

      <div class="association-tip">
        <strong style="color: #6750A4; font-weight: 600;">\u4F7F\u7528\u63D0\u793A</strong>\uFF1A\u8F93\u5165\u65F6\u4F1A\u81EA\u52A8\u53EC\u56DE\u76F8\u5173\u8BB0\u5FC6\uFF0C\u70B9\u51FB\u5EFA\u8BAE\u5373\u53EF\u63D2\u5165\u3002
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
        var _a;
        e.preventDefault();
        e.stopPropagation();
        const phraseScoreThreshold2 = parseFloat(((_a = document.getElementById("completion-threshold")) == null ? void 0 : _a.value) || "0.2");
        try {
          await setCompletionConfig({ phraseScoreThreshold: phraseScoreThreshold2 });
          showFloatingToast("\u914D\u7F6E\u5DF2\u4FDD\u5B58", "success");
        } catch (err) {
          showFloatingToast(`\u4FDD\u5B58\u5931\u8D25: ${err.message}`, "error");
        }
      });
    }
  }
  async function loadConfigValues() {
    const completionConfig = await getCompletionConfig();
    const thresholdInput = document.getElementById("completion-threshold");
    const thresholdNumber = document.getElementById("completion-threshold-number");
    if (thresholdInput) thresholdInput.value = completionConfig.phraseScoreThreshold;
    if (thresholdNumber) thresholdNumber.value = completionConfig.phraseScoreThreshold;
  }

  // src/panels/feedback/feedback-theme.js
  var STYLE_ID = "echomem-feedback-theme";
  function injectFeedbackTheme(container) {
    if (!container || container.querySelector(`#${STYLE_ID}`)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .echomem-feedback-shell,
    .echomem-feedback-shell * { box-sizing: border-box; }
    .echomem-feedback-shell {
      --em-font-sans: Roboto, "Noto Sans SC", sans-serif;
      --em-bg: #05070a; --em-panel: rgba(2,8,20,.92); --em-panel-strong: #07101c;
      --em-line: rgba(0,230,255,.12); --em-line-strong: rgba(0,230,255,.42);
      --em-text: #e7fbff; --em-text-2: #b5d5df; --em-text-3: #7593a1;
      --em-cyan: #00e6ff; --em-blue: #4f8cff; --em-green: #4cd6a1;
      --em-amber: #f2b84b; --em-pink: #e16fa4; --em-purple: #a269ff;
      color: var(--em-text); background: var(--em-bg);
      font-family: var(--em-font-sans); color-scheme: dark;
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

  // src/panels/feedback/view-switcher.js
  function mountViewSwitcher(container, { views, defaultKey }) {
    var _a;
    container.innerHTML = "";
    container.style.position = "relative";
    const wrapper = document.createElement("div");
    wrapper.className = "echomem-feedback-shell";
    wrapper.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;min-height:400px;";
    injectFeedbackTheme(wrapper);
    const topbar = document.createElement("div");
    topbar.className = "em-topbar";
    const brand = document.createElement("div");
    brand.className = "em-brand";
    brand.innerHTML = `
    <div class="em-brand-eyebrow">ECHO \xB7 MEMORY INSIGHT</div>
    <div class="em-brand-title">\u8BA4\u77E5\u53CD\u9988</div>
  `;
    const tabList = document.createElement("div");
    tabList.className = "em-tabs";
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", "\u8BA4\u77E5\u53CD\u9988\u89C6\u56FE");
    const content = document.createElement("div");
    content.className = "em-view-stage";
    topbar.appendChild(brand);
    topbar.appendChild(tabList);
    wrapper.appendChild(topbar);
    wrapper.appendChild(content);
    container.appendChild(wrapper);
    let activeKey = null;
    let activeRevision = 0;
    const tabs = {};
    views.forEach((view) => {
      const btn = document.createElement("button");
      btn.className = "em-tab";
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", "false");
      btn.innerHTML = `<span class="em-tab-mark"></span><span>${view.label}</span>`;
      btn.addEventListener("click", () => switchTo(view.key));
      tabList.appendChild(btn);
      tabs[view.key] = { btn, view };
    });
    function cleanupActive() {
      var _a2, _b, _c;
      if (!activeKey) return;
      try {
        (_c = (_b = (_a2 = tabs[activeKey]) == null ? void 0 : _a2.view) == null ? void 0 : _b.cleanup) == null ? void 0 : _c.call(_b, content);
      } catch (err) {
        console.warn("EchoMem view-switcher: cleanup error", err);
      }
    }
    function switchTo(key, params = {}) {
      if (key === activeKey || !tabs[key]) return;
      cleanupActive();
      content.innerHTML = "";
      activeKey = key;
      const revision = ++activeRevision;
      content.dataset.emView = key;
      wrapper.dataset.emView = key;
      Object.entries(tabs).forEach(([tabKey, { btn }]) => {
        btn.setAttribute("aria-selected", String(tabKey === key));
        btn.tabIndex = tabKey === key ? 0 : -1;
      });
      try {
        tabs[key].view.mount(content, {
          switchTo,
          params,
          isActive: () => activeKey === key && activeRevision === revision && content.isConnected
        });
      } catch (err) {
        console.error("EchoMem view-switcher: mount error", err);
      }
    }
    const observer = new MutationObserver(() => {
      if (!container.isConnected) destroy();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    function destroy() {
      observer.disconnect();
      cleanupActive();
      activeKey = null;
      activeRevision += 1;
    }
    switchTo(defaultKey || ((_a = views[0]) == null ? void 0 : _a.key));
    return { destroy, switchTo };
  }

  // src/panels/feedback/view-registry.js
  var VIEW_ORDER = ["summary", "timeline"];
  function getOptionalFeedbackViews() {
    const registry = globalThis.__ECHOMEM_FEEDBACK_VIEWS__;
    if (!(registry instanceof Map)) return [];
    return VIEW_ORDER.map((key) => registry.get(key)).filter(Boolean);
  }

  // src/panels/feedback/index.js
  function getFeedbackContent() {
    return `
    <div style="color:#49454F;font-family:Roboto,'Noto Sans SC',sans-serif;">
      <p style="margin:0 0 12px;color:#6750A4;font-size:12px;font-weight:600;letter-spacing:.08em;">ECHO \xB7 \u8BA4\u77E5\u53CD\u9988</p>
      <div style="padding:16px;background:#FFF;border:1px solid rgba(121,116,126,.24);border-radius:12px;margin-bottom:12px;">
        <p style="font-weight:500;color:#21005D;margin-bottom:8px;">\u5F53\u524D\u4F1A\u8BDD\u5206\u6790</p>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>\u5BF9\u8BDD\u8F6E\u6B21</span><span style="color:#1D1B20;font-weight:500;">0</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>\u5E73\u5747\u54CD\u5E94\u65F6\u95F4</span><span style="color:#1D1B20;font-weight:500;">--</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Token \u6D88\u8017</span><span style="color:#1D1B20;font-weight:500;">0</span></div>
      </div>
      <button type="button" style="width:100%;min-height:40px;padding:10px 18px;background:linear-gradient(135deg,#6750A4,#21005D);color:#FFF;border:0;border-radius:20px;cursor:pointer;font-size:14px;font-weight:500;">\u751F\u6210\u53CD\u9988\u62A5\u544A</button>
    </div>
  `;
  }
  function getGraphOverlayContent() {
    const wrapperId = `echomem-feedback-wrapper-${Date.now()}`;
    setTimeout(() => {
      const wrapper = document.getElementById(wrapperId);
      if (!wrapper) return;
      const views = getOptionalFeedbackViews();
      mountViewSwitcher(wrapper, {
        defaultKey: "summary",
        views
      });
    }, 100);
    return `<div id="${wrapperId}" style="display:flex;flex-direction:column;width:100%;height:100%;min-height:400px;background:#05070a;"></div>`;
  }

  // src/panels/performance/index.js
  var FMT = (n) => n.toLocaleString("zh-CN");
  function isHigoPlatform() {
    var _a;
    const platform = getCurrentPlatform();
    return ((_a = platform == null ? void 0 : platform.config) == null ? void 0 : _a.id) === "higo" || (platform == null ? void 0 : platform.key) === "higo";
  }
  function skeletonValue(width = "60px") {
    return `<span class="perf-skeleton" style="width: ${width};"></span>`;
  }
  function getPerformanceContent() {
    const showSessionStats = isHigoPlatform();
    const totalSection = showSessionStats ? `
      <!-- \u6838\u5FC3\u6307\u6807\uFF1A\u603B Token \u6D88\u8017 -->
      <div class="perf-hero-card">
        <div class="perf-hero-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
        </div>
        <div class="perf-label perf-hero-label">\u603B Token \u6D88\u8017</div>
        <div id="perf-total" class="perf-total-value">${skeletonValue("100px")}</div>
        <div class="perf-unit perf-hero-unit">tokens</div>
      </div>
  ` : "";
    const sessionStatsSection = showSessionStats ? `
      <!-- \u4F1A\u8BDD\u7EDF\u8BA1 -->
      <div class="perf-grid">
        <div class="perf-metric-card">
          <p class="perf-label">\u4F1A\u8BDD\u6570</p>
          <p id="perf-sessions" class="perf-metric-value">${skeletonValue("60px")}</p>
        </div>
        <div class="perf-metric-card">
          <p class="perf-label">\u8F6E\u6B21\u6570</p>
          <p id="perf-turns" class="perf-metric-value">${skeletonValue("60px")}</p>
        </div>
      </div>

      <!-- Input / Output \u62C6\u5206 -->
      <div class="perf-grid">
        <div class="perf-metric-card">
          <p class="perf-label">Input Tokens</p>
          <p id="perf-input" class="perf-metric-value">${skeletonValue("80px")}</p>
          <p class="perf-unit">tokens</p>
        </div>
        <div class="perf-metric-card">
          <p class="perf-label">Output Tokens</p>
          <p id="perf-output" class="perf-metric-value">${skeletonValue("80px")}</p>
          <p class="perf-unit">tokens</p>
        </div>
      </div>
  ` : "";
    return `
    <style>
      @keyframes perf-skeleton-pulse {
        0%, 100% { opacity: 0.95; }
        50% { opacity: 0.42; }
      }
      #perf-root {
        color: #1D1B20;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      #perf-root, #perf-root * { box-sizing: border-box; }
      #perf-root .perf-hero-card {
        position: relative;
        overflow: hidden;
        padding: 20px 16px 18px;
        border: 1px solid #D8CCE7;
        border-radius: 20px;
        background: linear-gradient(145deg, #F3E9FF 0%, #EADDFF 58%, #F8F2FF 100%);
        box-shadow: 0 6px 20px rgba(103, 80, 164, 0.12);
        text-align: center;
      }
      #perf-root .perf-hero-card::after {
        content: '';
        position: absolute;
        top: -34px;
        right: -30px;
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.38);
        pointer-events: none;
      }
      #perf-root .perf-hero-icon {
        position: absolute;
        top: 14px;
        left: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.64);
        color: #6750A4;
      }
      #perf-root .perf-label {
        margin: 0 0 6px;
        color: #625F66;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.4;
      }
      #perf-root .perf-hero-label { color: #6750A4; }
      #perf-root .perf-total-value {
        position: relative;
        z-index: 1;
        color: #21005D;
        font-size: 32px;
        font-weight: 750;
        letter-spacing: -0.025em;
        line-height: 1.08;
      }
      #perf-root .perf-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      #perf-root .perf-metric-card {
        min-width: 0;
        padding: 14px;
        border: 1px solid #E7E0EC;
        border-radius: 16px;
        background: #FFFFFF;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
      }
      #perf-root .perf-backend-card {
        background: #FEF7FF;
        border-color: #E0D4F1;
      }
      #perf-root .perf-metric-value {
        margin: 0;
        overflow: hidden;
        color: #1D1B20;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: -0.015em;
        line-height: 1.2;
        text-overflow: ellipsis;
      }
      #perf-root .perf-unit {
        margin: 4px 0 0;
        color: #79747E;
        font-size: 10px;
        line-height: 1.4;
      }
      #perf-root .perf-hero-unit { color: #625B71; }
      #perf-root .perf-skeleton {
        display: inline-block;
        height: 20px;
        max-width: 100%;
        border-radius: 8px;
        background: linear-gradient(90deg, #DED6E3, #F3EDF7, #DED6E3);
        animation: perf-skeleton-pulse 1.5s ease-in-out infinite;
        vertical-align: middle;
      }
      #perf-root .perf-toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }
      #perf-root .perf-refresh {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 7px 13px;
        border: 1px solid #E0D4F1;
        border-radius: 999px;
        background: #F3EDF7;
        color: #6750A4;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
        transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      }
      #perf-root .perf-refresh:hover {
        background: #EADDFF;
        box-shadow: 0 3px 10px rgba(103, 80, 164, 0.14);
      }
      #perf-root .perf-refresh:active { transform: scale(0.98); }
      #perf-root .perf-refresh:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      #perf-root .perf-refresh:disabled { cursor: wait; opacity: 0.62; }
      #perf-root .perf-refresh::before {
        content: '\u21BB';
        font-size: 15px;
        font-weight: 500;
        line-height: 1;
      }
      #perf-root .perf-description {
        padding: 13px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #FFFFFF;
        color: #625F66;
        font-size: 12px;
        line-height: 1.65;
      }
      @media (max-width: 360px) {
        #perf-root .perf-grid { grid-template-columns: 1fr; }
        #perf-root .perf-hero-card { padding: 18px 14px 16px; }
        #perf-root .perf-total-value { font-size: 28px; }
      }
      @media (prefers-reduced-motion: reduce) {
        #perf-root .perf-skeleton { animation: none; }
        #perf-root .perf-refresh { transition: none; }
      }
    </style>
    <div id="perf-root">
      ${totalSection}

      ${sessionStatsSection}

      <!-- \u540E\u7AEF\u6D88\u8017 -->
      <div class="perf-metric-card perf-backend-card">
        <p class="perf-label">EchoMem \u540E\u7AEF\u6D88\u8017</p>
        <p id="perf-backend" class="perf-metric-value">${skeletonValue("80px")}</p>
        <p class="perf-unit">tokens</p>
      </div>

      <!-- \u8BF4\u660E -->
      <div class="perf-toolbar">
        <button id="perf-refresh-btn" class="perf-refresh">
          \u5237\u65B0
        </button>
      </div>
      <div id="perf-desc" class="perf-description">
        <span style="color: #6750A4; font-weight: 600;">\u6B63\u5728\u52A0\u8F7D\u6570\u636E\u2026</span>
      </div>
    </div>
  `;
  }
  async function fetchPerformanceData() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "fetchStatsSummary" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.success) {
          reject(new Error((response == null ? void 0 : response.error) || "Unknown error"));
          return;
        }
        const data = response.data;
        resolve({
          totalSessions: data.total_sessions ?? 0,
          totalTurns: data.total_turns ?? 0,
          totalInputTokens: data.total_input_tokens ?? 0,
          totalOutputTokens: data.total_output_tokens ?? 0,
          totalTokens: data.total_tokens ?? 0,
          since: data.since
        });
      });
    });
  }
  async function fetchBackendUsageData() {
    var _a;
    const config = await getEchoMemConfig();
    const client2 = createClient(config);
    const result = await client2.fetchUsage();
    return ((_a = result.total) == null ? void 0 : _a.total_tokens) ?? 0;
  }
  function updatePerformanceDOM(bodyElement, data, showSessionStats = true) {
    if (!bodyElement) return;
    const totalEl = bodyElement.querySelector("#perf-total");
    const sessionsEl = bodyElement.querySelector("#perf-sessions");
    const turnsEl = bodyElement.querySelector("#perf-turns");
    const inputEl = bodyElement.querySelector("#perf-input");
    const outputEl = bodyElement.querySelector("#perf-output");
    const backendEl = bodyElement.querySelector("#perf-backend");
    const descEl = bodyElement.querySelector("#perf-desc");
    const sessionTokens = data.totalTokens ?? 0;
    const backendTokens = data.backendTokens ?? 0;
    const totalTokens = sessionTokens + backendTokens;
    if (showSessionStats) {
      if (totalEl) totalEl.textContent = FMT(totalTokens);
      if (sessionsEl) sessionsEl.textContent = FMT(data.totalSessions ?? 0);
      if (turnsEl) turnsEl.textContent = FMT(data.totalTurns ?? 0);
      if (inputEl) inputEl.textContent = FMT(data.totalInputTokens ?? 0);
      if (outputEl) outputEl.textContent = FMT(data.totalOutputTokens ?? 0);
    }
    if (backendEl) {
      if (data.backendTokens !== void 0 && data.backendTokens !== null) {
        backendEl.textContent = FMT(data.backendTokens);
        backendEl.style.color = "#1D1B20";
      } else {
        backendEl.textContent = "--";
        backendEl.style.color = "#79747E";
      }
    }
    if (descEl) {
      const sinceText = data.since ? `\u81EA ${new Date(data.since).toLocaleString("zh-CN")} \u8D77\u7EDF\u8BA1` : "\u7EDF\u8BA1\u8303\u56F4\uFF1A\u5168\u90E8\u5386\u53F2\u4F1A\u8BDD";
      if (showSessionStats) {
        descEl.innerHTML = `
        <span style="color: #6750A4; font-weight: 600;">Token \u7EDF\u8BA1\uFF1A</span>
        \u7D2F\u8BA1 ${FMT(data.totalSessions ?? 0)} \u4E2A\u4F1A\u8BDD\uFF0C${FMT(data.totalTurns ?? 0)} \u8F6E\u5BF9\u8BDD\uFF1B
        \u4F1A\u8BDD\u6D88\u8017 <strong style="color: #1D1B20;">${FMT(sessionTokens)}</strong> tokens\uFF0C
        EchoMem \u540E\u7AEF\u6D88\u8017 <strong style="color: #1D1B20;">${FMT(backendTokens)}</strong> tokens\uFF0C
        \u5408\u8BA1 <strong style="color: #1D1B20;">${FMT(totalTokens)}</strong> tokens\u3002
        <br><span style="color: #79747E;">${sinceText}</span>
      `;
      } else {
        descEl.innerHTML = `
        <span style="color: #6750A4; font-weight: 600;">Token \u7EDF\u8BA1\uFF1A</span>
        \u5F53\u524D\u5E73\u53F0\u4EC5\u5C55\u793A EchoMem \u540E\u7AEF Token \u6D88\u8017\u3002
        <br><span style="color: #79747E;">\u4F1A\u8BDD\u7EA7 Token \u7EDF\u8BA1\u4EC5\u5728 HIGO \u5E73\u53F0\u53EF\u7528</span>
      `;
      }
    }
  }
  function initPerformancePanel(bodyElement, options = {}) {
    let pollTimer = null;
    let destroyed = false;
    async function refresh() {
      if (destroyed) return;
      try {
        const showSessionStats = isHigoPlatform();
        const promises = [];
        if (showSessionStats) {
          promises.push(fetchPerformanceData());
        }
        promises.push(fetchBackendUsageData());
        const results = await Promise.allSettled(promises);
        const statsResult = showSessionStats ? results[0] : { status: "fulfilled", value: null };
        const usageResult = showSessionStats ? results[1] : results[0];
        const data = statsResult.status === "fulfilled" && statsResult.value ? statsResult.value : {
          totalSessions: 0,
          totalTurns: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          since: null
        };
        if (usageResult.status === "fulfilled") {
          data.backendTokens = usageResult.value;
        }
        if (!destroyed) updatePerformanceDOM(bodyElement, data, showSessionStats);
        if (statsResult.status === "rejected") {
          console.warn("EchoMem: session stats fetch failed", statsResult.reason);
        }
        if (usageResult.status === "rejected") {
          console.warn("EchoMem: backend usage fetch failed", usageResult.reason);
        }
      } catch (err) {
        console.warn("EchoMem: performance data refresh failed", err);
        const descEl = bodyElement == null ? void 0 : bodyElement.querySelector("#perf-desc");
        if (descEl && !destroyed) {
          descEl.innerHTML = `<span style="color: #B3261E; font-weight: 600;">\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5</span>`;
        }
      }
    }
    refresh();
    const refreshBtn = bodyElement == null ? void 0 : bodyElement.querySelector("#perf-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = "\u5237\u65B0\u4E2D...";
        refreshBtn.disabled = true;
        await refresh();
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
      });
    }
    const { pollInterval } = options;
    if (pollInterval && pollInterval > 0) {
      pollTimer = setInterval(refresh, pollInterval);
    }
    return {
      destroy() {
        destroyed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    };
  }

  // src/utils/skill-parser.js
  var FRONTMATTER_PATTERN = /^---\s*\n(.*?)\n---\s*\n(.*)$/s;
  function parseSkillMd(content) {
    const cleanContent = content.replace(/^\uFEFF/, "");
    const match = cleanContent.match(FRONTMATTER_PATTERN);
    if (!match) {
      return {
        frontmatter: {},
        body: cleanContent
      };
    }
    let frontmatter = {};
    try {
      frontmatter = parseSimpleYaml(match[1]);
    } catch (err) {
      console.warn("Failed to parse skill frontmatter:", err);
    }
    return {
      frontmatter,
      body: match[2]
    };
  }
  function parseSimpleYaml(yamlText) {
    const result = {};
    const lines = yamlText.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      if (key) {
        result[key] = value;
      }
    }
    return result;
  }
  function getEntryName(entry) {
    if (entry == null ? void 0 : entry.name) return entry.name;
    if (entry == null ? void 0 : entry.uri) {
      const parts = entry.uri.split("/").filter(Boolean);
      return parts[parts.length - 1] || "\u672A\u547D\u540D";
    }
    return "\u672A\u547D\u540D";
  }

  // src/panels/skill-store/version-history.js
  var SOURCE_LABELS = {
    manual_upload: "\u624B\u52A8\u4E0A\u4F20",
    generated: "\u81EA\u52A8\u751F\u6210",
    optimized: "\u81EA\u52A8\u4F18\u5316",
    rollback: "\u5386\u53F2\u6062\u590D",
    current: "\u5F53\u524D\u6587\u4EF6"
  };
  function toPositiveInteger(value) {
    if (value === null || value === void 0 || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  function toText(value) {
    return value === null || value === void 0 ? "" : String(value);
  }
  function escapeHtml(value) {
    return toText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatVersionLabel(value) {
    const raw = toText(value).trim();
    if (!raw) return "\u2014";
    const prefixed = raw.match(/^v(\d+)$/i);
    if (prefixed) return `v${Number(prefixed[1])}`;
    const version = toPositiveInteger(raw);
    return version === null ? raw : `v${version}`;
  }
  function areSkillVersionsEquivalent(left, right) {
    const normalize = (value) => {
      const raw = toText(value).trim().replace(/^v/i, "");
      return toPositiveInteger(raw);
    };
    const leftVersion = normalize(left);
    const rightVersion = normalize(right);
    return leftVersion !== null && leftVersion === rightVersion;
  }
  function formatVersionDate(value) {
    if (!value) return "\u2014";
    const date = typeof value === "number" ? new Date(value * 1e3) : new Date(value);
    if (Number.isNaN(date.getTime())) return "\u2014";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function getVersionSourceLabel(source) {
    const normalized = toText(source).trim();
    return SOURCE_LABELS[normalized] || "\u672A\u77E5\u6765\u6E90";
  }
  function getSkillApiName(skill) {
    const dirName = toText(skill == null ? void 0 : skill.dirName).trim();
    if (dirName) return dirName;
    return toText(skill == null ? void 0 : skill.name).trim();
  }
  function formatSkillCommand(skill) {
    const apiName = getSkillApiName(skill).replace(/^\/+/, "");
    return apiName ? `/${apiName}` : "";
  }
  function classifyVersionError(error) {
    const status = Number(error == null ? void 0 : error.status);
    if (status === 404 || status === 405) return "unsupported";
    if (status === 401 || status === 403) return "auth";
    const message = toText(error == null ? void 0 : error.message).toLowerCase();
    if ((error == null ? void 0 : error.name) === "AbortError" || message.includes("aborted") || message.includes("timeout")) {
      return "timeout";
    }
    if (message.includes("failed to fetch") || message.includes("network")) {
      return "network";
    }
    return "error";
  }
  function normalizeSkillVersionHistory(payload) {
    var _a;
    const rawPayload = payload && typeof payload === "object" ? payload : {};
    const rawVersions = Array.isArray(rawPayload.versions) ? rawPayload.versions : [];
    const versionsByNumber = /* @__PURE__ */ new Map();
    for (const item of rawVersions) {
      if (!item || typeof item !== "object") continue;
      const version = toPositiveInteger(item.version);
      if (version === null) continue;
      versionsByNumber.set(version, {
        version,
        parentVersion: toPositiveInteger(item.parent_version),
        source: toText(item.source),
        runId: toText(item.run_id),
        createdAt: toText(item.created_at),
        current: item.current === true,
        hash: toText(item.hash),
        exists: item.exists !== false
      });
    }
    let currentVersion = toPositiveInteger(rawPayload.current_version);
    if (currentVersion === null) {
      currentVersion = ((_a = [...versionsByNumber.values()].find((item) => item.current)) == null ? void 0 : _a.version) || null;
    }
    const versions = [...versionsByNumber.values()].map((item) => ({
      ...item,
      current: currentVersion !== null && item.version === currentVersion
    })).sort((a, b) => b.version - a.version);
    return {
      name: toText(rawPayload.name),
      currentVersion,
      versions
    };
  }

  // src/panels/skill-store/skill-list.js
  function getEntryUpdatedAt(entry) {
    return (entry == null ? void 0 : entry.updated_at) || (entry == null ? void 0 : entry.modTime) || (entry == null ? void 0 : entry.mtime) || (entry == null ? void 0 : entry.modifiedAt);
  }
  function getEntryBaseUri(entry, dirName, skillRootUri) {
    if (typeof (entry == null ? void 0 : entry.uri) === "string" && entry.uri.trim()) {
      return entry.uri.replace(/\/$/, "");
    }
    return `${skillRootUri}/${dirName}`;
  }
  async function readSkillEntry(entry, readSkill, options) {
    var _a;
    const dirName = getEntryName(entry);
    const baseUri = getEntryBaseUri(entry, dirName, options.skillRootUri);
    try {
      const readResult = await readSkill(`${baseUri}/SKILL.md`);
      const content = typeof readResult === "string" ? readResult : (readResult == null ? void 0 : readResult.content) ?? (readResult == null ? void 0 : readResult.text) ?? "";
      const { frontmatter, body } = parseSkillMd(content);
      return {
        name: frontmatter.name || dirName,
        dirName,
        description: frontmatter.description || (entry == null ? void 0 : entry.abstract) || "",
        uri: baseUri,
        rawContent: body.slice(0, 1e3),
        fullContent: content,
        modifiedAt: getEntryUpdatedAt(entry),
        version: frontmatter.version,
        author: frontmatter.author
      };
    } catch (error) {
      try {
        (_a = options.onReadError) == null ? void 0 : _a.call(options, error, dirName);
      } catch {
      }
      return {
        name: dirName,
        dirName,
        description: (entry == null ? void 0 : entry.abstract) || "\u5185\u5BB9\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6",
        uri: baseUri,
        rawContent: "",
        fullContent: "",
        modifiedAt: getEntryUpdatedAt(entry),
        contentUnavailable: true
      };
    }
  }
  async function readSkillEntries(entries, readSkill, options = {}) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    if (sourceEntries.length === 0) return [];
    if (typeof readSkill !== "function") throw new TypeError("readSkill must be a function");
    const requestedConcurrency = Number(options.concurrency);
    const concurrency = Number.isInteger(requestedConcurrency) && requestedConcurrency > 0 ? requestedConcurrency : 6;
    const settings = {
      skillRootUri: options.skillRootUri || "echo://skills",
      onReadError: options.onReadError
    };
    const results = new Array(sourceEntries.length);
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < sourceEntries.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await readSkillEntry(sourceEntries[index], readSkill, settings);
      }
    }
    const workerCount = Math.min(concurrency, sourceEntries.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }
  function removeSkillByApiName(skills, apiName) {
    const target = String(apiName || "").trim();
    if (!Array.isArray(skills) || !target) return Array.isArray(skills) ? [...skills] : [];
    return skills.filter((skill) => getSkillApiName(skill) !== target);
  }
  function isSkillUseActivationKey(key) {
    return key === "Enter" || key === " ";
  }

  // src/panels/skill-store/upload.js
  var MAX_SINGLE_SKILL_BYTES = 10 * 1024 * 1024;
  var MAX_SKILL_PACKAGE_BYTES = 50 * 1024 * 1024;
  var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set(["md", "txt", "zip"]);
  function getSkillUploadExtension(fileName) {
    const name = String(fileName || "").trim();
    const dotIndex = name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error("\u5F53\u524D\u7248\u672C\u4EC5\u652F\u6301 .md / .txt / .zip \u683C\u5F0F Skill");
    }
    return extension;
  }
  function getSkillUploadMaxBytes(extension) {
    return extension === "zip" ? MAX_SKILL_PACKAGE_BYTES : MAX_SINGLE_SKILL_BYTES;
  }
  function validateSkillUploadFile(file) {
    const extension = getSkillUploadExtension(file == null ? void 0 : file.name);
    const maxBytes = getSkillUploadMaxBytes(extension);
    if (!Number.isFinite(file == null ? void 0 : file.size) || file.size < 0) {
      throw new Error("\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\u5927\u5C0F");
    }
    if (file.size > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(`\u6587\u4EF6\u8FC7\u5927\uFF0C${extension === "zip" ? "Skill Package" : "\u5355\u6587\u4EF6 Skill"}\u4E0D\u80FD\u8D85\u8FC7 ${maxMb} MB`);
    }
    return { extension, maxBytes };
  }
  function normalizeSkillUploadName(name, fileName) {
    const fallback = String(fileName || "").replace(/\.(md|txt|zip)$/i, "");
    return String(typeof name === "string" && name.trim() ? name : fallback).replace(/\.(md|txt|zip)$/i, "").trim();
  }
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32768;
    let binary = "";
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  // src/panels/skill-store/index.js
  var SKILL_ROOT_URI = "echo://skills";
  var SKILL_STORE_STYLES = `
  <style>
    .claw-skill-surface,
    .claw-skill-dialog,
    .claw-skill-preview-overlay {
      --skill-primary: #6750a4;
      --skill-on-primary: #ffffff;
      --skill-primary-container: #eaddff;
      --skill-on-primary-container: #21005d;
      --skill-secondary-container: #e8def8;
      --skill-surface: #fffbfe;
      --skill-surface-soft: #fef7ff;
      --skill-surface-strong: #f3edf7;
      --skill-outline: #79747e;
      --skill-outline-soft: #e7e0ec;
      --skill-text: #1d1b20;
      --skill-text-muted: #49454f;
      --skill-error: #b3261e;
      --skill-error-container: #f9dedc;
      --skill-success: #2e7d32;
      --skill-success-container: #e8f5e9;
      box-sizing: border-box;
      color: var(--skill-text);
      font-family: Roboto, "Noto Sans SC", sans-serif;
    }

    .claw-skill-surface *,
    .claw-skill-dialog *,
    .claw-skill-preview-overlay * {
      box-sizing: border-box;
    }

    .claw-skill-surface {
      width: 100%;
    }

    .claw-skill-home,
    .claw-skill-list,
    .claw-skill-upload {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .claw-skill-list-page {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .claw-skill-intro {
      position: relative;
      overflow: hidden;
      padding: 16px;
      border: 1px solid #d0bcff;
      border-radius: 20px;
      background: linear-gradient(135deg, #fef7ff 0%, #f3edff 58%, #eaddff 100%);
    }

    .claw-skill-intro::after {
      content: "";
      position: absolute;
      top: -34px;
      right: -26px;
      width: 104px;
      height: 104px;
      border: 18px solid rgba(103, 80, 164, 0.08);
      border-radius: 50%;
      pointer-events: none;
    }

    .claw-skill-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 7px;
      color: var(--skill-primary);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .claw-skill-intro-title {
      position: relative;
      z-index: 1;
      margin: 0;
      color: var(--skill-on-primary-container);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-intro-copy {
      position: relative;
      z-index: 1;
      max-width: 270px;
      margin: 4px 0 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .claw-skill-home-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    button.claw-skill-section {
      width: 100%;
      min-height: 74px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 13px 14px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.88);
      color: var(--skill-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    button.claw-skill-section:hover {
      transform: translateY(-2px);
      border-color: #d0bcff;
      background: var(--skill-surface-soft);
      box-shadow: 0 8px 20px rgba(33, 0, 93, 0.08);
    }

    button.claw-skill-section:focus-visible,
    .claw-skill-search-input:focus-visible,
    .claw-skill-refresh:focus-visible,
    .claw-skill-action:focus-visible,
    .claw-skill-dialog-button:focus-visible,
    .claw-skill-btn-detail:focus-visible,
    .claw-skill-btn-delete:focus-visible,
    .claw-skill-btn-view-full:focus-visible,
    .claw-skill-item-use-target:focus-visible,
    .claw-skill-version-view:focus-visible,
    .claw-skill-version-rollback:focus-visible,
    .claw-skill-version-retry:focus-visible {
      outline: 3px solid rgba(103, 80, 164, 0.22);
      outline-offset: 2px;
    }

    .claw-skill-section-icon,
    .claw-skill-upload-icon,
    .claw-skill-dialog-icon,
    .claw-skill-state-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      color: var(--skill-primary);
      background: var(--skill-primary-container);
    }

    .claw-skill-section-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    .claw-skill-section-copy {
      min-width: 0;
      flex: 1;
    }

    .claw-skill-section-title {
      display: block;
      margin: 0 0 3px;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.35;
    }

    .claw-skill-section-desc {
      display: block;
      margin: 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .claw-skill-chevron {
      flex: 0 0 auto;
      color: var(--skill-outline);
      transition: transform 180ms ease, color 180ms ease;
    }

    button.claw-skill-section:hover .claw-skill-chevron {
      color: var(--skill-primary);
      transform: translateX(2px);
    }

    .claw-skill-page-note {
      margin: 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .claw-skill-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .claw-skill-search-shell {
      position: relative;
      min-width: 0;
      flex: 1;
    }

    .claw-skill-search-shell > svg {
      position: absolute;
      top: 50%;
      left: 13px;
      color: var(--skill-text-muted);
      pointer-events: none;
      transform: translateY(-50%);
    }

    .claw-skill-search-input {
      width: 100%;
      height: 42px;
      padding: 0 13px 0 39px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 14px;
      outline: none;
      background: rgba(255, 255, 255, 0.9);
      color: var(--skill-text);
      font: inherit;
      font-size: 13px;
      transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    .claw-skill-search-input::placeholder {
      color: #79747e;
    }

    .claw-skill-search-input:hover {
      border-color: #c4bdc8;
    }

    .claw-skill-search-input:focus {
      border-color: var(--skill-primary);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.1);
    }

    .claw-skill-refresh,
    .claw-skill-action,
    .claw-skill-dialog-button,
    .claw-skill-btn-detail,
    .claw-skill-btn-view-full,
    .claw-skill-btn-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 999px;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .claw-skill-refresh {
      height: 42px;
      flex: 0 0 auto;
      padding: 0 14px;
      border: 1px solid #d0bcff;
      background: var(--skill-surface);
      color: var(--skill-primary);
      font-size: 12px;
    }

    .claw-skill-refresh:hover,
    .claw-skill-btn-view-full:hover {
      background: var(--skill-primary-container);
      border-color: #b69df8;
    }

    .claw-skill-refresh:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .claw-skill-notice {
      align-items: flex-start;
      gap: 9px;
      padding: 11px 12px;
      border: 1px solid #d0bcff;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      box-shadow: 0 4px 12px rgba(29, 27, 32, 0.05);
    }

    .claw-skill-notice > svg {
      flex: 0 0 auto;
      margin-top: 1px;
    }

    .claw-skill-state {
      min-height: 164px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 18px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      text-align: center;
    }

    .claw-skill-state-icon {
      width: 46px;
      height: 46px;
      margin-bottom: 12px;
      border-radius: 15px;
    }

    .claw-skill-state-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-state-copy {
      max-width: 250px;
      margin: 5px 0 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .claw-skill-spinner {
      animation: claw-skill-spin 900ms linear infinite;
    }

    .claw-skill-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .claw-skill-item {
      padding: 14px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.035);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    .claw-skill-item:hover {
      transform: translateY(-1px);
      border-color: #d0bcff;
      background: var(--skill-surface-soft);
      box-shadow: 0 7px 18px rgba(33, 0, 93, 0.08);
    }

    .claw-skill-item-head {
      display: block;
    }

    .claw-skill-item-use-target {
      border-radius: 10px;
      outline: none;
    }

    .claw-skill-item-copy {
      min-width: 0;
    }

    .claw-skill-item-title {
      display: -webkit-box;
      overflow: hidden;
      margin: 0 0 6px;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.42;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .claw-skill-item-desc {
      display: -webkit-box;
      overflow: hidden;
      margin: 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .claw-skill-item-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 11px;
      padding-top: 10px;
      border-top: 1px solid var(--skill-outline-soft);
    }

    .claw-skill-item-meta {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      min-height: 22px;
      margin: 0;
      padding: 2px 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--skill-surface-strong);
      color: var(--skill-text-muted);
      font-size: 10px;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .claw-skill-item-actions {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-left: auto;
      flex: 0 0 auto;
    }

    .claw-skill-btn-delete {
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid #f2b8b5;
      background: #fff8f7;
      color: var(--skill-error);
      font-size: 11px;
    }

    .claw-skill-btn-delete:hover {
      background: var(--skill-error-container);
      border-color: #e49b97;
    }

    .claw-skill-btn-delete:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .claw-skill-btn-detail {
      min-height: 28px;
      padding: 0 11px;
      border: 1px solid #d0bcff;
      background: #ffffff;
      color: var(--skill-primary);
      font-size: 11px;
    }

    .claw-skill-btn-detail:hover {
      background: var(--skill-primary-container);
    }

    .claw-skill-toggle-icon {
      margin-top: 0;
      color: var(--skill-outline);
      transition: transform 180ms ease, color 180ms ease;
    }

    .claw-skill-item:hover .claw-skill-toggle-icon {
      color: var(--skill-primary);
    }

    .claw-skill-detail {
      margin-top: 13px;
      padding-top: 13px;
      border-top: 1px solid var(--skill-outline-soft);
    }

    .claw-skill-detail-page {
      display: flex;
      flex-direction: column;
      gap: 14px;
      outline: none;
    }

    .claw-skill-detail-hero {
      position: relative;
      overflow: hidden;
      padding: 15px 16px 15px 18px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 4px 14px rgba(29, 27, 32, 0.045);
    }

    .claw-skill-detail-hero::before {
      content: "";
      position: absolute;
      inset: 12px auto 12px 0;
      width: 4px;
      border-radius: 0 4px 4px 0;
      background: var(--skill-primary);
    }

    .claw-skill-detail-eyebrow {
      display: block;
      margin-bottom: 5px;
      color: var(--skill-primary);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
    }

    .claw-skill-detail-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
      word-break: break-word;
    }

    .claw-skill-detail-summary {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px 9px;
      margin-top: 8px;
    }

    .claw-skill-detail-command {
      display: inline-flex;
      min-width: 0;
      padding: 3px 8px;
      overflow: hidden;
      border-radius: 7px;
      background: #f1e9ff;
      color: var(--skill-on-primary-container);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .claw-skill-detail-meta {
      margin: 0;
      color: var(--skill-outline);
      font-size: 10px;
      line-height: 1.4;
    }

    .claw-skill-detail-sheet {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .claw-skill-detail-section {
      padding: 14px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.03);
    }

    .claw-skill-detail > .claw-skill-detail-section {
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .claw-skill-detail > .claw-skill-detail-section + .claw-skill-detail-section {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--skill-outline-soft);
    }

    .claw-skill-detail > .claw-skill-detail-resource {
      margin-top: 12px;
    }

    .claw-skill-detail-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }

    .claw-skill-detail-section-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-detail-description,
    .claw-skill-detail-empty,
    .claw-skill-code-preview {
      font-size: 12px;
      line-height: 1.6;
    }

    .claw-skill-detail-description {
      margin: 0;
      color: var(--skill-text-muted);
    }

    .claw-skill-detail-empty {
      padding: 12px;
      border-radius: 10px;
      background: #f7f5f8;
      color: var(--skill-outline);
    }

    .claw-skill-code-preview {
      max-height: 260px;
      padding: 12px;
      overflow-y: auto;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 12px;
      background: #f8f7f9;
      color: #363139;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .claw-skill-detail-resource {
      display: grid;
      gap: 6px;
      padding: 3px 2px;
    }

    .claw-skill-uri {
      display: block;
      width: 100%;
      color: var(--skill-outline);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: normal;
      word-break: break-word;
    }

    .claw-skill-btn-view-full {
      min-height: 28px;
      flex: 0 0 auto;
      padding: 0 9px;
      border: 1px solid var(--skill-outline-soft);
      background: #ffffff;
      color: var(--skill-primary);
      font-size: 10px;
    }

    .claw-skill-version-history {
      min-height: 42px;
    }

    .claw-skill-version-state {
      padding: 12px;
      border-radius: 10px;
      background: #f7f5f8;
      color: var(--skill-outline);
      font-size: 11px;
      line-height: 1.5;
      text-align: center;
    }

    .claw-skill-version-state-error {
      border: 1px solid #f1c7c3;
      background: #fff5f4;
      color: var(--skill-error);
      text-align: left;
    }

    .claw-skill-version-state-error p {
      margin: 0;
    }

    .claw-skill-version-retry {
      margin-top: 8px;
      padding: 5px 10px;
      border: 1px solid #e8aaa5;
      border-radius: 999px;
      background: #ffffff;
      color: var(--skill-error);
      font: inherit;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }

    .claw-skill-version-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .claw-skill-version-item {
      padding: 10px 11px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 12px;
      background: #ffffff;
    }

    .claw-skill-version-item-current {
      border-color: #d0bcff;
      background: #fbf8ff;
      box-shadow: inset 3px 0 0 var(--skill-primary);
    }

    .claw-skill-version-row,
    .claw-skill-version-labels,
    .claw-skill-version-actions {
      display: flex;
      align-items: center;
    }

    .claw-skill-version-row {
      align-items: flex-start;
      justify-content: space-between;
      gap: 9px;
    }

    .claw-skill-version-main {
      min-width: 0;
      flex: 1;
    }

    .claw-skill-version-labels {
      flex-wrap: wrap;
      gap: 5px 7px;
    }

    .claw-skill-version-current-badge {
      padding: 2px 6px;
      border-radius: 999px;
      background: var(--skill-primary);
      color: var(--skill-on-primary);
      font-size: 9px;
      font-weight: 600;
    }

    .claw-skill-version-number {
      color: var(--skill-text);
      font-size: 12px;
    }

    .claw-skill-version-source,
    .claw-skill-version-date {
      color: var(--skill-text-muted);
      font-size: 10px;
    }

    .claw-skill-version-date {
      color: var(--skill-outline);
    }

    .claw-skill-version-details {
      margin: 5px 0 0;
      color: var(--skill-outline);
      font-size: 9px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .claw-skill-version-actions {
      flex: 0 0 auto;
      flex-direction: column;
      align-items: stretch;
      gap: 5px;
    }

    .claw-skill-version-view,
    .claw-skill-version-rollback {
      min-height: 27px;
      padding: 0 9px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 999px;
      background: #ffffff;
      font: inherit;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }

    .claw-skill-version-view {
      color: var(--skill-primary);
    }

    .claw-skill-version-rollback {
      border-color: #f0c99a;
      background: #fffaf3;
      color: #8a4c12;
    }

    .claw-skill-version-view:hover,
    .claw-skill-version-rollback:hover {
      background: var(--skill-primary-container);
      border-color: #d0bcff;
    }

    .claw-skill-version-view:disabled,
    .claw-skill-version-rollback:disabled {
      border-color: var(--skill-outline-soft);
      background: #f3f1f4;
      color: #aaa4ad;
      cursor: not-allowed;
    }

    .claw-skill-dropzone {
      position: relative;
      overflow: hidden;
      padding: 30px 20px;
      border: 1.5px dashed #a99db3;
      border-radius: 20px;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.86), rgba(243, 237, 247, 0.94));
      text-align: center;
      cursor: pointer;
      transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .claw-skill-dropzone:hover {
      transform: translateY(-1px);
      border-color: var(--skill-primary);
      background: #f3edf7;
      box-shadow: 0 8px 22px rgba(33, 0, 93, 0.08);
    }

    .claw-skill-upload-icon {
      width: 52px;
      height: 52px;
      margin: 0 auto 12px;
      border-radius: 18px;
      box-shadow: 0 6px 16px rgba(103, 80, 164, 0.12);
    }

    .claw-skill-dropzone-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.45;
    }

    .claw-skill-dropzone-copy {
      max-width: 290px;
      margin: 5px auto 0;
      color: var(--skill-text-muted);
      font-size: 11px;
      line-height: 1.55;
    }

    .claw-skill-format-row {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
    }

    .claw-skill-format-chip {
      padding: 3px 8px;
      border: 1px solid #d0bcff;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);
      color: var(--skill-primary);
      font-size: 10px;
      font-weight: 600;
    }

    .claw-skill-guide {
      padding: 14px 15px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.76);
    }

    .claw-skill-guide-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 9px;
      color: var(--skill-on-primary-container);
      font-size: 13px;
      font-weight: 600;
    }

    .claw-skill-guide-title > span {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: var(--skill-primary-container);
      color: var(--skill-primary);
    }

    .claw-skill-guide-list {
      margin: 0;
      padding-left: 20px;
      color: var(--skill-text-muted);
      font-size: 11px;
      line-height: 1.75;
    }

    .claw-skill-guide-list li::marker {
      color: var(--skill-primary);
    }

    .claw-skill-guide-list code {
      padding: 2px 5px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 5px;
      background: var(--skill-surface-strong);
      color: var(--skill-on-primary-container);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10px;
    }

    .claw-skill-dialog {
      min-height: 172px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 17px;
      padding: 18px 22px 22px;
      text-align: center;
    }

    .claw-skill-dialog-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 10px;
      border-radius: 16px;
    }

    .claw-skill-dialog-icon.is-danger {
      color: var(--skill-error);
      background: var(--skill-error-container);
    }

    .claw-skill-dialog-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-dialog-copy {
      margin: 5px auto 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .claw-skill-dialog-copy strong {
      color: var(--skill-text);
      font-weight: 600;
    }

    .claw-skill-dialog-actions {
      display: flex;
      justify-content: center;
      gap: 9px;
    }

    .claw-skill-dialog-button {
      min-width: 108px;
      min-height: 38px;
      padding: 0 17px;
      border: 1px solid #d0bcff;
      background: var(--skill-surface);
      color: var(--skill-primary);
      font-size: 12px;
    }

    .claw-skill-dialog-button:hover {
      background: var(--skill-primary-container);
    }

    .claw-skill-dialog-button.is-primary {
      border-color: transparent;
      background: linear-gradient(135deg, #6750a4 0%, #21005d 100%);
      color: var(--skill-on-primary);
      box-shadow: 0 5px 14px rgba(33, 0, 93, 0.2);
    }

    .claw-skill-dialog-button.is-primary:hover {
      background: linear-gradient(135deg, #7b61b5 0%, #3a1860 100%);
      box-shadow: 0 7px 18px rgba(33, 0, 93, 0.24);
    }

    .claw-skill-dialog-button.is-danger {
      border-color: transparent;
      background: var(--skill-error);
      color: #ffffff;
      box-shadow: 0 5px 14px rgba(179, 38, 30, 0.18);
    }

    .claw-skill-dialog-button.is-danger:hover {
      background: #8c1d18;
    }

    .claw-skill-preview-overlay {
      min-height: 100%;
      padding: 18px 20px 24px;
      background: var(--skill-surface);
      color: #363139;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.75;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .claw-skill-state.is-error {
      border-color: #f2b8b5;
      background: #fff8f7;
    }

    .claw-skill-state.is-error .claw-skill-state-icon {
      color: var(--skill-error);
      background: var(--skill-error-container);
    }

    .claw-skill-state.is-error .claw-skill-state-title {
      color: var(--skill-error);
    }

    @keyframes claw-skill-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .claw-skill-surface *,
      .claw-skill-dialog *,
      .claw-skill-preview-overlay * {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
`;
  function getSkillIcon(name, size = 20, className = "") {
    const paths = {
      sparkles: '<path d="M12 3l1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z"/><path d="M18 13l.8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z"/><path d="M6 14l.9 2.6L9.5 17.5l-2.6.9L6 21l-.9-2.6-2.6-.9 2.6-.9L6 14Z"/>',
      history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
      upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>',
      settings: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
      chevronRight: '<path d="m9 18 6-6-6-6"/>',
      chevronDown: '<path d="m6 9 6 6 6-6"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.4 9A7 7 0 0 0 6.2 6.2L4 8"/><path d="M5.6 15A7 7 0 0 0 17.8 17.8L20 16"/>',
      spinner: '<circle cx="12" cy="12" r="8" opacity=".22"/><path d="M20 12a8 8 0 0 0-8-8"/>',
      folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/><path d="M3 10h18"/>',
      trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
      file: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
      alert: '<path d="M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 16.5h.01"/>',
      clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 10h6M9 14h6M9 18h4"/>'
    };
    const iconPaths = paths[name] || paths.info;
    return `<svg${className ? ` class="${className}"` : ""} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths}</svg>`;
  }
  function setSkillNoticeContent(element, message, type) {
    const iconName = type === "success" ? "check" : type === "error" ? "alert" : "info";
    const iconWrapper = document.createElement("span");
    iconWrapper.innerHTML = getSkillIcon(iconName, 17);
    const icon = iconWrapper.firstElementChild;
    const text = document.createElement("span");
    text.textContent = message;
    element.replaceChildren(...icon ? [icon, text] : [text]);
  }
  function isDirectory(entry) {
    var _a, _b;
    if (entry.kind) return entry.kind === "directory";
    return entry.isDir || entry.is_dir || ((_a = entry.stat) == null ? void 0 : _a.isDir) || ((_b = entry.stat) == null ? void 0 : _b.is_dir) || false;
  }
  function getSkillStoreHomeContent() {
    const sections = [
      { id: "history", title: "\u6211\u7684 Skill", desc: "\u6D4F\u89C8\u5DF2\u4F7F\u7528\u7684\u80FD\u529B\u4E0E\u5185\u5BB9\u8BE6\u60C5", icon: "history" },
      { id: "upload", title: "\u4E0A\u4F20 Skill", desc: "\u5BFC\u5165\u7B26\u5408 SKILL.md \u683C\u5F0F\u7684\u81EA\u5B9A\u4E49\u80FD\u529B", icon: "upload" },
      { id: "manage", title: "\u5B89\u88C5\u7BA1\u7406", desc: "\u67E5\u770B\u5E76\u7EF4\u62A4\u5F53\u524D\u5DF2\u5B89\u88C5\u7684 Skill", icon: "settings" }
    ];
    const cards = sections.map((s) => `
    <button type="button" class="claw-skill-section" data-section="${s.id}">
      <span class="claw-skill-section-icon">${getSkillIcon(s.icon, 22)}</span>
      <span class="claw-skill-section-copy">
        <span class="claw-skill-section-title">${s.title}</span>
        <span class="claw-skill-section-desc">${s.desc}</span>
      </span>
      ${getSkillIcon("chevronRight", 18, "claw-skill-chevron")}
    </button>
  `).join("");
    return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-home">
      <section class="claw-skill-intro">
        <span class="claw-skill-eyebrow">${getSkillIcon("sparkles", 13)} Skill Library</span>
        <p class="claw-skill-intro-title">\u8BA9\u5E38\u7528\u80FD\u529B\u4FDD\u6301\u6709\u5E8F</p>
        <p class="claw-skill-intro-copy">\u4ECE\u8FD9\u91CC\u6D4F\u89C8\u3001\u5BFC\u5165\u548C\u7EF4\u62A4\u4F60\u7684 Skill\uFF0C\u6240\u6709\u64CD\u4F5C\u90FD\u96C6\u4E2D\u5728\u540C\u4E00\u5904\u3002</p>
      </section>
      <div class="claw-skill-home-list">
        ${cards}
      </div>
    </div>
  `;
  }
  function getSkillHistoryContent() {
    return getSkillListContent("\u6211\u7684 Skill");
  }
  function getSkillManageContent() {
    return getSkillListContent("\u5B89\u88C5\u7BA1\u7406", { showDelete: true });
  }
  function getSkillListContent(title, options = {}) {
    const pageNote = options.showDelete ? "\u5C55\u5F00\u6761\u76EE\u67E5\u770B\u5185\u5BB9\uFF0C\u6216\u79FB\u9664\u4E0D\u518D\u9700\u8981\u7684 Skill\u3002" : "\u70B9\u51FB\u5361\u7247\u76F4\u63A5\u4F7F\u7528\uFF1B\u70B9\u51FB\u300C\u8BE6\u60C5\u300D\u8FDB\u5165\u5B8C\u6574\u4FE1\u606F\u4E0E\u7248\u672C\u5386\u53F2\u3002";
    return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-list">
      <!-- \u5217\u8868\u4E0E\u8BE6\u60C5\u9875\u5171\u7528\u7684\u72B6\u6001\u63D0\u793A -->
      <div id="claw-skill-toast" class="claw-skill-notice claw-skill-toast" role="status" aria-live="polite" style="display: none;"></div>

      <div id="claw-skill-list-page" class="claw-skill-list-page">
        <p class="claw-skill-page-note">${pageNote}</p>
        <!-- \u641C\u7D22\u6846 -->
        <div class="claw-skill-toolbar">
          <div class="claw-skill-search-shell">
            ${getSkillIcon("search", 17)}
            <input class="claw-skill-search-input" type="text" id="claw-skill-search" placeholder="\u641C\u7D22 Skill \u540D\u79F0\u6216\u63CF\u8FF0..." aria-label="\u641C\u7D22 ${title}">
          </div>
          <button type="button" id="claw-skill-btn-refresh" class="claw-skill-refresh">
            ${getSkillIcon("refresh", 15)}
            \u5237\u65B0
          </button>
        </div>

        <!-- \u52A0\u8F7D\u4E2D -->
        <div id="claw-skill-list-loading" class="claw-skill-state" role="status" aria-live="polite">
          <span class="claw-skill-state-icon">${getSkillIcon("spinner", 23, "claw-skill-spinner")}</span>
          <p class="claw-skill-state-title">\u6B63\u5728\u52A0\u8F7D Skill</p>
          <p class="claw-skill-state-copy">\u6B63\u5728\u540C\u6B65\u4F60\u7684\u80FD\u529B\u5217\u8868\uFF0C\u8BF7\u7A0D\u5019\u3002</p>
        </div>

        <!-- \u5217\u8868\u5185\u5BB9 -->
        <div id="claw-skill-list-content" style="display: none;"></div>
      </div>

      <!-- \u72EC\u7ACB\u8BE6\u60C5\u9875 -->
      <div id="claw-skill-detail-page" class="claw-skill-detail-page" tabindex="-1" style="display: none;"></div>
    </div>
  `;
  }
  function getSkillUploadContent() {
    return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-upload">
      <p class="claw-skill-page-note">\u4E0A\u4F20\u524D\u4F1A\u5148\u6821\u9A8C\u6587\u4EF6\uFF1B\u82E5\u5B58\u5728\u540C\u540D Skill\uFF0C\u786E\u8BA4\u540E\u5C06\u8986\u76D6\u539F\u5185\u5BB9\u3002</p>
      <!-- \u4E0A\u4F20\u533A\u57DF -->
      <div id="claw-skill-dropzone" class="claw-skill-dropzone" aria-label="\u9009\u62E9\u6216\u62D6\u653E Skill \u6587\u4EF6">
        <span class="claw-skill-upload-icon">${getSkillIcon("upload", 25)}</span>
        <p class="claw-skill-dropzone-title">\u70B9\u51FB\u9009\u62E9\u6216\u62D6\u62FD\u6587\u4EF6\u5230\u8FD9\u91CC</p>
        <p class="claw-skill-dropzone-copy">\u652F\u6301 SKILL.md \u5355\u6587\u4EF6\u548C\u5B8C\u6574 Skill Package\uFF1B\u5355\u6587\u4EF6\u4E0D\u8D85\u8FC7 10 MB\uFF0CZIP \u4E0D\u8D85\u8FC7 50 MB\u3002</p>
        <div class="claw-skill-format-row" aria-hidden="true">
          <span class="claw-skill-format-chip">.MD</span>
          <span class="claw-skill-format-chip">.TXT</span>
          <span class="claw-skill-format-chip">.ZIP</span>
        </div>
        <input type="file" id="claw-skill-file-input" accept=".md,.txt,.zip" style="display: none;" />
      </div>

      <!-- \u72B6\u6001\u63D0\u793A -->
      <div id="claw-skill-upload-status" class="claw-skill-notice claw-skill-upload-status" role="status" aria-live="polite" style="display: none;"></div>

      <!-- \u4E0A\u4F20\u987B\u77E5 -->
      <div class="claw-skill-guide">
        <p class="claw-skill-guide-title"><span>${getSkillIcon("clipboard", 16)}</span>\u4E0A\u4F20\u987B\u77E5</p>
        <ul class="claw-skill-guide-list">
          <li>SKILL.md \u5FC5\u987B\u4EE5 <code>---</code> \u5F00\u5934</li>
          <li>ZIP Package \u5FC5\u987B\u5305\u542B <code>SKILL.md</code>\uFF0C\u53EF\u9644\u5E26 scripts\u3001assets\u3001templates\u3001references \u7B49\u76EE\u5F55</li>
          <li>ZIP \u4E2D\u7981\u6B62\u9690\u85CF\u76EE\u5F55\u3001<code>.git</code>\u3001<code>.skill_evolution</code>\u3001\u8DEF\u5F84\u7A7F\u8D8A\u548C\u53EF\u6267\u884C\u6587\u4EF6\uFF1B\u6700\u7EC8\u7531 EchoMem \u670D\u52A1\u7AEF\u6821\u9A8C</li>
          <li>Skill \u540D\u79F0\u4F18\u5148\u53D6 frontmatter \u4E2D\u7684 <code>name</code>\uFF1B\u5355\u6587\u4EF6\u672A\u586B\u5199\u65F6\u53D6\u6587\u4EF6\u540D\uFF08\u53BB\u6389\u6269\u5C55\u540D\uFF09</li>
          <li>Skill \u540D\u79F0\u4EC5\u652F\u6301\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u3001\u77ED\u6A2A\u7EBF\uFF08\u6B63\u5219 <code>^[\\w-]+$</code>\uFF09</li>
          <li>\u5982\u5B58\u5728\u540C\u540D Skill\uFF0C\u5C06\u76F4\u63A5\u8986\u76D6</li>
          <li>\u524D\u7AEF\u6821\u9A8C\u4EC5\u4F9B\u53C2\u8003\uFF0C\u6700\u7EC8\u683C\u5F0F\u4EE5\u670D\u52A1\u7AEF\u89E3\u6790\u4E3A\u51C6</li>
          <li>\u4E0A\u4F20\u6210\u529F\u540E\u53EF\u5728\u300C\u6211\u7684 Skill\u300D\u4E2D\u67E5\u770B</li>
        </ul>
      </div>
    </div>
  `;
  }
  async function initSkillUploadPanel(bodyElement) {
    if (!bodyElement) return;
    const dropzone = bodyElement.querySelector("#claw-skill-dropzone");
    const fileInput = bodyElement.querySelector("#claw-skill-file-input");
    const statusEl = bodyElement.querySelector("#claw-skill-upload-status");
    if (!dropzone || !fileInput) return;
    function showStatus(msg, type = "info") {
      if (!statusEl) return;
      statusEl.style.display = "flex";
      const colors = {
        info: { bg: "#f3edf7", border: "#d0bcff", text: "#4f378b" },
        success: { bg: "#e8f5e9", border: "#a5d6a7", text: "#1b5e20" },
        error: { bg: "#f9dedc", border: "#f2b8b5", text: "#8c1d18" }
      };
      const c = colors[type] || colors.info;
      statusEl.style.background = c.bg;
      statusEl.style.border = `1px solid ${c.border}`;
      statusEl.style.color = c.text;
      setSkillNoticeContent(statusEl, msg, type);
    }
    function formatError(err) {
      var _a, _b, _c, _d;
      if (err.name === "AbortError" || ((_a = err.message) == null ? void 0 : _a.includes("aborted"))) {
        return "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u540E\u7AEF\u662F\u5426\u6B63\u5E38\u8FD0\u884C\u6216\u7F51\u7EDC\u8FDE\u63A5";
      }
      if ((_b = err.message) == null ? void 0 : _b.includes("Failed to fetch")) {
        return "\u65E0\u6CD5\u8FDE\u63A5\u5230\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5730\u5740\u548C\u8BA4\u8BC1\u914D\u7F6E";
      }
      if (((_c = err.message) == null ? void 0 : _c.includes("401")) || ((_d = err.message) == null ? void 0 : _d.includes("403"))) {
        return "\u8BA4\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5728 EchoMem \u4E3B\u9875\u7684\u300C\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\u8FDE\u63A5\u914D\u7F6E\u300D\u4E2D\u68C0\u67E5 API Key";
      }
      return err.message;
    }
    function normalizeSkillName(name, fileName) {
      return normalizeSkillUploadName(name, fileName);
    }
    async function validateFile(file) {
      const { extension: ext } = validateSkillUploadFile(file);
      if (ext === "md" || ext === "txt") {
        const text = await file.text();
        if (!text.trim().startsWith("---")) {
          throw new Error("SKILL.md \u5FC5\u987B\u4EE5 --- \u5F00\u5934");
        }
        const { frontmatter } = parseSkillMd(text);
        const skillName = normalizeSkillName(frontmatter.name, file.name);
        if (!skillName) {
          throw new Error("frontmatter \u4E2D\u5FC5\u987B\u5305\u542B name \u5B57\u6BB5");
        }
      }
      return ext;
    }
    async function executeUpload(file, skillName, skillText) {
      showStatus("\u6B63\u5728\u4E0A\u4F20...", "info");
      try {
        const config = await getEchoMemConfig();
        const client2 = createClient(config);
        const { frontmatter } = parseSkillMd(skillText);
        const description = frontmatter.description || "";
        const tags = frontmatter.tags || [];
        const allowedTools = frontmatter.allowed_tools || [];
        const finalName = normalizeSkillName(frontmatter.name, file.name);
        const skillResult = await client2.addSkill({
          data: skillText,
          name: finalName || skillName,
          description,
          tags,
          allowedTools
        });
        skillCache = null;
        showStatus(`Skill\u300C${skillResult.name || finalName || skillName}\u300D\u4E0A\u4F20\u6210\u529F`, "success");
      } catch (err) {
        showStatus(`\u4E0A\u4F20\u5931\u8D25\uFF1A${formatError(err)}`, "error");
      }
    }
    async function executePackageUpload(file) {
      showStatus("\u6B63\u5728\u4E0A\u4F20 Skill Package...", "info");
      try {
        const config = await getEchoMemConfig();
        const client2 = createClient(config);
        const packageBase64 = arrayBufferToBase64(await file.arrayBuffer());
        const skillResult = await client2.addSkillPackage({
          packageBase64,
          filename: file.name
        });
        skillCache = null;
        showStatus(`Skill Package\u300C${skillResult.name || file.name}\u300D\u4E0A\u4F20\u6210\u529F`, "success");
      } catch (err) {
        showStatus(`\u4E0A\u4F20\u5931\u8D25\uFF1A${formatError(err)}`, "error");
      }
    }
    async function doUpload(file) {
      showStatus("\u6B63\u5728\u6821\u9A8C\u6587\u4EF6...", "info");
      try {
        await validateFile(file);
      } catch (err) {
        showStatus(err.message, "error");
        return;
      }
      const ext = file.name.split(".").pop().toLowerCase();
      let skillName = "";
      let skillText = "";
      if (ext === "md" || ext === "txt") {
        try {
          skillText = await file.text();
          const { frontmatter } = parseSkillMd(skillText);
          skillName = normalizeSkillName(frontmatter.name, file.name);
        } catch {
        }
      } else if (ext === "zip") {
        skillName = file.name;
      }
      if (ext !== "zip" && !skillText) {
        showStatus("\u65E0\u6CD5\u8BFB\u53D6 Skill \u5185\u5BB9", "error");
        return;
      }
      const safeName = escapeHtml(skillName);
      const dialogId = "claw-skill-confirm-" + Date.now();
      const dialogHtml = `
      <div id="${dialogId}" class="claw-skill-dialog">
        <div>
          <span class="claw-skill-dialog-icon">${getSkillIcon("upload", 23)}</span>
          <p class="claw-skill-dialog-title">\u786E\u8BA4\u4E0A\u4F20 Skill</p>
          <p class="claw-skill-dialog-copy">${ext === "zip" ? "EchoMem \u5C06\u8BFB\u53D6\u5305\u5185 SKILL.md\uFF1B\u5982\u5B58\u5728\u540C\u540D Skill\uFF0C\u5C06\u76F4\u63A5\u8986\u76D6\u3002" : `\u5982\u5B58\u5728\u540C\u540D Skill\u300C<strong>${safeName}</strong>\u300D\uFF0C\u5C06\u76F4\u63A5\u8986\u76D6\u3002`}</p>
        </div>
        <div class="claw-skill-dialog-actions">
          <button type="button" id="claw-skill-confirm-cancel" class="claw-skill-dialog-button">\u53D6\u6D88</button>
          <button type="button" id="claw-skill-confirm-ok" class="claw-skill-dialog-button is-primary">\u786E\u8BA4\u4E0A\u4F20</button>
        </div>
      </div>
    `;
      openCenterOverlay("\u4E0A\u4F20\u786E\u8BA4", dialogHtml, {
        width: "360px",
        maxWidth: "360px",
        height: "280px",
        maxHeight: "calc(100vh - 16px)",
        compactHeader: true
      });
      setTimeout(() => {
        const cancelBtn = document.getElementById("claw-skill-confirm-cancel");
        const okBtn = document.getElementById("claw-skill-confirm-ok");
        cancelBtn == null ? void 0 : cancelBtn.addEventListener("click", () => {
          closeOverlayPanel();
          statusEl.style.display = "none";
        });
        okBtn == null ? void 0 : okBtn.addEventListener("click", () => {
          closeOverlayPanel();
          if (ext === "zip") {
            executePackageUpload(file);
          } else {
            executeUpload(file, skillName, skillText);
          }
        });
      }, 50);
    }
    dropzone.addEventListener("click", (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });
    fileInput.addEventListener("change", () => {
      var _a;
      const file = (_a = fileInput.files) == null ? void 0 : _a[0];
      if (file) doUpload(file);
      fileInput.value = "";
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#6750a4";
      dropzone.style.background = "#f3edf7";
    });
    dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#a99db3";
      dropzone.style.background = "";
    });
    dropzone.addEventListener("drop", (e) => {
      var _a, _b;
      e.preventDefault();
      dropzone.style.borderColor = "#a99db3";
      dropzone.style.background = "";
      const file = (_b = (_a = e.dataTransfer) == null ? void 0 : _a.files) == null ? void 0 : _b[0];
      if (file) doUpload(file);
    });
  }
  var skillCache = null;
  async function initSkillHistoryPanel(bodyElement) {
    return initSkillListPanel(bodyElement, {
      showDelete: false,
      showVersionHistory: true,
      useOnCardClick: true
    });
  }
  async function initSkillManagePanel(bodyElement) {
    return initSkillListPanel(bodyElement, { showDelete: true, showVersionHistory: false });
  }
  async function initSkillListPanel(bodyElement, options = {}) {
    if (!bodyElement) return;
    const searchInput = bodyElement.querySelector("#claw-skill-search");
    const refreshBtn = bodyElement.querySelector("#claw-skill-btn-refresh");
    const toastEl = bodyElement.querySelector("#claw-skill-toast");
    const loadingEl = bodyElement.querySelector("#claw-skill-list-loading");
    const contentEl = bodyElement.querySelector("#claw-skill-list-content");
    const listPage = bodyElement.querySelector("#claw-skill-list-page");
    const detailPage = bodyElement.querySelector("#claw-skill-detail-page");
    const panel = bodyElement.closest(".claw-custom-panel");
    const panelTitle = panel == null ? void 0 : panel.querySelector(".claw-panel-title");
    const panelBackButton = panel == null ? void 0 : panel.querySelector(".claw-back-btn");
    const panelBody = bodyElement.closest(".claw-custom-panel-body");
    if (!loadingEl || !contentEl || !listPage || !detailPage) return;
    let allSkills = [];
    let filteredSkills = [];
    const skillVersionCache = /* @__PURE__ */ new Map();
    const skillVersionRequests = /* @__PURE__ */ new Map();
    const skillVersionContentCache = /* @__PURE__ */ new Map();
    const skillVersionContentRequests = /* @__PURE__ */ new Map();
    const rollbackInFlight = /* @__PURE__ */ new Set();
    let expandedSkillKey = null;
    let isDetailPageOpen = false;
    let listScrollTop = 0;
    let loadGeneration = 0;
    const listPageTitle = (panelTitle == null ? void 0 : panelTitle.textContent) || "\u6211\u7684 Skill";
    function showToast(msg, type = "info") {
      if (!toastEl) return;
      const colors = {
        info: { bg: "#f3edf7", border: "#d0bcff", text: "#4f378b" },
        success: { bg: "#e8f5e9", border: "#a5d6a7", text: "#1b5e20" },
        error: { bg: "#f9dedc", border: "#f2b8b5", text: "#8c1d18" }
      };
      const c = colors[type] || colors.info;
      toastEl.style.display = "flex";
      toastEl.style.background = c.bg;
      toastEl.style.border = `1px solid ${c.border}`;
      toastEl.style.color = c.text;
      setSkillNoticeContent(toastEl, msg, type);
      setTimeout(() => {
        if (toastEl) {
          toastEl.style.display = "none";
          toastEl.textContent = "";
        }
      }, 4e3);
    }
    function formatDate2(ts) {
      if (!ts) return "-";
      const d = typeof ts === "string" ? new Date(ts) : new Date(ts * 1e3);
      if (isNaN(d.getTime())) return "-";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function getVersionErrorMessage(error) {
      const kind = classifyVersionError(error);
      const messages = {
        unsupported: "\u5F53\u524D EchoMem \u7248\u672C\u6682\u4E0D\u652F\u6301\u7248\u672C\u7BA1\u7406",
        auth: "\u8BA4\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\u7684 API Key",
        timeout: "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u540E\u7AEF\u72B6\u6001\u6216\u7F51\u7EDC\u8FDE\u63A5",
        network: "\u65E0\u6CD5\u8FDE\u63A5\u5230\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5730\u5740\u548C\u7F51\u7EDC\u8FDE\u63A5"
      };
      return messages[kind] || (error == null ? void 0 : error.message) || "\u52A0\u8F7D\u7248\u672C\u4FE1\u606F\u5931\u8D25";
    }
    function getNestedCache(cache, skillKey, version) {
      var _a;
      return (_a = cache.get(skillKey)) == null ? void 0 : _a.get(version);
    }
    function setNestedCache(cache, skillKey, version, value) {
      let bucket = cache.get(skillKey);
      if (!bucket) {
        bucket = /* @__PURE__ */ new Map();
        cache.set(skillKey, bucket);
      }
      bucket.set(version, value);
    }
    function invalidateVersionCaches(skillKey = null) {
      if (!skillKey) {
        skillVersionCache.clear();
        skillVersionRequests.clear();
        skillVersionContentCache.clear();
        skillVersionContentRequests.clear();
        return;
      }
      skillVersionCache.delete(skillKey);
      skillVersionRequests.delete(skillKey);
      skillVersionContentCache.delete(skillKey);
      skillVersionContentRequests.delete(skillKey);
    }
    function renderVersionLoading(container) {
      if (!container) return;
      container.innerHTML = `
      <div class="claw-skill-version-state">
        \u6B63\u5728\u52A0\u8F7D\u7248\u672C\u5386\u53F2...
      </div>
    `;
    }
    function renderVersionError(container, skill, error) {
      var _a;
      if (!container) return;
      const kind = classifyVersionError(error);
      const retryable = !["unsupported", "auth"].includes(kind);
      container.innerHTML = `
      <div class="claw-skill-version-state claw-skill-version-state-error">
        <p>${escapeHtml(getVersionErrorMessage(error))}</p>
        ${retryable ? `
          <button type="button" class="claw-skill-version-retry">\u91CD\u8BD5</button>
        ` : ""}
      </div>
    `;
      (_a = container.querySelector(".claw-skill-version-retry")) == null ? void 0 : _a.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        loadSkillVersions(skill, container, { force: true });
      });
    }
    function renderVersionHistory(container, skill, history) {
      if (!container) return;
      if (history.versions.length === 0) {
        container.innerHTML = `
        <div class="claw-skill-version-state">
          \u6682\u65E0\u7248\u672C\u5386\u53F2
        </div>
      `;
        return;
      }
      const rows = history.versions.map((item) => {
        const details = [];
        if (item.parentVersion) details.push(`\u57FA\u4E8E ${formatVersionLabel(item.parentVersion)}`);
        if (item.runId) details.push(item.runId);
        if (!item.exists) details.push("\u5185\u5BB9\u7F3A\u5931");
        const viewDisabled = item.exists ? "" : "disabled";
        const rollbackButton = !item.current ? `<button type="button" class="claw-skill-version-rollback" data-version="${item.version}" ${viewDisabled}>\u6062\u590D</button>` : "";
        return `
        <div class="claw-skill-version-item${item.current ? " claw-skill-version-item-current" : ""}">
          <div class="claw-skill-version-row">
            <div class="claw-skill-version-main">
              <div class="claw-skill-version-labels">
                ${item.current ? '<span class="claw-skill-version-current-badge">\u5F53\u524D</span>' : ""}
                <strong class="claw-skill-version-number">${escapeHtml(formatVersionLabel(item.version))}</strong>
                <span class="claw-skill-version-source">${escapeHtml(getVersionSourceLabel(item.source))}</span>
                <span class="claw-skill-version-date">${escapeHtml(formatVersionDate(item.createdAt))}</span>
              </div>
              ${details.length ? `<p class="claw-skill-version-details">${details.map(escapeHtml).join(" \xB7 ")}</p>` : ""}
            </div>
            <div class="claw-skill-version-actions">
              <button type="button" class="claw-skill-version-view" data-version="${item.version}" ${viewDisabled}>\u67E5\u770B</button>
              ${rollbackButton}
            </div>
          </div>
        </div>
      `;
      }).join("");
      container.innerHTML = `<div class="claw-skill-version-list">${rows}</div>`;
      container.querySelectorAll(".claw-skill-version-view").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (button.disabled) return;
          const version = Number(button.dataset.version);
          openVersionContent(skill, version, history);
        });
      });
      container.querySelectorAll(".claw-skill-version-rollback").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (button.disabled) return;
          const version = Number(button.dataset.version);
          openRollbackDialog(skill, version, history);
        });
      });
    }
    async function loadSkillVersions(skill, container, requestOptions = {}) {
      if (!options.showVersionHistory || !container) return null;
      const skillKey = getSkillApiName(skill);
      const force = requestOptions.force === true;
      if (force) {
        skillVersionCache.delete(skillKey);
        skillVersionRequests.delete(skillKey);
      }
      const cached = skillVersionCache.get(skillKey);
      if (cached) {
        renderVersionHistory(container, skill, cached);
        return cached;
      }
      renderVersionLoading(container);
      let request2 = skillVersionRequests.get(skillKey);
      if (!request2) {
        request2 = (async () => {
          const config = await getEchoMemConfig();
          const client2 = createClient(config);
          const payload = await client2.listSkillVersions(skillKey);
          return normalizeSkillVersionHistory(payload);
        })();
        skillVersionRequests.set(skillKey, request2);
      }
      try {
        const history = await request2;
        const isCurrentRequest = skillVersionRequests.get(skillKey) === request2;
        if (isCurrentRequest) {
          skillVersionCache.set(skillKey, history);
          if (container == null ? void 0 : container.isConnected) {
            renderVersionHistory(container, skill, history);
          }
        }
        return history;
      } catch (error) {
        if (skillVersionRequests.get(skillKey) === request2 && (container == null ? void 0 : container.isConnected)) {
          renderVersionError(container, skill, error);
        }
        return null;
      } finally {
        if (skillVersionRequests.get(skillKey) === request2) {
          skillVersionRequests.delete(skillKey);
        }
      }
    }
    async function getSkillVersionContent(skill, version, history) {
      const skillKey = getSkillApiName(skill);
      const cached = getNestedCache(skillVersionContentCache, skillKey, version);
      if (cached !== void 0) return cached;
      if (version === history.currentVersion && areSkillVersionsEquivalent(skill.version, history.currentVersion) && skill.fullContent) {
        setNestedCache(skillVersionContentCache, skillKey, version, skill.fullContent);
        return skill.fullContent;
      }
      let request2 = getNestedCache(skillVersionContentRequests, skillKey, version);
      if (!request2) {
        request2 = (async () => {
          const config = await getEchoMemConfig();
          const client2 = createClient(config);
          const payload = await client2.readSkillVersion(skillKey, version);
          if (typeof (payload == null ? void 0 : payload.text) !== "string") {
            throw new Error("\u5386\u53F2\u7248\u672C\u5185\u5BB9\u4E3A\u7A7A");
          }
          return payload.text;
        })();
        setNestedCache(skillVersionContentRequests, skillKey, version, request2);
      }
      try {
        const text = await request2;
        if (getNestedCache(skillVersionContentRequests, skillKey, version) === request2) {
          setNestedCache(skillVersionContentCache, skillKey, version, text);
        }
        return text;
      } finally {
        const requests = skillVersionContentRequests.get(skillKey);
        if ((requests == null ? void 0 : requests.get(version)) === request2) {
          requests.delete(version);
          if (requests.size === 0) skillVersionContentRequests.delete(skillKey);
        }
      }
    }
    async function openVersionContent(skill, version, history) {
      const contentId = `claw-skill-version-content-${Date.now()}-${version}`;
      const title = `${skill.name} \xB7 ${formatVersionLabel(version)}`;
      openCenterOverlay(escapeHtml(title), `
      <div id="${contentId}" style="padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #6b7280; white-space: pre-wrap; word-break: break-word;">\u6B63\u5728\u52A0\u8F7D\u7248\u672C\u5185\u5BB9...</div>
    `, {
        showBack: true,
        onBack: () => closeOverlayPanel()
      });
      const contentElement = document.getElementById(contentId);
      try {
        const text = await getSkillVersionContent(skill, version, history);
        if (contentElement == null ? void 0 : contentElement.isConnected) {
          contentElement.style.color = "#374151";
          contentElement.textContent = text || "\u65E0\u5185\u5BB9";
        }
      } catch (error) {
        if (contentElement == null ? void 0 : contentElement.isConnected) {
          contentElement.style.color = "#b91c1c";
          contentElement.textContent = `\u52A0\u8F7D\u5931\u8D25\uFF1A${getVersionErrorMessage(error)}`;
        }
      }
    }
    function openRollbackDialog(skill, version, history) {
      const skillKey = getSkillApiName(skill);
      if (rollbackInFlight.has(skillKey)) return;
      const dialogId = `claw-skill-rollback-${Date.now()}`;
      const currentLabel = formatVersionLabel(history.currentVersion || skill.version);
      const targetLabel = formatVersionLabel(version);
      const dialogHtml = `
      <div id="${dialogId}" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 12px;">
        <div style="text-align: center;">
          <span class="claw-skill-dialog-icon">${getSkillIcon("history", 23)}</span>
          <p style="font-size: 15px; color: #333; font-weight: 600; margin: 6px 0 4px;">\u786E\u8BA4\u6062\u590D Skill</p>
          <p style="font-size: 12px; color: #666; line-height: 1.5; margin: 0;">\u5C06 Skill\u300C<strong style="color: #111;">${escapeHtml(skill.name)}</strong>\u300D\u4ECE ${escapeHtml(currentLabel)} \u6062\u590D\u4E3A ${escapeHtml(targetLabel)}\u3002<br>\u6062\u590D\u540E\uFF0C\u5F53\u524D SKILL.md \u4F1A\u5207\u6362\u5230\u8BE5\u5386\u53F2\u5185\u5BB9\u3002</p>
        </div>
        <div class="claw-skill-rollback-status" style="display: none; padding: 8px; border-radius: 6px; font-size: 12px;"></div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button class="claw-skill-rollback-cancel" style="padding: 8px 20px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500;">\u53D6\u6D88</button>
          <button class="claw-skill-rollback-confirm" style="padding: 8px 20px; background: #ea580c; color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500;">\u786E\u8BA4\u6062\u590D</button>
        </div>
      </div>
    `;
      openCenterOverlay("\u6062\u590D\u7248\u672C", dialogHtml, {
        width: "380px",
        maxWidth: "380px",
        height: "270px",
        maxHeight: "320px"
      });
      setTimeout(() => {
        const dialog = document.getElementById(dialogId);
        const cancelButton = dialog == null ? void 0 : dialog.querySelector(".claw-skill-rollback-cancel");
        const confirmButton = dialog == null ? void 0 : dialog.querySelector(".claw-skill-rollback-confirm");
        const statusElement = dialog == null ? void 0 : dialog.querySelector(".claw-skill-rollback-status");
        if (!dialog || !cancelButton || !confirmButton || !statusElement) return;
        const closeDialogIfActive = () => {
          const activeOverlay = getPanelContainer();
          if (!dialog.isConnected || !(activeOverlay == null ? void 0 : activeOverlay.contains(dialog))) return false;
          closeOverlayPanel();
          return true;
        };
        cancelButton.addEventListener("click", closeDialogIfActive);
        confirmButton.addEventListener("click", async () => {
          if (rollbackInFlight.has(skillKey)) return;
          rollbackInFlight.add(skillKey);
          confirmButton.disabled = true;
          cancelButton.disabled = true;
          confirmButton.textContent = "\u6062\u590D\u4E2D...";
          statusElement.style.display = "block";
          statusElement.style.background = "#fff7ed";
          statusElement.style.color = "#c2410c";
          statusElement.textContent = "\u6B63\u5728\u6062\u590D\u5386\u53F2\u7248\u672C...";
          try {
            const config = await getEchoMemConfig();
            const client2 = createClient(config);
            const result = await client2.rollbackSkillVersion(skillKey, version);
            if ((result == null ? void 0 : result.rolled_back) !== true) {
              throw new Error("\u540E\u7AEF\u672A\u786E\u8BA4\u7248\u672C\u6062\u590D\u6210\u529F");
            }
            closeDialogIfActive();
            invalidateVersionCaches(skillKey);
            skillCache = null;
            expandedSkillKey = skillKey;
            if (searchInput) searchInput.value = "";
            const reloadResult = await loadSkills({ force: true, preserveExisting: true });
            if (reloadResult.ok) {
              showToast(`Skill\u300C${skill.name}\u300D\u5DF2\u6062\u590D\u4E3A ${targetLabel}`, "success");
            }
          } catch (error) {
            if (statusElement.isConnected) {
              statusElement.style.background = "#fef2f2";
              statusElement.style.color = "#b91c1c";
              statusElement.textContent = `\u6062\u590D\u5931\u8D25\uFF1A${getVersionErrorMessage(error)}`;
              confirmButton.disabled = false;
              cancelButton.disabled = false;
              confirmButton.textContent = "\u91CD\u65B0\u6062\u590D";
            }
          } finally {
            rollbackInFlight.delete(skillKey);
          }
        });
      }, 50);
    }
    function useSkill(skill) {
      const command = formatSkillCommand(skill);
      if (!command) {
        showToast("\u65E0\u6CD5\u8BC6\u522B\u8BE5 Skill \u7684\u8C03\u7528\u540D\u79F0", "error");
        return;
      }
      if (!insertPlainText(command)) {
        showToast("\u672A\u627E\u5230\u5F53\u524D\u9875\u9762\u7684\u804A\u5929\u8F93\u5165\u6846", "error");
        return;
      }
      closeOverlayPanel();
    }
    function openFullSkillContent(skill) {
      if (!skill) return;
      const text = skill.fullContent || skill.rawContent || "\u65E0\u5185\u5BB9";
      const previewHtml = `<div class="claw-skill-preview-overlay">${escapeHtml(text)}</div>`;
      openCenterOverlay(escapeHtml(skill.name), previewHtml, {
        showBack: true,
        onBack: () => closeOverlayPanel()
      });
    }
    function bindFullContentButtons(container, resolveSkill) {
      container == null ? void 0 : container.querySelectorAll(".claw-skill-btn-view-full").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          openFullSkillContent(resolveSkill(button));
        });
      });
    }
    function closeSkillDetailPage() {
      var _a;
      if (!isDetailPageOpen) return;
      const skillKey = expandedSkillKey;
      isDetailPageOpen = false;
      expandedSkillKey = null;
      detailPage.style.display = "none";
      listPage.style.display = "flex";
      if (panelTitle) panelTitle.textContent = listPageTitle;
      if (panelBody) panelBody.scrollTop = listScrollTop;
      const returnIndex = filteredSkills.findIndex((skill) => getSkillApiName(skill) === skillKey);
      (_a = contentEl.querySelector(`.claw-skill-btn-detail[data-index="${returnIndex}"]`)) == null ? void 0 : _a.focus({ preventScroll: true });
    }
    function openSkillDetailPage(skill, index) {
      if (!skill) return;
      const skillKey = getSkillApiName(skill);
      if (!isDetailPageOpen) {
        listScrollTop = (panelBody == null ? void 0 : panelBody.scrollTop) || 0;
      }
      const meta = [
        skill.version ? formatVersionLabel(skill.version) : "",
        skill.author || "",
        skill.modifiedAt ? formatDate2(skill.modifiedAt) : ""
      ].filter(Boolean).join(" \xB7 ");
      detailPage.innerHTML = `
      <section class="claw-skill-detail-hero">
        <span class="claw-skill-detail-eyebrow">SKILL</span>
        <p class="claw-skill-detail-title">${escapeHtml(skill.name || skillKey)}</p>
        <div class="claw-skill-detail-summary">
          <code class="claw-skill-detail-command">/${escapeHtml(skillKey)}</code>
          <p class="claw-skill-detail-meta">${escapeHtml(meta || "\u6682\u65E0\u7248\u672C\u4FE1\u606F")}</p>
        </div>
      </section>
      <section class="claw-skill-detail-sheet">
        ${renderDetail(skill, index)}
      </section>
    `;
      listPage.style.display = "none";
      detailPage.style.display = "flex";
      isDetailPageOpen = true;
      expandedSkillKey = skillKey;
      if (panelTitle) panelTitle.textContent = "Skill \u8BE6\u60C5";
      if (panelBody) panelBody.scrollTop = 0;
      detailPage.focus({ preventScroll: true });
      bindFullContentButtons(detailPage, () => skill);
      if (options.showVersionHistory) {
        loadSkillVersions(skill, detailPage.querySelector(".claw-skill-version-history"));
      }
    }
    panelBackButton == null ? void 0 : panelBackButton.addEventListener("click", (event) => {
      if (!isDetailPageOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSkillDetailPage();
    }, true);
    function renderSkills(skills) {
      if (skills.length === 0) {
        const hasSearchKeyword = Boolean(searchInput == null ? void 0 : searchInput.value.trim());
        const emptyTitle = hasSearchKeyword ? "\u6CA1\u6709\u5339\u914D\u7ED3\u679C" : "\u6682\u65E0 Skill";
        const emptyCopy = hasSearchKeyword ? "\u8BD5\u8BD5\u66F4\u77ED\u7684\u5173\u952E\u8BCD\uFF0C\u6216\u68C0\u67E5\u540D\u79F0\u4E0E\u63CF\u8FF0\u3002" : "\u4E0A\u4F20\u4E00\u4E2A Skill \u6587\u4EF6\u540E\uFF0C\u5B83\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002";
        contentEl.innerHTML = `
        <div class="claw-skill-state">
          <span class="claw-skill-state-icon">${getSkillIcon(hasSearchKeyword ? "search" : "folder", 23)}</span>
          <p class="claw-skill-state-title">${emptyTitle}</p>
          <p class="claw-skill-state-copy">${emptyCopy}</p>
        </div>
      `;
        return;
      }
      const itemsHtml = skills.map((skill, index) => {
        const desc = skill.description || "\u6682\u65E0\u63CF\u8FF0";
        const version = skill.version ? formatVersionLabel(skill.version) : "";
        const author = skill.author || "";
        const metaParts = [
          version,
          author,
          formatDate2(skill.modifiedAt),
          skill.contentUnavailable ? "\u6B63\u6587\u5F85\u91CD\u8BD5" : ""
        ].filter(Boolean);
        const meta = metaParts.join(" \xB7 ") || "-";
        const deleteBtnHtml = options.showDelete ? `<button type="button" class="claw-skill-btn-delete" data-index="${index}" aria-label="\u5220\u9664 ${escapeHtml(skill.name)}">
            ${getSkillIcon("trash", 13)}
            \u5220\u9664
          </button>` : "";
        const detailControlHtml = options.useOnCardClick ? `<button type="button" class="claw-skill-btn-detail" data-index="${index}">
            ${getSkillIcon("info", 13)}
            <span>\u8BE6\u60C5</span>
          </button>` : getSkillIcon("chevronDown", 17, "claw-skill-toggle-icon");
        const useTargetClass = options.useOnCardClick ? " claw-skill-item-use-target" : "";
        const useTargetAttributes = options.useOnCardClick ? ` role="button" tabindex="0" data-index="${index}" aria-label="\u4F7F\u7528 Skill\uFF1A${escapeHtml(skill.name)}"` : "";
        return `
        <div class="claw-skill-item" data-index="${index}">
          <div class="claw-skill-item-head${useTargetClass}"${useTargetAttributes}>
            <div class="claw-skill-item-copy">
              <p class="claw-skill-item-title" title="${escapeHtml(skill.name)}">${escapeHtml(skill.name)}</p>
              <p class="claw-skill-item-desc">${escapeHtml(desc)}</p>
            </div>
          </div>
          <div class="claw-skill-item-footer">
            <p class="claw-skill-item-meta" title="${escapeHtml(meta)}">${escapeHtml(meta)}</p>
            <div class="claw-skill-item-actions">
              ${deleteBtnHtml}
              ${detailControlHtml}
            </div>
          </div>
          ${options.useOnCardClick ? "" : `
            <div class="claw-skill-detail" style="display: none;">
              ${renderDetail(skill, index)}
            </div>
          `}
        </div>
      `;
      }).join("");
      contentEl.innerHTML = `
      <div class="claw-skill-items">
        ${itemsHtml}
      </div>
    `;
      function openSkillItem(item, skill) {
        const detail = item.querySelector(".claw-skill-detail");
        const icon = item.querySelector(".claw-skill-toggle-icon");
        if (!detail) return;
        contentEl.querySelectorAll(".claw-skill-detail").forEach((element) => element.style.display = "none");
        contentEl.querySelectorAll(".claw-skill-toggle-icon").forEach((element) => element.style.transform = "none");
        detail.style.display = "block";
        if (icon) icon.style.transform = "rotate(180deg)";
        expandedSkillKey = getSkillApiName(skill);
        if (options.showVersionHistory) {
          const versionContainer = detail.querySelector(".claw-skill-version-history");
          loadSkillVersions(skill, versionContainer);
        }
      }
      contentEl.querySelectorAll(".claw-skill-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          if (e.target.closest(".claw-skill-detail")) return;
          const index = Number(item.dataset.index);
          const skill = skills[index];
          if (!skill) return;
          if (options.useOnCardClick) {
            useSkill(skill);
            return;
          }
          const detail = item.querySelector(".claw-skill-detail");
          const icon = item.querySelector(".claw-skill-toggle-icon");
          if (!detail) return;
          const isOpen = detail.style.display === "block";
          if (isOpen) {
            detail.style.display = "none";
            if (icon) icon.style.transform = "none";
            expandedSkillKey = null;
            return;
          }
          openSkillItem(item, skill);
        });
      });
      contentEl.querySelectorAll(".claw-skill-item-use-target").forEach((target) => {
        target.addEventListener("keydown", (event) => {
          if (!isSkillUseActivationKey(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const skill = skills[Number(target.dataset.index)];
          if (skill) useSkill(skill);
        });
      });
      contentEl.querySelectorAll(".claw-skill-btn-detail").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = Number(btn.dataset.index);
          openSkillDetailPage(skills[index], index);
        });
      });
      if (options.showDelete) {
        contentEl.querySelectorAll(".claw-skill-btn-delete").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const skill = skills[Number(btn.dataset.index)];
            const apiName = getSkillApiName(skill);
            const displayName = (skill == null ? void 0 : skill.name) || apiName;
            if (!apiName) return;
            const safeDelName = escapeHtml(displayName);
            const delDialogHtml = `
            <div class="claw-skill-dialog">
              <div>
                <span class="claw-skill-dialog-icon is-danger">${getSkillIcon("trash", 22)}</span>
                <p class="claw-skill-dialog-title">\u786E\u8BA4\u5220\u9664 Skill</p>
                <p class="claw-skill-dialog-copy">\u786E\u5B9A\u5220\u9664 Skill\u300C<strong>${safeDelName}</strong>\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002</p>
              </div>
              <div class="claw-skill-dialog-actions">
                <button type="button" id="claw-skill-del-cancel" class="claw-skill-dialog-button">\u53D6\u6D88</button>
                <button type="button" id="claw-skill-del-ok" class="claw-skill-dialog-button is-danger">\u786E\u8BA4\u5220\u9664</button>
              </div>
            </div>
          `;
            openCenterOverlay("\u5220\u9664\u786E\u8BA4", delDialogHtml, {
              width: "360px",
              maxWidth: "360px",
              height: "280px",
              maxHeight: "calc(100vh - 16px)",
              compactHeader: true
            });
            setTimeout(() => {
              const cancelBtn = document.getElementById("claw-skill-del-cancel");
              const okBtn = document.getElementById("claw-skill-del-ok");
              cancelBtn == null ? void 0 : cancelBtn.addEventListener("click", () => {
                closeOverlayPanel();
              });
              okBtn == null ? void 0 : okBtn.addEventListener("click", async () => {
                closeOverlayPanel();
                btn.textContent = "\u5220\u9664\u4E2D...";
                btn.disabled = true;
                try {
                  const config = await getEchoMemConfig();
                  const client2 = createClient(config);
                  await client2.deleteSkill(apiName);
                  invalidateVersionCaches(apiName);
                  if (expandedSkillKey === apiName) expandedSkillKey = null;
                  allSkills = removeSkillByApiName(allSkills, apiName);
                  skillCache = allSkills;
                  filteredSkills = getFilteredSkills(allSkills, (searchInput == null ? void 0 : searchInput.value) || "");
                  renderSkills(filteredSkills);
                  showToast(`Skill\u300C${displayName || "\u672A\u547D\u540D"}\u300D\u5DF2\u5220\u9664`, "success");
                  await loadSkills({ force: true, preserveExisting: true });
                } catch (err) {
                  showToast(`\u5220\u9664\u5931\u8D25\uFF1A${err.message}`, "error");
                  btn.textContent = "\u5220\u9664";
                  btn.disabled = false;
                }
              });
            }, 50);
            return;
          });
        });
      }
      bindFullContentButtons(contentEl, (button) => skills[Number(button.dataset.index)]);
      if (expandedSkillKey) {
        const expandedIndex = skills.findIndex((skill) => getSkillApiName(skill) === expandedSkillKey);
        const expandedItem = expandedIndex >= 0 ? contentEl.querySelector(`.claw-skill-item[data-index="${expandedIndex}"]`) : null;
        if (expandedItem) {
          if (options.useOnCardClick) {
            openSkillDetailPage(skills[expandedIndex], expandedIndex);
          } else {
            openSkillItem(expandedItem, skills[expandedIndex]);
          }
        }
      }
    }
    function renderDetail(skill, index) {
      const descHtml = skill.description ? `<p class="claw-skill-detail-description">${escapeHtml(skill.description)}</p>` : `<div class="claw-skill-detail-empty">\u6682\u65E0\u63CF\u8FF0</div>`;
      const previewText = skill.rawContent || skill.fullContent || "";
      const bodyPreview = previewText ? `<div class="claw-skill-code-preview">${escapeHtml(previewText)}</div>` : `<div class="claw-skill-detail-empty">\u6682\u65E0\u6B63\u6587</div>`;
      const versionHistoryHtml = options.showVersionHistory ? `
        <section class="claw-skill-detail-section">
          <div class="claw-skill-detail-section-head">
            <p class="claw-skill-detail-section-title">\u7248\u672C\u5386\u53F2</p>
          </div>
          <div class="claw-skill-version-history" data-index="${index}">
            <div class="claw-skill-version-state">\u6253\u5F00\u8BE6\u60C5\u540E\u52A0\u8F7D\u7248\u672C\u5386\u53F2</div>
          </div>
        </section>
      ` : "";
      return `
      <section class="claw-skill-detail-section">
        <div class="claw-skill-detail-section-head">
          <p class="claw-skill-detail-section-title">\u7B80\u4ECB</p>
        </div>
        ${descHtml}
      </section>
      <section class="claw-skill-detail-section">
        <div class="claw-skill-detail-section-head">
          <p class="claw-skill-detail-section-title">\u5F53\u524D\u5185\u5BB9</p>
          <button type="button" class="claw-skill-btn-view-full" data-index="${index}">
            ${getSkillIcon("file", 12)}
            \u5B8C\u6574\u5185\u5BB9
          </button>
        </div>
        ${bodyPreview}
      </section>
      ${versionHistoryHtml}
      <div class="claw-skill-detail-resource">
        <span class="claw-skill-detail-section-title">\u8D44\u6E90\u8DEF\u5F84</span>
        <code class="claw-skill-uri" title="${escapeHtml(skill.uri)}">${escapeHtml(skill.uri)}</code>
      </div>
    `;
    }
    function getFilteredSkills(skills, keyword) {
      if (!keyword.trim()) {
        return skills;
      }
      const normalizedKeyword = keyword.toLowerCase();
      return skills.filter(
        (skill) => skill.name.toLowerCase().includes(normalizedKeyword) || skill.description && skill.description.toLowerCase().includes(normalizedKeyword)
      );
    }
    function filterSkills(keyword) {
      expandedSkillKey = null;
      filteredSkills = getFilteredSkills(allSkills, keyword);
      renderSkills(filteredSkills);
    }
    async function listSkillDirectories(client2) {
      const lsResult = await client2.fsLs(SKILL_ROOT_URI, {
        output: "agent",
        absLimit: 128,
        showAllHidden: false
      });
      console.log("[EchoMem:skill] fsLs result:", lsResult);
      const entries = Array.isArray(lsResult) ? lsResult : (lsResult == null ? void 0 : lsResult.entries) || [];
      return entries.filter((entry) => isDirectory(entry));
    }
    async function loadSkills(loadOptions = {}) {
      const force = loadOptions.force === true;
      const preserveExisting = loadOptions.preserveExisting === true;
      if (!force && skillCache !== null) {
        allSkills = skillCache;
        filteredSkills = getFilteredSkills(allSkills, (searchInput == null ? void 0 : searchInput.value) || "");
        loadingEl.style.display = "none";
        contentEl.style.display = "block";
        renderSkills(filteredSkills);
        return { ok: true, cached: true, partialCount: 0 };
      }
      const requestGeneration = ++loadGeneration;
      const previousSkills = allSkills;
      if (!preserveExisting || previousSkills.length === 0) {
        loadingEl.style.display = "flex";
        contentEl.style.display = "none";
      }
      try {
        const config = await getEchoMemConfig();
        const client2 = createClient(config);
        let entries = await listSkillDirectories(client2);
        if (force && previousSkills.length > 0 && entries.length === 0) {
          entries = await listSkillDirectories(client2);
        }
        if (requestGeneration !== loadGeneration) return { ok: false, stale: true };
        console.log("[EchoMem:skill] filtered entries:", entries);
        if (entries.length === 0) {
          allSkills = [];
          skillCache = allSkills;
          filteredSkills = [];
          loadingEl.style.display = "none";
          contentEl.style.display = "block";
          renderSkills([]);
          return { ok: true, partialCount: 0 };
        }
        const skills = await readSkillEntries(entries, (uri) => client2.fsRead(uri), {
          skillRootUri: SKILL_ROOT_URI,
          concurrency: 6,
          onReadError: (error, dirName) => {
            console.warn(`Failed to read skill ${dirName}:`, error);
          }
        });
        if (requestGeneration !== loadGeneration) return { ok: false, stale: true };
        console.log("[EchoMem:skill] final skills:", skills.map((s) => ({ name: s.name, dirName: s.dirName })));
        allSkills = skills;
        allSkills.sort((a, b) => {
          const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
          const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
          return tb - ta;
        });
        skillCache = allSkills;
        filteredSkills = getFilteredSkills(allSkills, (searchInput == null ? void 0 : searchInput.value) || "");
        loadingEl.style.display = "none";
        contentEl.style.display = "block";
        renderSkills(filteredSkills);
        const partialCount = allSkills.filter((skill) => skill.contentUnavailable).length;
        if (partialCount > 0) {
          showToast(`${partialCount} \u4E2A Skill \u7684\u6B63\u6587\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u5DF2\u4FDD\u7559\u76EE\u5F55\u6761\u76EE`, "info");
        }
        return { ok: true, partialCount };
      } catch (err) {
        if (requestGeneration !== loadGeneration) return { ok: false, stale: true };
        if (preserveExisting && previousSkills.length > 0) {
          showToast(`\u5237\u65B0\u5931\u8D25\uFF0C\u5DF2\u4FDD\u7559\u4E0A\u6B21\u5217\u8868\uFF1A${err.message}`, "error");
          return { ok: false, preserved: true, error: err };
        }
        loadingEl.style.display = "none";
        contentEl.style.display = "block";
        contentEl.innerHTML = `
        <div class="claw-skill-state is-error" role="alert">
          <span class="claw-skill-state-icon">${getSkillIcon("alert", 22)}</span>
          <p class="claw-skill-state-title">\u52A0\u8F7D\u5931\u8D25</p>
          <p class="claw-skill-state-copy">${escapeHtml(err.message)}</p>
        </div>
      `;
        return { ok: false, error: err };
      }
    }
    let searchTimer = null;
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          filterSkills(searchInput.value);
        }, 300);
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        if (refreshBtn.disabled) return;
        refreshBtn.disabled = true;
        refreshBtn.setAttribute("aria-busy", "true");
        expandedSkillKey = null;
        invalidateVersionCaches();
        if (searchInput == null ? void 0 : searchInput.value) {
          searchInput.value = "";
          filteredSkills = allSkills;
          renderSkills(filteredSkills);
        }
        try {
          const result = await loadSkills({ force: true, preserveExisting: true });
          if (result.ok && result.partialCount === 0) {
            showToast("Skill \u5217\u8868\u5DF2\u5237\u65B0", "success");
          }
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.removeAttribute("aria-busy");
        }
      });
    }
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.setAttribute("aria-busy", "true");
    }
    try {
      await loadSkills();
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.removeAttribute("aria-busy");
      }
    }
  }

  // src/panels/registry.js
  var panelRegistry = {
    resources: {
      id: "resources",
      title: "\u8D44\u6E90\u7BA1\u7406",
      description: "\u7BA1\u7406\u6587\u4EF6\u8D44\u6E90\u4E0E\u4E0A\u4F20\u5185\u5BB9",
      render: getResourceImportContent
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
      description: "\u67E5\u770B\u8BB0\u5FC6\u5173\u7CFB\u3001\u60C5\u8282\u8109\u7EDC\u4E0E\u5468\u671F\u603B\u7ED3",
      render: getFeedbackContent
    },
    skillStore: {
      id: "skillStore",
      title: "Skill \u7BA1\u7406",
      description: "\u67E5\u770B\u3001\u5BFC\u5165\u3001\u7BA1\u7406 Skill",
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
    "Skill \u7BA1\u7406": "skillStore",
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
  var CARD_STYLE = `width: 100%; min-height: 76px; padding: 14px 16px; margin: 0; border-radius: 12px; border: 1px solid rgba(121, 116, 126, 0.24); background: #FFFFFF; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 14px; transition: background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease; position: relative; overflow: hidden;`;
  function buildHoverEvents(style) {
    const enter = `this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 18px ${style.shadow}';this.style.borderColor='rgba(103,80,164,0.42)';this.style.background='#FEF7FF';var d=this.querySelector('.droplet');if(d)d.style.transform='scale(1.04)';var a=this.querySelector('.arrow');if(a){a.style.color='${style.accent}';a.style.transform='translateX(2px)';}`;
    const leave = `this.style.transform='none';this.style.boxShadow='none';this.style.borderColor='rgba(121,116,126,0.24)';this.style.background='${style.cardBackground || "#FFFFFF"}';var d=this.querySelector('.droplet');if(d)d.style.transform='none';var a=this.querySelector('.arrow');if(a){a.style.color='#79747E';a.style.transform='none';}`;
    return `onmouseenter="${enter}" onmouseleave="${leave}"`;
  }
  function buildCardBody(text, description, style) {
    return `
    <span class="droplet claw-echomem-menu-icon" style="
      width: 44px; height: 44px;
      border-radius: 12px;
      flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: ${style.gradient};
      transition: transform 200ms ease;
      color: ${style.iconColor || "#6750A4"};
    ">${style.icon}</span>
    <span class="claw-echomem-menu-copy" style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
      <span class="claw-echomem-menu-title" style="font-size: 14px; font-weight: 500; color: #21005D; font-family: Roboto, 'Noto Sans SC', sans-serif; letter-spacing: -0.01em;">${text}</span>
      <span class="claw-echomem-menu-description" style="font-size: 12px; color: #49454F; font-family: Roboto, 'Noto Sans SC', sans-serif; line-height: 1.5;">${description}</span>
    </span>
    <svg class="arrow claw-echomem-menu-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: #79747E; transition: color 200ms ease, transform 200ms ease;">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `;
  }
  function getEchoMemHomeContent() {
    const navigationStyle = {
      gradient: "linear-gradient(135deg, #EADDFF 0%, #FEF7FF 100%)",
      shadow: "rgba(33, 0, 93, 0.12)",
      accent: "#6750A4",
      iconColor: "#6750A4",
      cardBackground: "#FFFFFF"
    };
    const panelStyles = {
      resources: {
        ...navigationStyle,
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
      },
      association: {
        ...navigationStyle,
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
      },
      feedback: {
        ...navigationStyle,
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`
      },
      skillStore: {
        ...navigationStyle,
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
      },
      performance: {
        ...navigationStyle,
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
      }
    };
    const configStyle = {
      gradient: "linear-gradient(135deg, #6750A4 0%, #21005D 100%)",
      shadow: "rgba(33, 0, 93, 0.14)",
      accent: "#6750A4",
      iconColor: "#FFFFFF",
      cardBackground: "#FEF7FF",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
    };
    const cards = getEchoMemMenuItems().map((item) => {
      const style = panelStyles[item.panelId] || panelStyles.resources;
      return `
      <button type="button" class="claw-echomem-menu-item" data-panel-id="${item.panelId}" data-panel="${item.panelId}" style="${CARD_STYLE} background: ${style.cardBackground};" ${buildHoverEvents(style)}>
        ${buildCardBody(item.text, item.description, style)}
      </button>
    `;
    }).join("");
    const configCard = `
    <button type="button" class="claw-config-section" data-config="echomem" style="${CARD_STYLE} background: ${configStyle.cardBackground};" ${buildHoverEvents(configStyle)}>
      ${buildCardBody("\u540E\u7AEF\u8FDE\u63A5\u914D\u7F6E", "\u914D\u7F6E\u540E\u7AEF\u5730\u5740\u3001API Key \u548C\u8BA4\u8BC1\u4FE1\u606F", configStyle)}
    </button>
  `;
    return `
    <div class="claw-echomem-home">
      <section class="claw-echomem-home-intro" aria-label="EchoMem \u5DE5\u4F5C\u53F0">
        <span class="claw-echomem-home-eyebrow">ECHO MEMORY</span>
        <p>\u8BA9\u8BB0\u5FC6\u3001\u8D44\u6E90\u4E0E\u80FD\u529B\u5728\u5F53\u524D\u5BF9\u8BDD\u4E2D\u968F\u65F6\u53EF\u7528\u3002</p>
      </section>
      <nav class="claw-echomem-home-nav" aria-label="EchoMem \u529F\u80FD\u5BFC\u822A">
        ${cards}
      </nav>
      <div class="claw-echomem-home-divider" aria-hidden="true">
        <span>\u8FDE\u63A5\u8BBE\u7F6E</span>
      </div>
      <div class="claw-echomem-home-config">
        ${configCard}
      </div>
    </div>
  `;
  }

  // src/panels/resource/index.js
  function getResourceHomeContent() {
    const sections = [
      {
        id: "import",
        title: "\u8D44\u6E90\u5BFC\u5165",
        desc: "\u4E0A\u4F20\u672C\u5730\u6587\u4EF6\u6216\u901A\u8FC7 URL \u6DFB\u52A0\u8D44\u6E90",
        color: "#6750A4",
        surface: "#F4EEFF",
        icon: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />'
      },
      {
        id: "manage",
        title: "\u67E5\u770B\u8D44\u6E90",
        desc: "\u6D4F\u89C8\u3001\u9884\u89C8\u548C\u5220\u9664\u5DF2\u5BFC\u5165\u7684\u8D44\u6E90",
        color: "#625B71",
        surface: "#F3EDF7",
        icon: '<path d="M4 6.5h16M4 12h16M4 17.5h10M7 4v5M7 9v11" />'
      }
    ];
    const cards = sections.map((s) => `
    <div class="claw-resource-section" data-resource-section="${s.id}" style="
      padding: 16px 14px;
      border: 1px solid #E7E0EC;
      border-radius: 16px;
      background: #FFFFFF;
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    " onmouseenter="this.style.borderColor='${s.color}';this.style.background='${s.surface}';this.style.transform='translateY(-1px)'"
       onmouseleave="this.style.borderColor='#E7E0EC';this.style.background='#FFFFFF';this.style.transform='none'"
    >
      <div class="claw-resource-section-icon" style="
        width: 42px;
        height: 42px;
        border-radius: 14px;
        background: ${s.surface};
        color: ${s.color};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      ">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.icon}</svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <p style="font-weight: 600; color: #1D1B20; font-size: 14px; line-height: 1.45; margin: 0 0 3px;">${s.title}</p>
        <p style="font-size: 12px; line-height: 1.55; color: #625F66; margin: 0;">${s.desc}</p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#79747E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `).join("");
    return `
    <style>
      .claw-resource-home {
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      .claw-resource-home .claw-resource-section {
        box-sizing: border-box;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.05);
      }
      .claw-resource-home .claw-resource-section:hover {
        box-shadow: 0 6px 18px rgba(103, 80, 164, 0.12);
      }
      .claw-resource-home .claw-resource-section:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      @media (max-width: 360px) {
        .claw-resource-home .claw-resource-section {
          padding: 14px 12px !important;
          gap: 10px !important;
        }
        .claw-resource-home .claw-resource-section-icon {
          width: 38px !important;
          height: 38px !important;
          border-radius: 12px !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .claw-resource-home .claw-resource-section { transition: none !important; }
      }
    </style>
    <div class="claw-resource-home">
      ${cards}
    </div>
  `;
  }

  // src/panels/resource/manage.js
  function getResourceDirUri() {
    return "echo://resources";
  }
  function formatSize(bytes) {
    if (!bytes || bytes < 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function formatDate(ts) {
    if (!ts) return "-";
    const d = typeof ts === "string" ? new Date(ts) : new Date(ts * 1e3);
    if (isNaN(d.getTime())) return "-";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function getResourceIdFromUri(uri) {
    if (!uri) return "";
    return uri.replace(/\/$/, "").split("/").pop() || "";
  }
  function getEntryUpdatedAt2(entry) {
    return entry.updated_at || entry.modTime || entry.mtime || entry.modifiedAt;
  }
  function getEntrySize(entry) {
    var _a;
    return entry.size ?? ((_a = entry.stat) == null ? void 0 : _a.size);
  }
  function getResourceManageContent() {
    return `
    <style>
      #claw-resource-manage-root {
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      #claw-resource-manage-root, #claw-resource-manage-root * { box-sizing: border-box; }
      #claw-resource-manage-root #claw-resource-toast {
        padding: 11px 13px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        line-height: 1.5;
      }
      #claw-resource-manage-root .resource-manage-loading,
      #claw-resource-manage-root .resource-manage-empty,
      #claw-resource-manage-root .resource-manage-error {
        padding: 28px 16px !important;
        border: 1px dashed #D8D0DC;
        border-radius: 16px;
        background: #FFFFFF;
        color: #79747E !important;
        text-align: center;
        font-size: 12px;
        line-height: 1.55;
      }
      #claw-resource-manage-root .resource-manage-spinner {
        display: inline-block;
        width: 22px;
        height: 22px;
        margin-bottom: 8px;
        border: 2px solid #E7E0EC;
        border-top-color: #6750A4;
        border-radius: 50%;
        animation: resource-manage-spin 0.8s linear infinite;
      }
      @keyframes resource-manage-spin { to { transform: rotate(360deg); } }
      #claw-resource-manage-root .resource-manage-state-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        margin-bottom: 9px;
        border-radius: 16px;
        background: #F3EDF7;
        color: #6750A4;
      }
      #claw-resource-manage-root .resource-manage-error {
        border-style: solid;
        border-color: #F2B8B5;
        background: #FFF8F7 !important;
        color: #B3261E !important;
      }
      #claw-resource-manage-root .resource-manage-error .resource-manage-state-icon {
        background: #F9DEDC;
        color: #B3261E;
      }
      #claw-resource-manage-root #claw-resource-toolbar {
        align-items: center;
        margin: 0 !important;
      }
      #claw-resource-manage-root #claw-resource-btn-refresh {
        min-height: 36px;
        padding: 7px 13px !important;
        border: 1px solid #E0D4F1 !important;
        border-radius: 999px !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
        font-family: inherit;
        font-size: 12px !important;
        font-weight: 600;
        line-height: 1.3;
        transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      }
      #claw-resource-manage-root #claw-resource-btn-refresh:hover {
        background: #EADDFF !important;
        box-shadow: 0 3px 10px rgba(103, 80, 164, 0.14);
      }
      #claw-resource-manage-root #claw-resource-btn-refresh:active { transform: scale(0.98); }
      #claw-resource-manage-root button:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      #claw-resource-manage-root .resource-manage-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 9px;
        padding: 9px 11px;
        border-radius: 12px;
        background: #F3EDF7;
        color: #625B71;
        font-size: 11px;
        line-height: 1.45;
      }
      #claw-resource-manage-root .resource-manage-path {
        display: inline-block;
        min-width: 0;
        max-width: 190px;
        overflow: hidden;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: bottom;
      }
      #claw-resource-manage-root .resource-manage-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      #claw-resource-manage-root .claw-resource-item {
        padding: 13px !important;
        border: 1px solid #E7E0EC !important;
        border-radius: 16px !important;
        background: #FFFFFF !important;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
        transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
      }
      #claw-resource-manage-root .claw-resource-item:hover {
        border-color: #C9B8DE !important;
        box-shadow: 0 5px 16px rgba(103, 80, 164, 0.09);
        transform: translateY(-1px);
      }
      #claw-resource-manage-root .resource-item-name {
        margin: 0 0 3px !important;
        color: #1D1B20 !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        line-height: 1.45;
      }
      #claw-resource-manage-root .resource-item-meta {
        margin: 0 !important;
        color: #79747E !important;
        font-size: 10px !important;
        line-height: 1.4;
      }
      #claw-resource-manage-root .resource-status-badge {
        padding: 4px 9px !important;
        border: 1px solid #B7DDB9;
        border-radius: 999px !important;
        background: #E8F5E9 !important;
        color: #1B5E20 !important;
        font-size: 10px !important;
        font-weight: 600 !important;
      }
      #claw-resource-manage-root .resource-item-abstract {
        margin: 0 !important;
        color: #625F66 !important;
        font-size: 12px !important;
        line-height: 1.55 !important;
      }
      #claw-resource-manage-root .claw-resource-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px !important;
        margin-top: 3px !important;
      }
      #claw-resource-manage-root .claw-resource-actions button {
        min-height: 32px;
        padding: 6px 11px !important;
        border-radius: 999px !important;
        font-family: inherit;
        font-size: 11px !important;
        font-weight: 600;
        line-height: 1.25;
      }
      #claw-resource-manage-root .claw-resource-btn-view {
        border: 1px solid #E0D4F1 !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
      }
      #claw-resource-manage-root .claw-resource-btn-insert {
        border: 1px solid #B7DDB9 !important;
        background: #E8F5E9 !important;
        color: #1B5E20 !important;
      }
      #claw-resource-manage-root .claw-resource-btn-delete {
        border: 1px solid #F2B8B5 !important;
        background: #F9DEDC !important;
        color: #B3261E !important;
      }
      #claw-resource-manage-root button:disabled { cursor: wait !important; opacity: 0.58 !important; }
      @media (max-width: 360px) {
        #claw-resource-manage-root .resource-manage-summary { align-items: flex-start; flex-direction: column; }
        #claw-resource-manage-root .resource-manage-path { max-width: 180px; }
        #claw-resource-manage-root .claw-resource-item { padding: 11px !important; border-radius: 14px !important; }
        #claw-resource-manage-root .claw-resource-actions .claw-resource-btn-delete { margin-left: 0 !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        #claw-resource-manage-root .resource-manage-spinner { animation: none; }
        #claw-resource-manage-root .claw-resource-item,
        #claw-resource-manage-root #claw-resource-btn-refresh { transition: none; }
      }
    </style>
    <div id="claw-resource-manage-root">
      <div id="claw-resource-toast" style="display: none;"></div>
      <div id="claw-resource-list-loading" class="resource-manage-loading">
        <span class="resource-manage-spinner" aria-hidden="true"></span>
        <p style="margin: 0; font-size: 12px;">\u6B63\u5728\u52A0\u8F7D\u8D44\u6E90\u5217\u8868\u2026</p>
      </div>
      <div id="claw-resource-toolbar" style="display: none; justify-content: flex-end; margin-bottom: 8px;">
        <button id="claw-resource-btn-refresh" style="
          padding: 5px 12px;
          background: white;
          color: #6750A4;
          border: 1px solid #E0D4F1;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          \u5237\u65B0\u8D44\u6E90
        </button>
      </div>
      <div id="claw-resource-list-content" style="display: none;"></div>
    </div>
  `;
  }
  async function initManagePanel(bodyElement) {
    if (!bodyElement) return;
    const loadingEl = bodyElement.querySelector("#claw-resource-list-loading");
    const contentEl = bodyElement.querySelector("#claw-resource-list-content");
    const toastEl = bodyElement.querySelector("#claw-resource-toast");
    const toolbarEl = bodyElement.querySelector("#claw-resource-toolbar");
    const refreshBtn = bodyElement.querySelector("#claw-resource-btn-refresh");
    if (!loadingEl || !contentEl) return;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
      refreshBtn.style.cursor = "pointer";
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = "0.6";
        refreshBtn.style.cursor = "not-allowed";
        loadingEl.style.display = "block";
        contentEl.style.display = "none";
        if (toolbarEl) toolbarEl.style.display = "none";
        await initManagePanel(bodyElement);
      });
    }
    function showToast(msg, type = "info") {
      if (!toastEl) return;
      const colors = {
        info: { bg: "#F3EDF7", border: "#E0D4F1", text: "#6750A4" },
        success: { bg: "#E8F5E9", border: "#B7DDB9", text: "#1B5E20" },
        error: { bg: "#F9DEDC", border: "#F2B8B5", text: "#B3261E" }
      };
      const c = colors[type] || colors.info;
      toastEl.style.display = "block";
      toastEl.style.padding = "10px 12px";
      toastEl.style.borderRadius = "12px";
      toastEl.style.fontSize = "12px";
      toastEl.style.marginBottom = "8px";
      toastEl.style.background = c.bg;
      toastEl.style.border = `1px solid ${c.border}`;
      toastEl.style.color = c.text;
      toastEl.textContent = msg;
      setTimeout(() => {
        if (toastEl) {
          toastEl.style.display = "none";
          toastEl.textContent = "";
        }
      }, 4e3);
    }
    try {
      const config = await getEchoMemConfig();
      const client2 = createClient(config);
      const dirUri = getResourceDirUri();
      const lsResult = await client2.fsLs(dirUri, { output: "agent", absLimit: 128 });
      console.log("[EchoMem:manage] lsResult type:", typeof lsResult, "isArray:", Array.isArray(lsResult), "raw:", lsResult);
      const entries = Array.isArray(lsResult) ? lsResult : (lsResult == null ? void 0 : lsResult.entries) || [];
      console.log("[EchoMem:manage] entries count:", entries.length, "type:", typeof entries);
      if (entries.length === 0) {
        loadingEl.style.display = "none";
        contentEl.style.display = "block";
        if (toolbarEl) toolbarEl.style.display = "flex";
        contentEl.innerHTML = `
        <div class="resource-manage-empty">
          <span class="resource-manage-state-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>
          </span>
          <p style="margin: 0; color: #49454F; font-size: 13px; font-weight: 600;">\u6682\u65E0\u5DF2\u5BFC\u5165\u8D44\u6E90</p>
          <p style="margin: 5px 0 0; font-size: 11px; word-break: break-word;">\u5F53\u524D\u76EE\u5F55\uFF1A${dirUri}</p>
        </div>
      `;
        return;
      }
      entries.sort((a, b) => {
        const ta = getEntryUpdatedAt2(a) ? new Date(getEntryUpdatedAt2(a)).getTime() : 0;
        const tb = getEntryUpdatedAt2(b) ? new Date(getEntryUpdatedAt2(b)).getTime() : 0;
        return tb - ta;
      });
      const itemsHtml = entries.map((entry) => {
        var _a;
        const name = entry.name || ((_a = entry.uri) == null ? void 0 : _a.split("/").pop()) || "\u672A\u547D\u540D";
        const size = formatSize(getEntrySize(entry));
        const date = formatDate(getEntryUpdatedAt2(entry));
        const abstractText = entry.abstract || "";
        const resourceId = getResourceIdFromUri(entry.uri);
        const contentUri = entry.uri ? `${entry.uri.replace(/\/$/, "")}/content` : "";
        return `
        <div class="claw-resource-item" data-uri="${entry.uri}" data-resource-id="${resourceId}" style="
          padding: 12px;
          background: #FFFFFF;
          border: 1px solid #E7E0EC;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="min-width: 0; flex: 1;">
              <p class="resource-item-name" style="font-weight: 600; font-size: 13px; color: #1D1B20; margin-bottom: 2px; word-break: break-all;">${name}</p>
              <p class="resource-item-meta" style="font-size: 11px; color: #79747E;">
                <span>${size}</span>
                <span style="margin: 0 6px;">\xB7</span>
                <span>${date}</span>
              </p>
            </div>
            <span class="resource-status-badge" style="
              padding: 2px 8px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 500;
              background: #E8F5E9;
              color: #1B5E20;
              white-space: nowrap;
              margin-left: 8px;
            ">\u5DF2\u5904\u7406</span>
          </div>
          ${abstractText ? `<p class="resource-item-abstract" style="font-size: 12px; color: #625F66; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${abstractText}</p>` : ""}
          <div class="claw-resource-actions" style="display: flex; gap: 6px; margin-top: 4px;">
            <button class="claw-resource-btn-view" data-uri="${contentUri}" style="
              padding: 5px 10px;
              background: #F3EDF7;
              color: #6750A4;
              border: 1px solid #E0D4F1;
              border-radius: 999px;
              font-size: 12px;
              cursor: pointer;
            ">\u67E5\u770B\u5185\u5BB9</button>
            <button class="claw-resource-btn-insert" data-uri="${contentUri}" style="
              padding: 5px 10px;
              background: #E8F5E9;
              color: #1B5E20;
              border: 1px solid #B7DDB9;
              border-radius: 999px;
              font-size: 12px;
              cursor: pointer;
            ">\u63D2\u5165\u5BF9\u8BDD</button>
            <button class="claw-resource-btn-delete" data-resource-id="${resourceId}" style="
              padding: 5px 10px;
              background: #F9DEDC;
              color: #B3261E;
              border: 1px solid #F2B8B5;
              border-radius: 999px;
              font-size: 12px;
              cursor: pointer;
              margin-left: auto;
            ">\u5220\u9664</button>
          </div>
        </div>
      `;
      }).join("");
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
      if (toolbarEl) toolbarEl.style.display = "flex";
      contentEl.innerHTML = `
      <div class="resource-manage-summary">
        <p style="margin: 0; min-width: 0;">\u5F53\u524D\u76EE\u5F55\uFF1A<span class="resource-manage-path">${dirUri}</span></p>
        <p style="margin: 0; white-space: nowrap;">\u5171 ${entries.length} \u4E2A\u8D44\u6E90</p>
      </div>
      <div class="resource-manage-list">
        ${itemsHtml}
      </div>
    `;
      contentEl.querySelectorAll(".claw-resource-btn-view").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uri = btn.dataset.uri;
          if (!uri) return;
          btn.textContent = "\u52A0\u8F7D\u4E2D...";
          try {
            const client3 = createClient(await getEchoMemConfig());
            const result = await client3.fsRead(uri);
            const text = typeof result === "string" ? result : (result == null ? void 0 : result.content) || JSON.stringify(result, null, 2);
            const name = uri.split("/").pop() || uri;
            const previewHtml = `<div style="padding: 18px; border-radius: 14px; background: #FFFBFE; color: #49454F; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.72; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            openCenterOverlay(name, previewHtml, {
              showBack: true,
              onBack: () => closeOverlayPanel()
            });
          } catch (err) {
            showToast(`\u274C \u8BFB\u53D6\u5931\u8D25: ${err.message}`, "error");
          }
          btn.textContent = "\u67E5\u770B\u5185\u5BB9";
        });
      });
      contentEl.querySelectorAll(".claw-resource-btn-insert").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uri = btn.dataset.uri;
          if (!uri) return;
          btn.textContent = "\u63D2\u5165\u4E2D...";
          try {
            const client3 = createClient(await getEchoMemConfig());
            const result = await client3.fsRead(uri);
            const text = typeof result === "string" ? result : (result == null ? void 0 : result.content) || JSON.stringify(result, null, 2);
            injectContent(text, { replace: false });
          } catch (err) {
            alert(`\u274C \u63D2\u5165\u5931\u8D25: ${err.message}`);
          }
          btn.textContent = "\u63D2\u5165\u5BF9\u8BDD";
        });
      });
      contentEl.querySelectorAll(".claw-resource-btn-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          const resourceId = btn.dataset.resourceId;
          if (!resourceId) return;
          const dialogHtml = `
          <div class="echomem-confirm-dialog" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; color: #1D1B20; font-family: Roboto, 'Noto Sans SC', sans-serif;">
            <div style="text-align: center;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 16px; background: #F9DEDC; color: #B3261E;" aria-hidden="true">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>
              </span>
              <p style="font-size: 15px; color: #1D1B20; font-weight: 600; margin: 8px 0 4px;">\u786E\u8BA4\u5220\u9664\u8D44\u6E90</p>
              <p style="font-size: 12px; color: #625F66; line-height: 1.55; margin: 0;">\u786E\u5B9A\u5220\u9664\u8D44\u6E90\u300C<strong style="color: #1D1B20; word-break: break-all;">${resourceId}</strong>\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002</p>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
              <button id="claw-resource-manage-del-cancel" style="
                min-width: 104px;
                min-height: 40px;
                padding: 8px 18px;
                background: #F3EDF7;
                color: #6750A4;
                border: 1px solid #E0D4F1;
                border-radius: 999px;
                font-size: 13px;
                cursor: pointer;
                font-weight: 600;
              ">\u53D6\u6D88</button>
              <button id="claw-resource-manage-del-ok" style="
                min-width: 104px;
                min-height: 40px;
                padding: 8px 18px;
                background: #B3261E;
                color: #FFFFFF;
                border: 1px solid #B3261E;
                border-radius: 999px;
                font-size: 13px;
                cursor: pointer;
                font-weight: 600;
              ">\u786E\u8BA4\u5220\u9664</button>
            </div>
          </div>
        `;
          openCenterOverlay("\u5220\u9664\u786E\u8BA4", dialogHtml, {
            width: "min(360px, calc(100vw - 24px))",
            maxWidth: "calc(100vw - 24px)",
            height: "240px",
            maxHeight: "280px"
          });
          setTimeout(() => {
            const cancelBtn = document.getElementById("claw-resource-manage-del-cancel");
            const okBtn = document.getElementById("claw-resource-manage-del-ok");
            cancelBtn == null ? void 0 : cancelBtn.addEventListener("click", () => {
              closeOverlayPanel();
            });
            okBtn == null ? void 0 : okBtn.addEventListener("click", async () => {
              closeOverlayPanel();
              btn.textContent = "\u5220\u9664\u4E2D...";
              btn.disabled = true;
              try {
                const client3 = createClient(await getEchoMemConfig());
                await client3.deleteResource(resourceId);
                showToast("\u2705 \u8D44\u6E90\u5DF2\u5220\u9664", "success");
                await initManagePanel(bodyElement);
              } catch (err) {
                showToast(`\u274C \u5220\u9664\u5931\u8D25: ${err.message}`, "error");
                btn.textContent = "\u5220\u9664";
                btn.disabled = false;
              }
            });
          }, 50);
        });
      });
    } catch (err) {
      loadingEl.style.display = "none";
      contentEl.style.display = "block";
      if (toolbarEl) toolbarEl.style.display = "flex";
      contentEl.innerHTML = `
      <div class="resource-manage-error">
        <span class="resource-manage-state-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>
        </span>
        <p style="font-size: 13px; font-weight: 600; margin: 0 0 5px;">\u52A0\u8F7D\u5931\u8D25</p>
        <p style="font-size: 12px; margin: 0; word-break: break-word;">${err.message}</p>
        <p style="font-size: 11px; color: #79747E; margin: 7px 0 0;">\u76EE\u5F55\uFF1A${getResourceDirUri()}</p>
      </div>
    `;
    }
  }

  // src/services/openview-client.js
  var AUTH_STORAGE_KEY = "openviewAuth";
  function normalizeBaseUrl(url) {
    const trimmed = (url || "").trim();
    if (!trimmed) return "http://127.0.0.1:31020";
    return trimmed.replace(/\/$/, "");
  }
  function resolveUrl(baseUrl, path) {
    const normalized = normalizeBaseUrl(baseUrl);
    const safePath = path.startsWith("/") ? path : `/${path}`;
    return `${normalized}${safePath}`;
  }
  function resolveLoginPath(baseUrl) {
    try {
      const { hostname } = new URL(normalizeBaseUrl(baseUrl));
      const isLoopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
      return isLoopback ? "/v1/auth/login" : "/api/auth/login";
    } catch {
      return "/api/auth/login";
    }
  }
  async function parseResponse(response) {
    const text = await response.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const payload = data && typeof data.code === "number" && "data" in data ? data.data : data;
    return { ok: response.ok, status: response.status, payload, text };
  }
  function fetchViaBackground2(url, options = {}) {
    const isServiceWorker = typeof window === "undefined" && typeof self !== "undefined" && typeof ServiceWorkerGlobalScope !== "undefined" && self instanceof ServiceWorkerGlobalScope;
    if (isServiceWorker) {
      return fetch(url, options).then(async (response) => {
        var _a;
        const text = await response.text().catch(() => "");
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
            error: data.message || ((_a = data.error) == null ? void 0 : _a.message) || `HTTP ${response.status}`,
            data,
            text
          };
        }
        return { success: true, status: response.status, data, text };
      }).catch((err) => ({ success: false, error: err.message }));
    }
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "openViewRequest",
          url,
          method: options.method || "GET",
          headers: options.headers,
          body: options.body,
          credentials: options.credentials
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
    const response = await fetchViaBackground2(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers || {}
      }
    });
    if (!response || !response.success) {
      const message = (response == null ? void 0 : response.error) || `HTTP ${(response == null ? void 0 : response.status) || "unknown"}`;
      const error = new Error(message);
      error.status = response == null ? void 0 : response.status;
      error.payload = response == null ? void 0 : response.data;
      throw error;
    }
    const parsed = await parseResponse({
      ok: response.success,
      status: response.status,
      text: async () => response.text || ""
    });
    return parsed.payload;
  }
  async function getOpenViewAuth() {
    try {
      const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
      return result[AUTH_STORAGE_KEY] || null;
    } catch {
      return null;
    }
  }
  async function setOpenViewAuth(auth) {
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
  }
  async function login({ baseUrl, username, password }) {
    const payload = await request(baseUrl, resolveLoginPath(baseUrl), {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
    if (!payload || !payload.user || typeof payload.csrfToken !== "string") {
      throw new Error("\u767B\u5F55\u54CD\u5E94\u4E2D\u7F3A\u5C11\u7528\u6237\u6216 CSRF \u4F1A\u8BDD\u4FE1\u606F");
    }
    const auth = {
      baseUrl: normalizeBaseUrl(baseUrl),
      csrfToken: payload.csrfToken,
      user: payload.user,
      loggedInAt: Date.now()
    };
    await setOpenViewAuth(auth);
    return auth;
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
  function stripMetadataTags(text) {
    if (!text) return "";
    return text.replace(/\s*\[[^\]]+\]/g, "").trim();
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
  function escapeHtml2(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // src/streaming/button-svg-poll.js
  function matchRule(value, rule) {
    if (!rule) return false;
    const idx = rule.indexOf(":");
    if (idx === -1) return value === rule;
    const op = rule.slice(0, idx);
    const arg = rule.slice(idx + 1);
    switch (op) {
      case "startsWith":
        return value.startsWith(arg);
      case "equals":
        return value === arg;
      case "contains":
        return value.includes(arg);
      case "regex":
        try {
          return new RegExp(arg).test(value);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
  function resolveAnchorParents(anchor, rules) {
    const result = [];
    for (const rule of rules || []) {
      if (typeof rule !== "string") continue;
      const idx = rule.indexOf(":");
      if (idx === -1) continue;
      const op = rule.slice(0, idx);
      const arg = rule.slice(idx + 1);
      try {
        if (op === "closest") {
          const c = anchor.closest(arg);
          if (c) result.push(c);
        } else if (op === "parent") {
          const n = parseInt(arg, 10);
          let p = anchor;
          for (let i = 0; i < n && p; i++) p = p.parentElement;
          if (p) result.push(p);
        }
      } catch {
      }
    }
    return result;
  }
  function createButtonSvgPollDetector(params = {}) {
    const {
      anchorSelector = null,
      anchorParents = [],
      buttonSelector,
      iconSelector = "svg path",
      iconAttr = "d",
      streamingMatch = null,
      idleMatch = null,
      pollIntervalMs = 500,
      timeoutMs = 6e4
    } = params;
    function readIcon(btn) {
      try {
        const icon = btn.querySelector(iconSelector);
        if (!icon) return "";
        return icon.getAttribute(iconAttr) || "";
      } catch {
        return "";
      }
    }
    function isCandidate(btn) {
      const v = readIcon(btn);
      return matchRule(v, streamingMatch) || matchRule(v, idleMatch);
    }
    function findButton() {
      if (!buttonSelector) return null;
      if (anchorSelector) {
        const anchor = document.querySelector(anchorSelector);
        if (anchor) {
          const containers = resolveAnchorParents(anchor, anchorParents);
          for (const c of containers) {
            let btns;
            try {
              btns = c.querySelectorAll(buttonSelector);
            } catch {
              continue;
            }
            for (const btn of btns) {
              if (isCandidate(btn)) return btn;
            }
          }
        }
      }
      let all;
      try {
        all = document.querySelectorAll(buttonSelector);
      } catch {
        return null;
      }
      const candidates = [];
      for (const btn of all) {
        if (isCandidate(btn)) {
          candidates.push({ btn, top: btn.getBoundingClientRect().top });
        }
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.top - a.top);
      return candidates[0].btn;
    }
    function isStreaming() {
      const btn = findButton();
      if (!btn) return false;
      return matchRule(readIcon(btn), streamingMatch);
    }
    let pollTimer = null;
    let timeoutTimer = null;
    let wasStreaming = false;
    let fired = false;
    let onCompleteRef = null;
    function fire() {
      if (fired) return;
      fired = true;
      cleanup();
      try {
        onCompleteRef && onCompleteRef();
      } catch (err) {
        console.warn("EchoMem: streaming onComplete threw", err);
      }
    }
    function cleanup() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    }
    return {
      start(onComplete) {
        fired = false;
        wasStreaming = false;
        onCompleteRef = onComplete;
        cleanup();
        if (!isStreaming()) {
          console.log("EchoMem: streaming already finished at start, firing immediately");
          Promise.resolve().then(fire);
          return;
        }
        wasStreaming = true;
        timeoutTimer = setTimeout(() => {
          console.log("EchoMem: streaming check timeout, forcing complete");
          fire();
        }, timeoutMs);
        pollTimer = setInterval(() => {
          if (fired) return;
          const streaming = isStreaming();
          if (streaming) {
            wasStreaming = true;
          } else if (wasStreaming) {
            console.log("EchoMem: streaming finished (button back to idle icon)");
            fire();
          }
        }, pollIntervalMs);
      },
      stop() {
        fired = true;
        onCompleteRef = null;
        cleanup();
      }
    };
  }

  // src/streaming/text-stability.js
  function createTextStabilityDetector(params = {}) {
    const {
      targetSelector = null,
      stableMs = 1500,
      pollIntervalMs = 300,
      timeoutMs = 6e4
    } = params;
    let pollTimer = null;
    let timeoutTimer = null;
    let lastText = "";
    let lastChangeAt = 0;
    let fired = false;
    let onCompleteRef = null;
    function readText() {
      if (!targetSelector) return document.body.textContent || "";
      try {
        const el = document.querySelector(targetSelector);
        return el ? el.textContent || "" : "";
      } catch {
        return "";
      }
    }
    function fire() {
      if (fired) return;
      fired = true;
      cleanup();
      try {
        onCompleteRef && onCompleteRef();
      } catch (err) {
        console.warn("EchoMem: streaming onComplete threw", err);
      }
    }
    function cleanup() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    }
    return {
      start(onComplete) {
        fired = false;
        onCompleteRef = onComplete;
        cleanup();
        lastText = readText();
        lastChangeAt = Date.now();
        timeoutTimer = setTimeout(() => {
          console.log("EchoMem: text-stability timeout, forcing complete");
          fire();
        }, timeoutMs);
        pollTimer = setInterval(() => {
          if (fired) return;
          const cur = readText();
          if (cur !== lastText) {
            lastText = cur;
            lastChangeAt = Date.now();
            return;
          }
          if (Date.now() - lastChangeAt >= stableMs) {
            console.log("EchoMem: text stable for", stableMs, "ms, marking complete");
            fire();
          }
        }, pollIntervalMs);
      },
      stop() {
        fired = true;
        onCompleteRef = null;
        cleanup();
      }
    };
  }

  // src/streaming/selector-state.js
  function evalRule(value, rule) {
    if (!rule) return false;
    const idx = rule.indexOf(":");
    if (idx === -1) return value === rule;
    const op = rule.slice(0, idx);
    const arg = rule.slice(idx + 1);
    switch (op) {
      case "startsWith":
        return value.startsWith(arg);
      case "equals":
        return value === arg;
      case "contains":
        return value.includes(arg);
      case "regex":
        try {
          return new RegExp(arg).test(value);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
  function matches(el, match) {
    var _a;
    if (!el || !match) return false;
    if (match.attr) {
      const v = el.getAttribute(match.attr) || "";
      return evalRule(v, match.rule);
    }
    if (match.class) {
      const has = ((_a = el.classList) == null ? void 0 : _a.contains(match.class)) ?? false;
      return match.present === false ? !has : has;
    }
    return false;
  }
  function createSelectorStateDetector(params = {}) {
    const {
      targetSelector,
      streamingMatch,
      idleMatch,
      pollIntervalMs = 300,
      timeoutMs = 6e4
    } = params;
    let pollTimer = null;
    let timeoutTimer = null;
    let wasStreaming = false;
    let fired = false;
    let onCompleteRef = null;
    function readState() {
      if (!targetSelector) return { streaming: false, idle: true };
      let el;
      try {
        el = document.querySelector(targetSelector);
      } catch {
        return { streaming: false, idle: false };
      }
      return {
        streaming: matches(el, streamingMatch),
        idle: matches(el, idleMatch)
      };
    }
    function fire() {
      if (fired) return;
      fired = true;
      cleanup();
      try {
        onCompleteRef && onCompleteRef();
      } catch (err) {
        console.warn("EchoMem: streaming onComplete threw", err);
      }
    }
    function cleanup() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    }
    return {
      start(onComplete) {
        fired = false;
        wasStreaming = false;
        onCompleteRef = onComplete;
        cleanup();
        const initial = readState();
        if (initial.idle && !initial.streaming) {
          Promise.resolve().then(fire);
          return;
        }
        if (initial.streaming) wasStreaming = true;
        timeoutTimer = setTimeout(() => fire(), timeoutMs);
        pollTimer = setInterval(() => {
          if (fired) return;
          const s = readState();
          if (s.streaming) {
            wasStreaming = true;
          } else if (wasStreaming && s.idle) {
            fire();
          }
        }, pollIntervalMs);
      },
      stop() {
        fired = true;
        onCompleteRef = null;
        cleanup();
      }
    };
  }

  // src/streaming/registry.js
  var strategies = {
    "button-svg-poll": createButtonSvgPollDetector,
    "text-stability": createTextStabilityDetector,
    "selector-state": createSelectorStateDetector
  };
  function createStreamingDetector(streamingConfig) {
    if (!streamingConfig) return null;
    const name = streamingConfig.strategy;
    if (!name || name === "none") return null;
    const factory = strategies[name];
    if (!factory) {
      console.warn("EchoMem: unknown streaming strategy", name);
      return null;
    }
    try {
      return factory(streamingConfig.params || {});
    } catch (err) {
      console.warn("EchoMem: failed to create streaming detector", name, err);
      return null;
    }
  }

  // src/adapters/base-adapter.js
  var DEFAULT_NOISE_SELECTORS = ["button", "svg", "img", "script", "style"];
  function safeQuery(selector) {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }
  var BaseAdapter = {
    /**
     * 查找消息容器：先尝试配置中的 messageContainers，再交给 smart container。
     */
    findMessageContainer(config) {
      var _a;
      const containers = ((_a = config == null ? void 0 : config.messages) == null ? void 0 : _a.messageContainers) || [];
      for (const selector of containers) {
        const el = safeQuery(selector);
        if (el) return el;
      }
      return this.findSmartMessageContainer(config);
    },
    /**
     * 通用智能容器：先按 smartContainerHints 找，再按可滚动 + 尺寸启发。
     */
    findSmartMessageContainer(config) {
      var _a;
      const hints = ((_a = config == null ? void 0 : config.messages) == null ? void 0 : _a.smartContainerHints) || [];
      for (const selector of hints) {
        const el = safeQuery(selector);
        if (el) return el;
      }
      const scrollables = Array.from(document.querySelectorAll("div")).filter((div) => {
        const style = window.getComputedStyle(div);
        return style.overflow === "auto" || style.overflow === "scroll" || style.overflowY === "auto" || style.overflowY === "scroll";
      });
      const candidates = scrollables.filter((div) => {
        const rect = div.getBoundingClientRect();
        if (rect.height < 200) return false;
        if (rect.width < 300 && rect.width > 0) return false;
        return true;
      });
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);
        return candidates[0];
      }
      const fallback = Array.from(document.querySelectorAll("div")).filter((div) => {
        const rect = div.getBoundingClientRect();
        return rect.height > 300 && rect.width > 300;
      });
      if (fallback.length > 0) {
        fallback.sort((a, b) => {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          return rb.height * rb.width - ra.height * ra.width;
        });
        return fallback[0];
      }
      return null;
    },
    /**
     * 噪音选择器：清理元素文本前要剔除的子元素。从 config 拿，附加默认通用项。
     */
    getNoiseSelectors(config) {
      var _a;
      const extra = ((_a = config == null ? void 0 : config.messages) == null ? void 0 : _a.noiseSelectors) || [];
      return [...DEFAULT_NOISE_SELECTORS, ...extra];
    },
    /**
     * 角色判定：助手 / 用户。
     * 默认规则：
     *   - 元素内含 config.messages.assistant.roleSignals 任一选择器 → 助手
     *   - className 含 'user' 或样式右对齐 → 用户
     *   - 否则默认 user（保守策略）
     */
    isUserMessage(el, config) {
      var _a, _b;
      if (!el) return true;
      const assistantSignals = ((_b = (_a = config == null ? void 0 : config.messages) == null ? void 0 : _a.assistant) == null ? void 0 : _b.roleSignals) || [];
      for (const sel of assistantSignals) {
        try {
          if (el.querySelector(sel)) return false;
        } catch {
        }
      }
      const className = typeof el.className === "string" ? el.className : "";
      if (className.includes("user") || className.includes("User")) return true;
      try {
        const style = window.getComputedStyle(el);
        if (style.alignSelf === "flex-end" || style.marginLeft === "auto") return true;
        const parent = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
        if (parent && (parent.justifyContent === "flex-end" || parent.alignItems === "flex-end")) {
          return true;
        }
      } catch {
      }
      return true;
    },
    /**
     * 助手消息是否仍在"思考中"（不应作为完整消息提取）。
     * 默认：如果配置了 assistant.textSelector 且 skipIfMissing=true，
     * 但元素内找不到对应子元素，则视为思考中。
     */
    isAssistantPending(el, config) {
      var _a, _b, _c, _d;
      const sel = (_b = (_a = config == null ? void 0 : config.messages) == null ? void 0 : _a.assistant) == null ? void 0 : _b.textSelector;
      const skip = (_d = (_c = config == null ? void 0 : config.messages) == null ? void 0 : _c.assistant) == null ? void 0 : _d.skipIfMissing;
      if (!sel || !skip) return false;
      try {
        return !el.querySelector(sel);
      } catch {
        return false;
      }
    },
    /**
     * 助手最终文本所在子元素：用于"思考过程在外层，最终答案在子元素"的平台。
     * 返回 null 表示直接用整个 el。
     */
    getAssistantTextElement(el, config) {
      var _a, _b;
      const sel = (_b = (_a = config == null ? void 0 : config.messages) == null ? void 0 : _a.assistant) == null ? void 0 : _b.textSelector;
      if (!sel) return el;
      try {
        return el.querySelector(sel) || null;
      } catch {
        return null;
      }
    },
    /**
     * 通用文本提取：克隆 → 剔除噪音 → trim。
     */
    cleanText(el, config) {
      var _a;
      if (!el) return "";
      const clone = el.cloneNode(true);
      const noise = this.getNoiseSelectors(config);
      for (const sel of noise) {
        try {
          clone.querySelectorAll(sel).forEach((n) => n.remove());
        } catch {
        }
      }
      return ((_a = clone.textContent) == null ? void 0 : _a.trim()) || "";
    },
    /**
     * 提取用户消息文本：默认使用 cleanText。
     */
    extractUserText(el, config) {
      return this.cleanText(el, config);
    },
    /**
     * 提取助手消息文本：先取 textSelector 子元素再清理。
     * 如果 skipIfMissing=true 且子元素不存在，返回 null 表示该消息应跳过。
     */
    extractAssistantText(el, config) {
      if (this.isAssistantPending(el, config)) return null;
      const target = this.getAssistantTextElement(el, config) || el;
      return this.cleanText(target, config);
    },
    /**
     * 创建流式完成检测器。基于 config.streaming 调用策略注册表。
     * 返回 null 表示不需要流式检测（每次 DOM 变化直接 diff）。
     */
    createStreamingDetector(config) {
      return createStreamingDetector(config == null ? void 0 : config.streaming);
    }
  };

  // src/adapters/deepseek-adapter.js
  var DeepseekAdapter = {
    ...BaseAdapter
  };

  // src/adapters/higo-adapter.js
  var HigoAdapter = {
    ...BaseAdapter
  };

  // src/adapters/registry.js
  var adapters = {
    deepseek: DeepseekAdapter,
    higo: HigoAdapter
  };
  function getAdapter(platformId) {
    return adapters[platformId] || BaseAdapter;
  }

  // src/core/session-extractor.js
  function getMessageSelectors(config) {
    return (config == null ? void 0 : config.messages) || null;
  }
  function queryWithFallback(selectors) {
    for (const selector of selectors || []) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements);
        }
      } catch {
        continue;
      }
    }
    return [];
  }
  function findMessagesInContainer(container, selectors) {
    for (const selector of selectors || []) {
      try {
        let elements = Array.from(container.querySelectorAll(selector));
        if (elements.length > 0) {
          elements = elements.filter(
            (el, i, arr) => !arr.some((other, j) => i !== j && other !== el && other.contains(el))
          );
          return elements;
        }
      } catch {
        continue;
      }
    }
    return [];
  }
  function isElementVisible(el) {
    if (!el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function extractMessagesFromScrollContainer(container, adapter, config) {
    var _a;
    const messages = [];
    const children = Array.from(container.children);
    for (const child of children) {
      if ((_a = child.querySelector) == null ? void 0 : _a.call(child, "textarea, input")) continue;
      if (child.tagName === "TEXTAREA" || child.tagName === "INPUT") continue;
      if (!isElementVisible(child)) continue;
      const role = adapter.isUserMessage(child, config) ? "user" : "assistant";
      let text;
      if (role === "assistant") {
        if (adapter.isAssistantPending(child, config)) continue;
        text = adapter.extractAssistantText(child, config);
      } else {
        text = adapter.extractUserText(child, config);
      }
      if (!text) continue;
      messages.push({ role, text, el: child });
    }
    return messages;
  }
  function finalizeMessages(raw) {
    const seenEls = /* @__PURE__ */ new WeakSet();
    const result = [];
    for (const m of raw) {
      if (m.el) {
        if (seenEls.has(m.el)) continue;
        seenEls.add(m.el);
      }
      const last = result[result.length - 1];
      if (last && last.role === m.role && last.text === m.text) continue;
      result.push({
        role: m.role,
        text: m.text,
        timestamp: Date.now()
      });
    }
    return result;
  }
  function extractSessionMessages(platformId) {
    const config = platformRegistry[platformId];
    const adapter = getAdapter(platformId);
    const selectors = getMessageSelectors(config);
    if (!selectors) {
      console.log("EchoMem: no message selectors for platform", platformId);
      return [];
    }
    const messages = [];
    const containers = queryWithFallback(selectors.messageContainers);
    if (containers.length > 0) {
      const container = containers[0];
      const userMsgs = findMessagesInContainer(container, selectors.userMessages);
      const assistantMsgs = findMessagesInContainer(container, selectors.assistantMessages);
      if (userMsgs.length > 0 || assistantMsgs.length > 0) {
        const allElements = [];
        for (const el of userMsgs) {
          if (!isElementVisible(el)) continue;
          const text = adapter.extractUserText(el, config);
          if (text) allElements.push({ el, role: "user", text });
        }
        for (const el of assistantMsgs) {
          if (!isElementVisible(el)) continue;
          if (adapter.isAssistantPending(el, config)) continue;
          const text = adapter.extractAssistantText(el, config);
          if (text) allElements.push({ el, role: "assistant", text });
        }
        allElements.sort((a, b) => {
          const posA = a.el.compareDocumentPosition(b.el);
          return posA & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
        for (const item of allElements) {
          messages.push({
            el: item.el,
            role: item.role,
            text: item.text,
            timestamp: Date.now()
          });
        }
        console.log("EchoMem: extracted", messages.length, "session messages for", platformId, "(from selectors)");
        return finalizeMessages(messages);
      }
      let genericMsgs = findMessagesInContainer(container, selectors.allMessages);
      if (genericMsgs.length > 50) {
        console.log("EchoMem: too many generic matches (" + genericMsgs.length + "), using direct children");
        genericMsgs = Array.from(container.children).filter((el) => {
          if (!isElementVisible(el)) return false;
          const text = adapter.cleanText(el, config);
          return !!text;
        });
      }
      if (genericMsgs.length > 0) {
        let skippedInvisible = 0;
        let skippedShort = 0;
        let skippedPending = 0;
        for (let i = 0; i < genericMsgs.length; i++) {
          const el = genericMsgs[i];
          if (!isElementVisible(el)) {
            skippedInvisible++;
            continue;
          }
          const role = adapter.isUserMessage(el, config) ? "user" : "assistant";
          let text;
          if (role === "assistant") {
            if (adapter.isAssistantPending(el, config)) {
              skippedPending++;
              console.log("EchoMem: msg[" + i + "] role=assistant skipped=pending");
              continue;
            }
            text = adapter.extractAssistantText(el, config);
          } else {
            text = adapter.extractUserText(el, config);
          }
          if (!text) {
            skippedShort++;
            continue;
          }
          console.log(
            "EchoMem: msg[" + i + "] role=" + role + " visible=" + isElementVisible(el) + " textLen=" + text.length + " cls=" + (el.className || "").split(" ").slice(0, 3).join(" ")
          );
          messages.push({ el, role, text, timestamp: Date.now() });
        }
        console.log(
          "EchoMem: extracted",
          messages.length,
          "session messages for",
          platformId,
          "(from generic selectors, total=" + genericMsgs.length,
          "skipped invisible=" + skippedInvisible,
          "skipped short=" + skippedShort,
          "skipped pending=" + skippedPending + ")"
        );
        return finalizeMessages(messages);
      }
    }
    console.log("EchoMem: no message container found via selectors, trying smart detection");
    const smartContainer = adapter.findSmartMessageContainer(config);
    if (smartContainer) {
      const extracted = extractMessagesFromScrollContainer(smartContainer, adapter, config);
      for (const m of extracted) {
        messages.push({ el: m.el, role: m.role, text: m.text, timestamp: Date.now() });
      }
      console.log("EchoMem: extracted", messages.length, "session messages for", platformId, "(from smart detection)");
      return finalizeMessages(messages);
    }
    console.log("EchoMem: failed to extract session messages for", platformId);
    return finalizeMessages(messages);
  }

  // src/services/session-mapper.js
  function extractSessionId(platformId) {
    const config = platformRegistry[platformId];
    if (!config || !config.sessionId) return null;
    const { type, pattern, flags, segment } = config.sessionId;
    if (type === "regex" && pattern) {
      const regex = new RegExp(pattern, flags || "");
      const match = window.location.pathname.match(regex);
      return (match == null ? void 0 : match[1]) || null;
    }
    if (type === "path") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const idx = segment ?? -1;
      if (idx >= 0) {
        return parts[idx] || null;
      }
      return parts[parts.length + idx] || null;
    }
    return null;
  }

  // src/core/session-recorder.js
  var recorderState = {
    platformId: null,
    config: null,
    adapter: null,
    rawSessionId: null,
    echoMemSessionId: null,
    lastMessages: [],
    pendingQueue: [],
    observer: null,
    debounceTimer: null,
    isRecording: false,
    emClient: null,
    streamingDetector: null,
    streamingSnapshot: null
  };
  var PENDING_QUEUE_MAX = 100;
  var DEBOUNCE_MS = 500;
  var SENT_SIGNATURE_TTL_MS = 6e5;
  var sentSignatures = /* @__PURE__ */ new Map();
  function getBatchFingerprint(messages) {
    return recorderState.lastMessages.length + ":" + messages.length + ":" + messages.map((m) => `${m.role}:${m.text}`).join("|");
  }
  function filterRecentlySent(messages) {
    const now = Date.now();
    for (const [sig, ts] of sentSignatures) {
      if (now - ts > SENT_SIGNATURE_TTL_MS) sentSignatures.delete(sig);
    }
    const fp = getBatchFingerprint(messages);
    if (sentSignatures.has(fp)) {
      console.log("EchoMem: skip recently sent batch", messages.length, "messages");
      return [];
    }
    sentSignatures.set(fp, now);
    return messages;
  }
  async function getClient() {
    if (!recorderState.emClient) {
      const config = await getEchoMemConfig();
      recorderState.emClient = createClient(config);
    }
    return recorderState.emClient;
  }
  function getSessionStorageKey() {
    return `echomem_session_${recorderState.platformId}_${recorderState.rawSessionId}`;
  }
  async function loadSessionMapping() {
    try {
      const key = getSessionStorageKey();
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch {
      return null;
    }
  }
  async function saveSessionMapping(echoMemSessionId) {
    try {
      const key = getSessionStorageKey();
      await chrome.storage.local.set({ [key]: echoMemSessionId });
    } catch (err) {
      console.warn("EchoMem: failed to save session mapping", err);
    }
  }
  function diffMessages(newMessages, oldMessages) {
    if (!oldMessages || oldMessages.length === 0) {
      return newMessages;
    }
    const minLen = Math.min(newMessages.length, oldMessages.length);
    let prefixMatch = true;
    for (let i = 0; i < minLen; i++) {
      if (newMessages[i].role !== oldMessages[i].role || newMessages[i].text !== oldMessages[i].text) {
        prefixMatch = false;
        break;
      }
    }
    if (prefixMatch) {
      return newMessages.slice(oldMessages.length);
    }
    for (let oldStart = 0; oldStart < oldMessages.length; oldStart++) {
      const suffix = oldMessages.slice(oldStart);
      if (suffix.length > newMessages.length) continue;
      let match = true;
      for (let i = 0; i < suffix.length; i++) {
        if (newMessages[i].role !== suffix[i].role || newMessages[i].text !== suffix[i].text) {
          match = false;
          break;
        }
      }
      if (match) {
        return newMessages.slice(suffix.length);
      }
    }
    const added = newMessages;
    const oldSignatures = new Set(oldMessages.map((m) => `${m.role}:${m.text}`));
    const uniqueAdded = added.filter((m) => !oldSignatures.has(`${m.role}:${m.text}`));
    if (uniqueAdded.length !== added.length) {
      console.log("EchoMem diag: diff dropped duplicates", added.length - uniqueAdded.length);
    }
    return uniqueAdded;
  }
  function findMessageContainer() {
    const { adapter, config } = recorderState;
    if (!adapter || !config) return null;
    const el = adapter.findMessageContainer(config);
    if (el) {
      console.log("EchoMem: message container found via adapter");
      return el;
    }
    return null;
  }
  async function flushPendingMessages() {
    if (recorderState.pendingQueue.length === 0) return;
    const messages = [...recorderState.pendingQueue];
    recorderState.pendingQueue = [];
    try {
      if (!recorderState.echoMemSessionId) {
        const client3 = await getClient();
        const agentId = await getConfiguredAgentId(recorderState.platformId);
        const result = await client3.openSession({
          agentId,
          sessionId: recorderState.rawSessionId
        });
        recorderState.echoMemSessionId = result.session_id || result.id || result;
        await saveSessionMapping(recorderState.echoMemSessionId);
        console.log("EchoMem: session created", recorderState.echoMemSessionId);
      }
      const client2 = await getClient();
      await client2.appendMessages(recorderState.echoMemSessionId, messages);
      console.log("EchoMem: flushed pending messages", messages.length);
    } catch (err) {
      console.warn("EchoMem: failed to flush messages, re-queuing", err);
      recorderState.pendingQueue.unshift(...messages);
      if (recorderState.pendingQueue.length > PENDING_QUEUE_MAX) {
        recorderState.pendingQueue = recorderState.pendingQueue.slice(-PENDING_QUEUE_MAX);
      }
    }
  }
  async function doSendMessages(messages) {
    if (!messages || messages.length === 0) return;
    messages = filterRecentlySent(messages);
    if (messages.length === 0) return;
    console.log("EchoMem diag: posting=", messages.map((m) => m.role + ":" + m.text.slice(0, 30)));
    console.log("EchoMem: detected", messages.length, "new messages");
    await flushPendingMessages();
    if (recorderState.echoMemSessionId) {
      try {
        const client2 = await getClient();
        await client2.appendMessages(recorderState.echoMemSessionId, messages);
        console.log("EchoMem: appended", messages.length, "messages");
      } catch (err) {
        console.warn("EchoMem: append failed, queueing", err);
        recorderState.pendingQueue.push(...messages);
      }
    } else {
      try {
        const client2 = await getClient();
        const agentId = await getConfiguredAgentId(recorderState.platformId);
        const result = await client2.openSession({
          agentId,
          sessionId: recorderState.rawSessionId
        });
        recorderState.echoMemSessionId = result.session_id || result.id || result;
        await saveSessionMapping(recorderState.echoMemSessionId);
        console.log("EchoMem: session created", recorderState.echoMemSessionId);
        await client2.appendMessages(recorderState.echoMemSessionId, messages);
        console.log("EchoMem: appended", messages.length, "messages");
      } catch (err) {
        console.warn("EchoMem: create session failed, queueing", err);
        recorderState.pendingQueue.push(...messages);
      }
    }
  }
  function disposeStreamingDetector() {
    if (recorderState.streamingDetector) {
      try {
        recorderState.streamingDetector.stop();
      } catch (err) {
        console.warn("EchoMem: streaming detector stop threw", err);
      }
      recorderState.streamingDetector = null;
    }
  }
  async function sendStreamingResult(currentMessages) {
    if (!recorderState.streamingSnapshot) return;
    const changes = [];
    for (let i = recorderState.streamingSnapshot.length; i < currentMessages.length; i++) {
      changes.push(currentMessages[i]);
    }
    recorderState.lastMessages = currentMessages;
    recorderState.streamingSnapshot = null;
    if (changes.length > 0) {
      await doSendMessages(changes);
    }
  }
  function startStreamingDetection() {
    var _a, _b;
    disposeStreamingDetector();
    const detector = (_b = (_a = recorderState.adapter) == null ? void 0 : _a.createStreamingDetector) == null ? void 0 : _b.call(_a, recorderState.config);
    if (!detector) {
      const currentMessages = extractSessionMessages(recorderState.platformId);
      sendStreamingResult(currentMessages).catch((err) => {
        console.warn("EchoMem: immediate streaming send failed", err);
      });
      return;
    }
    recorderState.streamingDetector = detector;
    detector.start(() => {
      recorderState.streamingDetector = null;
      const currentMessages = extractSessionMessages(recorderState.platformId);
      sendStreamingResult(currentMessages).catch((err) => {
        console.warn("EchoMem: streaming send failed", err);
      });
    });
  }
  async function onMessagesChanged() {
    const newMessages = extractSessionMessages(recorderState.platformId);
    console.log("EchoMem diag: newMessages=", newMessages.map((m) => m.role + ":" + m.text.slice(0, 30)));
    if (recorderState.streamingSnapshot) {
      const lastNew2 = newMessages[newMessages.length - 1];
      if ((lastNew2 == null ? void 0 : lastNew2.role) === "user") {
        disposeStreamingDetector();
        recorderState.streamingSnapshot = null;
      } else {
        return;
      }
    }
    const lastNew = newMessages[newMessages.length - 1];
    const lastOld = recorderState.lastMessages[recorderState.lastMessages.length - 1];
    const isNewAssistant = (lastNew == null ? void 0 : lastNew.role) === "assistant" && (!lastOld || lastOld.role !== "assistant");
    if (isNewAssistant) {
      recorderState.streamingSnapshot = [...recorderState.lastMessages];
      startStreamingDetection();
      return;
    }
    const added = diffMessages(newMessages, recorderState.lastMessages);
    recorderState.lastMessages = newMessages;
    if (added.length === 0) return;
    await doSendMessages(added);
  }
  function debouncedOnChange() {
    clearTimeout(recorderState.debounceTimer);
    recorderState.debounceTimer = setTimeout(() => {
      onMessagesChanged().catch((err) => {
        console.warn("EchoMem: onMessagesChanged error", err);
      });
    }, DEBOUNCE_MS);
  }
  function isMeaningfulMutation(mutation) {
    var _a, _b;
    if (mutation.type !== "childList") return false;
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if ((_a = node.classList) == null ? void 0 : _a.contains("claw-echomem-launcher-bar")) continue;
        if ((_b = node.closest) == null ? void 0 : _b.call(node, ".claw-echomem-launcher-bar")) continue;
        return true;
      }
    }
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) return true;
    }
    return false;
  }
  function attachObserver(container) {
    if (recorderState.observer) {
      recorderState.observer.disconnect();
    }
    recorderState.observer = new MutationObserver((mutations) => {
      const hasMeaningfulChange = mutations.some(isMeaningfulMutation);
      if (!hasMeaningfulChange) return;
      debouncedOnChange();
    });
    recorderState.observer.observe(container, {
      childList: true,
      subtree: true
    });
    console.log("EchoMem: MutationObserver attached to message container");
    const currentMessages = extractSessionMessages(recorderState.platformId);
    if (recorderState.echoMemSessionId) {
      recorderState.lastMessages = currentMessages;
      console.log(
        "EchoMem: restored session baseline, skipping",
        currentMessages.length,
        "existing messages"
      );
    } else {
      recorderState.lastMessages = [];
      console.log("EchoMem: new session, will send", currentMessages.length, "existing messages");
      if (currentMessages.length > 0) {
        onMessagesChanged().catch((err) => {
          console.warn("EchoMem: initial message send failed", err);
        });
      }
    }
  }
  async function startRecording(platformId) {
    if (!shouldRecord(platformId)) {
      return;
    }
    const newRawSessionId = extractSessionId(platformId);
    if (!newRawSessionId) {
      if (recorderState.isRecording) {
        stopRecording();
      }
      return;
    }
    if (recorderState.isRecording && recorderState.rawSessionId !== newRawSessionId) {
      console.log(
        "EchoMem: session id changed",
        recorderState.rawSessionId,
        "->",
        newRawSessionId,
        ", resetting recorder"
      );
      if (recorderState.observer) {
        recorderState.observer.disconnect();
        recorderState.observer = null;
      }
      clearTimeout(recorderState.debounceTimer);
      recorderState.debounceTimer = null;
      disposeStreamingDetector();
      recorderState.rawSessionId = newRawSessionId;
      recorderState.echoMemSessionId = null;
      recorderState.lastMessages = [];
      recorderState.pendingQueue = [];
      recorderState.streamingSnapshot = null;
    }
    if (!recorderState.isRecording) {
      recorderState.platformId = platformId;
      recorderState.config = PLATFORM_CONFIGS[platformId] || null;
      recorderState.adapter = getAdapter(platformId);
      recorderState.rawSessionId = newRawSessionId;
      recorderState.isRecording = true;
      console.log("EchoMem: start recording for", platformId, "session", newRawSessionId);
      const savedSessionId = await loadSessionMapping();
      if (savedSessionId) {
        recorderState.echoMemSessionId = savedSessionId;
        console.log("EchoMem: restored session mapping", savedSessionId);
      }
    }
    if (!recorderState.observer) {
      const container = findMessageContainer();
      if (container) {
        attachObserver(container);
      }
    }
  }
  function stopRecording() {
    if (recorderState.observer) {
      recorderState.observer.disconnect();
      recorderState.observer = null;
    }
    clearTimeout(recorderState.debounceTimer);
    recorderState.debounceTimer = null;
    disposeStreamingDetector();
    recorderState.isRecording = false;
    recorderState.rawSessionId = null;
    recorderState.echoMemSessionId = null;
    recorderState.lastMessages = [];
    recorderState.pendingQueue = [];
    recorderState.streamingSnapshot = null;
    sentSignatures.clear();
    console.log("EchoMem: recording stopped");
  }
  function getRecordingState() {
    return {
      platformId: recorderState.platformId,
      rawSessionId: recorderState.rawSessionId,
      echoMemSessionId: recorderState.echoMemSessionId,
      isRecording: recorderState.isRecording,
      pendingCount: recorderState.pendingQueue.length
    };
  }

  // src/panels/association/suggestions.js
  var MEM_TAG_OPEN2 = "<relevant-memories>";
  var MEM_TAG_CLOSE2 = "</relevant-memories>";
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
           data-key="${escapeHtml2(key)}">
        <input type="checkbox" class="echomem-suggestion-check" tabindex="-1" />
        <span class="suggestion-text">${escapeHtml2(c.displayText || "")}</span>
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
  function stripMemoryBlock2(userText) {
    const text = userText || "";
    const regex = new RegExp(`\\s*${MEM_TAG_OPEN2}[\\s\\S]*?${MEM_TAG_CLOSE2}\\s*`, "g");
    const hasMatch = regex.test(text);
    if (!hasMatch) {
      committedItems.clear();
      return text.replace(/\s+$/, "");
    }
    committedItems.clear();
    return text.replace(regex, "").replace(/\s+$/, "");
  }
  function composeAndInsert(textarea, userText, selected) {
    if (!textarea) return;
    const basePart = stripMemoryBlock2(userText);
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
    const next = `${prefix}${MEM_TAG_OPEN2}
${lines.join("\n")}
${MEM_TAG_CLOSE2}`;
    setEditableText(textarea, next, { cursor: next.length });
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
            composeAndInsert(textarea, readEditableText(textarea), selected);
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
    const cleanedText = stripMetadataTags(memory.text || memory.abstract || memory.overview || "");
    if (((_a = memory == null ? void 0 : memory.phrases) == null ? void 0 : _a.length) > 0) {
      const bestPhrase = memory.phrases[0];
      return {
        type: "phrase",
        displayText: `...${truncate(bestPhrase.phrase, 60)}`,
        insertText: bestPhrase.phrase,
        source: "memory",
        sourceUri: memory.uri || memory.evidence_uri || "",
        score: (memory.score || 0.5) * 0.7 + bestPhrase.score * 0.3,
        fullText: cleanedText || bestPhrase.phrase
      };
    }
    if (cleanedText) {
      return {
        type: "summary",
        displayText: `...${truncate(cleanedText, 60)}`,
        insertText: cleanedText,
        source: "memory",
        sourceUri: memory.uri || memory.evidence_uri || "",
        score: memory.score || 0.5,
        fullText: cleanedText
      };
    }
    if (((_b = memory == null ? void 0 : memory.keywords) == null ? void 0 : _b.length) > 0) {
      const continuation = memory.keywords.join("\u3001");
      return {
        type: "keyword",
        displayText: `...${truncate(continuation, 60)}`,
        insertText: continuation,
        source: "memory",
        sourceUri: memory.uri || memory.evidence_uri || "",
        score: memory.score || 0.5,
        fullText: cleanedText
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
      const sourceText = stripMetadataTags(memory.text || memory.overview || memory.abstract || "");
      const phrases = extractPhrases(sourceText, userInput);
      console.log("EchoMem: memory", memory.uri || memory.evidence_uri || "no-uri", "semanticScore", semanticScore, "phrases", phrases.length);
      const keywords = extractKeywords(sourceText, userInput, 3);
      const enrichedMemory = { ...memory, phrases, keywords };
      const suggestion = buildSuggestion(userInput, enrichedMemory);
      if (suggestion) {
        suggestions.push(suggestion);
      } else {
        console.log("EchoMem: no suggestion generated for", memory.uri || memory.evidence_uri || "no-uri");
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
  async function getClient2() {
    if (!client) {
      const config = await getEchoMemConfig();
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
    const textarea = findInputElement2(trackingPlatformConfig);
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
        const text = readEditableText(e.target).trim();
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
      const emClient = await getClient2();
      const agentId = await getConfiguredAgentId(trackingPlatformConfig == null ? void 0 : trackingPlatformConfig.id);
      const { echoMemSessionId } = getRecordingState();
      console.log("EchoMem: recall triggered, query=", userInput, "agent=", agentId, "session=", echoMemSessionId);
      const result = await emClient.find(userInput, { agentId, limit: 5, sessionId: echoMemSessionId, includeExplain: true });
      console.log("EchoMem: search explain", result.explain);
      memories = result.items || [];
      console.log("EchoMem: found", memories.length, "memories");
      if (memories.length > 0) {
        console.log("EchoMem: first memory keys", Object.keys(memories[0]));
        console.log("EchoMem: first memory text preview", memories[0].text ? memories[0].text.slice(0, 100) : "missing");
      }
    } catch (err) {
      console.warn("EchoMem: recall failed", err);
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
  function findInputElement2(platformConfig) {
    var _a, _b, _c;
    const selector = ((_a = platformConfig.input) == null ? void 0 : _a.selector) || ((_c = (_b = platformConfig.launcher) == null ? void 0 : _b.validateSelectors) == null ? void 0 : _c.textarea);
    if (!selector) return null;
    return document.querySelector(selector);
  }

  // src/panels/echomem/config.js
  function isHigoPlatform2() {
    var _a;
    const platform = getCurrentPlatform();
    return ((_a = platform == null ? void 0 : platform.config) == null ? void 0 : _a.id) === "higo" || (platform == null ? void 0 : platform.key) === "higo";
  }
  function getEchoMemConfigContent() {
    const showOpenView = isHigoPlatform2();
    const openViewSection = showOpenView ? `
      <div class="config-card config-service-card">
        <div class="config-card-heading">
          <span class="config-card-icon config-card-icon-secondary" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
          </span>
          <div>
            <p>EchoAgent \u7EDF\u8BA1\u670D\u52A1</p>
            <span>\u4F1A\u8BDD Token \u7EDF\u8BA1\u6C47\u603B</span>
          </div>
        </div>

        <div class="config-field">
          <label for="cfg-openview-url">\u670D\u52A1\u5730\u5740</label>
          <input id="cfg-openview-url" class="config-input" type="text" />
        </div>

        <div class="config-field">
          <label for="cfg-openview-username">\u7528\u6237\u540D</label>
          <input id="cfg-openview-username" class="config-input" type="text" />
        </div>

        <div class="config-field">
          <label for="cfg-openview-password">\u5BC6\u7801</label>
          <input id="cfg-openview-password" class="config-input" type="password" />
        </div>

        <button id="cfg-openview-login-btn" class="config-button config-button-secondary" style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          \u767B\u5F55 EchoAgent
        </button>
      </div>
  ` : "";
    return `
    <style>
      .echomem-config-root {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      .echomem-config-root, .echomem-config-root * { box-sizing: border-box; }
      .echomem-config-root .config-note {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        padding: 12px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #F3EDF7;
        color: #49454F;
        font-size: 12px;
        line-height: 1.55;
      }
      .echomem-config-root .config-note svg {
        margin-top: 1px;
        color: #6750A4;
        flex: 0 0 auto;
      }
      .echomem-config-root .config-card {
        padding: 16px;
        border: 1px solid #E7E0EC;
        border-radius: 18px;
        background: #FFFFFF;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
      }
      .echomem-config-root .config-service-card { background: #FEF7FF; }
      .echomem-config-root .config-card-heading {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .echomem-config-root .config-card-heading p {
        margin: 0;
        color: #1D1B20;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
      }
      .echomem-config-root .config-card-heading span:not(.config-card-icon) {
        display: block;
        margin-top: 2px;
        color: #79747E;
        font-size: 11px;
        line-height: 1.4;
      }
      .echomem-config-root .config-card-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: #EADDFF;
        color: #6750A4;
        flex: 0 0 auto;
      }
      .echomem-config-root .config-card-icon-secondary {
        background: #E8DEF8;
        color: #625B71;
      }
      .echomem-config-root .config-field { margin-bottom: 12px; }
      .echomem-config-root .config-field label {
        display: block;
        margin: 0 0 6px;
        color: #49454F;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.4;
      }
      .echomem-config-root .config-input {
        width: 100%;
        min-height: 42px;
        padding: 9px 12px;
        border: 1px solid #CAC4D0;
        border-radius: 12px;
        background: #FFFBFE;
        color: #1D1B20;
        font-family: inherit;
        font-size: 13px;
        font-weight: 400;
        line-height: 1.45;
        transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
      }
      .echomem-config-root .config-input:hover { border-color: #79747E; }
      .echomem-config-root .config-input:focus {
        border-color: #6750A4;
        background: #FFFFFF;
        box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.14);
        outline: none;
      }
      .echomem-config-root .config-actions {
        display: flex;
        gap: 10px;
        margin-top: 4px;
      }
      .echomem-config-root .config-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 42px;
        padding: 10px 16px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
      }
      .echomem-config-root .config-button-primary {
        border: 1px solid #6750A4;
        background: #6750A4;
        color: #FFFFFF;
      }
      .echomem-config-root .config-button-tonal {
        border: 1px solid #E0D4F1;
        background: #F3EDF7;
        color: #6750A4;
      }
      .echomem-config-root .config-button-secondary {
        border: 1px solid #D8CCE7;
        background: #E8DEF8;
        color: #1D192B;
      }
      .echomem-config-root .config-button:hover {
        filter: brightness(0.97);
        box-shadow: 0 4px 12px rgba(103, 80, 164, 0.16);
      }
      .echomem-config-root .config-button:active { transform: scale(0.985); }
      .echomem-config-root .config-button:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      @media (max-width: 360px) {
        .echomem-config-root .config-card { padding: 14px; border-radius: 16px; }
        .echomem-config-root .config-actions { flex-direction: column; }
        .echomem-config-root .config-actions .config-button { width: 100%; flex: none !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .echomem-config-root .config-input,
        .echomem-config-root .config-button { transition: none !important; }
      }
    </style>
    <div class="echomem-config-root">
      <div class="config-note">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
        <span>\u6B64\u914D\u7F6E\u540C\u65F6\u5F71\u54CD\u8D44\u6E90\u7BA1\u7406\u3001\u8F93\u5165\u8054\u60F3\u7B49\u529F\u80FD\u3002</span>
      </div>

      <div class="config-card">
        <div class="config-card-heading">
          <span class="config-card-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M7 4v6M4 17h16M17 14v6"/></svg>
          </span>
          <div>
            <p>\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE</p>
            <span>\u8FDE\u63A5\u5730\u5740\u4E0E\u8EAB\u4EFD\u8BA4\u8BC1</span>
          </div>
        </div>

        <div class="config-field">
          <label for="cfg-base-url">\u670D\u52A1\u5730\u5740</label>
          <input id="cfg-base-url" class="config-input" type="text" />
        </div>

        <div class="config-field">
          <label for="cfg-auth-key">\u8BA4\u8BC1\u5BC6\u94A5</label>
          <input id="cfg-auth-key" class="config-input" type="password" />
        </div>

        <div class="config-field">
          <label for="cfg-agent-id">Agent ID <span style="color: #79747E; font-weight: 400;">\xB7 \u7559\u7A7A\u4F7F\u7528\u5E73\u53F0\u9ED8\u8BA4\u503C</span></label>
          <input id="cfg-agent-id" class="config-input" type="text" />
        </div>

        <div class="config-actions">
          <button id="cfg-test-btn" class="config-button config-button-tonal" style="flex: 1;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66L20 14"/><path d="M20 8v6h-6"/></svg>
            \u6D4B\u8BD5\u8FDE\u63A5
          </button>
          <button id="cfg-save-btn" class="config-button config-button-primary" style="flex: 1;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
            \u4FDD\u5B58\u914D\u7F6E
          </button>
        </div>
      </div>

      ${openViewSection}
    </div>
  `;
  }
  async function initConfigPanel(bodyElement) {
    if (!bodyElement) return;
    const baseUrlInput = bodyElement.querySelector("#cfg-base-url");
    const authKeyInput = bodyElement.querySelector("#cfg-auth-key");
    const agentIdInput = bodyElement.querySelector("#cfg-agent-id");
    const testBtn = bodyElement.querySelector("#cfg-test-btn");
    const saveBtn = bodyElement.querySelector("#cfg-save-btn");
    const openviewUrlInput = bodyElement.querySelector("#cfg-openview-url");
    const openviewUsernameInput = bodyElement.querySelector("#cfg-openview-username");
    const openviewPasswordInput = bodyElement.querySelector("#cfg-openview-password");
    const openviewLoginBtn = bodyElement.querySelector("#cfg-openview-login-btn");
    function normalizeBaseUrl2(url) {
      const trimmed = (url || "").trim();
      if (!trimmed) return "http://127.0.0.1:8010";
      return trimmed.replace(/\/$/, "");
    }
    function normalizeOpenViewUrl(url) {
      const trimmed = (url || "").trim();
      if (!trimmed) return "http://127.0.0.1:31020";
      return trimmed.replace(/\/$/, "");
    }
    const showOpenView = isHigoPlatform2();
    try {
      const cfg = await getEchoMemConfig();
      if (baseUrlInput) baseUrlInput.value = cfg.baseUrl || "";
      if (authKeyInput) authKeyInput.value = cfg.authKey || "";
      if (agentIdInput) agentIdInput.value = cfg.agentId || "";
      if (showOpenView) {
        const openviewCfg = await getOpenViewConfig();
        if (openviewUrlInput) openviewUrlInput.value = openviewCfg.baseUrl || "";
        if (openviewUsernameInput) openviewUsernameInput.value = openviewCfg.username || "";
        if (openviewPasswordInput) openviewPasswordInput.value = openviewCfg.password || "";
        const openviewAuth = await getOpenViewAuth();
        if ((openviewAuth == null ? void 0 : openviewAuth.user) && (openviewAuth == null ? void 0 : openviewAuth.csrfToken) && openviewLoginBtn) {
          openviewLoginBtn.textContent = "\u2705 \u5DF2\u767B\u5F55 EchoAgent";
        }
      }
    } catch (err) {
      console.warn("EchoMem: failed to load config", err);
    }
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        var _a, _b, _c, _d;
        showFloatingToast("\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5...", "info", 0);
        try {
          const config = {
            baseUrl: normalizeBaseUrl2(baseUrlInput == null ? void 0 : baseUrlInput.value),
            authKey: ((_a = authKeyInput == null ? void 0 : authKeyInput.value) == null ? void 0 : _a.trim()) || "",
            agentId: ((_b = agentIdInput == null ? void 0 : agentIdInput.value) == null ? void 0 : _b.trim()) || ""
          };
          const client2 = createClient(config);
          const ok = await client2.healthCheck();
          if (ok) {
            showFloatingToast("\u8FDE\u63A5\u6210\u529F", "success");
          } else {
            showFloatingToast("\u8FDE\u63A5\u5931\u8D25\uFF1A\u540E\u7AEF\u8FD4\u56DE\u975E 200 \u72B6\u6001\u7801", "error");
          }
        } catch (err) {
          if (err.name === "AbortError" || ((_c = err.message) == null ? void 0 : _c.includes("aborted"))) {
            showFloatingToast("\u8FDE\u63A5\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5730\u5740\u662F\u5426\u6B63\u786E", "error");
          } else if ((_d = err.message) == null ? void 0 : _d.includes("Failed to fetch")) {
            showFloatingToast("\u65E0\u6CD5\u8FDE\u63A5\u5230\u540E\u7AEF\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u662F\u5426\u542F\u52A8", "error");
          } else {
            showFloatingToast(`\u8FDE\u63A5\u5931\u8D25: ${err.message}`, "error");
          }
        }
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        var _a, _b, _c;
        const config = {
          baseUrl: normalizeBaseUrl2(baseUrlInput == null ? void 0 : baseUrlInput.value),
          authKey: ((_a = authKeyInput == null ? void 0 : authKeyInput.value) == null ? void 0 : _a.trim()) || "",
          agentId: ((_b = agentIdInput == null ? void 0 : agentIdInput.value) == null ? void 0 : _b.trim()) || ""
        };
        try {
          await setEchoMemConfig(config);
          resetClient();
          if (showOpenView) {
            const openviewConfig = {
              baseUrl: normalizeOpenViewUrl(openviewUrlInput == null ? void 0 : openviewUrlInput.value),
              username: ((_c = openviewUsernameInput == null ? void 0 : openviewUsernameInput.value) == null ? void 0 : _c.trim()) || "",
              password: (openviewPasswordInput == null ? void 0 : openviewPasswordInput.value) || ""
            };
            await setOpenViewConfig(openviewConfig);
          }
          showFloatingToast("\u914D\u7F6E\u5DF2\u4FDD\u5B58", "success");
        } catch (err) {
          showFloatingToast(`\u4FDD\u5B58\u5931\u8D25: ${err.message}`, "error");
        }
      });
    }
    if (showOpenView && openviewLoginBtn) {
      openviewLoginBtn.addEventListener("click", async () => {
        var _a, _b;
        showFloatingToast("\u6B63\u5728\u767B\u5F55 EchoAgent...", "info", 0);
        try {
          const openviewConfig = {
            baseUrl: normalizeOpenViewUrl(openviewUrlInput == null ? void 0 : openviewUrlInput.value),
            username: ((_a = openviewUsernameInput == null ? void 0 : openviewUsernameInput.value) == null ? void 0 : _a.trim()) || "",
            password: (openviewPasswordInput == null ? void 0 : openviewPasswordInput.value) || ""
          };
          await setOpenViewConfig(openviewConfig);
          const auth = await login({
            baseUrl: openviewConfig.baseUrl,
            username: openviewConfig.username,
            password: openviewConfig.password
          });
          openviewLoginBtn.textContent = "\u2705 \u5DF2\u767B\u5F55 EchoAgent";
          showFloatingToast(`EchoAgent \u767B\u5F55\u6210\u529F: ${((_b = auth.user) == null ? void 0 : _b.username) || ""}`, "success");
        } catch (err) {
          openviewLoginBtn.textContent = "\u{1F511} \u767B\u5F55 EchoAgent";
          showFloatingToast(`EchoAgent \u767B\u5F55\u5931\u8D25: ${err.message}`, "error");
        }
      });
    }
  }

  // src/core/router.js
  var perfPanelCleanup = null;
  function cleanupPerformancePanel() {
    if (perfPanelCleanup) {
      perfPanelCleanup.destroy();
      perfPanelCleanup = null;
    }
  }
  var skillStoreRoutes = {
    history: {
      title: "\u6211\u7684 Skill",
      render: getSkillHistoryContent
    },
    upload: {
      title: "\u4E0A\u4F20 Skill",
      render: getSkillUploadContent
    },
    manage: {
      title: "\u5B89\u88C5\u7BA1\u7406",
      render: getSkillManageContent
    }
  };
  var resourceSubRoutes = {
    import: {
      title: "\u8D44\u6E90\u5BFC\u5165",
      render: getResourceImportContent
    },
    manage: {
      title: "\u67E5\u770B\u8D44\u6E90",
      render: getResourceManageContent
    }
  };
  function openEchoMemHomePanel() {
    cleanupPerformancePanel();
    setCurrentRoute({ type: "home" });
    openCustomPanel("EchoMem", getEchoMemHomeContent());
    const customPanel = document.querySelector(".claw-custom-panel");
    if (customPanel) {
      delete customPanel.dataset.clawEventsBound;
    }
    bindPanelNavigation();
  }
  function findVisibleOverlay() {
    const currentPanel = getPanelContainer();
    if (isPanelOpen() && (currentPanel == null ? void 0 : currentPanel.isConnected) && currentPanel.style.display !== "none") {
      return currentPanel;
    }
    return Array.from(document.querySelectorAll(".claw-overlay-panel")).find((panel) => panel.isConnected && panel.style.display !== "none") || null;
  }
  function ensureEchoMemOverlayOpen() {
    if (findVisibleOverlay()) {
      return { opened: false, alreadyOpen: true };
    }
    openEchoMemHomePanel();
    return { opened: true, alreadyOpen: false };
  }
  async function navigateToEchoMemPanel(panelIdOrTitle) {
    const panel = getPanelDefinition(panelIdOrTitle);
    if (!panel) return;
    setCurrentRoute({ type: "panel", panelId: panel.id });
    if (panel.id === "feedback") {
      openCenterOverlay("\u8BA4\u77E5\u53CD\u9988", getGraphOverlayContent(), {
        showBack: true,
        onBack: () => {
          closeOverlayPanel();
          openEchoMemHomePanel();
        },
        width: "95vw",
        height: "90vh",
        maxWidth: "1400px",
        maxHeight: "900px",
        compactHeader: true,
        panelClass: "claw-feedback-overlay"
      });
    } else {
      cleanupPerformancePanel();
      if (panel.id === "performance") {
        openCustomPanel(panel.title, getPerformanceContent(), {
          showBack: true,
          onBack: openEchoMemHomePanel
        });
        const body = getPanelBodyElement();
        perfPanelCleanup = initPerformancePanel(body, {
          pollInterval: 5e3
          // 每 5 秒轮询一次，保证模型回复完成后数据及时刷新
        });
      } else {
        openCustomPanel(panel.title, getPanelContent(panel.id), {
          showBack: true,
          onBack: openEchoMemHomePanel
        });
      }
    }
    bindPanelNavigation();
    if (panel.id === "association") {
      await loadConfigValues();
      bindConfigUI();
    }
    if (panel.id === "resources") {
      const body = getPanelBodyElement();
      initImportPanel(body);
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
        openCustomPanel("Skill \u7BA1\u7406", getSkillStoreHomeContent(), {
          showBack: true,
          onBack: openEchoMemHomePanel
        });
        bindPanelNavigation();
      }
    });
    const body = getPanelBodyElement();
    if (sectionId === "upload") {
      initSkillUploadPanel(body);
    } else if (sectionId === "history") {
      initSkillHistoryPanel(body);
    } else if (sectionId === "manage") {
      initSkillManagePanel(body);
    }
    bindPanelControls();
  }
  function navigateToResourceSection(sectionId) {
    const route = resourceSubRoutes[sectionId];
    if (!route) return;
    setCurrentRoute({
      type: "panel",
      panelId: "resources",
      route: sectionId
    });
    openCustomPanel(route.title, route.render(), {
      showBack: true,
      onBack: () => {
        openCustomPanel("\u8D44\u6E90\u7BA1\u7406", getResourceHomeContent(), {
          showBack: true,
          onBack: openEchoMemHomePanel
        });
        bindPanelNavigation();
      }
    });
    const body = getPanelBodyElement();
    if (sectionId === "import") {
      initImportPanel(body);
    } else if (sectionId === "manage") {
      initManagePanel(body);
    }
  }
  function navigateToConfigPanel() {
    setCurrentRoute({
      type: "panel",
      panelId: "echomemConfig"
    });
    openCustomPanel("\u8BB0\u5FC6\u540E\u7AEF\u5F15\u64CE\u8FDE\u63A5\u914D\u7F6E", getEchoMemConfigContent(), {
      showBack: true,
      onBack: openEchoMemHomePanel
    });
    const body = getPanelBodyElement();
    initConfigPanel(body);
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
        return;
      }
      const resourceCard = e.target.closest(".claw-resource-section");
      if (resourceCard) {
        const sectionId = resourceCard.dataset.resourceSection;
        if (sectionId) {
          navigateToResourceSection(sectionId);
        }
        return;
      }
      const configCard = e.target.closest(".claw-config-section");
      if (configCard) {
        navigateToConfigPanel();
      }
    });
    bindPanelControls();
  }

  // src/core/buttons.js
  function openLauncher(event) {
    event.preventDefault();
    event.stopPropagation();
    ensureEchoMemOverlayOpen();
  }
  function findHeaderAnchor(headerLauncherConfig) {
    var _a;
    const selectors = headerLauncherConfig.anchorSelectors || [];
    const preferredXRatio = headerLauncherConfig.preferredXRatio ?? 0.75;
    const minXRatio = headerLauncherConfig.minXRatio ?? 0.18;
    const maxXRatio = headerLauncherConfig.maxXRatio ?? 0.94;
    const maxTop = headerLauncherConfig.maxTop ?? 120;
    const candidates = [];
    selectors.forEach((selector, selectorIndex) => {
      document.querySelectorAll(selector).forEach((icon) => {
        const anchor = icon.closest('button, [role="button"]') || icon.parentElement;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const centerXRatio = (rect.left + rect.width / 2) / Math.max(window.innerWidth, 1);
        const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < maxTop && centerXRatio >= minXRatio && centerXRatio <= maxXRatio;
        if (!isVisible) return;
        candidates.push({
          anchor,
          score: selectorIndex * 1e3 + Math.abs(centerXRatio - preferredXRatio) * 100 + Math.max(rect.top, 0) / 100
        });
      });
    });
    candidates.sort((left, right) => left.score - right.score);
    return ((_a = candidates[0]) == null ? void 0 : _a.anchor) || null;
  }
  function addHeaderLauncher(config) {
    const headerLauncherConfig = config.headerLauncher;
    if (!headerLauncherConfig) return;
    if (document.querySelector(".claw-echomem-header-launcher")) return;
    const anchor = findHeaderAnchor(headerLauncherConfig);
    if (!(anchor == null ? void 0 : anchor.parentNode)) return;
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "claw-echomem-header-launcher";
    launcher.title = headerLauncherConfig.title || "\u6253\u5F00 EchoMem";
    launcher.setAttribute("aria-label", launcher.title);
    const logo = document.createElement("img");
    logo.className = "claw-echomem-header-logo";
    logo.src = chrome.runtime.getURL(
      headerLauncherConfig.logo || "assets/echomem-lockup.png"
    );
    logo.alt = "";
    launcher.appendChild(logo);
    launcher.addEventListener("click", openLauncher);
    anchor.parentNode.insertBefore(launcher, anchor);
    console.log(`Claw Extension: EchoMem header launcher added for ${config.name}`);
  }
  function removeLegacyInputLauncher() {
    document.querySelectorAll(".claw-echomem-launcher-bar").forEach((launcher) => launcher.remove());
  }
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
    removeLegacyInputLauncher();
    addHeaderLauncher(config);
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
  var bound = false;
  function bindRuntimeMessages() {
    if (bound) return;
    bound = true;
    chrome.runtime.onMessage.addListener((request2, sender, sendResponse) => {
      if ((request2 == null ? void 0 : request2.action) !== "openEchoMemOverlay") return false;
      if (!getCurrentPlatform()) {
        sendResponse({ success: false, error: "\u5F53\u524D\u9875\u9762\u4E0D\u662F EchoMem \u652F\u6301\u7684\u5E73\u53F0" });
        return false;
      }
      const result = ensureEchoMemOverlayOpen();
      sendResponse({ success: true, ...result });
      return false;
    });
  }

  // src/entry/content.js
  console.log("EchoMem Extension: Content script loaded");
  window.clawExtensionLoaded = true;
  window.echoMemExtensionLoaded = true;
  function refreshContentScriptMount() {
    addCustomButtons();
    bindPanelNavigation();
    tryBindInputElement();
    const platform = getCurrentPlatform();
    if (platform && !window.echomemInputTrackingStarted) {
      window.echomemInputTrackingStarted = true;
      console.log("EchoMem: Starting input tracking on DOM change for", platform.config.name);
      startInputTracking(platform.config);
    }
    if (platform && shouldRecord(platform.key)) {
      startRecording(platform.key);
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
    if (platform && shouldRecord(platform.key)) {
      startRecording(platform.key);
    } else if (!platform) {
      console.log("EchoMem: Platform not detected yet, session recording will start on next DOM change");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
