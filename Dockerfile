# syntax=docker/dockerfile:1

# ---- dependencies -----------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The song library is a runtime volume, never baked into the image.
RUN rm -rf data && npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHORDS_DATA_DIR=/data/songs

# `output: "standalone"` leaves server.js plus a pruned node_modules here;
# static assets and public files still have to be copied in alongside it.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# node:alpine's `node` user is uid/gid 1000, which matches the default the
# compose file runs as, so the mounted library stays writable.
RUN mkdir -p /data/songs .next/cache && chown -R node:node /data /app
VOLUME ["/data"]
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
