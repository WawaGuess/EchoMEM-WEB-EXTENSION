# DeepSeek 平台扩展支持设计文档

> 注意：本文记录的是 DeepSeek 旧版「4 个功能按钮」接入设计。当前交互已切换为 `EchoMem` 单入口按钮 + 右侧功能导航，当前方案见 [echomem-launcher-sidebar.md](../design/echomem-launcher-sidebar.md)。

## 1. 概述

将 Claw Extension 扩展至支持 DeepSeek 聊天页面 (`https://chat.deepseek.com`)，在聊天输入框下方注入与 HIGO Office 相同的 4 个功能按钮（资源管理、输入联想、认知反馈、skill商店），点击后从右侧滑出浮层面板展示对应功能。

## 2. 页面结构分析

### 2.1 页面特征

| 特征项 | 值 |
|--------|-----|
| URL 模式 | `https://chat.deepseek.com/a/chat/s/` |
| 页面标题 | `DeepSeek - 探索未至之境` |
| CSS 框架 | 自定义 CSS（非 MUI） |
| 侧边栏 | 无（左侧为对话历史列表，非可替换面板） |

### 2.2 关键 DOM 元素

```
┌─────────────────────────────────────────────────────────────┐
│  deepseek logo    开启新对话                                  │
│  ─────────────────────────────────────────────────────────  │
│  今天                                                        │
│  测试助手功能演示                                              │
│  ...                                                        │
│                                                             │
│                                                             │
│                        使用快速模式开始对话                     │
│                        [快速模式] [专家模式]                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  给 DeepSeek 发送消息                                │   │
│  │                                                     │   │
│  │  [深度思考] [智能搜索]                          [@] [↑] │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  [资源管理][输入联想][认知反馈][skill商店]             │   │  ← 插入到 ._020ab5b 之后
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 选择器映射

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 输入框 | `textarea._27c9245` | 带 placeholder "给 DeepSeek 发送消息 " |
| 输入容器 | `._24fad49` | 包含 textarea 和底部按钮行 |
| 按钮区域 | `._020ab5b` | 包含"深度思考"、"智能搜索"切换按钮 |
| 发送按钮 | `svg` 或 `role="button"` | 无文字，图标按钮 |

## 3. 平台配置设计

### 3.1 `PLATFORM_CONFIGS` 新增 `deepseek` 配置

```javascript
'deepseek': {
  name: 'DeepSeek',
  detection: {
    // 第一层：URL 路径匹配（支持首页和聊天页）
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
    // 按钮栏插入到深度思考/智能搜索行之后
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
  // 按钮配置（与 HIGO 相同）
  buttons: [
    { text: '资源管理', panel: '资源管理' },
    { text: '输入联想', panel: '输入联想' },
    { text: '认知反馈', panel: '认知反馈' },
    { text: 'skill商店', panel: 'skill商店' }
  ]
}
```

## 4. 与 HIGO 平台的差异对比

| 对比项 | HIGO Office | DeepSeek |
|--------|-------------|----------|
| **检测** | | |
| URL 模式 | `/home/session/`, `/home/workspace/` | `chat.deepseek.com` |
| 标题关键字 | `Higo`, `HIGO` | `DeepSeek` |
| DOM 框架 | MUI (`.MuiDrawer-root`) | 自定义 CSS (`._27c9245`) |
| **按钮栏** | | |
| 容器选择器 | `.MuiPaper-root` | `._24fad49` |
| 验证选择器 | `textarea[id^="_r_"]`, `[data-testid="ArrowUpwardIcon"]` | `textarea[placeholder*="DeepSeek"]` |
| 插入目标 | 容器之后（默认） | `._020ab5b` 之后（`insertAfter`） |
| 背景色 | 固定 `rgb(255, 251, 254)` | 动态获取（`getBackgroundColor`） |
| **面板** | | |
| 类型 | `sidebar` | `overlay` |
| 容器选择器 | `.MuiDrawer-anchorRight .MuiDrawer-paper` | `null` |
| 浮层配置 | `null` | `{ position: 'right', width: '400px', backdrop: true }` |

## 5. 实现范围

### 5.1 需要修改的文件

- **`/content.js`**：在 `PLATFORM_CONFIGS` 中新增 `deepseek` 平台配置

### 5.2 需要增强的通用模块

以下模块在支持 DeepSeek 过程中进行了增强，现在对所有平台生效：

| 模块 | 增强内容 | 影响范围 |
|------|----------|----------|
| `addCustomButtons()` | 支持 `insertAfter` 配置：将按钮栏插入到指定元素之后 | 所有平台 |
| `addCustomButtons()` | 支持 `getBackgroundColor` 函数：动态获取页面背景色 | 所有平台 |
| `createOverlayPanel()` | 创建新面板前清理所有旧遮罩层，防止叠加 | 所有 `overlay` 平台 |
| `restoreOriginalPanel()` | 关闭时清理所有遮罩层，而非仅清理一个 | 所有 `overlay` 平台 |

### 5.3 无需修改的部分

- `detectPlatformMultiLayer()` — 通用 4 层检测逻辑
- `openCustomPanel()` — 已支持 `sidebar` 和 `overlay` 两种模式
- `getPanelContent()` — 面板内容生成
- `MutationObserver` — 动态 DOM 监听
- 所有面板内容函数（资源管理、输入联想、认知反馈、skill商店）

## 6. 风险评估

### 6.1 CSS 类名稳定性

DeepSeek 使用类似 `._27c9245` 的哈希类名（可能是 CSS Modules 或类似方案），存在随构建变化的风险。

**缓解策略：**
- 优先使用语义化选择器：`textarea[placeholder*="DeepSeek"]` 作为备选
- 在 `optional` 检测项中配置多个备选选择器
- 若类名变化导致检测失败，可通过更新扩展快速修复

### 6.2 页面结构变化

DeepSeek 为活跃开发中的产品，DOM 结构可能调整。

**缓解策略：**
- 4 层检测机制可容错（`optional` 项允许部分不匹配）
- MutationObserver 持续监听，页面动态加载后仍能注入

## 7. 旧版验证计划（已过期）

旧版 4 按钮方案实现后曾计划验证以下场景；当前 EchoMem 单入口方案的验收标准见 [echomem-launcher-sidebar.md](../design/echomem-launcher-sidebar.md)。

1. **检测验证**：访问 `https://chat.deepseek.com/a/chat/s/xxx`，控制台输出 `平台检测全部通过`
2. **按钮注入**：聊天输入框下方出现 4 个按钮（旧版方案）
3. **面板打开**：点击按钮后右侧滑出浮层面板，显示正确内容
4. **面板关闭**：点击 × 或遮罩层，面板滑出关闭
5. **多平台共存**：同时打开 HIGO 和 DeepSeek 页面，各自正确注入
6. **动态加载**：刷新页面后按钮自动重新注入
