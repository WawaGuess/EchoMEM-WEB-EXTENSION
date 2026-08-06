import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  matchesAllowedHostname,
  matchesPathnamePrefixes,
} from '../src/core/location-matcher.mjs';

const platformData = JSON.parse(
  readFileSync(new URL('../src/config/platforms.json', import.meta.url), 'utf8')
);
const higoDetection = platformData.platforms.find((platform) => platform.id === 'higo')?.detection;

assert(higoDetection, 'HIGO detection config must exist');

function getFeatureSelector(feature) {
  return typeof feature === 'string' ? feature : feature?.selector;
}

function matchesConfiguredDom(domFeatures, presentSelectors) {
  const requiredMatch = (domFeatures.required || []).every((feature) =>
    presentSelectors.has(getFeatureSelector(feature))
  );
  const optional = domFeatures.optional || [];
  const optionalMatch = optional.length === 0 || optional.some((feature) =>
    presentSelectors.has(getFeatureSelector(feature))
  );
  return requiredMatch && optionalMatch;
}

function matchesHigoLocation(urlString) {
  const url = new URL(urlString);
  return matchesAllowedHostname(url.hostname, higoDetection.hostnames)
    && matchesPathnamePrefixes(url.pathname, higoDetection.pathnamePrefixes);
}

const matchingUrls = [
  'http://localhost:31010/home',
  'http://localhost:31010/home/',
  'http://127.0.0.1:31010/home/session',
  'http://7.250.106.74:31010/home/session/session-123',
  'http://192.168.1.100:31010/home/workspace/workspace-123',
  'https://echo-agent.online/home/session/session-123',
  'https://www.echo-agent.online/home/',
  'https://higo.world/home/workspace/workspace-123',
];

const rejectedUrls = [
  'http://localhost:31010/homepage',
  'http://localhost:31010/search?redirect=/home',
  'http://localhost:31010/#/home',
  'https://example.com/home',
  'https://higo.world.example.com/home',
  'https://sub.higo.world/home',
  'https://sub.www.echo-agent.online/home',
];

for (const url of matchingUrls) {
  assert.equal(matchesHigoLocation(url), true, `expected HIGO location match: ${url}`);
}

for (const url of rejectedUrls) {
  assert.equal(matchesHigoLocation(url), false, `expected HIGO location rejection: ${url}`);
}

const directWorkspaceDom = new Set([
  "[data-testid='WorkspacesOutlinedIcon']",
]);

assert.equal(
  matchesConfiguredDom(higoDetection.domFeatures, directWorkspaceDom),
  true,
  'expected the first direct /home/workspace render to satisfy HIGO DOM detection'
);

assert.equal(
  matchesConfiguredDom(higoDetection.domFeatures, new Set([
    '.MuiDrawer-root',
    '.MuiPaper-root',
  ])),
  false,
  'expected generic MUI containers alone not to identify HIGO'
);

assert.equal(
  matchesConfiguredDom(higoDetection.domFeatures, new Set([
    "[data-testid='MenuOpenIcon']",
  ])),
  true,
  'expected the EchoAgent title bar marker to identify HIGO after initial render'
);

assert.equal('titleKeywords' in higoDetection, false, 'HIGO title must not be a hard gate');
assert.equal('contentKeywords' in higoDetection, false, 'HIGO body text must not be a hard gate');

console.log('HIGO platform location and semantic DOM checks passed');
