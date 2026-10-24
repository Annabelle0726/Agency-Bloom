import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import ready

from app.ai import messages_for
from app.main import create_app
from app.schemas import AIOutput, ChatInput


def insight(evidence=None):
    return {
        "title": "还有一种可能",
        "observation": "你说过喜欢解释复杂问题，也有软件开发经历",
        "possibility": "也许可以探索需要连接技术与业务的工作内容",
        "uncertainty": "这只是待探索角度，实际工作内容和要求需要核实",
        "evidence": evidence if evidence is not None else ["软件开发经历", "喜欢解释复杂问题"],
        "experiment": {
            "action": "用二十分钟向朋友解释一个技术概念",
            "tests": "是否享受面向非技术受众解释的过程",
            "effort": "二十分钟，不花钱",
            "stop_rule": "感到疲惫或不愿继续就停止",
        },
    }


@pytest.mark.parametrize(
    "mode,has_clues,expected",
    [
        ("listen", True, False),
        ("discover", True, True),
        ("discover", False, False),
        ("compare", True, True),
        ("experiment", True, True),
        ("clarify", True, True),
        ("act", True, True),
    ],
)
def test_modes_ground_optional_insight_in_user_clues_and_do_not_autosave(
    tmp_path, mode, has_clues, expected
):
    requests = []

    def provider(request):
        body = json.loads(request.content)
        requests.append(body)
        context = json.loads(body["messages"][1]["content"].split("：", 1)[1])
        assert context["interaction_mode"] == {"clarify": "discover", "act": "experiment"}.get(
            mode, mode
        )
        assert body["thinking"] == {"type": "disabled"} and body["stream"] is False
        assert "tools" not in body
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "content": json.dumps(
                                {
                                    "reply": "我们可以沿着你提供的线索继续，哪次解释让你印象最深？",
                                    "suggestion": None,
                                    "insight": insight(),
                                },
                                ensure_ascii=False,
                            )
                        },
                    }
                ],
                "usage": {"prompt_tokens": 100, "completion_tokens": 100},
            },
        )

    with TestClient(
        create_app(
            database_url=f"sqlite:///{tmp_path / 'insight.db'}",
            ai_mode="deepseek",
            deepseek_api_key="mock",
            ai_transport=httpx.MockTransport(provider),
        )
    ) as client:
        auth, chat_path = ready(client)
        client.put("/api/me", headers=auth, json={"support_style": mode})
        issue_path = chat_path.removesuffix("/chat")
        before = client.get(issue_path, headers=auth).json()
        result = client.post(
            chat_path,
            headers=auth,
            json={
                "request_id": str(uuid4()),
                "message": "我有软件开发经历，也喜欢解释复杂问题"
                if has_clues
                else "我不知道做什么",
            },
        )
        assert result.status_code == 200
        payload = result.json()
        assert payload["reply"]
        assert payload["suggestion"] is None
        assert (payload["insight"] is not None) is expected
        assert len(requests) == 1
        assert client.get(issue_path, headers=auth).json()["card"] == before["card"]
        # Retention defaults on; the turn is stored while the card stays untouched.
        assert len(client.get(issue_path + "/messages", headers=auth).json()) == 2


def test_assistant_speculation_and_card_hypotheses_do_not_count_as_evidence():
    from app.ai import ground_insight

    body = ChatInput(
        request_id=uuid4(),
        message="想看看",
        history=[{"role": "assistant", "content": "软件开发经历，喜欢解释复杂问题"}],
    )
    prompt = messages_for(
        {"confirmed": [], "hypotheses": ["软件开发经历，喜欢解释复杂问题"]}, [], body, "discover"
    )
    result = ground_insight(AIOutput(reply="先说说一次真实经历", insight=insight()), prompt)
    assert result.insight is None
    assert result.reply == "先说说一次真实经历"


def test_reply_only_and_legacy_outputs_remain_valid():
    assert AIOutput(reply="你好").insight is None
    assert AIOutput.model_validate({"reply": "你好", "suggestion": None}).insight is None


def test_rejected_angle_is_not_shown_again_and_feedback_is_only_context():
    from app.ai import ground_insight

    draft = insight()
    body = ChatInput(
        request_id=uuid4(),
        message="我有软件开发经历，也喜欢解释复杂问题",
        insight_feedback=[{"possibility": draft["possibility"], "reaction": "dismissed"}],
    )
    prompt = messages_for({"confirmed": []}, [], body, "discover")
    context = json.loads(prompt[1]["content"].split("：", 1)[1])
    assert context["insight_feedback"] == [
        {"possibility": draft["possibility"], "reaction": "dismissed"}
    ]
    assert ground_insight(AIOutput(reply="换个起点", insight=draft), prompt).insight is None


def test_exploration_answers_reach_first_turn_without_becoming_confirmed_card_facts(tmp_path):
    captured = []

    def provider(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": '{"reply":"你提到解释技术问题，我们就从这次经历开始","suggestion":null,"insight":null}'
                        }
                    }
                ],
                "usage": {"prompt_tokens": 100, "completion_tokens": 40},
            },
        )

    with TestClient(
        create_app(
            database_url=f"sqlite:///{tmp_path / 'first.db'}",
            ai_mode="deepseek",
            deepseek_api_key="mock",
            ai_transport=httpx.MockTransport(provider),
        )
    ) as client:
        login = client.post("/api/auth/dev", json={"privacy_accepted": True}).json()
        auth = {"Authorization": "Bearer " + login["token"]}
        issue = client.post(
            "/api/issues",
            headers=auth,
            json={
                "concerns": ["change"],
                "exploration_intent": "change",
                "focus_response": "别人常找我解释技术问题",
            },
        ).json()
        path = "/api/issues/" + issue["id"] + "/chat"
        request = {"request_id": str(uuid4()), "message": "从刚才的线索开始"}
        assert client.post(path, headers=auth, json=request).status_code == 403
        assert not captured
        client.put("/api/me", headers=auth, json={"ai_consent": True})
        assert client.post(path, headers=auth, json=request).status_code == 200
        context = json.loads(captured[0]["messages"][1]["content"].split("：", 1)[1])
        assert context["exploration"]["response"] == "别人常找我解释技术问题"
        assert context["confirmed_card"]["confirmed"] == []
