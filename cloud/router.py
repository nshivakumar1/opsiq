"""
OpsIQ Cloud — /cloud API router
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from cloud.auth import get_current_user_optional
from cloud.billing import (
    FRONTEND_URL,
    PLANS,
    create_checkout_session,
    create_customer_portal_session,
    handle_webhook,
)
from cloud.limits import PLAN_LIMITS
from cloud.models import QueryLog, get_db
from cloud.workspace import get_or_create_workspace

logger = logging.getLogger(__name__)

cloud_router = APIRouter(prefix="/cloud", tags=["cloud"])


# ── Request schemas ───────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str


# ── GET /cloud/me ─────────────────────────────────────────────────────────────

@cloud_router.get("/me")
async def get_me(
    current_user: dict | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Returns the current user's workspace info, plan, and usage.
    Creates a free workspace on first call.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    workspace = await get_or_create_workspace(
        auth0_user_id=current_user["sub"],
        email=current_user.get("email", ""),
        db=db,
    )

    limit     = PLAN_LIMITS.get(workspace.plan, 50)
    limit_int = int(limit) if limit != float("inf") else None
    remaining = max(0, limit_int - workspace.query_count_month) if limit_int is not None else None

    return {
        "workspace_id":         workspace.id,
        "email":                workspace.email,
        "plan":                 workspace.plan,
        "subscription_status":  workspace.subscription_status,
        "query_count_month":    workspace.query_count_month,
        "query_limit":          limit_int,
        "queries_remaining":    remaining,
        "stripe_customer_id":   workspace.stripe_customer_id,
    }


# ── POST /cloud/billing/checkout ──────────────────────────────────────────────

@cloud_router.post("/billing/checkout")
async def billing_checkout(
    body: CheckoutRequest,
    current_user: dict | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Creates a Stripe Checkout Session. Returns the checkout URL."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    workspace = await get_or_create_workspace(
        auth0_user_id=current_user["sub"],
        email=current_user.get("email", ""),
        db=db,
    )

    try:
        checkout_url = await create_checkout_session(
            workspace_id=workspace.id,
            plan=body.plan,
            user_email=workspace.email,
        )
        return {"checkout_url": checkout_url}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Failed to create checkout session for workspace %s", workspace.id)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


# ── POST /cloud/billing/portal ────────────────────────────────────────────────

@cloud_router.post("/billing/portal")
async def billing_portal(
    current_user: dict | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Creates a Stripe Customer Portal session for subscription self-management."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    workspace = await get_or_create_workspace(
        auth0_user_id=current_user["sub"],
        email=current_user.get("email", ""),
        db=db,
    )

    if not workspace.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No billing account found. Upgrade to Pro first.",
        )

    try:
        portal_url = await create_customer_portal_session(
            stripe_customer_id=workspace.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/app",
        )
        return {"portal_url": portal_url}
    except Exception:
        logger.exception("Failed to create portal session for workspace %s", workspace.id)
        raise HTTPException(status_code=500, detail="Failed to create customer portal session")


# ── POST /cloud/billing/webhook ───────────────────────────────────────────────

@cloud_router.post("/billing/webhook")
async def billing_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe webhook receiver. No auth — Stripe calls this directly.
    IMPORTANT: reads the raw body before any JSON parsing so the signature
    verification succeeds.
    """
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        result = handle_webhook(payload, sig_header, db)
        return result
    except ValueError as exc:
        logger.warning("Webhook rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Webhook processing error")
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# ── GET /cloud/usage ──────────────────────────────────────────────────────────

@cloud_router.get("/usage")
async def get_usage(
    current_user: dict | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Returns the last 20 queries for the current workspace."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    workspace = await get_or_create_workspace(
        auth0_user_id=current_user["sub"],
        email=current_user.get("email", ""),
        db=db,
    )

    logs = (
        db.query(QueryLog)
        .filter(QueryLog.workspace_id == workspace.id)
        .order_by(QueryLog.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "query":          log.query,
            "tools_used":     log.tools_used,
            "answer_preview": log.answer_preview,
            "created_at":     log.created_at.isoformat(),
        }
        for log in logs
    ]
