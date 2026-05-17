"""Analyse financiere complete d'un bien immobilier (Wallonie)."""

from .market_data import (
    COUTS_TRAVAUX,
    LOYER_MOYEN,
    PRIMES_WALLONIE,
    PRIX_M2_VENTE,
    TAUX_HYPOTHECAIRE,
)
from .utils import (
    capacite_emprunt,
    frais_acquisition_total,
    mensualite,
    projection_locative_10ans,
    quotite_acceptable,
    rendement_locatif_net,
    stress_test,
    tableau_amortissement,
)


def get_city_key(city: str | None) -> str:
    if not city:
        return "default"
    city_low = city.lower().strip()
    for key in PRIX_M2_VENTE.keys():
        if key in city_low:
            return key
    return "default"


def estimate_loyer(city: str, bedrooms: int, surface: int) -> int:
    city_key = get_city_key(city)
    loyers = LOYER_MOYEN.get(city_key, LOYER_MOYEN["default"])
    typo = "4ch" if bedrooms >= 4 else f"{bedrooms}ch" if bedrooms >= 1 else "studio"
    base = loyers.get(typo, loyers["3ch"])
    surface_typique = {"studio": 30, "1ch": 50, "2ch": 70, "3ch": 90, "4ch": 120}.get(typo, 90)
    if surface and surface_typique:
        adjustment = (surface - surface_typique) / surface_typique * 0.30
        base = base * (1 + max(-0.20, min(0.30, adjustment)))
    return int(round(base / 10) * 10)


def estimer_budget_travaux(listing: dict) -> dict:
    """Estime le budget travaux selon les features detectees et le PEB."""
    surface = listing.get("surface") or 100
    bathrooms = listing.get("bathrooms") or 1
    features = listing.get("features") or []
    peb = (listing.get("peb") or "E").upper()

    postes: dict[str, float] = {}
    m2_toit = 0  # init for primes section

    peb_score = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6}.get(peb, 4)

    if peb_score >= 4:
        m2_toit = max(40, surface * 0.40)
        postes["isolation_toiture"] = m2_toit * COUTS_TRAVAUX["isolation_toiture_par_m2"]
        m2_facade = surface * 0.50
        postes["isolation_facade_interieur"] = m2_facade * COUTS_TRAVAUX["isolation_facade_int_par_m2"]
        postes["vmc_simple_flux"] = COUTS_TRAVAUX["vmc_simple_flux_forfait"]

    if peb_score >= 5:
        m2_chassis = surface * 0.18
        postes["chassis_pvc"] = m2_chassis * COUTS_TRAVAUX["chassis_pvc_par_m2"]

    if "gaz_condensation" not in features:
        postes["chaudiere_condensation"] = COUTS_TRAVAUX["chaudiere_condensation_gaz"]

    if "elec_conforme" not in features:
        postes["mise_conformite_elec"] = surface * COUTS_TRAVAUX["mise_conformite_elec_par_m2"]

    if bathrooms >= 1:
        postes["sdb_rafraichissement"] = COUTS_TRAVAUX["sdb_rafraichissement_forfait"]
    if bathrooms >= 2:
        postes["seconde_sdb"] = COUTS_TRAVAUX["sdb_rafraichissement_forfait"] * 0.75

    postes["cuisine_economique"] = 7 * COUTS_TRAVAUX["cuisine_economique_par_m2"]
    postes["peinture"] = surface * COUTS_TRAVAUX["peinture_par_m2"]
    postes["sols_stratifie"] = surface * 0.7 * COUTS_TRAVAUX["sol_stratifie_par_m2"]
    postes["plomberie_divers"] = COUTS_TRAVAUX["plomberie_divers_forfait"]
    postes["audit_logement"] = COUTS_TRAVAUX["audit_logement_certinergie"]
    postes["certif_peb_final"] = COUTS_TRAVAUX["certificat_peb_apres_travaux"]

    sous_total = sum(postes.values())
    reserve = sous_total * COUTS_TRAVAUX["reserve_imprevus_pct"]
    total_brut = sous_total + reserve

    primes_estimees = 0.0
    if "isolation_toiture" in postes:
        primes_estimees += min(
            postes["isolation_toiture"] * 0.35,
            m2_toit * PRIMES_WALLONIE["isolation_toiture_par_m2_max"],
        )
    if "isolation_facade_interieur" in postes:
        primes_estimees += min(
            postes["isolation_facade_interieur"] * 0.30,
            surface * 0.50 * PRIMES_WALLONIE["isolation_facade_par_m2_max"],
        )
    if "vmc_simple_flux" in postes:
        primes_estimees += min(
            postes["vmc_simple_flux"] * 0.35,
            PRIMES_WALLONIE["vmc_forfait_max"],
        )
    primes_estimees += min(postes["audit_logement"], PRIMES_WALLONIE["audit_logement_max"])

    return {
        "postes": {k: round(v) for k, v in postes.items()},
        "sous_total": round(sous_total),
        "reserve_imprevus": round(reserve),
        "total_brut": round(total_brut),
        "primes_wallonie_estimees": round(primes_estimees),
        "total_net": round(total_brut - primes_estimees),
    }


