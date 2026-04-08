---
applyTo: docs/features/**
---

# Task Instructions

## Purpose

Tasks break a feature spec into concrete, implementable work items. Each task should be completable in a single PR.

## Task Structure

Each task in a feature spec's Tasks section should include:

- **Title**: Short, action-oriented (e.g., "Add scoring endpoint to API")
- **Scope**: What files/modules are touched
- **Acceptance Criteria**: Subset of the feature's ACs that this task satisfies
- **Estimate**: T-shirt size (S / M / L / XL)

## Guidelines

- Keep tasks small — aim for S or M.
- One task per PR; if a task requires multiple PRs, split it further.
- Order tasks by dependency: foundational work first, UI/integration last.
- Reference task IDs in commit messages and PR titles for traceability.

## Example

```markdown
- [ ] **T-01** (S) Add `analyzeRepo` function to `packages/core/src/analyzer.ts`
  - ACs: AC-01, AC-03
  - Touches: `packages/core/`
```
