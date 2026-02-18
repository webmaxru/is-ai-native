/**
 * Scan API performance benchmark.
 * Measures scan latency for repos with varying file tree sizes.
 * Validates that all scans complete within the 15s target (SC-001).
 *
 * Usage: node tests/performance/benchmark.js
 * @module benchmark
 */

import { scanRepository } from '../../src/services/scanner.js';

/** Target maximum latency in milliseconds (SC-001) */
const MAX_LATENCY_MS = 15_000;

/**
 * Generates a mock file tree with the specified number of entries.
 * Includes a mix of AI-native primitive files and regular files.
 * @param {number} size - Number of tree entries
 * @returns {Array<{path: string, type: string}>} Mock file tree
 */
function generateFileTree(size) {
  const tree = [];

  // Always include some AI-native files to exercise pattern matching
  const aiFiles = [
    '.github/copilot-instructions.md',
    'CLAUDE.md',
    '.github/prompts/refactor.prompt.md',
    '.github/agents/reviewer.md',
    '.vscode/mcp.json',
    'codex.md',
  ];

  for (const f of aiFiles) {
    tree.push({ path: f, type: 'blob' });
  }

  // Fill the rest with regular files
  for (let i = tree.length; i < size; i++) {
    const depth = Math.floor(Math.random() * 4);
    const dirs = Array.from({ length: depth }, (_, d) => `dir${d}_${i % 50}`);
    const ext = ['.js', '.ts', '.py', '.md', '.json', '.yml'][i % 6];
    const path = [...dirs, `file${i}${ext}`].join('/');
    tree.push({ path, type: i % 20 === 0 ? 'tree' : 'blob' });
  }

  return tree;
}

/**
 * Runs a benchmark for a given file tree size.
 * @param {number} size - Number of files in the tree
 * @returns {{size: number, durationMs: number, pass: boolean}} Benchmark result
 */
function runBenchmark(size) {
  const tree = generateFileTree(size);

  const start = performance.now();
  scanRepository(tree);
  const durationMs = Math.round(performance.now() - start);

  return {
    size,
    durationMs,
    pass: durationMs <= MAX_LATENCY_MS,
  };
}

// Run benchmarks
console.log('AI-Native Readiness Checker — Performance Benchmark');
console.log('='.repeat(55));
console.log(`Target: ≤ ${MAX_LATENCY_MS}ms per scan\n`);

const sizes = [100, 1_000, 10_000];
const results = [];

for (const size of sizes) {
  const result = runBenchmark(size);
  results.push(result);

  const status = result.pass ? 'PASS' : 'FAIL';
  const icon = result.pass ? '✓' : '✗';
  console.log(`${icon} ${size.toLocaleString()} files: ${result.durationMs}ms [${status}]`);
}

console.log('\n' + '='.repeat(55));

const allPass = results.every((r) => r.pass);
if (allPass) {
  console.log('All benchmarks PASSED.');
} else {
  console.log('Some benchmarks FAILED — exceeds 15s target.');
  process.exit(1);
}
