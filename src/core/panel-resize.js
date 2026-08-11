export const SIDE_PANEL_MIN_WIDTH_PX = 320;
export const SIDE_PANEL_MAX_WIDTH_PX = 960;
export const SIDE_PANEL_MAX_VIEWPORT_RATIO = 0.7;
export const SIDE_PANEL_KEYBOARD_STEP_PX = 16;

function normalizeViewportWidth(viewportWidth) {
  return Number.isFinite(viewportWidth) && viewportWidth > 0
    ? viewportWidth
    : SIDE_PANEL_MIN_WIDTH_PX;
}

export function getSidePanelWidthBounds(viewportWidth) {
  const safeViewportWidth = normalizeViewportWidth(viewportWidth);
  const minWidth = Math.min(SIDE_PANEL_MIN_WIDTH_PX, safeViewportWidth);
  const responsiveMaxWidth = Math.floor(
    safeViewportWidth * SIDE_PANEL_MAX_VIEWPORT_RATIO
  );
  const maxWidth = Math.max(
    minWidth,
    Math.min(SIDE_PANEL_MAX_WIDTH_PX, responsiveMaxWidth, safeViewportWidth)
  );

  return { minWidth, maxWidth };
}

export function clampSidePanelWidth(width, viewportWidth) {
  const { minWidth, maxWidth } = getSidePanelWidthBounds(viewportWidth);
  const numericWidth = Number(width);

  if (!Number.isFinite(numericWidth)) return minWidth;
  return Math.min(maxWidth, Math.max(minWidth, numericWidth));
}

export function calculateSidePanelWidth({
  position,
  startWidth,
  startX,
  currentX,
  viewportWidth,
}) {
  const pointerDelta = position === 'left'
    ? currentX - startX
    : startX - currentX;

  return clampSidePanelWidth(startWidth + pointerDelta, viewportWidth);
}

export function getKeyboardSidePanelWidth({
  position,
  currentWidth,
  key,
  shiftKey = false,
  viewportWidth,
}) {
  const { minWidth, maxWidth } = getSidePanelWidthBounds(viewportWidth);
  if (key === 'Home') return minWidth;
  if (key === 'End') return maxWidth;

  const step = SIDE_PANEL_KEYBOARD_STEP_PX * (shiftKey ? 2 : 1);
  let delta = 0;

  if (key === 'ArrowLeft') {
    delta = position === 'left' ? -step : step;
  } else if (key === 'ArrowRight') {
    delta = position === 'left' ? step : -step;
  } else {
    return null;
  }

  return clampSidePanelWidth(currentWidth + delta, viewportWidth);
}
