"""
Slack event handlers for OpsIQ.

Handles two event types:
  app_mention  — user @-mentions @opsiq in any channel the bot is in
  message.im   — user sends a direct message to the bot

Flow per event:
  1. Post a "Thinking..." placeholder (satisfies Slack's 3-s ack window)
  2. Run the agent in a thread executor (agent.query is synchronous)
  3. Update the placeholder with the real answer + Block Kit formatting
"""
import asyncio
import logging
import re
import uuid
from functools import partial

from agent.core import OpsIQAgent
from .formatting import agent_response_blocks, error_blocks, thinking_blocks

logger = logging.getLogger(__name__)

# One agent instance per process; it's stateless except for MemoryStore
_agent = OpsIQAgent()


def _strip_mention(text: str) -> str:
    """Remove the leading <@UXXXXXXX> bot mention from a message."""
    return re.sub(r"^<@[A-Z0-9]+>\s*", "", text).strip()


def _session_id(user: str, channel: str) -> str:
    """
    Deterministic session ID so follow-up questions in the same DM/channel
    share conversation history. Format: slack-{user}-{channel}.
    """
    return f"slack-{user}-{channel}"


async def handle_mention(event: dict, say, client, logger=logger):
    """
    Handler for app_mention events.
    Bot must be invited to the channel for this to fire.
    """
    text = _strip_mention(event.get("text", ""))
    channel = event["channel"]
    user = event.get("user", "unknown")
    thread_ts = event.get("thread_ts") or event.get("ts")
    session_id = _session_id(user, channel)

    if not text:
        await say(
            text="Hi! Mention me with a question about your DevOps stack.",
            thread_ts=thread_ts,
        )
        return

    # Post placeholder in thread
    placeholder = await client.chat_postMessage(
        channel=channel,
        thread_ts=thread_ts,
        text="OpsIQ is thinking...",
        blocks=thinking_blocks(text),
    )
    placeholder_ts = placeholder["ts"]

    try:
        result = await _run_agent(text, session_id)
        blocks = agent_response_blocks(
            answer=result["answer"],
            tools_used=result["tools_used"],
            session_id=result["session_id"],
            query=text,
        )
        await client.chat_update(
            channel=channel,
            ts=placeholder_ts,
            text=result["answer"][:150],  # fallback for notifications
            blocks=blocks,
        )
    except Exception as exc:
        logger.exception("Agent error in handle_mention")
        await client.chat_update(
            channel=channel,
            ts=placeholder_ts,
            text="OpsIQ encountered an error.",
            blocks=error_blocks(str(exc)),
        )


async def handle_dm(event: dict, say, client, logger=logger):
    """
    Handler for direct messages (message.im).
    Ignores bot's own messages and message edits/deletes.
    """
    # Ignore subtypes (message_changed, message_deleted, bot_message, etc.)
    if event.get("subtype") or event.get("bot_id"):
        return

    text = event.get("text", "").strip()
    channel = event["channel"]
    user = event.get("user", "unknown")
    session_id = _session_id(user, channel)

    if not text:
        return

    placeholder = await client.chat_postMessage(
        channel=channel,
        text="OpsIQ is thinking...",
        blocks=thinking_blocks(text),
    )
    placeholder_ts = placeholder["ts"]

    try:
        result = await _run_agent(text, session_id)
        blocks = agent_response_blocks(
            answer=result["answer"],
            tools_used=result["tools_used"],
            session_id=result["session_id"],
            query=text,
        )
        await client.chat_update(
            channel=channel,
            ts=placeholder_ts,
            text=result["answer"][:150],
            blocks=blocks,
        )
    except Exception as exc:
        logger.exception("Agent error in handle_dm")
        await client.chat_update(
            channel=channel,
            ts=placeholder_ts,
            text="OpsIQ encountered an error.",
            blocks=error_blocks(str(exc)),
        )


async def _run_agent(query: str, session_id: str) -> dict:
    """
    Run the synchronous OpsIQAgent.query in a thread executor so it
    doesn't block the async event loop.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, partial(_agent.query, query, session_id)
    )
