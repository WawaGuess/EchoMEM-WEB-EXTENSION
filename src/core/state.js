const state = {
  platform: null,
  association: {
    enabled: false
  },
  panel: {
    isOpen: false,
    currentRoute: null
  }
};

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
  return state.association.enabled;
}

export function setPanelOpen(isOpen) {
  state.panel.isOpen = isOpen;
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
