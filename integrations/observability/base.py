"""
ObservabilityProvider — Abstract Base Class
===========================================
Every observability integration (Datadog, Grafana, New Relic, etc.) implements
this interface. The agent only ever calls this contract — never the provider directly.

To add a new provider:
  1. Create integrations/observability/providers/your_tool.py
  2. Subclass ObservabilityProvider and implement all abstract methods
  3. Register it in integrations/observability/__init__.py
  4. Add its env vars to .env.example

That's it. Zero changes to agent/tools.py or agent/core.py.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Alert:
    """Normalised alert/monitor across all providers."""
    id: str
    name: str
    severity: str          # "critical" | "warning" | "info" | "unknown"
    state: str             # "firing" | "resolved" | "pending" | "no_data"
    message: str
    service: str
    tags: list[str] = field(default_factory=list)
    started_at: str = ""
    url: str = ""
    provider: str = ""

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class LogEntry:
    """Normalised log line across all providers."""
    timestamp: str
    service: str
    level: str             # "error" | "warn" | "info" | "debug"
    message: str
    host: str = ""
    trace_id: str = ""
    attributes: dict = field(default_factory=dict)
    provider: str = ""

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class ServiceHealth:
    """Normalised service health summary."""
    service: str
    status: str            # "healthy" | "degraded" | "down" | "unknown"
    error_rate: float      # percentage 0–100
    latency_p99_ms: float
    request_rate: float    # requests per second
    last_deploy: str = ""
    provider: str = ""

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class Metric:
    """Single time-series data point."""
    name: str
    value: float
    unit: str
    timestamp: str
    tags: dict = field(default_factory=dict)
    provider: str = ""

    def to_dict(self) -> dict:
        return self.__dict__


class ObservabilityProvider(ABC):
    """
    Abstract interface every observability provider must implement.
    All methods return plain dicts (JSON-serialisable) so Claude can
    reason over them in tool results.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name, e.g. 'Datadog', 'Grafana'."""
        ...

    @abstractmethod
    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        """
        Return currently firing alerts/monitors.

        Args:
            severity: "critical" | "warning" | "all"

        Returns:
            List of Alert.to_dict()
        """
        ...

    @abstractmethod
    def query_logs(
        self, query: str, hours: int = 1, limit: int = 50
    ) -> list[dict]:
        """
        Full-text or structured log search.

        Args:
            query:  Provider-native query string (Lucene, LogQL, NRQL, etc.)
                    OpsIQ instructs Claude to use the right syntax for the active provider.
            hours:  Look-back window.
            limit:  Max log lines to return.

        Returns:
            List of LogEntry.to_dict()
        """
        ...

    @abstractmethod
    def get_service_health(
        self, service_name: str | None = None
    ) -> list[dict]:
        """
        Return health summary for one or all services.

        Returns:
            List of ServiceHealth.to_dict()
        """
        ...

    @abstractmethod
    def query_metric(
        self,
        metric_name: str,
        hours: int = 1,
        tags: dict | None = None,
    ) -> list[dict]:
        """
        Query a specific metric time series.

        Returns:
            List of Metric.to_dict()
        """
        ...

    def health_check(self) -> dict:
        """
        Verify the provider is reachable and credentials are valid.
        Returns {"ok": True} or {"ok": False, "error": "..."}
        Override if the provider has a dedicated ping endpoint.
        """
        try:
            self.get_active_alerts(severity="critical")
            return {"ok": True, "provider": self.name}
        except Exception as e:
            return {"ok": False, "provider": self.name, "error": str(e)}
