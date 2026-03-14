import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRepoPathname,
  getRepoFromPath,
  normalizeRepoInputValue,
  normalizeRepoReference,
  syncRepoPathInBrowser,
} from '../../src/repo-location.js';

test('normalizeRepoReference returns owner/repo for short form and full URL', () => {
  assert.equal(normalizeRepoReference('octo/demo'), 'octo/demo');
  assert.equal(normalizeRepoReference('https://github.com/octo/demo'), 'octo/demo');
  assert.equal(normalizeRepoReference('http://github.com/octo/demo.git'), 'octo/demo');
});

test('normalizeRepoReference rejects unsupported GitHub URL variants', () => {
  assert.equal(normalizeRepoReference('https://github.com/octo/demo/tree/main'), null);
  assert.equal(normalizeRepoReference('https://github.com/octo/demo?tab=readme'), null);
  assert.equal(normalizeRepoReference('https://www.github.com/octo/demo'), null);
});

test('normalizeRepoInputValue canonicalizes valid GitHub URLs for the visible input', () => {
  assert.equal(normalizeRepoInputValue(' https://github.com/microsoft/skills '), 'microsoft/skills');
  assert.equal(normalizeRepoInputValue('microsoft/skills'), 'microsoft/skills');
  assert.equal(normalizeRepoInputValue('not a repo'), 'not a repo');
});

test('getRepoFromPath decodes and validates owner/repo routes', () => {
  assert.equal(getRepoFromPath('/octo/demo'), 'octo/demo');
  assert.equal(getRepoFromPath('/octo/demo/'), 'octo/demo');
  assert.equal(getRepoFromPath('/octo/demo/issues'), null);
});

test('buildRepoPathname encodes route segments', () => {
  assert.equal(buildRepoPathname('octo/demo'), '/octo/demo');
  assert.equal(buildRepoPathname('bad input'), null);
});

test('syncRepoPathInBrowser pushes a repo route without navigation', () => {
  const calls = [];
  const location = {
    href: 'https://example.com/?repo=octo/demo#section',
    origin: 'https://example.com',
    pathname: '/',
    search: '?repo=octo/demo',
    hash: '#section',
  };
  const history = {
    state: { from: 'test' },
    pushState(state, unusedTitle, url) {
      calls.push({ state, unusedTitle, url: String(url) });
    },
  };

  const changed = syncRepoPathInBrowser('https://github.com/octo/demo', { location, history });

  assert.equal(changed, true);
  assert.deepEqual(calls, [
    {
      state: { from: 'test' },
      unusedTitle: '',
      url: 'https://example.com/octo/demo',
    },
  ]);
});

test('syncRepoPathInBrowser is a no-op when already on the repo route', () => {
  const history = {
    pushState() {
      throw new Error('pushState should not be called');
    },
  };

  const changed = syncRepoPathInBrowser('octo/demo', {
    location: {
      href: 'https://example.com/octo/demo',
      origin: 'https://example.com',
      pathname: '/octo/demo',
      search: '',
      hash: '',
    },
    history,
  });

  assert.equal(changed, false);
});