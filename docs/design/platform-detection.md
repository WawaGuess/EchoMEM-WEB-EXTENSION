# Claw Extension 平台检测系统设计文档

> 注意：当前 UI 入口使用 `launcher/menuItems` 配置。旧版 `buttonBar/buttons` 方案仅保留在 legacy 文档中，当前交互方案见 [echomem-launcher-sidebar.md](./echomem-launcher-sidebar.md)。

## 1. 概述

Claw Extension 采用多层平台检测机制，确保只在目标网站的特定页面注入增强功能。检测系统通过 4 层验证，全部满足才判定为目标平台。目前已支持 HIGO Office 和 DeepSeek 两个平台。

## 2. 设计目标

- **精确匹配**：避免在其他网站误注入按钮
- **可扩展**：支持后续添加新平台配置
- **可调试**：控制台输出每层检测结果
- **性能友好**：短路模式，一层失败立即返回

## 3. 检测架构

### 3.1 配置结构

```javascript
const PLATFORM_CONFIGS = {
  // HIGO Office 平台
  'higo': {
    name: 'HIGO Office',
    detection: {
      urlPatterns: ['/home/session/', '/home/workspace/'],
      titleKeywords: ['Higo', 'HIGO', 'Higo2', 'Higo Office'],
      domFeatures: {
        required: [
          { selector: '.MuiDrawer-root', description: 'MUI 抽屉组件' },
          { selector: '.MuiPaper-root', description: 'MUI Paper 容器' }
        ],
        optional: [
          { selector: 'textarea[id^="_r_"]', description: 'React 输入框' },
          { selector: '[data-testid="ArrowUpwardIcon"]', description: '发送按钮图标' },
          { selector: '.MuiDrawer-anchorRight', description: '右侧抽屉' }
        ]
      },
      contentKeywords: ['higo', 'HIGO', 'Higo2']
    },
    detect: function() {
      return detectPlatformMultiLayer(this.detection);
    },
    launcher: {
      text: 'EchoMem',
      containerSelector: '.MuiPaper-root',
      validateSelectors: {
        textarea: 'textarea[id^="_r_"]',
        sendButton: '[data-testid="ArrowUpwardIcon"]'
      },
      style: {
        display: 'flex',
        gap: '8px',
        padding: '0 12px 8px',
        background: 'rgb(255, 251, 254)',
        alignItems: 'center',
        justifyContent: 'flex-start'
      },
      insertPosition: 'before'
    },
    panel: {
      type: 'sidebar',
      containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper',
      overlayConfig: null
    },
    menuItems: [
      { text: '资源管理', panel: '资源管理', description: '管理文件资源与上传内容' },
      { text: '输入联想', panel: '输入联想', description: '开启或关闭智能联想' },
      { text: '认知反馈', panel: '认知反馈', description: '查看会话分析与反馈报告' },
      { text: 'skill商店', panel: 'skill商店', description: '浏览、上传、安装 Skill' },
      { text: '效能', panel: '效能', description: '查看使用效率与工作表现' }
    ]
  },

  // DeepSeek 平台
  'deepseek': {
    name: 'DeepSeek',
    detection: {
      urlPatterns: ['chat.deepseek.com'],
      titleKeywords: ['DeepSeek'],
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
      contentKeywords: ['deepseek', '深度思考', '智能搜索']
    },
    detect: function() {
      return detectPlatformMultiLayer(this.detection);
    },
    launcher: {
      text: 'EchoMem',
      containerSelector: '._77cefa5, ._24fad49',
      validateSelectors: {
        textarea: 'textarea[placeholder*="DeepSeek"]'
      },
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
        padding: '0 12px 8px',
        alignItems: 'center',
        justifyContent: 'flex-start'
      },
      insertPosition: 'before'
    },
    panel: {
      type: 'overlay',
      containerSelector: null,
      overlayConfig: {
        position: 'right',
        width: '400px',
        backdrop: true
      }
    },
    menuItems: [
      { text: '资源管理', panel: '资源管理', description: '管理文件资源与上传内容' },
      { text: '输入联想', panel: '输入联想', description: '开启或关闭智能联想' },
      { text: '认知反馈', panel: '认知反馈', description: '查看会话分析与反馈报告' },
      { text: 'skill商店', panel: 'skill商店', description: '浏览、上传、安装 Skill' },
      { text: '效能', panel: '效能', description: '查看使用效率与工作表现' }
    ]
  }
};
```

### 3.2 检测流程图

