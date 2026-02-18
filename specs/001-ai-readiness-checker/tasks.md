# Tasks: AI-Native Development Readiness Checker

**Input**: Design documents from `/specs/001-ai-readiness-checker/`
**Prerequisites**: plan.md (loaded), spec.md (loaded)

**Tests**: Required per constitution Principle II (NON-NEGOTIABLE). Vitest for unit/integration, supertest for contract tests (per plan.md). Tests are written first and must fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/` (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, directory structure, and tooling configuration

- [ ] T001 Create project directory structure per plan.md layout (backend/src/config/, backend/src/services/, backend/src/routes/, backend/src/middleware/, backend/src/utils/, backend/tests/unit/, backend/tests/integration/, backend/tests/contract/, backend/tests/performance/, frontend/src/js/, frontend/src/styles/, frontend/src/assets/, frontend/tests/unit/)
- [ ] T002 Initialize backend Node.js project with Express, Vitest, and supertest dependencies in backend/package.json
- [ ] T003 [P] Initialize frontend Vite project with vanilla JS template and Vitest dependency in frontend/package.json and frontend/vite.config.js
- [ ] T004 [P] Configure ESLint and Prettier for backend in backend/.eslintrc.json and backend/.prettierrc
- [ ] T005 [P] Configure ESLint and Prettier for frontend in frontend/.eslintrc.json and frontend/.prettierrc

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create primitives configuration JSON with categories (instructions, prompts, agents, skills, MCP config), file path patterns per assistant, descriptions, and documentation links in backend/src/config/primitives.json
- [ ] T007 [P] Create AI assistants configuration JSON with assistant definitions (GitHub Copilot, Claude Code, OpenAI Codex) in backend/src/config/assistants.json
- [ ] T008 [P] Implement GitHub URL parser and validator (extract owner/repo, validate format, reject non-GitHub URLs) with JSDoc type annotations in backend/src/utils/url-parser.js
- [ ] T009 Implement GitHub API client service (fetch repository file tree via REST API using Git Trees endpoint, accept optional branch parameter defaulting to repository default branch, support optional auth token from GITHUB_TOKEN env var, differentiate 403/private from 404/not-found errors, handle rate limiting) with JSDoc type annotations in backend/src/services/github.js
- [ ] T010 Setup Express server entry point with CORS, JSON body parsing, environment variable configuration (GITHUB_TOKEN, PORT), and route mounting in backend/src/server.js
- [ ] T011 [P] Implement centralized error handler middleware (handle 404, validation errors, GitHub API 403 for private repos vs 404 for not-found, rate limits with remaining count, user-friendly messages — never expose raw errors or GitHub token) with JSDoc type annotations in backend/src/middleware/error-handler.js
- [ ] T012 [P] Configure GitHub Actions CI pipeline with lint, type check (JSDoc), unit tests, integration tests, coverage gate, bundle size check, a11y scan, and performance benchmark per constitution Quality Gates table in .github/workflows/ci.yml

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Check Repository AI Readiness (Priority: P1) 🎯 MVP

**Goal**: Users can submit a GitHub repository URL and receive a complete readiness report with overall score showing which AI-native primitives are present and missing

**Independent Test**: Enter a known GitHub repository URL and verify the returned report contains correct detection results for each AI-native primitive with an accurate overall score. Verify progress indicator updates during scan. Verify error messages for invalid URLs, non-existent repos, private repos, and empty repos.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Unit tests for url-parser (valid GitHub URLs, invalid URLs, non-GitHub URLs, edge cases like trailing slashes and .git suffix), scanner (pattern matching against file tree, no matches, multiple file matches for same primitive counted once), and scorer (category-based overall scoring, zero score for empty repo, full score) in backend/tests/unit/
- [ ] T014 [P] [US1] Integration test for POST /api/scan endpoint (valid repo → full report, invalid URL → 400, non-existent repo → 404, private repo → 403 with clear message, empty repo → zero score, rate-limited → 429 with retry-after) using supertest in backend/tests/integration/
- [ ] T015 [P] [US1] Contract test for POST /api/scan request/response schema validation (request body shape, response JSON structure with repo URL, timestamp, overall score, per-primitive results) using supertest in backend/tests/contract/

### Implementation for User Story 1

- [ ] T016 [US1] Implement pattern matching scanner service (load primitives.json, match file tree paths against configured glob/regex patterns, return per-primitive detection results with matched files) with JSDoc type annotations in backend/src/services/scanner.js
- [ ] T017 [US1] Implement overall score calculation (detected categories / total categories × 100, where a category counts as detected if any assistant pattern matches) with JSDoc type annotations in backend/src/services/scorer.js
- [ ] T018 [US1] Implement POST /api/scan route handler (accept repo URL in body, accept optional branch parameter, validate with url-parser, call github service, run scanner, compute score, return self-contained serializable JSON response object with repo URL, timestamp, overall score, and per-primitive results with progress stage headers) with JSDoc type annotations in backend/src/routes/scan.js
- [ ] T019 [P] [US1] Create main HTML page with repository URL input field, submit button, progress indicator area, error message area, and report container with WCAG 2.1 Level AA compliance (ARIA labels on form elements, keyboard-navigable controls, visible focus indicators, semantic HTML structure, skip-link) in frontend/src/index.html
- [ ] T020 [P] [US1] Create responsive CSS styles for input form, progress bar with stage text, error messages, report layout, detected/missing primitive styling, and mobile breakpoints with visible focus styles, sufficient color contrast ratios (4.5:1 minimum), and skip-link styling in frontend/src/styles/main.css
- [ ] T021 [US1] Implement backend API client module (POST to /api/scan, handle response parsing, error handling, timeout) with JSDoc type annotations in frontend/src/js/api.js
- [ ] T022 [US1] Implement main application logic (form submission handler, input validation, progress indicator with stages — "Fetching file tree", "Matching patterns", "Generating report", error display, trigger report rendering) with JSDoc type annotations in frontend/src/js/app.js
- [ ] T023 [US1] Implement basic report rendering (display overall readiness score, list each primitive category with detected/missing status, show matched file paths for detected primitives, handle zero-score and empty-repo states with guidance) with JSDoc type annotations in frontend/src/js/report.js

**Checkpoint**: User Story 1 is fully functional — users can scan a repo and see an overall readiness report

---

## Phase 4: User Story 2 — View Per-Assistant Breakdown (Priority: P2)

**Goal**: After receiving the readiness report, users can see results grouped by AI assistant with per-assistant scores

**Independent Test**: Scan a repository and verify report sections are organized per AI assistant (GitHub Copilot, Claude Code, OpenAI Codex) with correct primitive-to-assistant mappings and per-assistant scores

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T024 [P] [US2] Unit tests for per-assistant score calculation (per-assistant detected/total ratio, assistant with zero primitives found, assistant with all found) and contract test update for per-assistant response fields in backend/tests/

### Implementation for User Story 2

- [ ] T025 [US2] Extend scorer with per-assistant score calculation (for each assistant: detected primitives / total primitives defined for that assistant × 100) with JSDoc type annotations in backend/src/services/scorer.js
- [ ] T026 [US2] Update scan route response to include per-assistant breakdown (group detection results by assistant, include per-assistant scores alongside overall score) with JSDoc type annotations in backend/src/routes/scan.js
- [ ] T027 [US2] Extend report rendering to display per-assistant sections (collapsible or tabbed assistant groups, per-assistant score, list of relevant primitives with detected/missing status per assistant) with JSDoc type annotations in frontend/src/js/report.js

**Checkpoint**: Users can now see both overall score and per-assistant breakdown

---

## Phase 5: User Story 3 — Learn About Missing Primitives (Priority: P3)

**Goal**: Each primitive in the report includes a description explaining what it is and links to official documentation

**Independent Test**: Verify every primitive in the report has an associated description and at least one documentation link, and that links resolve to valid pages

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T028 [P] [US3] Contract test update verifying description and docLinks fields are present and non-empty for every primitive in POST /api/scan response in backend/tests/contract/

### Implementation for User Story 3

- [ ] T029 [US3] Extend scan route response to include primitive descriptions and documentation links from primitives.json for each detection result with JSDoc type annotations in backend/src/routes/scan.js
- [ ] T030 [US3] Extend report rendering to display primitive descriptions and clickable documentation links (especially prominent for missing primitives to guide adoption) with JSDoc type annotations in frontend/src/js/report.js

**Checkpoint**: Report now serves as an educational resource with descriptions and doc links for every primitive

---

## Phase 6: User Story 4 — Configurable Primitive Definitions (Priority: P4)

**Goal**: Administrators can update recognized primitives, patterns, assistants, descriptions, and doc links by editing JSON config files without code changes

**Independent Test**: Add a new primitive entry to primitives.json, restart the backend, scan a repository, and verify the new primitive appears in results

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T031 [P] [US4] Unit tests for config-loader (valid config loads successfully, missing required fields rejected with clear error, malformed JSON rejected, empty config file rejected, extra fields ignored gracefully) in backend/tests/unit/

### Implementation for User Story 4

- [ ] T032 [US4] Implement JSON configuration loader with schema validation (validate required fields: name, category, patterns, description, docLinks; report clear errors on malformed config) with JSDoc type annotations in backend/src/services/config-loader.js
- [ ] T033 [US4] Integrate config loader into server startup and refactor scanner/scorer to use validated config objects instead of direct JSON imports with JSDoc type annotations in backend/src/server.js and backend/src/services/scanner.js and backend/src/services/scorer.js
- [ ] T034 [US4] Document JSON configuration schema, supported fields, and step-by-step guide for adding new primitives and assistants in docs/configuration.md

**Checkpoint**: Configuration is fully validated and documented — new primitives can be added without code changes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Containerization, documentation, performance, and security improvements

- [ ] T035 [P] Create backend Dockerfile (Node.js 20 LTS base, copy source, install production deps, expose port, health check) in backend/Dockerfile
- [ ] T036 [P] Create frontend Dockerfile (Node.js 20 base for build stage, nginx for serve stage, copy built assets) in frontend/Dockerfile
- [ ] T037 Create docker-compose.yml for local multi-container setup (backend + frontend services, environment variables, port mapping, network) in docker-compose.yml
- [ ] T038 [P] Configure Vite bundle size budget (set max bundle size threshold, fail build on exceeded budget) in frontend/vite.config.js
- [ ] T039 Implement scan API performance benchmark script (measure scan latency for repos with 100, 1,000, and 10,000 files; validate ≤15s target from SC-001) in backend/tests/performance/benchmark.js
- [ ] T040 Optimize GitHub API file tree fetching for large repositories (recursive tree API, pagination, early termination for repos exceeding limits) in backend/src/services/github.js
- [ ] T041 Security hardening (sanitize user input, validate Content-Type, add rate limiting middleware, ensure GitHub token is never leaked in responses) across backend/src/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — Extends US1 scorer/report but is independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — Extends US1 response/report but is independently testable
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) — Adds config validation layer; best implemented after US1 for realistic testing

### Within Each User Story

- Tests MUST be written and FAIL before implementation begins
- Backend services before routes
- Routes before frontend integration
- Core implementation before polish
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005 can all run in parallel during Setup
- T007, T008, T011, T012 can run in parallel during Foundational (T006 and T009 may also parallel with T010)
- T013, T014, T015 (tests) can run in parallel at the start of US1
- T019, T020 can run in parallel with backend tasks (T016–T018) during US1
- T035, T036 can run in parallel during Polish
- T038 can run in parallel with T039
- Once Foundational is complete, US2, US3, US4 can start in parallel if team capacity allows

---

## Parallel Example: User Story 1

```bash
# Step 0 — Write tests FIRST (all in parallel):
Task: T013 "Unit tests for url-parser, scanner, scorer in backend/tests/unit/"
Task: T014 "Integration test for POST /api/scan in backend/tests/integration/"
Task: T015 "Contract test for POST /api/scan schema in backend/tests/contract/"

