#!/usr/bin/env python3
"""
OpsIQ CLI
=========
Query your DevOps stack from the terminal.

Usage:
  python -m interfaces.cli.main "What deployed to production today?"
  python -m interfaces.cli.main --session abc123 "What's blocked in the sprint?"
  python -m interfaces.cli.main --interactive
"""
import argparse
import json
import sys
import uuid
import os

import httpx


API_BASE = os.getenv("OPSIQ_API_URL", "http://localhost:8000")


def print_event(event: dict):
    t = event.get("type")
    if t == "tool_call":
        print(f"\n  \033[36m→ Calling {event['tool']}\033[0m", flush=True)
    elif t == "tool_result":
        print(f"  \033[32m✓ {event['tool']}: {event.get('result_preview', '')[:80]}\033[0m", flush=True)
    elif t == "text_chunk":
        print(f"\n\033[1mOpsIQ:\033[0m {event['text']}", flush=True)
    elif t == "done":
        tools = event.get("tools_used", [])
        if tools:
            print(f"\n\033[90mSources: {', '.join(tools)}\033[0m", flush=True)
    elif t == "error":
        print(f"\033[31mError: {event['message']}\033[0m", file=sys.stderr)


def run_query(query: str, session_id: str):
    """Run a single query against the OpsIQ API."""
    with httpx.Client(timeout=120) as client:
        response = client.post(
            f"{API_BASE}/query",
            json={"query": query, "session_id": session_id},
        )
        response.raise_for_status()
        result = response.json()
        print(f"\n\033[1mOpsIQ:\033[0m {result['answer']}")
        if result.get("tools_used"):
            print(f"\033[90mSources: {', '.join(result['tools_used'])}\033[0m")
        return result["session_id"]


def run_interactive(session_id: str):
    """Interactive REPL mode."""
    print("\033[1mOpsIQ Interactive Mode\033[0m — type 'exit' to quit\n")
    while True:
        try:
            query = input("\033[36mYou:\033[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break
        if query.lower() in ("exit", "quit", "q"):
            break
        if not query:
            continue
        try:
            session_id = run_query(query, session_id)
        except httpx.HTTPStatusError as e:
            print(f"\033[31mAPI error {e.response.status_code}: {e.response.text}\033[0m")
        except httpx.ConnectError:
            print(f"\033[31mCannot connect to OpsIQ API at {API_BASE}. Is it running?\033[0m")


def main():
    parser = argparse.ArgumentParser(
        description="OpsIQ — Ask your DevOps stack anything.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  opsiq "What deployed to production today?"
  opsiq "Show me all open P1 alerts"
  opsiq --interactive
  opsiq --session abc123 "What's blocked in the sprint?"
        """,
    )
    parser.add_argument("query", nargs="?", help="Query to run")
    parser.add_argument("--session", default=None, help="Session ID (for follow-up questions)")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive REPL mode")

    args = parser.parse_args()
    session_id = args.session or str(uuid.uuid4())

    if args.interactive:
        run_interactive(session_id)
    elif args.query:
        try:
            run_query(args.query, session_id)
        except httpx.ConnectError:
            print(f"\033[31mCannot connect to OpsIQ at {API_BASE}. Run: docker-compose up\033[0m")
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
