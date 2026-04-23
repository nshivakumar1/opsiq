"""
OpsIQ Cloud — Workspace helpers
"""
import logging
import re
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from cloud.models import Workspace

logger = logging.getLogger(__name__)


def _make_slug(email: str) -> str:
    base = re.sub(r"[^a-z0-9]", "-", email.split("@")[0].lower())[:30]
    return f"{base}-{uuid.uuid4().hex[:6]}"


async def get_or_create_workspace(
    auth0_user_id: str,
    email: str,
    db: Session,
) -> Workspace:
    """
    Returns the existing workspace for this Auth0 user, or creates one on
    first login. New workspaces start on the free plan.
    """
    try:
        workspace = (
            db.query(Workspace)
            .filter(Workspace.auth0_user_id == auth0_user_id)
            .first()
        )
        if not workspace:
            workspace = Workspace(
                id=str(uuid.uuid4()),
                name=(email.split("@")[0] + "'s workspace" if email else "My Workspace"),
                slug=_make_slug(email) if email else f"workspace-{uuid.uuid4().hex[:6]}",
                auth0_user_id=auth0_user_id,
                email=email,
                plan="free",
                subscription_status="active",
                query_count_month=0,
                query_count_reset_at=datetime.utcnow(),
            )
            db.add(workspace)
            db.commit()
            db.refresh(workspace)
            logger.info("Created workspace %s for %s", workspace.id, email or auth0_user_id)

        # Backfill email on existing workspaces that were created without one
        if not workspace.email and email:
            workspace.email = email
            db.commit()

        return workspace

    except Exception:
        db.rollback()
        logger.exception("Failed to get or create workspace for %s", auth0_user_id)
        raise


async def get_workspace_by_id(workspace_id: str, db: Session) -> Workspace | None:
    try:
        return db.query(Workspace).filter(Workspace.id == workspace_id).first()
    except Exception:
        logger.exception("Failed to fetch workspace %s", workspace_id)
        return None
