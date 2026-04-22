from pydantic import BaseModel
from typing import Optional


class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None

    model_config = {"json_schema_extra": {"examples": [
        {"query": "What deployments went to production in the last 24 hours?", "session_id": None}
    ]}}


class QueryResponse(BaseModel):
    answer: str
    tools_used: list[str]
    session_id: str


class HealthResponse(BaseModel):
    status: str
    version: str
