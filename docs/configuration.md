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
| `category` | `string` | Grouping category (e.g., `instructions`, `prompts`, `agents`, `skills`, `mcp-config`). Categories are used for overall score calculation. |
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

- Use an **existing category** to group related primitives (affects overall score calculation).
- Use a **new category** to create a separate scoring dimension.
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
