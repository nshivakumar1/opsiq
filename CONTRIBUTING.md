# Contributing to OpsIQ

## Running locally

**Prerequisites:** Python 3.12+, Node 20+, an Anthropic API key.

```bash
# 1. Clone and create a virtualenv
git clone https://github.com/nshivakumar1/opsiq.git
cd opsiq
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Copy and fill in credentials
cp .env.example .env
# edit .env — at minimum set ANTHROPIC_API_KEY

# 3. Start the API server
uvicorn api.main:app --reload

# 4. (Optional) Start the web UI dev server
cd interfaces/web
npm install
npm run dev          # http://localhost:3000

# 5. (Optional) Docker Compose — runs everything
docker-compose up --build
```

---

## Adding a new observability provider

The observability layer is fully provider-agnostic. Adding a new backend is a
four-step pattern — **zero changes required to `agent/` or `api/`**.

### Step 1 — Create the provider module

```
integrations/observability/providers/your_tool.py
```

Subclass `ObservabilityProvider` and implement its four abstract methods:

```python
from integrations.observability.base import (
    ObservabilityProvider, Alert, LogEntry, ServiceHealth, Metric
)

class YourToolProvider(ObservabilityProvider):

    @property
    def name(self) -> str:
        return "YourTool"

    def get_active_alerts(self, severity: str = "all") -> list[dict]:
        # Query your tool's API, map results to Alert dataclass
        return [Alert(...).to_dict()]

    def query_logs(self, query: str, hours: int = 1, limit: int = 50) -> list[dict]:
        return [LogEntry(...).to_dict()]

    def get_service_health(self, service_name: str | None = None) -> list[dict]:
        return [ServiceHealth(...).to_dict()]

    def query_metric(self, metric_name: str, hours: int = 1, tags: dict | None = None) -> list[dict]:
        return [Metric(...).to_dict()]
```

Use the existing providers (`datadog.py`, `grafana.py`) as reference implementations.

### Step 2 — Register in the provider registry

In `integrations/observability/__init__.py`, add two lines:

```python
# In _REGISTRY:
"yourtool": "integrations.observability.providers.your_tool.YourToolProvider",

# In _AUTO_DETECT (env var that signals the provider is configured):
("YOUR_TOOL_API_KEY", "yourtool"),
```

### Step 3 — Document env vars in `.env.example`

```bash
# ── YourTool ────────────────────────────────────────────────────────────────
YOUR_TOOL_API_KEY=...
YOUR_TOOL_URL=https://...    # if applicable
```

### Step 4 — Add a dependency (if needed)

```
# requirements.txt
your-tool-sdk>=1.0.0
```

That's it. OpsIQ auto-detects the provider at startup from env vars.

---

## PR guidelines

- **One concern per PR.** Bug fixes, new providers, and new integrations should
  be separate PRs.
- **Tests required** for new providers — add a file in `tests/observability/`
  that mocks the external API and asserts the normalized output shape.
- **No secrets in commits.** The CI pipeline will fail if a `.env` file or API
  key pattern is detected.
- **Keep the agent prompt unchanged** unless you're intentionally changing
  agent behaviour — coordinate in an issue first.
- **Format:** `black` for Python, default Vite/ESLint settings for JS. Run
  `black .` before pushing.
- Squash fixup commits before requesting review.
