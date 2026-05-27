const IMPERATIVE_TOOL_NAME = 'scan_repository';
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

export function coerceRepoScanInput(input) {
  if (typeof input === 'string') {
    return input.trim();
  }

  if (!input || typeof input !== 'object') {
    return '';
  }

  const candidate = input.repo_url ?? input.repository ?? input.repo ?? input.repoUrl ?? '';
  return typeof candidate === 'string' ? candidate.trim() : '';
}

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

export function buildImperativeToolResult(result) {
  const payload = buildRepoScanPayload(result);
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
  };
}

export function createRepoScanToolDefinition(executeScan) {
  return {
    name: IMPERATIVE_TOOL_NAME,
    description:
      'Scan a GitHub repository for AI-native development primitives and update the visible report. Accepts owner/repository or a full GitHub repository URL.',
    inputSchema: {
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
    },
    annotations: {
      readOnlyHint: true,
    },
    async execute(input) {
      const repoUrl = coerceRepoScanInput(input);
      if (!repoUrl) {
        throw new Error('repo_url is required. Provide owner/repository or a full GitHub URL.');
      }

      const result = await executeScan(repoUrl);
      return buildImperativeToolResult(result);
    },
  };
}

export function registerRepoScanTool({
  executeScan,
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

  const definition = createRepoScanToolDefinition(executeScan);

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
