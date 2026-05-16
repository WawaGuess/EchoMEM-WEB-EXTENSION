// Adapter 注册表 —— 按 platformId 获取对应 adapter。
// 新增平台时，在此处映射对应 adapter；未注册的平台回退到 BaseAdapter，
// 因此"纯配置驱动"的平台甚至不需要新建 adapter 文件。

import { BaseAdapter } from './base-adapter.js';
import { DeepseekAdapter } from './deepseek-adapter.js';
import { HigoAdapter } from './higo-adapter.js';

const adapters = {
  deepseek: DeepseekAdapter,
  higo: HigoAdapter,
};

export function getAdapter(platformId) {
  return adapters[platformId] || BaseAdapter;
}

export { BaseAdapter };
