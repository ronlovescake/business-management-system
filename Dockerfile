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
# Playwright Chromium is required at runtime for server-side PDF generation
# (invoices, packing lists, distribution slips, payslips). Browsers are
# baked into the runtime image at /ms-playwright (matches the value set in
# docker-compose.yml). The prestart hook is short-circuited via
# SKIP_PLAYWRIGHT_INSTALL=1 because the install already happened at build
# time below.
ENV SKIP_PLAYWRIGHT_INSTALL=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

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

# Install Playwright Chromium into the predictable /ms-playwright path used
# by docker-compose.yml. --with-deps installs the system libraries
# (libnss3, libatk1.0-0, etc.) required by Chromium on bookworm. Done as
# root before USER node so apt-get can install system packages; the browser
# tree is then made world-readable so the unprivileged runtime user can
# launch chrome.
RUN mkdir -p /ms-playwright \
 && npx --yes playwright install --with-deps chromium \
 && chmod -R a+rX /ms-playwright

USER node

EXPOSE 5000

CMD ["npm", "run", "start"]
