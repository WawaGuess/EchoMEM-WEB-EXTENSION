# AGENTS-CN.md

中文版。英文版见 [`AGENTS.md`](AGENTS.md)。两份文件必须保持同步。

## 适用范围

本文档用于指导在本仓库工作的 AI 编码助手、GitHub PR 审查助手、Codex、Copilot、Claude、Gemini CLI 及类似自动化工具。除非 Issue、Pull Request、任务描述或用户消息另有要求，否则助手必须遵循本文档；用户的直接指令优先级更高。

## 项目背景

EchoMem Web Extension 是一个基于 Manifest V3 的 Chrome/Edge 扩展。它在受支持的 AI 聊天页面中注入 EchoMem 入口与浮层，提供资源管理、输入联想、认知反馈、Skill 管理、效能统计和后端配置。目前支持 HIGO Office 与 DeepSeek。

修改代码前，必须先阅读 `CLAUDE.md`，以及与任务直接相关的源码、配置、文档和现有实现。以当前 checkout 的实际状态为准，不要仅凭文件名或通用浏览器扩展经验推断行为。

## 仓库结构

| 路径 | 职责 |
|---|---|
| `manifest.json` | Manifest V3 声明、权限、Service Worker 与内容脚本入口 |
| `src/entry/content.js` | 内容脚本源码入口 |
| `dist/content.js` | Chrome 实际加载的已提交构建产物 |
| `background.js` | 事件驱动的 Service Worker、工具栏入口、存储初始化与跨域请求代理 |
| `src/core/` | 检测、生命周期、注入、路由、状态、面板宿主与会话录制 |
| `src/panels/` | 功能面板与面板注册表 |
| `src/platforms/`, `src/config/` | 平台注册与声明式运行配置 |
| `src/adapters/` | 通用适配器行为与平台差异覆盖 |
| `src/streaming/` | 流式完成检测策略 |
| `src/services/` | Chrome API、存储、消息与后端客户端 |
| `src/utils/` | 通用解析与文本工具 |
| `docs/decisions/` | 架构决策记录 |
| `docs/flows/` | 当前功能流程与调用链 |
| `docs/reference/` | 当前配置与接口参考 |
| `docs/legacy/` | 已被取代的历史材料，不得视为当前契约 |
| `scripts/` | 扩展校验与发行打包脚本 |

## 工作规则

- 只处理用户要求的任务；没有明确原因时，不要顺手重构无关模块。
- 编辑前先确认真实运行入口、相似实现、平台配置、代码到文档的锚点，以及可能受影响的公开行为。
- 保留无关的本地改动，不得覆盖用户已有工作。
- 不要提交诊断代码、临时脚本、本地缓存、日志、发行输出或其他运行产物；唯一常规例外是仓库要求提交的 `dist/content.js`。
- 只有在实际执行并观察到结果后，才能声称某项行为、构建或测试通过。
- 保持实现、`manifest.json`、构建产物、README/CLAUDE 指引和当前文档之间的一致性。

## 架构边界

- 运行逻辑应修改 `src/`，不要手工编辑 `dist/content.js`。内容脚本源码变更后必须重新构建，并让生成的 bundle 与源码一起进入变更集。
- Chrome 加载的是 `dist/content.js`，不是 `src/entry/content.js`；只改源码而未重新构建，任务不算完成。
- 平台差异优先声明在 `src/config/platforms.json`；只有 JSON 无法表达时才覆盖 adapter。不得在 `src/adapters/base-adapter.js` 中加入 HIGO 或 DeepSeek 专属字面量。
- 平台适配器、流式检测器、功能面板和服务客户端应遵守现有注册表与模块边界。跨面板能力应放入合适的共享模块，不要在各面板重复实现。
- 跨域后端请求统一通过 Background Service Worker 代理；内容脚本不得绕过既有消息链路直接建立另一套调用方式。
- Background Service Worker 是事件驱动且非持久化的，不得依赖长期驻留的内存状态。
- `manifest.json` 当前匹配所有 URL，但由平台检测决定是否注入 UI。修改权限、host 权限、注入时机或支持平台时，必须明确评估安全性与兼容性。
- `popup.*` 是保留的历史文件，不是当前工具栏入口。除非任务明确改变该架构，否则不要恢复 `action.default_popup`。

## JavaScript 与浏览器规则

- 遵循现有 ES Module 风格、命名、分号和本地错误处理习惯。
- `src/` 中的代码必须能被 esbuild 打包为面向 Chrome 88 的 IIFE；浏览器运行路径不得引入仅 Node.js 可用的 API。
- DOM 查询必须具备防御性。无效或过期选择器不能导致整个内容脚本生命周期中断。
- 由于 DOM 变更或扩展事件可能导致重复调用，生命周期钩子和消息监听器在适用场景中应保持幂等。
- 后端或页面提供的数据进入 HTML 时必须转义或安全构造；未经净化的外部字符串不得直接插入 `innerHTML`。
- 除非产品需求另有说明，面向用户的 UI 文案保持简体中文。
- 不得记录密钥、Token、Cookie、完整敏感载荷或生产连接信息。
- 除非用户界面明确需要，否则代码、注释、文档、提交信息和 PR 标题中不要使用 emoji。

