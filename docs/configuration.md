# Configuration Guide

This document describes how to customize the AI-Native Development Readiness Checker by editing
its JSON configuration files. No code changes are required.

## Configuration Files

| File | Purpose |
|------|---------|
| `backend/src/config/primitives.json` | Defines AI-native primitives, categories, detection patterns, and documentation links |
| `backend/src/config/assistants.json` | Defines supported AI assistants with metadata |

Both files are validated at server startup. If validation fails, the server will not start and will
print a clear error message indicating which field is missing or invalid.

---

## primitives.json Schema

```json
{
  "primitives": [
    {
      "name": "Instruction Files",
      "category": "instructions",
      "description": "Repository-level instructions that guide AI assistants...",
      "docLinks": [
        "https://docs.github.com/en/copilot/customizing-copilot/adding-repository-instructions-for-github-copilot"
      ],
      "assistants": {
        "github-copilot": {
          "patterns": [".github/copilot-instructions.md"]
        },
        "claude-code": {
          "patterns": ["CLAUDE.md", ".claude/settings.json"]
        }
      }
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Human-readable primitive name. Must be non-empty. |
| `category` | `string` | Grouping category (e.g., `instructions`, `prompts`, `agents`, `skills`, `mcp-config`). Categories organize related primitives in reports, but the overall score is based on assistant-specific primitive coverage. |
| `description` | `string` | Explanation of what this primitive does and why it matters. Shown in the report for both detected and missing primitives. |
| `docLinks` | `string[]` | One or more URLs to official documentation. Must have at least one entry. |
| `assistants` | `object` | Maps assistant IDs to their detection patterns. Must have at least one assistant. |
| `assistants.<id>.patterns` | `string[]` | Glob patterns matched against the repository file tree. Must have at least one pattern. |

### Glob Pattern Syntax

Patterns use [minimatch](https://github.com/isaacs/minimatch) syntax with `dot: true`:

| Pattern | Matches |
|---------|---------|
| `.github/copilot-instructions.md` | Exact file path |
| `**/.cursorrules` | File in any directory |
| `.github/prompts/*.md` | Any `.md` file in `.github/prompts/` |
| `**/*.mcp.json` | Any file ending in `.mcp.json` in any directory |
| `.vscode/mcp.json` | Exact file path |

---

## assistants.json Schema

```json
{
  "assistants": [
    {
      "id": "github-copilot",
      "name": "GitHub Copilot",
      "description": "AI pair programmer by GitHub",
      "website": "https://github.com/features/copilot",
      "docLinks": [
        "https://docs.github.com/en/copilot"
      ]
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier matching keys used in `primitives.json` assistants. |
| `name` | `string` | Display name shown in the UI. |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Brief description of the assistant. |
| `website` | `string` | Official website URL. |
| `docLinks` | `string[]` | Documentation links. |

---

## Official Resource Matrix

This section maps the six currently evaluated primitives to the exact repository-scoped resources documented by each assistant vendor as of 2026-03-09.

Use this section when updating `backend/src/config/primitives.json` so the scanner follows vendor-documented file locations instead of relying on guessed globs.

Important interpretation rules:

- The scanner only sees repository contents, so user-only and machine-local files are listed for context but should not be counted as repository evidence.
- "Current scanner patterns" are the globs in `backend/src/config/primitives.json` today.
- "Official repo-scoped resources" are the closest documented equivalents for the primitive, even when the current scanner does not yet evaluate them.

### Instruction Files

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/copilot-instructions.md`; `.github/instructions/**/*.instructions.md`; `AGENTS.md` is also supported as agent instructions in coding-agent surfaces | `.github/copilot-instructions.md` | Current config only counts repository-wide Copilot instructions, not path-specific instruction files or `AGENTS.md`. | [Add repository instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [Custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support) |
| Claude Code | Yes | `CLAUDE.md`; `.claude/CLAUDE.md`; `.claude/rules/**/*.md` | `CLAUDE.md` | Current config undercounts Claude project guidance because it ignores `.claude/CLAUDE.md` and `.claude/rules/**`. `CLAUDE.local.md` is local-only and should not be scanned from GitHub. | [Memory](https://code.claude.com/docs/en/memory) |
| OpenAI Codex | Yes | `AGENTS.md`; `AGENTS.override.md`; optional fallback filenames configured via `.codex/config.toml` `project_doc_fallback_filenames` | `AGENTS.md` | Current config misses `AGENTS.override.md` and any configured fallback names. | [AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Config reference](https://developers.openai.com/codex/config-reference) |

### Saved Prompts

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/prompts/*.prompt.md` | `.github/prompts/**` | Current glob is broader than the documented prompt-file suffix. Narrowing to `*.prompt.md` would better match vendor docs. | [Prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files) |
| Claude Code | Yes, but the current first-class feature is Skills | Legacy command files in `.claude/commands/*.md`; modern reusable slash-command workflows are documented as skills in `.claude/skills/<name>/SKILL.md` | `.claude/commands/**` | Current config only recognizes the legacy commands folder and does not count the current skills-based equivalent. | [Skills / slash commands](https://code.claude.com/docs/en/slash-commands) |
| OpenAI Codex | No standalone prompt-file format documented | No dedicated prompt-file path documented; the closest reusable task mechanism is `.agents/skills/<name>/SKILL.md` | Not evaluated | If you want Codex prompt-like reuse, track skills rather than a separate prompt primitive. | [Skills](https://developers.openai.com/codex/skills) |

### Custom Agent Definitions

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/agents/*.agent.md` (formal format); VS Code also detects `.md` files in `.github/agents` | `.github/agents/**` | Current glob is intentionally broad and will match vendor-compliant files. | [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) |
| Claude Code | Yes | `.claude/agents/*.md` | Not evaluated | The app does not currently count Claude subagents under the custom-agent primitive. | [Subagents](https://code.claude.com/docs/en/sub-agents), [VS Code custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) |
| OpenAI Codex | Yes, but config-based rather than Markdown-file based | `.codex/config.toml` or `~/.codex/config.toml` with `[agents.<name>]` tables and optional `config_file` references | Not evaluated | Codex agent roles do not use a dedicated repo markdown folder like Copilot or Claude. | [Config reference](https://developers.openai.com/codex/config-reference) |

### Skills

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/skills/<name>/SKILL.md`; `.claude/skills/<name>/SKILL.md`; `.agents/skills/<name>/SKILL.md` | `.github/skills/**`, `.agents/skills/**` | Current config misses `.claude/skills/**`, which VS Code also treats as a valid project skill location. | [Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |
| Claude Code | Yes | `.claude/skills/<name>/SKILL.md` | Not evaluated | Claude still supports `.claude/commands/*.md`, but skills are the current documented form. | [Skills / slash commands](https://code.claude.com/docs/en/slash-commands) |
| OpenAI Codex | Yes | `.agents/skills/<name>/SKILL.md`, scanned from the current working directory up to the repository root | Not evaluated | This is a clear repo-scoped capability that the current scanner does not count for Codex. | [Skills](https://developers.openai.com/codex/skills) |

### MCP Server Configurations

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.vscode/mcp.json` | `.vscode/mcp.json` | Current config matches vendor docs exactly. | [MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) |
| Claude Code | Yes | `.mcp.json` | `.mcp.json` | Current config matches the documented project-scoped MCP file. User and local MCP state also lives in `~/.claude.json`, but that is not repository evidence. | [MCP](https://code.claude.com/docs/en/mcp), [Settings](https://code.claude.com/docs/en/settings) |
| OpenAI Codex | Yes | `.codex/config.toml` or `~/.codex/config.toml` with `[mcp_servers.<name>]` tables | Not evaluated | Codex stores MCP in TOML, not in a standalone JSON file. | [MCP](https://developers.openai.com/codex/mcp), [Config basics](https://developers.openai.com/codex/config-basic), [Config reference](https://developers.openai.com/codex/config-reference) |

### Agent Hooks

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/hooks/*.json` | `.github/hooks/**` | Current glob is broader than the documented `*.json` hook files. | [Hooks](https://code.visualstudio.com/docs/copilot/customization/hooks) |
| Claude Code | Yes | `.claude/settings.json`; `.claude/settings.local.json` with a top-level `hooks` setting | `.claude/settings.json`, `.claude/settings.local.json` | Current config matches the documented project and local settings files. `~/.claude/settings.json` is user-scoped and not repository evidence. | [Settings](https://code.claude.com/docs/en/settings), [Hooks](https://code.claude.com/docs/en/hooks) |
| OpenAI Codex | No equivalent lifecycle hook file documented in current Codex docs | No repo-scoped hook file documented; the closest adjacent feature is `notify` in `config.toml`, which is not equivalent to lifecycle hooks | Not evaluated | Treat this primitive as unavailable for Codex unless OpenAI publishes first-class lifecycle hooks. | [Config reference](https://developers.openai.com/codex/config-reference), [Configuration](https://raw.githubusercontent.com/openai/codex/main/docs/config.md) |

## URLs To Monitor

Use these URLs when reviewing whether the app configuration should change.

### GitHub Copilot / VS Code

- `https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions`
- `https://docs.github.com/en/copilot/reference/custom-instructions-support`
- `https://code.visualstudio.com/docs/copilot/customization/prompt-files`
- `https://code.visualstudio.com/docs/copilot/customization/custom-agents`
- `https://code.visualstudio.com/docs/copilot/customization/agent-skills`
- `https://code.visualstudio.com/docs/copilot/customization/mcp-servers`
- `https://code.visualstudio.com/docs/copilot/customization/hooks`

### Claude Code

- `https://code.claude.com/docs/en/memory`
- `https://code.claude.com/docs/en/settings`
- `https://code.claude.com/docs/en/slash-commands`
- `https://code.claude.com/docs/en/sub-agents`
- `https://code.claude.com/docs/en/mcp`
- `https://code.claude.com/docs/en/hooks`

### OpenAI Codex

- `https://developers.openai.com/codex/guides/agents-md`
- `https://developers.openai.com/codex/config-basic`
- `https://developers.openai.com/codex/config-reference`
- `https://developers.openai.com/codex/mcp`
- `https://developers.openai.com/codex/skills`

## Review Checklist

When you revisit the URLs above, check these questions before changing the scanner:

- Did the vendor add a new repository-scoped file path or filename pattern?
- Did a documented feature move from legacy to preferred format, such as Claude commands moving to skills?
- Is the current scanner glob broader than the documented filename suffix?
- Is the current scanner missing a documented repository-scoped resource that should count toward the existing primitive?
- Is a feature only user-scoped or machine-scoped, meaning it should stay out of a GitHub repository tree scan?

If the answer is yes to any of those questions, update `backend/src/config/primitives.json`, then update this document to keep the matrix aligned.

---

## Adding a New Primitive

1. Open `backend/src/config/primitives.json`.
2. Add a new entry to the `primitives` array:

   ```json
   {
     "name": "My New Primitive",
     "category": "instructions",
     "description": "Explains what this primitive is and why teams should adopt it.",
     "docLinks": ["https://example.com/docs/my-primitive"],
     "assistants": {
       "github-copilot": {
         "patterns": [".github/my-primitive.md"]
       },
       "claude-code": {
         "patterns": [".claude/my-primitive.json"]
       }
     }
   }
   ```

3. Restart the backend server.
4. The new primitive will appear in scan results immediately.

### Tips

- Use an **existing category** to group related primitives in the report UI.
- Use a **new category** to create a separate reporting dimension.
- Add patterns for **all relevant assistants** so each gets accurate scores.
- Provide **helpful documentation links** — they're shown prominently for missing primitives.

---

## Adding a New AI Assistant

1. Open `backend/src/config/assistants.json`.
2. Add a new entry to the `assistants` array:

   ```json
   {
     "id": "my-assistant",
     "name": "My AI Assistant",
     "description": "Description of the assistant.",
     "website": "https://example.com",
     "docLinks": ["https://example.com/docs"]
   }
   ```

3. Update `backend/src/config/primitives.json` to add patterns for the new assistant
   under relevant primitives:

   ```json
   "assistants": {
     "my-assistant": {
       "patterns": [".my-assistant/config.json"]
     }
   }
   ```

4. Restart the backend server. The new assistant will appear in per-assistant report sections.

---

## Validation Errors

If configuration is invalid, the server logs a clear error and exits:

```
FATAL: Configuration validation failed: Primitive [0] "Instruction Files": "docLinks" must be a non-empty array of strings.
```

Common issues:
- Missing required field → error names the field and primitive index
- Empty arrays (docLinks, patterns, assistants) → must have at least one entry
- Malformed JSON → check for trailing commas or mismatched brackets
- Extra fields → ignored gracefully (no error)

---

## Operational Telemetry

The backend can optionally emit custom Azure Application Insights events for operational monitoring. This is configured with the standard `APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable and does not affect the scan result schema.

### Emitted Events

| Event | When it is sent | Typical dimensions |
|-------|------------------|--------------------|
| `scan_completed` | A repository scan succeeds | `repo_url`, `repo_name`, `verdict`, `scan_key`, `scanned_at` |
| `scan_failed` | A scan request fails validation or backend processing | `repo_url`, `repo_name`, `reason`, `status_code`, `error_name` |
| `report_created` | A shared report is successfully persisted | `report_id`, `repo_url`, `repo_name`, `verdict`, `scan_key`, `scanned_at` |
| `shared_report_viewed` | A stored shared report is successfully fetched | `report_id`, `repo_url`, `repo_name`, `verdict`, `scan_key`, `scanned_at` |

### Measurements

- `score`
- `stars`
- `duration_ms`

### Typical Use Cases

- Build Azure Workbooks that show total scan count and total report count.
- Drill into recent scans by repository, verdict, score, or duration.
- Track which shared reports are being viewed and correlate those views back to the originating scan.
- Track scan failures separately from successful scans.
- Join `report_created` events back to `scan_completed` events with the shared `scan_key` property.

This telemetry is intended for Azure-side monitoring and operator dashboards. It does not replace the in-app live scan view or the existing shared-report persistence feature.
