FROM oven/bun:1.3.1-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.1-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build
RUN bun run browser:build

FROM oven/bun:1.3.1-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/claims ./claims
COPY --from=build /app/apps/browser-harness/dist ./apps/browser-harness/dist
RUN mkdir -p /app/runs
CMD ["bun", "dist/cli.js", "council", "--once"]
