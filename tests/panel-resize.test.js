import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSidePanelWidth,
  clampSidePanelWidth,
  getKeyboardSidePanelWidth,
  getSidePanelResponsiveState,
  getSidePanelWidthForViewport,
  getSidePanelWidthBounds,
  shouldHandleSidePanelWindowResize,
} from '../src/core/panel-resize.js';

test('side panel width bounds keep the panel usable without covering the viewport', () => {
  assert.deepEqual(getSidePanelWidthBounds(1200), {
    minWidth: 320,
    maxWidth: 840,
  });
  assert.deepEqual(getSidePanelWidthBounds(1920), {
    minWidth: 320,
    maxWidth: 960,
  });
  assert.deepEqual(getSidePanelWidthBounds(300), {
    minWidth: 300,
    maxWidth: 300,
  });
});

test('dragging the inner edge resizes right and left panels in the expected direction', () => {
  assert.equal(calculateSidePanelWidth({
    position: 'right',
    startWidth: 400,
    startX: 800,
    currentX: 600,
    viewportWidth: 1200,
  }), 600);
  assert.equal(calculateSidePanelWidth({
    position: 'left',
    startWidth: 400,
    startX: 400,
    currentX: 600,
    viewportWidth: 1200,
  }), 600);
});

test('dragging and restored widths are clamped to the supported range', () => {
  assert.equal(clampSidePanelWidth(120, 1200), 320);
  assert.equal(clampSidePanelWidth(1200, 1200), 840);
  assert.equal(clampSidePanelWidth(640, 1200), 640);
});

test('responsive side panel states follow the panel width instead of the viewport', () => {
  assert.deepEqual(getSidePanelResponsiveState(360), {
    isCompact: true,
    isNarrow: true,
  });
  assert.deepEqual(getSidePanelResponsiveState(361), {
    isCompact: true,
    isNarrow: false,
  });
  assert.deepEqual(getSidePanelResponsiveState(480), {
    isCompact: true,
    isNarrow: false,
  });
  assert.deepEqual(getSidePanelResponsiveState(481), {
    isCompact: false,
    isNarrow: false,
  });
});

test('keyboard resizing follows the visual movement of the panel edge', () => {
  assert.equal(getKeyboardSidePanelWidth({
    position: 'right',
    currentWidth: 400,
    key: 'ArrowLeft',
    viewportWidth: 1200,
  }), 416);
  assert.equal(getKeyboardSidePanelWidth({
    position: 'left',
    currentWidth: 400,
    key: 'ArrowRight',
    shiftKey: true,
    viewportWidth: 1200,
  }), 432);
  assert.equal(getKeyboardSidePanelWidth({
    position: 'right',
    currentWidth: 400,
    key: 'End',
    viewportWidth: 1200,
  }), 840);
  assert.equal(getKeyboardSidePanelWidth({
    position: 'right',
    currentWidth: 400,
    key: 'Enter',
    viewportWidth: 1200,
  }), null);
});

test('hidden side panels keep their width while a center overlay is open', () => {
  assert.equal(shouldHandleSidePanelWindowResize({
    isConnected: true,
    display: 'none',
  }), false);
  assert.equal(shouldHandleSidePanelWindowResize({
    isConnected: false,
    display: '',
  }), false);
  assert.equal(shouldHandleSidePanelWindowResize({
    isConnected: true,
    display: '',
  }), true);
});

test('restored side panels clamp the preferred width to the current viewport', () => {
  assert.equal(getSidePanelWidthForViewport({
    preferredWidth: 840,
    currentWidth: 500,
    viewportWidth: 500,
  }), 350);
  assert.equal(getSidePanelWidthForViewport({
    preferredWidth: 840,
    currentWidth: 350,
    viewportWidth: 1200,
  }), 840);
  assert.equal(getSidePanelWidthForViewport({
    preferredWidth: null,
    currentWidth: 500,
    viewportWidth: 500,
  }), 350);
});
