"""FastAPI entry point pour immo-analyzer-saas."""

import os
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import AnalysisRequest, AnalysisResponse, ListingSummary
from app.services import ai_advisor, analyzer, scraper
from app.services.supabase_client import (
    get_admin_client,
    get_user_client,
    get_user_id_from_jwt,
)

app = FastAPI(
    title="immo-analyzer-api",
    version="0.3.0",
    description="Backend API pour l'analyse d'investissement immobilier locatif belge",
)

_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _extract_jwt(authorization: str | None) -> str | None:
    """Extrait le JWT de l'header Authorization: Bearer <token>."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _clean_listing(raw: dict) -> dict:
    """Sanitize raw scraper output : '' -> None."""
    field_names = set(ListingSummary.model_fields.keys())
    return {k: (None if v == "" else v) for k, v in raw.items() if k in field_names}


def _row_to_response(row: dict) -> dict:
    """Map row Postgres -> AnalysisResponse JSON.

    DB column 'analysis_data' (reserved keyword workaround) -> API field 'analyse'.
    """
    return {
        "id": row["id"],
        "url": row["url"],
        "listing": row["listing"],
        "analyse": row["analysis_data"],
        "created_at": row["created_at"],
    }


@app.get("/")
def root():
    return {
        "name": "immo-analyzer-api",
        "version": "0.3.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyses", response_model=AnalysisResponse)
def create_analysis(
    req: AnalysisRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> AnalysisResponse:
    """Scrape Immoweb + analyse + (auth requise) sauvegarde Postgres.

    Genere aussi un conseil IA en parallele via OpenAI (best effort, ne bloque
    pas si la cle API absente).
    """
    jwt = _extract_jwt(authorization)
    if not jwt:
        raise HTTPException(
            status_code=401,
            detail="Authentification requise. Connecte-toi via /login.",
        )

    # Verifie le JWT et recupere le user_id
    admin = get_admin_client()
    user_id = get_user_id_from_jwt(admin, jwt)
    if not user_id:
        raise HTTPException(status_code=401, detail="JWT invalide ou expire.")

    # Scraping Immoweb
    try:
        listing_raw = scraper.fetch_listing(str(req.url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"URL invalide : {e}")
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Erreur scraping Immoweb : {e}"
        )

    # Calculs financiers
    params = {
        "revenu_net": req.revenu_net,
        "apport": req.apport,
        "usage": req.usage,
        "duree_credit": req.duree_credit,
        "prix_negocie": req.prix_negocie,
    }
    try:
        analyse_data = analyzer.analyze(listing_raw, params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur analyse : {e}")

    # IA Coach (best effort, optionnel)
    try:
        advice = ai_advisor.generate_advice(listing_raw, analyse_data)
        if advice:
            analyse_data["ai_advice"] = advice
    except Exception as e:
        print(f"AI advice generation failed (non-blocking) : {e}")

    listing_clean = _clean_listing(listing_raw)

    # Persistance via user client (RLS applique)
    user_client = get_user_client(jwt)
    aid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    insert_row = {
        "id": aid,
        "user_id": user_id,
        "url": str(req.url),
        "params": params,
        "listing": listing_clean,
        "analysis_data": analyse_data,
        "created_at": now,
    }

    try:
        user_client.table("analyses").insert(insert_row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur sauvegarde DB : {e}")

    return AnalysisResponse(
        id=aid,
        url=str(req.url),
        listing=ListingSummary(**listing_clean),
        analyse=analyse_data,
        created_at=now,
    )


@app.get("/api/analyses/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
    analysis_id: str,
    authorization: Annotated[str | None, Header()] = None,
) -> AnalysisResponse:
    """Recupere une analyse. RLS garantit que l'user ne voit que les siennes."""
    jwt = _extract_jwt(authorization)
    if not jwt:
        raise HTTPException(status_code=401, detail="Authentification requise.")

    user_client = get_user_client(jwt)
    try:
        result = (
            user_client.table("analyses")
            .select("*")
            .eq("id", analysis_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Analyse introuvable")

    if not result.data:
        raise HTTPException(status_code=404, detail="Analyse introuvable")

    return AnalysisResponse(**_row_to_response(result.data))


@app.get("/api/analyses")
def list_analyses(
    authorization: Annotated[str | None, Header()] = None,
) -> list[dict]:
    """Liste les analyses de l'utilisateur connecte (RLS auto-filtre)."""
    jwt = _extract_jwt(authorization)
    if not jwt:
        raise HTTPException(status_code=401, detail="Authentification requise.")

    user_client = get_user_client(jwt)
    try:
        result = (
            user_client.table("analyses")
            .select("id, url, listing, analysis_data, created_at")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")

    rows = result.data or []
    return [
        {
            "id": r["id"],
            "url": r["url"],
            "address": (r.get("listing") or {}).get("address"),
            "price": (r.get("listing") or {}).get("price"),
            "city": (r.get("listing") or {}).get("city"),
            "verdict": (r.get("analysis_data") or {}).get("verdict", {}).get("titre"),
            "verdict_color": (r.get("analysis_data") or {}).get("verdict", {}).get("couleur"),
            "score": (r.get("analysis_data") or {}).get("score", {}).get("total"),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@app.delete("/api/analyses/{analysis_id}")
def delete_analysis(
    analysis_id: str,
    authorization: Annotated[str | None, Header()] = None,
):
    """Supprime une analyse (RLS verifie que c'est bien la sienne)."""
    jwt = _extract_jwt(authorization)
    if not jwt:
        raise HTTPException(status_code=401, detail="Authentification requise.")

    user_client = get_user_client(jwt)
    try:
        user_client.table("analyses").delete().eq("id", analysis_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")
    return {"deleted": analysis_id}
