import test from 'node:test';
import assert from 'node:assert/strict';

function installBrowserStubs() {
  const elements = new Map();
  const repoLink = { href: '' };

  const reportElement = {
    _innerHTML: '',
    classList: {
      add() {},
      remove() {},
    },
    querySelector(selector) {
      if (selector === '#repo-link') {
        return repoLink;
      }

      return null;
    },
    set innerHTML(value) {
      this._innerHTML = value;
    },
    get innerHTML() {
      return this._innerHTML;
    },
  };

  elements.set('report', reportElement);
  elements.set('page-heading', { textContent: '' });
  elements.set('topbar-scope', { textContent: '' });

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
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll() {
      return [];
    },
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });

  return {
    elements,
    reportElement,
    repoLink,
  };
}

const browserStubs = installBrowserStubs();

const { getVerdictForScore, renderPrimitiveRow, renderReport, selectPreferredAssistant } = await import('../../src/report.js');

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

test('selectPreferredAssistant returns the highest scoring assistant and keeps first tie', () => {
  const preferred = selectPreferredAssistant({
    per_assistant: [
      { name: 'GitHub Copilot', score: 75, primitives: [] },
      { name: 'Claude Code', score: 75, primitives: [] },
      { name: 'Codex', score: 20, primitives: [] },
    ],
  });

  assert.equal(preferred?.name, 'GitHub Copilot');
  assert.equal(getVerdictForScore(preferred?.score), 'AI-Native');
});

test('renderReport keeps preferred agent summary while retaining all assistant chips and sections', () => {
  browserStubs.elements.get('topbar-scope').textContent = 'check your repo';

  renderReport({
    repo_name: 'octo/demo',
    repo_url: 'https://github.com/octo/demo',
    scanned_at: '2026-03-15T12:00:00.000Z',
    branch: 'main',
    paths_scanned: 42,
    score: 34,
    verdict: 'AI-Native',
    primitives: [
      { name: 'Instruction Files', category: 'Instructions', description: 'Instruction files', detected: true, matched_files: ['.github/copilot-instructions.md'] },
      { name: 'MCP Servers', category: 'Integrations', description: 'MCP servers', detected: true, matched_files: ['mcp.json'] },
      { name: 'Skills', category: 'Agents', description: 'Agent skills', detected: false, matched_files: [] },
    ],
    per_assistant: [
      {
        name: 'GitHub Copilot',
        score: 100,
        primitives: [
          { name: 'Instruction Files', category: 'Instructions', detected: true, matched_files: ['.github/copilot-instructions.md'] },
          { name: 'MCP Servers', category: 'Integrations', detected: true, matched_files: ['mcp.json'] },
        ],
      },
      {
        name: 'Claude Code',
        score: 0,
        primitives: [
          { name: 'Skills', category: 'Agents', detected: false, matched_files: [] },
        ],
      },
    ],
  });

  const html = browserStubs.reportElement.innerHTML;

  assert.match(html, /preferred agent/i);
  assert.match(html, /GitHub Copilot/);
  assert.match(html, /preferred agent score: 100%/);
  assert.match(html, />2\/2</);
  assert.match(html, /AI-NATIVE/);
  assert.match(html, /GitHub Copilot: 100%/);
  assert.match(html, /Claude Code: 0%/);
  assert.match(html, /id="section-github-copilot"/);
  assert.match(html, /id="section-claude-code"/);
  assert.match(html, /<span class="lh-title">Claude Code<\/span>/);
  assert.doesNotMatch(html, />34<span class="si-denom">\/100</);
  assert.equal(browserStubs.repoLink.href, 'https://github.com/octo/demo');
  assert.equal(browserStubs.elements.get('topbar-scope').textContent, 'check your repo');
});