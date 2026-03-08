# Feature Specification: AI-Native Development Readiness Checker

**Feature Branch**: `main`  
**Created**: 2026-02-18  
**Status**: Draft  
**Input**: User description: "Build an application that can help users to evaluate AI-native development readiness of their projects by checking public github repository on presence of specific AI-native development primitives: instructions, saved prompts, custom agents, skills, MCP server configurations. The web frontend offers simple UI with an input for entering github repo url and passing it to the backend. Backend checks github repo contents using the most straightforward option and provides detailed report on what's present and what's missing. It also provides score. Checking feature is modular and ready for adding more criteria based on the file presence. It supports key AI-dev assistants: GitHub Copilot, Claude Code, OpenAI Codex and their AI-native dev primitives taxonomy and respective file path patterns. Supported ai-native dev primitives, file paths, ai-native dev assistants: it's all configurable on the backend via JSON files. For each AI-native dev primitive, it also provides description and links to the documentation."

## Clarifications

### Session 2026-02-18

- Q: How should the readiness score be calculated when the same primitive category exists across multiple AI assistants? → A: Hybrid — overall score uses categories (any match counts), per-assistant sections show individual primitive scores.
- Q: Which branch should the system scan? → A: Default branch only (e.g., main/master). Architecture must support future branch selection.
- Q: How should the UI communicate progress during a scan? → A: Progress bar showing scan stages (e.g., "Fetching file tree... Matching patterns... Generating report...").
- Q: Should the backend support a GitHub API token for higher rate limits? → A: Yes, optional server-side token via environment variable; falls back to unauthenticated if absent.
- Q: Should scan reports be shareable via URL? → A: Not in v1. Reports are session-only. Architecture must support future shareable URLs with persistent storage and GitHub label/badge generation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check Repository AI Readiness (Priority: P1)

A developer or team lead wants to quickly assess how well their public GitHub repository is set up for AI-native development. They visit the web application, paste their GitHub repository URL into the input field, and submit it. The system analyzes the repository's file structure and returns a detailed report showing which AI-native development primitives are present (e.g., instruction files, saved prompts, custom agent definitions, skills, MCP server configurations) and which are missing, along with an overall readiness score.

**Why this priority**: This is the core value proposition of the entire application. Without the ability to scan a repository and produce a readiness report, no other feature has meaning. This single story delivers the full end-to-end user journey.

**Independent Test**: Can be fully tested by entering a known GitHub repository URL and verifying the returned report contains correct detection results for each AI-native primitive, with an accurate score.

**Acceptance Scenarios**:

1. **Given** the user is on the web application homepage, **When** they enter a valid public GitHub repository URL (e.g., `https://github.com/owner/repo`) and submit, **Then** the system displays a detailed readiness report listing each AI-native development primitive category, whether it was found or not, and an overall readiness score.
2. **Given** the user submits a repository URL, **When** the repository contains some AI-native primitives (e.g., `.github/copilot-instructions.md` exists but no MCP configuration), **Then** the report accurately reflects which primitives are present and which are missing, with links to documentation for each primitive.
3. **Given** the user submits a repository URL, **When** the analysis completes, **Then** the readiness score is displayed as a percentage or numeric value reflecting the proportion of detected primitives relative to the total possible.
4. **Given** the user submits an invalid URL or a non-existent repository, **When** the system attempts to analyze it, **Then** a clear, user-friendly error message is displayed explaining the issue.
5. **Given** the user submits a valid repository URL, **When** the scan is in progress, **Then** a progress indicator is displayed showing the current stage (e.g., "Fetching file tree", "Matching patterns", "Generating report").

---

### User Story 2 - View Per-Assistant Breakdown (Priority: P2)

A developer wants to understand their repository's readiness for a specific AI development assistant (e.g., GitHub Copilot, Claude Code, or OpenAI Codex). After receiving the readiness report, they can see results grouped by AI assistant, showing which primitives each assistant supports and which of those are present in the repository.

**Why this priority**: Grouping results by AI assistant makes the report actionable — developers can focus on the assistant they actually use. This adds significant value on top of the core scan without changing the underlying detection logic.

