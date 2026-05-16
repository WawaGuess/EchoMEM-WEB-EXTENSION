// 会话识别与映射 — 从页面提取 session ID 并映射为 OpenViking session ID

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

export function mapToOpenVikingSessionId(platformId, rawSessionId) {
  if (platformId === 'higo' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSessionId)) {
    return rawSessionId.toLowerCase();
  }
  // 其他情况使用 sha256
  return sha256(rawSessionId || `echomem-${platformId}-${Date.now()}`);
}

function sha256(str) {
  // 简单的 hash 实现，用于生成稳定 ID
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