```
检测开始
    │
    ▼
┌─────────────────┐     否      ┌─────────────────┐
│  第一层：URL    │ ──────────→ │   返回 false    │
│  路径匹配？     │             │  控制台：URL不匹配 │
└─────────────────┘             └─────────────────┘
    │是
    ▼
┌─────────────────┐     否      ┌─────────────────┐
│  第二层：标题   │ ──────────→ │   返回 false    │
│  关键字匹配？   │             │ 控制台：标题不匹配 │
└─────────────────┘             └─────────────────┘
    │是
    ▼
┌─────────────────┐     否      ┌─────────────────┐
│  第三层：必要   │ ──────────→ │   返回 false    │
│  DOM 存在？     │             │ 控制台：缺少DOM   │
└─────────────────┘             └─────────────────┘
    │是
    ▼
┌─────────────────┐     否      ┌─────────────────┐
│  第三层：可选   │ ──────────→ │   返回 false    │
│  DOM 存在？     │             │ 控制台：无可选DOM │
└─────────────────┘             └─────────────────┘
    │是
    ▼
┌─────────────────┐     否      ┌─────────────────┐
│  第四层：内容   │ ──────────→ │   返回 false    │
│  关键字匹配？   │             │ 控制台：内容不匹配│
└─────────────────┘             └─────────────────┘
    │是
    ▼
┌─────────────────────────────────────────────────┐
│              返回 true                           │
│  控制台：全部通过 ✓ URL ✓ 标题 ✓ 必要DOM ✓ 可选DOM ✓ 内容 │
└─────────────────────────────────────────────────┘
```

### 3.3 检测函数实现

```javascript
function detectPlatformMultiLayer(detection) {
  // 第一层：URL 路径检测
  if (detection.urlPatterns) {
    const urlMatch = detection.urlPatterns.some(pattern =>
      window.location.href.includes(pattern)
    );
    if (!urlMatch) {
      console.log('Claw Extension: 平台检测未通过 - URL不匹配');
      return false;
    }
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
  }

  // 第三层：DOM 特征检测
  if (detection.domFeatures) {
    const { required, optional } = detection.domFeatures;

    // 必须元素全部存在
    if (required && required.length > 0) {
      for (const feature of required) {
        if (!document.querySelector(feature.selector)) {
          console.log(`Claw Extension: 平台检测未通过 - 缺少必要DOM: ${feature.description}`);
          return false;
        }
      }
    }

    // 可选特征至少存在一个
    if (optional && optional.length > 0) {
      const optionalMatch = optional.some(feature =>
        document.querySelector(feature.selector) !== null
      );
      if (!optionalMatch) {
        console.log('Claw Extension: 平台检测未通过 - 无可选DOM特征匹配');
        return false;
      }
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
    }
  }

  console.log('Claw Extension: 平台检测全部通过');
  return true;
}
```

## 4. 各层检测说明

### 4.1 第一层：URL 路径匹配

| 属性 | 值 |
|------|-----|
| 检测方式 | `window.location.href.includes(pattern)` |
| 匹配模式 | `/home/session/`, `/home/workspace/` |
| 作用 | 快速过滤非 HIGO 页面 |

**示例**：
- ✓ `http://localhost:31010/home/session/abc123`
- ✗ `http://localhost:31010/login`
- ✗ `http://other-site.com/chat`

### 4.2 第二层：页面标题关键字

| 属性 | 值 |
|------|-----|
| 检测方式 | `document.title.includes(keyword)` |
| 匹配关键字 | `Higo`, `HIGO`, `Higo2`, `Higo Office` |
| 作用 | 确认页面标题包含品牌标识 |

### 4.3 第三层：DOM 特征检测

#### 必要元素（required）

全部必须存在：

| 选择器 | 描述 | 对应组件 |
|--------|------|----------|
| `.MuiDrawer-root` | MUI 抽屉组件 | 右侧边栏容器 |
| `.MuiPaper-root` | MUI Paper 容器 | 输入框外层容器 |

#### 可选特征（optional）

至少存在一个：

| 选择器 | 描述 | 对应组件 |
|--------|------|----------|
| `textarea[id^="_r_"]` | React 输入框 | 聊天输入框 |
| `[data-testid="ArrowUpwardIcon"]` | 发送按钮图标 | 消息发送按钮 |
| `.MuiDrawer-anchorRight` | 右侧抽屉 | 用户信息面板 |

### 4.4 第四层：页面内容关键字

| 属性 | 值 |
|------|-----|
| 检测方式 | `document.body.innerText.includes(keyword)` |
| 匹配关键字 | `higo`, `HIGO`, `Higo2`（不区分大小写） |
| 作用 | 确认页面文本内容包含品牌标识（body 无内容时跳过） |

## 5. 面板系统（新增）

### 5.1 两种面板模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `sidebar` | 替换页面现有侧边栏 | 有右侧边栏的页面（如 HIGO） |
| `overlay` | 创建浮层面板 | 无侧边栏的页面 |

### 5.2 Sidebar 模式

```javascript
panel: {
  type: 'sidebar',
  containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper',
  overlayConfig: null
}
```

