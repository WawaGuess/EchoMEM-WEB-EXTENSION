// 按钮注入逻辑

import { detectPlatform, getCurrentPlatform, setCurrentPlatform } from './detection.js';
import { openCustomPanel } from './panel.js';
import { getPanelContent } from '../panels/index.js';

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
  const bbConfig = config.buttonBar;

  const inputContainers = document.querySelectorAll(bbConfig.containerSelector);

  for (const container of inputContainers) {
    if (container.dataset.clawButtonsAdded) continue;

    let isValidContainer = true;
    for (const [key, selector] of Object.entries(bbConfig.validateSelectors)) {
      if (!container.querySelector(selector)) {
        isValidContainer = false;
        break;
      }
    }

    if (!isValidContainer) continue;

    container.dataset.clawButtonsAdded = 'true';

    const buttonBar = document.createElement('div');
    buttonBar.className = 'claw-custom-buttons';

    const style = { ...bbConfig.style };

    if (bbConfig.getBackgroundColor && typeof bbConfig.getBackgroundColor === 'function') {
      try {
        const dynamicBg = bbConfig.getBackgroundColor();
        if (dynamicBg) {
          style.background = dynamicBg;
        }
      } catch (e) {
        console.log('Claw Extension: getBackgroundColor failed, using default', e);
      }
    }

    buttonBar.style.cssText = Object.entries(style)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      })
      .join('; ');

    const buttons = config.buttons.map(btn => ({
      text: btn.text,
      action: () => openCustomPanel(btn.panel, getPanelContent(btn.panel))
    }));

    buttons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.textContent = btnConfig.text;
      btn.style.cssText = `
        padding: 4px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background: #fff;
        color: #333;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        ${btnConfig.style || ''}
      `;
      btn.addEventListener('mouseenter', () => {
        if (!btnConfig.style) {
          btn.style.background = '#667eea';
          btn.style.color = '#fff';
          btn.style.borderColor = '#667eea';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (!btnConfig.style) {
          btn.style.background = '#fff';
          btn.style.color = '#333';
          btn.style.borderColor = '#e0e0e0';
        }
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnConfig.action();
      });
      buttonBar.appendChild(btn);
    });

    if (bbConfig.insertAfter) {
      const insertTarget = document.querySelector(bbConfig.insertAfter);
      if (insertTarget && insertTarget.parentNode) {
        insertTarget.parentNode.insertBefore(buttonBar, insertTarget.nextSibling);
      } else {
        container.parentNode.insertBefore(buttonBar, container.nextSibling);
      }
    } else if (bbConfig.insertPosition === 'after') {
      container.parentNode.insertBefore(buttonBar, container.nextSibling);
    } else if (bbConfig.insertPosition === 'before') {
      container.parentNode.insertBefore(buttonBar, container);
    } else if (bbConfig.insertPosition === 'append') {
      container.appendChild(buttonBar);
    }

    console.log(`Claw Extension: Custom buttons added for ${config.name}`);
    break;
  }
}
