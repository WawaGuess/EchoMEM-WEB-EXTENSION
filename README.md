# EchoMem Web Extension

一个 Chrome/Edge 浏览器扩展，通过网页 overlay 提供 EchoMem 功能，并在 HIGO Office 标题栏提供独立的“图形 + EchoMem”入口。

## 功能介绍

### 1. 资源管理
- 展示资源管理面板
- 提供拖拽上传区域和已上传资源列表空状态

### 2. 输入联想
- 支持开启/关闭输入联想功能
- 智能补全、代码片段联想、历史记录联想

### 3. 认知反馈
- 展示 Episode 情节记忆时间线
- 支持总览、详情、来源跳转与错误重试

### 4. Skill 管理
- **我的 Skill**：查看和管理已上传/使用过的 Skill；点击卡片可将 `/Skill目录名` 写入聊天输入框，通过独立「详情」按钮查看完整内容、版本历史与版本回退
- **上传 Skill**：上传 `.md` / `.txt` 格式的单文件 SKILL.md（最大 10 MB），或上传包含 `SKILL.md` 及 scripts、assets、templates、references 等目录的完整 `.zip` Skill Package（最大 50 MB）
- **安装管理**：管理已安装的 Skill，支持删除

### 5. 效能
- 网页 overlay 保留现有平台相关展示逻辑
- 支持手动刷新和定时轮询

### 6. 后端连接配置
- 配置 EchoMem 服务地址、认证密钥和 Agent ID
- 配置并登录 EchoAgent

## 安装方法

### 方式一：从 GitHub Releases 下载并手动加载（适合新手，无需 npm）

1. 打开本仓库右侧 **Releases** 页面
2. 下载最新版本中的 `EchoMem-Extension.zip`
3. 解压到任意文件夹
4. 打开 Chrome 或 Edge 浏览器，地址栏输入：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
5. 右上角开启「开发者模式」
6. 点击「加载已解压的扩展程序」
7. 选择解压后的 `EchoMem-Extension` 文件夹
8. 扩展图标将出现在浏览器工具栏中

### 方式二：本地手动加载

1. 下载本项目的 ZIP 文件并解压，或直接使用本地项目目录
2. 如修改过 `src/` 源码，先执行 `npm install` 和 `npm run build`
3. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
4. 右上角打开「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择项目文件夹
7. 扩展图标会出现在 Chrome 工具栏中

### 方式三：打包安装

1. 在 `chrome://extensions/` 页面
2. 点击「打包扩展程序」
3. 选择项目文件夹
4. 生成 `.crx` 文件后拖拽到 Chrome 安装

## 开发构建

如果修改了 `src/` 源码，需要先安装依赖并构建：

```bash
npm install
npm test
npm run build
```

构建完成后，可以本地手动打包发行包：

```bash
npm run package
```

输出目录为 `release/EchoMem-Extension/`。

```
EchoMEM-WEB-EXTENSION/
├── manifest.json          # 扩展配置文件（Manifest V3）
├── popup.*                # 保留的旧 popup 文件，不作为工具栏入口
├── background.js          # 后台服务脚本
├── content.css            # 注入页面的样式
├── dist/
│   └── content.js         # 构建后的内容脚本
├── icons/                 # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/                   # 模块化源码
│   ├── entry/             # 内容脚本源码入口
│   ├── core/              # 检测、注入、路由、状态和面板承载
│   ├── panels/            # EchoMem 功能面板目录模块
│   ├── platforms/         # 平台配置注册
│   ├── adapters/          # 平台适配器（配置驱动 + 默认实现）
│   ├── streaming/         # 流式完成检测策略
│   ├── config/            # 配置加载
│   ├── utils/             # 通用工具（Skill 解析、文本处理等）
│   └── services/          # 后端/API 服务封装
├── docs/                  # 文档目录
│   ├── decisions/         # 架构决策记录（ADR）
│   ├── flows/             # 功能流程、调用链、数据流文档
│   ├── reference/         # 配置参考、接口清单
│   └── legacy/            # 历史归档
└── README.md              # 本文件
```

### 代码结构说明

| 路径 | 说明 |
|------|------|
| `manifest.json` | Manifest V3 配置，声明工具栏 action、后台脚本和内容脚本 |
| `background.js` | Manifest V3 后台 Service Worker，负责工具栏入口、初始化存储、请求代理和基础消息 |
| `popup.html` / `popup.css` / `popup.js` | 保留的旧文件，不由工具栏图标打开 |
| `content.css` | 注入到目标页面的通用样式 |
| `dist/content.js` | 构建后的内容脚本，Chrome 实际加载和执行的文件，不建议手动修改 |
| `src/entry/` | 内容脚本源码入口 |
| `src/core/` | 核心运行逻辑，包括平台检测、入口注入、DOM 监听、路由、状态、面板承载和会话录制 |
| `src/platforms/` | 平台配置注册，目前包含 HIGO Office 和 DeepSeek |
| `src/adapters/` | 平台适配器抽象。`BaseAdapter` 提供配置驱动的默认实现，`DeepseekAdapter` / `HigoAdapter` 按需覆盖 |
| `src/streaming/` | 流式完成检测策略注册表，用于在流式输出场景判断助手消息是否已结束 |
| `src/config/` | 配置加载器，负责加载 `platforms.json` 等运行时配置 |
| `src/utils/` | 通用工具，包括 `skill-parser`（解析 SKILL.md）、`text-processor`（文本处理）等 |
| `src/panels/` | EchoMem 功能面板和面板注册表；每个主功能入口使用独立目录，便于继续拆分子功能 |
| `src/services/` | 服务封装，包括 EchoMem 后端客户端、Episode 客户端、OpenView 统计客户端、存储和消息代理 |
| `icons/` | 扩展图标资源 |
| `docs/` | 文档目录，按功能域分为架构决策、流程、参考和历史归档 |

