import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildExtension } from '../scripts/build-extension.mjs';
import {
  DEPLOYMENT_PROFILES,
  getDeploymentProfile,
  resolveDeploymentProfile,
} from '../scripts/deployment-profiles.mjs';

const TEST_ENVIRONMENT = Object.freeze({
  ECHOMEM_PUBLIC_BASE_URL: 'https://public.example.test/echomem/',
  ECHOMEM_INTRANET_BASE_URL: 'http://intranet.example.test:41040',
});

test('deployment profiles resolve service addresses from the environment', () => {
  assert.equal(DEPLOYMENT_PROFILES.public.baseUrlEnv, 'ECHOMEM_PUBLIC_BASE_URL');
  assert.equal(DEPLOYMENT_PROFILES.intranet.baseUrlEnv, 'ECHOMEM_INTRANET_BASE_URL');
  assert.equal(
    resolveDeploymentProfile('public', TEST_ENVIRONMENT).defaultBaseUrl,
    'https://public.example.test/echomem'
  );
  assert.equal(
    resolveDeploymentProfile('intranet', TEST_ENVIRONMENT).defaultBaseUrl,
    'http://intranet.example.test:41040'
  );
  assert.equal(resolveDeploymentProfile('development', {}).defaultBaseUrl, '');
  assert.throws(() => getDeploymentProfile('unknown'), /Unknown deployment profile/);
  assert.throws(() => resolveDeploymentProfile('public', {}), /ECHOMEM_PUBLIC_BASE_URL/);
  assert.throws(
    () => resolveDeploymentProfile('public', { ECHOMEM_PUBLIC_BASE_URL: 'ftp://example.test' }),
    /only http and https/
  );
});

test('profile builds embed only their own default service address', async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'echomem-profile-build-'));
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

  for (const profileId of ['public', 'intranet']) {
    const profile = resolveDeploymentProfile(profileId, TEST_ENVIRONMENT);
    const otherProfile = resolveDeploymentProfile(
      profileId === 'public' ? 'intranet' : 'public',
      TEST_ENVIRONMENT
    );
    const outdir = path.join(temporaryRoot, profileId);

    await buildExtension({
      profileId,
      outdir,
      entryName: 'content',
      log: false,
      environment: TEST_ENVIRONMENT,
    });
    const bundle = await fs.readFile(path.join(outdir, 'content.js'), 'utf8');

    assert.match(bundle, new RegExp(profile.defaultBaseUrl.replaceAll('.', '\\.')));
    assert.doesNotMatch(bundle, new RegExp(otherProfile.defaultBaseUrl.replaceAll('.', '\\.')));
  }
});
