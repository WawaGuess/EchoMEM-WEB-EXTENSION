import test from 'node:test';
import assert from 'node:assert/strict';

import {
  insertEditableText,
  isContentEditableControl,
  isTextControl,
  readEditableText,
  setEditableText,
} from '../src/core/editable-control.js';

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles === true;
  }
}

function createBaseControl(overrides = {}) {
  const events = [];
  let focused = false;
  const control = {
    ownerDocument: { defaultView: { Event: FakeEvent } },
    dispatchEvent(event) { events.push(event); return true; },
    focus() { focused = true; },
    ...overrides,
  };
  return { control, events, wasFocused: () => focused };
}

function createStructuredContentEditable() {
  const events = [];
  let focused = false;
  let caret = null;
  const selection = {
    removeAllRanges() {},
    addRange(range) { caret = range.caret; },
  };
  const createTextNode = text => ({ nodeType: 3, textContent: text });
  const createElement = tagName => ({ nodeType: 1, tagName: tagName.toUpperCase() });
  const documentRef = {
    defaultView: {
      Event: FakeEvent,
      getSelection: () => selection,
    },
    createTextNode,
    createElement,
    createRange() {
      return {
        caret: null,
        setStart(node, offset) { this.caret = { placement: 'text', node, offset }; },
        setStartBefore(node) { this.caret = { placement: 'before', node }; },
        setStartAfter(node) { this.caret = { placement: 'after', node }; },
        selectNodeContents(node) { this.caret = { placement: 'contents', node }; },
        collapse() {},
      };
    },
  };
  const control = {
    tagName: 'DIV',
    isContentEditable: true,
    ownerDocument: documentRef,
    childNodes: [],
    firstChild: null,
    replaceChildren(...nodes) {
      this.childNodes = nodes;
      this.firstChild = nodes[0] || null;
    },
    dispatchEvent(event) { events.push(event); return true; },
    focus() { focused = true; },
  };
  Object.defineProperties(control, {
    textContent: {
      get() {
        return control.childNodes.map(node => node.nodeType === 3 ? node.textContent : '').join('');
      },
      set(value) {
        control.replaceChildren(...value ? [createTextNode(String(value))] : []);
      },
    },
    innerText: {
      get() {
        return control.childNodes.map(node => node.tagName === 'BR' ? '\n' : node.textContent).join('');
      },
    },
  });
  return {
    control,
    events,
    getCaret: () => caret,
    wasFocused: () => focused,
  };
}

test('editable controls distinguish textarea/input from contenteditable editors', () => {
  assert.equal(isTextControl({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextControl({ tagName: 'input' }), true);
  assert.equal(isTextControl({ tagName: 'DIV' }), false);
  assert.equal(isContentEditableControl({ isContentEditable: true }), true);
  assert.equal(isContentEditableControl({
    getAttribute: name => name === 'contenteditable' ? 'true' : null,
  }), true);
});

test('insertEditableText preserves textarea selection behavior', () => {
  const { control, events, wasFocused } = createBaseControl({
    tagName: 'TEXTAREA',
    value: '已有内容',
    selectionStart: 4,
    selectionEnd: 4,
  });

  assert.equal(insertEditableText(control, '/actual-skill'), true);
  assert.equal(control.value, '已有内容 /actual-skill ');
  assert.equal(control.selectionStart, 19);
  assert.equal(control.selectionEnd, 19);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'input');
  assert.equal(wasFocused(), true);
});

test('contenteditable controls can be read and replaced without using value', () => {
  const { control, events, wasFocused } = createBaseControl({
    tagName: 'DIV',
    isContentEditable: true,
    textContent: '旧内容',
  });

  assert.equal(readEditableText(control), '旧内容');
  assert.equal(setEditableText(control, '/actual-skill '), true);
  assert.equal(control.textContent, '/actual-skill ');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'input');
  assert.equal(wasFocused(), true);
});

test('contenteditable controls preserve visual line breaks when read', () => {
  const { control } = createBaseControl({
    tagName: 'DIV',
    isContentEditable: true,
    innerText: '第一行\r\n第二行\n第三行',
    textContent: '第一行第二行第三行',
  });

  assert.equal(readEditableText(control), '第一行\n第二行\n第三行');
});

test('contenteditable replacement preserves multiline DOM structure and caret', () => {
  const { control, events, getCaret, wasFocused } = createStructuredContentEditable();

  assert.equal(setEditableText(control, '第一行\n\n第三行'), true);
  assert.deepEqual(
    control.childNodes.map(node => node.nodeType === 3 ? `text:${node.textContent}` : node.tagName),
    ['text:第一行', 'BR', 'BR', 'text:第三行']
  );
  assert.equal(readEditableText(control), '第一行\n\n第三行');
  assert.deepEqual(getCaret(), {
    placement: 'text',
    node: control.childNodes[3],
    offset: 3,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'input');
  assert.equal(wasFocused(), true);
});

test('insertEditableText appends to contenteditable when no DOM Range is available', () => {
  const { control, events } = createBaseControl({
    tagName: 'DIV',
    isContentEditable: true,
    textContent: '已有内容',
  });

  assert.equal(insertEditableText(control, '/actual-skill'), true);
  assert.equal(control.textContent, '已有内容 /actual-skill ');
  assert.equal(events.length, 1);
});
