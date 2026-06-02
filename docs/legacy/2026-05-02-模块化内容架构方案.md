# 内容脚本模块化与可扩展架构方案

## 状态

Accepted / Implemented

## 背景

改造前，Chrome 实际加载的是根目录 `content.js`，它同时包含平台配置、平台检测、入口注入、面板系统、功能面板、导航和状态逻辑。`src/` 虽然已有模块化拆分，但还没有成为运行入口，因此存在两个维护压力：

- 运行真相在 `content.js`，模块化源码在 `src/`，后续改动容易产生漂移。
- 新增平台或功能面板时，需要同时理解注入、面板、导航、状态和平台配置，扩展成本会越来越高。

Chrome Manifest 的 `content_scripts.js` 支持声明扩展包内的相对 JavaScript 文件，按数组顺序注入。当前项目可以继续使用静态 content script 加载方式，但建议用构建产物作为 manifest 入口，避免直接维护一个超长单文件。

参考：Chrome 官方 content scripts manifest 文档 https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts

## 目标

1. 让 `src/` 成为唯一源码入口，避免 `content.js` 与 `src/` 双线维护。
2. 用轻量构建产物承接 Chrome content script 加载，不引入复杂前端框架。
3. 建立平台注册、面板注册和路由机制，让新增平台或功能面板变成局部改动。
4. 保持现有 HIGO Office、DeepSeek、EchoMem 单入口、5 个功能面板和返回/关闭交互不变。
5. 为后续接入真实资源、Skill、反馈、效能数据预留状态和服务层。

## 非目标

- 不重做 UI 视觉设计。
- 不在本方案中实现真实文件上传、Skill 后端、反馈报告生成或效能统计。
- 不引入 React/Vue/Svelte 等应用框架。
- 不改变当前 Manifest V3 扩展形态。
- 不立即删除历史文档和 legacy 方案。

## 方案

### 总体路线

采用“单一源码入口 + 构建输出 + 注册机制”的方式演进。

```text
src/                         # 唯一维护源码
└── entry/content.js          # content script 源码入口

dist/                        # 构建产物，Chrome 实际加载
└── content.js

manifest.json                # content_scripts.js 指向 dist/content.js
```

根目录 `content.js` 不再保留，运行入口统一为 `src/entry/content.js`，Chrome 实际加载 `dist/content.js`。

### 目标目录结构

```text
src/
├── entry/
│   └── content.js
├── core/
│   ├── buttons.js
│   ├── detection.js
│   ├── lifecycle.js
│   ├── panel-host.js
│   ├── panel.js
│   ├── router.js
│   └── state.js
├── platforms/
│   ├── registry.js
│   ├── higo.js
│   └── deepseek.js
├── panels/
│   ├── registry.js
│   ├── echomem/
│   ├── resource/
│   ├── association/
│   ├── feedback/
│   ├── skill-store/
│   └── performance/
├── services/
│   ├── messaging.js
│   └── storage.js
└── ui/
    └── html.js
```

### 平台注册模型

平台配置保持声明式，每个平台只描述“如何识别、在哪里挂入口、用什么面板承载”。

