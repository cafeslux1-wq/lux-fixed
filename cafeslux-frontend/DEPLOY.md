# Café LUX — Final Deployment Map

This project is deployed as **two separate repositories/services**:

- **Frontend (GitHub Pages):** `cafeslux-frontend` → `https://cafeslux.com`
- **Backend (Railway):** `cafeslux-api` → `https://cafeslux-api-production.up.railway.app`

## Final structure

```text
lux-deploy-final/
├── cafeslux-frontend/         → GitHub Pages (cafeslux.com)
│   ├── index.html      الموقع + gateway + 27 feature
│   ├── cafe-lux.html   POS + Admin + Staff
│   ├── api-client.js   cloud API offline-first
│   ├── sw.js           PWA service worker
│   ├── manifest.json   PWA install
│   ├── 404.html        URL routing /portal/*
│   ├── lux-saas.html   SaaS landing
│   └── DEPLOY.md       دليل النشر
│
└── cafeslux-api/              → Railway (backend)
    ├── server.js      21 endpoint
    ├── seed.js        admin + menu + coupons + reviews
    ├── package.json   dependencies
    ├── railway.toml   auto-deploy config
    └── prisma/
        └── schema.prisma (PostgreSQL models)
```

## Frontend checklist (GitHub Pages)

Upload these files in repo root for Pages:

- `index.html`
- `cafe-lux.html`
- `api-client.js`
- `sw.js`
- `manifest.json`
- `404.html`
- `lux-saas.html`

The production API URL is configured in `index.html` as:

```html
window.LUX_API_URL = 'https://cafeslux-api-production.up.railway.app';
```

## Backend checklist (Railway)

- Deploy the `cafeslux-api` repo on Railway.
- Confirm PostgreSQL is connected.
- Run seed script one time after first migration.
- Ensure CORS allows `https://cafeslux.com`.

## Portal routes

- `/portal/pos` → PIN `1234`
- `/portal/staff` → PIN `1234`
- `/portal/admin` → PIN `9999`
