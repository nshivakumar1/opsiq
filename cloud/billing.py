"""
OpsIQ Cloud — Stripe billing
"""
import asyncio
import logging
import os

import stripe

from cloud.limits import PLAN_LIMITS
from cloud.models import QueryLog, SessionLocal, Workspace

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL    = os.getenv("FRONTEND_URL", "https://opsiq.theinfinityloop.space").rstrip("/")

PLANS: dict[str, dict] = {
    "free": {
        "name":        "Free",
        "price_id":    None,
        "query_limit": 50,
        "price":       0,
    },
    "pro": {
        "name":        "Pro",
        "price_id":    os.getenv("STRIPE_PRICE_PRO"),
        "query_limit": 2000,
        "price":       49,
    },
}


# ── Checkout ──────────────────────────────────────────────────────────────────

async def create_checkout_session(
    workspace_id: str,
    plan: str,
    user_email: str,
) -> str:
    """
    Creates a Stripe Checkout Session for the given plan.
    Returns the hosted checkout URL.
    workspace_id is stored as metadata so the webhook knows which workspace to
    upgrade after payment.
    """
    plan_cfg = PLANS.get(plan)
    if not plan_cfg or not plan_cfg.get("price_id"):
        raise ValueError(f"Plan '{plan}' is not valid or has no Stripe price configured.")

    success_url = (
        f"{FRONTEND_URL}/app"
        f"?upgraded=true"
        f"&session_id={{CHECKOUT_SESSION_ID}}"
    )
    cancel_url = f"{FRONTEND_URL}/app?upgrade_cancelled=true"

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="subscription",
        line_items=[{"price": plan_cfg["price_id"], "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"workspace_id": workspace_id},
        **({"customer_email": user_email} if user_email and "@" in user_email else {}),
    )
    return session.url


# ── Customer portal ───────────────────────────────────────────────────────────

async def create_customer_portal_session(
    stripe_customer_id: str,
    return_url: str,
) -> str:
    """
    Creates a Stripe Customer Portal session. Users manage their own billing
    here — cancel, update card, download invoices.
    Returns the portal URL.
    """
    session = await asyncio.to_thread(
        stripe.billing_portal.Session.create,
        customer=stripe_customer_id,
        return_url=return_url,
    )
    return session.url


# ── Webhook ───────────────────────────────────────────────────────────────────

def handle_webhook(payload: bytes, sig_header: str, db) -> dict:
    """
    Verifies the Stripe webhook signature and processes the event synchronously.
    Must receive the raw request body — do NOT parse as JSON first.
    Raises ValueError on invalid payload or signature.
    """
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, _WEBHOOK_SECRET)
    except ValueError as exc:
        logger.error("Invalid webhook payload: %s", exc)
        raise
    except stripe.SignatureVerificationError as exc:
        logger.error("Invalid webhook signature: %s", exc)
        raise ValueError(f"Invalid signature: {exc}") from exc

    event_type = event["type"]
    logger.info("Webhook received: %s", event_type)

    try:
        if event_type == "checkout.session.completed":
            session_dict = event["data"]["object"].to_dict_recursive()
            workspace_id    = session_dict.get("metadata", {}).get("workspace_id")
            customer_id     = session_dict.get("customer")
            subscription_id = session_dict.get("subscription")

            logger.info(
                "Checkout completed: workspace=%s customer=%s subscription=%s",
                workspace_id, customer_id, subscription_id,
            )

            if workspace_id:
                ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
                if ws:
                    ws.plan                   = "pro"
                    ws.stripe_customer_id     = customer_id
                    ws.stripe_subscription_id = subscription_id
                    ws.subscription_status    = "active"
                    db.commit()
                    logger.info("Workspace %s upgraded to Pro", workspace_id)
                else:
                    logger.error("Workspace %s not found in DB", workspace_id)
            else:
                logger.error("No workspace_id in session metadata")

        elif event_type == "customer.subscription.updated":
            sub_dict = event["data"]["object"].to_dict_recursive()
            sub_id   = sub_dict.get("id")
            status   = sub_dict.get("status")
            ws = db.query(Workspace).filter(Workspace.stripe_subscription_id == sub_id).first()
            if ws:
                ws.subscription_status = status
                if status == "active":
                    ws.plan = "pro"
                db.commit()
                logger.info("Subscription updated: %s → %s", sub_id, status)

        elif event_type == "customer.subscription.deleted":
            sub_dict = event["data"]["object"].to_dict_recursive()
            sub_id   = sub_dict.get("id")
            ws = db.query(Workspace).filter(Workspace.stripe_subscription_id == sub_id).first()
            if ws:
                ws.plan                   = "free"
                ws.subscription_status    = "canceled"
                ws.stripe_subscription_id = None
                db.commit()
                logger.info("Subscription canceled: %s", sub_id)

        elif event_type == "invoice.payment_failed":
            inv_dict    = event["data"]["object"].to_dict_recursive()
            customer_id = inv_dict.get("customer")
            ws = db.query(Workspace).filter(Workspace.stripe_customer_id == customer_id).first()
            if ws:
                ws.subscription_status = "past_due"
                db.commit()
                logger.info("Payment failed: customer=%s", customer_id)

        else:
            logger.debug("Unhandled Stripe event type: %s", event_type)

    except Exception:
        db.rollback()
        logger.exception("Error processing webhook event %s", event_type)
        raise

    return {"received": True}


# ── Status helper ─────────────────────────────────────────────────────────────

async def get_subscription_status(workspace_id: str) -> dict:
    """Returns current plan, status, usage counts, and next reset for a workspace."""
    def _fetch():
        db = SessionLocal()
        try:
            ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not ws:
                return {}
            limit = PLAN_LIMITS.get(ws.plan, 50)
            return {
                "plan":               ws.plan,
                "subscription_status": ws.subscription_status,
                "query_count_month":  ws.query_count_month,
                "query_limit":        int(limit) if limit != float("inf") else None,
                "next_reset":         ws.query_count_reset_at.isoformat(),
            }
        finally:
            db.close()

    return await asyncio.to_thread(_fetch)
