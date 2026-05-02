# EchoMem 平台检测系统设计文档

> 注意：当前 UI 入口使用 `launcher/menuItems` 配置。旧版 `buttonBar/buttons` 方案仅保留在 legacy 文档中，当前交互方案见 [echomem-launcher-sidebar.md](../design/echomem-launcher-sidebar.md)。

## 1. 概述

EchoMem Web Extension 采用多层平台检测机制，确保只在目标网站的特定页面注入增强功能。检测系统通过 4 层验证，全部满足才判定为目标平台。目前已支持 HIGO Office 和 DeepSeek 两个平台。

## 2. 设计目标

- **精确匹配**：避免在其他网站误注入按钮
- **可扩展**：支持后续添加新平台配置
- **可调试**：控制台输出每层检测结果
- **性能友好**：短路模式，一层失败立即返回

## 3. 检测架构

### 3.1 运行入口

当前内容脚本采用模块化源码 + 构建产物的方式运行：

```text
src/entry/content.js  →  npm run build  →  dist/content.js
```

Chrome 通过 `manifest.json` 加载 `/dist/content.js`。修改 `src/` 下的运行逻辑后，需要执行 `npm run build` 并重新加载扩展。

### 3.2 配置结构

```javascript
export const platformRegistry = {
  higo: higoPlatform,
  deepseek: deepseekPlatform
};
```

每个平台配置保存在 `src/platforms/`，配置项包括：

| 配置项 | 说明 |
|--------|------|
| `id` | 稳定平台 ID |
| `name` | 平台展示名称 |
| `detection` | URL、标题、DOM、内容关键字检测配置 |
| `launcher` | EchoMem 入口按钮挂载配置 |
| `panelHost` | 面板承载方式，支持 `sidebar` 和 `overlay` |
| `menuItems` | 当前平台展示的功能面板 ID 列表 |

功能面板使用 `panelRegistry` 注册，平台菜单通过稳定 `panelId` 引用面板：

```javascript
menuItems: [
  { panelId: 'resources' },
  { panelId: 'association' },
  { panelId: 'feedback' },
  { panelId: 'skillStore' },
  { panelId: 'performance' }
]
```

### 3.3 检测流程图

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
│  无原生右侧栏页面（如 DeepSeek）               │
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
const lifecycle = createDomLifecycle({
  onDomChange: refreshContentScriptMount,
  delay: 120
});

lifecycle.start();
```

`refreshContentScriptMount()` 负责尝试注入 EchoMem 入口、同步 sidebar 原始内容，并绑定面板内的导航事件。

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
export const anotherPlatform = {
  id: 'anotherPlatform',
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
  panelHost: {
    type: 'sidebar',
    containerSelector: '.sidebar',
    overlayConfig: null
  },
  menuItems: [
    { panelId: 'resources' },
    { panelId: 'association' },
    { panelId: 'feedback' },
    { panelId: 'skillStore' },
    { panelId: 'performance' }
  ]
};
```

### 10.2 场景：无侧边栏的页面（使用浮层）

```javascript
export const floatingPlatform = {
  id: 'floatingPlatform',
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
  panelHost: {
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
    { panelId: 'resources' },
    { panelId: 'association' },
    { panelId: 'feedback' },
    { panelId: 'skillStore' },
    { panelId: 'performance' }
  ]
};
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
| `panelHost.type` | 面板类型 | `'sidebar'` 或 `'overlay'` |
| `panelHost.containerSelector` | sidebar 容器选择器 | `.MuiDrawer-paper` |
| `panelHost.overlayConfig` | overlay 配置 | `{ position, width, backdrop }` |
| `menuItems` | EchoMem 功能导航列表 | `{ panelId }` |

## 11. 文件位置

- 内容脚本源码入口：`/src/entry/content.js`
- 内容脚本构建产物：`/dist/content.js`
- 平台配置：`/src/platforms/*`
- 面板注册：`/src/panels/registry.js`
- 检测系统实现：`/src/core/detection.js`
- 入口注入实现：`/src/core/buttons.js`
- 面板承载实现：`/src/core/panel-host.js`
- 路由实现：`/src/core/router.js`
- 本设计文档：`/docs/architecture/platform-detection.md`
- 检测流程图：`/docs/architecture/detection-flow.mmd`
