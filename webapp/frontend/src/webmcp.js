const IMPERATIVE_TOOL_NAME = 'list_available_tools';
const DECLARATIVE_TOOL_NAME = 'scan_repository_form';

function getLocationHref() {
  try {
    return globalThis.location?.href || null;
  } catch {
    return null;
  }
}

// Per the current WebMCP spec, `modelContext` lives on `Document`. The current
// Chrome preview still exposes it on `Navigator`, so we accept either host and
// prefer the spec-aligned `document.modelContext` when present.
export function resolveModelContext({
  documentLike = globalThis.document,
  navigatorLike = globalThis.navigator,
} = {}) {
  const candidates = [documentLike?.modelContext, navigatorLike?.modelContext];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.registerTool === 'function') {
      return candidate;
    }
  }
  return null;
}

export function supportsWebMcp(host = undefined) {
  // Back-compat: when called with a single object that has `modelContext`,
  // treat it as either a document-like or navigator-like host.
  if (host && typeof host === 'object' && 'modelContext' in host) {
    return resolveModelContext({ documentLike: host, navigatorLike: host }) !== null;
  }
  return resolveModelContext() !== null;
}

// --- Shared JSON Schemas ---------------------------------------------------
// The WebMCP `ModelContextTool` dictionary only defines `inputSchema`, so the
// result schemas below are published as MCP-aligned `outputSchema` metadata.
// Browsers ignore unknown tool-definition members, and the imperative
// `list_available_tools` tool surfaces these schemas to agents so they can
// anticipate each tool's output structure before calling it.

// Input accepted by the declarative repository scan form tool.
export const REPO_SCAN_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    repo_url: {
      type: 'string',
      description:
        'GitHub repository to scan. Accept either owner/repository or a full https://github.com/owner/repository URL.',
    },
  },
  required: ['repo_url'],
};

// Structured result produced by the repository scan form tool. Inspect `ok` to
// tell the success and error variants apart.
export const REPO_SCAN_RESULT_SCHEMA = {
  type: 'object',
  description:
    'Result of a repository scan. Inspect `ok` to tell the success and error shapes apart.',
  oneOf: [
    {
      title: 'RepositoryScanSuccess',
      type: 'object',
      additionalProperties: false,
      required: [
        'ok',
        'repo_name',
        'repo_url',
        'score',
        'verdict',
        'scanned_at',
        'paths_scanned',
        'summary',
      ],
      properties: {
        ok: { type: 'boolean', enum: [true] },
        repo_name: { type: 'string', description: 'Canonical owner/repository that was scanned.' },
        repo_url: { type: 'string', description: 'Full GitHub URL of the scanned repository.' },
        score: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'AI-native readiness score out of 100.',
        },
        verdict: {
          type: 'string',
          enum: ['AI-Native', 'AI-Assisted', 'Traditional'],
          description: 'Overall classification derived from the score.',
        },
        scanned_at: {
          type: 'string',
          format: 'date-time',
          description: 'ISO-8601 timestamp of when the scan completed.',
        },
        paths_scanned: {
          type: 'integer',
          minimum: 0,
          description: 'Number of repository paths inspected during the scan.',
        },
        report_url: {
          type: ['string', 'null'],
          description: 'URL of the visible report that was updated, when available.',
        },
        summary: {
          type: 'string',
          description: 'One-line human-readable summary of the verdict and score.',
        },
      },
    },
    {
      title: 'RepositoryScanError',
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'error'],
      properties: {
        ok: { type: 'boolean', enum: [false] },
        repo_url: { type: 'string', description: 'Repository input that failed to scan.' },
        error: {
          type: 'object',
          additionalProperties: false,
          required: ['message'],
          properties: {
            message: { type: 'string', description: 'Corrective, human-readable error message.' },
          },
        },
      },
    },
  ],
};

// `list_available_tools` takes no arguments.
export const TOOL_CATALOG_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

// Structured result produced by the `list_available_tools` tool.
export const TOOL_CATALOG_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'page_url', 'tool_count', 'tools', 'summary'],
  properties: {
    ok: { type: 'boolean', enum: [true] },
    page_url: {
      type: ['string', 'null'],
      description: 'URL of the page whose tools are described.',
    },
    tool_count: {
      type: 'integer',
      minimum: 0,
      description: 'Number of tools currently exposed by this page.',
    },
    tools: {
      type: 'array',
      description: 'Every WebMCP tool this page exposes to agents.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'title',
          'description',
          'invocation',
          'read_only',
          'input_schema',
          'output_schema',
        ],
        properties: {
          name: { type: 'string', description: 'Unique identifier used when calling the tool.' },
          title: { type: 'string', description: 'Human-readable label for the tool.' },
          description: {
            type: 'string',
            description: 'What the tool does and when to use it.',
          },
          invocation: {
            type: 'string',
            enum: ['imperative', 'declarative-form'],
            description: 'How the tool is registered and invoked.',
          },
          read_only: {
            type: 'boolean',
            description: 'True when the tool does not modify page state.',
          },
          input_schema: {
            type: 'object',
            description: 'JSON Schema describing the tool input.',
          },
          output_schema: {
            type: 'object',
            description: 'JSON Schema describing the tool result.',
          },
        },
      },
    },
    summary: {
      type: 'string',
      description: 'One-line human-readable summary of the available tools.',
    },
  },
};

