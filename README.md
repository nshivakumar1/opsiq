# OpsIQ 🔍

**Ask your infrastructure anything. In plain English.**

OpsIQ is an open-source AI-powered DevOps intelligence agent built on Claude. It connects to your GitHub, Jira, Datadog, Confluence, and Slack — then answers questions about your infrastructure in seconds, without you ever leaving your terminal or Slack.

```
You:    "What deployments went to production in the last 24 hours and are there any related alerts?"

OpsIQ:  3 deployments found (api-service v2.4.1, auth-service v1.9.0, worker v3.1.2)
        2 active Datadog alerts firing — api-service latency p99 > 2s correlates
        with the api-service deploy at 14:32 UTC. Recommended: rollback api-service
        or investigate the /checkout endpoint added in PR #847.

        Sources used: github_get_deployments, datadog_get_active_alerts, datadog_query_logs
```

## ✨ What it does

- **Incident triage** — correlate alerts, deploys, and code changes in one query
- **Sprint intelligence** — "what's blocked and why?" across Jira in seconds
- **Runbook lookup** — surface the right Confluence doc for any alert
- **Autonomous actions** — create Jira tickets, send Slack alerts (with your confirmation)
- **Multi-turn memory** — follow-up questions remember the conversation context

## 🚀 Quick start

```bash
git clone https://github.com/your-org/opsiq
cd opsiq
cp .env.example .env     # fill in your API keys
docker-compose up        # OpsIQ API starts on :8000
```

Then query it:

```bash
# CLI
python -m interfaces.cli.main "What changed on main in the last 6 hours?"

# Interactive REPL
python -m interfaces.cli.main --interactive

# Direct API
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all open P1 alerts"}'
```

## API Keys

OpsIQ requires your own Anthropic API key for self-hosted deployments. Get one at [console.anthropic.com](https://console.anthropic.com).

Each user is responsible for their own API usage and costs when self-hosting. OpsIQ Cloud (coming soon) includes API access in the subscription price.

## 🔧 Configuration

Copy `.env.example` to `.env` and fill in the credentials you want to enable.
OpsIQ gracefully skips any integration whose credentials aren't set.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `GITHUB_TOKEN` | ⚡ | Fine-grained PAT with `repo:read` |
| `GITHUB_REPO` | ⚡ | e.g. `acme/api-service` |
| `DD_API_KEY` + `DD_APP_KEY` | ⚡ | Datadog API credentials |
| `JIRA_SERVER` + `JIRA_EMAIL` + `JIRA_API_TOKEN` | ⚡ | Jira Cloud credentials |
| `CONFLUENCE_URL` + `CONFLUENCE_EMAIL` + `CONFLUENCE_API_TOKEN` | ⚡ | Confluence Cloud |
| `SLACK_BOT_TOKEN` | ⚡ | Bot token with `chat:write` scope |

## 🏗 Architecture

```
Slack / Web / CLI
       ↓
OpsIQ Agent Core (Claude Sonnet)
  ├── Query parser
  ├── Tool planner
  └── Synthesizer
       ↓ ↑
GitHub │ Jira │ Datadog │ Confluence │ Slack
```

The agent uses Claude's tool-use API in an agentic loop — it calls tools until it has enough context to give a complete answer, then synthesises everything into a single response.

## 📡 API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/query` | Blocking query, returns full answer |
| `WS` | `/ws/{session_id}` | Streaming with real-time tool-call events |
| `GET` | `/sessions/{id}` | Conversation history |

## 🤝 Contributing

OpsIQ is designed to be extended. The easiest contribution is a new integration:

1. Create `integrations/your_tool_client.py`
2. Add tool schemas in `agent/tools.py`
3. Add a dispatch case in `ToolDispatcher.dispatch()`

See `CONTRIBUTING.md` for a step-by-step guide. Issues labelled `good first issue` are a great starting point.

## 📄 License

Business Source License 1.1 — free for personal and community use.
Commercial use requires a license. See [LICENSE](LICENSE) and [opsiq.dev/pricing](https://opsiq.dev).

---

Built with ❤️ using [Claude](https://anthropic.com) · [Star this repo](https://github.com/your-org/opsiq) if OpsIQ saves you time
