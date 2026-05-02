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
- 生成反馈报告

### 4. Skill 商店
- **用户历史 Skill**：查看和管理使用过的 Skill
- **上传 Skill**：上传自定义 Skill 到商店
- **商店购买**：浏览和购买商店中的 Skill
- **商家 Skill**：官方和认证商家提供的 Skill
- **安装管理**：已安装 Skill 的更新/卸载

### 5. 效能
- 今日会话、Skill 使用、联想触发、资源引用、反馈报告等效率指标概览
- 首版展示占位数据，后续可接入真实使用数据

## 安装方法

### 方式一：开发者模式加载（推荐）

1. 下载本项目的 ZIP 文件并解压，或直接使用本地项目目录
2. 如修改过 `src/` 源码，先执行 `npm install` 和 `npm run build`
3. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
4. 右上角打开「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择项目文件夹
7. 扩展图标会出现在 Chrome 工具栏中

### 方式二：打包安装

1. 在 `chrome://extensions/` 页面
2. 点击「打包扩展程序」
3. 选择项目文件夹
4. 生成 `.crx` 文件后拖拽到 Chrome 安装

## 项目结构

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
│   └── services/          # Chrome API 服务封装
├── docs/                  # 文档索引、现行设计、架构说明和历史归档
│   ├── README.md
│   ├── architecture/
│   ├── design/
│   ├── proposals/
│   └── legacy/
└── README.md              # 本文件
```

### 代码结构说明

| 路径 | 说明 |
|------|------|
| `manifest.json` | Chrome 扩展配置，声明权限、后台脚本、弹窗和实际加载的内容脚本 |
| `background.js` | Manifest V3 后台 Service Worker，负责初始化存储和处理基础消息 |
| `popup.html` / `popup.css` / `popup.js` | 扩展工具栏弹窗，目前主要作为信息展示入口 |
| `content.css` | 注入到目标页面的通用样式 |
| `dist/content.js` | 构建后的内容脚本，Chrome 实际加载和执行的文件，不建议手动修改 |
| `src/entry/` | 内容脚本源码入口，当前入口为 `src/entry/content.js` |
| `src/core/` | 核心运行逻辑，包括平台检测、入口注入、DOM 监听、路由、状态和面板承载 |
| `src/platforms/` | 平台配置注册，目前包含 HIGO Office 和 DeepSeek |
| `src/panels/` | EchoMem 功能面板和面板注册表；每个主功能入口使用独立目录，便于继续拆分子功能 |
| `src/services/` | Chrome API 服务封装，预留消息和存储能力 |
| `icons/` | 扩展图标资源 |
| `docs/` | 文档目录，包含现行设计、架构说明、方案记录和历史归档 |

运行逻辑修改应优先改 `src/`，再执行 `npm run build` 生成新的 `dist/content.js`。

### 面板目录说明

| 路径 | 对应入口 | 说明 |
|------|----------|------|
| `src/panels/registry.js` | 面板注册 | 维护稳定 `panelId`、标题、描述和渲染函数映射 |
| `src/panels/echomem/` | EchoMem 首页 | 展示主功能导航入口 |
| `src/panels/resource/` | 资源管理 | 资源上传区域和资源列表入口 |
| `src/panels/association/` | 输入联想 | 输入联想开关和状态展示 |
| `src/panels/feedback/` | 认知反馈 | 会话分析和反馈报告入口 |
| `src/panels/skill-store/` | Skill 商店 | Skill 浏览、上传、购买、商家和安装管理 |
| `src/panels/performance/` | 效能 | 使用效率指标和状态概览 |

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
- **认知反馈**：查看会话分析
- **skill商店**：浏览和管理 Skill
- **效能**：查看使用效率概览

### Skill 商店使用
1. 点击 `EchoMem` 后选择「skill商店」打开商店首页
2. 点击任意板块卡片进入详情页
3. 详情页左上角有「← 返回」按钮可返回首页
4. 右上角「×」按钮关闭整个面板

## 技术说明

- **Manifest V3**：使用 Chrome 扩展最新版本规范
- **Content Script**：源码入口为 `src/entry/content.js`，构建后通过 `dist/content.js` 向页面注入自定义 UI
- **构建工具**：使用 esbuild 将 `src/` 模块打包为 Chrome 可加载的内容脚本
- **MutationObserver**：监听页面动态变化，确保 UI 正确挂载
- **事件委托**：处理动态生成的元素点击事件

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
