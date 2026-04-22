"""
Tool definitions for Claude's tool-use API, plus the dispatcher that routes
each tool call to the correct integration client.
"""
import json
from typing import Any

from integrations.github_client import GitHubClient
from integrations.jira_client import JiraClient
from integrations.confluence_client import ConfluenceClient
from integrations.slack_client import SlackClient
from integrations.observability import get_provider
from integrations.observability.tools import OBSERVABILITY_TOOLS

# ── Tool schemas (sent to Claude) ────────────────────────────────────────────

TOOLS = [
    {
        "name": "github_get_recent_commits",
        "description": "Get commits pushed to a branch in the last N hours. Use this when the user asks what changed in the codebase, who pushed what, or to correlate deployments with incidents.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branch": {"type": "string", "description": "Branch name. Defaults to main.", "default": "main"},
                "hours": {"type": "integer", "description": "Look-back window in hours.", "default": 24},
            },
        },
    },
    {
        "name": "github_get_open_prs",
        "description": "List open (or recently merged) pull requests. Use when asked about in-flight changes, review status, or what's waiting to be merged.",
        "input_schema": {
            "type": "object",
            "properties": {
                "state": {"type": "string", "enum": ["open", "closed", "all"], "default": "open"},
                "limit": {"type": "integer", "description": "Max PRs to return.", "default": 10},
            },
        },
    },
    {
        "name": "github_get_deployments",
        "description": "List recent deployments and their statuses (success/failure/pending). Use to correlate deploys with alerts or user-reported issues.",
        "input_schema": {
            "type": "object",
            "properties": {
                "environment": {"type": "string", "description": "Deployment environment (production, staging, etc.).", "default": "production"},
                "limit": {"type": "integer", "default": 10},
            },
        },
    },
    # Observability tools are provider-agnostic — loaded dynamically
    *OBSERVABILITY_TOOLS,
    {
        "name": "jira_get_sprint_issues",
        "description": "Get tickets in the current or most recent sprint for a project. Use when asked about sprint status, blocked issues, or team workload.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_key": {"type": "string", "description": "Jira project key (e.g. OPS, INFRA, PLAT)."},
                "status_filter": {"type": "string", "description": "Filter by status: 'blocked', 'in-progress', 'all'.", "default": "all"},
            },
            "required": ["project_key"],
        },
    },
    {
        "name": "jira_create_ticket",
        "description": "Create a new Jira issue. Use when the user explicitly asks to log a bug, task, or incident ticket. Always confirm details before calling this tool.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_key": {"type": "string"},
                "summary": {"type": "string"},
                "description": {"type": "string"},
                "issue_type": {"type": "string", "enum": ["Bug", "Task", "Incident", "Story"], "default": "Task"},
                "priority": {"type": "string", "enum": ["Highest", "High", "Medium", "Low"], "default": "Medium"},
                "assignee_email": {"type": "string", "description": "Optional. Assignee's Jira account email."},
            },
            "required": ["project_key", "summary", "description"],
        },
    },
    {
        "name": "confluence_search",
        "description": "Search Confluence pages and runbooks by keyword. Use when the user asks for a runbook, process doc, or team knowledge base article.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keywords."},
                "space_key": {"type": "string", "description": "Optional. Limit search to a specific Confluence space."},
                "limit": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "slack_send_message",
        "description": "Send a Slack message to a channel or user. Use only when the user explicitly asks to notify someone or post a summary to Slack.",
        "input_schema": {
            "type": "object",
            "properties": {
                "channel": {"type": "string", "description": "Slack channel name (e.g. #incidents) or user ID."},
                "message": {"type": "string", "description": "The message text (markdown supported)."},
            },
            "required": ["channel", "message"],
        },
    },
]


# ── Tool dispatcher ───────────────────────────────────────────────────────────

class ToolDispatcher:
    """Routes Claude's tool_use calls to the correct integration client."""

    def __init__(self):
        self._github = None
        self._jira = None
        self._confluence = None
        self._slack = None

    @property
    def github(self) -> GitHubClient:
        if not self._github:
            self._github = GitHubClient()
        return self._github

    @property
    def jira(self) -> JiraClient:
        if not self._jira:
            self._jira = JiraClient()
        return self._jira

    @property
    def confluence(self) -> ConfluenceClient:
        if not self._confluence:
            self._confluence = ConfluenceClient()
        return self._confluence

    @property
    def slack(self) -> SlackClient:
        if not self._slack:
            self._slack = SlackClient()
        return self._slack

    def dispatch(self, tool_name: str, tool_input: dict) -> Any:
        """Execute a tool call and return a JSON-serialisable result."""
        try:
            match tool_name:
                # GitHub
                case "github_get_recent_commits":
                    return self.github.get_recent_commits(**tool_input)
                case "github_get_open_prs":
                    return self.github.get_open_prs(**tool_input)
                case "github_get_deployments":
                    return self.github.get_deployments(**tool_input)
                # Observability (provider-agnostic)
                case "observability_get_active_alerts":
                    return get_provider().get_active_alerts(**tool_input)
                case "observability_query_logs":
                    return get_provider().query_logs(**tool_input)
                case "observability_get_service_health":
                    return get_provider().get_service_health(**tool_input)
                case "observability_query_metric":
                    return get_provider().query_metric(**tool_input)
                # Jira
                case "jira_get_sprint_issues":
                    return self.jira.get_sprint_issues(**tool_input)
                case "jira_create_ticket":
                    return self.jira.create_ticket(**tool_input)
                # Confluence
                case "confluence_search":
                    return self.confluence.search(**tool_input)
                # Slack
                case "slack_send_message":
                    return self.slack.send_message(**tool_input)
                case _:
                    return {"error": f"Unknown tool: {tool_name}"}
        except RuntimeError as e:
            # Provider not configured — return helpful message
            return {"error": str(e), "tool": tool_name}
        except Exception as e:
            return {"error": str(e), "tool": tool_name}
