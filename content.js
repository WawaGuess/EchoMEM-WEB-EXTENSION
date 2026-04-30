// Content Script
// 注入到每个页面中执行

console.log('Claw Extension: Content script loaded');

// 向页面注入一个标记，方便调试
window.clawExtensionLoaded = true;

// ====== 平台检测配置 ======

const PLATFORM_CONFIGS = {
  // HIGO Office 平台
  'higo': {
    name: 'HIGO Office',
    // 多层检测配置
    detection: {
      // 第一层：URL 路径匹配（最快，先过滤）
      urlPatterns: [
        '/home/session/',
        '/home/workspace/'
      ],
      // 第二层：页面标题关键字（支持 Higo / HIGO / Higo2 / Higo Office 等变体）
      titleKeywords: ['Higo', 'HIGO', 'Higo2', 'Higo Office'],
      // 第三层：DOM 特征检测（最准确，但较慢）
      domFeatures: {
        // 必须同时存在的元素
        required: [
          { selector: '.MuiDrawer-root', description: 'MUI 抽屉组件' },
          { selector: '.MuiPaper-root', description: 'MUI Paper 容器' }
        ],
        // 至少存在一个的元素（可选特征）
        optional: [
          { selector: 'textarea[id^="_r_"]', description: 'React 输入框' },
          { selector: '[data-testid="ArrowUpwardIcon"]', description: '发送按钮图标' },
          { selector: '.MuiDrawer-anchorRight', description: '右侧抽屉' }
        ]
      },
      // 第四层：页面内容关键字（可选，用于进一步确认）
      contentKeywords: ['higo', 'HIGO', 'Higo2']
    },
    detect: function() {
      return detectPlatformMultiLayer(this.detection);
    },
    // 按钮插入位置配置
    buttonBar: {
      // 查找输入框容器的选择器
      containerSelector: '.MuiPaper-root',
      // 验证容器的选择器（确保是正确的输入框容器）
      validateSelectors: {
        textarea: 'textarea[id^="_r_"]',
        sendButton: '[data-testid="ArrowUpwardIcon"]'
      },
      // 按钮栏样式
      style: {
        display: 'flex',
        gap: '8px',
        padding: '8px 12px',
        borderTop: '1px solid #e0e0e0',
        background: 'rgb(255, 251, 254)',
        alignItems: 'center',
        flexWrap: 'wrap'
      },
      // 插入方式：'after' 表示作为兄弟元素插入到容器后面
      insertPosition: 'after'
    },
    // 面板配置
    panel: {
      // 面板类型：'sidebar' 表示替换侧边栏，'overlay' 表示浮层
      type: 'sidebar',
      // 右侧面板选择器（type='sidebar' 时使用）
      containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper',
      // 浮层配置（type='overlay' 时使用）
      overlayConfig: null
    },
    // 按钮配置
    buttons: [
      { text: '资源管理', panel: '资源管理' },
      { text: '输入联想', panel: '输入联想' },
      { text: '认知反馈', panel: '认知反馈' },
      { text: 'skill商店', panel: 'skill商店' }
    ]
  },

  // DeepSeek 聊天平台
  'deepseek': {
    name: 'DeepSeek',
    detection: {
      // 第一层：URL 路径匹配（支持首页 / 和聊天页 /a/chat/s/）
      urlPatterns: ['chat.deepseek.com'],
      // 第二层：页面标题关键字
      titleKeywords: ['DeepSeek'],
      // 第三层：DOM 特征检测
      domFeatures: {
        required: [
          { selector: 'textarea[placeholder*="DeepSeek"]', description: 'DeepSeek 输入框' },
          { selector: '._24fad49', description: '输入框容器' }
        ],
        optional: [
          { selector: '._020ab5b', description: '底部按钮区域' },
          { selector: '[role="button"]', description: '功能按钮' }
        ]
      },
      // 第四层：页面内容关键字
      contentKeywords: ['deepseek', '深度思考', '智能搜索']
    },
    detect: function() {
      return detectPlatformMultiLayer(this.detection);
    },
    // 按钮栏配置
    buttonBar: {
      containerSelector: '._24fad49',
      validateSelectors: {
        textarea: 'textarea[placeholder*="DeepSeek"]'
      },
      // 按钮栏插入到哪个元素之后（默认是 container 自己）
      insertAfter: '._020ab5b',
      // 动态获取背景色，与页面风格保持一致
      getBackgroundColor: () => {
        const inputArea = document.querySelector('._77cefa5');
        if (inputArea) {
          const style = window.getComputedStyle(inputArea);
          if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            return style.backgroundColor;
          }
        }
        return '#fff';
      },
      style: {
        display: 'flex',
        gap: '8px',
        padding: '8px 12px',
        borderTop: '1px solid #e0e0e0',
        alignItems: 'center',
        flexWrap: 'wrap'
      },
      insertPosition: 'after'
    },
    // 面板配置：浮层模式（无侧边栏）
    panel: {
      type: 'overlay',
      containerSelector: null,
      overlayConfig: {
        position: 'right',
        width: '400px',
        backdrop: true
      }
    },
    // 按钮配置
    buttons: [
      { text: '资源管理', panel: '资源管理' },
      { text: '输入联想', panel: '输入联想' },
      { text: '认知反馈', panel: '认知反馈' },
      { text: 'skill商店', panel: 'skill商店' }
    ]
  }
};

