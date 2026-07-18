# syntax=docker/dockerfile:1

# Single production image for AWS Lambda (container): the NestJS API also serves
# the Angular SPA (same-origin, so no CORS). It runs under the AWS Lambda Web
# Adapter, which lets the ordinary HTTP server run unchanged behind Lambda. Local
# dev still uses `ng serve` + `nest start`; docker-compose still uses the split
# api/ + ui/ images. This image is only the deployed artifact.

# ---- UI build (Angular -> static files) ----
FROM node:22-bookworm-slim AS ui-build
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# ---- API build (NestJS -> dist, incl. generated Prisma client) ----
FROM node:22-bookworm-slim AS api-build
WORKDIR /api
COPY api/package*.json ./
COPY api/prisma ./prisma
COPY api/prisma.config.ts ./
RUN npm ci
COPY api/ ./
RUN npm run build

# ---- runtime (Lambda container) ----
FROM node:22-bookworm-slim AS runtime
# AWS Lambda Web Adapter — proxies Lambda invocations to the local HTTP server,
# so the app needs no Lambda-specific handler code.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV NODE_ENV=production \
    PORT=3000 \
    AWS_LWA_PASS_THROUGH_PATH=/api/internal/cron
WORKDIR /app
COPY api/package*.json ./
COPY api/prisma ./prisma
COPY api/prisma.config.ts ./
# Reuse installed deps, then drop dev deps.
COPY --from=api-build /api/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=api-build /api/dist ./dist
# The Angular build; Nest serves it from ./client (see app.module ServeStaticModule).
COPY --from=ui-build /ui/dist/frontend/browser ./client
EXPOSE 3000
# Boot only. Schema migrations are applied by the release workflow
# (`prisma migrate deploy` against Neon), never on a Lambda cold start.
CMD ["node", "dist/main.js"]
