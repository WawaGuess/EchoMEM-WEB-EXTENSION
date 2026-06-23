// 会话识别与映射 — 从页面提取 session ID

import { PLATFORM_CONFIGS } from '../platforms/index.js';

export function extractSessionId(platformId) {
  const config = PLATFORM_CONFIGS[platformId];
  if (!config || !config.sessionId) return null;

  const { type, pattern, flags, segment } = config.sessionId;

  if (type === 'regex' && pattern) {
    const regex = new RegExp(pattern, flags || '');
    const match = window.location.pathname.match(regex);
    return match?.[1] || null;
  }

  if (type === 'path') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = segment ?? -1;
    if (idx >= 0) {
      return parts[idx] || null;
    }
    return parts[parts.length + idx] || null;
  }

  return null;
}
