## Plan: Shareable Report Permalinks

Server-side permalink system using SQLite storage. After scanning a repo, users get a "Share" button that persists the result snapshot and produces a UUID-based URL (`/report/<uuid>`). Anyone opening that URL sees the full interactive report loaded from the stored snapshot. Reports expire after 90 days.

**Steps**

1. **Add `better-sqlite3` dependency** to `backend/package.json`. This is a synchronous, zero-config, file-based SQLite driver compatible with ESM/Node 20+.

2. **Create `backend/src/services/storage.js`** — SQLite wrapper module:
   - On import, initialize the DB file at a configurable path (env var `DB_PATH`, default `./data/reports.db`).
   - Create table `reports` with columns: `id TEXT PRIMARY KEY`, `repo_url TEXT NOT NULL`, `result JSON NOT NULL`, `created_at INTEGER NOT NULL`, `expires_at INTEGER NOT NULL`.
   - Export `saveReport(scanResult) → id` — generates a UUID via `crypto.randomUUID()`, stores the full scan result JSON, sets `expires_at` = now + 90 days, returns the UUID.
   - Export `getReport(id) → scanResult | null` — retrieves by UUID, returns `null` if not found or expired.
   - Export `cleanupExpired()` — deletes rows where `expires_at < now`. Called lazily on each `getReport` call (or on a timer).
   - Follow project conventions: ESM, JSDoc, singleton pattern (like config-loader), custom errors with `.statusCode`.

3. **Create `backend/src/routes/report.js`** — two new endpoints:
   - `POST /api/report` — accepts `{ result: <scanResult> }` body, calls `saveReport()`, responds with `{ id, url: "/report/<uuid>" }` (201 Created).
   - `GET /api/report/:id` — calls `getReport(id)`, responds with the full scan result JSON (200) or 404 if not found/expired.
   - Validate UUID format on GET to prevent injection. Rate-limit POST to prevent abuse (reuse existing rate limiter).

4. **Wire routes in `backend/src/server.js`** — import `reportRouter` and mount at `/api/report`. Add periodic cleanup interval (`setInterval(cleanupExpired, 1 hour)`), cleared on server shutdown.

5. **Create `data/` directory** and add `backend/data/.gitkeep`. Add `backend/data/reports.db` to `backend/.gitignore` (or create one). Ensure the Docker container has a volume mount for persistence.

6. **Frontend: add share button** in `frontend/src/js/report.js`:
   - After `renderReport()` builds the report DOM, append a "Share Report" button (`<button class="share-btn">`) at the top of the report area, next to the overall score.
   - On click: call `POST /api/report` with the current scan result → receive the UUID → construct full URL (`window.location.origin + "/report/" + id`) → copy to clipboard → show brief toast/feedback ("Link copied!").
   - Use `escapeHtml()` for any dynamic text per project XSS conventions.

7. **Frontend: add share API function** in `frontend/src/js/api.js`:
   - Export `shareReport(scanResult)` — POST to `/api/report`, returns `{ id, url }`.
   - Export `fetchSharedReport(id)` — GET from `/api/report/:id`, returns scan result or throws.
   - Follow existing patterns: `fetch` + `AbortController` (30s timeout), manual error with `.statusCode`.

8. **Frontend: URL-based loading** in `frontend/src/js/app.js`:
   - On `DOMContentLoaded`, check `window.location.pathname` for `/report/<uuid>` pattern (regex: `/^\/report\/([0-9a-f-]{36})$/`).
   - If matched: call `fetchSharedReport(uuid)` → `renderReport(result, container)` → show report area, hide scan form (or show it dimmed with a "Scan another repo" link). Add a visual indicator that this is a shared snapshot (e.g., "Shared report from <date>" banner with the repo URL).
   - If not matched: normal flow (show scan form).

9. **Frontend: share styles** in `frontend/src/styles/main.css`:
   - Style `.share-btn` consistent with existing button styles (use CSS custom properties).
   - Style the "copied" toast feedback (small absolute-positioned tooltip, auto-dismiss after 2s).
   - Style the shared-report banner (subtle info bar above the report).

10. **Nginx routing** — `frontend/nginx.conf` already has `try_files $uri $uri/ /index.html` which serves the SPA for `/report/*` paths. No changes needed.

11. **Docker volume** — update `docker-compose.yml` to add a named volume for the backend's `./data/` directory so SQLite persists across container restarts.

12. **Tests**:
    - **Unit**: `tests/unit/storage.test.js` — test `saveReport`, `getReport`, `cleanupExpired` with an in-memory SQLite DB (`:memory:`) or temp file.
    - **Contract**: `tests/contract/report.test.js` — validate response shape of `POST /api/report` and `GET /api/report/:id`.
    - **Integration**: `tests/integration/report.test.js` — end-to-end: scan → share → retrieve → verify payload match.
    - Use `vi.mock()` for storage boundaries in route tests, consistent with existing test patterns.

**Verification**
- Run `npm test` in backend — all new + existing tests pass.
- Run `npm run lint` in both packages — no lint errors.
- Manual test: scan a repo → click Share → open link in incognito → see identical report.
- Docker: `docker compose up --build`, verify the volume persists data across `docker compose down && docker compose up`.
- Verify 90-day expiry: insert a record with past `expires_at`, confirm GET returns 404.

**Decisions**
- **SQLite over in-memory**: persists across restarts, no external cloud dependency.
- **UUID over short ID**: simpler generation (`crypto.randomUUID()`), no collision handling, inherently unguessable.
- **Store full result JSON**: self-contained snapshot, no need to re-derive scores. Payload is small (~2-4 KB).
- **Lazy + periodic cleanup**: expired rows deleted both on read (lazy) and via hourly interval (bulk), balancing responsiveness and storage hygiene.
- **POST /api/report separate from POST /api/scan**: sharing is opt-in; scans remain stateless. This preserves the existing architecture and avoids storing every scan.