def build_travaux_from_budget(budget: float) -> dict:
    """Construit un dict travaux compatible quand l'user fournit son propre budget.

    Pas de decomposition par poste : l'user a deja sa propre vision.
    """
    budget = float(budget or 0)
    return {
        "postes": {},
        "sous_total": round(budget),
        "reserve_imprevus": 0,
        "total_brut": round(budget),
        "primes_wallonie_estimees": 0,
        "total_net": round(budget),
        "user_provided": True,
    }


def calculer_scenarios(listing: dict, travaux: dict, params: dict) -> dict:
    """Calcule jusqu'a 3 scenarios : unifamilial, colocation, division."""
    prix_negocie = params.get("prix_negocie") or listing.get("price") or 0
    if prix_negocie and "Faire offre" in (listing.get("description") or ""):
        prix_negocie = int(prix_negocie * 1.08)

    usage = params.get("usage", "habitation_propre_unique")
    revenu_net = params.get("revenu_net", 2200)
    duree = params.get("duree_credit", 25)

    taux_key = "fixe_25_ans" if usage == "habitation_propre_unique" else "fixe_25_ans_locatif"
    taux = TAUX_HYPOTHECAIRE.get(taux_key, 0.0410)

    invest_total_min = prix_negocie + travaux["total_net"]
    apport = params.get("apport", 13000)
    frais = frais_acquisition_total(prix_negocie, usage, invest_total_min - apport)
    cout_acquisition = frais["total_acquisition"]
    invest_total = cout_acquisition + travaux["total_net"]

    cap_max = capacite_emprunt(revenu_net, 0.33, taux, duree)
    montant_emprunte = invest_total - apport
    quotite_ok, quotite = quotite_acceptable(
        montant_emprunte, prix_negocie + travaux["total_net"], usage
    )
    mens = mensualite(montant_emprunte, taux, duree)

    bedrooms = listing.get("bedrooms") or 3
    loyer_base = estimate_loyer(listing.get("city"), bedrooms, listing.get("surface") or 100)

    scenarios = {}

    rend1 = rendement_locatif_net(
        invest_total, loyer_base,
        listing.get("rc") or 500, listing.get("city") or "",
    )
    scenarios["1_unifamilial"] = {
        "nom": "Locatif unifamilial",
        "loyer_mensuel": loyer_base,
        "investissement_total": invest_total,
        **rend1,
    }

    # Colocation : seulement si 2+ chambres (n'a pas de sens pour studio/1ch)
    if bedrooms >= 2:
        loyer_chambre = int(loyer_base / bedrooms * 1.55)
        loyer_coloc_total = loyer_chambre * bedrooms
        rend2 = rendement_locatif_net(
            invest_total, loyer_coloc_total,
            listing.get("rc") or 500, listing.get("city") or "",
            taux_vacance=0.15, taux_gestion=0.08,
        )
        scenarios["2_colocation"] = {
            "nom": "Colocation par chambres",
            "loyer_par_chambre": loyer_chambre,
            "nb_chambres": bedrooms,
            "loyer_mensuel": loyer_coloc_total,
            "investissement_total": invest_total,
            **rend2,
        }

    if bedrooms >= 3 and (listing.get("surface") or 0) >= 100:
        surcout_division = 16500
        invest_div = invest_total + surcout_division
        loyer_studio = int(estimate_loyer(listing.get("city"), 0, 35))
        loyer_duplex = int(estimate_loyer(
            listing.get("city"), bedrooms - 1, (listing.get("surface") or 100) - 35
        ))
        loyer_total_div = loyer_studio + loyer_duplex
        rend3 = rendement_locatif_net(
            invest_div, loyer_total_div,
            listing.get("rc") or 500, listing.get("city") or "",
            taux_vacance=0.08, taux_gestion=0.06,
        )
        scenarios["3_division"] = {
            "nom": "Division studio + duplex",
            "surcout_travaux": surcout_division,
            "loyer_studio": loyer_studio,
            "loyer_duplex": loyer_duplex,
            "loyer_mensuel": loyer_total_div,
            "investissement_total": invest_div,
            "permis_requis": True,
            **rend3,
        }

    return {
        "prix_negocie": prix_negocie,
        "frais_acquisition": frais,
        "investissement_total": invest_total,
        "financement": {
            "apport": apport,
            "montant_emprunte": montant_emprunte,
            "taux_applique": taux,
            "duree_annees": duree,
            "mensualite": round(mens, 2),
            "capacite_max_emprunt": round(cap_max),
            "quotite_pct": quotite,
            "quotite_acceptable": quotite_ok,
            "ratio_effort_pct": round(mens / revenu_net * 100, 1),
        },
        "scenarios": scenarios,
        "stress_test": stress_test(montant_emprunte, taux, duree, revenu_net, loyer_base),
    }


