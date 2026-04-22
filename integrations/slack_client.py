"""
Slack Integration
=================
Outgoing Slack notifications via the Slack SDK.
Configure via SLACK_BOT_TOKEN env var.
"""
import os
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


class SlackClient:
    def __init__(self):
        token = os.getenv("SLACK_BOT_TOKEN")
        if not token:
            raise EnvironmentError("SLACK_BOT_TOKEN is not set.")
        self.client = WebClient(token=token)

    def send_message(self, channel: str, message: str) -> dict:
        """Send a message to a Slack channel or user."""
        try:
            # Normalize channel name
            if not channel.startswith("#") and not channel.startswith("U"):
                channel = f"#{channel}"
            response = self.client.chat_postMessage(
                channel=channel,
                text=message,
                mrkdwn=True,
            )
            return {
                "status": "sent",
                "channel": response["channel"],
                "ts": response["ts"],
                "message": message[:100] + "..." if len(message) > 100 else message,
            }
        except SlackApiError as e:
            return {"error": str(e), "status": "failed"}
