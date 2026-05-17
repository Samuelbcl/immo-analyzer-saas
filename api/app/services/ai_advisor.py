"""IA Coach : genere des conseils personnalises en francais a partir d'une analyse.

Utilise GPT-4o-mini (rapide, peu cher : ~$0.0005 par appel).
Config via OPENAI_API_KEY dans l'environnement.
"""

import json
import os
from typing import Any

from openai import OpenAI


SYSTEM_PROMPT = """Tu es un coach en investissement immobilier locatif belge, specialise sur le marche wallon.

Ton role : aider l'utilisateur a comprendre RAPIDEMENT ce qu'il y a a savoir sur ce bien et son projet d'achat. Tu donnes des conseils factuels et bienveillants, jamais paternalistes ni blocants.

Style :
- Ton direct, chaleureux, tutoiement
- Maximum 3 conseils, du plus important au moins important
- Chaque conseil : 2-3 phrases max, avec chiffres precis quand pertinent
- Pas d'introduction generale, pas de conclusion, va direct aux conseils
- Format MARKDOWN avec titres en gras ; chaque conseil commence par un titre court (3-5 mots) en gras suivi d'un trait

IMPORTANT - ce que tu ne fais PAS :
- Tu ne dis JAMAIS "ce n'est pas finance-able" ou "abandonne", meme si la quotite depasse les seuils BNB
- Tu n'inflictes pas un verdict. Tu informes et tu suggeres
- Si quotite trop haute : suggere les options (plus d'apport, prix negocie, habitation propre au lieu de locatif, etc.) sans dramatiser
- Tu pars du principe que l'utilisateur sait ce qu'il fait et qu'il peut decider lui-meme

Tu connais le contexte belge :
- Droits enregistrement Wallonie : 3% habitation propre, 12.5% locatif
- Quotite max BNB : 90% habitation propre, 80% locatif (PAS bloquant absolu, certaines banques montent)
- Plafond ratio effort recommande : 33-35%
- Marche locatif Liege/Verviers/Namur : taux occupation 92-95%
- Primes Wallonie : isolation, audit logement, VMC
"""


def generate_advice(listing: dict[str, Any], analyse: dict[str, Any]) -> str | None:
    """Genere des conseils personnalises via GPT-4o-mini.

    Retourne None si la cle API n'est pas configuree, ou en cas d'erreur reseau.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    user_prompt = _build_user_prompt(listing, analyse)

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=600,
        )
        return response.choices[0].message.content
    except Exception as e:
        # Log silently pour ne pas casser la creation d'analyse
        print(f"AI advisor error: {e}")
        return None


def _build_user_prompt(listing: dict[str, Any], analyse: dict[str, Any]) -> str:
    """Construit le prompt utilisateur en injectant les donnees clees."""
    verdict = analyse.get("verdict", {})
    fin = analyse.get("financement", {})
    travaux = analyse.get("travaux", {})
    marche = analyse.get("marche", {})
    scenarios = analyse.get("scenarios", {})
    params = analyse.get("params", {})
    score = analyse.get("score", {})

    # Resume compact des scenarios
    scenarios_summary = []
    for key, sc in scenarios.items():
        scenarios_summary.append({
            "nom": sc.get("nom"),
            "loyer_mensuel": sc.get("loyer_mensuel"),
            "rendement_net_pct": sc.get("rendement_net_pct"),
            "cash_flow_net_annuel": sc.get("cash_flow_net_annuel"),
        })

    context = {
        "bien": {
            "adresse": listing.get("address"),
            "ville": listing.get("city"),
            "prix": listing.get("price"),
            "surface_m2": listing.get("surface"),
            "chambres": listing.get("bedrooms"),
            "peb": listing.get("peb"),
            "annee_construction": listing.get("year_built"),
            "features": listing.get("features"),
        },
        "profil_acheteur": {
            "revenu_net_mensuel": params.get("revenu_net"),
            "apport": params.get("apport"),
            "usage": params.get("usage"),
            "duree_credit_ans": params.get("duree_credit"),
        },
        "financement": {
            "investissement_total": analyse.get("investissement_total"),
            "montant_emprunte": fin.get("montant_emprunte"),
            "mensualite": fin.get("mensualite"),
            "ratio_effort_pct": fin.get("ratio_effort_pct"),
            "quotite_pct": fin.get("quotite_pct"),
            "quotite_acceptable": fin.get("quotite_acceptable"),
        },
        "marche": {
            "prix_marche_m2": marche.get("prix_moyen_m2"),
            "prix_bien_m2": marche.get("prix_bien_m2"),
            "decote_vs_marche_pct": marche.get("decote_vs_marche_pct"),
        },
        "travaux": {
            "total_net_euros": travaux.get("total_net"),
            "primes_wallonie": travaux.get("primes_wallonie_estimees"),
        },
        "scenarios_locatifs": scenarios_summary,
        "verdict_systeme": {
            "couleur": verdict.get("couleur"),
            "titre": verdict.get("titre"),
            "texte": verdict.get("texte"),
            "score_100": score.get("total"),
        },
    }

    return (
        "Voici l'analyse complete d'un bien que l'utilisateur envisage d'acheter. "
        "Donne 3 conseils personnalises selon CE bien et CE profil.\n\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )
