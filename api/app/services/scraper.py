"""Scraper Immoweb - extrait les donnees structurees d'une annonce.

Strategie en 2 etapes :
  1. Tentative directe avec headers Chrome + session cookies
  2. Si 403/anti-bot -> fallback via ScraperAPI (residential IPs)
"""

import os
import json
import re
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup


SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY", "")


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8,"
        "application/signed-exchange;v=b3;q=0.7"
    ),
    "Accept-Language": "fr-BE,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Priority": "u=0, i",
}


def fetch_html(url: str) -> str:
    """Recupere le HTML brut de l'annonce Immoweb.

    Strategie :
     1. Essaie en direct avec headers Chrome + session cookies (le moins cher)
     2. Si 403 (anti-bot detecte IP datacenter) -> fallback ScraperAPI

    Necessite SCRAPER_API_KEY dans l'env pour le fallback. Sans, leve l'erreur 403.
    """
    if not url.startswith("https://www.immoweb.be/"):
        raise ValueError("URL doit etre une annonce Immoweb (https://www.immoweb.be/...)")

    # ----- Tentative 1 : direct avec Chrome fingerprint + cookies session
    session = requests.Session()
    session.headers.update(HEADERS)
    try:
        session.get("https://www.immoweb.be/", timeout=15)
    except requests.RequestException:
        pass

    try:
        response = session.get(
            url, timeout=30, headers={"Referer": "https://www.immoweb.be/"}
        )
        if response.status_code == 200:
            return response.text
        if response.status_code == 403 and SCRAPER_API_KEY:
            print(f"[scraper] Direct 403 sur {url}, fallback ScraperAPI...")
        else:
            response.raise_for_status()
    except requests.HTTPError:
        if not SCRAPER_API_KEY:
            raise

    # ----- Tentative 2 : ScraperAPI (residential proxy)
    if not SCRAPER_API_KEY:
        # Pas de cle, on releve le 403 original
        raise requests.HTTPError(
            "403 Client Error: Forbidden for url. "
            "Configure SCRAPER_API_KEY pour activer le fallback proxy."
        )

    proxied_url = (
        f"http://api.scraperapi.com/?api_key={SCRAPER_API_KEY}"
        f"&url={quote_plus(url)}"
        f"&country_code=be"  # IPs belges si possible
        f"&render=false"  # pas de JS rendering, on parse __NEXT_DATA__
    )
    proxy_response = requests.get(proxied_url, timeout=120)
    proxy_response.raise_for_status()
    print(f"[scraper] ScraperAPI fallback OK ({len(proxy_response.text)} bytes)")
    return proxy_response.text


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