// 当前检测到的平台
let currentPlatform = null;

// 多层平台检测函数（4层全部满足才判定为 HIGO 页面）
function detectPlatformMultiLayer(detection) {
  const logs = [];

  // 第一层：URL 路径检测
  if (detection.urlPatterns) {
    const urlMatch = detection.urlPatterns.some(pattern =>
      window.location.href.includes(pattern)
    );
    if (!urlMatch) {
      console.log('Claw Extension: 平台检测未通过 - URL不匹配');
      return false;
    }
    logs.push('✓ URL匹配');
  }

  // 第二层：页面标题检测
  if (detection.titleKeywords) {
    const titleMatch = detection.titleKeywords.some(keyword =>
      document.title.includes(keyword)
    );
    if (!titleMatch) {
      console.log('Claw Extension: 平台检测未通过 - 标题关键字不匹配');
      return false;
    }
    logs.push('✓ 标题关键字匹配');
  }

  // 第三层：DOM 特征检测
  if (detection.domFeatures) {
    const { required, optional } = detection.domFeatures;

    // 检查必须存在的元素（全部都要存在）
    if (required && required.length > 0) {
      for (const feature of required) {
        const exists = document.querySelector(feature.selector) !== null;
        if (!exists) {
          console.log(`Claw Extension: 平台检测未通过 - 缺少必要DOM: ${feature.description}`);
          return false;
        }
      }
      logs.push('✓ 必要DOM元素全部存在');
    }

    // 检查可选特征（至少存在一个）
    if (optional && optional.length > 0) {
      const optionalMatch = optional.some(feature =>
        document.querySelector(feature.selector) !== null
      );
      if (!optionalMatch) {
        console.log('Claw Extension: 平台检测未通过 - 无可选DOM特征匹配');
        return false;
      }
      logs.push('✓ 可选DOM特征匹配');
    }
  }

  // 第四层：页面内容关键字（如果 body 还未加载，跳过此层）
  if (detection.contentKeywords && document.body) {
    const bodyText = document.body.innerText || '';
    // 如果 body 有内容才检测，无内容时跳过（避免页面加载初期误判）
    if (bodyText.length > 0) {
      const contentMatch = detection.contentKeywords.some(keyword =>
        bodyText.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!contentMatch) {
        console.log('Claw Extension: 平台检测未通过 - 页面内容关键字不匹配');
        return false;
      }
      logs.push('✓ 页面内容关键字匹配');
    }
  }

  // 全部通过
  console.log('Claw Extension: 平台检测全部通过:', logs.join(' | '));
  return true;
}

// 检测当前页面属于哪个平台
function detectPlatform() {
  for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
    try {
      if (config.detect()) {
        console.log(`Claw Extension: Detected platform - ${config.name}`);
        return { key, config };
      }
    } catch (e) {
      console.error(`Claw Extension: Detection error for ${key}`, e);
    }
  }
  return null;
}

// ====== 面板状态管理 ======

let originalPanelContent = null;
let isCustomPanelOpen = false;
let currentOverlayPanel = null;

