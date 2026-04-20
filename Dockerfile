# syntax=docker/dockerfile:1

# ---- Stage 1: deps + build ---------------------------------------------------
# Builds the Next.js app and generates the Prisma client. Includes dev deps so
# `next build` and `prisma generate` work; this stage's node_modules are NOT
# shipped to the runtime image.
FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG BUILD_DATABASE_URL=postgresql://build:build@db:5432/build_db?schema=public
ARG BUILD_NEXT_PUBLIC_APP_URL=http://127.0.0.1:5000
ARG BUILD_NEXTAUTH_URL=http://127.0.0.1:5000
ARG BUILD_NEXTAUTH_SECRET=build-secret-minimum-32-characters-long

ENV DATABASE_URL=${BUILD_DATABASE_URL}
ENV NEXT_PUBLIC_APP_URL=${BUILD_NEXT_PUBLIC_APP_URL}
ENV NEXTAUTH_URL=${BUILD_NEXTAUTH_URL}
ENV NEXTAUTH_SECRET=${BUILD_NEXTAUTH_SECRET}

COPY package.json package-lock.json ./

# Install all deps (incl. dev) for the build. --ignore-scripts skips Playwright
# browser download; browsers are installed only by CI for E2E tests.
RUN npm ci --include=dev --ignore-scripts

COPY . .

RUN npm run db:generate \
 && if [ -f .next/BUILD_ID ]; then echo "Using prebuilt Next.js artifacts from build context"; else npm run build; fi

# Drop dev deps so the pruned node_modules can be copied to the runtime stage.
# The Prisma client (under node_modules/.prisma and node_modules/@prisma) is
# preserved by the prune because it is a regular (non-dev) dependency.
RUN npm prune --omit=dev


# ---- Stage 2: runtime --------------------------------------------------------
# Slim runtime image. Only ships:
#   - production node_modules (dev deps pruned)
#   - .next build output
#   - generated Prisma client
#   - postgres-client-16 (required by backup/restore scripts that run in-container)
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Playwright browsers are E2E-only and intentionally NOT shipped in the runtime
# image. This skips the `prestart` browser check that would otherwise try to
# install Chromium at container start. See §10.2 in IMPROVEMENTS_CHECKLIST.md.
ENV SKIP_PLAYWRIGHT_INSTALL=1

# postgres-client-16 is required at runtime by backup/restore scripts
# (scripts/backup-database.js, scripts/docker/*.sh) which shell out to
# pg_dump / pg_restore from inside the container.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && apt-get purge -y --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/*

# Copy only what the runtime needs from the builder stage.
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js
# Scripts and settings are needed at runtime for backup/restore and config.
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/settings ./settings
# Handlebars/HTML templates used at runtime for PDF generation
# (packing lists, invoices, payslips, distributions).
COPY --from=builder --chown=node:node /app/templates ./templates

USER node

EXPOSE 5000

CMD ["npm", "run", "start"]
