# LUX Supreme v4.3 — Railway Unified Deployment
## Un seul service Railway = Frontend + Backend + PostgreSQL

---

## Architecture Railway (tout-en-un)

```
cafeslux.com  →  Railway Service
                    │
                    ├── Express sert frontend/dist/ (React/Vite)
                    ├── Express /api/v1/*  (API backend)
                    └── Railway PostgreSQL (base de données)
```

Avantage : **un seul domaine, zéro CORS**, coût unique Railway.

---

## ÉTAPE 1 — GitHub

Pousser tous les fichiers du ZIP sur `cafeslux1-wq/lux-final-repo` :
```bash
git add .
git commit -m "Railway unified build"
git push origin main
```

Structure attendue dans le repo :
```
lux-final-repo/
├── railway.json       ← config Railway (unified build)
├── backend/
├── frontend/
└── prisma/
```

---

## ÉTAPE 2 — Créer le projet Railway

1. [railway.app](https://railway.app) → **New Project**
2. → **Deploy from GitHub repo**
3. Sélectionner `cafeslux1-wq/lux-final-repo`
4. Railway lit `railway.json` automatiquement ✅

---

## ÉTAPE 3 — Ajouter PostgreSQL

Dans le projet Railway :

1. **New** → **Database** → **Add PostgreSQL**
2. Railway crée la DB et injecte automatiquement ces variables :
   - `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`

---

## ÉTAPE 4 — Variables d'environnement Railway

Dans le service backend → **Variables** → ajouter :

```env
# ── Obligatoires ──────────────────────────────────────────────
NODE_ENV=production
PORT=4000

# Base de données (utiliser les variables Railway PostgreSQL)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_SSL=true

# JWT (générer: openssl rand -hex 64)
JWT_SECRET=REMPLACER_64_CHARS
JWT_REFRESH_SECRET=REMPLACER_64_CHARS_DIFFERENT
JWT_EXPIRES_IN=8h

# URL du service (Railway génère cette URL)
FRONTEND_URL=https://cafeslux.com
CORS_ORIGINS=https://cafeslux.com,https://www.cafeslux.com

# ── Optionnels (activer plus tard) ────────────────────────────
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

> ⚡ **Raccourci Railway**: Utiliser la syntaxe `${{Postgres.PGHOST}}`
> pour référencer automatiquement les variables de la DB Railway.

---

## ÉTAPE 5 — Initialiser la base de données

Après le premier déploiement Railway :

1. Railway → votre projet → **PostgreSQL** → **Query**
2. Coller tout le contenu de `prisma/schema_master_final.sql` → **Run**
3. Coller le contenu de `lux-seed-neon-final.sql` → **Run**

Vérification :
```sql
SELECT 'Staff' AS t, COUNT(*)::TEXT AS n FROM staff
UNION ALL SELECT 'Plans', COUNT(*)::TEXT FROM billing_plans
UNION ALL SELECT 'Branches', COUNT(*)::TEXT FROM branches;
-- Doit afficher: 8, 3, 2
```

---

## ÉTAPE 6 — Domaine Namecheap

### Dans Railway

1. Service → **Settings** → **Networking** → **Custom Domain**
2. Ajouter `cafeslux.com`
3. Ajouter `www.cafeslux.com`
4. Railway affiche les valeurs CNAME à copier

### Dans Namecheap

**Domain List → cafeslux.com → Manage → Advanced DNS**

Supprimer tous les anciens A/CNAME, puis ajouter :

| Type    | Host  | Value                                | TTL  |
|---------|-------|--------------------------------------|------|
| `CNAME` | `@`   | `VOTRE-APP.up.railway.app`          | Auto |
| `CNAME` | `www` | `VOTRE-APP.up.railway.app`          | Auto |

> ⚠️ Namecheap ne supporte pas `CNAME` sur `@` (root).
> Solution : utiliser un **A record** avec l'IP Railway.
> Dans Railway → Custom Domain → cliquer sur l'icône ℹ️ pour voir l'IP.

**Alternative recommandée** (si CNAME @ bloqué) :

| Type    | Host  | Value                         | TTL  |
|---------|-------|-------------------------------|------|
| `A`     | `@`   | `IP fournie par Railway`     | Auto |
| `CNAME` | `www` | `VOTRE-APP.up.railway.app`  | Auto |

---

## ÉTAPE 7 — Vérification

```bash
# 1. Health check
curl https://cafeslux.com/health
# → {"status":"ok","frontend":"served"}

# 2. API publique (liste staff)
curl https://cafeslux.com/api/v1/auth/staff/branch/b0000000-0000-0000-0000-000000000001
# → {"success":true,"data":[...8 profils...]}

# 3. Menu public
curl https://cafeslux.com/api/v1/menu/public/lux
# → {"data":{"categories":[...]}}

# 4. Ouvrir le navigateur
# https://cafeslux.com → Écran PIN login ✅
```

---

## Fichiers supprimés (ne plus inclure)

| Fichier        | Raison |
|----------------|--------|
| `vercel.json`  | Plus besoin de Vercel |
| `.railwayignore` | Ignorait le frontend — supprimé |
| `nixpacks.toml` | Remplacé par `railway.json` |

---

## PINs de connexion

| Nom | Rôle | PIN |
|-----|------|-----|
| Owner LUX | Propriétaire | **0000** |
| Fatima Tahiri | Caissière | **1111** |
| Youssef Benali | Barista | **2222** |
| Aicha Lahlou | Serveuse | **3333** |
| Hassan Idrissi | Pâtissier | **4444** |
| Sara Belhaj | Livreure | **5555** |
| Karim Ziani | Cuisinier | **6666** |
| Manager Fes | Manager | **7777** |

---

## Dépannage

| Erreur | Solution |
|--------|---------|
| `Cannot find module 'bcryptjs'` | Vérifier `backend/package.json` : doit avoir `bcryptjs` |
| `frontend: not-built` dans /health | Build frontend a échoué — vérifier les logs Railway |
| CORS error | Vérifier `CORS_ORIGINS` contient votre domaine exact |
| DNS ne résout pas | Attendre 5-30 min, vérifier CNAME avec `nslookup cafeslux.com` |
| `/health` répond mais UI ne charge pas | Vérifier que `FRONTEND_DIST` path est correct (`../../../frontend/dist`) |
