# LUX Supreme — Railway + Namecheap Deployment Guide

---

## Architecture finale

```
cafeslux.com (Namecheap DNS)
    │
    ├── www.cafeslux.com  →  Vercel  (Frontend React)
    └── api.cafeslux.com  →  Railway (Backend Node.js)
                                │
                          Neon PostgreSQL
```

---

## ÉTAPE 1 — Base de données Neon

1. Aller sur [neon.tech](https://neon.tech) → New Project → `lux_supreme`
2. Récupérer la **Connection String** :
   ```
   postgresql://lux_admin:PASSWORD@ep-xxx.eu-west-2.aws.neon.tech/lux_supreme?sslmode=require
   ```
3. Exécuter le schema dans l'éditeur SQL Neon :
   ```sql
   -- Coller le contenu de prisma/schema_master_final.sql
   ```

---

## ÉTAPE 2 — Railway (Backend API)

### 2a. Créer le service

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Sélectionner `cafeslux1-wq/lux-final-repo`
3. Railway détecte automatiquement `railway.json` à la racine ✅

### 2b. Variables d'environnement Railway

Dans Railway → votre service → **Variables** → Add all :

```env
NODE_ENV=production
PORT=4000

# Base de données (depuis Neon)
DB_HOST=ep-xxx.eu-west-2.aws.neon.tech
DB_PORT=5432
DB_NAME=lux_supreme
DB_USER=lux_admin
DB_PASSWORD=VOTRE_MOT_DE_PASSE_NEON
DB_SSL=true

# JWT (générer avec: openssl rand -hex 64)
JWT_SECRET=REMPLACER_64_CHARS_ALEATOIRES
JWT_REFRESH_SECRET=REMPLACER_64_CHARS_DIFFERENTS
JWT_EXPIRES_IN=8h

# CORS — votre domaine Vercel + Namecheap
CORS_ORIGINS=https://www.cafeslux.com,https://cafeslux.com

# URL frontend
FRONTEND_URL=https://www.cafeslux.com

# Stripe (optionnel pour commencer)
STRIPE_SECRET_KEY=sk_live_XXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXX
```

### 2c. Domaine personnalisé Railway

1. Railway → votre service → **Settings → Networking → Custom Domain**
2. Ajouter : `api.cafeslux.com`
3. Railway affiche un CNAME à copier, ex: `abc123.up.railway.app`

### 2d. Vérifier le déploiement

```bash
curl https://api.cafeslux.com/health
# → {"status":"ok","ts":"2025-..."}

curl https://api.cafeslux.com/api/v1/auth/staff/branch/b0000000-0000-0000-0000-000000000001
# → {"success":true,"data":[...8 profils...]}
```

---

## ÉTAPE 3 — Vercel (Frontend)

### 3a. Variables d'environnement Vercel

**Settings → Environment Variables** :

```env
VITE_API_URL=https://api.cafeslux.com/api/v1
VITE_BRANCH_ID=b0000000-0000-0000-0000-000000000001
VITE_TENANT_SLUG=lux
VITE_FRONTEND_URL=https://www.cafeslux.com
```

### 3b. Domaine Vercel

1. Vercel → votre projet → **Settings → Domains**
2. Ajouter `www.cafeslux.com` et `cafeslux.com`
3. Vercel affiche les valeurs DNS à configurer

---

## ÉTAPE 4 — Namecheap DNS

Dans Namecheap → **Domain List → cafeslux.com → Manage → Advanced DNS**

Supprimer les enregistrements existants, puis ajouter :

### Records pour Vercel (Frontend)

| Type  | Host | Value | TTL |
|-------|------|-------|-----|
| `A`     | `@`   | `76.76.21.21`           | Auto |
| `CNAME` | `www` | `cname.vercel-dns.com.` | Auto |

### Records pour Railway (Backend API)

| Type    | Host  | Value                        | TTL  |
|---------|-------|------------------------------|------|
| `CNAME` | `api` | `VOTRE-APP.up.railway.app`  | Auto |

> ⚠️ **Remplacer** `VOTRE-APP.up.railway.app` par la valeur CNAME fournie par Railway à l'étape 2c.

### Nameservers
Laisser les nameservers Namecheap par défaut (ne pas changer vers Vercel NS).

### Délai de propagation
DNS : 5 min → 48h (généralement 15 min avec Namecheap)

---

## ÉTAPE 5 — Seed de la base de données

Une fois Railway déployé, exécuter dans Neon SQL Editor :

```sql
-- Coller le contenu de prisma/seed.sql
-- (le fichier lux-seed-neon-final.sql)
```

---

## Vérification complète

```bash
# 1. Backend
curl https://api.cafeslux.com/health
# → {"status":"ok"}

# 2. Staff list (sans auth)
curl https://api.cafeslux.com/api/v1/auth/staff/branch/b0000000-0000-0000-0000-000000000001
# → 8 profils

# 3. Menu public
curl https://api.cafeslux.com/api/v1/menu/public/lux
# → {categories:[...]}

# 4. Frontend
# Ouvrir https://www.cafeslux.com
# → Écran PIN login avec 8 profils ✅
```

---

## Erreurs fréquentes

| Erreur | Cause | Solution |
|--------|-------|---------|
| `CORS error` | CORS_ORIGINS ne contient pas votre domaine | Ajouter `https://www.cafeslux.com` dans Railway env |
| `502 Bad Gateway` | Backend pas encore démarré | Attendre 2-3 min après deploy |
| `Staff auth required` | Route auth non publique | `auth.routes.ts` manquant — utiliser ce ZIP |
| `Cannot find module bcryptjs` | Mauvais package | Vérifier `package.json` : bcryptjs ✅ |
| DNS ne répond pas | Propagation en cours | Attendre 15-30 min |
