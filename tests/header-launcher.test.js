import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findHeaderLauncherMount,
  placeHeaderLauncher,
} from '../src/core/header-launcher.js';

class FakeElement {
  constructor(name, rect, display = 'block', role = '') {
    this.name = name;
    this.rect = rect;
    this.display = display;
    this.role = role;
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.insertBeforeCalls = 0;
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
    };
    this.styleValues = new Map();
    this.style = {
      setProperty: (name, value) => this.styleValues.set(name, value),
    };
  }

  append(...children) {
    children.forEach((child) => {
      child.parentElement = this;
      child.parentNode = this;
      this.children.push(child);
    });
  }

  insertBefore(child, reference) {
    this.insertBeforeCalls += 1;
    if (child === reference) return;
    if (child.parentElement) {
      child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
    }
    const index = reference ? this.children.indexOf(reference) : -1;
    child.parentElement = this;
    child.parentNode = this;
    if (index >= 0) {
      this.children.splice(index, 0, child);
    } else {
      this.children.push(child);
    }
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (selector.includes('button') && current.role === 'button') return current;
      if (selector.includes('[role="button"]') && current.role === 'button') return current;
      current = current.parentElement;
    }
    return null;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      element.children.forEach((child) => {
        if ((selector.includes('button') || selector.includes('[role="button"]'))
          && child.role === 'button') {
          matches.push(child);
        }
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  get lastElementChild() {
    return this.children[this.children.length - 1] || null;
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] || null;
  }
}

function rect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function createEnvironment(selectorMap, width = 2048) {
  const body = new FakeElement('body', rect(0, 0, width, 1080));
  const documentElement = new FakeElement('html', rect(0, 0, width, 1080));
  const documentObject = {
    body,
    documentElement,
    querySelectorAll: (selector) => selectorMap.get(selector) || [],
  };

  return {
    documentObject,
    windowObject: { innerWidth: width },
    getStyle: (element) => ({ display: element.display, position: 'static' }),
  };
}

const config = {
  containerAnchorSelectors: [
    '[data-testid="MenuOpenIcon"]',
    '.MuiTypography-h6',
  ],
  anchorSelectors: [
    '[data-testid="ShareOutlinedIcon"]',
    '[data-testid="ChevronRightIcon"]',
  ],
  minHeaderWidth: 320,
  maxHeaderHeight: 96,
  maxTop: 120,
};

test('mounts before the workspace title bar placeholder instead of a stray chevron', () => {
  const titleBar = new FakeElement('title-bar', rect(223, 0, 1825, 64), 'flex');
  const leftButton = new FakeElement('left-button', rect(239, 12, 40, 40), 'inline-flex', 'button');
  const menuIcon = new FakeElement('menu-icon', rect(247, 20, 24, 24));
  const title = new FakeElement('title', rect(279, 0, 1713, 64));
  const placeholder = new FakeElement('right-placeholder', rect(1992, 12, 40, 40));
  leftButton.append(menuIcon);
  titleBar.append(leftButton, title, placeholder);

  const strayContainer = new FakeElement('stray-container', rect(1960, 4, 40, 48), 'flex');
  const strayButton = new FakeElement('stray-button', rect(1960, 8, 40, 40), 'inline-flex', 'button');
  const strayChevron = new FakeElement('stray-chevron', rect(1968, 16, 24, 24));
  strayButton.append(strayChevron);
  strayContainer.append(strayButton);

  const selectorMap = new Map([
    ['[data-testid="MenuOpenIcon"]', [menuIcon]],
    ['.MuiTypography-h6', []],
    ['[data-testid="ShareOutlinedIcon"]', []],
    ['[data-testid="ChevronRightIcon"]', [strayChevron]],
  ]);

  const mount = findHeaderLauncherMount(config, createEnvironment(selectorMap));
  const launcher = new FakeElement('launcher', rect(0, 0, 104, 36), 'inline-flex', 'button');
  placeHeaderLauncher(launcher, mount, { getStyle: () => ({ position: 'static' }) });

  assert.equal(mount.container, titleBar);
  assert.equal(mount.reference, placeholder);
  assert.equal(mount.placement, 'overlay-before-reference');
  assert.equal(titleBar.children.length, 3);
  assert.equal(placeholder.firstElementChild, launcher);
  assert.equal(placeholder.classes.has('claw-echomem-header-launcher-anchor'), true);
  assert.equal(launcher.classes.has('claw-echomem-header-launcher--anchored'), true);
  assert.equal(launcher.styleValues.get('--echomem-header-launcher-right'), '0px');

  placeHeaderLauncher(launcher, mount, { getStyle: () => ({ position: 'relative' }) });
  assert.equal(placeholder.insertBeforeCalls, 1);
});

