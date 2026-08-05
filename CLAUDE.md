# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 提供本项目的工作指南。

## 项目概述

这是一个 **Chrome Extension (Manifest V3)** 项目，名为 "EchoMem Web Extension"。用户通过浏览器工具栏图标在支持的 Claw/AI 聊天工作流页面中打开 EchoMem 网页 overlay；HIGO Office 顶部标题栏还提供独立的“图形 + EchoMem”入口。overlay 包含资源管理、输入联想、认知反馈、Skill 商店、效能概览等功能，聊天输入框附近不再注入 EchoMem 按钮。

当前支持的平台：
- HIGO Office
- DeepSeek

## 在 Chrome 中加载扩展

### 方式一：手动加载已解压扩展（开发/测试时使用）

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目目录 (`EchoMEM-WEB-EXTENSION/`)
5. 扩展图标将出现在 Chrome 工具栏中

### 方式二：发行包手动加载（适合不暴露源码的场景）

1. 设置 `ECHOMEM_PUBLIC_BASE_URL` 和 `ECHOMEM_INTRANET_BASE_URL` 后执行 `npm run package`，同时生成公网版 `release/EchoMem-Extension-Public/` 和内网版 `release/EchoMem-Extension-Intranet/`
2. 将两个目录分别压缩为 ZIP，并按用户网络环境分发
3. 用户解压后，在 `chrome://extensions/` 页面点击"加载已解压的扩展程序"
4. 选择解压后的公网版或内网版文件夹

## 发布到 GitHub Releases

1. 在 `main`（或发布分支）上完成代码合并
2. 打标签：`git tag v1.0.0`
3. 推标签：`git push origin v1.0.0`
4. GitHub Actions 从 `ECHOMEM_PUBLIC_BASE_URL`、`ECHOMEM_INTRANET_BASE_URL` Secrets 注入地址，自动构建两个发行包并创建 Release
5. 用户在仓库右侧 **Releases** 页面按网络环境下载 `EchoMem-Extension-Public.zip` 或 `EchoMem-Extension-Intranet.zip`

## 项目结构

