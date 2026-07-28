// 按钮注入逻辑

import { detectPlatform, getCurrentPlatform, setCurrentPlatform } from './detection.js';
import { ensureEchoMemOverlayOpen } from './router.js';

function openLauncher(event) {
  event.preventDefault();
  event.stopPropagation();
  ensureEchoMemOverlayOpen();
}

function findHeaderAnchor(headerLauncherConfig) {
  const selectors = headerLauncherConfig.anchorSelectors || [];
  const preferredXRatio = headerLauncherConfig.preferredXRatio ?? 0.75;
  const minXRatio = headerLauncherConfig.minXRatio ?? 0.18;
  const maxXRatio = headerLauncherConfig.maxXRatio ?? 0.94;
  const maxTop = headerLauncherConfig.maxTop ?? 120;
  const candidates = [];

  selectors.forEach((selector, selectorIndex) => {
    document.querySelectorAll(selector).forEach((icon) => {
      const anchor = icon.closest('button, [role="button"]') || icon.parentElement;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const centerXRatio = (rect.left + rect.width / 2) / Math.max(window.innerWidth, 1);
      const isVisible = rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.top < maxTop
        && centerXRatio >= minXRatio
        && centerXRatio <= maxXRatio;

      if (!isVisible) return;

      candidates.push({
        anchor,
        score: selectorIndex * 1000
          + Math.abs(centerXRatio - preferredXRatio) * 100
          + Math.max(rect.top, 0) / 100,
      });
    });
  });

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0]?.anchor || null;
}

function addHeaderLauncher(config) {
  const headerLauncherConfig = config.headerLauncher;
  if (!headerLauncherConfig) return;
  if (document.querySelector('.claw-echomem-header-launcher')) return;

  const anchor = findHeaderAnchor(headerLauncherConfig);
  if (!anchor?.parentNode) return;

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

  anchor.parentNode.insertBefore(launcher, anchor);
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
