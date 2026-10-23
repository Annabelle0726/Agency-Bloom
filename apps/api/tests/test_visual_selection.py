"""Phase 2A: offline candidate preparation and strict dynamic visual gate."""
from __future__ import annotations

import dataclasses
import json
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from test_ai_boundary import ready

from app import visual_selection
from app.ai import parse_output
from app.main import create_app
from app.schemas import AIOutput


def candidates_for(theme="light", message="我想从产品运营转向自然教育"):
    candidates, payload = visual_selection.visual_context_for_chat(
        user_theme=theme,
        message=message,
        context={"confirmed_card": {"title": "想换一个方向"}},
    )
    return candidates, payload


def test_candidate_payload_is_stable_and_contains_no_paths_or_sources():
    candidates, payload = candidates_for()
    assert 3 <= len(candidates) <= 5
    assert payload is not None
    assert payload["slot"] == "chat-exploration"
    assert payload["theme"] == "light"
    assert payload["allow_null"] is True
    assert [item["id"] for item in payload["candidates"]] == [item.id for item in candidates]
    assert len({item.id for item in candidates}) == len(candidates)
    assert len({item.visual["sourceGroup"] for item in candidates}) == len(candidates)
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "/static/" not in encoded
    assert "originalPath" not in encoded
    assert "sourceSha256" not in encoded
    assert candidates_for()[1] == payload


def test_small_or_absent_pools_degrade_to_text_only():
    assert candidates_for("dark")[0] == []
    assert candidates_for("dark")[1] is None
    assert visual_selection.visual_context_for_chat(
        user_theme="light", message="你好", context=None
    ) == ([], None)
    assert visual_selection.visual_context_for_chat(
        user_theme="light", message="嗨", context={"confirmed_card": {"title": "x"}}
    ) == ([], None)


def test_strict_gate_falls_back_for_unknown_malformed_duplicate_and_runtime_failures(
    monkeypatch,
):
    candidates, _ = candidates_for()
    first, second = candidates[0], candidates[1]

    assert visual_selection.validate_selection(
        None, candidates, theme="light"
    ).visual_id is None
    assert visual_selection.validate_selection(
        first.id, candidates, theme="light"
    ).visual_id == first.id
    assert visual_selection.validate_selection(
        "made_up_visual", candidates, theme="light"
    ).visual_id == first.id
    assert visual_selection.validate_selection(
        first.id, candidates, theme="light", malformed=True
    ).visual_id == first.id

    duplicate = visual_selection.validate_selection(
        first.id,
        candidates,
        theme="light",
        used_visual_ids=[first.id],
        used_source_groups=[first.visual["sourceGroup"]],
        used_original_paths=[first.visual["originalPath"]],
    )
    assert duplicate.status == "fallback"
    assert duplicate.visual_id == second.id

    wrong_role = dataclasses.replace(first, page="plan")
    assert visual_selection.validate_selection(
        first.id, [wrong_role, second], theme="light"
    ).visual_id == second.id

    wrong_theme = dataclasses.replace(first, theme="dark")
    assert visual_selection.validate_selection(
        first.id, [wrong_theme, second], theme="light"
    ).visual_id == second.id

    missing_runtime = dataclasses.replace(first, runtime_path="/static/visuals/missing.jpg")
    assert visual_selection.validate_selection(
        first.id, [missing_runtime, second], theme="light"
    ).visual_id == second.id

    other_theme = visual_selection.validate_selection(
        first.id, candidates, theme="dark"
    )
    assert other_theme.visual_id is None


def test_parse_output_keeps_reply_when_visual_field_is_malformed():
    number = parse_output('{"reply":"仍然可用","visual_id":42}', allow_text=True)
    assert number.reply == "仍然可用"
    assert number.visual_id is None
    assert number._visual_selection_invalid is True

    blank = parse_output('{"reply":"仍然可用","visual_id":"   "}', allow_text=True)
    assert blank.visual_id is None
    assert blank._visual_selection_invalid is True

    unknown = parse_output('{"reply":"仍然可用","visual_id":"made_up"}', allow_text=True)
    assert unknown.visual_id == "made_up"
    assert unknown._visual_selection_invalid is False

    plain = parse_output("纯文字回复", allow_text=True)
    assert plain.visual_id is None
    assert plain._visual_selection_invalid is False
    assert AIOutput.model_validate({"reply": "兼容旧客户端"}).visual_id is None


def _provider(mode, calls, first_id_holder):
    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        context = json.loads(body["messages"][1]["content"].split("：", 1)[1])
        selection = context.get("visual_selection")
        if mode == "no_candidates":
            assert selection is None
            chosen = "night_lake_reading_01"
        else:
            assert selection is not None
            ids = [item["id"] for item in selection["candidates"]]
            if mode == "first":
                chosen = ids[0]
                first_id_holder.append(chosen)
            elif mode == "null":
                chosen = None
            elif mode == "unknown":
                chosen = "not_a_real_visual"
            elif mode == "malformed":
                chosen = 42
            elif mode == "duplicate":
                if not first_id_holder:
                    chosen = ids[0]
                    first_id_holder.append(chosen)
                else:
                    chosen = first_id_holder[0]
            else:
                chosen = ids[0]
        payload = {"reply": "先看看现在最在意的部分。", "suggestion": None, "visual_id": chosen}
        return httpx.Response(
            200,
            json={
                "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(payload)}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 50},
            },
        )

    return provider


