FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared-types/package*.json ./packages/shared-types/
RUN npm install --workspace=apps/backend --workspace=packages/shared-types

COPY apps/backend ./apps/backend
COPY packages/shared-types ./packages/shared-types
RUN cd apps/backend && npx prisma generate && npm run build

# --- runtime ---
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
