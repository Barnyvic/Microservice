FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

COPY shared ./shared

COPY services/customer-service/package*.json ./services/customer-service/
COPY services/customer-service/tsconfig.json ./services/customer-service/
COPY services/customer-service/src ./services/customer-service/src

RUN npm ci

WORKDIR /app/shared
RUN npm run build

WORKDIR /app/services/customer-service
RUN npm run build

FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S customer-service -u 1001

WORKDIR /app

COPY services/customer-service/package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/services/customer-service/dist ./dist
COPY --from=builder /app/shared ./shared

RUN chown -R customer-service:nodejs /app

USER customer-service

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"


CMD ["node", "dist/index.js"]