// 获取面板容器（支持 sidebar 和 overlay 两种模式）
function getPanelContainer() {
  const platform = currentPlatform || detectPlatform();
  if (!platform) return null;

  const panelConfig = platform.config.panel;

  if (panelConfig.type === 'sidebar') {
    return document.querySelector(panelConfig.containerSelector);
  } else if (panelConfig.type === 'overlay') {
    // overlay 模式下返回已创建的浮层面板
    return currentOverlayPanel;
  }

  return null;
}

// 保存原始面板内容
function saveOriginalPanel() {
  const platform = currentPlatform || detectPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (container && !originalPanelContent) {
      originalPanelContent = container.innerHTML;
    }
  }
  // overlay 模式不需要保存原始内容
}

// 构建面板头部 HTML
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
          " title="返回">
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
        " title="关闭">
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
        " title="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }
}

// 绑定面板事件（返回按钮、关闭按钮）
function bindPanelEvents(container, showBack, onBack) {
  // 绑定返回按钮事件
  if (showBack) {
    const backBtn = container.querySelector('.claw-back-btn');
    if (backBtn) {
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.background = '#f0f0f0';
      });
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.background = 'none';
      });
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onBack) onBack();
      });
    }
  }

  // 绑定关闭按钮事件
  const closeBtn = container.querySelector('.claw-close-panel');
  if (closeBtn) {
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#f0f0f0';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
    });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      restoreOriginalPanel();
    });
  }
}

// 打开自定义面板（支持 sidebar 和 overlay 两种模式）
function openCustomPanel(title, contentHtml, options = {}) {
  const platform = currentPlatform || detectPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;
  const { showBack = false, onBack = null } = options;

  isCustomPanelOpen = true;

  const headerHtml = buildPanelHeader(title, showBack, onBack);
  const panelHtml = `
    <div class="claw-custom-panel" style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
    ">
      ${headerHtml}
      <div style="
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      ">
        ${contentHtml}
      </div>
    </div>
  `;

  if (panelConfig.type === 'sidebar') {
    // Sidebar 模式：替换侧边栏内容
    const container = document.querySelector(panelConfig.containerSelector);
    if (!container) return;

    // 先保存原始内容
    if (!originalPanelContent) {
      originalPanelContent = container.innerHTML;
    }

    container.innerHTML = panelHtml;
    bindPanelEvents(container, showBack, onBack);

  } else if (panelConfig.type === 'overlay') {
    // Overlay 模式：创建浮层面板
    createOverlayPanel(panelHtml, panelConfig.overlayConfig);
    bindPanelEvents(currentOverlayPanel, showBack, onBack);
  }
}

