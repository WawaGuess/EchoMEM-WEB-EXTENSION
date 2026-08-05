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
const requiredFiles = [
  'background.js',
  'dist/content.js',
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
  const contentBundle = read('dist/content.js');
  assert(
    manifest.name.includes(profile.label),
    `manifest name must identify the ${profile.label} deployment profile`
  );
  assert(
    contentBundle.includes(profile.defaultBaseUrl),
    `content bundle must include the ${profile.label} default service address`
  );

  for (const otherProfileId of RELEASE_PROFILE_IDS) {
    if (otherProfileId === profileId) continue;
    const otherProfileMetadata = getDeploymentProfile(otherProfileId);
    if (!process.env[otherProfileMetadata.baseUrlEnv]) continue;
    const otherProfile = resolveDeploymentProfile(otherProfileId);
    assert(
      !contentBundle.includes(otherProfile.defaultBaseUrl),
      `content bundle must not include the ${otherProfile.label} service address`
    );
  }
}

console.log(`EchoMem extension structure is valid: ${root}`);
