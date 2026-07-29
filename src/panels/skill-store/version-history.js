const SOURCE_LABELS = {
  manual_upload: '手动上传',
  generated: '自动生成',
  optimized: '自动优化',
  rollback: '历史恢复',
  current: '当前文件',
};

function toPositiveInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value);
}

export function escapeHtml(value) {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatVersionLabel(value) {
  const raw = toText(value).trim();
  if (!raw) return '—';

  const prefixed = raw.match(/^v(\d+)$/i);
  if (prefixed) return `v${Number(prefixed[1])}`;

  const version = toPositiveInteger(raw);
  return version === null ? raw : `v${version}`;
}

export function formatVersionDate(value) {
  if (!value) return '—';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getVersionSourceLabel(source) {
  const normalized = toText(source).trim();
  return SOURCE_LABELS[normalized] || '未知来源';
}

export function getSkillApiName(skill) {
  const dirName = toText(skill?.dirName).trim();
  if (dirName) return dirName;
  return toText(skill?.name).trim();
}

export function formatSkillCommand(skill) {
  const apiName = getSkillApiName(skill).replace(/^\/+/, '');
  return apiName ? `/${apiName}` : '';
}

export function classifyVersionError(error) {
  const status = Number(error?.status);
  if (status === 404 || status === 405) return 'unsupported';
  if (status === 401 || status === 403) return 'auth';

  const message = toText(error?.message).toLowerCase();
  if (error?.name === 'AbortError' || message.includes('aborted') || message.includes('timeout')) {
    return 'timeout';
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'network';
  }
  return 'error';
}

export function normalizeSkillVersionHistory(payload) {
  const rawPayload = payload && typeof payload === 'object' ? payload : {};
  const rawVersions = Array.isArray(rawPayload.versions) ? rawPayload.versions : [];
  const versionsByNumber = new Map();

  for (const item of rawVersions) {
    if (!item || typeof item !== 'object') continue;
    const version = toPositiveInteger(item.version);
    if (version === null) continue;

    versionsByNumber.set(version, {
      version,
      parentVersion: toPositiveInteger(item.parent_version),
      source: toText(item.source),
      runId: toText(item.run_id),
      createdAt: toText(item.created_at),
      current: item.current === true,
      hash: toText(item.hash),
      exists: item.exists !== false,
    });
  }

  let currentVersion = toPositiveInteger(rawPayload.current_version);
  if (currentVersion === null) {
    currentVersion = [...versionsByNumber.values()].find(item => item.current)?.version || null;
  }

  const versions = [...versionsByNumber.values()]
    .map(item => ({
      ...item,
      current: currentVersion !== null && item.version === currentVersion,
    }))
    .sort((a, b) => b.version - a.version);

  return {
    name: toText(rawPayload.name),
    currentVersion,
    versions,
  };
}
