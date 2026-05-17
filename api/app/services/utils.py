"""
utils.py - Helpers de calcul financier pour l'analyse immobiliere belge.
"""

from math import pow

from .market_data import (
    DROITS_ENREGISTREMENT,
    QUOTITE_MAX,
    frais_notaire_estimes,
    frais_hypotheque,
    precompte_immobilier,
)


def mensualite(capital: float, taux_annuel: float, duree_annees: int) -> float:
    """Calcule la mensualite d'un credit hypothecaire a taux fixe."""
    if capital <= 0 or taux_annuel <= 0 or duree_annees <= 0:
        return 0
    t = taux_annuel / 12
    n = duree_annees * 12
    return capital * t / (1 - pow(1 + t, -n))


def capacite_emprunt(
    revenu_net: float,
    taux_endettement_max: float = 0.33,
    taux_annuel: float = 0.0377,
    duree_annees: int = 25,
) -> float:
    """Calcule le capital max empruntable selon le revenu et le taux d'endettement."""
    mens_max = revenu_net * taux_endettement_max
    t = taux_annuel / 12
    n = duree_annees * 12
    return mens_max * (1 - pow(1 + t, -n)) / t


def droits_enregistrement(prix_achat: float, type_achat: str = "habitation_propre_unique") -> float:
    """Calcule les droits d'enregistrement Wallonie."""
    taux = DROITS_ENREGISTREMENT.get(type_achat, 0.125)
    return prix_achat * taux


def frais_acquisition_total(prix_achat: float, type_achat: str, montant_emprunte: float = None) -> dict:
    """Detail de tous les frais d'acquisition d'un bien."""
    droits = droits_enregistrement(prix_achat, type_achat)
    notaire = frais_notaire_estimes(prix_achat)
    hypo = frais_hypotheque(montant_emprunte or prix_achat * 0.85)
    return {
        "prix_achat": prix_achat,
        "droits_enregistrement": round(droits, 2),
        "frais_notaire": round(notaire, 2),
        "frais_hypotheque": round(hypo, 2),
        "total_frais": round(droits + notaire + hypo, 2),
        "total_acquisition": round(prix_achat + droits + notaire + hypo, 2),
    }


def rendement_locatif_brut(prix_total: float, loyer_mensuel: float) -> float:
    """Rendement brut annuel en %."""
    if prix_total <= 0:
        return 0
    return (loyer_mensuel * 12) / prix_total * 100


def rendement_locatif_net(
    investissement_total: float,
    loyer_mensuel: float,
    rc: float,
    commune: str,
    taux_vacance: float = 0.08,
    taux_gestion: float = 0.05,
    taux_entretien: float = 0.01,
    assurance_annuelle: float = 300,
) -> dict:
    """Rendement net en % apres toutes charges."""
    loyer_annuel = loyer_mensuel * 12
    pi = precompte_immobilier(rc, commune)
    vacance = loyer_annuel * taux_vacance
    gestion = loyer_annuel * taux_gestion
    entretien = investissement_total * taux_entretien

    charges_totales = pi + vacance + gestion + entretien + assurance_annuelle
    cash_flow_net = loyer_annuel - charges_totales
    rendement = cash_flow_net / investissement_total * 100 if investissement_total > 0 else 0

    return {
        "loyer_annuel_brut": round(loyer_annuel, 2),
        "precompte_immobilier": round(pi, 2),
        "vacance": round(vacance, 2),
        "gestion": round(gestion, 2),
        "entretien": round(entretien, 2),
        "assurance": round(assurance_annuelle, 2),
        "charges_totales": round(charges_totales, 2),
        "cash_flow_net_annuel": round(cash_flow_net, 2),
        "rendement_net_pct": round(rendement, 2),
    }


def tableau_amortissement(
    capital: float, taux_annuel: float, duree_annees: int
) -> list[dict]:
    """Genere le tableau d'amortissement annee par annee."""
    if capital <= 0:
        return []
    t = taux_annuel / 12
    mens = mensualite(capital, taux_annuel, duree_annees)
    crd = capital
    annees = []
    for annee in range(1, duree_annees + 1):
        interets_annee = 0
        capital_rembourse_annee = 0
        for _ in range(12):
            interet_mois = crd * t
            capital_mois = mens - interet_mois
            crd -= capital_mois
            interets_annee += interet_mois
            capital_rembourse_annee += capital_mois
        annees.append({
            "annee": annee,
            "mensualite": round(mens, 2),
            "interets_annuels": round(interets_annee, 2),
            "capital_rembourse_annuel": round(capital_rembourse_annee, 2),
            "capital_restant_du": round(max(crd, 0), 2),
        })
    return annees


def stress_test(
    capital: float,
    taux_base: float,
    duree: int,
    revenu_net_mensuel: float,
    loyer_mensuel: float,
) -> dict:
    """Tests de resistance : hausse taux, baisse loyer, vacance accrue."""
    mens_base = mensualite(capital, taux_base, duree)
    return {
        "base": {
            "mensualite": round(mens_base, 2),
            "ratio_effort": round(mens_base / revenu_net_mensuel * 100, 1),
            "couverture_loyer": round(loyer_mensuel / mens_base * 100, 1) if mens_base > 0 else 0,
        },
        "taux_plus_1pct": {
            "mensualite": round(mensualite(capital, taux_base + 0.01, duree), 2),
            "ratio_effort": round(mensualite(capital, taux_base + 0.01, duree) / revenu_net_mensuel * 100, 1),
        },
        "taux_plus_2pct": {
            "mensualite": round(mensualite(capital, taux_base + 0.02, duree), 2),
            "ratio_effort": round(mensualite(capital, taux_base + 0.02, duree) / revenu_net_mensuel * 100, 1),
        },
        "vacance_15pct": {
            "loyer_net": round(loyer_mensuel * 0.85, 2),
            "cash_flow_vs_mensualite": round(loyer_mensuel * 0.85 - mens_base, 2),
        },
    }


def quotite_acceptable(montant_emprunte: float, valeur_bien: float, type_achat: str) -> tuple[bool, float]:
    """Verifie si la quotite est dans les limites BNB."""
    quotite = montant_emprunte / valeur_bien if valeur_bien > 0 else 0
    max_q = QUOTITE_MAX.get(type_achat, 0.80)
    return (quotite <= max_q, round(quotite * 100, 1))


def projection_locative_10ans(
    investissement_initial: float,
    loyer_initial_mensuel: float,
    charges_annuelles_initial: float,
    indexation_loyer_pct: float = 0.02,
    indexation_charges_pct: float = 0.025,
) -> list[dict]:
    """Projection de cash-flow locatif sur 10 ans avec indexation."""
    rows = []
    loyer = loyer_initial_mensuel
    charges = charges_annuelles_initial
    cumul_cf = 0
    for annee in range(1, 11):
        loyer_annuel = loyer * 12
        cf_net = loyer_annuel - charges
        cumul_cf += cf_net
        rows.append({
            "annee": annee,
            "loyer_mensuel": round(loyer, 2),
            "loyer_annuel": round(loyer_annuel, 2),
            "charges_annuelles": round(charges, 2),
            "cash_flow_net": round(cf_net, 2),
            "cumul_cash_flow": round(cumul_cf, 2),
            "rendement_an": round(cf_net / investissement_initial * 100, 2) if investissement_initial > 0 else 0,
        })
        loyer *= 1 + indexation_loyer_pct
        charges *= 1 + indexation_charges_pct
    return rows
