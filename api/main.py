"""
OpsIQ API Server
================
FastAPI server exposing:
  POST /query          — blocking query, returns full answer
  WS   /ws/{session}  — streaming query with real-time tool-call events
  GET  /sessions/{id} — retrieve conversation history
  GET  /health        — liveness check
  *    /cloud/*       — billing, workspace, usage (cloud mode)

Run: uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Query
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.models import QueryRequest, QueryResponse, HealthResponse
from agent.core import OpsIQAgent
from memory.store import MemoryStore
from interfaces.slack_bot.app import slack_app_router
from cloud.auth import get_current_user_optional, validate_bearer_token
from cloud.models import QueryLog, SessionLocal, Workspace, init_db, get_db
from cloud.workspace import get_or_create_workspace
from cloud.limits import check_and_increment_query_count, QueryLimitExceeded
from cloud.router import cloud_router

_WEB_DIST = Path(__file__).parent.parent / "interfaces" / "web" / "dist"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("OpsIQ API starting up...")
    try:
        init_db()
        logger.info("Database tables verified/created.")
    except Exception:
        logger.exception("DB init failed — continuing without cloud features")
    yield
    logger.info("OpsIQ API shutting down.")


app = FastAPI(
    title="OpsIQ",
    description="AI-powered DevOps intelligence agent",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://opsiq.theinfinityloop.space",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(slack_app_router)
app.include_router(cloud_router)

# ── REST Endpoints ────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="0.1.0")


# ── Static web UI (only if the Vite build output exists) ─────────────────────

if _WEB_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_WEB_DIST / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_ui():
        return FileResponse(_WEB_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        api_prefixes = (
            "query", "sessions", "health", "slack",
            "ws", "assets", "cloud", "admin", "debug",
        )
        if any(full_path.startswith(p) for p in api_prefixes):
            raise HTTPException(status_code=404)
        return FileResponse(_WEB_DIST / "index.html")

else:
    @app.get("/", include_in_schema=False)
    async def root():
        return HealthResponse(status="ok", version="0.1.0")


@app.post("/query", response_model=QueryResponse)
async def query(
    request_body: QueryRequest,
    request: Request,
    current_user: dict | None = Depends(get_current_user_optional),
):
    """
    Blocking query endpoint. OSS users (no JWT / no AUTH0_DOMAIN) are always
    allowed through with no rate limits. Cloud users are checked against their
    monthly quota before the agent runs.
    """
    session_id = request_body.session_id or str(uuid.uuid4())

    # ── Cloud: rate-limit check ───────────────────────────────────────────────
    workspace = None
    if current_user:
        with SessionLocal() as db:
            try:
                workspace = await get_or_create_workspace(
                    current_user["sub"], current_user.get("email", ""), db
                )
                await check_and_increment_query_count(workspace, db)
                workspace_id = workspace.id  # capture before session closes
            except QueryLimitExceeded as exc:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error":       "query_limit_exceeded",
                        "message":     (
                            f"You have used all {exc.limit} queries this month "
                            f"on the {exc.plan.title()} plan."
                        ),
                        "plan":        exc.plan,
                        "upgrade_url": "/app?upgrade=true",
                    },
                )
    else:
        workspace_id = None

    # ── Run agent ─────────────────────────────────────────────────────────────
    try:
        agent  = OpsIQAgent()
        result = agent.query(request_body.query, session_id)

        # ── Cloud: log query ──────────────────────────────────────────────────
        if current_user and workspace_id:
            try:
                with SessionLocal() as db:
                    db.add(QueryLog(
                        workspace_id   = workspace_id,
                        query          = request_body.query,
                        tools_used     = result.get("tools_used", []),
                        answer_preview = result.get("answer", "")[:500],
                    ))
                    db.commit()
            except Exception:
                logger.exception("Failed to log query for workspace %s", workspace_id)

        return QueryResponse(
            answer=result["answer"],
            tools_used=result["tools_used"],
            session_id=session_id,
        )

    except EnvironmentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.post("/admin/upgrade-workspace")
async def admin_upgrade(
    request: Request,
    db: Session = Depends(get_db),
):
    """Manually upgrade a workspace to Pro. Protected by ADMIN_SECRET_KEY."""
    admin_key = request.headers.get("X-Admin-Key", "")
    expected  = os.getenv("ADMIN_SECRET_KEY", "")

    if not expected or admin_key != expected:
        raise HTTPException(status_code=403, detail="Forbidden")

    body         = await request.json()
    workspace_id = body.get("workspace_id")

    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=404,
            detail=f"Workspace {workspace_id} not found",
        )

    workspace.plan                = "pro"
    workspace.subscription_status = "active"
    workspace.stripe_customer_id  = body.get("customer_id", "manual_upgrade")
    db.commit()

    return {
        "upgraded":     True,
        "workspace_id": workspace_id,
        "plan":         workspace.plan,
    }


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Retrieve conversation history for a session."""
    store   = MemoryStore()
    history = store.get_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session_id": session_id, "messages": history}


# ── WebSocket Streaming ───────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_query(
    websocket: WebSocket,
    session_id: str,
    token: str | None = Query(default=None),
):
    """
    Streaming WebSocket endpoint. Emits events as they happen:
      {"type": "tool_call",    "tool": "...", "input": {...}}
      {"type": "tool_result",  "tool": "...", "result_preview": "..."}
      {"type": "text_chunk",   "text": "..."}
      {"type": "done",         "tools_used": [...]}
      {"type": "error",        "message": "...", "code": "..."}
    """
    await websocket.accept()

    # Validate JWT from query param (optional — OSS users have no token)
    current_user = await validate_bearer_token(token) if token else None
    agent        = OpsIQAgent()

    try:
        while True:
            raw  = await websocket.receive_text()
            data = json.loads(raw)
            user_query = data.get("query", "")

            if not user_query:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Empty query"})
                )
                continue

            # ── Cloud: rate-limit check ───────────────────────────────────────
            workspace_id = None
            if current_user:
                try:
                    with SessionLocal() as db:
                        ws = await get_or_create_workspace(
                            current_user["sub"], current_user.get("email", ""), db
                        )
                        await check_and_increment_query_count(ws, db)
                        workspace_id = ws.id
                except QueryLimitExceeded as exc:
                    await websocket.send_text(json.dumps({
                        "type":        "error",
                        "code":        "query_limit_exceeded",
                        "message":     (
                            f"You have used all {exc.limit} queries this month "
                            f"on the {exc.plan.title()} plan."
                        ),
                        "plan":        exc.plan,
                        "upgrade_url": "/app?upgrade=true",
                    }))
                    continue

            # ── Stream agent response ─────────────────────────────────────────
            tools_used = []
            async for event in agent.stream_query(user_query, session_id):
                if event.get("type") == "done":
                    tools_used = event.get("tools_used", [])
                await websocket.send_text(json.dumps(event))

            # ── Cloud: log query ──────────────────────────────────────────────
            if current_user and workspace_id:
                try:
                    with SessionLocal() as db:
                        db.add(QueryLog(
                            workspace_id=workspace_id,
                            query=user_query,
                            tools_used=tools_used,
                            answer_preview="",  # text_chunk not buffered here
                        ))
                        db.commit()
                except Exception:
                    logger.exception("Failed to log WS query for workspace %s", workspace_id)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: session=%s", session_id)
    except Exception:
        logger.exception("WebSocket error")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": "Internal server error"}))
        except Exception:
            pass
