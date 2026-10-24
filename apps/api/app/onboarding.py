"""Exact text from user-supplied, dated questionnaire answers."""


def answer_texts(answers):
    texts = [answers.get("question", ""), answers.get("response", "")]
    for answer in (answers.get("follow_ups") or {}).values():
        texts.extend(answer.get("selections", []))
        texts.append(answer.get("note", ""))
        for parent, selections in (answer.get("refinements") or {}).items():
            if parent in answer.get("selections", []):
                texts.extend(selections)
    return [value for value in texts if isinstance(value, str) and value.strip()]
