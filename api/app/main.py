"""FastAPI entry point pour immo-analyzer-saas."""

import os
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.models import AnalysisRequest, AnalysisResponse, ListingSummary
from app.services import ai_advisor, alerts_scraper, analyzer, email_sender, scraper
from app.services.supabase_client import (
    get_admin_client,
    get_user_client,
    get_user_id_from_jwt,
)

app = FastAPI(
    title="immo-analyzer-api",
    version="0.4.0",
    description="Backend API immo-analyzer-saas (Supabase + OpenAI + Resend)",
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

CRON_SECRET = os.getenv("CRON_SECRET", "")


def _extract_jwt(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _require_user(authorization: str | None) -> tuple[str, str]:
    """Retourne (jwt, user_id) ou raise 401."""
    jwt = _extract_jwt(authorization)
    if not jwt:
        raise HTTPException(status_code=401, detail="Authentification requise.")
    admin = get_admin_client()
    user_id = get_user_id_from_jwt(admin, jwt)
    if not user_id:
        raise HTTPException(status_code=401, detail="JWT invalide ou expire.")
    return jwt, user_id


def _clean_listing(raw: dict) -> dict:
    field_names = set(ListingSummary.model_fields.keys())
    return {k: (None if v == "" else v) for k, v in raw.items() if k in field_names}


def _row_to_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "url": row["url"],
        "listing": row["listing"],
        "analyse": row["analysis_data"],
        "created_at": row["created_at"],
    }


# ----- Models -----


class AlertRequest(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    max_price: int = Field(ge=10000, le=5_000_000)
    min_bedrooms: int = Field(default=1, ge=0, le=10)
    property_type: Literal[
        "maison", "appartement", "maison-et-appartement"
    ] = "maison-et-appartement"
    active: bool = True


class AlertResponse(BaseModel):
    id: str
    label: str | None
    city: str
    max_price: int
    min_bedrooms: int
    property_type: str
    active: bool
    created_at: str


# ----- Endpoints generaux -----


@app.get("/")
def root():
    return {
        "name": "immo-analyzer-api",
        "version": "0.4.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ----- Endpoints analyses -----


@app.post("/api/analyses", response_model=AnalysisResponse)
def create_analysis(
    req: AnalysisRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> AnalysisResponse:
    jwt, user_id = _require_user(authorization)

    try:
        listing_raw = scraper.fetch_listing(str(req.url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"URL invalide : {e}")
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Erreur scraping Immoweb : {e}"
        )

    params = {
        "revenu_net": req.revenu_net,
        "apport": req.apport,
        "usage": req.usage,
        "duree_credit": req.duree_credit,
        "prix_negocie": req.prix_negocie,
        "travaux_budget": req.travaux_budget,
    }
    try:
        analyse_data = analyzer.analyze(listing_raw, params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur analyse : {e}")

    try:
        advice = ai_advisor.generate_advice(listing_raw, analyse_data)
        if advice:
            analyse_data["ai_advice"] = advice
    except Exception as e:
        print(f"AI advice generation failed (non-blocking) : {e}")

    listing_clean = _clean_listing(listing_raw)
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
    jwt, _ = _require_user(authorization)
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
    jwt, _ = _require_user(authorization)
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
            "verdict_color": (r.get("analysis_data") or {})
            .get("verdict", {})
            .get("couleur"),
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
    jwt, _ = _require_user(authorization)
    user_client = get_user_client(jwt)
    try:
        user_client.table("analyses").delete().eq("id", analysis_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")
    return {"deleted": analysis_id}


# ----- Endpoints alertes email -----


@app.post("/api/alerts", response_model=AlertResponse)
def create_alert(
    req: AlertRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> AlertResponse:
    jwt, user_id = _require_user(authorization)
    user_client = get_user_client(jwt)
    aid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    row = {
        "id": aid,
        "user_id": user_id,
        "label": req.label or f"{req.city} < {req.max_price:,} EUR".replace(",", " "),
        "city": req.city.lower().strip(),
        "max_price": req.max_price,
        "min_bedrooms": req.min_bedrooms,
        "property_type": req.property_type,
        "active": req.active,
        "created_at": now,
    }
    try:
        user_client.table("user_alerts").insert(row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")

    return AlertResponse(**row)


@app.get("/api/alerts")
def list_alerts(
    authorization: Annotated[str | None, Header()] = None,
) -> list[AlertResponse]:
    jwt, _ = _require_user(authorization)
    user_client = get_user_client(jwt)
    try:
        result = (
            user_client.table("user_alerts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")
    return [AlertResponse(**r) for r in (result.data or [])]


@app.patch("/api/alerts/{alert_id}")
def update_alert(
    alert_id: str,
    payload: dict,
    authorization: Annotated[str | None, Header()] = None,
):
    """Update partiel (typiquement active true/false)."""
    jwt, _ = _require_user(authorization)
    user_client = get_user_client(jwt)
    try:
        user_client.table("user_alerts").update(payload).eq(
            "id", alert_id
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")
    return {"updated": alert_id}


@app.delete("/api/alerts/{alert_id}")
def delete_alert(
    alert_id: str,
    authorization: Annotated[str | None, Header()] = None,
):
    jwt, _ = _require_user(authorization)
    user_client = get_user_client(jwt)
    try:
        user_client.table("user_alerts").delete().eq("id", alert_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur DB : {e}")
    return {"deleted": alert_id}


# ----- Cron job pour les alertes -----


def _run_alert_scan() -> None:
    """Le vrai scan, execute en background apres que la requete HTTP soit close.

    Logge dans stdout (visible dans Railway logs). Pas de retour HTTP : ce
    n'est qu'apres que cron-job.org a deja recu son 202 Accepted.
    """
    admin = get_admin_client()

    try:
        alerts_res = (
            admin.table("user_alerts").select("*").eq("active", True).execute()
        )
    except Exception as e:
        print(f"[cron] Failed to read alerts: {e}")
        return

    alerts = alerts_res.data or []
    print(f"[cron] Scanning {len(alerts)} active alerts")

    for alert in alerts:
        try:
            user = admin.auth.admin.get_user_by_id(alert["user_id"]).user
            user_email = user.email if user else None
        except Exception as e:
            print(f"[cron] Cant get user {alert['user_id']}: {e}")
            continue
        if not user_email:
            continue

        listings = alerts_scraper.search_listings(
            alert["city"],
            alert["max_price"],
            alert["min_bedrooms"],
            alert["property_type"],
        )
        print(f"[cron] Alert '{alert.get('label')}': {len(listings)} listings found")

        try:
            notified_rows = (
                admin.table("alert_notifications")
                .select("listing_url")
                .eq("alert_id", alert["id"])
                .execute()
            )
            already_notified = {
                r["listing_url"] for r in (notified_rows.data or [])
            }
        except Exception:
            already_notified = set()

        new_listings = [
            l for l in listings if l["url"] not in already_notified
        ][:10]

        if not new_listings:
            print(f"[cron] Alert '{alert.get('label')}': no new listings")
            continue

        for listing in new_listings:
            try:
                admin.table("alert_notifications").insert(
                    {
                        "alert_id": alert["id"],
                        "user_id": alert["user_id"],
                        "listing_url": listing["url"],
                        "listing_reference": listing.get("reference"),
                        "listing_price": listing.get("price"),
                        "listing_address": listing.get("address"),
                    }
                ).execute()
            except Exception as e:
                print(f"[cron] Insert notification failed: {e}")

        sent = email_sender.send_alert_email(
            user_email, alert.get("label", "alerte"), new_listings
        )
        print(
            f"[cron] Alert '{alert.get('label')}': "
            f"{len(new_listings)} new, email sent={sent}"
        )


@app.post("/api/cron/check-alerts")
def check_alerts(
    background_tasks: BackgroundTasks,
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """Cron endpoint : repond immediatement, fait le scan en background.

    Securise par Authorization: Bearer <CRON_SECRET>.
    Retour rapide < 1s pour ne pas timeout sur cron-job.org (free 30s limit).
    Le vrai travail (scrape Immoweb + envoi emails) tourne dans BackgroundTasks
    apres que la response HTTP est envoyee.
    """
    token = _extract_jwt(authorization)
    if not CRON_SECRET or token != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Secret cron invalide.")

    admin = get_admin_client()
    try:
        count_res = (
            admin.table("user_alerts")
            .select("id", count="exact")
            .eq("active", True)
            .execute()
        )
        active_count = count_res.count or 0
    except Exception:
        active_count = -1

    background_tasks.add_task(_run_alert_scan)

    return {
        "queued": True,
        "message": "Scan started in background, check logs for results",
        "active_alerts": active_count,
    }
