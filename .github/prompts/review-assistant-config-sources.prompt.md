---
description: Review official assistant customization docs and update scanner config if vendor file paths changed
---

Review the official assistant customization URLs listed in the `URLs To Monitor` section of [docs/configuration.md](../../docs/configuration.md) and compare them against the scanner configuration in [backend/src/config/primitives.json](../../backend/src/config/primitives.json) and [backend/src/config/assistants.json](../../backend/src/config/assistants.json).

Your task:

1. Check whether any currently evaluated primitive has a stale path pattern, missing documented repository-scoped resource, or outdated documentation link.
2. Update `backend/src/config/primitives.json` only when the vendor documentation clearly supports the new or changed repository-scoped pattern.
3. Keep repository scanning limited to shareable repo files. Do not add user-only or machine-local paths as scan patterns.
4. Update `docLinks` in `backend/src/config/primitives.json` and metadata links in `backend/src/config/assistants.json` when the official docs have moved or when a primitive needs assistant-specific documentation coverage.
5. Update [docs/configuration.md](../../docs/configuration.md) so the official resource matrix and URL list stay in sync with the code, and keep a specific source link for every primitive/assistant row.
6. If a documented capability is only represented by a shared config file such as `.codex/config.toml`, call out that file-presence scanning is only a proxy and that the scanner is not validating the specific TOML section.
7. If you change scanner patterns, run the relevant backend tests and summarize exactly which primitives changed and why.

Constraints:

- Prefer exact vendor-documented file names over loose folder globs when the docs specify a suffix or entry file.
- Call out legacy-vs-current formats explicitly instead of silently replacing one with the other.
- Do not invent support for a primitive when the vendor docs only show an adjacent feature.
- Review `backend/src/config/assistants.json` as well as `backend/src/config/primitives.json`; stale assistant metadata links should be updated alongside primitive links.