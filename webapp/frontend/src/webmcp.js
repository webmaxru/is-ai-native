const IMPERATIVE_TOOL_NAME = 'scan_repository';
const DECLARATIVE_TOOL_NAME = 'scan_repository_form';

function getLocationHref() {
  try {
    return globalThis.location?.href || null;
  } catch {
    return null;
  }
}

export function supportsWebMcp(navigatorLike = globalThis.navigator) {
  return typeof navigatorLike?.modelContext?.registerTool === 'function'
    && typeof navigatorLike?.modelContext?.unregisterTool === 'function';
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

export function registerRepoScanTool({ executeScan, navigatorLike = globalThis.navigator }) {
  if (!supportsWebMcp(navigatorLike)) {
    return () => {};
  }

  try {
    navigatorLike.modelContext.unregisterTool(IMPERATIVE_TOOL_NAME);
  } catch {
    // Ignore missing registrations so reloads can register cleanly.
  }

  navigatorLike.modelContext.registerTool(createRepoScanToolDefinition(executeScan));

  return () => {
    try {
      navigatorLike.modelContext.unregisterTool(IMPERATIVE_TOOL_NAME);
    } catch {
      // Ignore cleanup failures during teardown.
    }
  };
}

export function getDeclarativeToolName() {
  return DECLARATIVE_TOOL_NAME;
}

export function getImperativeToolName() {
  return IMPERATIVE_TOOL_NAME;
}