---
description: Add a new AI-native primitive from official vendor docs and implement it end-to-end in the app
---

Review the official assistant customization URLs listed in the `URLs To Monitor` section of [docs/configuration.md](../../docs/configuration.md), then determine whether the documented capability should become a new primitive in this app rather than just an update to an existing primitive.

Use [backend/src/config/primitives.json](../../backend/src/config/primitives.json), [backend/src/config/assistants.json](../../backend/src/config/assistants.json), and [docs/configuration.md](../../docs/configuration.md) as the source of truth for the current model.

Your task:

1. Verify from official vendor documentation that the capability is real, repository-scoped, and meaningfully distinct from the primitives already tracked by this app.
2. Decide whether the capability belongs in an existing primitive or requires a new primitive. Explain that decision explicitly before editing files.
3. If a new primitive is justified, add it to `backend/src/config/primitives.json` with:
   - a clear user-facing name
   - a category that is either existing and semantically correct, or a new one only if the concept is truly distinct
   - a description that explains what the primitive is and why it matters
   - `docLinks` that include the most relevant official sources across assistants
   - assistant-specific repository-scoped scan patterns only where vendor docs clearly support them
4. Update `backend/src/config/assistants.json` if assistant metadata links should also change as part of the same documentation update.
5. Update [docs/configuration.md](../../docs/configuration.md) so the official resource matrix, URL list, and any schema examples stay in sync with the code. Add a specific source link for every primitive and assistant row you touch.
6. If the new primitive is represented only by a shared config file such as `.codex/config.toml`, explicitly document that file-presence scanning is a proxy and that the app is not validating the specific subsection unless you also implement parser logic.
7. Review whether backend tests need to be added or updated for:
   - config loading
   - scanner matching
   - scoring implications
   - any renamed assistant display strings or changed expectations
8. Run the relevant backend tests and summarize exactly what changed, why it changed, and any remaining proxy limitations.

Constraints:

- Prefer exact vendor-documented file names and entrypoints over loose folder globs when the docs specify a suffix or required filename.
- Keep repository scanning limited to shareable repo files. Do not add user-only or machine-local paths as scan patterns.
- Call out legacy-vs-current formats explicitly instead of silently replacing one with the other.
- Do not invent support for a primitive when the vendor docs only show an adjacent or partially related feature.
- Do not add a new primitive if the capability is better represented as a documented expansion of an existing primitive.
- If the app can support the new primitive entirely through configuration, prefer that over introducing new backend logic.
- If new backend logic is genuinely required, implement the smallest defensible change and add tests for it.

Output expectations:

- State whether this was an existing-primitive update or a new primitive addition.
- List the exact assistants affected.
- List the exact repository-scoped resources now counted.
- Call out any proxy scanning behavior, limitations, or non-parsed config sections.