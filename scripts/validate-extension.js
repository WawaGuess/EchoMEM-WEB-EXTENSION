import fs from 'node:fs';
import path from 'node:path';
import {
  getDeploymentProfile,
  RELEASE_PROFILE_IDS,
  resolveDeploymentProfile,
} from './deployment-profiles.mjs';

const root = path.resolve(process.argv[2] || '.');
const profileId = process.argv[3];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const manifest = JSON.parse(read('manifest.json'));
const manifestScriptFiles = [...new Set(
  (manifest.content_scripts || []).flatMap((entry) => entry.js || [])
)];
const requiredFiles = [
  'background.js',
  ...manifestScriptFiles,
  'assets/echomem-lockup.png',
  'assets/echomem-symbol.png',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

assert(manifest.manifest_version === 3, 'manifest_version must be 3');
assert(!manifest.permissions?.includes('sidePanel'), 'sidePanel permission must be removed');
assert(!manifest.side_panel, 'side_panel entry must be removed');
assert(!manifest.action?.default_popup, 'action.default_popup must be removed');
assert(
  manifest.web_accessible_resources?.some((entry) => entry.resources?.includes('assets/*')),
  'EchoMem brand assets must be web accessible'
);

for (const relativePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, relativePath)), `required extension file is missing: ${relativePath}`);
}

if (profileId) {
  const profile = resolveDeploymentProfile(profileId);
  const profileAddressLiteral = JSON.stringify(profile.defaultBaseUrl);
  const contentBundles = manifestScriptFiles.map((relativePath) => ({
    relativePath,
    source: read(relativePath),
  }));
  assert(
    manifest.name.includes(profile.label),
    `manifest name must identify the ${profile.label} deployment profile`
  );
  assert(
    contentBundles.every((bundle) => bundle.source.includes(profileAddressLiteral)),
    `all content bundles must include the ${profile.label} default service address`
  );

  for (const otherProfileId of RELEASE_PROFILE_IDS) {
    if (otherProfileId === profileId) continue;
    const otherProfileMetadata = getDeploymentProfile(otherProfileId);
    if (!process.env[otherProfileMetadata.baseUrlEnv]) continue;
    const otherProfile = resolveDeploymentProfile(otherProfileId);
    const otherProfileAddressLiteral = JSON.stringify(otherProfile.defaultBaseUrl);
    assert(
      contentBundles.every((bundle) => !bundle.source.includes(otherProfileAddressLiteral)),
      `content bundles must not include the ${otherProfile.label} service address`
    );
  }
}

console.log(`EchoMem extension structure is valid: ${root}`);
