# Backend Requirements Quality Checklist: AI-Native Development Readiness Checker

**Purpose**: Validate completeness, clarity, and consistency of backend-related requirements
**Created**: 2026-02-18
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 - Are the JSON configuration file schemas specified (required fields, data types, validation rules for primitives.json and assistants.json)? [Completeness, Spec §FR-009] — **Resolved**: T006/T007 define config structure; T032 implements schema validation with required fields: name, category, patterns, description, docLinks.
- [x] CHK002 - Is it specified how file path patterns work — exact match, glob patterns, regex, or another mechanism? [Completeness, Spec §FR-003] — **Resolved**: Glob-style patterns using minimatch library, matched against GitHub file tree paths.
- [x] CHK003 - Are requirements defined for what happens when a JSON configuration file is malformed or missing at startup? [Completeness, Gap] — **Resolved**: T032 (config-loader) validates JSON on startup; rejects malformed/missing with clear error messages.
- [x] CHK004 - Are requirements specified for the API response format (JSON schema, field names, nesting structure) of the scan endpoint? [Completeness, Spec §FR-006] — **Resolved**: T015 (contract tests) define exact response schema; T018 implements it.
- [x] CHK005 - Are requirements specified for how the GitHub API token is configured (environment variable name, validation at startup)? [Completeness, Assumptions] — **Resolved**: GITHUB_TOKEN env var, optional. T010 configures it; startup logs warning if absent.
- [x] CHK006 - Is the expected structure of a "primitive category" fully defined — what constitutes a category vs. an individual primitive? [Completeness, Spec §FR-004, FR-007] — **Resolved**: 5 categories per FR-004 (instructions, prompts, agents, skills, MCP config). Each category contains multiple primitives per assistant.
- [x] CHK007 - Are requirements specified for the API request format (request body schema, required vs optional fields, the branch parameter)? [Completeness, Spec §FR-003] — **Resolved**: POST body: { url (required), branch (optional, defaults to repo default) }. Defined in T015 contract tests.
- [x] CHK008 - Is the relationship between assistants.json and primitives.json specified (separate files, single file, cross-referencing mechanism)? [Completeness, Spec §FR-009] — **Resolved**: Separate files. assistants.json defines assistant metadata; primitives.json references assistant IDs for pattern association.
- [x] CHK009 - Are requirements defined for how the system determines the repository's default branch name? [Completeness, Assumptions] — **Resolved**: GitHub REST API returns default branch in repo metadata. T009 (github service) fetches this.
- [x] CHK010 - Are CORS requirements specified for the backend API to accept requests from the frontend? [Completeness, Gap] — **Resolved**: T010 configures Express CORS middleware. Allows frontend origin in dev and production.

## Requirement Clarity

- [x] CHK011 - Is "the most straightforward option" for checking GitHub repo contents quantified with a specific API approach? [Clarity, Spec Input Description] — **Resolved**: GitHub REST API Git Trees endpoint (recursive). Specified in plan.md and T009.
- [x] CHK012 - Is "modular fashion" for detection mechanism defined with specific architectural criteria (plugin interface, config-driven, etc.)? [Clarity, Spec §FR-010] — **Resolved**: Config-driven via JSON files. Scanner loads patterns from primitives.json; no plugin interface needed for v1.
- [x] CHK013 - Is "configurable file path patterns" precisely defined — what pattern syntax is supported and how are patterns matched against the file tree? [Clarity, Spec §FR-003] — **Resolved**: Glob patterns (minimatch), matched against file tree paths returned by GitHub API.
- [x] CHK014 - Is "service availability issues" specified with concrete failure scenarios (DNS failure, timeout, 5xx from GitHub)? [Clarity, Spec §FR-011] — **Resolved**: T011 (error-handler) handles: network errors, timeouts (10s default), 403/private, 404/not-found, 429/rate-limit, 5xx/server errors.
- [x] CHK015 - Is "without code changes" in FR-010 precisely scoped — does it mean no code changes at all, or no changes to detection logic specifically? [Clarity, Spec §FR-010] — **Resolved**: No changes to detection/scoring logic. Only JSON config updates + service restart.
- [x] CHK016 - Is "detailed report" decomposed into the specific data fields the backend must return per primitive? [Clarity, Spec §FR-006] — **Resolved**: Per-primitive fields: name, category, detected (bool), matchedFiles (array), description, docLinks (array), assistants (array).

## Requirement Consistency

- [x] CHK017 - Does the hybrid score calculation (Assumptions) align with how FR-007 describes "proportion of detected primitive categories"? [Consistency, Spec §FR-007 vs Assumptions] — **Resolved**: Consistent. Overall = categories with any match / total categories × 100.
- [x] CHK018 - Are the five primitive categories in FR-004 (instructions, prompts, agents, skills, MCP config) consistent with the Key Entities section's category list? [Consistency, Spec §FR-004 vs Key Entities] — **Resolved**: Consistent. Both list the same 5 categories.
- [x] CHK019 - Is the scan result entity (Key Entities) consistent with what FR-006 and FR-008 require the API to return? [Consistency, Spec Key Entities vs FR-006, FR-008] — **Resolved**: Consistent. Entity maps to response fields: repoUrl, timestamp, overallScore, perAssistant, primitives.
- [x] CHK020 - Does the edge case "repository has an extremely large file tree" have a defined threshold consistent with SC-001's "10,000 files" limit? [Consistency, Edge Cases vs SC-001] — **Resolved**: Consistent. "Extremely large" = >10,000 files per SC-001. T040 handles optimization.

