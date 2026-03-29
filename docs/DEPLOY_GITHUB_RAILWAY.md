# Deploy order

## 1) Upload to GitHub
رفع المشروع كاملًا كما هو إلى GitHub.

## 2) Backend on Railway
- Root Directory: `backend`
- Variables:
  - DATABASE_URL
  - JWT_SECRET
  - FRONTEND_URL
  - NODE_ENV=production
  - PORT=3000
  - ADMIN_WHATSAPP

Railway will run:
`npx prisma db push && node server.js`

Run seed once manually:
`node seed.js`

## 3) Frontend
Deploy from `/frontend`
- Build command: `npm install && npm run build`
- Output directory: `dist`

Set env:
`VITE_API_URL=https://YOUR-RAILWAY-BACKEND.up.railway.app`
