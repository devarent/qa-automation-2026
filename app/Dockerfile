# Build from the repository root:
#   docker build -f app/Dockerfile -t banking-qa-lab .
#   docker run --rm -p 3000:3000 banking-qa-lab
#
# The context is the repository root because the app reads db/schema.sql and
# db/seed.sql and the dependency lockfile lives at the root of the workspace.

FROM node:22-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY app/package.json app/package.json

RUN npm ci --omit=dev --workspace=app --include-workspace-root=false

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /workspace

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json ./
COPY app/package.json ./app/package.json
COPY app/*.js ./app/
COPY app/public ./app/public
COPY db ./db

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "app/server.js"]
