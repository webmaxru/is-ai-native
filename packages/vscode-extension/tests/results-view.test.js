import test from 'node:test';
import assert from 'node:assert/strict';
import { renderResultsHtml } from '../src/results-view.js';

const sampleResult = {
  repo_name: 'octo/demo',
  repo_url: 'https://github.com/octo/demo',
  branch: 'main',
  source: 'github',
  paths_scanned: 3,
  scanned_at: '2026-03-12T12:00:00.000Z',
  score: 75,
  verdict: 'AI-Native',
  per_assistant: [{ name: 'GitHub Copilot', score: 100 }],
  primitives: [
    {
      name: 'Instruction Files',
      category: 'instructions',
      description: 'Instruction files',
      detected: true,
      matched_files: ['.github/copilot-instructions.md'],
    },
  ],
};

test('renderResultsHtml includes metadata and assistant content', () => {
  const html = renderResultsHtml(sampleResult, { nonce: 'abc123' });
  assert.match(html, /Paths Scanned/);
  assert.match(html, /GitHub Copilot/);
  assert.match(html, /Open repository/);
});

test('renderResultsHtml renders open-file buttons for local scans', () => {
  const html = renderResultsHtml(sampleResult, { canOpenFiles: true, nonce: 'abc123' });
  assert.match(html, /data-open-file="\.github\/copilot-instructions\.md"/);
});