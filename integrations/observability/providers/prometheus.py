"""
Prometheus Observability Provider
===================================
Works with Prometheus + Alertmanager.
Also compatible with VictoriaMetrics and Thanos (same HTTP API).
Pair with Loki for logs (see GrafanaProvider which bundles both).

Dependencies: httpx
Env vars:
  PROMETHEUS_URL        e.g. http://prometheus:9090
  ALERTMANAGER_URL      e.g. http://alertmanager:9093 (optional, falls back to Prometheus /alerts)
  PROMETHEUS_USER       (optional, for basic auth)
  PROMETHEUS_PASSWORD   (optional, for basic auth)
"""
import os
import time
from datetime import datetime, timezone

import httpx

from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)


class PrometheusProvider(ObservabilityProvider):
    def __init__(self):
        self.prom_url = os.environ["PROMETHEUS_URL"].rstrip("/")
        self.am_url = os.getenv("ALERTMANAGER_URL", "").rstrip("/")
        user = os.getenv("PROMETHEUS_USER")
        pwd = os.getenv("PROMETHEUS_PASSWORD")
        self.auth = (user, pwd) if user and pwd else None

    @property
    def name(self) -> str:
        return "Prometheus"

    def _get(self, url: str, params: dict | None = None) -> dict:
        with httpx.Client(timeout=30, auth=self.auth) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        """Query Alertmanager if configured, otherwise Prometheus /alerts."""
        if self.am_url:
            # Alertmanager API v2
            data = self._get(f"{self.am_url}/api/v2/alerts",
                             params={"active": "true", "silenced": "false"})
            alerts_raw = data if isinstance(data, list) else []
        else:
            # Prometheus rules API
            data = self._get(f"{self.prom_url}/api/v1/alerts")
            alerts_raw = data.get("data", {}).get("alerts", [])

        results = []
        for a in alerts_raw:
            labels = a.get("labels", {})
            sev = labels.get("severity", "unknown").lower()
            mapped = {"critical": "critical", "warning": "warning"}.get(sev, "unknown")

            if severity == "critical" and mapped != "critical":
                continue
            if severity == "warning" and mapped != "warning":
                continue

            annotations = a.get("annotations", {})
            results.append(Alert(
                id=labels.get("alertname", "") + labels.get("instance", ""),
                name=labels.get("alertname", "Unknown"),
                severity=mapped,
                state=a.get("status", {}).get("state", "firing"),
                message=annotations.get("summary", annotations.get("description", ""))[:300],
                service=labels.get("job", labels.get("service", "unknown")),
                tags=[f"{k}:{v}" for k, v in labels.items()],
                started_at=a.get("startsAt", ""),
                url=f"{self.am_url or self.prom_url}/alerts",
                provider=self.name,
            ).to_dict())
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        """
        Prometheus doesn't natively store logs. Returns a helpful message
        directing the user to configure a Loki URL in GrafanaProvider.
        """
        return [{
            "message": (
                "Prometheus does not store logs. "
                "To query logs, configure LOKI_URL and use OBSERVABILITY_PROVIDER=grafana, "
                "or add an Elastic/OpenSearch integration."
            ),
            "provider": self.name,
        }]

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        """Derive health from up{} metric and active alerts."""
        query = f'up{{job="{service_name}"}}' if service_name else "up"
        data = self._get(f"{self.prom_url}/api/v1/query", params={"query": query})

        results = []
        for series in data.get("data", {}).get("result", []):
            labels = series.get("metric", {})
            svc = labels.get("job", labels.get("instance", "unknown"))
            value = float(series.get("value", [0, "0"])[1])
            status = "healthy" if value == 1.0 else "down"
            results.append(ServiceHealth(
                service=svc,
                status=status,
                error_rate=0.0 if value == 1.0 else 100.0,
                latency_p99_ms=0.0,
                request_rate=0.0,
                provider=self.name,
            ).to_dict())
        return results

    def query_metric(self, metric_name: str, hours: int = 1, tags: dict | None = None) -> list[dict]:
        label_selector = ",".join(f'{k}="{v}"' for k, v in (tags or {}).items())
        query = f"{metric_name}{'{' + label_selector + '}' if label_selector else ''}"
        now = int(time.time())
        start = now - hours * 3600
        step = max(60, hours * 60)

        data = self._get(f"{self.prom_url}/api/v1/query_range", params={
            "query": query, "start": start, "end": now, "step": step,
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
