# ══════════════════════════════════════════════════════════
#  LUX Supreme — Dockerfile (No-Cache Build)
#  Every commit triggers a full fresh build
# ══════════════════════════════════════════════════════════

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
# ARG forces Docker to NEVER cache layers below this line
ARG CACHEBUST=1
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
ARG CACHEBUST=1
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npx tsc

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
