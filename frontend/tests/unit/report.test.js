import test from 'node:test';
import assert from 'node:assert/strict';

function installBrowserStubs() {
  const matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  globalThis.window = {
    matchMedia,
    location: {
      origin: 'https://example.com',
      pathname: '/',
      search: '',
    },
  };

  globalThis.document = {
    addEventListener() {},
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });
}

installBrowserStubs();

const { renderPrimitiveRow } = await import('../../src/report.js');

test('renderPrimitiveRow renders missing primitives without disclosure controls', () => {
  const html = renderPrimitiveRow({
    name: 'Prompt Chaining',
    category: 'Orchestration',
    description: 'Compose multiple prompt steps.',
    detected: false,
    matched_files: [],
    doc_links: ['https://example.com/docs'],
  }, 'GitHub Copilot');

  assert.match(html, /primitive-entry primitive-entry-static absent/);
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /primitive-entry-chevron/);
  assert.equal(html.match(/not found/g)?.length ?? 0, 1);
});

test('renderPrimitiveRow keeps disclosure markup when matched files exist', () => {
  const html = renderPrimitiveRow({
    name: 'Instruction Files',
    category: 'Instructions',
    description: 'Project instructions for coding agents.',
    detected: true,
    matched_files: ['.github/copilot-instructions.md'],
    doc_links: ['https://example.com/docs'],
  }, 'GitHub Copilot');

  assert.match(html, /<details class="primitive-entry found" open>/);
  assert.match(html, /primitive-entry-chevron/);
  assert.match(html, /1 file found/);
  assert.match(html, /matched-file-item/);
});