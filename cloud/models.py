"""
OpsIQ Cloud — Database Models
==============================
SQLAlchemy ORM models for workspace and query tracking.
Uses SQLite (dev) or Postgres (prod via DATABASE_URL).
"""
import os
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, JSON, String, Text, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL  = os.getenv("DATABASE_URL", "")
DATABASE_PATH = os.getenv("DATABASE_PATH", "./opsiq.db")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL)
else:
    engine = create_engine(
        f"sqlite:///{DATABASE_PATH}",
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Workspace(Base):
    __tablename__ = "workspaces"

    id                      = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name                    = Column(String, nullable=False)
    slug                    = Column(String, unique=True)
    plan                    = Column(String, default="free")
    stripe_customer_id      = Column(String, nullable=True)
    stripe_subscription_id  = Column(String, nullable=True)
    subscription_status     = Column(String, default="active")
    query_count_month       = Column(Integer, default=0)
    query_count_reset_at    = Column(DateTime, default=datetime.utcnow)
    auth0_user_id           = Column(String, unique=True)
    email                   = Column(String)
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QueryLog(Base):
    __tablename__ = "query_logs"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id   = Column(String, ForeignKey("workspaces.id"))
    query          = Column(Text)
    tools_used     = Column(JSON)
    answer_preview = Column(String(500))
    created_at     = Column(DateTime, default=datetime.utcnow)


def get_db():
    """FastAPI dependency — yields a SQLAlchemy session, closes on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)