运行逻辑修改应优先改 `src/`，再执行 `npm run build` 生成 `dist/content.js`。

### 面板目录说明

| 路径 | 对应入口 | 说明 |
|------|----------|------|
| `src/panels/registry.js` | 面板注册 | 维护稳定 `panelId`、标题、描述和渲染函数映射 |
| `src/panels/echomem/` | EchoMem 首页 | 展示主功能导航入口 |
| `src/panels/resource/` | 资源管理 | 资源上传区域和资源列表入口 |
| `src/panels/association/` | 输入联想 | 输入联想开关和状态展示 |
| `src/panels/feedback/` | 认知反馈 | Episode 情节记忆时间线 |
| `src/panels/skill-store/` | Skill 管理 | Skill 列表、上传、安装管理 |
| `src/panels/performance/` | 效能 | Token 消耗概览：会话级统计（HIGO）+ EchoMem 后端 Usage |

## 使用说明

### 基本使用
1. 打开支持的平台页面
2. 点击浏览器工具栏中的 EchoMem 图标，打开当前页面的 EchoMem overlay
3. 在 HIGO Office 中也可以点击顶部标题栏的“图形 + EchoMem”组合标

### 支持的平台

#### HIGO Office
1. 访问 HIGO Office 页面（`http://localhost:31010`）
2. 顶部标题栏会出现 EchoMem 组合标入口；未进入会话时也可使用
3. 聊天框附近不再注入 EchoMem 按钮
4. 点击标题栏组合标或浏览器工具栏图标都会打开原有右侧 overlay 功能导航
5. 点击面板右上角「×」或遮罩层关闭面板

#### DeepSeek
1. 访问 DeepSeek 聊天页面（`https://chat.deepseek.com`）
2. 点击浏览器工具栏中的 EchoMem 图标
3. 页面从右侧打开功能导航浮层；聊天框附近不注入入口按钮
4. 点击面板右上角「×」或遮罩层关闭面板

### Overlay 功能导航
- **资源管理**：管理文件资源
- **输入联想**：开启/关闭智能联想
- **认知反馈**：查看 Episode 情节记忆时间线
- **Skill 管理**：管理、上传和删除 Skill，并在「我的 Skill」中查看版本历史和回退版本
- **效能**：查看 EchoMem 后端 Token 消耗
- **后端连接配置**：管理 EchoMem 与 EchoAgent 连接

### Skill 管理使用
1. 打开 overlay 后选择「Skill 管理」进入首页
2. 点击「我的 Skill」查看已上传 Skill 列表；点击卡片会把 `/Skill目录名` 写入当前聊天输入框，但不会自动发送
3. 点击卡片内的「详情」按钮进入独立详情页并加载版本历史；历史正文按需加载，非当前版本可确认后恢复为当前版本
4. 点击「上传 Skill」上传符合 SKILL.md 格式的 `.md` / `.txt` 单文件，或包含 `SKILL.md` 的完整 `.zip` Skill Package
5. 点击「安装管理」查看已安装 Skill 并执行删除；该页面不提供版本操作
6. 详情页左上角「← 返回」先回到 Skill 列表；列表页再次返回可回到 Skill 管理首页
7. 右上角「×」按钮关闭整个面板

## 技术说明

- **Manifest V3**：使用 Chrome 扩展最新版本规范
- **Content Script**：源码入口为 `src/entry/content.js`，构建后通过 `dist/content.js` 向支持页面注入自定义 UI
- **工具栏入口**：Background 向活动标签页发送消息，由 Content Script 打开现有 overlay
- **构建工具**：使用 esbuild 生成内容脚本 bundle
- **MutationObserver**：监听页面动态变化，确保 UI 正确挂载
- **事件委托**：处理动态生成的元素点击事件
- **平台适配器**：`src/adapters/` 提供配置驱动的 `BaseAdapter`，平台差异优先通过 `platforms.json` 声明；未注册平台自动回退到默认实现
- **流式完成检测**：`src/streaming/` 注册多种检测策略（如 `button-svg-poll`、`text-stability`、`selector-state`），用于适配不同平台的流式输出
- **后端客户端**：`src/services/echomem-client.js` 对接 EchoMem 后端，`episode-client.js` 获取 Episode 情节记忆数据，`openview-client.js` 拉取 HIGO Office 本地/OpenView 会话统计
- **会话录制**：`src/core/session-recorder.js` 基于适配器抽象和流式检测，自动提取当前页面的聊天消息

## 开发调试

### 安装依赖与构建

```bash
npm install
npm test
npm run build
```

修改 `src/` 下的内容脚本源码后，需要重新执行 `npm run build`，再到 `chrome://extensions/` 刷新扩展。

### 查看控制台日志
- **Content Script**：在网页的 DevTools Console 中查看
- **Background**：在 `chrome://extensions/` 点击「Service Worker」

### 重新加载扩展
修改代码后，需要在 `chrome://extensions/` 页面点击刷新按钮重新加载扩展。

## 浏览器兼容性

- 支持 Manifest V3 的 Chrome、Edge 和其他 Chromium 浏览器

## 注意事项

1. 扩展需要「读取和更改网站数据」权限以注入内容脚本
2. 工具栏入口、输入联想、会话录制和插入对话要求活动标签页是受支持的平台页面
3. 工具栏图标与网页入口使用同一套 EchoMem 独立品牌资产

## 许可证

MIT License
