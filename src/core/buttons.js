// 按钮注入逻辑

import { detectPlatform, getCurrentPlatform, setCurrentPlatform } from './detection.js';
import { findHeaderLauncherMount, placeHeaderLauncher } from './header-launcher.js';
import { ensureEchoMemOverlayOpen } from './router.js';

function openLauncher(event) {
  event.preventDefault();
  event.stopPropagation();
  ensureEchoMemOverlayOpen();
}

function addHeaderLauncher(config) {
  const headerLauncherConfig = config.headerLauncher;
  if (!headerLauncherConfig) return;

  const mount = findHeaderLauncherMount(headerLauncherConfig);
  if (!mount?.container) return;

  const existingLauncher = document.querySelector('.claw-echomem-header-launcher');
  if (existingLauncher) {
    placeHeaderLauncher(existingLauncher, mount);
    return;
  }

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'claw-echomem-header-launcher';
  launcher.title = headerLauncherConfig.title || '打开 EchoMem';
  launcher.setAttribute('aria-label', launcher.title);

  const logo = document.createElement('img');
  logo.className = 'claw-echomem-header-logo';
  logo.src = chrome.runtime.getURL(
    headerLauncherConfig.logo || 'assets/echomem-lockup.png'
  );
  logo.alt = '';
  launcher.appendChild(logo);
  launcher.addEventListener('click', openLauncher);

  placeHeaderLauncher(launcher, mount);
  console.log(`Claw Extension: EchoMem header launcher added for ${config.name}`);
}

function removeLegacyInputLauncher() {
  document.querySelectorAll('.claw-echomem-launcher-bar').forEach((launcher) => launcher.remove());
}

export function addCustomButtons() {
  let platform = getCurrentPlatform();
  if (!platform) {
    const detected = detectPlatform();
    if (detected) {
      setCurrentPlatform(detected);
      platform = detected;
      console.log('Claw Extension: Platform detected -', platform.config.name);
    } else {
      return;
    }
  }

  const config = platform.config;
  removeLegacyInputLauncher();
  addHeaderLauncher(config);
}
