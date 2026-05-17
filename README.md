# immo-analyzer-saas

Application web SaaS d'analyse d'investissement immobilier locatif belge (Wallonie).

Pivot du CLI plugin Claude Code [immo-analyzer-v1](https://github.com/Samuelbcl/immo-analyzer) vers une vraie web app.

## Structure

```
immo-analyzer-saas/
├── web/          Frontend Next.js 15 (App Router, TypeScript, Tailwind)
├── api/          Backend FastAPI (Python 3.13)
└── README.md
```

## Stack

- **Front** : Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (à ajouter)
- **Back** : FastAPI, Pydantic, Uvicorn
- **DB / Auth / Storage** : Supabase (à configurer)
- **Paiements** : Stripe (à configurer)
- **Déploiement** : Vercel (front) + Railway (back)

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
- Docs auto-générées : `http://localhost:8000/docs`

### Frontend Next.js (port 3000)

```powershell
cd web
npm run dev
```

Le front consomme l'API sur `http://localhost:8000`.

## Roadmap V1

- [x] Scaffold monorepo
- [ ] Connexion Supabase (DB + Auth)
- [ ] Page d'accueil + login Google
- [ ] Formulaire "analyser une annonce Immoweb"
- [ ] Endpoint `/api/analyses` qui reprend scripts immo-analyzer-v1
- [ ] Page résultats (rapport HTML)
- [ ] Historique des analyses
- [ ] Upload photos de rénovation
- [ ] Stripe + paywall (1 analyse gratuite, illimité en payant)
- [ ] Déploiement Vercel + Railway
