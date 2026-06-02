# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 提供本项目的工作指南。

## 项目概述

这是一个 **Chrome Extension (Manifest V3)** 项目，名为 "EchoMem Web Extension"。它在支持的 Claw/AI 聊天工作流页面中注入一个 `EchoMem` 入口按钮，点击后打开右侧功能导航面板，包含资源管理、输入联想、认知反馈、Skill 商店、效能概览等功能。

当前支持的平台：
- HIGO Office
- DeepSeek

## 在 Chrome 中加载扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目目录 (`EchoMEM-WEB-EXTENSION/`)
5. 扩展图标将出现在 Chrome 工具栏中

## 项目结构

```
EchoMEM-WEB-EXTENSION/
├── manifest.json          # 扩展清单 (Manifest V3)
├── popup.html             # 弹出窗口 UI
├── popup.css              # 弹出窗口样式
├── popup.js               # 弹出窗口逻辑
├── background.js          # Service Worker (后台脚本)
├── content.css            # 注入页面的样式
├── dist/
│   └── content.js         # 构建后的内容脚本，Chrome 实际加载
├── icons/                 # 扩展图标 (16x16, 48x48, 128x128)
├── src/                   # 模块化内容脚本源码
│   ├── entry/             # 内容脚本入口
│   ├── core/              # 检测、注入、路由、状态、面板宿主
│   ├── panels/            # EchoMem 功能面板模块
│   ├── platforms/         # 平台注册与配置
│   └── services/          # Chrome API 封装
└── docs/                  # 文档目录
    ├── decisions/         # 架构决策记录 (ADR)
    ├── flows/             # 功能流程/调用链文档
    ├── reference/         # 配置参考、接口清单
    └── legacy/            # 历史归档
```

## 核心架构

### Manifest V3
- 使用 `manifest_version: 3`
- 后台脚本以 **Service Worker** 形式运行（事件驱动，非持久化）
- 内容脚本通过 `<all_urls>` 注入所有页面，经平台检测后决定是否注入 EchoMem UI
- 权限：`activeTab`, `storage`, `scripting`

### 运行入口
- 运行时源码入口为 `src/entry/content.js`
- Chrome 通过 `manifest.json` 加载构建产物 `dist/content.js`
- 修改 `src/` 下的运行逻辑后，需执行 `npm run build` 重新构建
- 保持 `dist/content.js` 已提交，以便无需本地构建即可直接加载扩展

### 通信流程
- **Popup** (`popup.js`) 当前为纯信息展示 UI
- **Content Script** (`src/entry/content.js` -> `dist/content.js`) 在支持的页面注入 EchoMem 入口和面板
- **Background** (`background.js`) 初始化存储，提供 `getTabInfo`、`saveToHistory` 等基础消息处理

### 数据流
1. 内容脚本通过 `MutationObserver` 监听 DOM 变化
2. 平台检测校验 URL、标题、DOM 特征和内容关键字
3. 在支持的页面注入 EchoMem 入口按钮
4. 点击入口打开右侧浮层面板
5. 菜单项打开对应功能面板，支持返回导航到首页

## 常见开发任务

### 修改后重新加载扩展
修改 `src/` 下的文件后，执行 `npm run build`，然后到 `chrome://extensions/` 点击扩展卡片上的刷新图标，或使用"更新"按钮。

### 调试 Popup
- 右键点击扩展图标 → "检查弹出窗口"
- 打开 Popup 上下文的 DevTools

### 调试 Content Script
- 在任意网页打开 DevTools
- 在 Console 中查找来自 `dist/content.js` 的消息
- 内容脚本运行在页面的隔离环境中

### 调试 Background Script
- 进入 `chrome://extensions/`
- 点击扩展卡片上的 "service worker" 链接
- 打开 Background 上下文的 DevTools

### 添加新权限
如需新权限（如 `tabs`、`bookmarks`），在 `manifest.json` 的 `permissions` 数组中添加，然后重新加载扩展。

## 扩展功能

当前已实现的功能：
- **EchoMem 入口**：聊天输入框附近的单一入口按钮
- **功能导航**：右侧 EchoMem 首页面板，包含 5 个功能入口
- **资源管理**：上传区域和资源列表
- **输入联想**：可开关的输入联想功能
- **认知反馈**：会话统计和反馈报告
- **Skill 商店**：商店首页和详情页，支持返回导航
- **效能概览**：使用数据和效率指标

功能面板源码模块位于 `src/panels/`，每个主要 EchoMem 入口一个目录：
`echomem/`、`resource/`、`association/`、`feedback/`、`skill-store/`、`performance/`。
新增子功能应放在对应的功能目录下，除非成为共享的运行时服务。

## 文档维护规则

### 文档组织结构

文档按功能域组织，而非按文档类型：

| 目录 | 用途 | 维护频率 |
|------|------|----------|
| `docs/decisions/` | 架构决策记录 (ADR)：回答"为什么这样设计" | 几乎不变，随重大架构决策新增 |
| `docs/flows/` | 功能流程文档：时序图、调用链、数据流 | 随代码迭代同步更新 |
| `docs/reference/` | 配置参考：平台配置表、面板注册说明 | 配置变更时更新 |
| `docs/legacy/` | 历史归档：已被取代的方案和旧实现记录 | 只移入，不修改 |

### 代码-文档双向锚点

关键源文件通过顶部注释关联到对应文档：

```javascript
// 文档：docs/flows/panel-system/生命周期.md
```

**修改代码时必须同步更新文档**：
- 修改 `src/core/panel-host.js` → 检查并更新 `docs/flows/panel-system/生命周期.md`
- 修改 `src/core/detection.js` → 检查并更新 `docs/flows/platform-detection/检测流程.md`
- 修改 `src/panels/feedback/index.js` → 检查并更新 `docs/flows/cognitive-feedback/图谱渲染.md`
- 修改 `src/config/platforms.json` → 检查并更新 `docs/reference/平台配置参考.md`
- 以此类推，遵循代码文件顶部注释中的"文档："锚点指向

### 最小更新原则

不需要每次代码变更都重审全部文档。只在对应事实发生变化时更新：

| 变化类型 | 需要更新 |
|----------|----------|
| 仅修复 bug、调整样式、内部实现小改动 | 通常不需要更新文档 |
| 用户可感知的功能、入口、交互流程变化 | 更新 `docs/flows/` 中对应功能的流程文档 |
| 平台检测、注入方式、运行入口、数据流、目录结构变化 | 更新 `docs/flows/` 并考虑新增 `docs/decisions/` ADR |
| 新方案仍在讨论或验证中 | 临时写在 `docs/decisions/` 草稿或本地笔记 |
| 方案已被替代但仍有参考价值 | 移入 `docs/legacy/` |

### 决策文档 (ADR) 规范

重大架构决策需写成 ADR，存放于 `docs/decisions/`，固定格式：

```markdown
# ADR-00X: 标题

## 状态
Accepted / Implemented

## 背景
为什么需要做这个决策

## 决策
最终选择了什么方案

## 备选方案
考虑过但拒绝的方案及原因

## 影响
这个决策对代码和文档的影响

## 相关代码
- `src/core/panel-host.js`
- `docs/flows/panel-system/生命周期.md`
```

## 备注

- 内容脚本变更需要构建：`npm run build`
- esbuild 将 `src/entry/content.js` 打包为 `dist/content.js`
- 图标目录 (`icons/`) 需要 PNG 文件：`icon16.png`、`icon48.png`、`icon128.png`
- 扩展使用中文 (zh-CN) UI 文本
