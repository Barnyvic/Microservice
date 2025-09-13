
FROM node:20-alpine AS builder

WORKDIR /app


COPY package*.json ./
COPY ../../shared ./shared
COPY tsconfig.json ./


RUN npm ci --only=production


COPY src ./src


RUN npm run build


FROM node:20-alpine AS production


RUN addgroup -g 1001 -S nodejs && \
    adduser -S order-service -u 1001


WORKDIR /app


COPY package*.json ./


RUN npm ci --only=production && npm cache clean --force


COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared


RUN chown -R order-service:nodejs /app


USER order-service


EXPOSE 3003


HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"


CMD ["node", "dist/index.js"]



