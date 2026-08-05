export const DEPLOYMENT_PROFILES = Object.freeze({
  development: Object.freeze({
    id: 'development',
    label: '开发版',
    baseUrlEnv: null,
    releaseDirectory: null,
  }),
  public: Object.freeze({
    id: 'public',
    label: '公网版',
    baseUrlEnv: 'ECHOMEM_PUBLIC_BASE_URL',
    releaseDirectory: 'EchoMem-Extension-Public',
  }),
  intranet: Object.freeze({
    id: 'intranet',
    label: '内网版',
    baseUrlEnv: 'ECHOMEM_INTRANET_BASE_URL',
    releaseDirectory: 'EchoMem-Extension-Intranet',
  }),
});

export const DEPLOYMENT_PROFILE_IDS = Object.freeze(Object.keys(DEPLOYMENT_PROFILES));
export const RELEASE_PROFILE_IDS = Object.freeze(['public', 'intranet']);

export function getDeploymentProfile(profileId) {
  const profile = DEPLOYMENT_PROFILES[profileId];
  if (!profile) {
    throw new Error(
      `Unknown deployment profile: ${profileId}. Expected one of: ${DEPLOYMENT_PROFILE_IDS.join(', ')}`
    );
  }
  return profile;
}

function normalizeBaseUrl(value, environmentName) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error(`Missing required deployment address: ${environmentName}`);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid deployment address in ${environmentName}: expected an absolute URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Invalid deployment address in ${environmentName}: only http and https are supported`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Invalid deployment address in ${environmentName}: credentials must not be embedded in URLs`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`Invalid deployment address in ${environmentName}: query strings and fragments are not supported`);
  }

  return trimmed;
}

export function resolveDeploymentProfile(profileId, environment = process.env) {
  const profile = getDeploymentProfile(profileId);
  if (!profile.baseUrlEnv) {
    return Object.freeze({ ...profile, defaultBaseUrl: '' });
  }

  return Object.freeze({
    ...profile,
    defaultBaseUrl: normalizeBaseUrl(environment[profile.baseUrlEnv], profile.baseUrlEnv),
  });
}
