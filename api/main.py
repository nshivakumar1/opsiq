"""
OpsIQ API Server
================
FastAPI server exposing:
  POST /query          — blocking query, returns full answer
  WS   /ws/{session}  — streaming query with real-time tool-call events
  GET  /sessions/{id} — retrieve conversation history
  GET  /health        — liveness check

Run: uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.models import QueryRequest, QueryResponse, HealthResponse
from agent.core import OpsIQAgent
from memory.store import MemoryStore
from interfaces.slack_bot.app import slack_app_router

_WEB_DIST = Path(__file__).parent.parent / "interfaces" / "web" / "dist"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("OpsIQ API starting up...")
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
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(slack_app_router)

# ── Static web UI (only if the Vite build output exists) ─────────────────────

if _WEB_DIST.is_dir():
    # Serve Vite-generated assets (JS/CSS chunks) under /assets
    app.mount("/assets", StaticFiles(directory=_WEB_DIST / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_ui():
        return FileResponse(_WEB_DIST / "index.html")

    # Catch-all: return index.html for any non-API path (SPA client-side routing)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Don't intercept API or WS routes
        api_prefixes = ("query", "sessions", "health", "slack", "ws", "assets")
        if any(full_path.startswith(p) for p in api_prefixes):
            raise HTTPException(status_code=404)
        return FileResponse(_WEB_DIST / "index.html")


# ── REST Endpoints ────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="0.1.0")


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """
    Blocking query endpoint. Returns the complete answer once all
    tool calls are resolved. Good for CLI and simple integrations.
    """
    session_id = request.session_id or str(uuid.uuid4())
    try:
        agent = OpsIQAgent()
        result = agent.query(request.query, session_id)
        return QueryResponse(
            answer=result["answer"],
            tools_used=result["tools_used"],
            session_id=session_id,
        )
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Retrieve conversation history for a session."""
    store = MemoryStore()
    history = store.get_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session_id": session_id, "messages": history}


# ── WebSocket Streaming ───────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_query(websocket: WebSocket, session_id: str):
    """
    Streaming WebSocket endpoint. Emits events as they happen:
      {"type": "tool_call",    "tool": "...", "input": {...}}
      {"type": "tool_result",  "tool": "...", "result_preview": "..."}
      {"type": "text_chunk",   "text": "..."}
      {"type": "done",         "tools_used": [...]}
      {"type": "error",        "message": "..."}
    """
    await websocket.accept()
    agent = OpsIQAgent()

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            user_query = data.get("query", "")

            if not user_query:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Empty query"})
                )
                continue

            async for event in agent.stream_query(user_query, session_id):
                await websocket.send_text(json.dumps(event))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: session={session_id}")
    except Exception as e:
        logger.exception("WebSocket error")
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "message": str(e)})
            )
        except Exception:
            pass