## 文档规则

源文件顶部可能包含 `文档：...` 锚点。行为发生变化时，应检查并同步更新其指向的文档。遵循最小充分更新原则：

- bug 修复、纯样式调整和内部实现修补通常不需要新增设计文档；
- 用户可感知的功能、入口或交互变化，需要更新对应的 `docs/flows/`；
- 平台检测、注入方式、运行入口、数据流、权限或模块边界变化，需要更新流程/参考文档，并视情况在 `docs/decisions/` 新增 ADR；
- 平台配置变化需要更新 `docs/reference/平台配置参考.md`；
- 面板注册变化需要更新 `docs/reference/面板注册参考.md`；
- 后端客户端或接口契约变化需要更新相关流程与接口参考；
- 被取代的材料应移入 `docs/legacy/`，不要在其中静默改写历史；
- 项目结构、构建、调试、支持平台或功能变化时，还必须同步检查 `README.md` 与 `CLAUDE.md`；
- 任何指引变化都必须同时更新 `AGENTS.md` 与 `AGENTS-CN.md`。

## 测试与验证

使用锁文件安装依赖，并执行仓库提供的校验脚本：

```bash
npm ci
npm run check
```

`npm run check` 会重新生成 `dist/content.js`、检查 JavaScript 语法并校验扩展结构。根据变更类型补充验证：

- 内容脚本源码：执行 `npm run check`，确认生成的 `dist/content.js` 符合预期，重新加载未打包扩展，并在受影响的平台上验证；
- Background 或消息通信：执行 `npm run check`，同时检查 Service Worker 控制台和内容页面控制台；
- 平台检测或 adapter：按需人工验证目标平台、不支持页面、重复 DOM 更新、消息提取与流式完成检测；
- manifest、资源、打包或发布：执行 `npm run package` 并校验 `release/EchoMem-Extension/`，但不要提交 `release/`；
- 纯文档变更：对照当前 checkout 核实路径、命令、API 名称和行为；除非同时修改了生成文件或运行文件，否则无需执行前端构建。

当前 `package.json` 中没有通用自动化单元测试套件，不得把 `npm run check` 描述成单元测试。如果因缺少目标平台、账号、密钥或外部服务而无法完成浏览器/后端验证，必须明确说明跳过了什么以及原因。

## GitHub 与 Pull Request

- GitHub 操作统一使用 `gh` CLI。
- 提交和 PR 只包含当前任务相关内容；保留并说明无关的 worktree 改动。
- PR 标题使用 `type(scope): summary` 格式。
- 允许的 `type`：`feat`、`fix`、`docs`、`test`、`refactor`、`ci`、`build`、`chore`。
- `scope` 优先使用 `extension`、`manifest`、`content`、`background`、`panel`、`adapter`、`docs` 或 `release`。
- PR 正文使用 `背景 / 概述`、`变更内容及原因`、`测试`、`结论` 四个部分。
- `测试` 只列出实际执行过的命令、CI、后端检查和人工浏览器验证；跳过的检查要说明原因。
- `结论` 必须说明 PR 是否可供 review/合入，并列出剩余风险或后续工作。
- 不得包含密钥、本地产物、发行输出、临时文件或无关重构。

## 审查语言与质量

除非用户明确要求其他语言，PR 审查、行内评论、CI/测试/风险总结以及是否可合入的结论必须使用中文。用户要求双语审查时，中文在前、英文在后。

审查意见必须具体、可执行，并尽量绑定实际代码或证据；说明问题、风险、受影响场景、修复建议和所需验证。多个问题按严重程度排序。若没有阻塞问题，应明确写：

```md
未发现阻塞合入的问题。
```

仍存在的测试、CI、后端或人工验证缺口需要单独说明。

## 安全与本地产物

不得暴露或提交 API Key、Token、Cookie、凭证、`.env` 内容、私有端点、生产连接串或敏感的用户/会话数据。引用环境变量时只写变量名。页面 DOM 内容和后端响应都应视为不可信输入。

不要提交 `node_modules/`、`release/`、日志、本地数据库、临时调试脚本、缓存、编辑器状态或大体积/二进制产物，除非用户明确要求且已记录原因。产品必需资源与仓库跟踪的 `dist/content.js` 除外。

## 无法确认事实时

必须明确说明不确定性，不得编造证据。区分源码检查、自动化校验、浏览器人工验证、后端联调和假设。推荐表述：

```md
我没有在当前变更中看到覆盖该场景的自动化测试，因此无法确认该分支已被自动验证。
```

```md
当前证据只能说明构建与扩展结构校验通过，不能证明目标平台上的完整交互已经验证。
```
