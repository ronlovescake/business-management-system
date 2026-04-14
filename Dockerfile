# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

ARG BUILD_DATABASE_URL=postgresql://build:build@db:5432/build_db?schema=public
ARG BUILD_NEXT_PUBLIC_APP_URL=http://127.0.0.1:5000
ARG BUILD_NEXTAUTH_URL=http://127.0.0.1:5000
ARG BUILD_NEXTAUTH_SECRET=build-secret-minimum-32-characters-long

ENV DATABASE_URL=${BUILD_DATABASE_URL}
ENV NEXT_PUBLIC_APP_URL=${BUILD_NEXT_PUBLIC_APP_URL}
ENV NEXTAUTH_URL=${BUILD_NEXTAUTH_URL}
ENV NEXTAUTH_SECRET=${BUILD_NEXTAUTH_SECRET}

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

COPY package.json package-lock.json ./

RUN npm ci --include=dev --ignore-scripts
RUN npx playwright install --with-deps chromium

COPY . .

RUN npm run db:generate \
 && if [ -f .next/BUILD_ID ]; then echo "Using prebuilt Next.js artifacts from build context"; else npm run build; fi \
 && mkdir -p /ms-playwright \
 && chown -R node:node /ms-playwright /app/node_modules/.prisma /app/node_modules/@prisma

USER node

EXPOSE 5000

CMD ["npm", "run", "start"]