**Independent Test**: Can be tested by scanning a repository and verifying the report sections are organized per AI assistant, with correct primitive-to-assistant mappings.

**Acceptance Scenarios**:

1. **Given** a readiness report has been generated, **When** the user views the report, **Then** results are grouped by supported AI assistant (GitHub Copilot, Claude Code, OpenAI Codex), showing which primitives each assistant expects.
2. **Given** a repository has primitives for one assistant but not another, **When** the user views the per-assistant breakdown, **Then** each assistant section accurately reflects only the primitives relevant to that assistant.

---

### User Story 3 - Learn About Missing Primitives (Priority: P3)

A developer sees that certain AI-native development primitives are missing from their repository and wants to understand what each primitive is, why it matters, and how to add it. For each primitive listed in the report, the system provides a description and links to official documentation.

**Why this priority**: Actionable guidance transforms the tool from a passive audit into an educational resource, driving adoption of AI-native practices. This builds on top of the core report.

**Independent Test**: Can be tested by verifying that each primitive in the report has an associated description and at least one documentation link, and that links resolve to valid pages.

**Acceptance Scenarios**:

1. **Given** the readiness report shows a missing primitive, **When** the user views the details for that primitive, **Then** a description explaining what the primitive is and why it is useful is displayed.
2. **Given** the readiness report lists a primitive, **When** the user looks for documentation links, **Then** at least one link to official documentation is provided for that primitive.

---

### User Story 4 - Configurable Primitive Definitions (Priority: P4)

A system administrator or contributor wants to update the set of recognized AI-native development primitives, their file path patterns, supported AI assistants, descriptions, and documentation links without modifying application code. They edit JSON configuration files on the backend, and the application picks up the changes.

**Why this priority**: Configurability ensures long-term maintainability and extensibility. New AI assistants or primitives can be added by editing JSON files rather than code changes. This is a developer/operator-facing story rather than end-user facing.

**Independent Test**: Can be tested by adding a new primitive entry to the JSON configuration, restarting the backend, and verifying the new primitive appears in scan results.

**Acceptance Scenarios**:

1. **Given** a backend JSON configuration file defines the list of AI-native primitives with their file path patterns, descriptions, documentation links, and associated AI assistants, **When** a new entry is added to the configuration, **Then** the application recognizes the new primitive during scans without code changes.
2. **Given** the configuration file defines file path patterns for a primitive, **When** a scan is performed, **Then** the system uses those patterns to detect the primitive in the repository.

---

### Edge Cases