test('uses the title element when the left title bar toggle is hidden', () => {
  const titleBar = new FakeElement('title-bar', rect(64, 0, 1984, 64), 'flex');
  const leftPlaceholder = new FakeElement('left-placeholder', rect(80, 12, 40, 40));
  const titleBox = new FakeElement('title-box', rect(120, 0, 1856, 64));
  const titleRow = new FakeElement('title-row', rect(700, 18, 696, 28), 'flex');
  const heading = new FakeElement('heading', rect(900, 18, 296, 28));
  const rightControls = new FakeElement('right-controls', rect(1976, 8, 56, 48), 'flex');
  const chevronButton = new FakeElement(
    'chevron-button',
    rect(1984, 12, 40, 40),
    'inline-flex',
    'button'
  );
  titleRow.append(heading);
  titleBox.append(titleRow);
  rightControls.append(chevronButton);
  titleBar.append(leftPlaceholder, titleBox, rightControls);

  const selectorMap = new Map([
    ['[data-testid="MenuOpenIcon"]', []],
    ['.MuiTypography-h6', [heading]],
    ['[data-testid="ShareOutlinedIcon"]', []],
    ['[data-testid="ChevronRightIcon"]', []],
  ]);

  const mount = findHeaderLauncherMount(config, createEnvironment(selectorMap));
  const launcher = new FakeElement('launcher', rect(0, 0, 104, 36), 'inline-flex', 'button');
  placeHeaderLauncher(launcher, mount, { getStyle: () => ({ position: 'static' }) });

  assert.equal(mount.container, titleBar);
  assert.equal(mount.reference, rightControls);
  assert.equal(mount.placement, 'overlay-before-reference');
  assert.equal(titleBar.children.length, 3);
  assert.equal(rightControls.firstElementChild, launcher);
  assert.equal(launcher.styleValues.get('--echomem-header-launcher-right'), '52px');

  chevronButton.rect = rect(1968, 12, 40, 40);
  placeHeaderLauncher(launcher, mount, { getStyle: () => ({ position: 'relative' }) });
  assert.equal(launcher.styleValues.get('--echomem-header-launcher-right'), '68px');
  assert.equal(rightControls.insertBeforeCalls, 1);
});

test('keeps the legacy action-anchor fallback when no title bar marker exists', () => {
  const actionGroup = new FakeElement('action-group', rect(1400, 8, 180, 48), 'flex');
  const shareButton = new FakeElement('share-button', rect(1480, 12, 40, 40), 'inline-flex', 'button');
  const shareIcon = new FakeElement('share-icon', rect(1488, 20, 24, 24));
  shareButton.append(shareIcon);
  actionGroup.append(shareButton);

  const selectorMap = new Map([
    ['[data-testid="MenuOpenIcon"]', []],
    ['.MuiTypography-h6', []],
    ['[data-testid="ShareOutlinedIcon"]', [shareIcon]],
    ['[data-testid="ChevronRightIcon"]', []],
  ]);

  const mount = findHeaderLauncherMount(config, createEnvironment(selectorMap));
  const launcher = new FakeElement('launcher', rect(0, 0, 104, 36), 'inline-flex', 'button');
  placeHeaderLauncher(launcher, mount, { getStyle: () => ({ position: 'static' }) });

  assert.equal(mount.container, actionGroup);
  assert.equal(mount.reference, shareButton);
  assert.equal(mount.placement, 'flow-before-reference');
  assert.deepEqual(actionGroup.children, [launcher, shareButton]);
  assert.equal(launcher.classes.has('claw-echomem-header-launcher--anchored'), false);

  placeHeaderLauncher(launcher, mount, { getStyle: () => ({ position: 'static' }) });
  assert.equal(actionGroup.insertBeforeCalls, 1);
});
