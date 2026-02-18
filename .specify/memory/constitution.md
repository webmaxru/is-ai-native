<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0
  Modified principles: N/A (initial creation)
  Added sections:
    - Core Principles (4 principles: Code Quality, Testing,
      UX Consistency, Performance)
    - Development Workflow
    - Quality Gates
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ aligned
    - .specify/templates/spec-template.md ✅ aligned
    - .specify/templates/tasks-template.md ✅ aligned
  Follow-up TODOs: None
-->

# is-ai-native Constitution

## Core Principles

### I. Code Quality Excellence

All code committed to the repository MUST meet the following
non-negotiable standards:

- **Readability first**: Code MUST be self-documenting. Favor
  explicit naming over comments that restate what code does.
- **Single responsibility**: Every function, module, and class
  MUST serve a single, clearly defined purpose.
- **Type safety**: All code MUST use static typing or type
  annotations where the language supports them. Any usage of
  `any` or equivalent escape-hatch types MUST be justified in
  a comment.
- **No dead code**: Commented-out code, unused imports, and
  unreachable branches MUST NOT be merged. Remove before PR.
- **Linting and formatting**: All code MUST pass the project's
  configured linter and formatter with zero warnings. CI MUST
  enforce this gate automatically.
- **Small diffs**: Pull requests SHOULD target fewer than 400
  changed lines. Larger changes MUST be split into stacked PRs
  or accompanied by a written rationale.

**Rationale**: Consistent, clean code reduces onboarding time,
minimizes bug surface area, and enables confident refactoring.

### II. Testing Standards (NON-NEGOTIABLE)

Every feature and bug fix MUST include automated tests before
merge:

- **Unit tests**: All business logic functions MUST have
  corresponding unit tests covering happy path, edge cases,
  and error conditions.
- **Integration tests**: Cross-component interactions, API
  boundaries, and data-layer operations MUST have integration
  tests that exercise real (or accurately emulated) dependencies.
- **Contract tests**: Every public API endpoint MUST have
  contract tests validating request/response schemas.
- **Coverage threshold**: New code MUST maintain or increase the
  project's overall test coverage. No PR may reduce coverage
  below the configured minimum (set in CI).
- **Test independence**: Each test MUST be independent — no
  shared mutable state, no ordering dependencies, no reliance
  on external network services without mocks or containers.
- **Naming convention**: Test names MUST describe the scenario
  under test using the pattern
  `<unit>_<scenario>_<expectedOutcome>` or an equivalent
  Given-When-Then structure.

**Rationale**: Automated tests are the primary safety net for
continuous delivery. Untested code is unshippable code.

### III. User Experience Consistency

All user-facing surfaces MUST deliver a coherent, accessible,
and predictable experience:

- **Design system adherence**: UI components MUST use the
  project's shared design tokens (colors, spacing, typography).
  One-off styles MUST NOT be introduced without design review.
- **Accessibility**: All interfaces MUST meet WCAG 2.1 Level AA.
  Interactive elements MUST be keyboard-navigable, have visible
  focus indicators, and carry appropriate ARIA attributes.
- **Error states**: Every user action that can fail MUST present
  a clear, actionable error message. Raw technical errors
  (stack traces, status codes) MUST NOT be displayed to users.
- **Loading states**: All asynchronous operations MUST show a
  loading indicator within 200 ms of initiation. Skeleton
  screens are preferred over spinners for content areas.
- **Responsive design**: All pages MUST render correctly on
  viewports from 320 px to 2560 px wide. Breakpoints MUST
  follow the project's defined grid system.
- **Empty states**: Every list, table, or data view MUST handle
  the zero-data case with guidance on how to populate it.

**Rationale**: Users judge product quality by consistency and
polish. Inconsistent UX erodes trust faster than missing features.

### IV. Performance Requirements

All features MUST respect measurable performance budgets:

- **Time to Interactive (TTI)**: Pages MUST reach interactive
  state within 3 seconds on a mid-range mobile device over a
  4G connection.
- **Interaction responsiveness**: User-initiated actions MUST
  produce visual feedback within 100 ms. Operations exceeding
  1 second MUST display progress indication.
- **API latency**: Server endpoints MUST respond within 200 ms
  at p95 under normal load. Endpoints exceeding this MUST be
  flagged for optimization.
- **Bundle size**: Client-side JavaScript bundles MUST NOT exceed
  the project's configured size budget. New dependencies MUST
  be evaluated for size impact before adoption.
- **Memory and resource efficiency**: Long-running processes MUST
  NOT exhibit unbounded memory growth. Resource-intensive
  operations MUST implement pagination, streaming, or batching.
- **Regression prevention**: Performance benchmarks MUST run in
  CI. Any regression beyond 10% on tracked metrics MUST block
  the merge.

**Rationale**: Performance is a feature. Degradation compounds
over time and disproportionately affects users on constrained
devices and networks.

## Development Workflow

The following workflow governs how changes move from idea to
production:

- **Branch strategy**: All work MUST happen on feature branches
  named `<issue-number>-<short-description>`. Direct commits to
  the default branch are prohibited.
- **Code review**: Every PR MUST be reviewed by at least one team
  member who did not author the code. Reviewers MUST verify
  compliance with all four Core Principles.
- **Commit messages**: Commits MUST follow Conventional Commits
  format (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, etc.).
- **CI pipeline**: All PRs MUST pass linting, type checking,
  tests, coverage gates, bundle-size checks, and performance
  benchmarks before merge is permitted.
- **Documentation**: Public APIs, configuration options, and
  architectural decisions MUST be documented. Docs MUST be
  updated in the same PR as the code change.

## Quality Gates

The following gates MUST pass before any PR is eligible for merge:

| Gate | Tool / Method | Threshold |
|------|---------------|-----------|
| Lint | Project linter (zero warnings) | 0 warnings |
| Type check | Static type checker | 0 errors |
| Unit tests | Test runner | 100% pass |
| Integration tests | Test runner | 100% pass |
| Code coverage | Coverage reporter | ≥ configured min |
| Bundle size | Size budget tool | ≤ budget |
| Accessibility | Automated a11y scanner | 0 critical/serious |
| Performance | CI benchmark suite | ≤ 10% regression |
| Code review | Peer review | ≥ 1 approval |

## Governance

This constitution is the authoritative source of engineering
standards for the is-ai-native project. It supersedes ad-hoc
conventions, tribal knowledge, and informal agreements.

- **Compliance**: All pull requests and code reviews MUST verify
  adherence to the Core Principles. Non-compliant code MUST NOT
  be merged regardless of urgency.
- **Amendments**: Changes to this constitution MUST be proposed
  via a dedicated PR, reviewed by at least two team members, and
  accompanied by a migration plan for any existing code that
  would become non-compliant.
- **Versioning**: The constitution follows Semantic Versioning:
  - MAJOR: Principle removal or backward-incompatible
    redefinition.
  - MINOR: New principle, section, or material expansion.
  - PATCH: Clarification, wording, or formatting fixes.
- **Review cadence**: The constitution MUST be reviewed quarterly
  to ensure principles remain relevant and thresholds are
  appropriately calibrated.

**Version**: 1.0.0 | **Ratified**: 2026-02-18 | **Last Amended**: 2026-02-18
