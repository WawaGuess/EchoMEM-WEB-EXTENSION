const VIEW_ORDER = ['timeline', 'summary'];

export function getOptionalFeedbackViews() {
  const registry = globalThis.__ECHOMEM_FEEDBACK_VIEWS__;
  if (!(registry instanceof Map)) return [];
  return VIEW_ORDER.map((key) => registry.get(key)).filter(Boolean);
}
