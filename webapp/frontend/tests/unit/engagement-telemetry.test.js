import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyScanSource,
  getTrackedLinkTelemetry,
  normalizeTelemetryText,
} from '../../src/engagement-telemetry.js';

test('classifyScanSource prioritizes agent and auto triggers before manual flows', () => {
  assert.equal(classifyScanSource({ agentInvoked: true }), 'webmcp_form');
  assert.equal(classifyScanSource({ autoPath: true }), 'path_autoscan');
  assert.equal(classifyScanSource({ autoQuery: true }), 'query_autoscan');
  assert.equal(classifyScanSource({ hasPriorScan: true }), 'rescan_form');
  assert.equal(classifyScanSource({}), 'landing_form');
});

test('normalizeTelemetryText trims and collapses whitespace', () => {
  assert.equal(normalizeTelemetryText('  install   VS Code   extension  '), 'install VS Code extension');
});

test('getTrackedLinkTelemetry returns outbound metadata for marked CTA links', () => {
  const payload = getTrackedLinkTelemetry(
    {
      href: 'https://github.com/webmaxru/gh-is-ai-native',
      textContent: ' GitHub CLI extension ',
      dataset: {
        ctaSource: 'landing-install-gh-extension',
        ctaName: 'install-gh-extension',
        ctaType: 'install-link',
      },
    },
    {
      origin: 'https://isainative.dev',
      pathname: '/',
    }
  );

  assert.deepEqual(payload, {
    href: 'https://github.com/webmaxru/gh-is-ai-native',
    host: 'github.com',
    source: 'landing-install-gh-extension',
    ctaName: 'install-gh-extension',
    ctaType: 'install-link',
    docKind: '',
    assistantName: '',
    primitiveName: '',
    pagePath: '/',
    linkText: 'GitHub CLI extension',
  });
});

test('getTrackedLinkTelemetry ignores same-origin and unmarked links', () => {
  assert.equal(
    getTrackedLinkTelemetry(
      {
        href: 'https://isainative.dev/about',
        textContent: 'About',
        dataset: {
          ctaSource: 'site-nav',
        },
      },
      {
        origin: 'https://isainative.dev',
        pathname: '/',
      }
    ),
    null
  );

  assert.equal(
    getTrackedLinkTelemetry(
      {
        href: 'https://example.com/docs',
        textContent: 'Docs',
        dataset: {},
      },
      {
        origin: 'https://isainative.dev',
        pathname: '/',
      }
    ),
    null
  );
});