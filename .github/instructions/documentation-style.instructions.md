---
applyTo: docs/**
---

# Documentation Style Instructions

## Language & Tone

- Write in clear, concise English.
- Use active voice and present tense.
- Address the reader as "you" in guides; use "we" in decision records and specs.

## Markdown Conventions

- Use ATX-style headings (`#`, `##`, `###`).
- One sentence per line (semantic line breaks) for better diffs.
- Use fenced code blocks with language identifiers (```ts, ```json, etc.).
- Prefer reference-style links for URLs used more than once.

## File Organization

| Directory | Purpose |
| --------- | ------- |
| `docs/envisioning/` | Problem exploration & vision |
| `docs/features/` | Feature specs with requirements & ACs |
| `docs/adr/` | Architecture Decision Records |
| `docs/migrations/` | Migration plans |
| `docs/` (root) | General docs (config, go-to-market, etc.) |

## Naming

- All doc files use **kebab-case**: `repo-scanning.md`, not `RepoScanning.md`.
- Templates are named `TEMPLATE.md` in each directory.

## Status Badges

Always include a status in the front-matter block at the top of specs, ADRs, and envisioning docs.

## Cross-References

- Link to related docs using relative paths: `[see ADR-0001](../adr/ADR-0001-use-esm-modules.md)`.
- Keep a two-way link: the feature spec links to the ADR and vice versa.
