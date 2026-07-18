# Debian slim (glibc). The Postgres driver (`pg`) is pure JavaScript, so there is
# no native module to compile. Prisma 7 has no query-engine binary either, so no
# engine binary targets are needed.

# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Schema + config are needed by the postinstall `prisma generate`, so copy them
# before installing.
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# Reuse the already-installed deps (incl. the prisma CLI used by `migrate deploy`),
# then drop dev deps.
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
# start:prod runs `prisma migrate deploy` (applies pending migrations to Postgres,
# never dropping data) then boots the server.
CMD ["npm", "run", "start:prod"]
