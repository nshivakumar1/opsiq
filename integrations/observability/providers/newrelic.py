"""
New Relic Observability Provider
Dependencies: httpx
Env vars:
  NEW_RELIC_API_KEY     User API key (NRAK-...)
  NEW_RELIC_ACCOUNT_ID  Your NR account ID
  NEW_RELIC_REGION      "US" (default) or "EU"
"""
import os
import time
import httpx

from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)

_GRAPHQL_US = "https://api.newrelic.com/graphql"
_GRAPHQL_EU = "https://api.eu.newrelic.com/graphql"


class NewRelicProvider(ObservabilityProvider):
    def __init__(self):
        self.api_key = os.environ["NEW_RELIC_API_KEY"]
        self.account_id = int(os.environ["NEW_RELIC_ACCOUNT_ID"])
        region = os.getenv("NEW_RELIC_REGION", "US").upper()
        self.graphql_url = _GRAPHQL_EU if region == "EU" else _GRAPHQL_US

    @property
    def name(self) -> str:
        return "New Relic"

    def _nrql(self, query: str) -> list[dict]:
        """Run a NRQL query via the NerdGraph GraphQL API."""
        gql = {
            "query": f"""
            {{
              actor {{
                account(id: {self.account_id}) {{
                  nrql(query: "{query}") {{
                    results
                  }}
                }}
              }}
            }}
            """
        }
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                self.graphql_url,
                json=gql,
                headers={"API-Key": self.api_key, "Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
        return data.get("data", {}).get("actor", {}).get("account", {}).get("nrql", {}).get("results", [])

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        severity_filter = ""
        if severity == "critical":
            severity_filter = "AND priority = 'CRITICAL'"
        elif severity == "warning":
            severity_filter = "AND priority = 'HIGH'"

        rows = self._nrql(
            f"SELECT * FROM NrAiIncident WHERE event = 'open' {severity_filter} LIMIT 50"
        )
        results = []
        for r in rows:
            sev = r.get("priority", "UNKNOWN").lower()
            results.append(Alert(
                id=str(r.get("incidentId", "")),
                name=r.get("title", "Unknown"),
                severity="critical" if sev == "critical" else "warning",
                state="firing",
                message=r.get("description", "")[:300],
                service=r.get("entity.name", "unknown"),
                started_at=str(r.get("openTime", "")),
                url=f"https://one.newrelic.com/alerts-ai",
                provider=self.name,
            ).to_dict())
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        """
        query: NRQL WHERE clause or free-text, e.g. "message LIKE '%error%'"
        """
        since = f"SINCE {hours} hours ago"
        nrql = f"SELECT * FROM Log WHERE {query} {since} LIMIT {limit}"
        rows = self._nrql(nrql)
        results = []
        for r in rows:
            results.append(LogEntry(
                timestamp=str(r.get("timestamp", "")),
                service=r.get("service.name", r.get("entity.name", "unknown")),
                level=r.get("level", r.get("log.level", "info")).lower(),
                message=str(r.get("message", r.get("log", "")))[:500],
                host=r.get("hostname", ""),
                trace_id=r.get("trace.id", ""),
                provider=self.name,
            ).to_dict())
        return results

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        where = f"AND appName = '{service_name}'" if service_name else ""
        rows = self._nrql(
            f"SELECT average(duration), percentage(count(*), WHERE error IS true) "
            f"FROM Transaction WHERE transactionType = 'Web' {where} "
            f"FACET appName SINCE 30 minutes ago LIMIT 50"
        )
        results = []
        for r in rows:
            error_rate = r.get("percentage(count(*), WHERE error IS true)", 0) or 0
            latency = r.get("average(duration)", 0) or 0
            status = "healthy" if error_rate < 1 else ("degraded" if error_rate < 5 else "down")
            results.append(ServiceHealth(
                service=r.get("appName", "unknown"),
                status=status,
                error_rate=round(float(error_rate), 2),
                latency_p99_ms=round(float(latency) * 1000, 1),
                request_rate=0.0,
                provider=self.name,
            ).to_dict())
        return results

    def query_metric(self, metric_name: str, hours: int = 1, tags: dict | None = None) -> list[dict]:
        where_parts = [f"metricName = '{metric_name}'"]
        for k, v in (tags or {}).items():
            where_parts.append(f"{k} = '{v}'")
        where = " AND ".join(where_parts)
        rows = self._nrql(
            f"SELECT average(value) FROM Metric WHERE {where} "
            f"TIMESERIES SINCE {hours} hours ago LIMIT 20"
        )
        results = []
        for r in rows:
            results.append(Metric(
                name=metric_name,
                value=float(r.get("average.value", r.get("value", 0))),
                unit="",
                timestamp=str(r.get("timestamp", int(time.time()))),
                tags=tags or {},
                provider=self.name,
            ).to_dict())
        return results
