---
name: Weekly Assistant Config Review
description: Weekly maintenance workflow that reviews assistant customization docs and updates scanner config when vendor-documented repo resources drift.
on:
  schedule: weekly
permissions:
  contents: read
  actions: read
concurrency: weekly-assistant-config-review
timeout-minutes: 20
engine:
  id: copilot
  agent: assistant-config-curator
tools:
  edit: true
  web-fetch: true
  bash: true
network:
  allowed:
    - defaults
    - docs.github.com
    - code.visualstudio.com
    - code.claude.com
    - developers.openai.com
safe-outputs:
  noop:
    report-as-issue: false
  create-pull-request:
    title-prefix: "[assistant-config] "
    draft: true
    if-no-changes: ignore
    base-branch: main
    preserve-branch-name: true
    expires: 14d
    fallback-as-issue: false
strict: true
---

# Weekly Assistant Configuration Maintenance

Run the repository's weekly maintenance sweep for assistant customization sources.

## Goal

Keep the assistant capability model aligned with current vendor-documented repository-scoped customization resources.

## Process

1. Use the `assistant-config-curator` custom agent instructions for this run.
2. Treat `.github/prompts/review-assistant-config-sources.prompt.md` as the primary saved prompt policy.
3. Start in `maintenance` mode. Move to `combined` mode only if the maintenance review reveals a clearly distinct repository-scoped capability that cannot be represented as an update to an existing primitive.
4. Review `docs/configuration.md`, `packages/core/config/primitives.json`, `packages/core/config/assistants.json`, and relevant tests before editing anything.
5. Fetch and compare the official vendor documentation listed in `docs/configuration.md` under `URLs To Monitor`.
6. Keep repository scanning limited to shareable repo files and prefer exact vendor-documented filenames or suffixes over broad globs.
7. If scanner behavior changes, run the smallest relevant test scope, starting with `packages/core/tests` and extending to `backend/tests/unit` only when the change crosses that boundary.
8. If no changes are justified, call `noop` with a concise summary of what was reviewed and why no repository edits were needed.
9. If changes are justified, make the minimal coherent edits and create a draft pull request.

## Required Output

Include:

- mode used
- assistants affected
- primitives affected
- exact repository-scoped resources changed or confirmed
- proxy limitations that remain
- tests run