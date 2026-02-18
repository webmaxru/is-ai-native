# Backend Requirements Quality Checklist: AI-Native Development Readiness Checker

**Purpose**: Validate completeness, clarity, and consistency of backend-related requirements
**Created**: 2026-02-18
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [ ] CHK001 - Are the JSON configuration file schemas specified (required fields, data types, validation rules for primitives.json and assistants.json)? [Completeness, Spec §FR-009]
- [ ] CHK002 - Is it specified how file path patterns work — exact match, glob patterns, regex, or another mechanism? [Completeness, Spec §FR-003]
- [ ] CHK003 - Are requirements defined for what happens when a JSON configuration file is malformed or missing at startup? [Completeness, Gap]
- [ ] CHK004 - Are requirements specified for the API response format (JSON schema, field names, nesting structure) of the scan endpoint? [Completeness, Spec §FR-006]
- [ ] CHK005 - Are requirements specified for how the GitHub API token is configured (environment variable name, validation at startup)? [Completeness, Assumptions]
- [ ] CHK006 - Is the expected structure of a "primitive category" fully defined — what constitutes a category vs. an individual primitive? [Completeness, Spec §FR-004, FR-007]
- [ ] CHK007 - Are requirements specified for the API request format (request body schema, required vs optional fields, the branch parameter)? [Completeness, Spec §FR-003]
- [ ] CHK008 - Is the relationship between assistants.json and primitives.json specified (separate files, single file, cross-referencing mechanism)? [Completeness, Spec §FR-009]
- [ ] CHK009 - Are requirements defined for how the system determines the repository's default branch name? [Completeness, Assumptions]
- [ ] CHK010 - Are CORS requirements specified for the backend API to accept requests from the frontend? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK011 - Is "the most straightforward option" for checking GitHub repo contents quantified with a specific API approach? [Clarity, Spec Input Description]
- [ ] CHK012 - Is "modular fashion" for detection mechanism defined with specific architectural criteria (plugin interface, config-driven, etc.)? [Clarity, Spec §FR-010]
- [ ] CHK013 - Is "configurable file path patterns" precisely defined — what pattern syntax is supported and how are patterns matched against the file tree? [Clarity, Spec §FR-003]
- [ ] CHK014 - Is "service availability issues" specified with concrete failure scenarios (DNS failure, timeout, 5xx from GitHub)? [Clarity, Spec §FR-011]
- [ ] CHK015 - Is "without code changes" in FR-010 precisely scoped — does it mean no code changes at all, or no changes to detection logic specifically? [Clarity, Spec §FR-010]
- [ ] CHK016 - Is "detailed report" decomposed into the specific data fields the backend must return per primitive? [Clarity, Spec §FR-006]

## Requirement Consistency

- [ ] CHK017 - Does the hybrid score calculation (Assumptions) align with how FR-007 describes "proportion of detected primitive categories"? [Consistency, Spec §FR-007 vs Assumptions]
- [ ] CHK018 - Are the five primitive categories in FR-004 (instructions, prompts, agents, skills, MCP config) consistent with the Key Entities section's category list? [Consistency, Spec §FR-004 vs Key Entities]
- [ ] CHK019 - Is the scan result entity (Key Entities) consistent with what FR-006 and FR-008 require the API to return? [Consistency, Spec Key Entities vs FR-006, FR-008]
- [ ] CHK020 - Does the edge case "repository has an extremely large file tree" have a defined threshold consistent with SC-001's "10,000 files" limit? [Consistency, Edge Cases vs SC-001]

## Acceptance Criteria Quality

- [ ] CHK021 - Can SC-002 ("100% of AI-native primitives... zero false negatives") be tested without exhaustively scanning every possible repository? [Measurability, Spec §SC-002]
- [ ] CHK022 - Can SC-004 ("JSON configuration file update and a service restart") be verified with an automated test? [Measurability, Spec §SC-004]
- [ ] CHK023 - Can "handles it gracefully within reasonable time limits" for large repos be objectively measured? [Measurability, Edge Cases]

## Scenario Coverage

- [ ] CHK024 - Are requirements defined for concurrent scan requests (multiple users scanning different repos simultaneously)? [Coverage, Gap]
- [ ] CHK025 - Are requirements specified for what happens when the GitHub API returns a truncated tree response (repos with >100,000 entries)? [Coverage, Edge Case, Gap]
- [ ] CHK026 - Are requirements defined for handling GitHub API pagination if the file tree exceeds a single response? [Coverage, Gap]
- [ ] CHK027 - Are timeout requirements specified for the GitHub API call (what if GitHub is slow but not down)? [Coverage, Gap]
- [ ] CHK028 - Are requirements defined for URL normalization (trailing slashes, `.git` suffix, case sensitivity, branch in URL)? [Coverage, Gap]
- [ ] CHK029 - Are requirements specified for repos with submodules — should submodule file trees be scanned? [Coverage, Edge Case, Gap]
- [ ] CHK030 - Are requirements defined for repos hosted on GitHub Enterprise vs github.com? [Coverage, Edge Case, Gap]

## Dependencies & Assumptions

- [ ] CHK031 - Is the assumption "does not need to clone the repository" validated against the chosen GitHub API approach's capabilities? [Assumption]
- [ ] CHK032 - Is the assumption of 60 req/hour unauthenticated rate limit current and accurate for the GitHub REST API? [Assumption]
- [ ] CHK033 - Is the assumption that the GitHub token is "never exposed to the frontend" enforceable architecturally? [Assumption]
- [ ] CHK034 - Is the assumption that JSON config changes require a "service restart" intentional, or should hot-reload be considered? [Assumption]

## Ambiguities & Conflicts

- [ ] CHK035 - FR numbering skips from FR-011 to FR-013 — is FR-012 intentionally placed after FR-013 or is this a sequencing error? [Ambiguity]
- [ ] CHK036 - The spec lists 5 primitive categories (FR-004) but the score is "per category" — are categories the same as the 5 listed, or can they differ per configuration? [Ambiguity, Spec §FR-004 vs FR-007]
- [ ] CHK037 - Is "at least one documentation link" (FR-012) a hard validation rule on the JSON config, or a best-effort guideline? [Ambiguity, Spec §FR-012]

## Notes

- Items referencing `[Gap]` indicate requirements not present in the current spec and plan.
- The plan identifies `primitives.json` and `assistants.json` as separate config files, but the spec does not define whether these are one file or multiple — this should be resolved.
- FR numbering discontinuity (FR-011, FR-013, FR-012) should be corrected for clarity.
