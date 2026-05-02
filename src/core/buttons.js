// 按钮注入逻辑

import { detectPlatform, getCurrentPlatform, setCurrentPlatform } from './detection.js';
import { openEchoMemHomePanel } from './router.js';

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
  const launcherConfig = config.launcher || config.buttonBar;
  if (!launcherConfig) return;

  if (document.querySelector('.claw-echomem-launcher-bar')) return;

  const inputContainers = document.querySelectorAll(launcherConfig.containerSelector);

  for (const container of inputContainers) {
    if (container.dataset.clawLauncherAdded) continue;

    let isValidContainer = true;
    for (const [key, selector] of Object.entries(launcherConfig.validateSelectors || {})) {
      if (!container.querySelector(selector)) {
        isValidContainer = false;
        break;
      }
    }

    if (!isValidContainer) continue;

    container.dataset.clawLauncherAdded = 'true';

    const launcherBar = document.createElement('div');
    launcherBar.className = 'claw-echomem-launcher-bar';

    const launcher = document.createElement('button');
    launcher.className = 'claw-echomem-launcher';
    launcher.textContent = launcherConfig.text || 'EchoMem';

    const style = {
      display: 'flex',
      gap: '8px',
      padding: '0 12px 8px',
      background: 'transparent',
      alignItems: 'center',
      justifyContent: 'flex-start',
      ...(launcherConfig.style || {})
    };

    if (launcherConfig.getBackgroundColor && typeof launcherConfig.getBackgroundColor === 'function') {
      try {
        const dynamicBg = launcherConfig.getBackgroundColor();
        if (dynamicBg) {
          style.background = dynamicBg;
        }
      } catch (e) {
        console.log('Claw Extension: getBackgroundColor failed, using default', e);
      }
    }

    launcherBar.style.cssText = Object.entries(style)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      })
      .join('; ');

    launcher.style.cssText = `
      height: 28px;
      padding: 0 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      background: #fff;
      color: #1f2937;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 26px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    `;

    launcher.addEventListener('mouseenter', () => {
      launcher.style.borderColor = '#2563eb';
      launcher.style.color = '#2563eb';
      launcher.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.18)';
    });
    launcher.addEventListener('mouseleave', () => {
      launcher.style.borderColor = 'rgba(0, 0, 0, 0.12)';
      launcher.style.color = '#1f2937';
      launcher.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)';
    });
    launcher.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEchoMemHomePanel();
    });

    launcherBar.appendChild(launcher);

    if (launcherConfig.insertAfter) {
      const insertTarget = document.querySelector(launcherConfig.insertAfter);
      if (insertTarget && insertTarget.parentNode) {
        insertTarget.parentNode.insertBefore(launcherBar, insertTarget.nextSibling);
      } else {
        container.parentNode.insertBefore(launcherBar, container);
      }
    } else if (launcherConfig.insertPosition === 'after') {
      container.parentNode.insertBefore(launcherBar, container.nextSibling);
    } else if (launcherConfig.insertPosition === 'append') {
      container.appendChild(launcherBar);
    } else {
      container.parentNode.insertBefore(launcherBar, container);
    }

    console.log(`Claw Extension: EchoMem launcher added for ${config.name}`);
    break;
  }
}
