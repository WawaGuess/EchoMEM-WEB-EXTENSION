// HIGO Office 平台 adapter
// 当前 HIGO 不录制（platforms.json 中 record: false），且行为差异已覆盖在 BaseAdapter
// 的"配置驱动"默认实现中（messageContainers / 角色启发 / 文本提取）。
// 保留独立文件以便后续 HIGO 特化时有地方挂代码。

import { BaseAdapter } from './base-adapter.js';

export const HigoAdapter = {
  ...BaseAdapter,
};