```
EchoMEM-WEB-EXTENSION/
├── manifest.json          # 扩展清单 (Manifest V3)
├── popup.*                # 保留的旧 Popup 文件，不作为工具栏入口
├── background.js          # Service Worker：工具栏入口、存储初始化、请求代理
├── content.css            # 注入页面的样式
├── dist/
│   └── content.js         # 构建后的内容脚本，Chrome 实际加载
├── icons/                 # 扩展图标 (16x16, 48x48, 128x128)
├── src/                   # 模块化内容脚本源码
│   ├── entry/             # 内容脚本入口
│   ├── core/              # 检测、注入、路由、状态、面板宿主、会话录制
│   ├── panels/            # EchoMem 功能面板模块
│   ├── platforms/         # 平台注册与配置
│   ├── adapters/          # 平台适配器（配置驱动 + 默认实现）
│   ├── streaming/         # 流式完成检测策略
│   ├── config/            # 平台配置加载与构建期发行配置
│   ├── utils/             # 通用工具（Skill 解析、文本处理等）
│   └── services/          # Chrome API 与后端服务封装
├── scripts/               # 构建、双发行包打包和扩展校验
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
- 工具栏 `action` 没有配置 `default_popup`；点击事件由 `background.js` 的 `chrome.action.onClicked` 直接处理
- 内容脚本通过 `<all_urls>` 注入所有页面，经平台检测后决定是否注入 EchoMem UI
- 权限：`activeTab`, `storage`

### 运行入口
- 内容脚本源码入口为 `src/entry/content.js`，Chrome 通过 `manifest.json` 加载构建产物 `dist/content.js`
- Background Service Worker 入口为根目录 `background.js`，Chrome 直接加载该文件，不经过内容脚本构建
- 修改 `src/` 下的内容脚本运行逻辑后，需执行 `npm run build` 重新构建；修改 `background.js` 时直接编辑该文件
- 保持 `dist/content.js` 已提交，以便无需本地构建即可直接加载扩展

### 通信流程
- **Toolbar Action**：`background.js` 监听 `chrome.action.onClicked`，向活动标签页发送 `openEchoMemOverlay` 消息
- **Content Script** (`src/entry/content.js` -> `dist/content.js`)：确认当前页面属于受支持平台，再通过现有路由打开 EchoMem 网页 overlay；HIGO 标题栏入口复用同一路由
- **Background** (`background.js`)：除工具栏入口外，还负责初始化存储、处理 `getTabInfo`、`saveToHistory` 等基础消息，并代理内容脚本发起的跨域请求（如 EchoMem 后端、OpenView 接口）
- **Legacy Popup** (`popup.*`)：仅作为历史文件保留，`manifest.json` 未配置 `action.default_popup`，工具栏不会加载这些文件

### 平台适配器
- `src/adapters/` 提供配置驱动的 `BaseAdapter`，统一处理消息容器查找、角色判定、噪音过滤、文本提取、流式检测器创建等行为
- `src/platforms/registry.js` 按 `platformId` 注册适配器；未注册平台自动回退到 `BaseAdapter`
- 平台差异优先通过 `platforms.json` 声明，JSON 无法表达时才在对应 adapter 中覆盖方法

### 流式完成检测
- `src/streaming/` 维护检测策略注册表（如 `button-svg-poll`、`text-stability`、`selector-state`）
- 适配器根据 `config.streaming` 创建检测器，用于判断助手消息在流式输出中是否已完整生成

### 后端服务客户端
- `src/services/echomem-client.js`：EchoMem 后端客户端，提供资源/Skill/Usage 等接口调用
- `src/services/episode-client.js`：Episode 数据客户端（原 graph-client.js 已归档）
- `src/services/openview-client.js`：HIGO Office 本地/OpenView 会话 Token 统计客户端
- 跨域请求统一通过 Background Service Worker 代理转发

### 公网版与内网版
- 仓库只维护一个源码分支，通过 `scripts/build-extension.mjs` 在构建时注入发行类型和默认服务地址，真实地址不得写入源码或文档
- 公网版从 `ECHOMEM_PUBLIC_BASE_URL` 读取地址，输出到 `release/EchoMem-Extension-Public/`
- 内网版从 `ECHOMEM_INTRANET_BASE_URL` 读取地址，输出到 `release/EchoMem-Extension-Intranet/`
- GitHub Release 从同名 Actions Secrets 注入地址；地址变化只需更新 Secret 并重新发布
- `chrome.storage.local.echomemConfig.baseUrl` 始终优先于发行包预置值，升级不得覆盖用户已保存地址
- 公网地址应使用 HTTPS；HTTP 会明文传输 `X-Auth-Key`

### 数据流
1. 内容脚本通过 `MutationObserver` 监听 DOM 变化
2. 平台检测校验 URL、标题、DOM 特征和内容关键字
3. 用户点击浏览器工具栏图标时，Background 向活动标签页发送打开 overlay 的消息；HIGO 标题栏组合标复用相同的内容脚本路由
4. 内容脚本确认平台已识别后打开右侧浮层面板
5. 菜单项打开对应功能面板，支持返回导航到首页
6. 会话录制器（`src/core/session-recorder.js`）基于适配器抽象和流式检测，自动提取当前页面的聊天消息，供认知反馈和效能面板使用

## 常见开发任务

### 修改后重新加载扩展
修改 `src/` 下的内容脚本源码后，先执行 `npm run build`；该命令生成不含真实服务地址的开发版 `dist/` 产物。修改 `background.js`、`manifest.json` 或其他直接加载文件时无需单独构建内容脚本。完成任何运行时修改后，都要到 `chrome://extensions/` 点击扩展卡片上的刷新图标或使用“更新”按钮；提交前执行 `npm test` 和 `npm run check`，其中 `npm run check` 会确认 `manifest.json` 加载的三个 `dist/*.js` bundle 均与当前源码同步。需要验证发行物时，通过 `ECHOMEM_PUBLIC_BASE_URL` 和 `ECHOMEM_INTRANET_BASE_URL` 临时注入地址后执行 `npm run package`。`npm test` 只覆盖 `tests/` 下的聚焦单元测试，不能替代浏览器或后端集成验证。

