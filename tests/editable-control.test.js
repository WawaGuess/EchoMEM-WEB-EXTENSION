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
