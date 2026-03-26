# ═══════════════════════════════════════════════════════════════════════
#  LUX SUPREME v4.3 — DOCKERFILE (PRODUCTION READY)
# ═══════════════════════════════════════════════════════════════════════

# المرحلة 1: بناء الواجهة الأمامية (Frontend)
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# المرحلة 2: بناء الخلفية (Backend)
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
# تثبيت التبعيات وبناء مشروع TypeScript
RUN npm install
COPY backend/ ./
RUN npx tsc

# المرحلة 3: تشغيل النظام (Production)
FROM node:20-alpine AS production
WORKDIR /app

# ضبط اللغة والترميز لدعم العربية
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# نسخ ملفات الخلفية المبنية
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/

# تثبيت التبعيات الضرورية للتشغيل فقط (بدون أدوات التطوير)
WORKDIR /app/backend
RUN npm ci --omit=dev

# العودة للمجلد الرئيسي ونسخ ملفات الواجهة الأمامية
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# المنفذ الذي سيعمل عليه نظام LUX Taza
EXPOSE 4000

# أمر التشغيل النهائي
CMD ["node", "backend/dist/server.js"]
