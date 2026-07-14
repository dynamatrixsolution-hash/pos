FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
COPY packages/db/package.json ./packages/db/package.json
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate prisma client before building
RUN npm run prisma:generate
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1
ENV BACKEND_URL "http://dynaone-backend:3000"
ARG APP_NAME
RUN npm run build --workspace=${APP_NAME}

# Ensure the public folder exists to prevent COPY failure in runner stage
RUN mkdir -p ${APP_NAME}/public

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
COPY --from=builder /app/${APP_NAME}/public ./${APP_NAME}/public
# Set the correct permission for prerender cache
RUN mkdir -p ${APP_NAME}/.next && chown nextjs:nodejs ${APP_NAME}/.next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/${APP_NAME}/.next/static ./${APP_NAME}/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

CMD node ${APP_NAME}/server.js
