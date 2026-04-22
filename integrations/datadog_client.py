"""
Datadog Integration
===================
Wraps the Datadog API client for monitors, logs, and events.
Configure via DD_API_KEY and DD_APP_KEY env vars.
"""
import os
import time

from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v1.api.monitors_api import MonitorsApi
from datadog_api_client.v2.api.logs_api import LogsApi
from datadog_api_client.v2.model.logs_list_request import LogsListRequest
from datadog_api_client.v2.model.logs_list_request_page import LogsListRequestPage
from datadog_api_client.v2.model.logs_query_filter import LogsQueryFilter
from datadog_api_client.v2.model.logs_sort import LogsSort


def _get_config() -> Configuration:
    config = Configuration()
    config.api_key["apiKeyAuth"] = os.getenv("DD_API_KEY", "")
    config.api_key["appKeyAuth"] = os.getenv("DD_APP_KEY", "")
    if not config.api_key["apiKeyAuth"]:
        raise EnvironmentError("DD_API_KEY is not set.")
    return config


class DatadogClient:
    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        """Return monitors that are currently in Alert or Warn state."""
        config = _get_config()
        with ApiClient(config) as api_client:
            api = MonitorsApi(api_client)
            monitors = api.list_monitors()

        severity_filter = {
            "critical": ["Alert"],
            "warning": ["Warn"],
            "all": ["Alert", "Warn", "No Data"],
        }.get(severity, ["Alert", "Warn"])

        results = []
        for m in monitors:
            state = getattr(m.overall_state, "value", str(m.overall_state))
            if state in severity_filter:
                results.append({
                    "id": m.id,
                    "name": m.name,
                    "state": state,
                    "type": str(m.type),
                    "query": m.query,
                    "tags": list(m.tags) if m.tags else [],
                    "url": f"https://app.datadoghq.com/monitors/{m.id}",
                })
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        """Search Datadog logs for a query string."""
        config = _get_config()
        now_ms = int(time.time() * 1000)
        from_ms = now_ms - (hours * 3600 * 1000)

        body = LogsListRequest(
            filter=LogsQueryFilter(
                query=query,
                _from=f"{from_ms}",
                to=f"{now_ms}",
            ),
            sort=LogsSort.TIMESTAMP_DESCENDING,
            page=LogsListRequestPage(limit=limit),
        )

        with ApiClient(config) as api_client:
            api = LogsApi(api_client)
            response = api.list_logs(body=body)

        results = []
        for log in response.data or []:
            attrs = log.attributes
            results.append({
                "timestamp": str(attrs.timestamp) if attrs.timestamp else "",
                "service": attrs.service or "",
                "status": attrs.status or "",
                "message": (attrs.message or "")[:500],
                "host": attrs.host or "",
            })
        return results

    def get_monitor_by_name(self, name_contains: str) -> list[dict]:
        config = _get_config()
        with ApiClient(config) as api_client:
            api = MonitorsApi(api_client)
            monitors = api.list_monitors(name=name_contains)
        return [
            {
                "id": m.id,
                "name": m.name,
                "state": str(m.overall_state),
                "query": m.query,
            }
            for m in monitors
        ]
