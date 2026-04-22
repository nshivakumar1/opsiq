"""
Observability tool definitions for the OpsIQ agent.
These replace the old Datadog-specific tools.
The tool names and schemas are stable regardless of which provider is active.
Claude is told the active provider and its query syntax in the system prompt extension.
"""
import os
from integrations.observability import get_provider, list_providers

# ── Query syntax hints per provider (injected into system prompt) ─────────────

LOG_QUERY_SYNTAX = {
    "datadog":    "Datadog log query syntax, e.g. 'service:api status:error'",
    "grafana":    "LogQL, e.g. '{service=\"api\"} |= \"error\"'",
    "newrelic":   "NRQL WHERE clause, e.g. \"message LIKE '%error%' AND service.name = 'api'\"",
    "prometheus": "Note: Prometheus does not store logs. Advise user to add Loki.",
    "cloudwatch": "CloudWatch Logs Insights, e.g. \"fields @message | filter @message like /ERROR/\"",
    "elastic":    "Lucene query, e.g. 'message:error AND service.name:api'",
}


def get_observability_prompt_extension() -> str:
    """Returns a paragraph appended to SYSTEM_PROMPT with provider-specific context."""
    provider_name = os.getenv("OBSERVABILITY_PROVIDER", "").lower()
    if not provider_name:
        # Auto-detect
        for env_var, name in [
            ("DD_API_KEY", "datadog"), ("GRAFANA_URL", "grafana"),
            ("NEW_RELIC_API_KEY", "newrelic"), ("PROMETHEUS_URL", "prometheus"),
            ("AWS_DEFAULT_REGION", "cloudwatch"), ("ELASTIC_URL", "elastic"),
        ]:
            if os.getenv(env_var):
                provider_name = name
                break

    if not provider_name:
        return "\nNo observability provider is configured."

    syntax = LOG_QUERY_SYNTAX.get(provider_name, "native query syntax")
    try:
        provider = get_provider()
        display_name = provider.name
    except Exception:
        display_name = provider_name.title()

    return (
        f"\nObservability provider: {display_name}. "
        f"When calling observability_query_logs, use {syntax}."
    )


# ── Tool schemas (provider-agnostic names) ────────────────────────────────────

OBSERVABILITY_TOOLS = [
    {
        "name": "observability_get_active_alerts",
        "description": (
            "Get currently firing alerts and monitors from the configured observability platform "
            "(Datadog, Grafana, New Relic, Prometheus, CloudWatch, or Elastic). "
            "Use for incident triage, understanding what's currently broken, or correlating "
            "alerts with deployments."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "severity": {
                    "type": "string",
                    "enum": ["critical", "warning", "all"],
                    "default": "all",
                    "description": "Filter by alert severity.",
                },
            },
        },
    },
    {
        "name": "observability_query_logs",
        "description": (
            "Search logs in the configured observability platform. "
            "The query syntax depends on the active provider — check your system context. "
            "Use to investigate errors, trace requests, or understand what happened at a specific time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Log search query in the active provider's syntax.",
                },
                "hours": {"type": "integer", "default": 1, "description": "Look-back window in hours."},
                "limit": {"type": "integer", "default": 50, "description": "Max log lines to return."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "observability_get_service_health",
        "description": (
            "Get health status summary for one or all services — error rate, latency, alert count. "
            "Use when asked 'is X healthy?', 'what services are degraded?', or to triage an incident."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "service_name": {
                    "type": "string",
                    "description": "Optional. Specific service to check. Omit for all services.",
                },
            },
        },
    },
    {
        "name": "observability_query_metric",
        "description": (
            "Query a specific metric time series. Use when the user asks about a specific "
            "metric value, trend, or wants to compare a metric before/after a deployment."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "metric_name": {
                    "type": "string",
                    "description": "The metric name in the provider's format, e.g. 'system.cpu.user', 'http_requests_total'.",
                },
                "hours": {"type": "integer", "default": 1},
                "tags": {
                    "type": "object",
                    "description": "Optional key-value filters, e.g. {\"service\": \"api\", \"env\": \"production\"}.",
                },
            },
            "required": ["metric_name"],
        },
    },
]
