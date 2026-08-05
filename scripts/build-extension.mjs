import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { resolveDeploymentProfile } from './deployment-profiles.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

const ENTRY_POINTS = Object.freeze({
  content: path.join(PROJECT_ROOT, 'src/entry/content.js'),
  'feedback-episode': path.join(PROJECT_ROOT, 'src/entry/feedback-episode.js'),
  'feedback-summary': path.join(PROJECT_ROOT, 'src/entry/feedback-summary.js'),
});

function readOption(args, name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1];
  return fallback;
}

function resolveEntryPoints(entryName) {
  if (!entryName || entryName === 'all') return ENTRY_POINTS;
  const entryPoint = ENTRY_POINTS[entryName];
  if (!entryPoint) {
    throw new Error(`Unknown entry: ${entryName}. Expected one of: all, ${Object.keys(ENTRY_POINTS).join(', ')}`);
  }
  return { [entryName]: entryPoint };
}

export async function buildExtension({
  profileId = 'development',
  outdir = path.join(PROJECT_ROOT, 'dist'),
  entryName = 'all',
  log = true,
  environment = process.env,
} = {}) {
  const profile = resolveDeploymentProfile(profileId, environment);
  const resolvedOutdir = path.resolve(outdir);

  await build({
    entryPoints: resolveEntryPoints(entryName),
    bundle: true,
    format: 'iife',
    target: 'chrome88',
    outdir: resolvedOutdir,
    entryNames: '[name]',
    define: {
      __ECHOMEM_DEPLOYMENT_PROFILE__: JSON.stringify(profile.id),
      __ECHOMEM_DEPLOYMENT_LABEL__: JSON.stringify(profile.label),
      __ECHOMEM_DEFAULT_BASE_URL__: JSON.stringify(profile.defaultBaseUrl),
    },
  });

  if (log) {
    console.log(`Built EchoMem extension (${profile.label}) into ${resolvedOutdir}`);
  }

  return { outdir: resolvedOutdir, profile };
}

async function main() {
  const args = process.argv.slice(2);
  const profileId = readOption(args, 'profile', 'development');
  const outdir = readOption(args, 'outdir', path.join(PROJECT_ROOT, 'dist'));
  const entryName = readOption(args, 'entry', 'all');
  await buildExtension({ profileId, outdir, entryName });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