```javascript
export const higoPlatform = {
  id: 'higo',
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
        { selector: '[data-testid="ArrowUpwardIcon"]', description: '发送按钮图标' }
      ]
    },
    contentKeywords: ['higo', 'HIGO', 'Higo2']
  },
  launcher: {
    text: 'EchoMem',
    containerSelector: '.MuiPaper-root',
    validateSelectors: {
      textarea: 'textarea[id^="_r_"]',
      sendButton: '[data-testid="ArrowUpwardIcon"]'
    },
    insertPosition: 'before'
  },
  panelHost: {
    type: 'sidebar',
    containerSelector: '.MuiDrawer-anchorRight .MuiDrawer-paper'
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

平台注册入口：

```javascript
export const platformRegistry = {
  higo: higoPlatform,
  deepseek: deepseekPlatform
};
```

### 面板注册模型

面板使用稳定 ID，不再用中文标题作为逻辑 key。中文标题只作为展示文案。

```javascript
export const panelRegistry = {
  resources: {
    id: 'resources',
    title: '资源管理',
    description: '管理文件资源与上传内容',
    render: renderResourcesPanel,
    bind: bindResourcesPanel
  },
  association: {
    id: 'association',
    title: '输入联想',
    description: '开启或关闭智能联想',
    render: renderAssociationPanel,
    bind: bindAssociationPanel
  },
  skillStore: {
    id: 'skillStore',
    title: 'skill商店',
    description: '浏览、上传、安装 Skill',
    render: renderSkillStoreHome,
    routes: skillStoreRoutes
  }
};
```

这样后续新增功能面板只需要：

1. 新增 `src/panels/new-feature/index.js`。
2. 在 `panelRegistry` 注册。
3. 在平台 `menuItems` 中加入 `{ panelId: 'newFeature' }`。

### 路由与导航

引入轻量 `router`，统一处理 EchoMem 首页、功能详情页和 Skill 商店子页面。

```javascript
router.open('home');
router.open('panel', { panelId: 'resources' });
router.open('panel', { panelId: 'skillStore', route: 'purchase' });
router.back();
router.close();
```

路由层负责：

- 查找 panel definition。
- 生成标题、内容、返回按钮。
- 调用 `panelHost.open()`。
- 在渲染后调用面板自己的 `bind()`。

### 面板承载层

`panel-host` 只关心“在哪里显示面板”和“怎么关闭恢复”，不理解业务面板。

支持两种 host：

| 类型 | 说明 | 当前平台 |
|------|------|----------|
| `sidebar` | 替换页面已有右侧栏，关闭时恢复原始内容 | HIGO Office |
| `overlay` | 创建扩展自己的右侧浮层和遮罩 | DeepSeek |

接口示例：

```javascript
panelHost.open({
  title,
  bodyHtml,
  showBack,
  onBack,
  onClose
});

panelHost.close();
panelHost.refreshBody(bodyHtml);
```

### 生命周期与观察器

把当前 `MutationObserver` 中混在一起的逻辑拆开：

```javascript
app.start()
  -> detector.detect()
  -> injector.mountLauncher(platform)
  -> lifecycle.observeDomChanges()