### 调试工具栏入口与 Background Script
- 进入 `chrome://extensions/`
- 点击扩展卡片上的 "service worker" 链接，打开 Background 上下文的 DevTools
- 在受支持页面点击浏览器工具栏中的 EchoMem 图标，观察 Service Worker 是否发送 `openEchoMemOverlay`，并在页面 Console 检查 Content Script 的接收和打开结果
- 不要使用“检查弹出窗口”调试工具栏入口；`popup.*` 不由当前 `manifest.json` 加载

### 调试 Content Script
- 在任意网页打开 DevTools
- 在 Console 中查找来自 `dist/content.js` 的消息
- 内容脚本运行在页面的隔离环境中

### 添加新权限
如需新权限（如 `tabs`、`bookmarks`），在 `manifest.json` 的 `permissions` 数组中添加，然后重新加载扩展。

## 扩展功能

当前已实现的功能：
- **EchoMem 入口**：浏览器工具栏图标打开网页 overlay；HIGO Office 顶部标题栏提供“图形 + EchoMem”组合标入口，聊天输入框附近不再注入按钮
- **功能导航**：右侧 EchoMem 首页面板，包含 5 个功能入口
- **资源管理**：上传区域和资源列表
- **输入联想**：可开关的输入联想功能
- **认知反馈**：Episode 情节记忆时间线（原 Three.js 3D 认知知识图谱已关闭）
- **Skill 商店**：Skill 列表（「我的 Skill」卡片点击写入 `/dirName`，独立详情入口承载版本历史）、上传 Skill、安装管理
- **效能概览**：Token 消耗概览，支持 HIGO 平台会话级统计与 EchoMem 后端 Usage 统计

功能面板源码模块位于 `src/panels/`，每个主要 EchoMem 入口一个目录：
`echomem/`、`resource/`、`association/`、`feedback/`、`skill-store/`、`performance/`。
新增子功能应放在对应的功能目录下；若成为跨面板共享的运行时能力（如适配器、流式检测、后端客户端、工具函数），则放到 `src/adapters/`、`src/streaming/`、`src/services/`、`src/utils/` 等对应目录。

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

### 助手指引同步检查

代码发生以下类型变更时，除按上述规则更新 `docs/` 外，还应同步检查并更新本仓库的两份助手指引：

| 变更范围 | 需同步的指引 |
|----------|--------------|
| 新增/删除 `src/` 顶层目录或调整模块职责 | 更新 `CLAUDE.md` 的项目结构图和核心架构说明 |
| 功能入口、交互流程、支持平台发生变化 | 同步更新 `README.md` 的功能介绍和使用说明 |
| 项目结构、构建方式、调试方式发生变化 | 同步更新 `README.md` 和 `CLAUDE.md` 的对应章节 |
| 架构决策、数据流、通信流程发生变化 | 同步更新 `CLAUDE.md` 的核心架构说明 |

**原则**：`CLAUDE.md` 面向开发者（Claude Code）的内部工作指南，`README.md` 面向用户和贡献者的项目概览；任何一方描述的事实与代码不一致时，都应修正。

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

- 内容脚本变更需要构建：`npm run build`（无真实服务地址的开发版）
- 双发行包构建：设置 `ECHOMEM_PUBLIC_BASE_URL`、`ECHOMEM_INTRANET_BASE_URL` 后执行 `npm run package`
- esbuild 将 `src/entry/content.js` 打包为 `dist/content.js`
- 图标目录 (`icons/`) 需要 PNG 文件：`icon16.png`、`icon48.png`、`icon128.png`
- 扩展使用中文 (zh-CN) UI 文本
