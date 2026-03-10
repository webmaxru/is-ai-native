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

This section maps the six currently evaluated primitives to the exact repository-scoped resources documented by each assistant vendor as of 2026-03-10.

Use this section when updating `backend/src/config/primitives.json` so the scanner follows vendor-documented file locations instead of relying on guessed globs.

Important interpretation rules:

- The scanner only sees repository contents, so user-only and machine-local files are listed for context but should not be counted as repository evidence.
- "Current scanner patterns" are the globs in `backend/src/config/primitives.json` today.
- "Official repo-scoped resources" are the closest documented equivalents for the primitive, even when the current scanner does not yet evaluate them.

### Instruction Files

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/copilot-instructions.md`; `.github/instructions/**/*.instructions.md`; `**/AGENTS.md`; root `CLAUDE.md`; root `GEMINI.md` | `.github/copilot-instructions.md`; `.github/instructions/**/*.instructions.md`; `**/AGENTS.md`; `CLAUDE.md`; `GEMINI.md` | The GitHub docs now explicitly treat repository-wide instructions, path-specific instructions, and agent-instruction files as supported repository inputs. `AGENTS.md` can live anywhere in the repo; `CLAUDE.md` and `GEMINI.md` are documented as root alternatives. | [Add repository instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [Custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support) |
| Claude Code | Yes | `CLAUDE.md`; `.claude/CLAUDE.md`; `.claude/rules/**/*.md` | `CLAUDE.md`; `.claude/CLAUDE.md`; `.claude/rules/**/*.md` | `CLAUDE.local.md` is machine-local and should not be scanned from source control. Rules are now clearly documented as the path-specific/project-shareable extension mechanism for Claude instructions. | [Memory](https://code.claude.com/docs/en/memory) |
| OpenAI Codex | Yes | `**/AGENTS.md`; `**/AGENTS.override.md`; optional fallback filenames configured via `.codex/config.toml` `project_doc_fallback_filenames` | `**/AGENTS.md`; `**/AGENTS.override.md` | The scanner now counts the documented override file in addition to standard `AGENTS.md`. It still does not infer custom fallback filenames from `.codex/config.toml`, because the current scanner is path-based and does not parse TOML. | [AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Config basics](https://developers.openai.com/codex/config-basic), [Config reference](https://developers.openai.com/codex/config-reference) |

### Saved Prompts

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/prompts/*.prompt.md` | `.github/prompts/*.prompt.md` | The VS Code prompt-file docs specify the `.prompt.md` suffix in the `.github/prompts` workspace folder. The scanner now follows that exact suffix instead of the looser folder glob. | [Prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files) |
| Claude Code | Yes, with legacy and current formats | Legacy command files in `.claude/commands/*.md`; current reusable slash-command workflows in `.claude/skills/<name>/SKILL.md` | `.claude/commands/*.md`; `.claude/skills/**/SKILL.md` | Claude’s docs now state that custom commands have been merged into skills, while older `.claude/commands/*.md` files still work. The scanner counts both and the docs call out the legacy-vs-current distinction explicitly. | [Skills / slash commands](https://code.claude.com/docs/en/slash-commands) |
| OpenAI Codex | No standalone prompt-file format documented | No dedicated prompt-file path documented; the closest reusable task mechanism is `.agents/skills/<name>/SKILL.md` | Not evaluated | This remains intentionally unsupported for the Saved Prompts primitive. Codex skills are tracked under the Skills primitive instead of being double-interpreted as a dedicated prompt-file feature. | [Skills](https://developers.openai.com/codex/skills) |

### Custom Agent Definitions

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/agents/*.agent.md` (formal format); VS Code also detects other `.md` files in `.github/agents` | `.github/agents/*.agent.md` | The scanner now prefers the documented `.agent.md` suffix over a broad folder glob. This follows the formal file format even though VS Code will also detect generic Markdown files in that folder. | [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) |
| Claude Code | Yes | `.claude/agents/*.md` | `.claude/agents/*.md` | Claude project subagents are now counted directly from the documented project-scoped folder. | [Subagents](https://code.claude.com/docs/en/sub-agents) |
| OpenAI Codex | Yes, config-based rather than Markdown-file based | `.codex/config.toml` with `[agents.<name>]` tables and optional `agents.<name>.config_file` references | `.codex/config.toml` | The scanner now treats project-scoped `.codex/config.toml` as the repo-scoped custom-agent artifact for Codex. This is a file-presence proxy only; the scanner does not parse whether `[agents.<name>]` is present. | [Config basics](https://developers.openai.com/codex/config-basic), [Config reference](https://developers.openai.com/codex/config-reference) |

### Skills

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/skills/<name>/SKILL.md`; `.claude/skills/<name>/SKILL.md`; `.agents/skills/<name>/SKILL.md` | `.github/skills/**/SKILL.md`; `.claude/skills/**/SKILL.md`; `.agents/skills/**/SKILL.md` | VS Code’s Agent Skills docs explicitly recognize all three project skill roots. The scanner now looks for the `SKILL.md` entrypoint rather than any file under those folders. | [Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |
| Claude Code | Yes | `.claude/skills/<name>/SKILL.md` | `.claude/skills/**/SKILL.md` | Claude project skills are now counted directly from the documented skill entrypoint. Legacy `.claude/commands/*.md` files are tracked in Saved Prompts, not here. | [Skills / slash commands](https://code.claude.com/docs/en/slash-commands) |
| OpenAI Codex | Yes | `.agents/skills/<name>/SKILL.md`, scanned from the current working directory up to the repository root | `.agents/skills/**/SKILL.md` | The scanner now counts the documented Codex repository skill entrypoint. | [Skills](https://developers.openai.com/codex/skills) |

### MCP Server Configurations

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.vscode/mcp.json` | `.vscode/mcp.json` | This remains an exact match to the workspace-scoped MCP configuration file documented by VS Code. | [MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) |
| Claude Code | Yes | `.mcp.json` | `.mcp.json` | Claude’s project-scoped MCP configuration remains `.mcp.json`. User and local scope entries in `~/.claude.json` are intentionally excluded because they are not shareable repository artifacts. | [MCP](https://code.claude.com/docs/en/mcp) |
| OpenAI Codex | Yes | `.codex/config.toml` with `[mcp_servers.<name>]` tables | `.codex/config.toml` | The scanner now counts the documented project-scoped Codex config file for MCP. This is a file-presence proxy only; it does not parse whether `[mcp_servers.<name>]` is present. | [MCP](https://developers.openai.com/codex/mcp), [Config basics](https://developers.openai.com/codex/config-basic), [Config reference](https://developers.openai.com/codex/config-reference) |

### Agent Hooks

| Assistant | Official availability | Official repo-scoped resources | Current scanner patterns | Notes | Sources |
|------|------|-------------|-------------|-------|---------|
| GitHub Copilot | Yes | `.github/hooks/*.json`; agent-scoped `hooks` field in `.agent.md` files | `.github/hooks/*.json` | The scanner now follows the documented JSON hook-file suffix exactly. Agent-scoped hooks in `.agent.md` are documented, but the current scanner intentionally does not count generic agent files as hooks because it does not parse frontmatter. | [Hooks](https://code.visualstudio.com/docs/copilot/customization/hooks), [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) |
| Claude Code | Yes | `.claude/settings.json`; `.claude/settings.local.json` with a top-level `hooks` setting | `.claude/settings.json`; `.claude/settings.local.json` | This remains aligned with Claude’s documented project-scoped and local settings files. `~/.claude/settings.json` is user-scoped and should not be treated as repository evidence. | [Settings](https://code.claude.com/docs/en/settings), [Hooks](https://code.claude.com/docs/en/hooks) |
| OpenAI Codex | No equivalent lifecycle hook file documented in current Codex docs | No repo-scoped hook file documented; the closest adjacent feature is `notify` in `config.toml`, which is not equivalent to lifecycle hooks | Not evaluated | This remains intentionally unsupported until OpenAI publishes a first-class repo-scoped lifecycle hook mechanism. | [Config reference](https://developers.openai.com/codex/config-reference) |

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
