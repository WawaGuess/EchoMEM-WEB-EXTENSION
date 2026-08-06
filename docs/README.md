# EchoMem 文档目录

本文档目录按**功能域聚类**组织，便于按功能查找和维护。

## 目录结构

```
docs/
├── README.md                          # 本文档
├── decisions/                         # ADR：长期有效的架构决策
│   ├── 001-统一浮层面板模式.md
│   ├── 002-认知反馈居中浮层.md
│   ├── 003-Organic-Liquid设计风格.md
│   ├── 004-模块化内容架构.md
│   ├── 005-后端迁移至EchoMem.md
│   ├── 007-扩展入口统一为网页浮层.md
│   └── 008-单分支双发行包.md
├── flows/                             # 流程/调用链：随代码迭代维护
│   ├── panel-system/
│   │   ├── 生命周期.md
│   │   ├── 居中浮层.md
│   │   └── 工具栏打开浮层.md
│   ├── platform-detection/
│   │   └── 检测流程.md
│   ├── cognitive-feedback/
│   │   └── 图谱渲染.md
│   ├── input-association/
│   │   └── 补全流程.md
│   ├── session-recording/
│   │   └── 录制流程.md
│   ├── resource/
│   │   └── 导入流程.md
│   ├── skill-store/
│   │   ├── 上传流程.md
│   │   ├── 列表读取流程.md
│   │   └── 版本历史与回退设计.md
│   └── performance/
│       └── Token指标流程.md
├── reference/                         # 配置参考、接口清单
│   ├── 平台配置参考.md
│   └── 面板注册参考.md
└── legacy/                            # 历史归档
    ├── 006-用户会话Token统计方案.md
    ├── 旧版四按钮功能.md
    ├── DeepSeek旧版接入.md
    ├── 2026-05-02-模块化内容架构方案.md
    ├── 2026-05-09-智能补全综合方案.md
    ├── 2026-05-11-认知反馈图谱浮层方案.md
    ├── 2026-05-14-可配置会话录制.md
    ├── 2026-05-19-资源导入FTP化方案.md
    ├── 2026-05-26-技能上传创建方案.md
    └── 2026-05-26-技能列表读取方案.md
```

## 功能域速查表

| 功能域 | decisions | flows | reference |
|--------|-----------|-------|-----------|
| 面板系统 | 001-统一浮层面板模式、007-扩展入口统一为网页浮层 | panel-system/生命周期、居中浮层、工具栏打开浮层 | 面板注册参考 |
| 平台检测 | — | platform-detection/检测流程 | 平台配置参考 |
| 认知反馈 | 002-认知反馈居中浮层 | cognitive-feedback/Episode情节记忆展示 | — |
| 输入联想 | — | input-association/补全流程 | — |
| 会话录制 | — | session-recording/录制流程 | — |
| 资源管理 | — | resource/导入流程 | — |
| Skill 管理 | — | skill-store/上传流程、列表读取流程、版本历史与回退设计 | — |
| 效能概览 | — | performance/Token指标流程 | — |
| 设计风格 | 003-Organic-Liquid设计风格 | — | — |
| 模块化架构 | 004-模块化内容架构 | — | — |
| 后端迁移与发行 | 005-后端迁移至EchoMem、008-单分支双发行包 | backend-migration/实施计划 | EchoMem后端迁移现状与接口对照、外部接口清单 |
| 扩展入口 | 001-统一浮层面板模式、007-扩展入口统一为网页浮层 | panel-system/工具栏打开浮层 | — |

## 文档维护规则

### 最小更新原则

| 变化类型 | 需要更新 |
|----------|----------|
| 仅修复 bug、调整样式、内部实现小改动 | 通常不需要更新文档 |
| 用户可感知的功能、入口、交互流程变化 | 更新 `flows/` 中对应文档 |
| 架构决策、长期设计方向变化 | 新增或更新 `decisions/` 中 ADR |
| 配置项、接口契约变化 | 更新 `reference/` 中对应文档 |
| 方案已被替代但仍有参考价值 | 移入 `legacy/` |

### 双向锚点规范

代码中在关键位置添加指向文档的注释：

```javascript
// 文档：docs/flows/panel-system/生命周期.md
// 面板生命周期：打开 → 渲染 → 关闭 → 恢复
```

文档中在开头添加指向代码的注释：

```markdown
> 相关代码：`src/core/panel-host.js`
> 配置参考：`docs/reference/面板注册参考.md`
```

## ADR 编写规范

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

## 文件位置速查

- 内容脚本源码入口：`/src/entry/content.js`
- 内容脚本构建产物：`/dist/content.js`
- 平台配置：`/src/platforms/`
- 面板注册：`/src/panels/registry.js`
- 检测系统：`/src/core/detection.js`
- 面板承载：`/src/core/panel-host.js`
- 路由实现：`/src/core/router.js`
