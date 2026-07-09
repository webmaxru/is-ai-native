import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPO_SCAN_INPUT_SCHEMA,
  REPO_SCAN_RESULT_SCHEMA,
  TOOL_CATALOG_INPUT_SCHEMA,
  TOOL_CATALOG_RESULT_SCHEMA,
  buildListToolsResult,
  buildRepoScanErrorPayload,
  buildRepoScanPayload,
  buildToolCatalogPayload,
  createListToolsToolDefinition,
  getDeclarativeToolName,
  getImperativeToolName,
  getToolSurfaces,
  registerListToolsTool,
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

test('registerListToolsTool registers via document.modelContext with an AbortSignal and unregisters when called', () => {
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

  const unregister = registerListToolsTool({
    documentLike,
    navigatorLike: null,
  });

  assert.equal(registeredTool?.name, getImperativeToolName());
  assert.equal(registeredTool?.annotations?.readOnlyHint, true);
  assert.ok(registeredTool?.outputSchema, 'registers an outputSchema so agents can anticipate the result');
  assert.ok(registeredOptions?.signal, 'passes an AbortSignal via ModelContextRegisterToolOptions');
  assert.equal(registeredOptions.signal.aborted, false);

  unregister();
  assert.equal(aborted, true, 'aborts the registration signal during teardown');
});

test('registerListToolsTool falls back to navigator.modelContext.unregisterTool for the legacy preview', () => {
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

  const unregister = registerListToolsTool({
    documentLike: {},
    navigatorLike,
  });

  // Initial cleanup call + registration.
  assert.deepEqual(calls.shift(), { type: 'unregister', name: getImperativeToolName() });
  assert.deepEqual(calls.shift(), { type: 'register', name: getImperativeToolName() });

  unregister();
  assert.deepEqual(calls.pop(), { type: 'unregister', name: getImperativeToolName() });
});

test('buildRepoScanPayload returns structured tool data with the success result keys', () => {
  const payload = buildRepoScanPayload(sampleResult);
  assert.equal(payload.ok, true);
  assert.equal(payload.repo_name, 'octo/demo');
  assert.equal(payload.score, 72);
  assert.match(payload.summary, /Scanned octo\/demo/);

  const successVariant = REPO_SCAN_RESULT_SCHEMA.oneOf.find(
    (variant) => variant.title === 'RepositoryScanSuccess',
  );
  for (const key of successVariant.required) {
    assert.ok(key in payload, `payload includes required key ${key}`);
  }
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

test('getToolSurfaces describes both tools with input and result schemas', () => {
  const surfaces = getToolSurfaces();
  const byName = Object.fromEntries(surfaces.map((surface) => [surface.name, surface]));

  assert.ok(byName[getDeclarativeToolName()], 'includes the declarative scan tool');
  assert.ok(byName[getImperativeToolName()], 'includes the imperative list-tools tool');

  assert.equal(byName[getDeclarativeToolName()].invocation, 'declarative-form');
  assert.equal(byName[getImperativeToolName()].invocation, 'imperative');

  for (const surface of surfaces) {
    assert.equal(typeof surface.description, 'string');
    assert.ok(surface.input_schema && typeof surface.input_schema === 'object', `${surface.name} has an input schema`);
    assert.ok(surface.output_schema && typeof surface.output_schema === 'object', `${surface.name} has a result schema`);
  }

  assert.equal(byName[getDeclarativeToolName()].output_schema, REPO_SCAN_RESULT_SCHEMA);
  assert.equal(byName[getImperativeToolName()].output_schema, TOOL_CATALOG_RESULT_SCHEMA);
});

test('buildToolCatalogPayload summarizes the exposed tools', () => {
  const payload = buildToolCatalogPayload();
  assert.equal(payload.ok, true);
  assert.equal(payload.tool_count, payload.tools.length);
  assert.equal(payload.tool_count, 2);
  assert.match(payload.summary, /scan_repository_form/);
  assert.match(payload.summary, /list_available_tools/);
});

test('buildListToolsResult includes a summary, JSON payload text, and structuredContent', () => {
  const response = buildListToolsResult();
  assert.equal(response.content.length, 2);
  assert.equal(response.content[0].type, 'text');
  assert.match(response.content[1].text, /"tools"/);
  assert.ok(response.structuredContent, 'includes structuredContent matching the result schema');
  assert.equal(response.structuredContent.tool_count, 2);
});

test('createListToolsToolDefinition declares schemas and executes to the catalog', async () => {
  const tool = createListToolsToolDefinition();

  assert.equal(tool.name, getImperativeToolName());
  assert.equal(tool.inputSchema, TOOL_CATALOG_INPUT_SCHEMA);
  assert.equal(tool.outputSchema, TOOL_CATALOG_RESULT_SCHEMA);
  assert.equal(tool.annotations.readOnlyHint, true);

  const result = await tool.execute({});
  assert.ok(result.structuredContent, 'execute returns structuredContent');
  assert.equal(result.structuredContent.tool_count, 2);
  assert.match(result.content[0].text, /WebMCP tools/);
});

test('result schemas are serializable JSON Schema objects', () => {
  for (const schema of [
    REPO_SCAN_INPUT_SCHEMA,
    REPO_SCAN_RESULT_SCHEMA,
    TOOL_CATALOG_INPUT_SCHEMA,
    TOOL_CATALOG_RESULT_SCHEMA,
  ]) {
    assert.doesNotThrow(() => JSON.stringify(schema));
    assert.equal(typeof schema, 'object');
  }
});

test('tool names stay stable for imperative and declarative implementations', () => {
  assert.equal(getImperativeToolName(), 'list_available_tools');
  assert.equal(getDeclarativeToolName(), 'scan_repository_form');
});