def _app(database, provider, *, enabled=True):
    return create_app(
        database_url=f"sqlite:///{database}",
        ai_mode="deepseek",
        deepseek_api_key="mock-only",
        ai_transport=httpx.MockTransport(provider),
        visual_selection_enabled=enabled,
    )


def test_api_persists_only_stable_visual_id_and_survives_bad_suggestions(tmp_path):
    calls, first_ids = [], []
    app = _app(tmp_path / "visuals.db", _provider("first", calls, first_ids))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(
            path,
            headers=auth,
            json={"request_id": str(uuid4()), "message": "我想换一个工作方向"},
        )
        assert response.status_code == 200
        first = response.json()["visual_id"]
        assert first == first_ids[0]
        saved = client.get(
            f"/api/conversations/{path.split('/')[3]}/messages", headers=auth
        ).json()
        assert saved["items"][-1]["payload"]["visual_id"] == first
        assert "originalPath" not in json.dumps(saved["items"][-1]["payload"])


def test_api_accepts_null_and_falls_back_on_unknown_or_malformed(tmp_path):
    for mode, expected in (("null", "none"), ("unknown", "fallback"), ("malformed", "fallback")):
        calls, first_ids = [], []
        app = _app(tmp_path / f"{mode}.db", _provider(mode, calls, first_ids))
        with TestClient(app) as client:
            auth, path = ready(client)
            response = client.post(
                path,
                headers=auth,
                json={"request_id": str(uuid4()), "message": "我想换一个工作方向"},
            )
            assert response.status_code == 200
            assert len(calls) == 1
            if expected == "none":
                assert response.json()["visual_id"] is None
            else:
                assert response.json()["visual_id"] is not None
                context = json.loads(calls[0]["messages"][1]["content"].split("：", 1)[1])
                assert response.json()["visual_id"] in [
                    item["id"] for item in context["visual_selection"]["candidates"]
                ]


def test_api_duplicate_visible_visual_falls_back_to_a_different_id(tmp_path):
    calls, holder = [], []
    app = _app(tmp_path / "duplicate.db", _provider("duplicate", calls, holder))
    with TestClient(app) as client:
        auth, path = ready(client)
        first = client.post(
            path,
            headers=auth,
            json={"request_id": str(uuid4()), "message": "我想换一个工作方向"},
        )
        assert first.status_code == 200
        first_id = first.json()["visual_id"]
        holder.append(first_id)
        second = client.post(
            path,
            headers=auth,
            json={
                "request_id": str(uuid4()),
                "message": "我还想继续看看这个方向",
                "visible_visual_ids": [first_id],
            },
        )
        assert second.status_code == 200
        assert second.json()["visual_id"] is not None
        assert second.json()["visual_id"] != first_id
        context = json.loads(calls[1]["messages"][1]["content"].split("：", 1)[1])
        assert second.json()["visual_id"] in [
            item["id"] for item in context["visual_selection"]["candidates"]
        ]


def test_flag_off_sends_no_candidates_and_strips_model_visual(tmp_path):
    calls, holder = [], []
    app = _app(tmp_path / "flag-off.db", _provider("no_candidates", calls, holder), enabled=False)
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(
            path,
            headers=auth,
            json={"request_id": str(uuid4()), "message": "我想换一个工作方向"},
        )
        assert response.status_code == 200
        assert response.json()["visual_id"] is None
        context = json.loads(calls[0]["messages"][1]["content"].split("：", 1)[1])
        assert "visual_selection" not in context



def test_explicit_crisis_has_no_optional_visual_candidates(tmp_path):
    calls, holder = [], []
    app = _app(tmp_path / "crisis.db", _provider("no_candidates", calls, holder))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(path, headers=auth, json={
            "request_id": str(uuid4()),
            "message": "我现在想伤害自己，请给我一张图片",
        })
        assert response.status_code == 200
        assert response.json()["visual_id"] is None
        context = json.loads(calls[0]["messages"][1]["content"].split("：", 1)[1])
        assert "visual_selection" not in context


def test_history_rejects_path_shaped_or_nonstring_visual_ids():
    from app.response_reasoning import public_payload

    for value in ("https://example.test/image.jpg", "../private.jpg", 42, ["bad"]):
        assert "visual_id" not in public_payload({"visual_id": value})
    assert public_payload({"visual_id": "growth_handcraft_stitching_01"})["visual_id"] == "growth_handcraft_stitching_01"
