// 会话识别与映射 — 从页面提取 session ID 并映射为 OpenViking session ID

export function extractSessionId(platformId) {
  if (platformId === 'higo') {
    const match = window.location.pathname.match(/\/home\/session\/([a-f0-9-]+)/i);
    return match?.[1] || null;
  }
  if (platformId === 'deepseek') {
    // DeepSeek 的 session 标识从 URL pathname 提取
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
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
