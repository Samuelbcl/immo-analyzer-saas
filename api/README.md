# api - FastAPI backend

Backend Python pour immo-analyzer-saas. Reprend les scripts métier d'immo-analyzer-v1.

## Setup local (Windows PowerShell)

```powershell
# Depuis api/
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

L'API tourne sur `http://localhost:8000`.

## Endpoints actuels

- `GET /` -> infos du service
- `GET /api/health` -> ping (200 OK)
- `GET /docs` -> Swagger UI (auto-genere par FastAPI)
- `GET /redoc` -> ReDoc (alternative)

## Endpoints a venir

Reprise des scripts immo-analyzer-v1 :

- `POST /api/analyses` -> lance une analyse depuis une URL Immoweb
  - body : `{ "url": "...", "revenu_net": ..., "apport": ..., "usage": ... }`
  - retourne : `{ "id": "...", "status": "running" }`
- `GET /api/analyses/{id}` -> recupere une analyse (listing + analyse + verdict + scenarios)
- `POST /api/analyses/{id}/renderings` -> upload photos renovation
- `GET /api/analyses/{id}/report.html` -> rapport HTML genere

## Structure

```
api/
├── README.md
├── requirements.txt
├── venv/                 # virtualenv local (gitignore)
└── app/
    ├── __init__.py
    └── main.py           # entry point FastAPI
```

Plus tard quand on ajoute des features :
```
app/
├── main.py
├── core/                 # config, settings, dependances
├── routers/              # endpoints groupes par domaine
├── models/               # schemas Pydantic
└── services/             # logique metier (reprise des scripts v1)
```
