import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './build-extension.mjs';
import {
  RELEASE_PROFILE_IDS,
  resolveDeploymentProfile,
} from './deployment-profiles.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const RELEASE_ROOT = path.join(PROJECT_ROOT, 'release');

const RUNTIME_PATHS = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'content.css',
  'icons',
  'assets',
];

async function copyRuntimePath(relativePath, releaseDirectory) {
  const source = path.join(PROJECT_ROOT, relativePath);
  const destination = path.join(releaseDirectory, relativePath);
  try {
    await fs.access(source);
  } catch {
    return;
  }
  await fs.cp(source, destination, { recursive: true });
}

async function customizeLegacyPopup(releaseDirectory, defaultBaseUrl) {
  const htmlPath = path.join(releaseDirectory, 'popup.html');
  const scriptPath = path.join(releaseDirectory, 'popup.js');

  const html = await fs.readFile(htmlPath, 'utf8');
  await fs.writeFile(
    htmlPath,
    html.replace('value="http://127.0.0.1:8010"', `value="${defaultBaseUrl}"`)
  );

  const script = await fs.readFile(scriptPath, 'utf8');
  await fs.writeFile(
    scriptPath,
    script.replaceAll('http://127.0.0.1:8010', defaultBaseUrl)
  );
}

async function customizeManifest(releaseDirectory, profile) {
  const manifestPath = path.join(releaseDirectory, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.name = `${manifest.name}（${profile.label}）`;
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function createReleaseReadme(profile) {
  const securityNotice = profile.id === 'public' && new URL(profile.defaultBaseUrl).protocol === 'http:'
    ? '\n> 安全提示：当前公网发行地址使用 HTTP。生产环境应迁移至 HTTPS，避免认证密钥在公网链路中明文传输。\n'
    : '';

  return `# EchoMem Web Extension（${profile.label}）

EchoMem 浏览器扩展（${profile.label}加载包）。

- 发行类型：${profile.label}
- 预置 EchoMem 服务地址：\`${profile.defaultBaseUrl}\`
- 用户保存过的服务地址优先于预置值
- 认证密钥仍需用户在配置面板中填写
${securityNotice}

## 安装方法

无需安装 npm，只需要 Chrome 或 Edge 浏览器。

1. 解压本压缩包
2. 打开 Chrome 或 Edge 浏览器，地址栏输入 \`chrome://extensions/\`（Edge 为 \`edge://extensions/\`）
3. 右上角开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的 \`${profile.releaseDirectory}\` 文件夹
6. 扩展图标将出现在浏览器工具栏中

## 使用

在支持的平台页面中点击浏览器工具栏的 EchoMem 图标，即可打开网页 overlay。

HIGO Office 顶部标题栏也提供“图形 + EchoMem”组合标入口；聊天输入框附近不再注入按钮。
`;
}

export async function packageRelease(profileId, { environment = process.env } = {}) {
  const profile = resolveDeploymentProfile(profileId, environment);
  const releaseDirectory = path.join(RELEASE_ROOT, profile.releaseDirectory);

  await fs.rm(releaseDirectory, { recursive: true, force: true });
  await fs.mkdir(releaseDirectory, { recursive: true });

  await Promise.all(
    RUNTIME_PATHS.map((relativePath) => copyRuntimePath(relativePath, releaseDirectory))
  );
  await buildExtension({
    profileId: profile.id,
    outdir: path.join(releaseDirectory, 'dist'),
    environment,
  });
  await customizeManifest(releaseDirectory, profile);
  await customizeLegacyPopup(releaseDirectory, profile.defaultBaseUrl);
  await fs.writeFile(
    path.join(releaseDirectory, 'README.md'),
    createReleaseReadme(profile)
  );

  console.log(`Packaged EchoMem extension: ${releaseDirectory}`);
  return { profile, releaseDirectory };
}

async function main() {
  const requestedProfile = process.argv[2] || 'all';
  const profileIds = requestedProfile === 'all'
    ? RELEASE_PROFILE_IDS
    : [requestedProfile];

  for (const profileId of profileIds) {
    await packageRelease(profileId);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
