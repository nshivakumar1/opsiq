"""
Slack Block Kit formatting for OpsIQ agent responses.
Converts plain agent text + metadata into structured Slack blocks.
"""
from typing import Optional


def agent_response_blocks(
    answer: str,
    tools_used: list[str],
    session_id: str,
    query: str,
) -> list[dict]:
    """
    Build Block Kit blocks for a completed agent response.

    Layout:
      [Header]  OpsIQ Response
      [Section] The answer (markdown)
      [Context] Tools used · Session ID
    """
    # Slack block text has a 3000-char limit per section
    answer_chunks = _split(answer, 2900)

    blocks: list[dict] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "OpsIQ", "emoji": True},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Query:* {query[:200]}"},
        },
        {"type": "divider"},
    ]

    for chunk in answer_chunks:
        blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": chunk}}
        )

    # Footer context
    footer_parts = []
    if tools_used:
        tools_str = ", ".join(f"`{t}`" for t in tools_used)
        footer_parts.append(f"Sources: {tools_str}")
    footer_parts.append(f"Session: `{session_id[:8]}`")

    blocks.append(
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": " · ".join(footer_parts)}
            ],
        }
    )

    return blocks


def thinking_blocks(query: str) -> list[dict]:
    """Placeholder blocks shown while the agent is running."""
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":thinking_face: *OpsIQ is thinking...*\n_{query[:200]}_",
            },
        }
    ]


def error_blocks(error: str) -> list[dict]:
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":warning: *OpsIQ error:* {error}",
            },
        }
    ]


def _split(text: str, limit: int) -> list[str]:
    """Split long text into chunks that fit within Slack's block limit."""
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks
