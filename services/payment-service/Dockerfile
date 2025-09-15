FROM node:20-alpine AS builder

WORKDIR /app


COPY package*.json ./
COPY tsconfig.json ./


COPY shared ./shared


COPY services/payment-service/package*.json ./services/payment-service/
COPY services/payment-service/tsconfig.json ./services/payment-service/

RUN npm ci


COPY services/payment-service/src ./services/payment-service/src


WORKDIR /app/shared
RUN npm run build


WORKDIR /app/services/payment-service
RUN npm run build


FROM node:20-alpine AS production


RUN addgroup -g 1001 -S nodejs && \
    adduser -S payment-service -u 1001

WORKDIR /app


COPY services/payment-service/package*.json ./


RUN npm ci --only=production && npm cache clean --force


COPY --from=builder /app/services/payment-service/dist ./dist
COPY --from=builder /app/shared ./shared


RUN chown -R payment-service:nodejs /app


USER payment-service


EXPOSE 3004


HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"


CMD ["node", "dist/index.js"]