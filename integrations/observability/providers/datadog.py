"""
Datadog Observability Provider
Dependencies: datadog-api-client
Env vars: DD_API_KEY, DD_APP_KEY, DD_SITE (optional, default datadoghq.com)
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

from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)

_SEVERITY_MAP = {"Alert": "critical", "Warn": "warning", "No Data": "unknown"}


def _config() -> Configuration:
    cfg = Configuration()
    cfg.api_key["apiKeyAuth"] = os.environ["DD_API_KEY"]
    cfg.api_key["appKeyAuth"] = os.environ["DD_APP_KEY"]
    site = os.getenv("DD_SITE", "datadoghq.com")
    cfg.server_variables["site"] = site
    return cfg


class DatadogProvider(ObservabilityProvider):
    @property
    def name(self) -> str:
        return "Datadog"

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        wanted_states = {
            "critical": ["Alert"],
            "warning": ["Warn"],
            "all": ["Alert", "Warn", "No Data"],
        }.get(severity, ["Alert", "Warn", "No Data"])

        with ApiClient(_config()) as api_client:
            monitors = MonitorsApi(api_client).list_monitors()

        results = []
        for m in monitors:
            state_val = getattr(m.overall_state, "value", str(m.overall_state))
            if state_val not in wanted_states:
                continue
            results.append(Alert(
                id=str(m.id),
                name=m.name,
                severity=_SEVERITY_MAP.get(state_val, "unknown"),
                state="firing" if state_val == "Alert" else state_val.lower().replace(" ", "_"),
                message=str(m.message or "")[:300],
                service=next((t.split(":")[1] for t in (m.tags or []) if t.startswith("service:")), "unknown"),
                tags=list(m.tags or []),
                url=f"https://app.datadoghq.com/monitors/{m.id}",
                provider=self.name,
            ).to_dict())
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        now_ms = int(time.time() * 1000)
        from_ms = now_ms - hours * 3_600_000
        body = LogsListRequest(
            filter=LogsQueryFilter(query=query, _from=str(from_ms), to=str(now_ms)),
            sort=LogsSort.TIMESTAMP_DESCENDING,
            page=LogsListRequestPage(limit=limit),
        )
        with ApiClient(_config()) as api_client:
            resp = LogsApi(api_client).list_logs(body=body)

        results = []
        for log in resp.data or []:
            a = log.attributes
            results.append(LogEntry(
                timestamp=str(a.timestamp or ""),
                service=str(a.service or ""),
                level=str(a.status or "info"),
                message=str(a.message or "")[:500],
                host=str(a.host or ""),
                provider=self.name,
            ).to_dict())
        return results

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        # Datadog doesn't have a single "service health" endpoint;
        # we approximate via monitors tagged by service.
        with ApiClient(_config()) as api_client:
            monitors = MonitorsApi(api_client).list_monitors()

        services: dict[str, dict] = {}
        for m in monitors:
            svc = next((t.split(":")[1] for t in (m.tags or []) if t.startswith("service:")), None)
            if not svc:
                continue
            if service_name and svc != service_name:
                continue
            state = getattr(m.overall_state, "value", "")
            entry = services.setdefault(svc, {"service": svc, "firing": 0, "total": 0})
            entry["total"] += 1
            if state == "Alert":
                entry["firing"] += 1

        results = []
        for svc, data in services.items():
            status = "healthy" if data["firing"] == 0 else ("down" if data["firing"] > 2 else "degraded")
            results.append(ServiceHealth(
                service=svc,
                status=status,
                error_rate=0.0,
                latency_p99_ms=0.0,
                request_rate=0.0,
                provider=self.name,
            ).to_dict())
        return results

    def query_metric(self, metric_name: str, hours: int = 1, tags: dict | None = None) -> list[dict]:
        # Datadog metrics API v1 — simplified point query
        from datadog_api_client.v1.api.metrics_api import MetricsApi
        now = int(time.time())
        frm = now - hours * 3600
        tag_filter = ",".join(f"{k}:{v}" for k, v in (tags or {}).items())
        query = f"{metric_name}{'{' + tag_filter + '}' if tag_filter else ''}"

        with ApiClient(_config()) as api_client:
            resp = MetricsApi(api_client).query_metrics(frm, now, query)

        results = []
        for series in resp.series or []:
            for point in (series.pointlist or [])[-20:]:  # last 20 points
                ts, val = point
                results.append(Metric(
                    name=metric_name,
                    value=float(val or 0),
                    unit=str(series.unit[0].name if series.unit else ""),
                    timestamp=str(int(ts)),
                    tags=dict(kv.split(":", 1) for kv in (series.tag_set or []) if ":" in kv),
                    provider=self.name,
                ).to_dict())
        return results
