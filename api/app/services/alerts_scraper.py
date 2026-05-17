"""Scraper Immoweb pour les pages de RECHERCHE (liste de biens).

Different du scraper d'annonce unique : ici on parcourt les resultats d'une
recherche filtree (ville + prix max + chambres min) pour les alertes email.

Note : Immoweb peut casser ce scraper s'il change sa structure. A surveiller.
"""

import json
import re

import requests
from bs4 import BeautifulSoup

from .scraper import HEADERS


# Mapping de quelques villes -> codes postaux pour Immoweb
CITY_POSTAL_CODES = {
    "liege": ["4000", "4020", "4030", "4031", "4032"],
    "verviers": ["4800"],
    "namur": ["5000", "5001", "5002", "5003", "5004"],
    "charleroi": ["6000", "6001", "6010", "6020", "6030", "6031", "6032", "6040"],
    "mons": ["7000"],
    "bruxelles": ["1000"],
    "seraing": ["4100", "4101", "4102"],
    "herstal": ["4040"],
}


def build_search_url(
    city: str,
    max_price: int,
    min_bedrooms: int = 1,
    property_type: str = "maison-et-appartement",
) -> str:
    """Construit une URL de recherche Immoweb."""
    city_low = city.lower().strip()
    postal_codes = CITY_POSTAL_CODES.get(city_low, [])

    base = f"https://www.immoweb.be/fr/recherche/{property_type}/a-vendre"
    params = [
        "countries=BE",
        f"maxPrice={max_price}",
        f"minBedroomCount={min_bedrooms}",
        "orderBy=newest",
    ]
    if postal_codes:
        params.append(f"postalCodes={','.join(postal_codes)}")
    return f"{base}?{'&'.join(params)}"


def search_listings(
    city: str,
    max_price: int,
    min_bedrooms: int = 1,
    property_type: str = "maison-et-appartement",
    max_results: int = 30,
) -> list[dict]:
    """Lance une recherche Immoweb et retourne une liste de biens correspondants.

    Retourne : [{url, reference, price, bedrooms, surface, address, postal_code}]

    Best effort : si Immoweb change sa structure, retourne liste vide.
    """
    url = build_search_url(city, max_price, min_bedrooms, property_type)

    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        # Visite home pour les cookies anti-bot
        try:
            session.get("https://www.immoweb.be/", timeout=15)
        except Exception:
            pass

        response = session.get(
            url, timeout=30, headers={"Referer": "https://www.immoweb.be/"}
        )
        response.raise_for_status()
    except Exception as e:
        print(f"Search scraper failed for {city}: {e}")
        return []

    html = response.text
    listings = _extract_listings_from_next_data(html)

    if not listings:
        # Fallback : extraction depuis liens dans le HTML
        listings = _extract_listings_from_links(html)

    return listings[:max_results]


def _extract_listings_from_next_data(html: str) -> list[dict]:
    """Extrait les listings depuis le blob __NEXT_DATA__ (Immoweb Next.js)."""
    match = re.search(
        r'<script[^>]*id="__NEXT_DATA__"[^>]*>(\{.*?\})</script>',
        html,
        re.DOTALL,
    )
    if not match:
        return []

    try:
        data = json.loads(match.group(1))
    except Exception:
        return []

    # Structure typique Immoweb : props.pageProps.results ou similaire
    page_props = (data.get("props") or {}).get("pageProps") or {}
    raw_results = (
        page_props.get("results")
        or page_props.get("classifieds")
        or page_props.get("items")
        or []
    )

    if not isinstance(raw_results, list):
        return []

    listings = []
    for item in raw_results:
        if not isinstance(item, dict):
            continue
        listing = _normalize_search_item(item)
        if listing and listing.get("url"):
            listings.append(listing)

    return listings


def _normalize_search_item(item: dict) -> dict | None:
    """Normalise un item de resultats de recherche."""
    listing_id = item.get("id") or item.get("classifiedId") or item.get("reference")
    if not listing_id:
        return None

    prop = item.get("property") or item
    loc = (prop.get("location") if isinstance(prop, dict) else None) or {}
    transaction = item.get("transaction") or {}
    sale = transaction.get("sale") if isinstance(transaction, dict) else None

    postal_code = str(loc.get("postalCode") or "")
    city = loc.get("locality") or ""

    # Detection du type pour construire l'URL
    sub_type = (
        (prop.get("subtypeOfProperty") if isinstance(prop, dict) else None)
        or (item.get("subtypeOfProperty"))
        or "maison"
    )
    sub_type = str(sub_type).lower()

    url = f"https://www.immoweb.be/fr/annonce/{sub_type}/a-vendre/{city.lower()}/{postal_code}/{listing_id}"

    price = None
    if isinstance(sale, dict):
        price = sale.get("price")

    return {
        "url": url,
        "reference": str(listing_id),
        "price": price,
        "bedrooms": (prop.get("bedroomCount") if isinstance(prop, dict) else None),
        "surface": (
            prop.get("netHabitableSurface") if isinstance(prop, dict) else None
        ),
        "address": f"{loc.get('street', '')} {loc.get('number', '')}, {postal_code} {city}".strip(),
        "postal_code": postal_code,
        "city": city,
    }


def _extract_listings_from_links(html: str) -> list[dict]:
    """Fallback : extraction des liens d'annonces directement depuis le HTML."""
    soup = BeautifulSoup(html, "html.parser")
    listings = []
    seen_ids = set()

    pattern = re.compile(
        r"/fr/annonce/[^/]+/a-vendre/[^/]+/(\d+)/(\d+)"
    )

    for link in soup.find_all("a", href=True):
        href = link["href"]
        m = pattern.search(href)
        if not m:
            continue
        postal_code, listing_id = m.groups()
        if listing_id in seen_ids:
            continue
        seen_ids.add(listing_id)

        full_url = (
            href if href.startswith("http") else f"https://www.immoweb.be{href}"
        )
        listings.append(
            {
                "url": full_url,
                "reference": listing_id,
                "price": None,
                "bedrooms": None,
                "surface": None,
                "address": None,
                "postal_code": postal_code,
                "city": None,
            }
        )

    return listings
