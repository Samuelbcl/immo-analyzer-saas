# immo-analyzer-saas

Application web SaaS d'analyse d'investissement immobilier locatif belge (Wallonie).

Pivot du CLI plugin Claude Code [immo-analyzer-v1](https://github.com/Samuelbcl/immo-analyzer) vers une vraie web app.

## Structure (monorepo, 2 services)

```
immo-analyzer-saas/
├── web/          Frontend Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui)
├── api/          Backend FastAPI (Python 3.13)
└── README.md
```

## Architecture single-origin

L'utilisateur final voit **UNE SEULE URL** (ex `monsaas.com` ou `xxx.vercel.app`).

- Le **frontend** (Next.js) est servi par **Vercel**
- Le **backend** (FastAPI) est sur **Railway** (URL invisible aux users)
- Next.js a une règle `rewrites` qui proxifie `/api/*` du frontend vers le backend Railway
- Résultat : tout le trafic utilisateur passe par le domaine Vercel, le Railway reste interne

```
USER → monsaas.com/analyze            (HTML servi par Vercel)
USER → monsaas.com/api/analyses       (POST proxifié par Vercel vers Railway)
USER → monsaas.com/analyses/abc-123   (HTML servi par Vercel, fetch interne vers Railway)
```

## Stack

- **Front** : Next.js 16, TypeScript, Tailwind v4, shadcn/ui (style base-nova)
- **Back** : FastAPI 0.115+, Pydantic v2, Uvicorn
- **DB / Auth / Storage** : Supabase (à connecter dans la prochaine itération)
- **Paiements** : Stripe (quand monétisation activée)
- **Hébergement** : Vercel (front, gratuit jusqu'à ~100k visites/mois) + Railway (back, ~5 EUR/mois)

## Dev local

### Backend FastAPI (port 8000)

```powershell
cd api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API dispo sur `http://localhost:8000` :
- `GET /` → infos service
- `GET /api/health` → ping
- `POST /api/analyses` → lance une analyse complète depuis une URL Immoweb
- `GET /api/analyses/{id}` → récupère une analyse par UUID
- Docs auto-générées : `http://localhost:8000/docs`

### Frontend Next.js (port 3000)

```powershell
cd web
npm run dev
```

Front sur `http://localhost:3000`. En dev, Next.js rewrite `/api/*` vers `http://localhost:8000` (cf. `BACKEND_API_URL` dans `web/.env.local`).

## Déploiement production

### Frontend → Vercel

1. https://vercel.com/dashboard → Import projet GitHub `immo-analyzer-saas`
2. **Project Settings → Build and Deployment → Root Directory** : `web`
3. **Project Settings → Environment Variables** :
   - `BACKEND_API_URL` = URL publique du backend Railway (ex `https://xxx.up.railway.app`)
4. Deploy → Vercel build et héberge

### Backend → Railway

1. https://railway.app → New Project → Deploy from GitHub repo
2. Sélectionner `immo-analyzer-saas`
3. Cliquer sur le service créé → **Settings**
4. **Source → Root Directory** : `api`
5. **Networking → Generate Domain** (URL publique)
6. (Optionnel) **Variables** : `ALLOWED_ORIGINS=https://xxx.vercel.app` si appels browser-direct au lieu de la proxy
7. Deploy automatique à chaque push sur `main`

Railway détecte Python via `requirements.txt`, install les deps, et lance via `railway.json` :
- Start : `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check : `GET /api/health` toutes les 100s

## Roadmap V1

- [x] Scaffold monorepo
- [x] Endpoints `/api/analyses` (POST + GET) reprenant scripts immo-analyzer-v1
- [x] Pages frontend : landing + formulaire + résultats avec verdict, scénarios, travaux
- [x] Architecture single-origin (Vercel rewrites vers Railway)
- [ ] Déploiement live sur Vercel + Railway
- [ ] Connexion Supabase (Postgres pour persistance des analyses)
- [ ] Auth Supabase (login Google)
- [ ] Page "Mes analyses" (historique user)
- [ ] Upload photos de rénovation (Supabase Storage)
- [ ] Domaine perso (.com ou .be)
- [ ] Stripe + paywall (1 analyse gratuite, illimité en payant)