def calculer_score(listing: dict, analyse: dict, market_price_m2: float) -> dict:
    """Score global sur 100, decompose en 5 categories."""
    surface = listing.get("surface") or 100
    prix = analyse.get("prix_negocie") or 0
    prix_m2 = prix / surface if surface > 0 else 0

    # 25 pts - Prix /m2 vs marche
    if market_price_m2 > 0:
        ratio = prix_m2 / market_price_m2
        prix_score = max(0, min(25, (1 - ratio) * 50 + 12.5))
    else:
        prix_score = 12

    # 30 pts - Rendement net (meilleur scenario)
    rendements = [s.get("rendement_net_pct", 0) for s in analyse["scenarios"].values()]
    best_rend = max(rendements) if rendements else 0
    rendement_score = max(0, min(30, best_rend * 4))

    # 20 pts - Etat technique
    features = listing.get("features") or []
    peb = (listing.get("peb") or "G").upper()
    etat_score = 0
    if "elec_conforme" in features: etat_score += 6
    if "gaz_condensation" in features: etat_score += 5
    if "double_vitrage" in features: etat_score += 4
    peb_bonus = {"A": 5, "B": 5, "C": 4, "D": 3, "E": 2, "F": 1, "G": 0}.get(peb, 1)
    etat_score += peb_bonus

    # 15 pts - Localisation (proxy : prix marche /m2)
    loc_score = min(15, market_price_m2 / 150)

    # 10 pts - Potentiel division
    div_potential = 10 if "3_division" in analyse["scenarios"] else 5

    total = prix_score + rendement_score + etat_score + loc_score + div_potential

    return {
        "total": round(total),
        "details": {
            "prix_m2": round(prix_score, 1),
            "rendement": round(rendement_score, 1),
            "etat_technique": round(etat_score, 1),
            "localisation": round(loc_score, 1),
            "potentiel_division": round(div_potential, 1),
        },
    }


