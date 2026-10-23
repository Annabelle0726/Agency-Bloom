"""Offline conversation contract replay; never connects to a model or user DB.

Run from apps/api: python -m evaluation.run --output evaluation/baseline.json
Scripted replies test plumbing only. Human quality review remains pending.
"""
import argparse
import asyncio
import hashlib
import json
import socket
import subprocess
from pathlib import Path
from uuid import UUID

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.ai import generate, messages_for, reservation_micro
from app.config import Settings
from app.conversations import context_for
from app.models import Base, Conversation, Issue, Memory, Message, User
from app.response_reasoning import public_payload
from app.schemas import ConversationChatInput

HERE = Path(__file__).resolve().parent
API = HERE.parent
ROOT = API.parent.parent
CORPUS = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))


def no_network(*args, **kwargs):
    raise AssertionError("Offline evaluation prohibits network access")


async def replay():
    # Explicit values beat ambient .env/environment; synthetic settings only.
    settings = Settings(
        _env_file=None, environment="development", database_url="sqlite://",
        ai_mode="deepseek", deepseek_model="deepseek-v4-pro",
        deepseek_api_key="offline-fictional-key", deepseek_base_url="https://offline.invalid",
        ai_thinking=True, max_output_tokens=4096, ai_monthly_budget_cny=100,
        input_price_per_million=9, cached_input_price_per_million="0.30",
        output_price_per_million=27, wechat_app_id="", wechat_app_secret="",
    )
    records, systems = [], {}
    for retained in (True, False):
        for case in CORPUS["cases"]:
            engine = create_engine("sqlite://")
            Base.metadata.create_all(engine)
            with Session(engine) as db:
                user = User(id="fictional-user", save_chat=retained, use_memory=True)
                issue = Issue(id="fictional-issue", user_id=user.id, title="", card={})
                conversation = Conversation(id="fictional-conversation", user_id=user.id, issue_id=issue.id)
                db.add_all([user, issue, conversation])
                for index, memory in enumerate(case.get("memories", [])):
                    db.add(Memory(id=f"fictional-memory-{index}", user_id=user.id, **memory))
                db.commit()
                original_memories = [(m.id, m.content, m.status, m.version) for m in db.query(Memory)]
                history = []
                for number, turn in enumerate(case["turns"], 1):
                    body = ConversationChatInput(
                        request_id=UUID(int=number), message=turn["user"], history=history[-80:]
                    )
                    recent, context, sources = context_for(db, user, conversation, body)
                    prompt = messages_for({}, [], body, conversation_context=context, history=recent)
                    system_hash = hashlib.sha256(prompt[0]["content"].encode()).hexdigest()
                    systems[system_hash] = prompt[0]["content"]
                    supplied = json.loads(prompt[1]["content"].split("：", 1)[1])
                    fixture = {"reply": turn["fixture_reply"], "suggestion": None}
                    variant = case.get("summary_variant")
                    if variant in ("valid", "invalid"):
                        fixture["reasoning_summary"] = [
                            {"kind": "understanding", "text": "你有开发经验，也喜欢研究业务需求。",
                             "evidence": [{"source_id": "s1", "quote": "我有开发经验"}]},
                            {"kind": "basis", "text": "先了解需求工作的日常，可以保留开发经验的积累。",
                             "evidence": [{"source_id": "s1", "quote": "喜欢研究业务需求"}]},
                        ]
                        if variant == "invalid":
                            fixture["reasoning_summary"][1]["evidence"][0]["quote"] = "从未提供的私密信息"
                    captured = []

                    def provider(request):
                        sent = json.loads(request.content)
                        captured.append(sent)
                        return httpx.Response(200, json={
                            "id": "offline-scripted-response", "model": "DeepSeek-V4-Pro-0813",
                            "created": 1792555200,
                            "choices": [{"finish_reason": "stop", "message": {
                                "content": json.dumps(fixture, ensure_ascii=False),
                                "reasoning_content": "PRIVATE_COT_SENTINEL",
                            }}],
                            "usage": {"prompt_tokens": 1000, "completion_tokens": 200,
                                      "total_tokens": 1200,
                                      "completion_tokens_details": {"reasoning_tokens": 100}},
                        })

                    result = await generate(settings, prompt, httpx.MockTransport(provider))
                    output = result.output.model_dump()
                    checks = {
                        "one_mock_request": len(captured) == 1,
                        "latest_message_last": captured[0]["messages"][-1]["content"] == turn["user"],
                        "no_raw_reasoning": "PRIVATE_COT_SENTINEL" not in json.dumps(output),
                        "saved_memories_unchanged": original_memories == [
                            (m.id, m.content, m.status, m.version) for m in db.query(Memory)],
                        "card_not_automatically_changed": db.get(Issue, issue.id).card == {},
                    }
                    for checkpoint in case.get("checkpoints", []):
                        if checkpoint["turn"] != number:
                            continue
                        if "required_history" in checkpoint:
                            checks["important_earlier_limit_supplied"] = any(
                                m["content"] == checkpoint["required_history"] for m in recent
                            )
                        if "unverified_memory" in checkpoint:
                            checks["changed_schedule_not_current_fact"] = any(
                                m["content"] == checkpoint["unverified_memory"]
                                for m in context["memories_to_verify"]
                            ) and not any(
                                m["content"] == checkpoint["unverified_memory"]
                                for m in context["confirmed_memories"] + context["current_phase"]
                            )
                    if variant:
                        checks["summary_visibility_contract"] = bool(output["reasoning_summary"]) == (variant == "valid")
                        cleaned = public_payload(output | {"reasoning_content": "PRIVATE_COT_SENTINEL",
                                                          "thinking_steps": ["PRIVATE_COT_SENTINEL"]})
                        checks["history_no_legacy_raw_fields"] = "PRIVATE_COT_SENTINEL" not in json.dumps(cleaned)
                    records.append({
                        "case": case["id"], "retained": retained, "turn": number,
                        "persona": case["persona"], "input": turn["user"],
                        "expected_behavior": case["expected"],
                        "actual_result_origin": "scripted_mock_NOT_model_quality",
                        "actual_result": output,
                        "system_hash": system_hash,
                        "actual_context": supplied, "selected_history": recent,
                        "source_inventory": sources,
                        "provider_parameters": {k: v for k, v in captured[0].items() if k != "messages"},
                        "peak_reservation_micro": reservation_micro(settings, prompt),
                        "checks": checks,
                        "issue_types": [k for k, v in checks.items() if not v],
                        "quality_dimensions": {k: "not_assessed_mock" for k in CORPUS["rubric"]},
                        "human_review": {"status": "pending", "reviewer": None, "conclusion": None},
                    })
                    for role, content in (("user", turn["user"]), ("assistant", result.output.reply)):
                        history.append({"role": role, "content": content})
                        if retained:
                            db.add(Message(issue_id=issue.id, conversation_id=conversation.id,
                                           role=role, content=content,
                                           created_at=f"2026-01-01T00:{number:02d}:{0 if role == 'user' else 1:02d}+00:00"))
                    db.commit()
            engine.dispose()
    return {"format_version": 1, "provider": "httpx.MockTransport only",
            "paid_requests": 0, "semantic_quality": "not_verified",
            "corpus_sha256": hashlib.sha256((HERE / "cases.json").read_bytes()).hexdigest(),
            "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "source_sha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                              for p in sorted((API / "app").glob("*.py"))},
            "system_prompts": systems, "records": records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Refusing to overwrite an evaluation record; choose a new output path.")
    # Deny accidental network additions, including any future provider fallback.
    with asyncio.Runner() as runner:
        runner.get_loop()  # Windows creates a local self-pipe before the network guard.
        socket.socket.connect = no_network
        socket.socket.connect_ex = no_network
        report = runner.run(replay())
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failures = [f"{r['case']}/{r['retained']}/{r['turn']}: {r['issue_types']}"
                for r in report["records"] if r["issue_types"]]
    print(json.dumps({"records": len(report["records"]), "contract_findings": failures,
                      "paid_requests": 0, "real_model_quality": "NOT ASSESSED"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