// 创建浮层面板
function createOverlayPanel(panelHtml, overlayConfig) {
  // 移除已存在的浮层面板
  if (currentOverlayPanel) {
    currentOverlayPanel.remove();
    currentOverlayPanel = null;
  }

  // 移除所有已存在的遮罩层（防止多次打开叠加）
  document.querySelectorAll('.claw-overlay-backdrop').forEach(b => b.remove());

  // 创建遮罩层（如果需要）
  let backdrop = null;
  if (overlayConfig.backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'claw-overlay-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
    backdrop.addEventListener('click', restoreOriginalPanel);
    document.body.appendChild(backdrop);
  }

  // 创建浮层面板
  const overlay = document.createElement('div');
  overlay.className = 'claw-overlay-panel';

  // 根据位置配置样式
  const position = overlayConfig.position || 'right';
  const width = overlayConfig.width || '400px';

  let positionStyles = '';
  if (position === 'right') {
    positionStyles = `
      top: 0;
      right: 0;
      bottom: 0;
      width: ${width};
      transform: translateX(100%);
    `;
  } else if (position === 'left') {
    positionStyles = `
      top: 0;
      left: 0;
      bottom: 0;
      width: ${width};
      transform: translateX(-100%);
    `;
  } else if (position === 'center') {
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

  // 触发动画
  requestAnimationFrame(() => {
    if (position === 'right') {
      overlay.style.transform = 'translateX(0)';
    } else if (position === 'left') {
      overlay.style.transform = 'translateX(0)';
    } else if (position === 'center') {
      overlay.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  });

  currentOverlayPanel = overlay;
}

// 恢复原始面板
function restoreOriginalPanel() {
  const platform = currentPlatform || detectPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (container && originalPanelContent) {
      container.innerHTML = originalPanelContent;
      isCustomPanelOpen = false;
      console.log('Claw Extension: Sidebar panel restored');
    }
  } else if (panelConfig.type === 'overlay') {
    // 移除浮层面板
    if (currentOverlayPanel) {
      const position = panelConfig.overlayConfig?.position || 'right';

      // 添加关闭动画
      if (position === 'right') {
        currentOverlayPanel.style.transform = 'translateX(100%)';
      } else if (position === 'left') {
        currentOverlayPanel.style.transform = 'translateX(-100%)';
      } else if (position === 'center') {
        currentOverlayPanel.style.transform = 'translate(-50%, -50%) scale(0.9)';
        currentOverlayPanel.style.opacity = '0';
      }

      // 动画结束后移除元素
      setTimeout(() => {
        if (currentOverlayPanel) {
          currentOverlayPanel.remove();
          currentOverlayPanel = null;
        }
      }, 300);
    }

    // 移除所有遮罩层
    document.querySelectorAll('.claw-overlay-backdrop').forEach(b => {
      b.style.opacity = '0';
      setTimeout(() => b.remove(), 300);
    });

    isCustomPanelOpen = false;
    console.log('Claw Extension: Overlay panel closed');
  }
}

// 生成不同面板的内容
function getPanelContent(type) {
  const contents = {
    '资源管理': `
      <div style="color: #666;">
        <p style="margin-bottom: 12px;">📁 资源管理面板</p>
        <div style="
          border: 1px dashed #ccc;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          color: #999;
        ">
          <p>拖拽文件到此处上传</p>
          <p style="font-size: 12px; margin-top: 8px;">支持 PDF, DOC, TXT, MD 等格式</p>
        </div>
        <div style="margin-top: 16px;">
          <p style="font-weight: 500; margin-bottom: 8px; color: #333;">已上传资源</p>
          <div style="
            padding: 12px;
            background: #f5f5f5;
            border-radius: 6px;
            font-size: 13px;
            color: #999;
          ">暂无资源</div>
        </div>
      </div>
    `,
    '输入联想': getInputAssociationContent(),
    '认知反馈': `
      <div style="color: #666;">
        <p style="margin-bottom: 12px;">🧠 认知反馈面板</p>
        <div style="
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 12px;
        ">
          <p style="font-weight: 500; color: #333; margin-bottom: 8px;">当前会话分析</p>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span>对话轮次</span>
            <span style="color: #333; font-weight: 500;">0</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span>平均响应时间</span>
            <span style="color: #333; font-weight: 500;">--</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>Token 消耗</span>
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
        ">生成反馈报告</button>
      </div>
    `,
    'skill商店': getSkillStoreHomeContent()
  };
  return contents[type] || '<p>暂无内容</p>';
}

// ====== Skill 商店导航 ======

function getSkillStoreHomeContent() {
  const sections = [
    { id: 'history', title: '📜 用户历史 Skill', desc: '查看和管理你使用过的 Skill', color: '#667eea' },
    { id: 'upload', title: '⬆️ 上传 Skill 到商店', desc: '上传你的自定义 Skill 到商店', color: '#42a5f5' },
    { id: 'purchase', title: '🛒 商店 Skill 购买', desc: '浏览和购买商店中的 Skill', color: '#66bb6a' },
    { id: 'merchant', title: '🏪 商家提供的 Skill', desc: '官方和认证商家的 Skill', color: '#ffa726' },
    { id: 'manage', title: '⚙️ Skill 安装管理', desc: '管理已安装的 Skill', color: '#ef5350' }
  ];

  const cards = sections.map(s => `
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
      ">${s.title.split(' ')[0]}</div>
      <div style="flex: 1;">
        <p style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 2px;">${s.title.split(' ').slice(1).join(' ')}</p>
        <p style="font-size: 12px; color: #888;">${s.desc}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cards}
    </div>
  `;
}

// ====== 输入联想面板 ======

let inputAssociationEnabled = false;

function getInputAssociationContent() {
  const btnText = inputAssociationEnabled ? '关闭联想' : '确认开启';
  const btnBg = inputAssociationEnabled ? '#ffebee' : '#667eea';
  const btnColor = inputAssociationEnabled ? '#c62828' : '#fff';
  const statusText = inputAssociationEnabled ? '✅ 输入联想已开启' : '❌ 输入联想未开启';
  const statusColor = inputAssociationEnabled ? '#2e7d32' : '#888';

  return `
    <div style="color: #666;">
      <!-- 开关按钮 -->
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

      <!-- 状态提示 -->
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

      <!-- 功能说明 -->
      <div style="margin-bottom: 16px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">💡 功能说明</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8; margin: 0;">
          <li>智能补全：根据上下文自动补全代码和文本</li>
          <li>代码片段联想：快速插入常用代码片段</li>
          <li>历史记录联想：基于历史输入提供建议</li>
        </ul>
      </div>

      <!-- 使用提示 -->
      <div style="
        padding: 12px;
        background: #f0f7ff;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #667eea;
        color: #666;
      ">
        💡 提示：输入时按 Tab 键快速接受联想建议
      </div>
    </div>
  `;
}

function toggleInputAssociation() {
  inputAssociationEnabled = !inputAssociationEnabled;
  // 重新渲染面板内容
  const platform = currentPlatform || detectPlatform();
  if (!platform) return;

  const panelConfig = platform.config.panel;
  let contentDiv = null;

  if (panelConfig.type === 'sidebar') {
    const container = document.querySelector(panelConfig.containerSelector);
    if (container) {
      contentDiv = container.querySelector('.claw-custom-panel > div:last-child');
    }
  } else if (panelConfig.type === 'overlay') {
    if (currentOverlayPanel) {
      contentDiv = currentOverlayPanel.querySelector('.claw-custom-panel > div:last-child');
    }
  }

  if (contentDiv) {
    contentDiv.innerHTML = getInputAssociationContent();
    // 重新绑定按钮事件
    bindToggleButton();
  }
  console.log('Claw Extension: Input association', inputAssociationEnabled ? 'enabled' : 'disabled');
}

function bindToggleButton() {
  const toggleBtn = document.getElementById('claw-toggle-association');
  if (toggleBtn && !toggleBtn.dataset.clawBound) {
    toggleBtn.dataset.clawBound = 'true';
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleInputAssociation();
    });
  }
}