def verdict(score: int, analyse: dict) -> dict:
    """Verdict en francais selon le score et la situation financiere."""
    quotite_ok = analyse["financement"]["quotite_acceptable"]
    ratio_effort = analyse["financement"]["ratio_effort_pct"]

    if not quotite_ok:
        return {
            "couleur": "rouge",
            "titre": "Financement bloqué",
            "texte": "La quotité demandée dépasse les seuils BNB pour ce type d'achat. Apport insuffisant.",
        }
    if ratio_effort > 35:
        return {
            "couleur": "ambre",
            "titre": "Ratio d'effort élevé",
            "texte": "La mensualité dépasse 35% de tes revenus. Faisable mais tendu : prévois une marge de sécurité.",
        }
    if score >= 70:
        return {
            "couleur": "vert",
            "titre": "Excellente opportunité",
            "texte": "Bien sous-coté avec un rendement et une faisabilité solides. Va vite, le marché ne te laissera pas le temps.",
        }
    if score >= 55:
        return {
            "couleur": "vert",
            "titre": "Bon investissement sous conditions",
            "texte": "Le bien est rentable et le financement tient, sous réserve de validation des points techniques.",
        }
    if score >= 40:
        return {
            "couleur": "ambre",
            "titre": "Mitigé — à creuser",
            "texte": "Quelques points positifs mais des compromis. Va voir 2-3 autres biens avant de te décider.",
        }
    return {
        "couleur": "rouge",
        "titre": "À éviter",
        "texte": "Le rapport qualité-prix-rendement ne convainc pas. Passe ton chemin.",
    }


def analyze(listing: dict, params: dict) -> dict:
    """Pipeline d'analyse complet : travaux + scenarios + score + projection.

    Si params['travaux_budget'] est fourni (meme 0), on utilise cette valeur
    au lieu de l'estimateur conservatif. C'est utile pour l'user qui a deja
    une idee de son budget travaux apres visite.
    """
    user_travaux = params.get("travaux_budget")
    if user_travaux is not None:
        travaux = build_travaux_from_budget(user_travaux)
    else:
        travaux = estimer_budget_travaux(listing)
    scenarios = calculer_scenarios(listing, travaux, params)

    city_key = get_city_key(listing.get("city"))
    market_price = PRIX_M2_VENTE.get(city_key, PRIX_M2_VENTE["default"]).get("maison", 1600)
    score = calculer_score(listing, scenarios, market_price)
    verd = verdict(score["total"], scenarios)

    sc1 = scenarios["scenarios"]["1_unifamilial"]
    projection = projection_locative_10ans(
        sc1["investissement_total"],
        sc1["loyer_mensuel"],
        sc1["charges_totales"],
    )

    amort = tableau_amortissement(
        scenarios["financement"]["montant_emprunte"],
        scenarios["financement"]["taux_applique"],
        scenarios["financement"]["duree_annees"],
    )

    # Totaux all-in pour les nouvelles visualisations
    fin = scenarios["financement"]
    total_remboursement = fin["mensualite"] * 12 * fin["duree_annees"]
    total_interets = total_remboursement - fin["montant_emprunte"]
    cout_total_acquisition_25ans = (
        scenarios["prix_negocie"]
        + scenarios["frais_acquisition"]["total_frais"]
        + travaux["total_net"]
        + total_interets
    )

    return {
        "params": params,
        "marche": {
            "ville": listing.get("city"),
            "prix_moyen_m2": market_price,
            "prix_bien_m2": round(scenarios["prix_negocie"] / (listing.get("surface") or 1)),
            "decote_vs_marche_pct": round(
                (1 - scenarios["prix_negocie"] / (listing.get("surface") or 1) / market_price) * 100,
                1,
            ),
        },
        "travaux": travaux,
        **scenarios,
        "score": score,
        "verdict": verd,
        "projection_locative_10ans": projection,
        "tableau_amortissement": amort,
        "totaux": {
            "total_remboursement": round(total_remboursement, 2),
            "total_interets_banque": round(total_interets, 2),
            "cout_total_acquisition_25ans": round(cout_total_acquisition_25ans, 2),
        },
    }
