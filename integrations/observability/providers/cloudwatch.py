"""
AWS CloudWatch Observability Provider
Dependencies: boto3
Env vars: AWS_DEFAULT_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
(or use IAM roles — boto3 picks up credentials automatically)
"""
import os
import time
from datetime import datetime, timedelta, timezone

import boto3

from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)


class CloudWatchProvider(ObservabilityProvider):
    def __init__(self):
        self.region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
        self.cw = boto3.client("cloudwatch", region_name=self.region)
        self.logs = boto3.client("logs", region_name=self.region)

    @property
    def name(self) -> str:
        return "AWS CloudWatch"

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        state_values = {"critical": ["ALARM"], "warning": ["ALARM", "INSUFFICIENT_DATA"],
                        "all": ["ALARM", "INSUFFICIENT_DATA"]}
        states = state_values.get(severity, ["ALARM"])

        results = []
        for state in states:
            paginator = self.cw.get_paginator("describe_alarms")
            for page in paginator.paginate(StateValue=state):
                for alarm in page.get("MetricAlarms", []):
                    sev = "critical" if alarm["StateValue"] == "ALARM" else "warning"
                    results.append(Alert(
                        id=alarm["AlarmArn"],
                        name=alarm["AlarmName"],
                        severity=sev,
                        state="firing" if alarm["StateValue"] == "ALARM" else "pending",
                        message=alarm.get("StateReason", "")[:300],
                        service=next(
                            (d["Value"] for d in alarm.get("Dimensions", []) if d["Name"] in ("Service", "FunctionName", "ClusterName")),
                            "unknown"
                        ),
                        tags=[f"{d['Name']}:{d['Value']}" for d in alarm.get("Dimensions", [])],
                        started_at=str(alarm.get("StateUpdatedTimestamp", "")),
                        url=f"https://{self.region}.console.aws.amazon.com/cloudwatch/home#alarmsV2:alarm/{alarm['AlarmName']}",
                        provider=self.name,
                    ).to_dict())
        return results

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        """
        query: CloudWatch Logs Insights query string
        e.g. "fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc"
        """
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)

        log_groups = [g["logGroupName"] for g in
                      self.logs.describe_log_groups().get("logGroups", [])][:10]

        if not log_groups:
            return [{"message": "No CloudWatch log groups found.", "provider": self.name}]

        resp = self.logs.start_query(
            logGroupNames=log_groups,
            startTime=int(start_time.timestamp()),
            endTime=int(end_time.timestamp()),
            queryString=query,
            limit=limit,
        )
        query_id = resp["queryId"]

        # Poll for completion
        for _ in range(20):
            result = self.logs.get_query_results(queryId=query_id)
            if result["status"] in ("Complete", "Failed", "Cancelled"):
                break
            time.sleep(1)

        results = []
        for row in result.get("results", []):
            fields = {f["field"]: f["value"] for f in row}
            results.append(LogEntry(
                timestamp=fields.get("@timestamp", ""),
                service=fields.get("@log", "unknown").split("/")[-1],
                level="error" if "ERROR" in fields.get("@message", "").upper() else "info",
                message=fields.get("@message", "")[:500],
                provider=self.name,
            ).to_dict())
        return results

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        paginator = self.cw.get_paginator("describe_alarms")
        alarms_by_service: dict[str, list] = {}
        for page in paginator.paginate(StateValue="ALARM"):
            for alarm in page.get("MetricAlarms", []):
                svc = next(
                    (d["Value"] for d in alarm.get("Dimensions", []) if d["Name"] in ("Service", "FunctionName")),
                    "unknown"
                )
                if service_name and svc != service_name:
                    continue
                alarms_by_service.setdefault(svc, []).append(alarm)

        results = []
        for svc, alarms in alarms_by_service.items():
            count = len(alarms)
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
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=hours)
        dimensions = [{"Name": k, "Value": v} for k, v in (tags or {}).items()]
        namespace = (tags or {}).get("namespace", "AWS/EC2")

        resp = self.cw.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            Dimensions=dimensions,
            StartTime=start,
            EndTime=end,
            Period=max(60, hours * 60),
            Statistics=["Average"],
        )
        return [
            Metric(
                name=metric_name,
                value=float(dp["Average"]),
                unit=dp.get("Unit", ""),
                timestamp=dp["Timestamp"].isoformat(),
                tags=tags or {},
                provider=self.name,
            ).to_dict()
            for dp in sorted(resp.get("Datapoints", []), key=lambda x: x["Timestamp"])[-20:]
        ]
