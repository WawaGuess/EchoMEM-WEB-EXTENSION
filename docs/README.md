# EchoMem 文档目录

本文档目录用于保存 EchoMem Web Extension 的现行设计、运行架构说明和历史方案归档。

## 目录结构

```
docs/
├── README.md
├── architecture/
│   ├── platform-detection.md
│   ├── detection-flow.mmd
│   └── 2026-05-11-smart-completion-implementation.md
├── design/
│   └── echomem-launcher-sidebar.md
├── proposals/
│   └── README.md
└── legacy/
    ├── button-features.md
    └── deepseek-extension.md
```

## 现行文档

| 文档 | 说明 |
|------|------|
| [design/echomem-launcher-sidebar.md](./design/echomem-launcher-sidebar.md) | 当前 `EchoMem` 单入口按钮与右侧功能导航设计 |
| [architecture/platform-detection.md](./architecture/platform-detection.md) | 平台检测、入口注入、面板模式与新平台扩展说明 |
| [architecture/detection-flow.mmd](./architecture/detection-flow.mmd) | 平台检测流程图，Mermaid 格式 |
| [architecture/2026-05-11-smart-completion-implementation.md](./architecture/2026-05-11-smart-completion-implementation.md) | 智能补全功能实现总结：OpenViking 召回 + 本地算法 + 多选浮层 + 合并式插入；含 OpenViking 认证开关（authEnabled）逻辑 |
| [architecture/2026-05-16-session-recording-implementation.md](./architecture/2026-05-16-session-recording-implementation.md) | 会话录制模块实现：DOM 提取、消息 diff、流式完成检测、OpenViking 同步，含去重与防重设计 |
| [architecture/2026-05-20-resource-import-ftp-like-implementation.md](./architecture/2026-05-20-resource-import-ftp-like-implementation.md) | 资源导入 FTP 化改造实现总结：前端上传/浏览/新建文件夹流程，OpenViking `keep_original` 备份逻辑，HTTP 接口清单与数据流 |
| [architecture/2026-05-26-skill-upload-implementation.md](./architecture/2026-05-26-skill-upload-implementation.md) | Skill 上传创建功能实现总结：前端校验/temp_upload/add_skill 流程，OpenViking SkillProcessor 解析落盘逻辑，含时序图 |
| [architecture/2026-05-26-skill-list-reading-implementation.md](./architecture/2026-05-26-skill-list-reading-implementation.md) | Skill 列表与详情查看功能实现总结：fsLs/contentRead 适配，frontmatter 去除后的数据获取策略，缓存与性能优化，含时序图 |
| [proposals/README.md](./proposals/README.md) | 后续方案草稿区的使用规则 |

## 方案记录

| 文档 | 说明 |
|------|------|
| [proposals/2026-05-02-modular-content-architecture.md](./proposals/2026-05-02-modular-content-architecture.md) | 内容脚本模块化与可扩展架构方案（已采用） |
| [legacy/2026-05-09-smart-completion-unified.md](./legacy/2026-05-09-smart-completion-unified.md) | 智能补全综合方案（已实现，会话提取已废弃） |

## 历史归档

| 文档 | 说明 |
|------|------|
| [legacy/button-features.md](./legacy/button-features.md) | 旧版输入框下方 4 个功能按钮实现记录 |
| [legacy/deepseek-extension.md](./legacy/deepseek-extension.md) | DeepSeek 旧版 4 按钮接入记录 |

`legacy/` 中的文档只作为历史参考，不代表当前运行逻辑。当前内容脚本源码入口是 `/src/entry/content.js`，Chrome 通过 `manifest.json` 实际加载构建产物 `/dist/content.js`；修改运行行为后需要执行 `npm run build`。

## 当前功能入口

当前交互将输入区入口收敛为一个 `EchoMem` 按钮。点击后在右侧侧边栏或浮层打开功能导航首页，包含以下 5 个入口：

| 入口 | 功能 |
|------|------|
| 资源管理 | 文件上传和资源列表 |
| 输入联想 | 开关控制输入联想功能 |
| 认知反馈 | 会话统计和反馈报告 |
| skill商店 | Skill 浏览、购买、上传和管理 |
| 效能 | 使用效率与工作表现概览 |

## 文档存放约定

- 当前交互、页面结构、验收标准放在 `docs/design/`。
- 运行架构、平台检测、注入流程、扩展新平台说明放在 `docs/architecture/`。
- 未确认或正在讨论的新方案放在 `docs/proposals/`。
- 已被现行方案替代但仍有参考价值的设计记录放在 `docs/legacy/`。
- Mermaid、架构图等与架构文档强相关的图表跟随放在 `docs/architecture/`。
- 新文档加入后，需要同步更新本索引，避免文档入口散落。

## 文档维护规则

### 最小更新原则

后续修改代码时，不需要每次重新梳理全部文档。只在对应事实发生变化时更新相关文档：

| 变化类型 | 需要更新 |
|----------|----------|
| 仅修复 bug、调整样式、内部实现小改动 | 通常不需要更新文档 |
| 用户可感知的功能、入口、交互流程变化 | 更新 `docs/design/` 中对应现行设计 |
| 平台检测、注入方式、运行入口、数据流、目录结构变化 | 更新 `docs/architecture/` |
| 新方案仍在讨论或验证中 | 新增或更新 `docs/proposals/` 下的方案文档 |
| 方案已被替代但仍有参考价值 | 移入 `docs/legacy/` |

### 方案生命周期

1. 新想法或改造方案先写到 `docs/proposals/YYYY-MM-DD-topic.md`。
2. 方案实现和测试过程中，只维护对应 proposal，不急着改现行设计文档。
3. 方案确认采用后，把最终稳定行为沉淀到 `docs/design/` 或 `docs/architecture/`。
4. 原 proposal 如果仍有决策参考价值，移入 `docs/legacy/`；如果只是临时草稿，可以删除。
5. 只有新增、移动、删除文档时，才同步更新本索引。
