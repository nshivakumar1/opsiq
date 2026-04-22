"""
OpsIQ Agent Core
================
The agentic loop that powers OpsIQ. Sends queries to Claude Sonnet,
executes tool calls until Claude has enough context to answer, then
returns the final synthesised response.

Supports both blocking (query) and streaming (stream_query) modes.
"""
import json
import logging
from typing import AsyncGenerator

import anthropic

from agent.prompts import SYSTEM_PROMPT
from agent.tools import TOOLS, ToolDispatcher
from memory.store import MemoryStore

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 10  # Safety limit — Claude shouldn't need more than this


class OpsIQAgent:
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.model = "claude-sonnet-4-20250514"
        self.memory = MemoryStore()
        self.dispatcher = ToolDispatcher()

    # ── Public API ────────────────────────────────────────────────────────────

    def query(self, user_query: str, session_id: str) -> dict:
        """
        Blocking query. Returns the final answer and metadata.
        Use this for the REST endpoint.
        """
        messages = self._load_history(session_id)
        messages.append({"role": "user", "content": user_query})

        final_text, tools_used = self._run_agentic_loop(messages)

        messages.append({"role": "assistant", "content": final_text})
        self.memory.save_history(session_id, messages)

        return {
            "answer": final_text,
            "tools_used": tools_used,
            "session_id": session_id,
        }

    async def stream_query(
        self, user_query: str, session_id: str
    ) -> AsyncGenerator[dict, None]:
        """
        Streaming query. Yields progress events for the WebSocket endpoint.
        Event types: 'tool_call', 'tool_result', 'text_chunk', 'done'.
        """
        messages = self._load_history(session_id)
        messages.append({"role": "user", "content": user_query})

        tools_used = []
        tool_rounds = 0

        while tool_rounds < MAX_TOOL_ROUNDS:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            if response.stop_reason == "tool_use":
                tool_uses = [b for b in response.content if b.type == "tool_use"]
                tool_results_content = []

                for tool_use in tool_uses:
                    yield {
                        "type": "tool_call",
                        "tool": tool_use.name,
                        "input": tool_use.input,
                    }

                    result = self.dispatcher.dispatch(tool_use.name, tool_use.input)
                    tools_used.append(tool_use.name)

                    yield {
                        "type": "tool_result",
                        "tool": tool_use.name,
                        "result_preview": self._preview(result),
                    }

                    tool_results_content.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": json.dumps(result),
                    })

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results_content})
                tool_rounds += 1

            elif response.stop_reason == "end_turn":
                final_text = "".join(
                    b.text for b in response.content if hasattr(b, "text")
                )
                messages.append({"role": "assistant", "content": final_text})
                self.memory.save_history(session_id, messages)

                yield {"type": "text_chunk", "text": final_text}
                yield {"type": "done", "tools_used": tools_used}
                return

        # Shouldn't normally reach here — safety fallback
        yield {
            "type": "done",
            "tools_used": tools_used,
            "warning": f"Reached max tool rounds ({MAX_TOOL_ROUNDS})",
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _run_agentic_loop(self, messages: list) -> tuple[str, list[str]]:
        """Blocking agentic loop. Returns (final_text, tools_used)."""
        tools_used = []

        for _ in range(MAX_TOOL_ROUNDS):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            if response.stop_reason == "tool_use":
                tool_uses = [b for b in response.content if b.type == "tool_use"]
                tool_results_content = []

                for tool_use in tool_uses:
                    logger.info(f"Tool call: {tool_use.name} | input: {tool_use.input}")
                    result = self.dispatcher.dispatch(tool_use.name, tool_use.input)
                    tools_used.append(tool_use.name)
                    tool_results_content.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": json.dumps(result),
                    })

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results_content})

            elif response.stop_reason == "end_turn":
                final_text = "".join(
                    b.text for b in response.content if hasattr(b, "text")
                )
                return final_text, tools_used

        return "Reached maximum tool call limit.", tools_used

    def _load_history(self, session_id: str) -> list:
        return self.memory.get_history(session_id) or []

    def _preview(self, result: any) -> str:
        """Short string preview of a tool result for streaming events."""
        text = json.dumps(result) if not isinstance(result, str) else result
        return text[:200] + "..." if len(text) > 200 else text
