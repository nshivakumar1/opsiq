"""
OpsIQ Cloud — Query rate limiting
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from cloud.models import Workspace

logger = logging.getLogger(__name__)

PLAN_LIMITS: dict[str, float] = {
    "free":       50,
    "pro":        2000,
    "enterprise": float("inf"),
}


class QueryLimitExceeded(Exception):
    def __init__(self, plan: str, limit: int):
        self.plan  = plan
        self.limit = limit
        super().__init__(f"Query limit exceeded: {limit} queries/month on {plan} plan")


async def check_and_increment_query_count(workspace: Workspace, db: Session) -> None:
    """
    Resets the monthly counter if we're in a new calendar month, then
    increments it. Raises QueryLimitExceeded if the workspace is at its limit.
    """
    try:
        now = datetime.utcnow()

        # Reset if we've rolled into a new month/year
        if (
            workspace.query_count_reset_at.month != now.month
            or workspace.query_count_reset_at.year != now.year
        ):
            workspace.query_count_month    = 0
            workspace.query_count_reset_at = now

        limit = PLAN_LIMITS.get(workspace.plan, 50)

        if workspace.query_count_month >= limit:
            raise QueryLimitExceeded(workspace.plan, int(limit))

        workspace.query_count_month += 1
        db.commit()

    except QueryLimitExceeded:
        raise
    except Exception:
        db.rollback()
        logger.exception("Failed to check/increment query count for workspace %s", workspace.id)
        raise
