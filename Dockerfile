# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps

WORKDIR /app

# Install backend production dependencies, including the linked workspace core package.
COPY webapp/backend/package.json ./backend/package.json
COPY webapp/backend/package-lock.json ./backend/package-lock.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/core/src ./packages/core/src
COPY packages/core/config ./packages/core/config
RUN npm ci --omit=dev --prefix ./backend
RUN cd ./packages/core && npm install --omit=dev

# ── Runtime image ──────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app/backend

# Copy package.json so Node recognises the directory as ESM ("type": "module")
COPY webapp/backend/package.json ./package.json

# Copy backend node_modules from deps stage together with the linked workspace package target.
# npm installs @is-ai-native/core as ../../../../packages/core from /app/backend/node_modules/@is-ai-native,
# so the runtime image must expose that package at /packages/core.
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=deps /app/packages /packages

# Copy backend source
COPY webapp/backend/src ./src

# Copy runtime frontend assets so Express can serve them in the single-container image
COPY webapp/frontend/index.html ../frontend/index.html
COPY webapp/frontend/assets ../frontend/assets
COPY webapp/frontend/src ../frontend/src

ENV REPORTS_DIR=/app/data/reports

# Update base packages and remove package-manager tooling not needed at runtime
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  && mkdir -p /app/data \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
