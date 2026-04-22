"""
Grafana Observability Provider
================================
Works with both Grafana Cloud and self-hosted Grafana.
Covers: Grafana Alerting, Loki (logs), Prometheus (metrics).

Dependencies: httpx
Env vars:
  GRAFANA_URL          e.g. https://your-org.grafana.net
  GRAFANA_API_KEY      Service account token (Editor or Viewer role)
  GRAFANA_ORG_ID       (optional, defaults to 1)
  LOKI_URL             (optional, falls back to GRAFANA_URL/loki)
  PROMETHEUS_URL       (optional, falls back to GRAFANA_URL/prometheus)
"""
import os
import time
from datetime import datetime, timezone

import httpx

from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)

_SEVERITY_MAP = {
    "critical": "critical", "high": "critical",
    "warning": "warning", "medium": "warning",
    "info": "info", "low": "info",
}


class GrafanaProvider(ObservabilityProvider):
    def __init__(self):
        self.base_url = os.environ["GRAFANA_URL"].rstrip("/")
        self.api_key = os.environ["GRAFANA_API_KEY"]
        self.org_id = os.getenv("GRAFANA_ORG_ID", "1")
        self.loki_url = os.getenv("LOKI_URL", f"{self.base_url}/loki").rstrip("/")
        self.prom_url = os.getenv("PROMETHEUS_URL", f"{self.base_url}/prometheus").rstrip("/")

    @property
    def name(self) -> str:
        return "Grafana"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Grafana-Org-Id": self.org_id,
            "Content-Type": "application/json",
        }

    def _get(self, url: str, params: dict | None = None) -> dict | list:
        with httpx.Client(timeout=30) as client:
            resp = client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            return resp.json()

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        """Query Grafana Alertmanager for firing alerts."""
        data = self._get(f"{self.base_url}/api/alertmanager/grafana/api/v2/alerts",
                         params={"active": "true", "silenced": "false", "inhibited": "false"})

        results = []
        for alert in (data if isinstance(data, list) else []):
            labels = alert.get("labels", {})
            sev = labels.get("severity", "unknown").lower()
            mapped_sev = _SEVERITY_MAP.get(sev, "unknown")

            if severity != "all":
                if severity == "critical" and mapped_sev != "critical":
                    continue
                if severity == "warning" and mapped_sev != "warning":
                    continue

            results.append(Alert(
                id=labels.get("alertname", "") + labels.get("instance", ""),
                name=labels.get("alertname", "Unknown alert"),
                severity=mapped_sev,
                state="firing",
                message=alert.get("annotations", {}).get("summary", "")[:300],
                service=labels.get("job", labels.get("service", "unknown")),
                tags=[f"{k}:{v}" for k, v in labels.items()],
                started_at=alert.get("startsAt", ""),
                url=f"{self.base_url}/alerting/list",
                provider=self.name,
            ).to_dict())
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        """
        Query Loki via its HTTP API.
        query should be a LogQL expression e.g. '{service="api"} |= "error"'
        """
        now_ns = int(time.time() * 1e9)
        start_ns = now_ns - hours * 3_600 * int(1e9)

        data = self._get(f"{self.loki_url}/api/v1/query_range", params={
            "query": query,
            "start": str(start_ns),
            "end": str(now_ns),
            "limit": str(limit),
            "direction": "backward",
        })

        results = []
        for stream in data.get("data", {}).get("result", []):
            labels = stream.get("stream", {})
            for ts_ns, line in stream.get("values", []):
                ts = datetime.fromtimestamp(int(ts_ns) / 1e9, tz=timezone.utc).isoformat()
                level = labels.get("level", labels.get("severity", "info"))
                results.append(LogEntry(
                    timestamp=ts,
                    service=labels.get("job", labels.get("service", "unknown")),
                    level=level,
                    message=line[:500],
                    host=labels.get("instance", labels.get("host", "")),
                    attributes=labels,
                    provider=self.name,
                ).to_dict())
        return results

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        """Derive service health from Grafana alert rules grouped by service."""
        rules_data = self._get(f"{self.base_url}/api/ruler/grafana/api/v1/rules")
        firing_by_service: dict[str, int] = {}
        total_by_service: dict[str, int] = {}

        for group_name, groups in (rules_data if isinstance(rules_data, dict) else {}).items():
            for group in groups:
                for rule in group.get("rules", []):
                    labels = rule.get("labels", {})
                    svc = labels.get("service", labels.get("job", group_name))
                    if service_name and svc != service_name:
                        continue
                    total_by_service[svc] = total_by_service.get(svc, 0) + 1
                    if rule.get("state", "") == "firing":
                        firing_by_service[svc] = firing_by_service.get(svc, 0) + 1

        results = []
        for svc in total_by_service:
            firing = firing_by_service.get(svc, 0)
            status = "healthy" if firing == 0 else ("down" if firing > 3 else "degraded")
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
        """Query Prometheus/Mimir via instant or range query."""
        label_selector = ",".join(f'{k}="{v}"' for k, v in (tags or {}).items())
        prom_query = f"{metric_name}{'{' + label_selector + '}' if label_selector else ''}"
        now = int(time.time())
        start = now - hours * 3600

        data = self._get(f"{self.prom_url}/api/v1/query_range", params={
            "query": prom_query,
            "start": str(start),
            "end": str(now),
            "step": str(max(60, hours * 60)),  # sensible step
        })

        results = []
        for series in data.get("data", {}).get("result", []):
            metric_labels = series.get("metric", {})
            for ts, val in series.get("values", [])[-20:]:
                results.append(Metric(
                    name=metric_name,
                    value=float(val),
                    unit="",
                    timestamp=str(ts),
                    tags=metric_labels,
                    provider=self.name,
                ).to_dict())
        return results
