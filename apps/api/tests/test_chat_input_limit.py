from uuid import uuid4

from app.schemas import ConversationChatInput


def test_complete_plan_rewrite_is_valid_without_truncating_user_text():
    text = '稿' * 3500
    body = ConversationChatInput(request_id=uuid4(), message=text)
    assert body.message == text
