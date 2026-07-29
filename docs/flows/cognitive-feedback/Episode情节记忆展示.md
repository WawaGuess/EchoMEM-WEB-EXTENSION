# Episode 情节记忆展示设计

> 相关代码：`src/entry/feedback-episode.js`、`src/services/episode-client.js`、`src/panels/feedback/timeline/`

## 目标

把 EchoMem Episode 从图谱节点中分离为独立的“情节记忆”视图，让用户先理解一段经历是什么、如何延续、包含哪些关键事件，再按需进入详情查看完整信息。

## 信息架构

本功能注册到 PR 1 提供的认知反馈公共壳，并保持两个明确边界：

1. **记忆图谱**：只展示 Atom、Entity 及其关系。
2. **情节记忆**：展示 Episode 时间范围、连续性、事件、标签与可用操作。

默认进入情节记忆。视图切换时销毁前一个视图的 Three.js、事件和异步状态，避免迟到请求覆盖当前页面。

## 数据流程

1. `episode-client.js` 从 EchoMem Episode 目录读取原始 JSON。
2. 客户端保留后端顺序与字段，只添加渲染所需的安全派生值。
3. `timeline-scale.js` 根据可用时间计算统一时间轴。
4. `timeline-layout.js` 生成 Episode 区间和事件标记布局。
5. `timeline-view.js` 渲染总览、选择状态和详情面板。

## 交互设计

- 首屏使用总览时间线，降低信息密度；选择 Episode 后再显示独立详情。
- Episode 区间、事件点和列表项均可键盘聚焦。
- 详情包含摘要、时间范围、事件、标签和来源元数据。
- 只有 `segments` 或 `source_turn_id` 有效时才显示来源跳转；缺失字段不会生成无效入口。
- 窄屏下详情改为底部抽屉，保持时间线和返回路径清晰。

## 状态与容错

- 加载、空数据和失败状态均在当前视图内呈现。
- 重试仅刷新 Episode 缓存，不影响图谱数据。
- 每次切换生成新的 revision；异步响应只有在容器仍连接且 revision 仍有效时才能更新 DOM。
- 面板关闭或视图切换时取消观察器、事件绑定和渲染资源。

## 非目标

- 不展示或加载周期回顾/Summary。
- 不修改 Summary 的入口、源码或构建产物。
- 不提交记忆花园原型。
- 不改变 Episode 后端生成、排序、过滤、合并或持久化逻辑。
- 不在来源字段缺失时推测会话位置。

## 兼容性约束

- 认知反馈继续使用居中浮层和 `_previousOverlay` 恢复机制。
- 保持图谱已有入口，同时从图谱数据中排除 `episode:` 节点，避免同一内容重复出现。
- 本 PR 只替换 Episode 入口并生成 `dist/feedback-episode.js`；公共 `dist/content.js` 与 Summary bundle 保持和 PR 1 一致。
- 分支直接基于 PR 1，不包含 PR 3 的任何提交，因此可与 Summary 按任意顺序合并。

## 验证

- `npm run check`
- `git diff --check`
- 验证图谱与情节记忆来回切换、迟到响应隔离和资源清理。
- 验证 Episode 总览、详情、键盘操作、空态、错误态和重试。
- 验证来源操作只在真实来源字段存在时出现。
- 验证窄屏详情抽屉与 `_previousOverlay` 返回行为。
