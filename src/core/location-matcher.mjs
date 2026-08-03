function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
}

function normalizePathPrefix(prefix) {
  const normalized = String(prefix || '').trim();
  if (!normalized || normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '');
}

export function matchesAllowedHostname(hostname, allowedHostnames) {
  if (!Array.isArray(allowedHostnames) || allowedHostnames.length === 0) return true;

  const normalizedHostname = normalizeHostname(hostname);
  return allowedHostnames.some((allowedHostname) =>
    normalizedHostname === normalizeHostname(allowedHostname)
  );
}

export function matchesPathnamePrefixes(pathname, pathnamePrefixes) {
  if (!Array.isArray(pathnamePrefixes) || pathnamePrefixes.length === 0) return true;

  const normalizedPathname = String(pathname || '');
  return pathnamePrefixes.some((prefix) => {
    const normalizedPrefix = normalizePathPrefix(prefix);
    if (!normalizedPrefix) return false;
    if (normalizedPrefix === '/') return normalizedPathname.startsWith('/');
    return normalizedPathname === normalizedPrefix
      || normalizedPathname.startsWith(`${normalizedPrefix}/`);
  });
}
