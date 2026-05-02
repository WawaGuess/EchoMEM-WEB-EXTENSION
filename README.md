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

1. 下载本项目的 ZIP 文件并解压
2. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
3. 右上角打开「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的项目文件夹
6. 扩展图标会出现在 Chrome 工具栏中

### 方式二：打包安装

1. 在 `chrome://extensions/` 页面
2. 点击「打包扩展程序」
3. 选择项目文件夹
4. 生成 `.crx` 文件后拖拽到 Chrome 安装

## 项目结构

```
claw-web-extension/
├── manifest.json          # 扩展配置文件（Manifest V3）
├── popup.html             # 弹窗界面
├── popup.css              # 弹窗样式
├── popup.js               # 弹窗逻辑
├── background.js          # 后台服务脚本
├── content.js             # 内容脚本（注入页面）
├── content.css            # 注入页面的样式
├── icons/                 # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # 本文件
```

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
- **Content Script**：通过 `content.js` 向页面注入自定义 UI
- **MutationObserver**：监听页面动态变化，确保 UI 正确挂载
- **事件委托**：处理动态生成的元素点击事件

## 开发调试

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
