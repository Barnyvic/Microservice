FROM node:20-alpine AS builder

WORKDIR /app


COPY package*.json ./
COPY tsconfig.json ./


COPY shared ./shared


COPY services/transaction-worker/package*.json ./services/transaction-worker/
COPY services/transaction-worker/tsconfig.json ./services/transaction-worker/


RUN npm ci


COPY services/transaction-worker/src ./services/transaction-worker/src


WORKDIR /app/shared
RUN npm run build


WORKDIR /app/services/transaction-worker
RUN npm run build


FROM node:20-alpine AS production


RUN addgroup -g 1001 -S nodejs && \
    adduser -S transaction-worker -u 1001

WORKDIR /app


COPY services/transaction-worker/package*.json ./


RUN npm ci --only=production && npm cache clean --force


COPY --from=builder /app/services/transaction-worker/dist ./dist
COPY --from=builder /app/shared ./shared


RUN chown -R transaction-worker:nodejs /app


USER transaction-worker


HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Transaction worker is running')"


CMD ["node", "dist/index.js"]