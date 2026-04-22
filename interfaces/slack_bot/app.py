"""
OpsIQ Slack Bot
===============
Async Slack Bolt app, designed to be mounted into the existing FastAPI server.

Listens for:
  - app_mention  : @opsiq <question> in any channel
  - message.im   : direct messages to the bot

Required env vars:
  SLACK_BOT_TOKEN      xoxb-... (bot token, chat:write + app_mentions:read + im:history)
  SLACK_SIGNING_SECRET From App Settings > Basic Information

To mount in FastAPI (done in api/main.py):
  from interfaces.slack_bot.app import slack_app_router
  app.include_router(slack_app_router)

Slack app config checklist:
  Event Subscriptions → Request URL: https://<host>/slack/events
  Subscribe to bot events:
    - app_mention
    - message.im
  OAuth Scopes (Bot Token):
    - app_mentions:read
    - chat:write
    - im:history
    - im:read
    - im:write
"""
import logging
import os

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.fastapi.async_handler import AsyncSlackRequestHandler
from fastapi import APIRouter, Request, Response

from .handlers import handle_mention, handle_dm

logger = logging.getLogger(__name__)


def _build_slack_app() -> AsyncApp | None:
    """
    Build the Slack Bolt app. Returns None (and logs a warning) if env vars
    are missing — allows the rest of OpsIQ to start without Slack configured.
    """
    token = os.getenv("SLACK_BOT_TOKEN")
    signing_secret = os.getenv("SLACK_SIGNING_SECRET")

    if not token or not signing_secret:
        logger.warning(
            "SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET not set — "
            "Slack bot interface disabled."
        )
        return None

    app = AsyncApp(token=token, signing_secret=signing_secret)

    # ── Event handlers ────────────────────────────────────────────────────────

    @app.event("app_mention")
    async def on_mention(event, say, client, logger):
        await handle_mention(event, say, client, logger)

    @app.event("message")
    async def on_dm(event, say, client, logger):
        # Only handle DMs (channel_type == "im")
        if event.get("channel_type") == "im":
            await handle_dm(event, say, client, logger)

    return app


# Build once at import time
_slack_app = _build_slack_app()
_handler = AsyncSlackRequestHandler(_slack_app) if _slack_app else None

# ── FastAPI router ────────────────────────────────────────────────────────────

slack_app_router = APIRouter(prefix="/slack", tags=["slack"])


@slack_app_router.post("/events")
async def slack_events(request: Request) -> Response:
    """
    Entry point for all Slack Events API payloads.
    Bolt handles signature verification, URL verification, and routing.
    """
    if _handler is None:
        return Response(
            content="Slack bot not configured (missing env vars).",
            status_code=503,
        )
    return await _handler.handle(request)
