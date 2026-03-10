## Plan: Private Repo Scan Support

Enable scanning of private GitHub repositories that are accessible to the server-configured `GH_TOKEN_FOR_SCAN`, while keeping auth entirely server-side. The recommended approach is to avoid any new user-token flow or backend state: keep the existing runtime token path, tighten GitHub error handling so it no longer claims private repos are unsupported, add explicit tests for authenticated private-repo scans and inaccessible private repos, and update product/docs copy that currently hard-codes public-only behavior.

**Steps**
1. Confirm the product contract change in backend behavior: treat any repository reachable with the instance-level `GH_TOKEN_FOR_SCAN` as supported, while repos not reachable by that token should return a clear access-related error instead of the current public-only messaging.
2. Phase 1 — Backend semantics: update `backend/src/services/github.js` so authenticated requests remain the primary path, existing unauthenticated fallback still protects public-repo scans from broken tokens, and final 403/404 messages distinguish between "not found" and "this instance may not have access to a private repo" without leaking token details.
3. Phase 1 — Backend routing and error mapping: verify `backend/src/routes/scan.js` can stay architecture-identical (still passing `runtime.githubToken`) and only adjust request/telemetry wording if needed; keep `backend/src/middleware/error-handler.js` aligned with any revised `GitHubApiError` statuses/messages. This step depends on step 2.
4. Phase 2 — Product copy and API-facing messaging: update user-facing text that still says public-only in the SPA and docs. Keep frontend architecture unchanged unless a tiny copy tweak is needed in `frontend/index.html`; no new inputs, no token persistence, no session/auth layer.
5. Phase 2 — Configuration and deployment docs: update README and any deployment guidance so `GH_TOKEN_FOR_SCAN` is documented as both a rate-limit improvement and the mechanism for scanning private repos that the token can access. This can run in parallel with step 4.
6. Phase 3 — Test coverage: expand GitHub service unit tests for three cases: valid server token can scan a private repo, unauthenticated/inaccessible private repo returns a clear access error, and broken token still falls back correctly for public repos. Add or extend API-level tests around `POST /api/scan` to assert the private-repo happy path and inaccessible path. This depends on steps 2 and 3.
7. Phase 3 — Spec alignment: update product/spec artifacts that explicitly require public-only support so they match the new behavior and do not reintroduce contradictory acceptance criteria. This can run after step 1 and in parallel with step 5.

**Relevant files**
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\src\services\github.js` — reuse `fetchRepoTree`, `fetchGitHubJson`, `shouldRetryUnauthenticated`, and `handleErrorResponse`; this is the core place where private-repo support messaging and fallback behavior must be corrected.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\src\routes\scan.js` — verify the existing `runtime.githubToken` flow remains sufficient; only touch request/result handling if error semantics need route-level support.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\src\middleware\error-handler.js` — keep HTTP mapping and sanitized client messages consistent with any revised `GitHubApiError` statuses.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\src\server.js` — reuse `githubTokenProvided` as the source of truth for whether server-side auth is configured; only change if the runtime contract needs a clearer name or comment.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\tests\unit\github.test.js` — extend the existing fallback/error tests instead of creating a separate GitHub service test file.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\tests\contract\health.test.js` — reuse existing token-present coverage if any capability messaging is surfaced indirectly through health/runtime assumptions.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\backend\tests\contract\report.test.js` — existing contract patterns here are useful as the template for a new scan contract test file if one is added.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\frontend\index.html` — update static copy that currently says "public GitHub repositories" if the UI should advertise private support when the instance is configured.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\README.md` — update environment variable, local run, and deployment guidance for `GH_TOKEN_FOR_SCAN`.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\specs\main\spec.md` — revise explicit public-only requirements and private-repo error expectations.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\specs\main\plan.md` — align the architecture/goal statement with authenticated private-repo support.
- `c:\Users\masalnik\Downloads\projects\is-ai-native\specs\main\tasks.md` — update any acceptance criteria or completed task language that still assumes private repos are unsupported.

**Verification**
1. Run backend unit tests focused on `backend/tests/unit/github.test.js` and confirm public fallback behavior still passes while new private-repo cases are covered.
2. Run backend contract or integration tests for `POST /api/scan`, covering: accessible private repo via server token, inaccessible private repo without suitable token access, invalid repo URL, and rate-limit behavior.
3. Manually verify a local scan against one known public repo and one known private repo reachable by the configured `GH_TOKEN_FOR_SCAN`.
4. Manually verify the failure message for an unreachable private repo does not claim private repos are unsupported and does not expose token data.
5. Confirm README/deployment guidance remains consistent across local `.env`, Docker Compose, and Azure Bicep/CD secret wiring.

**Decisions**
- Keep authentication server-only: no user-supplied PAT field, no browser persistence, no OAuth/session architecture.
- Reuse the existing `GH_TOKEN_FOR_SCAN` path already wired through runtime, Docker Compose, CD, and Bicep.
- Favor minimal frontend changes: copy updates only unless a stronger capability indicator is later requested.
- Included scope: backend GitHub error behavior, API behavior, tests, and documentation/spec alignment.
- Excluded scope: per-user credentials, GitHub App/OAuth flow, branch-selection UI, SSH-based access, report-sharing changes, and new persistence layers.

**Further Considerations**
1. Recommendation: keep the client-facing error phrased as access ambiguity when GitHub returns 404 under auth constraints, because GitHub intentionally hides some private repos behind 404; avoid promising exact differentiation when the API cannot guarantee it.
2. Recommendation: if discoverability becomes important later, expose a small capability flag through `/api/config` or similar, but do not include it in the first pass because it is not required for private-repo support itself.
3. Recommendation: document minimum PAT scopes explicitly in README/deployment docs so operators know the token must be able to read target private repositories.
