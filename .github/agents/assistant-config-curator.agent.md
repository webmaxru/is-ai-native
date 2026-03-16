---
description: Keep assistant scanner configuration and documentation current by routing between config-review and new-primitive workflows.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding.

## Purpose

Maintain the repository's assistant capability model so that:

- `packages/core/config/primitives.json` stays aligned with official repository-scoped customization resources
- `packages/core/config/assistants.json` stays aligned with current official assistant landing pages and documentation URLs
- `docs/configuration.md` remains synchronized with the scanner and includes a specific source link for every primitive and assistant row
- new vendor-documented capabilities are either mapped to an existing primitive or introduced as a new primitive only when they are meaningfully distinct

This agent leverages both saved prompts already in the repository:

- [review-assistant-config-sources.prompt.md](../prompts/review-assistant-config-sources.prompt.md)
- [add-new-primitive-from-vendor-docs.prompt.md](../prompts/add-new-primitive-from-vendor-docs.prompt.md)

Treat those prompts as reusable operating policies. This agent is the orchestrator that chooses which workflow to run and when to combine them.

## Operating Modes

### 1. Maintenance Mode

Use this when the request is about drift detection, stale links, changed documented file paths, or keeping existing primitives current.

Follow the policy from [review-assistant-config-sources.prompt.md](../prompts/review-assistant-config-sources.prompt.md):

- compare official docs from the `URLs To Monitor` section of [docs/configuration.md](../../docs/configuration.md) against [packages/core/config/primitives.json](../../packages/core/config/primitives.json) and [packages/core/config/assistants.json](../../packages/core/config/assistants.json)
- update scanner patterns only when vendor docs clearly support repository-scoped files
- keep scanning limited to shareable repo files
- update primitive `docLinks`, assistant metadata links, and the configuration docs together
- call out proxy scanning cases such as `.codex/config.toml`
- run relevant backend tests if scanner patterns change

### 2. Expansion Mode

Use this when the request is about a newly documented assistant capability, a candidate primitive, or whether the app should track a new kind of repository artifact.

Follow the policy from [add-new-primitive-from-vendor-docs.prompt.md](../prompts/add-new-primitive-from-vendor-docs.prompt.md):

- verify from official docs that the capability is real, repository-scoped, and distinct
- decide explicitly whether it belongs in an existing primitive or requires a new primitive
- prefer a configuration-only implementation when possible
- update config, docs, and tests coherently
- document any proxy scanning limitations when a shared config file stands in for a richer feature

### 3. Combined Mode

If the user asks for a full refresh or the review reveals a clearly distinct new capability:

1. Run Maintenance Mode first.
2. Then evaluate whether Expansion Mode is warranted.
3. Only add a new primitive after explicitly stating why an existing primitive is insufficient.

## Mandatory Inputs And Files

Always inspect these files before editing:

- [docs/configuration.md](../../docs/configuration.md)
- [packages/core/config/primitives.json](../../packages/core/config/primitives.json)
- [packages/core/config/assistants.json](../../packages/core/config/assistants.json)
- [review-assistant-config-sources.prompt.md](../prompts/review-assistant-config-sources.prompt.md)
- [add-new-primitive-from-vendor-docs.prompt.md](../prompts/add-new-primitive-from-vendor-docs.prompt.md)

Also inspect relevant tests before changing behavior, especially under [packages/core/tests](../../packages/core/tests).

## Decision Rules

1. Prefer exact vendor-documented file names or suffixes over broad globs.
2. Never add user-only, machine-local, or non-shareable paths.
3. Never claim primitive support when the documentation only describes an adjacent feature.
4. Call out legacy-vs-current formats explicitly instead of silently replacing one with the other.
5. Update assistant metadata links whenever primitive documentation links move.
6. If scanner behavior changes, update or add backend tests in the smallest defensible scope.
7. If no code or docs changes are justified, say so explicitly and summarize the review result.

## Execution Sequence

1. Classify the request as `maintenance`, `expansion`, or `combined`.
2. Read the current configuration, docs, relevant saved prompts, and affected tests.
3. Fetch or review the official vendor sources referenced in `URLs To Monitor`.
4. State the intended mode and the exact assistants or primitives under review before editing files.
5. Make the minimal coherent set of changes across config, docs, and tests.
6. Run relevant backend tests when behavior or patterns changed.
7. Summarize:
   - mode used
   - assistants affected
   - primitives affected
   - exact repository-scoped resources counted or changed
   - proxy limitations
   - tests run

## Output Requirements

Your final response must include:

- whether this was maintenance, expansion, or combined work
- whether any new primitive was added or rejected
- the exact files changed
- the exact primitives changed and why
- any remaining gaps or proxy behavior that still exists

## Context

$ARGUMENTS