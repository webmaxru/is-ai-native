import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImperativeToolResult,
  buildRepoScanErrorPayload,
  buildRepoScanPayload,
  coerceRepoScanInput,
  createRepoScanToolDefinition,
  getDeclarativeToolName,
  getImperativeToolName,
  registerRepoScanTool,
  resolveModelContext,
  supportsWebMcp,
} from '../../src/webmcp.js';

const sampleResult = {
  repo_name: 'octo/demo',
  repo_url: 'https://github.com/octo/demo',
  score: 72,
  verdict: 'AI-Native',
  scanned_at: '2026-03-13T12:00:00.000Z',
  paths_scanned: 18,
};

test('supportsWebMcp detects document.modelContext and the legacy navigator.modelContext fallback', () => {
  assert.equal(supportsWebMcp({ modelContext: { registerTool() {} } }), true);
  assert.equal(supportsWebMcp({ modelContext: { registerTool() {}, unregisterTool() {} } }), true);
  assert.equal(supportsWebMcp({ modelContext: {} }), false);
  assert.equal(supportsWebMcp({}), false);

  assert.equal(
    resolveModelContext({
      documentLike: { modelContext: { registerTool() {} } },
      navigatorLike: null,
    }) !== null,
    true,
    'prefers document.modelContext when available',
  );
  assert.equal(
    resolveModelContext({
      documentLike: {},
      navigatorLike: { modelContext: { registerTool() {} } },
    }) !== null,
    true,
    'falls back to navigator.modelContext for the current Chrome preview',
  );
});

test('registerRepoScanTool registers via document.modelContext with an AbortSignal and unregisters when called', () => {
  let registeredTool = null;
  let registeredOptions = null;
  let aborted = false;
  const documentLike = {
    modelContext: {
      registerTool(tool, options) {
        registeredTool = tool;
        registeredOptions = options;
        options?.signal?.addEventListener?.('abort', () => {
          aborted = true;
        });
      },
    },
  };

  const unregister = registerRepoScanTool({
    executeScan: async () => sampleResult,
    documentLike,
    navigatorLike: null,
  });

  assert.equal(registeredTool?.name, getImperativeToolName());
  assert.ok(registeredOptions?.signal, 'passes an AbortSignal via ModelContextRegisterToolOptions');
  assert.equal(registeredOptions.signal.aborted, false);

  unregister();
  assert.equal(aborted, true, 'aborts the registration signal during teardown');
});

test('registerRepoScanTool falls back to navigator.modelContext.unregisterTool for the legacy preview', () => {
  const calls = [];
  const navigatorLike = {
    modelContext: {
      registerTool(tool) {
        calls.push({ type: 'register', name: tool.name });
      },
      unregisterTool(name) {
        calls.push({ type: 'unregister', name });
      },
    },
  };

  const unregister = registerRepoScanTool({
    executeScan: async () => sampleResult,
    documentLike: {},
    navigatorLike,
  });

  // Initial cleanup call + registration.
  assert.deepEqual(calls.shift(), { type: 'unregister', name: getImperativeToolName() });
  assert.deepEqual(calls.shift(), { type: 'register', name: getImperativeToolName() });

  unregister();
  assert.deepEqual(calls.pop(), { type: 'unregister', name: getImperativeToolName() });
});

test('coerceRepoScanInput accepts supported aliases', () => {
  assert.equal(coerceRepoScanInput('  owner/repo  '), 'owner/repo');
  assert.equal(coerceRepoScanInput({ repo_url: 'owner/repo' }), 'owner/repo');
  assert.equal(coerceRepoScanInput({ repository: 'https://github.com/octo/demo' }), 'https://github.com/octo/demo');
  assert.equal(coerceRepoScanInput({ repo: 'octo/demo' }), 'octo/demo');
  assert.equal(coerceRepoScanInput(null), '');
});

test('buildRepoScanPayload returns structured tool data', () => {
  const payload = buildRepoScanPayload(sampleResult);
  assert.equal(payload.ok, true);
  assert.equal(payload.repo_name, 'octo/demo');
  assert.equal(payload.score, 72);
  assert.match(payload.summary, /Scanned octo\/demo/);
});

test('buildRepoScanErrorPayload returns descriptive tool errors', () => {
  const payload = buildRepoScanErrorPayload(new Error('Bad repo input'), 'broken');
  assert.deepEqual(payload, {
    ok: false,
    repo_url: 'broken',
    error: {
      message: 'Bad repo input',
    },
  });
});

test('buildImperativeToolResult includes summary and JSON payload text', () => {
  const response = buildImperativeToolResult(sampleResult);
  assert.equal(response.content.length, 2);
  assert.equal(response.content[0].type, 'text');
  assert.match(response.content[0].text, /Verdict: AI-Native/);
  assert.match(response.content[1].text, /"repo_name": "octo\/demo"/);
});

test('createRepoScanToolDefinition validates input and executes scans', async () => {
  const tool = createRepoScanToolDefinition(async (repoUrl) => ({
    ...sampleResult,
    repo_name: repoUrl,
  }));

  assert.equal(tool.name, getImperativeToolName());
  assert.deepEqual(tool.inputSchema.required, ['repo_url']);

  const result = await tool.execute({ repo_url: 'microsoft/vscode' });
  assert.match(result.content[0].text, /microsoft\/vscode/);

  await assert.rejects(() => tool.execute({}), /repo_url is required/);
});

test('tool names stay stable for imperative and declarative implementations', () => {
  assert.equal(getImperativeToolName(), 'scan_repository');
  assert.equal(getDeclarativeToolName(), 'scan_repository_form');
});