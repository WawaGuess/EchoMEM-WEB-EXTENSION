import test from 'node:test';
import assert from 'node:assert/strict';

import { commitSelectedSuggestions } from '../src/panels/association/suggestions.js';

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles === true;
  }
}

test('contenteditable confirmation preserves the existing prompt when inserting memories', () => {
  const events = [];
  const control = {
    tagName: 'DIV',
    isContentEditable: true,
    innerText: '原始提示\n第二行',
    textContent: '原始提示第二行',
    ownerDocument: { defaultView: { Event: FakeEvent } },
    dispatchEvent(event) { events.push(event); return true; },
    focus() {},
  };

  const committed = commitSelectedSuggestions(control, [{
    key: 'memory-click-confirm',
    item: { insertText: '需要追加的记忆' },
  }]);

  assert.equal(committed, true);
  assert.equal(
    control.textContent,
    '原始提示\n第二行\n\n<relevant-memories>\n1. 需要追加的记忆\n</relevant-memories>'
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'input');
});