- What happens when the user enters a URL for a private repository? The system should display a clear message that only public repositories are supported.
- What happens when the GitHub API is rate-limited or unavailable? The system should display a meaningful error message suggesting the user try again later, and indicate remaining rate limit if available.
- What happens when the repository is empty (no files)? The report should show all primitives as missing with a score of zero.
- What happens when the user enters a URL that is not a GitHub URL? The system should validate the input and display an error indicating only GitHub repository URLs are accepted.
- What happens when a repository has an extremely large file tree? The system should handle it gracefully within reasonable time limits.
- What happens when the same primitive file pattern matches multiple files? The primitive should be counted as present (detected) once.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a web-based user interface with a text input field for entering a GitHub repository URL and a submit button to initiate the scan.
- **FR-002**: System MUST validate that the submitted URL is a valid public GitHub repository URL before initiating analysis.
- **FR-003**: System MUST scan the file structure of the target public GitHub repository's default branch to detect the presence of AI-native development primitives based on configurable file path patterns. The scan interface should accept a branch parameter internally to enable future branch selection without refactoring.
- **FR-004**: System MUST support detection of the following categories of AI-native development primitives: instruction files, saved prompts, custom agent definitions, skills, and MCP server configurations.
- **FR-005**: System MUST support detection of primitives for at least these AI development assistants: GitHub Copilot, Claude Code, and OpenAI Codex.
- **FR-006**: System MUST generate a detailed readiness report listing each primitive, its detection status (present or missing), a description of the primitive, and at least one link to relevant documentation for each defined primitive.
- **FR-007**: System MUST calculate and display an overall AI-native readiness score based on the proportion of detected primitive categories (a category counts as detected if any assistant's pattern for it matches).
- **FR-008**: System MUST group results by AI development assistant, showing a per-assistant readiness score based on the proportion of that assistant's primitives detected.
- **FR-009**: System MUST load all primitive definitions, file path patterns, AI assistant mappings, descriptions, and documentation links from JSON configuration files on the backend.
- **FR-010**: System MUST implement the detection mechanism in a modular fashion so that new primitives and criteria can be added by updating configuration files without code changes.
- **FR-011**: System MUST display user-friendly error messages for invalid URLs, non-existent repositories, private repositories, and service availability issues.
- **FR-012**: System MUST display a progress indicator during the scan that communicates distinct stages to the user (e.g., "Fetching file tree", "Matching patterns", "Generating report"), so users understand the system is working and can anticipate completion.

### Key Entities

- **AI Assistant**: Represents a supported AI development tool (e.g., GitHub Copilot, Claude Code, OpenAI Codex). Has a name, identifier, and list of supported primitives.
- **AI-Native Primitive**: A specific development artifact that supports AI-assisted workflows. Has a name, category (instructions, prompts, agents, skills, MCP config), description, documentation links, and associated file path patterns per AI assistant.
- **Scan Result**: The outcome of analyzing a single repository. Contains the repository URL, timestamp, overall score, and a collection of per-primitive detection results.
- **Primitive Detection Result**: The detection outcome for a single primitive in a single repository. Indicates whether the primitive was found, which files matched, and which AI assistant(s) it relates to.
- **Primitive Configuration**: The backend-stored definition of all primitives loaded from JSON files. Includes file path patterns, descriptions, documentation links, and assistant associations.

## Assumptions

- The application only needs to support **public** GitHub repositories. No authentication or private repository access is required.
- The repository scan uses GitHub's public API or a straightforward mechanism (e.g., GitHub REST API for repository contents) to check for file existence via path patterns — it does not need to clone the repository.
- The system always scans the repository's **default branch** (e.g., `main` or `master`). The architecture should accept a branch parameter internally so that user-selectable branch scanning can be added in a future release without refactoring.
- The **overall readiness score** uses a hybrid model: it is calculated as (number of primitive categories with at least one detected pattern across any assistant / total defined primitive categories) × 100. Additionally, each per-assistant section displays its own score calculated as (detected primitives for that assistant / total primitives defined for that assistant) × 100. No weighting is applied.
- The application is a standard client-server web application with a frontend served to the browser and a backend providing the scan API.
- No user accounts, authentication, or persistent storage of scan results is needed — each scan is a stateless, on-demand operation. The report exists only in the current browser session.
- The architecture should structure scan results as a serializable data object so that future features (shareable report URLs with persistent storage, GitHub repository label/badge generation) can be added without refactoring the core scan logic or data model.
- Rate limiting from GitHub's API is handled gracefully with appropriate error messaging but not with queuing or retry mechanisms.
- The backend supports an **optional server-side GitHub API token** (configured via environment variable). When present, all GitHub API calls use it for the higher rate limit (5,000 req/hour). When absent, the system falls back to unauthenticated access (60 req/hour). The token is never exposed to the frontend or end users.
- The JSON configuration format is designed by the development team and not exposed to end users for editing through the UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can submit a GitHub repository URL and receive a complete readiness report within 15 seconds for repositories with up to 10,000 files.
- **SC-002**: The readiness report correctly identifies 100% of AI-native primitives that are defined in the configuration and present in the scanned repository (zero false negatives for configured patterns).
- **SC-003**: 90% of first-time users can complete a repository scan and understand the results without external guidance.
- **SC-004**: Adding a new AI-native primitive to the system requires only a JSON configuration file update and a service restart — no application code changes needed.
- **SC-005**: The system supports at least 3 AI development assistants (GitHub Copilot, Claude Code, OpenAI Codex) with their respective primitive taxonomies at launch.
- **SC-006**: Every primitive in the report includes a human-readable description and at least one working link to official documentation.