**行为**：
- 打开面板：替换侧边栏的 `innerHTML`
- 关闭面板：恢复保存的原始 `innerHTML`

### 5.3 Overlay 模式

```javascript
panel: {
  type: 'overlay',
  containerSelector: null,
  overlayConfig: {
    position: 'right',    // 'right' | 'left' | 'center'
    width: '400px',       // 面板宽度
    backdrop: true        // 是否显示遮罩层
  }
}
```

**行为**：
- 打开面板：创建 `fixed` 定位的浮层，带动画滑入
- 关闭面板：动画滑出后移除 DOM 元素

### 5.4 面板位置示意

**Sidebar 模式**：
```
┌─────────────────────────────────────────────┐
│  HIGO Office 页面                            │
│                                             │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │   聊天消息区域    │  │  右侧边栏        │  │
│  │                 │  │  (被替换为面板)   │  │
│  │                 │  │                  │  │
│  │                 │  │  ┌───────────┐   │  │
│  │                 │  │  │   标题    ×│   │  │
│  │                 │  │  ├───────────┤   │  │
│  │                 │  │  │           │   │  │
│  │                 │  │  │   内容    │   │  │
│  │                 │  │  │           │   │  │
│  │                 │  │  └───────────┘   │  │
│  └─────────────────┘  └─────────────────┘  │
│       ↑                                     │
│  EchoMem 入口                               │
└─────────────────────────────────────────────┘
```

**Overlay 模式（右侧滑出）**：
```
┌─────────────────────────────────────────────┐
│  Another Claw 页面                           │
│                                             │
│  ┌─────────────────┐                        │
│  │   聊天消息区域    │   ┌──────────────┐   │
│  │                 │   │   浮层面板      │   │
│  │                 │   │  ┌──────────┐  │   │
│  │                 │   │  │ 标题    × │  │   │
│  │                 │   │  ├──────────┤  │   │
│  │                 │   │  │          │  │   │
│  │                 │   │  │   内容   │  │   │
│  │                 │   │  │          │  │   │
│  └─────────────────┘   │  └──────────┘  │   │
│       ↑                └──────────────┘   │
│  EchoMem 入口（在输入框外部上方）              │
└─────────────────────────────────────────────┘
```

## 6. EchoMem 入口注入流程

检测通过后，进入 EchoMem 入口注入阶段：

```
平台检测通过
    │
    ▼
addCustomButtons()
    │
    ├── 获取平台配置（currentPlatform）
    │
    ├── 查找容器（launcher.containerSelector）
    │       └── 遍历所有匹配元素
    │
    ├── 验证容器（launcher.validateSelectors）
    │       ├── 包含 textarea[id^="_r_"]
    │       └── 包含 [data-testid="ArrowUpwardIcon"]
    │
    ├── 创建入口栏（应用 launcher.style）
    │       ├── 背景色：平台配置或 getBackgroundColor()
    │       └── 布局：flex, gap: 8px
    │
    ├── 创建单个入口按钮
    │       └── EchoMem
    │
    └── 插入到指定位置（launcher.insertPosition）
            ├── 'after' → 容器后面
            ├── 'before' → 容器前面
            └── 'append' → 容器内部末尾
```

## 7. 检测重试机制

由于 HIGO Office 是 React 单页应用，DOM 动态加载，检测时可能 DOM 尚未渲染完成。因此检测失败时不缓存 `null` 结果，允许 MutationObserver 在下次 DOM 变化时重新检测：

```javascript
function addCustomButtons() {
  // 如果还没有检测到平台，先进行检测
  // 注意：不缓存检测失败的结果，因为 DOM 可能是动态加载的
  if (!currentPlatform) {
    const detected = detectPlatform();
    if (detected) {
      currentPlatform = detected;
      console.log('Claw Extension: Platform detected -', currentPlatform.config.name);
    } else {
      return;  // 不设置 currentPlatform，下次 DOM 变化时重试
    }
  }
  // ... 后续按钮注入逻辑
}
```

## 8. 持续监听机制

使用 MutationObserver 持续监听 DOM 变化，确保在动态加载完成后注入按钮：

