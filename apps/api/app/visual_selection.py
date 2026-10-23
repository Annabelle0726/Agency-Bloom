"""Deterministic candidate preparation and strict validation for dynamic visuals.

Selections reuse the existing chat request and reviewed candidate metadata.
The application feature flag can disable candidate inclusion. The model never receives paths, URLs, or image bytes;
it can only return one of the supplied stable IDs or null.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Mapping

THEMES = ("light", "dark", "dawn", "forest", "lavender", "minimal")
PAGES = ("discover", "explore", "plan", "shared")
ROLES = ("hero", "page-background", "card-thumbnail", "section-illustration", "decorative")
CATEGORIES = (
    "choices",
    "connection",
    "direction",
    "growth",
    "reflection",
    "rest",
    "transition",
)
VISUAL_ID = re.compile(r"^[a-z0-9_]{1,80}$")
DEFAULT_ROOT = Path(__file__).resolve().parents[3]
PAGE_USE = {
    "discover": "发现页的探索氛围图，只辅助文字，不替代主操作",
    "explore": "聊天中与用户当前探索相关的氛围图，只辅助文字",
    "plan": "计划页的下一步氛围图，只辅助文字，不替代决策卡",
    "shared": "分享场景的安静氛围图，只辅助文字",
}
CATEGORY_HINTS = {
    "choices": ("选择", "比较", "取舍", "岔路", "offer", "choice", "compare", "decision"),
    "connection": ("沟通", "朋友", "同事", "关系", "连接", "connect", "friend", "people", "together"),
    "direction": ("方向", "路径", "出发", "未来", "path", "direction", "journey"),
    "growth": ("生长", "花", "学习", "成长", "new-beginning", "grow", "flower", "spring", "learn"),
    "reflection": ("阅读", "书", "窗边", "回看", "反思", "read", "book", "window", "desk", "reflection"),
    "rest": ("休息", "安静", "夜", "湖", "暂停", "rest", "quiet", "night", "moon", "pause"),
    "transition": ("过渡", "转变", "秋季", "换季", "季节", "turn", "transition", "season", "shift"),
}


@dataclass(frozen=True)
class Candidate:
    id: str
    visual: Mapping
    page: str
    role: str
    theme: str
    runtime_path: str

    def prompt_payload(self) -> dict:
        visual = self.visual
        return {
            "id": self.id,
            "description": visual["description"],
            "page_use": PAGE_USE[self.page],
            "category": visual["category"],
            "tags": list(visual.get("tags", []))[:8],
            "aspect_ratio": visual["dimensions"]["aspectRatio"],
        }


@dataclass(frozen=True)
class Decision:
    visual_id: str | None
    status: str
    reason: str


@lru_cache(maxsize=4)
def _load_manifest(path: str, mtime_ns: int) -> dict:
    # mtime is part of the cache key so an ingest/apply run is visible without
    # restarting a long-lived process.
    del mtime_ns
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_manifest(root: str | Path | None = None) -> dict:
    base = Path(root) if root is not None else DEFAULT_ROOT
    path = base / "assets" / "visual-manifest.json"
    return _load_manifest(str(path), path.stat().st_mtime_ns)


def should_omit_visuals(message: str) -> bool:
    """Omit optional art for explicit crisis language; not a safety classifier."""
    return any(word in message for word in (
        "伤害自己", "自杀", "自残", "不想活了", "想死", "活着没有意义",
    ))


def runtime_file(root: str | Path | None, runtime_path: str) -> Path:
    base = Path(root) if root is not None else DEFAULT_ROOT
    return base / "apps" / "miniprogram" / "src" / runtime_path.lstrip("/")


def runtime_exists(candidate: Candidate, root: str | Path | None = None) -> bool:
    return runtime_file(root, candidate.runtime_path).is_file()


def _variant(visual: Mapping, theme: str, role: str) -> str | None:
    is_hero = role in ("hero", "page-background")
    variants = visual.get("heroVariants" if is_hero else "runtimeVariants") or {}
    value = variants.get(theme)
    return value if isinstance(value, str) and value.startswith("/static/") and value.endswith(".jpg") else None


def _score(visual: Mapping, message: str) -> int:
    text = message.lower()
    tags = [str(tag).lower() for tag in visual.get("tags", [])]
    score = sum(6 for tag in tags if len(tag) >= 2 and tag in text)
    category = visual.get("category", "")
    score += sum(3 for hint in CATEGORY_HINTS.get(category, ()) if hint.lower() in text)
    description = str(visual.get("description", "")).lower()
    score += sum(1 for tag in tags[:12] if len(tag) >= 2 and tag in description)
    return score


def candidate_pool(
    *,
    theme: str,
    page: str = "explore",
    role: str = "card-thumbnail",
    message: str = "",
    limit: int = 5,
    used_visual_ids: Iterable[str] = (),
    used_source_groups: Iterable[str] = (),
    used_original_paths: Iterable[str] = (),
    root: str | Path | None = None,
    manifest: Mapping | None = None,
) -> list[Candidate]:
    """Return 3-5 stable candidates, or [] when the local pool is insufficient.

    This is the backend counterpart of the deterministic local resolver. It
    filters on manifest suitability and real runtime files before the model sees
    anything, then applies a stable relevance ranking.
    """
    if theme not in THEMES or page not in PAGES or role not in ROLES:
        return []
    data = manifest if manifest is not None else load_manifest(root)
    used_ids = set(used_visual_ids)
    used_groups = set(used_source_groups)
    used_paths = set(used_original_paths) | {
        visual["originalPath"]
        for visual in data.get("visuals", [])
        if visual.get("id") in used_ids
    }
    ranked: list[tuple[int, str, Candidate]] = []
    for visual in data.get("visuals", []):
        if not visual.get("deploy") or visual.get("status") != "deployed":
            continue
        if visual.get("id") in used_ids:
            continue
        if visual.get("originalPath") in used_paths:
            continue
        if visual.get("sourceGroup") in used_groups:
            continue
        if page not in visual.get("intendedPage", []) or role not in visual.get("visualRole", []):
            continue
        if theme not in visual.get("themeCompatibility", []):
            continue
        runtime_path = _variant(visual, theme, role)
        if runtime_path is None:
            continue
        candidate = Candidate(
            id=visual["id"],
            visual=visual,
            page=page,
            role=role,
            theme=theme,
            runtime_path=runtime_path,
        )
        if not runtime_exists(candidate, root):
            continue
        ranked.append((_score(visual, message), visual["id"], candidate))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    chosen: list[Candidate] = []
    selected_groups = set(used_groups)
    for _, _, candidate in ranked:
        group = candidate.visual.get("sourceGroup")
        if group in selected_groups:
            continue
        selected_groups.add(group)
        chosen.append(candidate)
        if len(chosen) == limit:
            break
    return chosen if len(chosen) >= 3 else []


def selection_payload(
    candidates: Iterable[Candidate],
    *,
    slot: str = "chat-exploration",
) -> dict | None:
    ordered = list(candidates)
    items = [candidate.prompt_payload() for candidate in ordered]
    if len(items) < 3:
        return None
    first = ordered[0]
    return {
        "slot": slot,
        "page": first.page,
        "role": first.role,
        "theme": first.theme,
        "max_selections": 1,
        "allow_null": True,
        "candidates": items,
    }


def group_for_used(
    used_visual_ids: Iterable[str],
    manifest: Mapping,
) -> list[str]:
    used = set(used_visual_ids)
    return [
        visual["sourceGroup"]
        for visual in manifest.get("visuals", [])
        if visual.get("id") in used and visual.get("sourceGroup")
    ]


def original_paths_for_used(
    used_visual_ids: Iterable[str],
    manifest: Mapping,
) -> set[str]:
    used = set(used_visual_ids)
    return {
        visual["originalPath"]
        for visual in manifest.get("visuals", [])
        if visual.get("id") in used and visual.get("originalPath")
    }


def _valid_candidate(
    candidate: Candidate,
    *,
    page: str,
    role: str,
    theme: str,
    used_visual_ids: set[str],
    used_source_groups: set[str],
    used_paths: set[str],
    root: str | Path | None,
) -> tuple[bool, str]:
    visual = candidate.visual
    if candidate.page != page or candidate.role != role or candidate.theme != theme:
        return False, "wrong_page_role_or_theme"
    if visual.get("status") != "deployed" or not visual.get("deploy"):
        return False, "not_deployed"
    if page not in visual.get("intendedPage", []) or role not in visual.get("visualRole", []):
        return False, "wrong_page_or_role"
    if theme not in visual.get("themeCompatibility", []):
        return False, "theme_incompatible"
    if candidate.id in used_visual_ids:
        return False, "duplicate_visual"
    if visual.get("sourceGroup") in used_source_groups:
        return False, "duplicate_source_group"
    if visual.get("originalPath") in used_paths:
        return False, "duplicate_source"
    if not runtime_exists(candidate, root):
        return False, "missing_runtime"
    if not VISUAL_ID.fullmatch(candidate.id):
        return False, "invalid_id"
    return True, "ok"


def validate_selection(
    value: object,
    candidates: Iterable[Candidate],
    *,
    theme: str,
    page: str = "explore",
    role: str = "card-thumbnail",
    used_visual_ids: Iterable[str] = (),
    used_source_groups: Iterable[str] = (),
    used_original_paths: Iterable[str] = (),
    root: str | Path | None = None,
    malformed: bool = False,
) -> Decision:
    """Strict gate. Invalid or duplicate suggestions fall back locally.

    A literal null/omission is respected as "no image". Malformed JSON field
    types, unknown IDs, wrong-role/theme candidates, duplicates and missing
    runtime files use the first legal local candidate instead.
    """
    items = list(candidates)
    visible = set(used_visual_ids)
    groups = set(used_source_groups)
    paths = set(used_original_paths) | {
        candidate.visual["originalPath"] for candidate in items if candidate.id in visible
    }

    def fallback(reason: str) -> Decision:
        for candidate in items:
            valid, _ = _valid_candidate(
                candidate,
                page=page,
                role=role,
                theme=theme,
                used_visual_ids=visible,
                used_source_groups=groups,
                used_paths=paths,
                root=root,
            )
            if valid:
                return Decision(candidate.id, "fallback", reason)
        return Decision(None, "none", reason)

    if malformed:
        return fallback("invalid_format")
    if value is None:
        return Decision(None, "none", "model_null")
    if not isinstance(value, str):
        return fallback("invalid_format")
    selected = value.strip()
    if not selected:
        return fallback("invalid_format")
    chosen = next((candidate for candidate in items if candidate.id == selected), None)
    if chosen is None:
        return fallback("unknown_id")
    valid, reason = _valid_candidate(
        chosen,
        page=page,
        role=role,
        theme=theme,
        used_visual_ids=visible,
        used_source_groups=groups,
        used_paths=paths,
        root=root,
    )
    if not valid:
        return fallback(reason)
    return Decision(chosen.id, "selected", "ok")


def visual_context_for_chat(
    *,
    user_theme: str,
    message: str,
    context: Mapping | None,
    visible_visual_ids: Iterable[str] = (),
    root: str | Path | None = None,
) -> tuple[list[Candidate], dict | None]:
    """Build the optional dynamic-visual slot for a user exploration turn.

    Missing exploration context and themes without at least three legal
    candidates remain text-only. No model call is made here.
    """
    if not context:
        return [], None
    if not (
        context.get("confirmed_card")
        or context.get("current_phase")
        or context.get("initial_snapshot")
    ):
        return [], None
    if len(message.strip()) < 4:
        return [], None
    theme = user_theme if user_theme in THEMES else "light"
    manifest = load_manifest(root)
    ids = list(dict.fromkeys(str(item) for item in visible_visual_ids if isinstance(item, str)))
    groups = group_for_used(ids, manifest)
    paths = original_paths_for_used(ids, manifest)
    candidates = candidate_pool(
        theme=theme,
        page="explore",
        role="card-thumbnail",
        message=message,
        used_visual_ids=ids,
        used_source_groups=groups,
        used_original_paths=paths,
        root=root,
        manifest=manifest,
    )
    return candidates, selection_payload(candidates)


def parse_visual_output(data):
    """Malformed optional image metadata must not discard a usable reply."""
    from .schemas import AIOutput

    invalid = False
    if isinstance(data, dict) and "visual_id" in data:
        value = data.get("visual_id")
        invalid = value is not None and (not isinstance(value, str) or not value.strip())
        if invalid:
            data = {**data, "visual_id": None}
    result = AIOutput.model_validate(data)
    result._visual_selection_invalid = invalid
    return result
