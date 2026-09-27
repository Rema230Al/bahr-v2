# syntax=docker/dockerfile:1
FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# SQLite lives on a Fly volume mounted at /data; run as the unprivileged bun user.
RUN mkdir -p /data && chown bun:bun /data
USER bun
ENV DATABASE_PATH=/data/bahr.sqlite PORT=3000
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["bun", "src/index.ts"]
