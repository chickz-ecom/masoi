# syntax=docker/dockerfile:1.7
# Web UI (Next.js standalone). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t masoi-web .
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/game-server/package.json apps/game-server/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@masoi/web --include-workspace-root
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
# Empty = same origin (Nginx routes /api and /socket.io to the game server).
ARG NEXT_PUBLIC_GAME_SERVER_URL=""
ENV NEXT_PUBLIC_GAME_SERVER_URL=$NEXT_PUBLIC_GAME_SERVER_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npm run assets:normalize && npm run assets:optimize && npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
