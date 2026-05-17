"""Supabase client helpers.

Two flavors :
- get_admin_client() : utilise SERVICE_ROLE_KEY, bypass RLS, pour ops admin
- get_user_client(jwt) : utilise le JWT user, RLS s'applique
"""

import os
from functools import lru_cache

from supabase import Client, create_client


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    """Client avec service_role : bypass RLS, pour admin operations."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans l'environnement"
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_user_client(jwt: str | None = None) -> Client:
    """Client avec JWT user : RLS s'applique pour respecter les policies.

    Si jwt None, utilise anon key (typiquement read-only sur tables publiques).
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL et SUPABASE_ANON_KEY requis dans l'environnement"
        )
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    if jwt:
        client.postgrest.auth(jwt)
    return client


def get_user_id_from_jwt(client: Client, jwt: str) -> str | None:
    """Recupere le user_id du JWT (verifie via l'API Supabase Auth)."""
    try:
        user_response = client.auth.get_user(jwt)
        if user_response and user_response.user:
            return user_response.user.id
    except Exception:
        return None
    return None
