"""Scraper Immoweb - extrait les donnees structurees d'une annonce."""

import json
import re

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
}


def fetch_html(url: str) -> str:
    """Recupere le HTML brut de l'annonce Immoweb."""
    if not url.startswith("https://www.immoweb.be/"):
        raise ValueError("URL doit etre une annonce Immoweb (https://www.immoweb.be/...)")
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def extract_classified_json(html: str) -> dict:
    """Extrait le blob window.classified embarque dans le HTML."""
    match = re.search(r"window\.classified\s*=\s*(\{.*?\});", html, re.DOTALL)
    if not match:
        match = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(\{.*?\})</script>', html, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            return data.get("props", {}).get("pageProps", {}).get("classified", {})
        raise ValueError("Bloc classified introuvable - Immoweb a peut-etre change sa structure.")
    return json.loads(match.group(1))


def parse_meta_fallback(html: str) -> dict:
    """Si l'extraction JSON echoue, on retombe sur les meta tags + description visible."""
    soup = BeautifulSoup(html, "html.parser")
    data = {}

    title = soup.find("meta", property="og:title")
    if title:
        text = title["content"].replace("&nbsp;", " ")
        price_m = re.search(r"([\d\s]+)\s*€", text)
        if price_m:
            data["price"] = int(re.sub(r"\D", "", price_m.group(1)))
        bed_m = re.search(r"(\d+)\s*chambres?", text)
        if bed_m:
            data["bedrooms"] = int(bed_m.group(1))
        surf_m = re.search(r"(\d+)\s*m²", text)
        if surf_m:
            data["surface"] = int(surf_m.group(1))

    desc = soup.find("meta", attrs={"name": "description"})
    if desc:
        text = desc["content"].replace("&nbsp;", " ")
        addr_m = re.search(r"Adresse:\s*(.+?)\s*—", text)
        if addr_m:
            data["address"] = addr_m.group(1).strip()

    img = soup.find("meta", property="og:image")
    if img:
        data["main_photo"] = img["content"]

    for h2 in soup.find_all("h2"):
        if "Description" in h2.get_text():
            sib = h2.find_next("p")
            if sib:
                data["description"] = sib.get_text(strip=True)
            break

    return data


def normalize(raw: dict, meta: dict, url: str) -> dict:
    """Transforme le blob brut Immoweb en structure stable."""
    out = {
        "url": url,
        "reference": None,
        "address": None,
        "city": None,
        "postal_code": None,
        "price": None,
        "surface": None,
        "land_surface": None,
        "bedrooms": None,
        "bathrooms": None,
        "peb": None,
        "rc": None,
        "year_built": None,
        "features": [],
        "photos": [],
        "description": None,
        "agency": None,
    }

    out.update({k: v for k, v in meta.items() if v is not None})

    if raw:
        out["reference"] = str(raw.get("id") or raw.get("reference") or out.get("reference"))
        prop = raw.get("property", {}) or {}
        loc = prop.get("location", {}) or {}
        out["postal_code"] = str(loc.get("postalCode") or out.get("postal_code") or "")
        out["city"] = loc.get("locality") or out.get("city")
        street = loc.get("street") or ""
        number = loc.get("number") or ""
        if street:
            out["address"] = f"{street} {number}, {out['postal_code']} {out['city']}".strip()

        out["price"] = (raw.get("transaction", {}) or {}).get("sale", {}).get("price") or out["price"]
        out["surface"] = prop.get("netHabitableSurface") or out["surface"]
        out["land_surface"] = (prop.get("land") or {}).get("surface") or out["land_surface"]
        out["bedrooms"] = prop.get("bedroomCount") or out["bedrooms"]
        out["bathrooms"] = prop.get("bathroomCount") or out["bathrooms"]
        out["peb"] = (prop.get("energy", {}) or {}).get("primaryEnergyConsumptionLevel") or out["peb"]
        out["rc"] = (raw.get("financial", {}) or {}).get("cadastralIncome") or out["rc"]
        out["year_built"] = (prop.get("building", {}) or {}).get("constructionYear") or out["year_built"]

        media = prop.get("media", {}) or {}
        out["photos"] = [p.get("largeUrl") for p in (media.get("pictures") or []) if p.get("largeUrl")]

        out["description"] = prop.get("description") or out.get("description")

        cust = raw.get("customers") or []
        if cust:
            out["agency"] = cust[0].get("name")

    if out["description"]:
        desc_lower = out["description"].lower()
        feature_keywords = {
            "elec_conforme": ["élec conforme", "électricité conforme", "elec en ordre"],
            "gaz_condensation": ["chaudière à condensation", "condensation gaz", "chaudière condensation"],
            "double_vitrage": ["double vitrage", "doubles vitrages"],
            "garage": ["garage", "carport"],
            "terrasse": ["terrasse", "balcon"],
            "jardin": ["jardin"],
            "cave": ["cave", "sous-sol"],
            "grenier": ["grenier"],
            "ascenseur": ["ascenseur"],
            "renovate_needed": ["à rénover", "à rafraîchir", "à moderniser"],
            "renovate_recent": ["entièrement rénové", "récemment rénové"],
        }
        for key, keywords in feature_keywords.items():
            if any(kw in desc_lower for kw in keywords):
                out["features"].append(key)

    return out


def fetch_listing(url: str) -> dict:
    """Pipeline complet : recupere et normalise une annonce Immoweb.

    Raises:
        ValueError: si l'URL n'est pas Immoweb
        requests.HTTPError: si Immoweb retourne un code d'erreur HTTP
    """
    html = fetch_html(url)
    try:
        raw = extract_classified_json(html)
    except Exception:
        raw = {}
    meta = parse_meta_fallback(html)
    return normalize(raw, meta, url)
