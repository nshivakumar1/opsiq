"""
Elastic / OpenSearch Observability Provider
============================================
Works with Elastic Cloud, self-hosted Elasticsearch, and AWS OpenSearch.

Dependencies: elasticsearch (works for OpenSearch too with minor config)
Env vars:
  ELASTIC_URL           e.g. https://your-cluster.es.io:9243
  ELASTIC_API_KEY       Base64 encoded API key (preferred)
  ELASTIC_USER          Basic auth username (alternative to API key)
  ELASTIC_PASSWORD      Basic auth password
  ELASTIC_LOG_INDEX     Index pattern for logs, default "logs-*"
  ELASTIC_ALERT_INDEX   Index for alerts, default ".alerts-*"
"""
import os
import time
from datetime import datetime, timedelta, timezone

from elasticsearch import Elasticsearch

from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)


def _client() -> Elasticsearch:
    url = os.environ["ELASTIC_URL"]
    api_key = os.getenv("ELASTIC_API_KEY")
    user = os.getenv("ELASTIC_USER")
    pwd = os.getenv("ELASTIC_PASSWORD")

    if api_key:
        return Elasticsearch(url, api_key=api_key, verify_certs=True)
    elif user and pwd:
        return Elasticsearch(url, basic_auth=(user, pwd), verify_certs=True)
    return Elasticsearch(url)


class ElasticProvider(ObservabilityProvider):
    def __init__(self):
        self.log_index = os.getenv("ELASTIC_LOG_INDEX", "logs-*")
        self.alert_index = os.getenv("ELASTIC_ALERT_INDEX", ".alerts-*")

    @property
    def name(self) -> str:
        return "Elastic"

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        es = _client()
        query: dict = {"bool": {"must": [{"term": {"kibana.alert.status": "active"}}]}}
        if severity == "critical":
            query["bool"]["must"].append({"term": {"kibana.alert.severity": "critical"}})
        elif severity == "warning":
            query["bool"]["must"].append({"term": {"kibana.alert.severity": "medium"}})

        resp = es.search(index=self.alert_index, query=query, size=50,
                         sort=[{"kibana.alert.start": "desc"}])

        results = []
        for hit in resp["hits"]["hits"]:
            src = hit["_source"]
            sev_raw = src.get("kibana.alert.severity", "unknown")
            sev = "critical" if sev_raw in ("critical", "high") else "warning"
            results.append(Alert(
                id=hit["_id"],
                name=src.get("kibana.alert.rule.name", "Unknown"),
                severity=sev,
                state="firing",
                message=src.get("kibana.alert.reason", "")[:300],
                service=src.get("service.name", src.get("host.name", "unknown")),
                tags=[f"env:{src.get('labels.environment', 'unknown')}"],
                started_at=src.get("kibana.alert.start", ""),
                url=src.get("kibana.alert.url", ""),
                provider=self.name,
            ).to_dict())
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        """
        query: Lucene query string e.g. "message:error AND service.name:api"
        """
        es = _client()
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=hours)

        resp = es.search(
            index=self.log_index,
            query={
                "bool": {
                    "must": [{"query_string": {"query": query}}],
                    "filter": [{"range": {"@timestamp": {
                        "gte": start.isoformat(), "lte": end.isoformat()
                    }}}],
                }
            },
            sort=[{"@timestamp": "desc"}],
            size=limit,
        )

        results = []
        for hit in resp["hits"]["hits"]:
            src = hit["_source"]
            results.append(LogEntry(
                timestamp=src.get("@timestamp", ""),
                service=src.get("service.name", src.get("service", {}).get("name", "unknown")),
                level=src.get("log.level", src.get("level", "info")).lower(),
                message=str(src.get("message", src.get("log.message", "")))[:500],
                host=src.get("host.name", ""),
                trace_id=src.get("trace.id", ""),
                attributes={"index": hit["_index"]},
                provider=self.name,
            ).to_dict())
        return results

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        es = _client()
        filter_clause = [{"term": {"kibana.alert.status": "active"}}]
        if service_name:
            filter_clause.append({"term": {"service.name": service_name}})

        resp = es.search(
            index=self.alert_index,
            query={"bool": {"filter": filter_clause}},
            aggs={"by_service": {"terms": {"field": "service.name", "size": 50}}},
            size=0,
        )

        results = []
        for bucket in resp.get("aggregations", {}).get("by_service", {}).get("buckets", []):
            count = bucket["doc_count"]
            svc = bucket["key"]
            results.append(ServiceHealth(
                service=svc,
                status="down" if count > 3 else "degraded",
                error_rate=0.0,
                latency_p99_ms=0.0,
                request_rate=0.0,
                provider=self.name,
            ).to_dict())
        return results

    def query_metric(self, metric_name: str, hours: int = 1, tags: dict | None = None) -> list[dict]:
        es = _client()
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=hours)

        filter_clause: list = [{"range": {"@timestamp": {"gte": start.isoformat(), "lte": end.isoformat()}}}]
        for k, v in (tags or {}).items():
            filter_clause.append({"term": {k: v}})

        resp = es.search(
            index="metrics-*",
            query={"bool": {"filter": filter_clause, "must": [{"exists": {"field": metric_name}}]}},
            aggs={"over_time": {"date_histogram": {"field": "@timestamp", "fixed_interval": f"{max(1, hours * 60)}m"},
                                "aggs": {"avg_val": {"avg": {"field": metric_name}}}}},
            size=0,
        )

        results = []
        for bucket in resp.get("aggregations", {}).get("over_time", {}).get("buckets", []):
            val = bucket.get("avg_val", {}).get("value") or 0
            results.append(Metric(
                name=metric_name,
                value=float(val),
                unit="",
                timestamp=str(int(bucket["key"] / 1000)),
                tags=tags or {},
                provider=self.name,
            ).to_dict())
        return results