# Step 1 — Backend services (sequential: scanner needs config, scorer needs scanner output shape):
Task: T016 "Implement pattern matching scanner service in backend/src/services/scanner.js"
Task: T017 "Implement overall score calculation in backend/src/services/scorer.js"

# Step 1 (parallel with backend) — Frontend static files:
Task: T019 "Create main HTML page in frontend/src/index.html"
Task: T020 "Create responsive CSS styles in frontend/src/styles/main.css"

# Step 2 — Backend route (depends on T016, T017):
Task: T018 "Implement POST /api/scan route in backend/src/routes/scan.js"

# Step 3 — Frontend logic (depends on T018 for API contract, T019/T020 for HTML/CSS):
Task: T021 "Implement backend API client in frontend/src/js/api.js"
Task: T022 "Implement main app logic in frontend/src/js/app.js"
Task: T023 "Implement basic report rendering in frontend/src/js/report.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (tests first, then implementation)
4. **STOP and VALIDATE**: Test US1 independently — submit URLs, verify report accuracy, test error cases
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (**MVP!**)
3. Add User Story 2 → Test per-assistant breakdown → Deploy/Demo
4. Add User Story 3 → Test descriptions and doc links → Deploy/Demo
5. Add User Story 4 → Test config extensibility → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (P1 — MVP, highest priority)
   - Developer B: User Story 2 (P2 — once US1 API shape is defined)
   - Developer C: User Story 3 (P3 — once US1 response shape is defined)
3. User Story 4 integrates config validation after US1–US3 are stable
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests are MANDATORY per constitution Principle II — written before implementation, must fail first
- All implementation tasks include JSDoc type annotations per constitution Principle I
- Accessibility (WCAG 2.1 AA) is built into frontend tasks per constitution Principle III
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Config files (T006, T007) should be fully populated from the start with all fields (categories, patterns, descriptions, doc links) to avoid rework in later stories
