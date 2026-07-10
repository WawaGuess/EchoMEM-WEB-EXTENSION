# EchoMem Web Extension

一个 Chrome 浏览器扩展，为多种 Claw/AI 聊天工作流提供统一增强入口。目前支持 HIGO Office 和 DeepSeek。

## 功能介绍

### 1. 资源管理
- 展示资源管理面板
- 提供拖拽上传区域和已上传资源列表空状态

### 2. 输入联想
- 支持开启/关闭输入联想功能
- 智能补全、代码片段联想、历史记录联想

### 3. 认知反馈
- 当前会话分析（对话轮次、响应时间、Token 消耗）
- 3D 认知知识图谱：基于 Three.js 渲染实体关系，支持缩放、旋转、节点聚焦和关系筛选

### 4. Skill 商店
- **我的 Skill**：查看和管理已上传/使用过的 Skill，支持搜索、展开详情、查看完整内容
- **上传 Skill**：上传 `.md` / `.txt` 格式 SKILL.md 文件，自动解析 frontmatter 并保存到 EchoMem 后端
- **安装管理**：管理已安装的 Skill，支持删除

### 5. 效能
- **Token 消耗概览**：展示当前页面会话及 EchoMem 后端的 Token 消耗统计
- HIGO Office 平台显示完整会话指标：总 Token、会话数、轮次数、Input/Output Tokens
- 其他平台展示 EchoMem 后端消耗
- 支持手动刷新和定时轮询

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
├── popup.html             # 弹窗界面
├── popup.css              # 弹窗样式
├── popup.js               # 弹窗逻辑
├── background.js          # 后台服务脚本
├── content.css            # 注入页面的样式
├── dist/
│   └── content.js         # 构建后的内容脚本，Chrome 实际加载
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
| `manifest.json` | Chrome 扩展配置，声明权限、后台脚本、弹窗和实际加载的内容脚本 |
| `background.js` | Manifest V3 后台 Service Worker，负责初始化存储、代理跨域请求和处理基础消息 |
| `popup.html` / `popup.css` / `popup.js` | 扩展工具栏弹窗，目前主要作为信息展示入口 |
| `content.css` | 注入到目标页面的通用样式 |
| `dist/content.js` | 构建后的内容脚本，Chrome 实际加载和执行的文件，不建议手动修改 |
| `src/entry/` | 内容脚本源码入口，当前入口为 `src/entry/content.js` |
| `src/core/` | 核心运行逻辑，包括平台检测、入口注入、DOM 监听、路由、状态、面板承载和会话录制 |
| `src/platforms/` | 平台配置注册，目前包含 HIGO Office 和 DeepSeek |
| `src/adapters/` | 平台适配器抽象。`BaseAdapter` 提供配置驱动的默认实现，`DeepseekAdapter` / `HigoAdapter` 按需覆盖 |
| `src/streaming/` | 流式完成检测策略注册表，用于在流式输出场景判断助手消息是否已结束 |
| `src/config/` | 配置加载器，负责加载 `platforms.json` 等运行时配置 |
| `src/utils/` | 通用工具，包括 `skill-parser`（解析 SKILL.md）、`text-processor`（文本处理）等 |
| `src/panels/` | EchoMem 功能面板和面板注册表；每个主功能入口使用独立目录，便于继续拆分子功能 |
| `src/services/` | 服务封装，包括 EchoMem 后端客户端、认知图谱客户端、OpenView 统计客户端、存储和消息代理 |
| `icons/` | 扩展图标资源 |
| `docs/` | 文档目录，按功能域分为架构决策、流程、参考和历史归档 |

运行逻辑修改应优先改 `src/`，再执行 `npm run build` 生成新的 `dist/content.js`。

### 面板目录说明

| 路径 | 对应入口 | 说明 |
|------|----------|------|
| `src/panels/registry.js` | 面板注册 | 维护稳定 `panelId`、标题、描述和渲染函数映射 |
| `src/panels/echomem/` | EchoMem 首页 | 展示主功能导航入口 |
| `src/panels/resource/` | 资源管理 | 资源上传区域和资源列表入口 |
| `src/panels/association/` | 输入联想 | 输入联想开关和状态展示 |
| `src/panels/feedback/` | 认知反馈 | 3D 认知知识图谱和会话分析入口 |
| `src/panels/skill-store/` | Skill 商店 | Skill 列表、上传、安装管理 |
| `src/panels/performance/` | 效能 | Token 消耗概览：会话级统计（HIGO）+ EchoMem 后端 Usage |

