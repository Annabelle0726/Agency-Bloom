import json

from fastapi.testclient import TestClient
from test_journey import login
from test_workspace import conversation, send
from test_workspace import workspace as linked_workspace

from app.ai import ground_insight
from app.main import create_app
from app.response_reasoning import evidence_catalog
from app.schemas import AIOutput

workspace = linked_workspace


def test_full_branch_path_reaches_the_actual_model_request(workspace):
    client, auth, _, captured = workspace
    answers = {"relationships": {"selections": ["自己的想法和家人的期待不同"], "note": "家人希望我留在本地",
        "refinements": {"自己的想法和家人的期待不同": ["知道自己想要什么，但难以表达"]}}}
    response = client.post("/api/issues", headers=auth, json={"concerns": ["relationships"],
        "exploration_intent": "relationships", "follow_ups": answers, "life_contexts": ["working", "care"]})
    assert response.status_code == 201, response.text
    item = response.json()
    assert client.get(f"/api/issues/{item['id']}/snapshot", headers=auth).json()["answers"]["follow_ups"] == answers
    assert captured == []  # Completing the questions never calls a model.
    conv = conversation(client, auth, item)
    assert send(client, auth, conv, "想聊聊怎样向家人表达自己的想法").status_code == 200
    assert len(captured) == 1
    context = json.loads(captured[0]["messages"][1]["content"].split("：", 1)[1])
    assert context["exploration"]["follow_ups"] == answers
    assert context["user_selected_context"] == ["working", "care"]
    assert "知道自己想要什么，但难以表达" in [item["text"] for item in evidence_catalog(context, [], "聊聊家人")]
    assert "refinements" in captured[0]["messages"][0]["content"]


def test_refinement_cannot_be_attached_to_an_unselected_parent(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'parents.db'}")) as client:
        auth = login(client)
        response = client.post("/api/issues", headers=auth, json={"concerns": ["job_search"], "follow_ups": {
            "job_search": {"selections": ["面试准备让我没底"], "refinements": {"投递后反馈很少": ["没有回复"]}},
        }})
        assert response.status_code == 422


def test_linked_answers_are_persisted_as_user_answers_not_inferred_facts(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'linked.db'}")) as client:
        auth = login(client)
        answers = {
            "job_search": {"selections": ["还没确定岗位或行业方向", "投递后反馈很少"], "note": "考虑产品设计"},
            "change": {"selections": ["想了解已有能力还能用在哪里"], "note": "也关心 AI 的影响"},
        }
        response = client.post("/api/issues", headers=auth, json={
            "concerns": ["job_search", "change"], "exploration_intent": "job_search",
            "follow_ups": answers, "focus_response": "考虑产品设计",
            "life_contexts": ["working", "searching"], "support_style": "listen",
        })
        assert response.status_code == 201
        issue = response.json()
        assert issue["follow_ups"] == answers
        assert issue["stage"] == "unsure"
        assert issue["card"]["confirmed"] == []
        assert client.get(f"/api/issues/{issue['id']}", headers=auth).json()["follow_ups"] == answers
        snapshot = client.get(f"/api/issues/{issue['id']}/snapshot", headers=auth)
        assert snapshot.status_code == 200
        assert snapshot.json()["answers"]["follow_ups"] == answers
        assert client.get("/api/memories", headers=auth).json() == []


def test_linked_answers_reject_unselected_topics_and_malformed_lists(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'invalid.db'}")) as client:
        auth = login(client)
        for answers in (
            {"job_search": {"selections": ["投递后反馈很少"], "note": ""}},
            {"direction": {"selections": ["x"] * 7, "note": ""}},
            {"direction": {"selections": [], "note": "x" * 801}},
        ):
            assert client.post("/api/issues", headers=auth, json={"concerns": ["direction"], "follow_ups": answers}).status_code == 422


def test_legacy_and_unanswered_explorations_remain_compatible(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'legacy.db'}")) as client:
        auth = login(client)
        for payload in ({}, {"concerns": ["direction"], "focus_response": "自己的原话"}):
            response = client.post("/api/issues", headers=auth, json=payload)
            assert response.status_code == 201
            assert response.json()["follow_ups"] == {}


def test_linked_selections_are_available_as_exact_authorized_evidence():
    context = {"interaction_mode": "discover", "exploration": {"follow_ups": {
        "job_search": {"selections": ["投递后反馈很少"], "note": "想了解产品设计和用户研究"},
    }}}
    catalog = evidence_catalog(context, [], "想聊聊求职")
    assert "投递后反馈很少" in [source["text"] for source in catalog]
    assert "想了解产品设计和用户研究" in [source["text"] for source in catalog]
    result = AIOutput(reply="可以先了解岗位要求", insight={
        "title": "还有一种可能", "observation": "你提到投递后反馈很少，也在考虑产品设计和用户研究",
        "possibility": "可以先比较这两个方向的岗位要求", "uncertainty": "还需要了解实际岗位信息",
        "evidence": ["投递后反馈很少", "产品设计和用户研究"], "experiment": None,
    })
    messages = [{"role": "system", "content": ""}, {"role": "user", "content": "背景：" + json.dumps(context, ensure_ascii=False)}]
    assert ground_insight(result, messages).insight is not None
