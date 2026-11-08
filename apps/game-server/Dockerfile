# syntax=docker/dockerfile:1.7
# Game server (Fastify + Socket.IO + Prisma). Build from the repository root:
#   docker build -f apps/game-server/Dockerfile -t masoi-game-server .
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Manifests only → cached dependency layers
FROM base AS manifests
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY apps/game-server/package.json apps/game-server/
COPY apps/web/package.json apps/web/

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@masoi/game-server --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/game-server apps/game-server
RUN cd apps/game-server && npx prisma generate && npx tsup

FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=@masoi/game-server --ignore-scripts
COPY apps/game-server/prisma apps/game-server/prisma
RUN cd apps/game-server && npx prisma generate

FROM base AS runtime
ENV NODE_ENV=production \
    GAME_SERVER_HOST=0.0.0.0 \
    GAME_SERVER_PORT=4000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node apps/game-server/package.json apps/game-server/
COPY --chown=node:node apps/game-server/prisma apps/game-server/prisma
COPY --from=build --chown=node:node /app/apps/game-server/dist apps/game-server/dist
WORKDIR /app/apps/game-server
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1
# SIGTERM → graceful shutdown (stop timers, close sockets, disconnect DB/Redis)
CMD ["node", "--enable-source-maps", "dist/index.js"]