```javascript
const observer = new MutationObserver((mutations) => {
  addCustomButtons();

  // 保存原始面板内容（仅 sidebar 模式）
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

  // 绑定 Skill 商店卡片点击事件
  // 绑定输入联想开关按钮事件
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

## 9. 控制台调试信息

### 检测失败示例

```
Claw Extension: 平台检测未通过 - URL不匹配
```

```
Claw Extension: 平台检测未通过 - 缺少必要DOM: MUI 抽屉组件
```

### 检测成功示例

```
Claw Extension: 平台检测全部通过: ✓ URL匹配 | ✓ 标题关键字匹配 | ✓ 必要DOM元素全部存在 | ✓ 可选DOM特征匹配 | ✓ 页面内容关键字匹配
Claw Extension: Detected platform - HIGO Office
Claw Extension: EchoMem launcher added for HIGO Office
```

## 10. 扩展新平台

### 10.1 场景：有侧边栏的页面

```javascript
'another-platform': {
  name: 'Another Platform',
  detection: {
    urlPatterns: ['/chat/'],
    titleKeywords: ['Chat'],
    domFeatures: {
      required: [
        { selector: '.sidebar', description: '侧边栏' }
      ],
      optional: [
        { selector: 'textarea', description: '输入框' }
      ]
    },
    contentKeywords: ['chat']
  },
  detect: function() {
    return detectPlatformMultiLayer(this.detection);
  },
  launcher: {
    text: 'EchoMem',
    containerSelector: '.input-wrapper',
    validateSelectors: {
      textarea: 'textarea',
      sendButton: '.send-btn'
    },
    style: {
      display: 'flex',
      gap: '8px',
      padding: '0 12px 8px'
    },
    insertPosition: 'before'
  },
  panel: {
    type: 'sidebar',
    containerSelector: '.sidebar',
    overlayConfig: null
  },
  menuItems: [
    { text: '资源管理', panel: '资源管理', description: '管理文件资源与上传内容' },
    { text: '输入联想', panel: '输入联想', description: '开启或关闭智能联想' },
    { text: '认知反馈', panel: '认知反馈', description: '查看会话分析与反馈报告' },
    { text: 'skill商店', panel: 'skill商店', description: '浏览、上传、安装 Skill' },
    { text: '效能', panel: '效能', description: '查看使用效率与工作表现' }
  ]
}
```

### 10.2 场景：无侧边栏的页面（使用浮层）

```javascript
'floating-platform': {
  name: 'Floating Platform',
  detection: {
    urlPatterns: ['/ai/'],
    titleKeywords: ['AI'],
    domFeatures: {
      required: [
        { selector: '.chat-container', description: '聊天容器' }
      ],
      optional: [
        { selector: 'textarea', description: '输入框' }
      ]
    },
    contentKeywords: ['ai']
  },
  detect: function() {
    return detectPlatformMultiLayer(this.detection);
  },
  // EchoMem 入口插入到顶部工具栏
  launcher: {
    text: 'EchoMem',
    containerSelector: '.toolbar',
    validateSelectors: {
      toolbar: '.toolbar-items'
    },
    style: {
      display: 'flex',
      gap: '8px',
      padding: '4px'
    },
    insertPosition: 'append'
  },
  // 面板配置为浮层（因为没有侧边栏）
  panel: {
    type: 'overlay',
    containerSelector: null,
    overlayConfig: {
      position: 'right',      // 从右侧滑出
      width: '400px',         // 面板宽度
      backdrop: true          // 显示遮罩层
    }
  },
  // 自定义功能导航文案
  menuItems: [
    { text: '文件', panel: '资源管理', description: '管理文件资源' },
    { text: '联想', panel: '输入联想', description: '开启或关闭智能联想' },
    { text: '反馈', panel: '认知反馈', description: '查看会话分析' },
    { text: '商店', panel: 'skill商店', description: '浏览和管理 Skill' },
    { text: '效能', panel: '效能', description: '查看效率概览' }
  ]
}
```

### 10.3 关键配置说明

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `detection` | 4层检测配置 | urlPatterns, titleKeywords, domFeatures, contentKeywords |
| `launcher.text` | 入口按钮文字 | `EchoMem` |
| `launcher.containerSelector` | 入口插入的容器 | `.MuiPaper-root`, `.toolbar` |
| `launcher.validateSelectors` | 验证容器的选择器 | `{ textarea: 'textarea', sendButton: '.send-btn' }` |
| `launcher.insertAfter` | 插入到指定元素之后（优先级高于 insertPosition） | `'._020ab5b'` |
| `launcher.getBackgroundColor` | 动态获取入口栏背景色函数 | `() => '#fff'` |
| `launcher.insertPosition` | 插入位置 | `'after'`, `'before'`, `'append'` |
| `panel.type` | 面板类型 | `'sidebar'` 或 `'overlay'` |
| `panel.containerSelector` | sidebar 容器选择器 | `.MuiDrawer-paper` |
| `panel.overlayConfig` | overlay 配置 | `{ position, width, backdrop }` |
| `menuItems` | EchoMem 功能导航列表 | `{ text, panel, description }` |

## 11. 文件位置

- 平台配置：`/content.js`
- 检测系统实现：`/content.js`
- 面板系统实现：`/content.js`
- EchoMem 入口注入实现：`/content.js`
- 模块化源码镜像：`/src/core/*`, `/src/platforms/*`, `/src/panels/*`
- 本设计文档：`/docs/design/platform-detection.md`
