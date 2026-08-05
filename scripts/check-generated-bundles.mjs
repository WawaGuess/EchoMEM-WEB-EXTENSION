import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './build-extension.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

async function readManifestBundlePaths() {
  const manifestPath = path.join(PROJECT_ROOT, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return [...new Set(
    (manifest.content_scripts || [])
      .flatMap((entry) => entry.js || [])
      .filter((relativePath) => relativePath.startsWith('dist/') && relativePath.endsWith('.js'))
  )];
}

async function filesMatch(actualPath, expectedPath) {
  try {
    const [actual, expected] = await Promise.all([
      fs.readFile(actualPath),
      fs.readFile(expectedPath),
    ]);
    return actual.equals(expected);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function findStaleGeneratedBundles({
  projectRoot = PROJECT_ROOT,
  expectedRoot,
  bundlePaths,
} = {}) {
  const staleBundles = [];
  for (const relativePath of bundlePaths) {
    const actualPath = path.join(projectRoot, relativePath);
    const expectedPath = path.join(expectedRoot, relativePath);
    if (!await filesMatch(actualPath, expectedPath)) staleBundles.push(relativePath);
  }
  return staleBundles;
}

export async function checkGeneratedBundles() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'echomem-bundle-check-'));
  const bundlePaths = await readManifestBundlePaths();

  try {
    await buildExtension({
      profileId: 'development',
      outdir: path.join(temporaryRoot, 'dist'),
      log: false,
    });
    const staleBundles = await findStaleGeneratedBundles({
      expectedRoot: temporaryRoot,
      bundlePaths,
    });
    if (staleBundles.length > 0) {
      throw new Error(
        `Generated bundles are stale: ${staleBundles.join(', ')}. Run npm run build and commit the updated files.`
      );
    }
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }

  console.log(`Generated bundles are synchronized: ${bundlePaths.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkGeneratedBundles().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
