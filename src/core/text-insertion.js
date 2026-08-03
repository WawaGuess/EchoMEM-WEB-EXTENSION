export function composePlainTextInsertion(existingValue, content, selectionStart, selectionEnd) {
  const existing = String(existingValue ?? '');
  const cleanContent = String(content ?? '').trim();
  if (!cleanContent) return null;

  const clamp = value => Math.max(0, Math.min(existing.length, value));
  const start = Number.isInteger(selectionStart) ? clamp(selectionStart) : existing.length;
  const end = Number.isInteger(selectionEnd) ? clamp(selectionEnd) : start;
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const before = existing.slice(0, from);
  const after = existing.slice(to);
  const prefix = before && !/\s$/.test(before) ? ' ' : '';
  const suffix = after && /^\s/.test(after) ? '' : ' ';
  const inserted = `${prefix}${cleanContent}${suffix}`;

  return {
    value: `${before}${inserted}${after}`,
    cursor: before.length + inserted.length,
  };
}
