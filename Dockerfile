# syntax=docker/dockerfile:1

FROM node:24-slim AS deps

WORKDIR /app

# Install backend dependencies (production only)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── Runtime image ──────────────────────────────────────────────────
FROM node:24-slim

WORKDIR /app

# Copy backend node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy backend source
COPY backend/src ./src

# Copy frontend static files (served by Express when SERVE_FRONTEND=true)
COPY frontend ./frontend

# Prepare data directory and use the pre-created unprivileged node user
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
