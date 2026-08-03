import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '../src/services/echomem-client.js';

function installChromeResponse(response, requests) {
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage(request, callback) {
        requests.push(request);
        callback(response);
      },
    },
  };
}

test('listSkillVersions encodes the name and sends authenticated GET', async () => {
  const requests = [];
  installChromeResponse({
    success: true,
    data: { status: 'ok', result: { current_version: 2, versions: [] } },
  }, requests);

  const client = createClient({ baseUrl: 'http://127.0.0.1:8010', authKey: 'test-key', debug: false });
  const result = await client.listSkillVersions('demo/中文');

  assert.equal(result.current_version, 2);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].url, 'http://127.0.0.1:8010/api/skills/demo%2F%E4%B8%AD%E6%96%87/versions');
  assert.deepEqual(requests[0].headers, { 'X-Auth-Key': 'test-key' });
});

test('readSkillVersion encodes the name and validates the version before sending a request', async () => {
  const requests = [];
  installChromeResponse({ success: true, data: { text: 'content' } }, requests);
  const client = createClient({ baseUrl: 'http://127.0.0.1:8010', debug: false });

  await assert.rejects(() => client.readSkillVersion('demo', 0), /positive integer/);
  await assert.rejects(() => client.readSkillVersion('demo', 1.5), /positive integer/);
  assert.equal(requests.length, 0);

  await client.readSkillVersion('demo/中文', 2);
  assert.equal(requests[0].url, 'http://127.0.0.1:8010/api/skills/demo%2F%E4%B8%AD%E6%96%87/versions/2');
});

test('rollbackSkillVersion sends JSON and returns the unwrapped result', async () => {
  const requests = [];
  installChromeResponse({
    success: true,
    data: { status: 'ok', result: { version: 1, rolled_back: true } },
  }, requests);

  const client = createClient({ baseUrl: 'http://127.0.0.1:8010', authKey: 'test-key', debug: false });
  const result = await client.rollbackSkillVersion('demo/中文', 1);

  assert.equal(result.rolled_back, true);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, 'http://127.0.0.1:8010/api/skills/demo%2F%E4%B8%AD%E6%96%87/rollback');
  assert.deepEqual(requests[0].headers, {
    'X-Auth-Key': 'test-key',
    'Content-Type': 'application/json',
  });
  assert.equal(requests[0].body, JSON.stringify({ version: 1 }));

  await assert.rejects(() => client.rollbackSkillVersion('demo', -1), /positive integer/);
  assert.equal(requests.length, 1);
});

test('EchoMem client errors retain HTTP status and payload', async () => {
  const requests = [];
  const payload = { message: 'not found' };
  installChromeResponse({
    success: false,
    status: 404,
    error: 'not found',
    data: payload,
  }, requests);

  const client = createClient({ baseUrl: 'http://127.0.0.1:8010', debug: false });

  await assert.rejects(
    () => client.listSkillVersions('demo'),
    error => error.message === 'not found' && error.status === 404 && error.payload === payload,
  );
  assert.equal(requests.length, 1);
});

test('EchoMem error envelopes retain response status and payload', async () => {
  const requests = [];
  const payload = { status: 'error', message: 'denied' };
  installChromeResponse({
    success: true,
    status: 403,
    data: payload,
  }, requests);

  const client = createClient({ baseUrl: 'http://127.0.0.1:8010', debug: false });

  await assert.rejects(
    () => client.listSkillVersions('demo'),
    error => error.message === 'denied' && error.status === 403 && error.payload === payload,
  );
});
