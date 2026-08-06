function isVisibleNearTop(rect, maxTop) {
  return rect.width > 0
    && rect.height > 0
    && rect.bottom > 0
    && rect.top < maxTop;
}

function isInteractiveElement(element) {
  return Boolean(element?.matches?.(
    'button, [role="button"], a[href], input, select, textarea'
  ));
}

function findHeaderRow(element, config, environment) {
  const { documentObject, windowObject, getStyle } = environment;
  const maxTop = config.maxTop ?? 120;
  const maxHeaderHeight = config.maxHeaderHeight ?? 96;
  const minHeaderWidth = Math.min(
    config.minHeaderWidth ?? 320,
    Math.max(windowObject.innerWidth, 1) * 0.6
  );
  const minHeaderChildren = config.minHeaderChildren ?? 3;
  let current = element.closest?.('button, [role="button"]') || element;

  while (current?.parentElement
    && current.parentElement !== documentObject.body
    && current.parentElement !== documentObject.documentElement) {
    const container = current.parentElement;
    const rect = container.getBoundingClientRect();
    const display = getStyle(container).display;
    const isHeaderLayout = display === 'flex'
      || display === 'inline-flex'
      || display === 'grid';

    if (isHeaderLayout
      && isVisibleNearTop(rect, maxTop)
      && rect.width >= minHeaderWidth
      && rect.height <= maxHeaderHeight
      && container.children.length >= minHeaderChildren) {
      const rightRegion = container.lastElementChild;
      const reference = isInteractiveElement(rightRegion) ? container : rightRegion;
      return {
        container,
        reference,
        controlRoot: rightRegion,
        placement: 'overlay-before-reference',
        controlGap: config.controlGap ?? 4,
        rect,
      };
    }

    current = container;
  }

  return null;
}

function findConfiguredHeaderMount(config, environment) {
  const selectors = config.containerAnchorSelectors || [];
  const candidates = [];

  selectors.forEach((selector, selectorIndex) => {
    environment.documentObject.querySelectorAll(selector).forEach((element) => {
      const mount = findHeaderRow(element, config, environment);
      if (!mount) return;

      candidates.push({
        ...mount,
        score: selectorIndex * 1000
          + Math.max(mount.rect.top, 0) * 10
          - mount.rect.width / Math.max(environment.windowObject.innerWidth, 1),
      });
    });
  });

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0] || null;
}

function findLegacyAnchorMount(config, environment) {
  const selectors = config.anchorSelectors || [];
  const preferredXRatio = config.preferredXRatio ?? 0.75;
  const minXRatio = config.minXRatio ?? 0.18;
  const maxXRatio = config.maxXRatio ?? 0.94;
  const maxTop = config.maxTop ?? 120;
  const candidates = [];

  selectors.forEach((selector, selectorIndex) => {
    environment.documentObject.querySelectorAll(selector).forEach((icon) => {
      const anchor = icon.closest('button, [role="button"]') || icon.parentElement;
      if (!anchor?.parentNode) return;

      const rect = anchor.getBoundingClientRect();
      const centerXRatio = (rect.left + rect.width / 2)
        / Math.max(environment.windowObject.innerWidth, 1);
      const isVisible = isVisibleNearTop(rect, maxTop)
        && centerXRatio >= minXRatio
        && centerXRatio <= maxXRatio;

      if (!isVisible) return;

      candidates.push({
        container: anchor.parentNode,
        reference: anchor,
        placement: 'flow-before-reference',
        score: selectorIndex * 1000
          + Math.abs(centerXRatio - preferredXRatio) * 100
          + Math.max(rect.top, 0) / 100,
      });
    });
  });

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0] || null;
}

export function findHeaderLauncherMount(config, overrides = {}) {
  const documentObject = overrides.documentObject || document;
  const windowObject = overrides.windowObject || window;
  const getStyle = overrides.getStyle || getComputedStyle;
  const environment = { documentObject, windowObject, getStyle };

  return findConfiguredHeaderMount(config, environment)
    || findLegacyAnchorMount(config, environment);
}

export function placeHeaderLauncher(launcher, mount, overrides = {}) {
  const getStyle = overrides.getStyle || getComputedStyle;
  const reference = mount?.reference;

  if (mount?.placement === 'overlay-before-reference'
    && reference?.insertBefore
    && reference.classList) {
    if (getStyle(reference).position === 'static') {
      reference.classList.add('claw-echomem-header-launcher-anchor');
    }
    launcher.classList.add('claw-echomem-header-launcher--anchored');
    const referenceRect = reference.getBoundingClientRect();
    const controlRoot = mount.controlRoot || reference;
    const controls = [
      ...(isInteractiveElement(controlRoot) ? [controlRoot] : []),
      ...Array.from(controlRoot.querySelectorAll?.('button, [role="button"]') || []),
    ];
    const firstControl = controls.find((control) => {
      if (control === launcher) return false;
      const rect = control.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const rightOffset = firstControl
      ? Math.max(
        referenceRect.right - firstControl.getBoundingClientRect().left + mount.controlGap,
        0
      )
      : 0;
    launcher.style.setProperty('--echomem-header-launcher-right', `${rightOffset}px`);
    if (launcher.parentNode !== reference || reference.firstElementChild !== launcher) {
      reference.insertBefore(launcher, reference.firstElementChild || null);
    }
    return;
  }

  launcher.classList.remove('claw-echomem-header-launcher--anchored');
  const isAlreadyPlaced = launcher.parentNode === mount.container
    && (reference
      ? launcher.nextElementSibling === reference
      : launcher === mount.container.lastElementChild);
  if (!isAlreadyPlaced) {
    mount.container.insertBefore(launcher, reference || null);
  }
}
