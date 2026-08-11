const DEFAULT_STATE = {
  platform: null,
  association: {
    enabled: false,
    triggerThreshold: 3,
    debounceMs: 300,
    maxSuggestions: 5,
  },
  panel: {
    isOpen: false,
    currentRoute: null,
    width: null
  }
};

let state = { ...DEFAULT_STATE };
let initialized = false;

export async function initState() {
  if (initialized) return;
  try {
    const result = await chrome.storage.local.get('echomemState');
    if (result.echomemState) {
      const saved = result.echomemState;
      state = {
        ...DEFAULT_STATE,
        ...saved,
        panel: {
          ...DEFAULT_STATE.panel,
          ...(saved.panel || {})
        },
        platform: null  // 平台需要每次重新检测，不持久化
      };
    }
  } catch (err) {
    console.warn('EchoMem: failed to load state', err);
  }
  initialized = true;
}

function persistState() {
  try {
    chrome.storage.local.set({ echomemState: state });
  } catch (err) {
    console.warn('EchoMem: failed to persist state', err);
  }
}

export function getState() {
  return state;
}

export function getPlatform() {
  return state.platform;
}

export function setPlatform(platform) {
  state.platform = platform;
}

export function getAssociationEnabled() {
  return state.association.enabled;
}

export function toggleAssociationEnabled() {
  state.association.enabled = !state.association.enabled;
  persistState();
  return state.association.enabled;
}

export function setPanelOpen(isOpen) {
  state.panel.isOpen = isOpen;
}

export function getPanelWidth() {
  return Number.isFinite(state.panel.width) ? state.panel.width : null;
}

export function setPanelWidth(width) {
  if (!Number.isFinite(width)) return;
  state.panel.width = Math.round(width);
  persistState();
}

export function isPanelOpenState() {
  return state.panel.isOpen;
}

export function setCurrentRoute(route) {
  state.panel.currentRoute = route;
}

export function getCurrentRoute() {
  return state.panel.currentRoute;
}
