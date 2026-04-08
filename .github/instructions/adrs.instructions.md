---
applyTo: docs/adr/**
---

# ADR Instructions

## Purpose

Architecture Decision Records (ADRs) capture significant architectural decisions along with their context and consequences.

## When to Write an ADR

- Choosing a new technology, framework, or library
- Changing the project structure or module boundaries
- Defining API contracts or communication patterns
- Making trade-offs that affect multiple surfaces (web app, VS Code extension, CLI)

## File Naming

Use the pattern: `ADR-NNNN-short-kebab-title.md` (e.g., `ADR-0001-use-esm-modules.md`).

## Template

Use `docs/adr/TEMPLATE.md` as the starting point. Copy it, fill in all sections, and remove placeholder `[TODO]` markers.

## Statuses

- **Proposed** — open for discussion
- **Accepted** — decision ratified; implementation may begin
- **Deprecated** — no longer relevant
- **Superseded** — replaced by a newer ADR (link to it)

## Style

- Write in the present tense for the decision ("We use…"), past tense for context ("We evaluated…").
- Keep each section concise; link to external docs rather than duplicating.
- List at least two alternatives considered.
