
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
    adduser -S transaction-worker -u 1001


WORKDIR /app


COPY package*.json ./


RUN npm ci --only=production && npm cache clean --force


COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared


RUN chown -R transaction-worker:nodejs /app


USER transaction-worker


CMD ["node", "dist/index.js"]



