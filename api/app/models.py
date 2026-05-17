"""Pydantic models for API request/response."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


class AnalysisRequest(BaseModel):
    """Body for POST /api/analyses."""

    url: HttpUrl
    revenu_net: float = Field(gt=0, le=20000, description="Revenu net mensuel en EUR")
    apport: float = Field(ge=0, le=10_000_000, description="Apport disponible en EUR")
    usage: Literal["habitation_propre_unique", "investissement_locatif"] = (
        "habitation_propre_unique"
    )
    duree_credit: int = Field(default=25, ge=10, le=30)
    prix_negocie: Optional[float] = Field(default=None, ge=0, le=10_000_000)


class ListingSummary(BaseModel):
    """Donnees normalisees extraites de l'annonce Immoweb."""

    url: Optional[str] = None
    reference: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    price: Optional[int] = None
    surface: Optional[int] = None
    land_surface: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    peb: Optional[str] = None
    rc: Optional[int] = None
    year_built: Optional[int] = None
    features: list[str] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    agency: Optional[str] = None


class AnalysisResponse(BaseModel):
    """Reponse complete d'une analyse : listing + analyse financiere."""

    id: str
    url: str
    listing: ListingSummary
    analyse: dict[str, Any]
    created_at: str
