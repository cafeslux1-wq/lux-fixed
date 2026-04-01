# Café LUX — Frontend (cafeslux.com)
GitHub Pages — cafeslux1-wq/cafeslux

## Files to upload to repo root /
- index.html        ← Main site (all pages)
- cafe-lux.html     ← POS + Admin + Staff system
- api-client.js     ← Cloud API client
- sw.js             ← Service Worker (PWA offline)
- manifest.json     ← PWA install manifest
- lux-saas.html     ← SaaS landing page
- 404.html          ← GitHub Pages URL routing (REQUIRED)

## After upload: edit index.html line 12
window.LUX_API_URL = 'https://YOUR-RAILWAY-URL.up.railway.app';

## Access Portals (after setting API URL)
- /portal/pos    → PIN: 1234  (Caissier)
- /portal/staff  → PIN: 1234  (Employés)
- /portal/admin  → PIN: 9999  (Administration)
