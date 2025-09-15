FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

COPY shared ./shared

COPY services/product-service/package*.json ./services/product-service/
COPY services/product-service/tsconfig.json ./services/product-service/

RUN npm ci

COPY services/product-service/src ./services/product-service/src

WORKDIR /app/shared
RUN npm run build

WORKDIR /app/services/product-service
RUN npm run build

FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S product-service -u 1001

WORKDIR /app

COPY services/product-service/package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/services/product-service/dist ./dist
COPY --from=builder /app/shared ./shared

RUN chown -R product-service:nodejs /app

USER product-service

EXPOSE 3002


HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"


CMD ["node", "dist/index.js"]