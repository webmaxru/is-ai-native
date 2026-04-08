---
applyTo: docs/envisioning/**
---

# Envisioning Instructions

## Purpose

Envisioning documents explore a problem space and articulate the desired end-state before committing to a specific solution. They are the "why" and "what" before the "how."

## When to Write an Envisioning Doc

- Starting a new feature area or product capability
- Exploring a significant change to user experience
- Aligning stakeholders around a shared vision before writing feature specs

## File Naming

Use a descriptive kebab-case name: `cloud-analysis-pipeline.md`, `multi-repo-scanning.md`.

## Template

Use `docs/envisioning/TEMPLATE.md` as the starting point.

## Relationship to Other Docs

- An envisioning doc may spawn one or more **feature specs** (`docs/features/`).
- Architectural choices surfaced during envisioning should be captured as **ADRs** (`docs/adr/`).

## Style

- Focus on user outcomes, not implementation details.
- Use concrete scenarios over abstract descriptions.
- Quantify success metrics where possible.
