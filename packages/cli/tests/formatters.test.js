import test from 'node:test';
import assert from 'node:assert/strict';
import { formatResult } from '../src/index.js';

const sampleResult = {
  repo_name: 'octo/demo',
  repo_url: 'https://github.com/octo/demo',
  repo_path: null,
  verdict: 'AI-Native',
  score: 75,
  per_assistant: [
    {
      name: 'GitHub Copilot',
      score: 100,
      primitives: [
        {
          name: 'Instruction Files',
          category: 'instructions',
          detected: true,
          matched_files: ['.github/copilot-instructions.md'],
        },
      ],
    },
    {
      name: 'Claude Code',
      score: 25,
      primitives: [
        {
          name: 'Instruction Files',
          category: 'instructions',
          detected: false,
          matched_files: [],
        },
      ],
    },
  ],
  primitives: [
    {
      name: 'Instruction Files',
      category: 'instructions',
      detected: true,
      matched_files: ['.github/copilot-instructions.md'],
    },
  ],
};

test('formatResult renders human output', () => {
  const output = formatResult(sampleResult, 'human');
  assert.match(output, /Preferred Agent: GitHub Copilot/);
  assert.match(output, /Readiness Score: 100% \(AI-Native\)/);
  assert.match(output, /- Claude Code: 25%/);
  assert.match(output, /GitHub Copilot \(preferred agent\): 100% \(AI-Native\)/);
  assert.match(output, /Claude Code: 25% \(Traditional\)/);
});

test('formatResult renders csv output', () => {
  const output = formatResult(sampleResult, 'csv');
  assert.match(output, /repo_name,repo_url,repo_path/);
  assert.match(output, /octo\/demo/);
});

test('formatResult renders summary output', () => {
  const output = formatResult({ ...sampleResult, branch: 'main' }, 'summary');
  assert.equal(output, 'octo/demo: 100% (AI-Native) [preferred: GitHub Copilot] @ main');
});