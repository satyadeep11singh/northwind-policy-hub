# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS client-build

WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci --prefer-offline
COPY client/ ./
RUN npm run build

# ── Stage 2: Install server production deps ───────────────────────────────────
FROM node:20-alpine AS server-deps

WORKDIR /build/server
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# ── Stage 3: Final runtime image ──────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Non-root user for container security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy server production dependencies
COPY --from=server-deps /build/server/node_modules ./node_modules

# Copy server source
COPY server/ ./server/
COPY package.json ./

# Copy React build output into the location Express will serve
COPY --from=client-build /build/client/dist ./client/dist

# Inject build metadata for the /health endpoint
ARG BUILD_ID=local
ENV BUILD_ID=${BUILD_ID}
ENV NODE_ENV=production
ENV PORT=8080

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server/index.js"]
