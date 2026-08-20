FROM oven/bun:1.3.10 AS dependencies
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.10 AS build
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN bun run build

FROM oven/bun:1.3.10 AS production-dependencies
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.10 AS runtime
WORKDIR /app

ENV NODE_ENV=production \
	NEIGHBORLY_DB_PATH=/data/neighborly.sqlite \
	PORT=3001

COPY --chown=bun:bun --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun server/app.ts server/auth.ts server/database-cli.ts server/db.ts server/http.ts server/images.ts server/interactions.ts server/listings.ts server/schema.ts server/seed.ts server/static.ts ./server/
COPY --chown=bun:bun server/routes ./server/routes
COPY --chown=bun:bun src/lib ./src/lib
COPY --chown=bun:bun assets/listings/*.png ./assets/listings/
COPY --chown=bun:bun --from=build /app/dist ./dist

USER root
RUN mkdir -p /data && chown bun:bun /data
USER bun

VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["bun", "-e", "const port = process.env.PORT || '3001'; fetch('http://127.0.0.1:' + port + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));"]

CMD ["bun", "server/app.ts"]