## Acceptance Criteria Quality

- [x] CHK021 - Can SC-002 ("100% of AI-native primitives... zero false negatives") be tested without exhaustively scanning every possible repository? [Measurability, Spec §SC-002] — **Resolved**: Yes. Unit tests (T013) use synthetic file trees covering all configured patterns. Tests verify both positive matches and non-matches.
- [x] CHK022 - Can SC-004 ("JSON configuration file update and a service restart") be verified with an automated test? [Measurability, Spec §SC-004] — **Resolved**: Yes. T031 tests config-loader with modified configs. Integration test verifies new primitives appear in scan results.
- [x] CHK023 - Can "handles it gracefully within reasonable time limits" for large repos be objectively measured? [Measurability, Edge Cases] — **Resolved**: Yes. T039 benchmarks scan latency for repos with 100, 1,000, and 10,000 files against ≤15s threshold.

## Scenario Coverage

- [x] CHK024 - Are requirements defined for concurrent scan requests (multiple users scanning different repos simultaneously)? [Coverage, Gap] — **Resolved**: Stateless architecture handles concurrency naturally. No shared mutable state. Express handles concurrent requests out of the box.
- [x] CHK025 - Are requirements specified for what happens when the GitHub API returns a truncated tree response (repos with >100,000 entries)? [Coverage, Edge Case, Gap] — **Resolved**: T040 handles truncated responses by falling back to recursive fetching. Returns partial results if tree too large.
- [x] CHK026 - Are requirements defined for handling GitHub API pagination if the file tree exceeds a single response? [Coverage, Gap] — **Resolved**: Git Trees API with recursive=1 returns full tree. T040 handles pagination for edge cases.
- [x] CHK027 - Are timeout requirements specified for the GitHub API call (what if GitHub is slow but not down)? [Coverage, Gap] — **Resolved**: 10s timeout per GitHub API call. Error handler returns user-friendly timeout message.
- [x] CHK028 - Are requirements defined for URL normalization (trailing slashes, `.git` suffix, case sensitivity, branch in URL)? [Coverage, Gap] — **Resolved**: T008 (url-parser) strips trailing slashes, .git suffix. GitHub usernames/repos are case-insensitive.
- [x] CHK029 - Are requirements specified for repos with submodules — should submodule file trees be scanned? [Coverage, Edge Case, Gap] — **Resolved**: v1 does not scan submodule trees. Submodules appear as entries in the tree but are not recursed into. Known limitation.
- [x] CHK030 - Are requirements defined for repos hosted on GitHub Enterprise vs github.com? [Coverage, Edge Case, Gap] — **Resolved**: v1 supports github.com only. GitHub Enterprise URLs are rejected with a clear message. Future enhancement.

## Dependencies & Assumptions

- [x] CHK031 - Is the assumption "does not need to clone the repository" validated against the chosen GitHub API approach's capabilities? [Assumption] — **Resolved**: Confirmed. GitHub Git Trees API returns full file tree without cloning.
- [x] CHK032 - Is the assumption of 60 req/hour unauthenticated rate limit current and accurate for the GitHub REST API? [Assumption] — **Resolved**: Accurate per current GitHub API documentation.
- [x] CHK033 - Is the assumption that the GitHub token is "never exposed to the frontend" enforceable architecturally? [Assumption] — **Resolved**: Token is backend-only env var. Error handler sanitizes responses. Never included in API output.
- [x] CHK034 - Is the assumption that JSON config changes require a "service restart" intentional, or should hot-reload be considered? [Assumption] — **Resolved**: Intentional for v1 simplicity. Hot-reload is a documented future enhancement.

## Ambiguities & Conflicts

- [x] CHK035 - FR numbering skips from FR-011 to FR-013 — is FR-012 intentionally placed after FR-013 or is this a sequencing error? [Ambiguity] — **Resolved**: Cosmetic numbering issue in spec. FR-012 is the progress indicator requirement. No functional impact.
- [x] CHK036 - The spec lists 5 primitive categories (FR-004) but the score is "per category" — are categories the same as the 5 listed, or can they differ per configuration? [Ambiguity, Spec §FR-004 vs FR-007] — **Resolved**: Default 5 categories per FR-004. Config can define additional categories; scoring adapts dynamically.
- [x] CHK037 - Is "at least one documentation link" (FR-012) a hard validation rule on the JSON config, or a best-effort guideline? [Ambiguity, Spec §FR-012] — **Resolved**: Hard validation rule. Config-loader (T032) rejects primitives with empty docLinks array.

## Notes

- Items referencing `[Gap]` indicate requirements not present in the current spec and plan.
- The plan identifies `primitives.json` and `assistants.json` as separate config files, but the spec does not define whether these are one file or multiple — this should be resolved.
- FR numbering discontinuity (FR-011, FR-013, FR-012) should be corrected for clarity.
