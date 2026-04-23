"""
Optional Auth0 JWT validation for OpsIQ.

OSS self-hosted users who don't set AUTH0_DOMAIN are always allowed through
(get_current_user_optional returns None). Cloud users get their Auth0
sub/claims in the returned dict.
"""
import os

import httpx
from fastapi import Request
from jose import JWTError, jwt

AUTH0_DOMAIN   = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")


async def validate_bearer_token(token: str) -> dict | None:
    """
    Validates a raw JWT string against Auth0.
    Returns the decoded payload, or None on any failure.
    Returns None immediately if AUTH0_DOMAIN is not configured (OSS mode).
    """
    if not AUTH0_DOMAIN:
        return None
    try:
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_url)
            jwks = resp.json()

        unverified_header = jwt.get_unverified_header(token)
        rsa_key = next(
            (key for key in jwks["keys"] if key["kid"] == unverified_header["kid"]),
            None,
        )
        if not rsa_key:
            return None

        return jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
    except (JWTError, Exception):
        return None


async def get_current_user_optional(request: Request) -> dict | None:
    """
    Validates Auth0 JWT if present and Auth0 is configured.
    Returns decoded payload dict, or None if:
      - AUTH0_DOMAIN env var is not set (OSS mode)
      - No Authorization header
      - Token is invalid / expired
    Never raises — always allows the request through.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1]
    return await validate_bearer_token(token)