// --- Declarative repository scan payloads ----------------------------------
export function buildRepoScanPayload(result) {
  return {
    ok: true,
    repo_name: result.repo_name,
    repo_url: result.repo_url,
    score: result.score,
    verdict: result.verdict,
    scanned_at: result.scanned_at,
    paths_scanned: result.paths_scanned,
    report_url: getLocationHref(),
    summary: `Scanned ${result.repo_name}. Verdict: ${result.verdict}. Score: ${result.score}/100 across ${result.paths_scanned} paths.`,
  };
}

export function buildRepoScanErrorPayload(error, repoUrl) {
  return {
    ok: false,
    repo_url: repoUrl,
    error: {
      message: error?.message || 'Repository scan failed.',
    },
  };
}

// --- Imperative `list_available_tools` tool --------------------------------
// Describes every tool surface this page exposes so an agent can discover the
// available actions (and their input/result schemas) before calling them.
export function getToolSurfaces() {
  return [
    {
      name: DECLARATIVE_TOOL_NAME,
      title: 'Scan a GitHub repository',
      description:
        'Scan a GitHub repository for AI-native development primitives by submitting the on-page form and updating the visible report. Accepts owner/repository or a full GitHub URL.',
      invocation: 'declarative-form',
      read_only: true,
      input_schema: REPO_SCAN_INPUT_SCHEMA,
      output_schema: REPO_SCAN_RESULT_SCHEMA,
    },
    {
      name: IMPERATIVE_TOOL_NAME,
      title: 'List available tools',
      description:
        "List the WebMCP tools this page exposes to agents, including each tool's name, description, input schema, and result schema. Call it to discover the available actions before invoking them.",
      invocation: 'imperative',
      read_only: true,
      input_schema: TOOL_CATALOG_INPUT_SCHEMA,
      output_schema: TOOL_CATALOG_RESULT_SCHEMA,
    },
  ];
}

export function buildToolCatalogPayload() {
  const tools = getToolSurfaces();
  return {
    ok: true,
    page_url: getLocationHref(),
    tool_count: tools.length,
    tools,
    summary: `This page exposes ${tools.length} WebMCP tools: ${tools.map((tool) => tool.name).join(', ')}.`,
  };
}

export function buildListToolsResult() {
  const payload = buildToolCatalogPayload();
  return {
    content: [
      {
        type: 'text',
        text: payload.summary,
      },
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

export function createListToolsToolDefinition() {
  return {
    name: IMPERATIVE_TOOL_NAME,
    title: 'List available tools',
    description:
      "List the WebMCP tools this page exposes to agents, including each tool's name, description, input schema, and result schema. Call it to discover the available actions before invoking them.",
    inputSchema: TOOL_CATALOG_INPUT_SCHEMA,
    outputSchema: TOOL_CATALOG_RESULT_SCHEMA,
    annotations: {
      readOnlyHint: true,
    },
    async execute() {
      return buildListToolsResult();
    },
  };
}

export function registerListToolsTool({
  documentLike = globalThis.document,
  navigatorLike = globalThis.navigator,
} = {}) {
  const modelContext = resolveModelContext({ documentLike, navigatorLike });
  if (!modelContext) {
    return () => {};
  }

  // Spec-aligned unregistration is driven by an AbortSignal passed via
  // ModelContextRegisterToolOptions. The current Chrome preview still ships
  // the legacy `unregisterTool(name)` method, so we fall back to that when
  // AbortController is unavailable or the implementation ignores the signal.
  const supportsSignal = typeof globalThis.AbortController === 'function';
  const controller = supportsSignal ? new globalThis.AbortController() : null;
  const supportsLegacyUnregister = typeof modelContext.unregisterTool === 'function';

  // Clear any stale registration from a prior page load / hot reload so a
  // duplicate `registerTool()` call does not throw InvalidStateError.
  if (supportsLegacyUnregister) {
    try {
      modelContext.unregisterTool(IMPERATIVE_TOOL_NAME);
    } catch {
      // Ignore missing registrations so reloads can register cleanly.
    }
  }

  const definition = createListToolsToolDefinition();

  try {
    modelContext.registerTool(
      definition,
      controller ? { signal: controller.signal } : undefined,
    );
  } catch (error) {
    // Some preview builds may not accept the options argument; retry without it.
    if (controller) {
      modelContext.registerTool(definition);
    } else {
      throw error;
    }
  }

  return () => {
    if (controller) {
      try {
        controller.abort();
      } catch {
        // Ignore cleanup failures during teardown.
      }
    }
    if (supportsLegacyUnregister) {
      try {
        modelContext.unregisterTool(IMPERATIVE_TOOL_NAME);
      } catch {
        // Ignore cleanup failures during teardown.
      }
    }
  };
}

export function getDeclarativeToolName() {
  return DECLARATIVE_TOOL_NAME;
}

export function getImperativeToolName() {
  return IMPERATIVE_TOOL_NAME;
}