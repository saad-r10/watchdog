FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared-types/package*.json ./packages/shared-types/
RUN npm install --workspace=apps/frontend --workspace=packages/shared-types

COPY apps/frontend ./apps/frontend
COPY packages/shared-types ./packages/shared-types

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN cd apps/frontend && npm run build

# --- runtime (nginx) ---
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
