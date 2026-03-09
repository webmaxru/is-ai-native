# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps

WORKDIR /app

# Install backend dependencies (production only)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── Runtime image ──────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

# Copy package.json so Node recognises the directory as ESM ("type": "module")
COPY backend/package.json ./package.json

# Copy backend node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy backend source
COPY backend/src ./src

# Copy runtime frontend assets so Express can serve them in the single-container image
COPY frontend/index.html ./frontend/index.html
COPY frontend/src ./frontend/src

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
