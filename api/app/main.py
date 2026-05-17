"""FastAPI entry point pour immo-analyzer-saas."""

import os
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import AnalysisRequest, AnalysisResponse, ListingSummary
from app.services import analyzer, scraper

app = FastAPI(
    title="immo-analyzer-api",
    version="0.2.0",
    description="Backend API pour l'analyse d'investissement immobilier locatif belge",
)

# CORS : en architecture proxifiee (Next.js rewrites -> Railway), les requetes
# arrivent server-to-server donc CORS ne s'applique pas. On garde quand meme
# une liste pour le dev local et les appels browser-direct au cas ou.
# Override via env var ALLOWED_ORIGINS="https://foo.com,https://bar.com" en prod.
_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store. Sera remplace par Postgres/Supabase plus tard.
STORE: dict[str, AnalysisResponse] = {}


@app.get("/")
def root():
    return {
        "name": "immo-analyzer-api",
        "version": "0.2.0",
        "status": "running",
        "docs": "/docs",
        "analyses_in_memory": len(STORE),
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _clean_listing(raw: dict) -> dict:
    """Sanitize raw scraper output: convertit '' en None pour les types optionnels."""
    field_names = set(ListingSummary.model_fields.keys())
    return {k: (None if v == "" else v) for k, v in raw.items() if k in field_names}


@app.post("/api/analyses", response_model=AnalysisResponse)
def create_analysis(req: AnalysisRequest) -> AnalysisResponse:
    """Scrape une annonce Immoweb et calcule l'analyse financiere complete.

    Synchrone pour V1 (10-15s typique). Sera mis en background avec une
    queue plus tard si besoin (Inngest / Celery).
    """
    try:
        listing_raw = scraper.fetch_listing(str(req.url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"URL invalide: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur scraping Immoweb: {e}")

    params = {
        "revenu_net": req.revenu_net,
        "apport": req.apport,
        "usage": req.usage,
        "duree_credit": req.duree_credit,
        "prix_negocie": req.prix_negocie,
    }

    try:
        analyse = analyzer.analyze(listing_raw, params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur analyse: {e}")

    aid = str(uuid.uuid4())
    response = AnalysisResponse(
        id=aid,
        url=str(req.url),
        listing=ListingSummary(**_clean_listing(listing_raw)),
        analyse=analyse,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    STORE[aid] = response
    return response


@app.get("/api/analyses/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: str) -> AnalysisResponse:
    """Recupere une analyse par son ID."""
    if analysis_id not in STORE:
        raise HTTPException(status_code=404, detail=f"Analyse {analysis_id} introuvable")
    return STORE[analysis_id]


@app.get("/api/analyses")
def list_analyses() -> list[dict]:
    """Liste resumée de toutes les analyses en memoire (pour debug)."""
    return [
        {
            "id": a.id,
            "url": a.url,
            "address": a.listing.address,
            "price": a.listing.price,
            "verdict": a.analyse.get("verdict", {}).get("titre"),
            "score": a.analyse.get("score", {}).get("total"),
            "created_at": a.created_at,
        }
        for a in STORE.values()
    ]
