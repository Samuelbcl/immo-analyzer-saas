"""Email sender via Resend.

Necessite RESEND_API_KEY dans l'environnement. Si absent, no-op gracieux.
Free tier Resend : 100 emails/jour, 3000/mois.

Pour la prod : domaine custom verifie sur Resend, sinon utilise le domaine
sandbox onboarding@resend.dev (limite : on peut envoyer qu'a soi-meme).
"""

import os
from typing import Any


FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
APP_URL = os.getenv("APP_URL", "https://immo-analyzer-saas.vercel.app")


def send_alert_email(
    to_email: str,
    alert_label: str,
    listings: list[dict[str, Any]],
) -> bool:
    """Envoie un email d'alerte avec les nouveaux biens trouves.

    Retourne True si envoye avec succes, False sinon (lib absente, cle
    manquante, erreur reseau).
    """
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key or not listings:
        return False

    try:
        import resend

        resend.api_key = api_key
    except ImportError:
        print("Resend SDK not installed")
        return False

    subject = f"🏠 {len(listings)} nouveau{'x' if len(listings) > 1 else ''} bien{'s' if len(listings) > 1 else ''} pour ton alerte « {alert_label} »"
    html = _build_alert_html(alert_label, listings)

    try:
        resend.Emails.send(
            {
                "from": f"immo-analyzer <{FROM_EMAIL}>",
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
        return True
    except Exception as e:
        print(f"Resend send failed: {e}")
        return False


def _build_alert_html(alert_label: str, listings: list[dict[str, Any]]) -> str:
    """Construit le HTML de l'email."""
    rows = []
    for listing in listings:
        price = (
            f"{listing.get('price', 0):,} EUR".replace(",", " ")
            if listing.get("price")
            else "Prix sur demande"
        )
        address = listing.get("address") or listing.get("city") or "Adresse inconnue"
        bedrooms = listing.get("bedrooms") or "?"
        surface = listing.get("surface") or "?"
        url = listing.get("url", "#")

        rows.append(
            f"""
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">{address}</div>
            <div style="color: #64748b; font-size: 14px;">{price} · {surface} m² · {bedrooms} chambre(s)</div>
            <a href="{url}" style="display: inline-block; margin-top: 8px; color: #4f46e5; text-decoration: none; font-weight: 500;">
              Voir sur Immoweb →
            </a>
          </td>
        </tr>"""
        )

    rows_html = "".join(rows)

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nouveaux biens pour ton alerte</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f8fafc;">
    <tr>
      <td style="padding: 32px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td>
              <div style="font-size: 24px; font-weight: 800; color: #4f46e5; margin-bottom: 4px;">
                immo · analyzer
              </div>
              <h1 style="font-size: 22px; color: #0f172a; margin: 16px 0 8px;">
                {len(listings)} nouveau{'x' if len(listings) > 1 else ''} bien{'s' if len(listings) > 1 else ''} pour toi
              </h1>
              <p style="color: #64748b; margin: 0 0 24px;">
                Ton alerte <strong style="color: #0f172a;">« {alert_label} »</strong> a trouvé ces nouvelles annonces sur Immoweb.
              </p>

              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                {rows_html}
              </table>

              <div style="text-align: center; margin-top: 32px;">
                <a href="{APP_URL}/mes-alertes" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Gérer mes alertes
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Tu reçois cet email parce que tu as configuré une alerte sur immo-analyzer.
                <a href="{APP_URL}/mes-alertes" style="color: #4f46e5;">Désactiver l'alerte</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
