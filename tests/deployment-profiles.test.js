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

const PREFIX_ENVIRONMENTS = Object.freeze({
  port: Object.freeze({
    ECHOMEM_PUBLIC_BASE_URL: 'https://api.example.test',
    ECHOMEM_INTRANET_BASE_URL: 'https://api.example.test:8443',
  }),
  path: Object.freeze({
    ECHOMEM_PUBLIC_BASE_URL: 'https://api.example.test/echomem',
    ECHOMEM_INTRANET_BASE_URL: 'https://api.example.test/echomem/internal',
  }),
});

const BUNDLE_NAMES = Object.freeze([
  'content.js',
  'feedback-episode.js',
  'feedback-summary.js',
]);

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

    assert.ok(bundle.includes(JSON.stringify(profile.defaultBaseUrl)));
    assert.ok(!bundle.includes(JSON.stringify(otherProfile.defaultBaseUrl)));
  }
});

test('profile builds keep prefix-related service address literals distinct', async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'echomem-prefix-profile-build-'));
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

  for (const [scenario, environment] of Object.entries(PREFIX_ENVIRONMENTS)) {
    for (const profileId of ['public', 'intranet']) {
      const profile = resolveDeploymentProfile(profileId, environment);
      const otherProfile = resolveDeploymentProfile(
        profileId === 'public' ? 'intranet' : 'public',
        environment
      );
      const outdir = path.join(temporaryRoot, scenario, profileId);

      await buildExtension({
        profileId,
        outdir,
        log: false,
        environment,
      });

      for (const bundleName of BUNDLE_NAMES) {
        const bundle = await fs.readFile(path.join(outdir, bundleName), 'utf8');
        assert.ok(
          bundle.includes(JSON.stringify(profile.defaultBaseUrl)),
          `${scenario}/${profileId}/${bundleName} must include its exact address literal`
        );
        assert.ok(
          !bundle.includes(JSON.stringify(otherProfile.defaultBaseUrl)),
          `${scenario}/${profileId}/${bundleName} must exclude the other exact address literal`
        );
      }
    }
  }
});
