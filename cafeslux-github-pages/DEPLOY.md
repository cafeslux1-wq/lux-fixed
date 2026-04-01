# Café LUX — GitHub Pages Deploy Guide
# cafeslux1-wq/cafeslux

## Step 1: Upload ALL 7 files to repo root
- index.html        ← Main site + gateway + URL router
- cafe-lux.html     ← POS + Admin + Staff portals
- api-client.js     ← Offline-first API client
- sw.js             ← Service Worker (PWA)
- manifest.json     ← PWA install manifest
- 404.html          ← GitHub Pages URL routing (CRITICAL)
- lux-saas.html     ← LUX SaaS landing page

## Step 2: Edit index.html line 12 after Railway deploy
window.LUX_API_URL = 'https://YOUR-APP.up.railway.app';

## Portal URLs
- cafeslux.com/portal/pos    → PIN: 1234  (Caissier)
- cafeslux.com/portal/staff  → PIN: 1234  (Employés)
- cafeslux.com/portal/admin  → PIN: 9999  (Administration)
