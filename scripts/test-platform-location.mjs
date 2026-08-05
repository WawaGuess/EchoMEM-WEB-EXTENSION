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

console.log('HIGO platform location checks passed');