function navigateToSkillSection(sectionId) {
  const contents = {
    'history': getSkillHistoryContent(),
    'upload': getSkillUploadContent(),
    'purchase': getSkillPurchaseContent(),
    'merchant': getSkillMerchantContent(),
    'manage': getSkillManageContent()
  };

  const titles = {
    'history': '用户历史 Skill',
    'upload': '上传 Skill 到商店',
    'purchase': '商店 Skill 购买',
    'merchant': '商家提供的 Skill',
    'manage': 'Skill 安装管理'
  };

  openCustomPanel(titles[sectionId], contents[sectionId], {
    showBack: true,
    onBack: () => {
      openCustomPanel('skill商店', getSkillStoreHomeContent());
    }
  });
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
            <p style="font-weight: 500; color: #333; font-size: 14px;">SQL 查询助手</p>
            <p style="font-size: 12px; color: #888;">上次使用: 2天前 · 使用 15 次</p>
          </div>
          <span style="padding: 3px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 11px;">已启用</span>
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
            <p style="font-weight: 500; color: #333; font-size: 14px;">JSON 格式化</p>
            <p style="font-size: 12px; color: #888;">上次使用: 1周前 · 使用 8 次</p>
          </div>
          <span style="padding: 3px 10px; background: #999; color: white; border-radius: 10px; font-size: 11px;">已停用</span>
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
            <p style="font-weight: 500; color: #333; font-size: 14px;">正则表达式工具</p>
            <p style="font-size: 12px; color: #888;">上次使用: 3天前 · 使用 23 次</p>
          </div>
          <span style="padding: 3px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 11px;">已启用</span>
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
        <p style="font-size: 36px; margin-bottom: 8px;">📤</p>
        <p style="font-size: 14px; color: #333; font-weight: 500; margin-bottom: 4px;">点击或拖拽上传 Skill 文件</p>
        <p style="font-size: 12px; color: #999;">支持 .skill .json .yaml 格式，最大 10MB</p>
      </div>
      <div style="margin-bottom: 20px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">上传须知</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8;">
          <li>Skill 文件需包含完整的配置信息</li>
          <li>上传后需要经过审核才能上架</li>
          <li>禁止上传包含恶意代码的 Skill</li>
          <li>审核通常需要 1-3 个工作日</li>
        </ul>
      </div>
      <div>
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">我的上传记录</p>
        <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 13px; color: #888;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>代码审查助手</span>
            <span style="color: #ffa726;">审核中</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>API 文档生成器</span>
            <span style="color: #ffa726;">审核中</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>日志分析工具</span>
            <span style="color: #66bb6a;">已通过</span>
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
            <div style="width: 40px; height: 40px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📊</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">数据分析大师</p>
              <p style="font-size: 11px; color: #888;">⭐ 4.8 · 已售 1.2k · 开发者: DataLab</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">¥ 9.9</span>
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
            <div style="width: 40px; height: 40px; background: #f3e5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📝</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">智能写作助手</p>
              <p style="font-size: 11px; color: #888;">⭐ 4.6 · 已售 856 · 开发者: WriteAI</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">¥ 19.9</span>
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
            <div style="width: 40px; height: 40px; background: #e8f5e9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">🎨</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">图像生成器</p>
              <p style="font-size: 11px; color: #888;">⭐ 4.9 · 已售 2.3k · 开发者: ArtGen</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">¥ 29.9</span>
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
              <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">🏢</div>
              <p style="font-weight: 600; font-size: 15px;">企业级知识库</p>
            </div>
            <span style="padding: 3px 10px; background: rgba(255,255,255,0.2); border-radius: 10px; font-size: 11px;">官方</span>
          </div>
          <p style="font-size: 13px; opacity: 0.9; line-height: 1.5;">集成企业内部文档、流程、规范的智能助手，支持多部门协作和权限管理。</p>
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
              <div style="width: 36px; height: 36px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">📋</div>
              <p style="font-weight: 600; color: #333; font-size: 15px;">项目管理助手</p>
            </div>
            <span style="padding: 3px 10px; background: #e3f2fd; color: #1976d2; border-radius: 10px; font-size: 11px;">认证商家</span>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.5;">支持 Jira、Trello、Notion 等项目管理工具，自动生成项目报告和进度跟踪。</p>
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
              <div style="width: 36px; height: 36px; background: #fff3e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">🔒</div>
              <p style="font-weight: 600; color: #333; font-size: 15px;">安全审计助手</p>
            </div>
            <span style="padding: 3px 10px; background: #e3f2fd; color: #1976d2; border-radius: 10px; font-size: 11px;">认证商家</span>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.5;">自动化安全漏洞扫描和代码审计，支持多种编程语言和框架。</p>
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
            <div style="width: 40px; height: 40px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📊</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">数据分析大师</p>
              <p style="font-size: 12px; color: #888;">v2.1.0 · 占用 12MB · 上次更新: 3天前</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">更新</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">卸载</button>
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
            <div style="width: 40px; height: 40px; background: #f3e5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📝</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">智能写作助手</p>
              <p style="font-size: 12px; color: #888;">v1.5.2 · 占用 8MB · 已是最新版本</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #e8f5e9; color: #2e7d32; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">最新</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">卸载</button>
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
            <div style="width: 40px; height: 40px; background: #fff3e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">🔍</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">正则表达式工具</p>
              <p style="font-size: 12px; color: #888;">v1.0.0 · 占用 3MB · 上次更新: 1周前</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">更新</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">卸载</button>
          </div>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
          <span>已安装: 5 个 Skill</span>
          <span>总占用: 45MB</span>
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
        ">一键卸载全部 Skill</button>
      </div>
    </div>
  `;
}

// ====== 通用按钮添加函数 ======

function addCustomButtons() {
  // 如果还没有检测到平台，先进行检测
  // 注意：不缓存检测失败的结果，因为 DOM 可能是动态加载的
  if (!currentPlatform) {
    const detected = detectPlatform();
    if (detected) {
      currentPlatform = detected;
      console.log('Claw Extension: Platform detected -', currentPlatform.config.name);
    } else {
      return;
    }
  }

  const platform = currentPlatform;
  const config = platform.config;
  const bbConfig = config.buttonBar;

  // 使用平台配置的容器选择器查找输入框容器
  const inputContainers = document.querySelectorAll(bbConfig.containerSelector);

  for (const container of inputContainers) {
    // 检查是否已经是处理过的容器
    if (container.dataset.clawButtonsAdded) continue;

    // 使用平台配置的验证选择器来确认正确的容器
    let isValidContainer = true;
    for (const [key, selector] of Object.entries(bbConfig.validateSelectors)) {
      if (!container.querySelector(selector)) {
        isValidContainer = false;
        break;
      }
    }

    if (!isValidContainer) continue;

    container.dataset.clawButtonsAdded = 'true';

    // 创建按钮容器
    const buttonBar = document.createElement('div');
    buttonBar.className = 'claw-custom-buttons';

    // 应用平台配置的样式
    const style = { ...bbConfig.style };

    // 如果配置了动态背景色获取函数，优先使用
    if (bbConfig.getBackgroundColor && typeof bbConfig.getBackgroundColor === 'function') {
      try {
        const dynamicBg = bbConfig.getBackgroundColor();
        if (dynamicBg) {
          style.background = dynamicBg;
        }
      } catch (e) {
        console.log('Claw Extension: getBackgroundColor failed, using default', e);
      }
    }

    buttonBar.style.cssText = Object.entries(style)
      .map(([key, value]) => {
        // 将 camelCase 转换为 kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      })
      .join('; ');

    // 使用平台配置的按钮列表
    const buttons = config.buttons.map(btn => ({
      text: btn.text,
      action: () => openCustomPanel(btn.panel, getPanelContent(btn.panel))
    }));

    buttons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.textContent = btnConfig.text;
      btn.style.cssText = `
        padding: 4px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background: #fff;
        color: #333;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        ${btnConfig.style || ''}
      `;
      btn.addEventListener('mouseenter', () => {
        if (!btnConfig.style) {
          btn.style.background = '#667eea';
          btn.style.color = '#fff';
          btn.style.borderColor = '#667eea';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (!btnConfig.style) {
          btn.style.background = '#fff';
          btn.style.color = '#333';
          btn.style.borderColor = '#e0e0e0';
        }
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnConfig.action();
      });
      buttonBar.appendChild(btn);
    });

    // 根据平台配置的插入位置插入按钮栏
    if (bbConfig.insertAfter) {
      // 如果配置了 insertAfter，将按钮栏插入到指定元素之后
      const insertTarget = document.querySelector(bbConfig.insertAfter);
      if (insertTarget && insertTarget.parentNode) {
        insertTarget.parentNode.insertBefore(buttonBar, insertTarget.nextSibling);
      } else {
        // 回退到默认的 after 行为
        container.parentNode.insertBefore(buttonBar, container.nextSibling);
      }
    } else if (bbConfig.insertPosition === 'after') {
      container.parentNode.insertBefore(buttonBar, container.nextSibling);
    } else if (bbConfig.insertPosition === 'before') {
      container.parentNode.insertBefore(buttonBar, container);
    } else if (bbConfig.insertPosition === 'append') {
      container.appendChild(buttonBar);
    }

    console.log(`Claw Extension: Custom buttons added for ${config.name}`);
    break;
  }
}

// 辅助函数：向 textarea 插入文本
function insertText(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;

  textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;

  // 触发 input 事件以更新 React 状态
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

// 使用 MutationObserver 监听页面变化，因为输入框可能是动态加载的
const observer = new MutationObserver((mutations) => {
  addCustomButtons();

  // 如果面板被重新渲染（比如切换标签），且自定义面板未打开，保存新的原始内容
  const platform = currentPlatform || detectPlatform();
  if (platform) {
    const panelConfig = platform.config.panel;
    if (panelConfig.type === 'sidebar') {
      const container = document.querySelector(panelConfig.containerSelector);
      if (container && !isCustomPanelOpen && !container.querySelector('.claw-custom-panel')) {
        originalPanelContent = container.innerHTML;
      }
    }
  }

  // 绑定 Skill 商店板块卡片的点击事件（事件委托）
  const skillPanel = document.querySelector('.claw-custom-panel');
  if (skillPanel && !skillPanel.dataset.clawEventsBound) {
    skillPanel.dataset.clawEventsBound = 'true';
    skillPanel.addEventListener('click', (e) => {
      const card = e.target.closest('.claw-skill-section');
      if (card) {
        const sectionId = card.dataset.section;
        if (sectionId) {
          navigateToSkillSection(sectionId);
        }
      }
    });
  }

  // 绑定输入联想开关按钮事件
  bindToggleButton();
});

// 启动观察
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初始尝试添加按钮
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addCustomButtons);
} else {
  addCustomButtons();
}

// 监听来自 popup 或 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 预留消息处理接口，用于后续扩展
  return true;
});
