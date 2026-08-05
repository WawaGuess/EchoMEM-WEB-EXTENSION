import { composePlainTextInsertion } from './text-insertion.js';

export function isTextControl(control) {
  const tagName = String(control?.tagName || '').toUpperCase();
  return tagName === 'TEXTAREA' || tagName === 'INPUT';
}

export function isContentEditableControl(control) {
  if (!control) return false;
  if (control.isContentEditable === true) return true;
  return control.getAttribute?.('contenteditable') === 'true';
}

export function readEditableText(control) {
  if (isTextControl(control)) return String(control.value ?? '');
  if (isContentEditableControl(control)) return String(control.textContent ?? '');
  return '';
}

function setTextControlValue(control, value) {
  const view = control.ownerDocument?.defaultView;
  const prototype = String(control.tagName || '').toUpperCase() === 'TEXTAREA'
    ? view?.HTMLTextAreaElement?.prototype
    : view?.HTMLInputElement?.prototype;
  const nativeSetter = prototype
    ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    : null;

  if (nativeSetter) nativeSetter.call(control, value);
  else control.value = value;
}

function createInputEvent(control, data = null, inputType = 'insertText') {
  const view = control.ownerDocument?.defaultView;
  if (view?.InputEvent) {
    try {
      return new view.InputEvent('input', { bubbles: true, inputType, data });
    } catch (_) {
      // Fall back to Event for older Chromium builds.
    }
  }
  const EventConstructor = view?.Event || Event;
  return new EventConstructor('input', { bubbles: true });
}

export function dispatchEditableInput(control, options = {}) {
  control.dispatchEvent(createInputEvent(control, options.data, options.inputType));
}

function placeContentEditableCaret(control, offset) {
  const documentRef = control.ownerDocument;
  const view = documentRef?.defaultView;
  if (!documentRef?.createRange || !view?.getSelection) return;

  const range = documentRef.createRange();
  const textNode = control.firstChild;
  if (textNode?.nodeType === 3) {
    range.setStart(textNode, Math.min(offset, textNode.textContent?.length || 0));
  } else {
    range.selectNodeContents(control);
    range.collapse(false);
  }
  range.collapse(true);

  const selection = view.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function setEditableText(control, value, options = {}) {
  if (!control) return false;
  const text = String(value ?? '');
  const cursor = Number.isInteger(options.cursor) ? options.cursor : text.length;

  if (isTextControl(control)) {
    setTextControlValue(control, text);
    try {
      control.selectionStart = control.selectionEnd = cursor;
    } catch (_) {
      // Some controlled inputs do not expose selection offsets.
    }
  } else if (isContentEditableControl(control)) {
    control.textContent = text;
    placeContentEditableCaret(control, cursor);
  } else {
    return false;
  }

  if (options.dispatch !== false) {
    dispatchEditableInput(control, {
      data: options.data ?? text,
      inputType: options.inputType || 'insertText',
    });
  }
  if (options.focus !== false) control.focus?.();
  return true;
}

function isRangeWithin(control, range) {
  if (!range) return false;
  const contains = node => node === control || control.contains?.(node);
  return contains(range.startContainer) && contains(range.endContainer);
}

function createEndRange(control) {
  const range = control.ownerDocument?.createRange?.();
  if (!range) return null;
  range.selectNodeContents(control);
  range.collapse(false);
  return range;
}

function textAroundRange(control, range) {
  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(control);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(control);
  afterRange.setStart(range.endContainer, range.endOffset);

  return { before: beforeRange.toString(), after: afterRange.toString() };
}

function insertIntoContentEditable(control, content, options = {}) {
  const cleanContent = String(content ?? '').trim();
  if (!cleanContent) return false;

  const documentRef = control.ownerDocument;
  const view = documentRef?.defaultView;
  const selection = view?.getSelection?.();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const range = isRangeWithin(control, selectedRange)
    ? selectedRange.cloneRange()
    : createEndRange(control);

  if (!range || !documentRef?.createTextNode) {
    const result = composePlainTextInsertion(readEditableText(control), cleanContent);
    return result
      ? setEditableText(control, result.value, {
        ...options,
        cursor: result.cursor,
        data: cleanContent,
      })
      : false;
  }

  const { before, after } = textAroundRange(control, range);
  const prefix = before && !/\s$/.test(before) ? ' ' : '';
  const suffix = after && /^\s/.test(after) ? '' : ' ';
  const inserted = `${prefix}${cleanContent}${suffix}`;

  if (options.focus !== false) control.focus?.();
  range.deleteContents();
  const textNode = documentRef.createTextNode(inserted);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);

  dispatchEditableInput(control, { data: inserted, inputType: 'insertText' });
  return true;
}

export function insertEditableText(control, content, options = {}) {
  if (isContentEditableControl(control)) {
    return insertIntoContentEditable(control, content, options);
  }
  if (!isTextControl(control)) return false;

  const result = composePlainTextInsertion(
    readEditableText(control),
    content,
    control.selectionStart,
    control.selectionEnd
  );
  return result
    ? setEditableText(control, result.value, {
      ...options,
      cursor: result.cursor,
      data: String(content ?? '').trim(),
    })
    : false;
}
