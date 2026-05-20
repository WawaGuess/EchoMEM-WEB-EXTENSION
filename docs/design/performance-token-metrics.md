# 效能面板 Token 消耗展示

## 需求背景

原效能面板为纯占位页面，展示"今日会话、Skill 使用、联想触发"等 5 张硬编码为 0 的指标卡片，无实际数据支撑。现需将其改造为 Token 消耗概览面板，展示 EchoMem 为用户节省的成本，同时预留接口扩展能力，支持后续接入后端真实数据。

## 需求目标

1. 展示三类可获取的 Token 数据：
   - **预计节省 Token**：EchoMem 帮助用户节省的 Token 数量（核心价值指标）
   - **用户会话消耗**：当前页面 AI 会话实际产生的 Token 消耗
   - **EchoMem 后端消耗**：EchoMem 服务自身产生的 Token 消耗
2. 由于无法获取"无 EchoMem 时的原始会话 Token 总量"，界面中不展示任何依赖该值的计算或百分比。
3. 数据通过接口异步获取，面板打开时需支持**骨架屏占位 + 数据实时填充**。
4. 支持**定时轮询刷新**，用户无需关闭重开面板即可看到最新数据。

## 界面布局

面板宽度沿用平台配置 `400px`，内部采用纵向三段式布局：

### 1. 核心指标区（全宽大卡片）

- 绿色渐变背景（`#ecfdf5 → #d1fae5`），视觉突出
- 标题："💰 预计节省 Token"
- 数值：32px 大字号， emerald-700 色
- 该指标为用户最关心的核心价值，放在首屏最显眼位置

### 2. 成本对比区（双列网格）

- 2 列等宽卡片，gap 10px
- 左卡："用户会话消耗" + 数值 + "tokens" 单位
- 右卡："EchoMem 后端消耗" + 数值 + "tokens" 单位
- 卡片样式：浅灰背景（`#f9fafb`）+ 边框，数值 20px 加粗

### 3. 说明文字区

- 白色背景卡片
- 显示净节省计算说明：节省量已扣除后端消耗成本
- 加载中状态显示"正在加载数据…"
- 加载失败显示红色错误提示

## 数据流与架构

### 加载流程（三段式）

```
用户点击"效能"菜单
    │
    ▼
① 先调用 getPerformanceContent() 渲染骨架屏 HTML
    │     - 数值区域显示灰色脉冲占位条（CSS animation）
    │     - 说明区域显示"正在加载数据…"
    │
    ▼
② openCustomPanel() 打开面板（用户立刻看到 loading 状态）
    │
    ▼
③ initPerformancePanel(bodyElement, { pollInterval: 30000 })
    │     - 立即执行 fetchPerformanceData() 获取数据
    │     - 成功后调用 updatePerformanceDOM() 填充真实数值
    │     - 同时启动 setInterval 轮询（30s）
    │
    ▼
④ 用户持续浏览面板，数据每 30 秒静默刷新
    │
    ▼
⑤ 用户点击返回/关闭 → cleanupPerformancePanel() 停止轮询
```

### 关键模块

| 模块 | 路径 | 职责 |
|------|------|------|
| `getPerformanceContent` | `src/panels/performance/index.js` | 返回带骨架屏的 HTML 字符串（含 id 锚点供 DOM 更新定位） |
| `fetchPerformanceData` | `src/panels/performance/index.js` | 异步获取 Token 数据（当前返回占位对象，TODO 处接真实 API） |
| `updatePerformanceDOM` | `src/panels/performance/index.js` | 纯 DOM 更新函数，轮询复用 |
| `initPerformancePanel` | `src/panels/performance/index.js` | 首次加载 + 可选轮询，返回 `{ destroy }` 生命周期句柄 |
| `navigateToEchoMemPanel` | `src/core/router.js` | 路由层：打开效能面板时先渲染骨架屏，再调用 init |
| `cleanupPerformancePanel` | `src/core/router.js` | 面板切换/关闭时清理轮询定时器 |

### 生命周期管理

- `perfPanelCleanup` 为模块级变量，持有当前效能面板的 `destroy` 函数
- 以下场景自动调用 `cleanupPerformancePanel()`：
  - 用户点击效能面板的"返回"按钮
  - 用户切换到其他 EchoMem 面板
  - 用户关闭整个 EchoMem 面板

## 接口扩展预留

### fetchPerformanceData（数据获取层）

当前为占位实现：

```js
export async function fetchPerformanceData() {
  // TODO: 接入真实 API
  return {
    userTokens: 45280,
    savedTokens: 12500,
    backendTokens: 32780
  };
}
```

接入真实接口时，只需替换函数体为实际请求：

```js
const { createClient } = await import('../../services/openviking-client.js');
const { getOpenVikingConfig } = await import('../../services/config.js');
const client = createClient(await getOpenVikingConfig());
const res = await client.get('/api/performance/tokens');
return res.data;
```

**约定数据结构**：

```ts
interface PerformanceData {
  userTokens: number;    // 用户会话 Token 消耗量
  savedTokens: number;   // 预计节省 Token 量
  backendTokens: number; // EchoMem 后端 Token 消耗量
}
```

### 轮询间隔调整

在 `src/core/router.js` 中修改：

```js
perfPanelCleanup = initPerformancePanel(body, {
  pollInterval: 30000 // 毫秒，设为 0 或不传则关闭轮询
});
```

### WebSocket 替代（未来）

若后续改为服务端推送，可替换 `initPerformancePanel` 中的 `setInterval` 为 WebSocket 事件监听，DOM 更新逻辑完全复用 `updatePerformanceDOM`。

## 错误处理

- **接口异常**：`try/catch` 捕获后，在说明文字区显示"数据加载失败，请稍后重试"，面板不崩溃
- **DOM 已销毁**：轮询回调中检查 `destroyed` 标志，防止面板关闭后仍操作 DOM

## 代码变更文件

- `src/panels/performance/index.js` — 骨架屏、数据获取、DOM 更新、轮询逻辑
- `src/panels/index.js` — 导出 `initPerformancePanel`
- `src/core/router.js` — 路由层集成骨架屏 + 轮询生命周期管理
