import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { detectPlatformMultiLayer } from '../src/core/detection-matcher.mjs';

const platformData = JSON.parse(
  readFileSync(new URL('../src/config/platforms.json', import.meta.url), 'utf8')
);
const higoDetection = platformData.platforms.find((platform) => platform.id === 'higo')?.detection;

function detectHigo({
  url,
  title = '',
  bodyText = '',
  presentSelectors = [],
}) {
  const location = new URL(url);
  const present = new Set(presentSelectors);
  return detectPlatformMultiLayer(higoDetection, {
    windowObject: { location },
    documentObject: {
      title,
      body: { innerText: bodyText },
      querySelector: (selector) => (present.has(selector) ? { selector } : null),
    },
    logger: { log() {} },
  });
}

test('trusted HIGO hosts pass immediately before the title bar DOM renders', () => {
  assert.equal(detectHigo({
    url: 'https://echo-agent.online/home/workspace',
  }), true);

  assert.equal(detectHigo({
    url: 'https://echo.cn-north-5.myhuaweicloud.com/home',
    title: 'Echo Agent',
  }), true);
});

test('fallback hosts require both a brand signal and one semantic DOM feature', () => {
  assert.equal(detectHigo({
    url: 'http://localhost:31010/home/workspace',
    title: 'Echo',
    presentSelectors: ["[data-testid='WorkspacesOutlinedIcon']"],
  }), true);

  assert.equal(detectHigo({
    url: 'http://192.168.1.100:31010/home/session',
    bodyText: 'HIGO Office',
    presentSelectors: ["[data-testid='ArrowUpwardIcon']"],
  }), true);

  assert.equal(detectHigo({
    url: 'http://10.0.0.8/home/workspace',
    title: 'Echo Agent',
    presentSelectors: ["[data-testid='MenuOpenIcon']"],
  }), true);
});

test('generic local React pages do not become HIGO from one common selector', () => {
  assert.equal(detectHigo({
    url: 'http://localhost:31010/home',
    title: 'Internal Admin',
    bodyText: 'Dashboard',
    presentSelectors: ["textarea[id^='_r_']"],
  }), false);

  assert.equal(detectHigo({
    url: 'http://10.0.0.8/home',
    title: 'Operations',
    presentSelectors: ["[data-testid='MenuOpenIcon']"],
  }), false);
});

test('fallback hosts reject a brand signal without a semantic DOM feature', () => {
  assert.equal(detectHigo({
    url: 'http://127.0.0.1:31010/home',
    title: 'Echo',
  }), false);
});

test('trusted hosts still reject paths outside the configured home route', () => {
  assert.equal(detectHigo({
    url: 'https://echo-agent.online/homepage',
  }), false);
});

test('single-sided trust lists do not treat an unconfigured hostname as allowed', () => {
  const location = new URL('https://unrelated.example/home');
  const documentObject = {
    title: '',
    body: { innerText: '' },
    querySelector: () => null,
  };

  assert.equal(detectPlatformMultiLayer({
    trustedHostnames: ['echo-agent.online'],
    pathnamePrefixes: ['/home'],
  }, {
    windowObject: { location },
    documentObject,
    logger: { log() {} },
  }), false);
});

test('fallback hosts fail closed when identity rules are missing', () => {
  const location = new URL('http://localhost:31010/home');

  assert.equal(detectPlatformMultiLayer({
    fallbackHostnames: ['localhost'],
    pathnamePrefixes: ['/home'],
  }, {
    windowObject: { location },
    documentObject: {
      title: 'Echo',
      body: { innerText: 'HIGO Office' },
      querySelector: () => ({ selector: 'textarea' }),
    },
    logger: { log() {} },
  }), false);
});
