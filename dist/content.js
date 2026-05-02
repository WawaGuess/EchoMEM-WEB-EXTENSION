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
  var state = {
    platform: null,
    association: {
      enabled: false
    },
    panel: {
      isOpen: false,
      currentRoute: null
    }
  };
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

  // src/panels/resource.js
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

  // src/panels/association.js
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
          <li>\u667A\u80FD\u8865\u5168\uFF1A\u6839\u636E\u4E0A\u4E0B\u6587\u81EA\u52A8\u8865\u5168\u4EE3\u7801\u548C\u6587\u672C</li>
          <li>\u4EE3\u7801\u7247\u6BB5\u8054\u60F3\uFF1A\u5FEB\u901F\u63D2\u5165\u5E38\u7528\u4EE3\u7801\u7247\u6BB5</li>
          <li>\u5386\u53F2\u8BB0\u5F55\u8054\u60F3\uFF1A\u57FA\u4E8E\u5386\u53F2\u8F93\u5165\u63D0\u4F9B\u5EFA\u8BAE</li>
        </ul>
      </div>
      <div style="
        padding: 12px;
        background: #f0f7ff;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #667eea;
        color: #666;
      ">
        \u{1F4A1} \u63D0\u793A\uFF1A\u8F93\u5165\u65F6\u6309 Tab \u952E\u5FEB\u901F\u63A5\u53D7\u8054\u60F3\u5EFA\u8BAE
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

  // src/panels/feedback.js
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

  // src/panels/performance.js
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

  // src/panels/skill-store.js
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

  // src/panels/echomem.js
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
  function navigateToEchoMemPanel(panelIdOrTitle) {
    const panel = getPanelDefinition(panelIdOrTitle);
    if (!panel) return;
    setCurrentRoute({ type: "panel", panelId: panel.id });
    openCustomPanel(panel.title, getPanelContent(panel.id), {
      showBack: true,
      onBack: openEchoMemHomePanel
    });
    bindPanelNavigation();
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
  function refreshInputAssociationPanel() {
    const contentDiv = getPanelBodyElement();
    if (contentDiv) {
      contentDiv.innerHTML = getInputAssociationContent();
      bindToggleButton(handleInputAssociationToggle);
    }
  }
  function handleInputAssociationToggle() {
    toggleInputAssociation();
    refreshInputAssociationPanel();
  }
  function bindPanelControls() {
    bindToggleButton(handleInputAssociationToggle);
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
  }
  var lifecycle = createDomLifecycle({
    onDomChange: refreshContentScriptMount
  });
  function start() {
    lifecycle.start();
    refreshContentScriptMount();
    bindRuntimeMessages();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