```

建议规则：

- DOM 变化触发后 debounce 100-200ms，再尝试注入入口。
- 检测失败不缓存，因为 SPA 页面 DOM 可能后加载。
- 检测成功后缓存平台，URL 变化时重新检测。
- 事件绑定尽量通过面板 root 做事件委托，避免重复绑定。

### 状态与服务层

先建立轻量 `state`，不要一开始引入复杂状态库。

```javascript
const state = {
  platform: null,
  association: {
    enabled: false
  },
  panel: {
    isOpen: false,
    currentRoute: null
  }
};
```

后续需要持久化时，通过 `services/storage.js` 封装 `chrome.storage.local`，避免面板直接调用 Chrome API。

### 样式策略

逐步减少 JS 内联样式：

- 通用面板、按钮、卡片、状态组件样式放到 `content.css`。
- JS 只输出 class 和必要的数据属性。
- 平台动态背景色这类少量差异可通过 CSS 变量传入。

示例：

```javascript
launcherBar.style.setProperty('--echomem-launcher-bg', dynamicBg);
```

## 可选实现方式对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A. 继续维护根 `content.js` | 手动把逻辑继续堆在单文件 | 零工具成本 | 扩展性最差，`src/` 持续漂移 | 不推荐 |
| B. Manifest 加载多个普通 JS | `content_scripts.js` 写多个文件，依赖全局变量和顺序 | 不需要构建工具 | 模块边界弱，文件顺序脆弱 | 只适合临时过渡 |
| C. esbuild 打包 `src/entry/content.js` | 构建 `dist/content.js`，manifest 加载 dist | 单一源码、模块边界清楚、工具轻 | 需要新增 package 脚本和构建产物 | 推荐 |

## 分阶段实施计划

### 阶段 1：统一运行入口

目标：`src/` 成为唯一源码，Chrome 加载构建产物。

改动：

- 新增 `package.json`，加入 `build`、`check` 脚本。
- 使用 esbuild 将 `src/entry/content.js` 打包到 `dist/content.js`。
- 将原 `src/main.js` 调整为 `src/entry/content.js`。
- 更新 `manifest.json` 的 content script 入口为 `dist/content.js`。
- 删除根目录旧 `content.js`，避免双线维护。

验收：

- `npm run build` 成功。
- `node --check dist/content.js` 成功。
- HIGO Office 和 DeepSeek 上仍只出现一个 `EchoMem` 入口。
- 5 个功能入口、返回、关闭行为与当前一致。

### 阶段 2：平台与面板注册化

目标：新增平台或面板时不再修改核心流程。

改动：

- 新增 `platformRegistry`。
- 新增 `panelRegistry`。
- 平台 `menuItems` 从 `{ text, panel, description }` 改为 `{ panelId }`。
- 路由层根据 `panelId` 获取标题、描述和渲染函数。

验收：

- 新增一个占位面板只需要新增面板文件、注册面板、加入平台菜单。
- 删除或重命名展示文案不影响逻辑 key。
- HIGO Office 和 DeepSeek 菜单展示仍一致。

### 阶段 3：拆出 panel host、router、state

目标：核心流程职责清晰，业务面板不直接管理宿主容器。

改动：

- `panel-host.js` 负责 sidebar/overlay 创建、恢复和关闭。
- `router.js` 负责首页、详情页和子路由切换。
- `state.js` 保存平台、面板和功能状态。
- 输入联想切换通过 `state` 和 `panelHost.refreshBody()` 更新。

验收：

- 面板文件不直接查询 `.MuiDrawer-anchorRight` 或 `.claw-overlay-panel`。
- Skill 商店子页面不直接调用底层 `openCustomPanel()`。
- 输入联想状态刷新不依赖外部硬编码选择器。

### 阶段 4：样式收敛

目标：减少内联样式。

改动：

- 把通用面板样式迁移到 `content.css`。
- JS 模板只保留结构、class、data 属性。
- 更新 `docs/architecture/platform-detection.md`，把运行入口改为 `dist/content.js` 和 `src/entry/content.js`。

验收：

- `content.js` 不再作为手写运行入口存在。
- 新增 UI 组件优先写 CSS class。
- 文档中的运行入口与 manifest 一致。

## 影响范围

预计涉及：

- `manifest.json`
- `content.css`
- `src/entry/content.js`
- `src/core/*`
- `src/platforms/*`
- `src/panels/*`
- 新增 `src/entry/*`
- 新增 `src/app/*`
- 新增 `src/services/*`
- 新增 `dist/content.js`
- 新增 `package.json`，可能新增 lock 文件
- `README.md`
- `CLAUDE.md`
- `docs/architecture/platform-detection.md`

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 构建产物未生成导致扩展加载失败 | Chrome 加载不到 content script | 提交 `dist/content.js`，并在 README 写明改代码后需要 build |
| `src/` 与现有 `content.js` 行为不完全一致 | 功能回归 | 阶段 1 只做最小迁移，先对照当前行为测试 |
| 新增 package 工具链增加复杂度 | 项目从无构建变成有构建 | 只引入 esbuild 一个 dev dependency，脚本保持简单 |
| 面板 ID 改造影响菜单跳转 | 点击菜单打不开面板 | 先做兼容层，短期同时支持旧 `panel` 和新 `panelId` |
| CSS 从内联迁出导致样式差异 | UI 细节变化 | 阶段 4 单独做，前 3 阶段不大规模动样式 |

## 验收标准

1. `src/` 是唯一手写 content script 源码。
2. `manifest.json` 加载构建产物。
3. 平台配置通过 `platformRegistry` 注册。
4. 面板通过稳定 `panelId` 注册，不再用中文标题作为逻辑 key。
5. HIGO Office 与 DeepSeek 功能行为保持不变。
6. 新增一个面板不需要修改检测、注入和宿主面板核心代码。
7. 新增一个平台不需要修改已有平台文件。
8. `npm run build`、语法检查和手动浏览器验证通过。

## 后续归档

如果该方案被采用：

- 最终运行入口、构建流程、registry 模型需要沉淀到 `docs/architecture/`。
- 本 proposal 可在实现完成后移入 `docs/legacy/`，作为架构演进记录。
