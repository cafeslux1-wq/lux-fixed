# Café LUX — Launch Ready

## Live structure
- `frontend/` → React/Vite frontend
- `backend/` → Node/Express/Prisma API
- `archive/legacy-static/` → old HTML/static files kept for reference only

## Recommended deployment
- GitHub: host the repository
- Railway: deploy the backend from `/backend`
- Vercel or Railway Static / another frontend host: deploy the frontend from `/frontend`

## Important
Set `VITE_API_URL` in the frontend before deploy.
