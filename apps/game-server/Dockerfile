# Contenedor del game server autoritativo -> Cloud Run (soporta WebSocket).
# Build desde la RAÍZ del monorepo:  docker build -f apps/game-server/Dockerfile .
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Manifiestos primero (mejor caché de capas).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/game-server/package.json apps/game-server/package.json

RUN pnpm install --frozen-lockfile --filter @zonacero/game-server...

# Código.
COPY packages/shared packages/shared
COPY apps/game-server apps/game-server

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567
CMD ["pnpm", "--filter", "@zonacero/game-server", "start"]
