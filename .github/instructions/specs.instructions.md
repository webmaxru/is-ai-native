---
applyTo: docs/features/**
---

# Feature Spec Instructions

## Purpose

Feature specs define the requirements, acceptance criteria, and high-level design for a discrete piece of functionality. They bridge envisioning ("what we want") to implementation ("how we build it").

## When to Write a Feature Spec

- Implementing a new user-facing capability
- Making a significant change to an existing feature
- Any work that spans more than a single PR and benefits from upfront design

## File Naming

Use a descriptive kebab-case name: `repo-scanning.md`, `score-breakdown-panel.md`.

## Template

Use `docs/features/TEMPLATE.md` as the starting point.

## Sections Guide

- **Requirements**: Number each requirement (FR-01, NFR-01) for traceability.
- **Acceptance Criteria**: Write testable, binary (pass/fail) statements.
- **Affected Surfaces**: Check every surface that requires changes — web app, VS Code extension, GitHub CLI extension, standalone CLI.
- **Tasks**: Add implementation tasks after the spec is approved.

## Style

- Be specific and unambiguous; avoid "should" in acceptance criteria — use "must."
- Link to the parent envisioning doc and any related ADRs.
- Keep design sections high-level; detailed design belongs in code comments or separate docs.
