import test from 'node:test';
import assert from 'node:assert/strict';

import { login } from '../src/services/openview-client.js';

function createChromeHarness() {
  let respondToLogin = null;
  const storageWrites = [];

  return {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(request, callback) {
          assert.equal(request.action, 'openViewRequest');
          respondToLogin = callback;
        },
      },
      storage: {
        local: {
          async set(value) {
            storageWrites.push(value);
          },
        },
      },
    },
    respond(payload) {
      assert.ok(respondToLogin, 'login request should be pending');
      respondToLogin({
        success: true,
        status: 200,
        data: payload,
        text: JSON.stringify(payload),
      });
    },
    storageWrites,
  };
}

test('login does not persist stale auth when credentials change during the request', async () => {
  const originalChrome = globalThis.chrome;
  const harness = createChromeHarness();
  globalThis.chrome = harness.chrome;

  try {
    let revision = 1;
    const pendingLogin = login({
      baseUrl: 'http://127.0.0.1:31020',
      username: 'old-user',
      password: 'old-password',
    }, {
      shouldPersistAuth: () => revision === 1,
    });

    revision += 1;
    harness.respond({
      code: 0,
      data: {
        csrfToken: 'old-csrf-token',
        user: { username: 'old-user' },
      },
    });

    const auth = await pendingLogin;
    assert.equal(auth.user.username, 'old-user');
    assert.deepEqual(harness.storageWrites, []);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('login keeps persisting auth when the request revision is current', async () => {
  const originalChrome = globalThis.chrome;
  const harness = createChromeHarness();
  globalThis.chrome = harness.chrome;

  try {
    const pendingLogin = login({
      baseUrl: 'http://127.0.0.1:31020',
      username: 'current-user',
      password: 'current-password',
    }, {
      shouldPersistAuth: () => true,
    });

    harness.respond({
      code: 0,
      data: {
        csrfToken: 'current-csrf-token',
        user: { username: 'current-user' },
      },
    });

    await pendingLogin;
    assert.equal(harness.storageWrites.length, 1);
    assert.equal(
      harness.storageWrites[0].openviewAuth.user.username,
      'current-user'
    );
  } finally {
    globalThis.chrome = originalChrome;
  }
});