## 使用说明

### 基本使用
1. 点击 Chrome 工具栏中的扩展图标，查看扩展信息
2. 访问支持的页面后，扩展会自动注入增强功能

### 支持的平台

#### HIGO Office
1. 访问 HIGO Office 页面（`http://localhost:31010`）
2. 聊天框上方会出现 `EchoMem` 入口按钮
3. 点击 `EchoMem` 会在右侧边栏打开功能导航
4. 点击面板右上角「×」关闭并恢复原始边栏

#### DeepSeek
1. 访问 DeepSeek 聊天页面（`https://chat.deepseek.com`）
2. 聊天框上方会出现 `EchoMem` 入口按钮
3. 点击 `EchoMem` 会从右侧滑出功能导航浮层
4. 点击面板右上角「×」或遮罩层关闭面板

### EchoMem 功能导航
- **资源管理**：管理文件资源
- **输入联想**：开启/关闭智能联想
- **认知反馈**：查看 3D 认知知识图谱和会话分析
- **Skill 商店**：管理、上传和删除 Skill
- **效能**：查看 Token 消耗概览

### Skill 商店使用
1. 点击 `EchoMem` 后选择「Skill 商店」打开商店首页
2. 点击「我的 Skill」查看已上传 Skill 列表，支持搜索和展开详情
3. 点击「上传 Skill」上传符合 SKILL.md 格式的 `.md` / `.txt` 文件
4. 点击「安装管理」查看已安装 Skill 并执行删除
5. 详情页左上角有「← 返回」按钮可返回首页
6. 右上角「×」按钮关闭整个面板

## 技术说明

- **Manifest V3**：使用 Chrome 扩展最新版本规范
- **Content Script**：源码入口为 `src/entry/content.js`，构建后通过 `dist/content.js` 向页面注入自定义 UI
- **构建工具**：使用 esbuild 将 `src/` 模块打包为 Chrome 可加载的内容脚本
- **MutationObserver**：监听页面动态变化，确保 UI 正确挂载
- **事件委托**：处理动态生成的元素点击事件
- **平台适配器**：`src/adapters/` 提供配置驱动的 `BaseAdapter`，平台差异优先通过 `platforms.json` 声明；未注册平台自动回退到默认实现
- **流式完成检测**：`src/streaming/` 注册多种检测策略（如 `button-svg-poll`、`text-stability`、`selector-state`），用于适配不同平台的流式输出
- **后端客户端**：`src/services/echomem-client.js` 对接 EchoMem 后端，`graph-client.js` 获取认知图谱，`openview-client.js` 拉取 HIGO Office 本地/OpenView 会话统计
- **会话录制**：`src/core/session-recorder.js` 基于适配器抽象和流式检测，自动提取当前页面的聊天消息

## 开发调试

### 安装依赖与构建

```bash
npm install
npm run build
```

修改 `src/` 下的内容脚本源码后，需要重新执行 `npm run build`，再到 `chrome://extensions/` 刷新扩展。

### 查看控制台日志
- **Popup**：右键扩展图标 → 「检查弹出内容」
- **Content Script**：在网页的 DevTools Console 中查看
- **Background**：在 `chrome://extensions/` 点击「Service Worker」

### 重新加载扩展
修改代码后，需要在 `chrome://extensions/` 页面点击刷新按钮重新加载扩展。

## 浏览器兼容性

- Chrome 88+（支持 Manifest V3）
- Edge 88+（基于 Chromium）
- 其他基于 Chromium 的浏览器

## 注意事项

1. 扩展需要「读取和更改网站数据」权限以注入内容脚本
2. 功能仅在支持的平台页面可用（HIGO Office、DeepSeek）
3. 图标文件需要自行替换为自定义图标（当前为自动生成）

## 许可证

MIT License
