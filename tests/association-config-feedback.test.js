import test from 'node:test';
import assert from 'node:assert/strict';

import { getInputAssociationContent } from '../src/panels/association/index.js';

test('association advanced config renders an inline save status region', () => {
  const content = getInputAssociationContent();

  assert.match(content, /id="ov-save-config-label"/);
  assert.match(content, /id="ov-config-status"/);
  assert.match(content, /id="ov-config-status-title"/);
  assert.match(content, /id="ov-config-status-detail"/);
  assert.match(content, /role="status"/);
});
