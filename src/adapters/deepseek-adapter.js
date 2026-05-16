// DeepSeek 平台 adapter
// 当前所有 DeepSeek 行为差异都已经收敛到 platforms.json 的配置项：
//   - messages.noiseSelectors（.ds-think-content 等噪音）
//   - messages.assistant.textSelector / skipIfMissing / roleSignals
//   - messages.smartContainerHints（.ds-virtual-list）
//   - streaming.strategy = "button-svg-poll" + params
//
// 因此本文件不需要重写任何方法。保留独立文件是为了：
//   1. 后续若出现 JSON 无法表达的 DeepSeek 行为，在此处覆盖；
//   2. 在 adapter registry 中能按 platformId 显式注册。

import { BaseAdapter } from './base-adapter.js';

export const DeepseekAdapter = {
  ...BaseAdapter,
};
