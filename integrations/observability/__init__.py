"""
Observability Provider Registry
================================
Auto-detects and returns the configured observability provider.

Priority order (first one whose credentials are present wins):
  1. OBSERVABILITY_PROVIDER env var (explicit override)
  2. Datadog   — DD_API_KEY
  3. Grafana   — GRAFANA_URL
  4. New Relic — NEW_RELIC_API_KEY
  5. Prometheus— PROMETHEUS_URL
  6. CloudWatch— AWS_DEFAULT_REGION (+ boto3 credentials)
  7. Elastic   — ELASTIC_URL

Usage:
  from integrations.observability import get_provider
  obs = get_provider()
  alerts = obs.get_active_alerts()
"""
import os
import logging
from integrations.observability.base import ObservabilityProvider

logger = logging.getLogger(__name__)

# Registry maps provider name → lazy import callable
_REGISTRY: dict[str, str] = {
    "datadog":    "integrations.observability.providers.datadog.DatadogProvider",
    "grafana":    "integrations.observability.providers.grafana.GrafanaProvider",
    "newrelic":   "integrations.observability.providers.newrelic.NewRelicProvider",
    "prometheus": "integrations.observability.providers.prometheus.PrometheusProvider",
    "cloudwatch": "integrations.observability.providers.cloudwatch.CloudWatchProvider",
    "elastic":    "integrations.observability.providers.elastic.ElasticProvider",
}

# Env-var sniffing: if these keys are set, infer the provider
_AUTO_DETECT = [
    ("DD_API_KEY",           "datadog"),
    ("GRAFANA_URL",          "grafana"),
    ("NEW_RELIC_API_KEY",    "newrelic"),
    ("PROMETHEUS_URL",       "prometheus"),
    ("AWS_DEFAULT_REGION",   "cloudwatch"),
    ("ELASTIC_URL",          "elastic"),
]

_instance: ObservabilityProvider | None = None


def get_provider() -> ObservabilityProvider:
    """
    Return the singleton observability provider instance.
    Raises RuntimeError if no provider credentials are found.
    """
    global _instance
    if _instance is not None:
        return _instance

    provider_name = _resolve_provider_name()
    if not provider_name:
        raise RuntimeError(
            "No observability provider configured. "
            "Set OBSERVABILITY_PROVIDER=datadog|grafana|newrelic|prometheus|cloudwatch|elastic "
            "or set the provider's credentials in your .env file."
        )

    _instance = _load_provider(provider_name)
    logger.info(f"Observability provider: {_instance.name}")
    return _instance


def list_providers() -> list[str]:
    """Return all supported provider names."""
    return list(_REGISTRY.keys())


def reset_provider():
    """Force re-detection on next call (useful for tests)."""
    global _instance
    _instance = None


def _resolve_provider_name() -> str | None:
    # 1. Explicit override
    explicit = os.getenv("OBSERVABILITY_PROVIDER", "").lower().strip()
    if explicit and explicit in _REGISTRY:
        return explicit
    if explicit and explicit not in _REGISTRY:
        raise ValueError(
            f"Unknown OBSERVABILITY_PROVIDER='{explicit}'. "
            f"Supported: {', '.join(_REGISTRY)}"
        )

    # 2. Auto-detect from credentials
    for env_var, provider_name in _AUTO_DETECT:
        if os.getenv(env_var):
            logger.info(f"Auto-detected observability provider: {provider_name} (from {env_var})")
            return provider_name

    return None


def _load_provider(name: str) -> ObservabilityProvider:
    import importlib
    module_path, class_name = _REGISTRY[name].rsplit(".", 1)
    try:
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)
        return cls()
    except ImportError as e:
        raise ImportError(
            f"Could not load provider '{name}'. "
            f"Make sure its dependencies are installed. Error: {e}"
        )
