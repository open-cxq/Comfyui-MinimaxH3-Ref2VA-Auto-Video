# -*- coding: utf-8 -*-
"""Normalize / merge board edits for 剧本预览与编辑."""
from __future__ import annotations

import json
import math
import os
import re
from typing import Any

from .h3_parse import extract_json, extract_shot_text


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    # Some models return {"1": {...}, "2": {...}} instead of a list.
    if isinstance(value, dict):
        items = []
        for key in sorted(value.keys(), key=lambda k: (str(k).isdigit(), str(k))):
            item = value[key]
            if isinstance(item, dict):
                if "id" not in item and str(key).isdigit():
                    item = {**item, "id": int(key)}
                items.append(item)
        return items
    return []


def _clean_asset_item(item: Any, index: int) -> dict | None:
    if not isinstance(item, dict):
        return None
    row = {
        "id": int(item.get("id") or index),
        "name": str(item.get("name") or "").strip(),
        "desc": str(item.get("desc") or "").strip(),
        "gen_prompt": str(item.get("gen_prompt") or "").strip(),
        "bing_image_path": str(
            item.get("bing_image_path") or item.get("image_path") or ""
        ).strip(),
        "bing_audio_path": str(
            item.get("bing_audio_path") or item.get("audio_path") or ""
        ).strip(),
    }
    if "need_three_view" in item:
        row["need_three_view"] = bool(item.get("need_three_view"))
    return row


def _clean_appear(appear: Any) -> dict:
    appear = _as_dict(appear)
    out = {"roles": [], "prop": [], "scene": []}
    for key in out:
        ids = []
        for val in _as_list(appear.get(key)):
            try:
                ids.append(int(val if not isinstance(val, dict) else val.get("id")))
            except (TypeError, ValueError):
                continue
        out[key] = ids
    return out


def _clean_shot(item: Any, index: int) -> dict | None:
    if not isinstance(item, dict):
        return None
    try:
        duration = int(item.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0
    sid = int(item.get("id") or (index + 1))
    full = extract_shot_text(item.get("shot") or "")
    if not full:
        leftover = str(item.get("shot_body") or "").strip()
        if leftover:
            full = extract_shot_text("detailed_description:\n[Shot %d] %s" % (sid, leftover))
    try:
        film_in = float(item.get("film_in") or 0)
    except (TypeError, ValueError):
        film_in = 0.0
    try:
        film_out = float(item.get("film_out") or 0)
    except (TypeError, ValueError):
        film_out = 0.0
    try:
        film_rank = int(item.get("film_rank"))
    except (TypeError, ValueError):
        film_rank = index
    enabled = item.get("film_enabled")
    if enabled is None:
        enabled = True
    prev_video = str(item.get("prev_video_path") or "").strip()
    # 仅本集第一位可带「上集/上一镜」续写视频；后续镜用上一镜 video_path
    if index != 0:
        prev_video = ""
    is_first = bool(index == 0 and not prev_video)
    return {
        "id": sid,
        "shot": full,
        "is_first_shots": is_first,
        "pre_last_frame_path": str(
            item.get("pre_last_frame_path")
            or item.get("prev_last_frame_path")
            or ""
        ).strip(),
        "first_frame_path": str(item.get("first_frame_path") or "").strip(),
        "video_path": str(item.get("video_path") or "").strip(),
        "prev_video_path": prev_video,
        "duration": max(1, duration) if duration > 0 else 5,
        "appear": _clean_appear(item.get("appear")),
        "film_enabled": bool(enabled),
        "film_in": max(0.0, film_in),
        "film_out": max(0.0, film_out),
        "film_rank": film_rank,
    }


def empty_board_asset() -> dict:
    return {
        "script": "",
        "script_name": "",
        "duration": 10,
        "width": 864,
        "height": 480,
        "shots_prompt": "",
        "film_path": "",
        "metadata_file": "",
        "global": {
            "roles": [],
            "prop": [],
            "scene": [],
            "background_audio": "",
            "background_audio_volume": 1.0,
            "film_playback_rate": 1.0,
            "bgm_follow_speed": False,
            "global_prompt": "",
        },
        "shots_info": [],
    }


def parse_board_json(text: Any) -> dict:
    if isinstance(text, dict):
        data = text
    else:
        raw = str(text or "").strip()
        if not raw:
            return empty_board_asset()
        try:
            data = extract_json(raw)
        except RuntimeError:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise RuntimeError("分镜资产结果JSON 无效：%s" % exc) from exc
    if isinstance(data, list):
        data = next((x for x in data if isinstance(x, dict)), {})
    if not isinstance(data, dict):
        raise RuntimeError("分镜资产结果JSON 无效。")
    return normalize_board_asset(data)


def normalize_board_asset(data: dict) -> dict:
    base = empty_board_asset()
    g_in = _as_dict(data.get("global"))
    # Fallbacks when models put assets at top-level.
    if not any(_as_list(g_in.get(k)) for k in ("roles", "prop", "scene")):
        for key in ("roles", "prop", "scene"):
            if key in data and key not in g_in:
                g_in[key] = data.get(key)

    g = base["global"]
    for key in ("roles", "prop", "scene"):
        cleaned = []
        for i, item in enumerate(_as_list(g_in.get(key)), start=1):
            row = _clean_asset_item(item, i)
            if row:
                cleaned.append(row)
        g[key] = cleaned
    g["background_audio"] = str(
        g_in.get("background_audio") or data.get("background_audio") or ""
    ).strip()
    try:
        bgm_vol = float(g_in.get("background_audio_volume", 1.0))
    except (TypeError, ValueError):
        bgm_vol = 1.0
    g["background_audio_volume"] = min(2.0, max(0.0, bgm_vol))
    try:
        play_rate = float(g_in.get("film_playback_rate", 1.0))
    except (TypeError, ValueError):
        play_rate = 1.0
    if not math.isfinite(play_rate) or play_rate <= 0:
        play_rate = 1.0
    g["film_playback_rate"] = min(4.0, max(0.25, play_rate))
    g["bgm_follow_speed"] = bool(g_in.get("bgm_follow_speed", False))
    g["global_prompt"] = str(
        g_in.get("global_prompt") or data.get("global_prompt") or ""
    ).strip()

    try:
        duration = int(data.get("duration") or base["duration"])
    except (TypeError, ValueError):
        duration = base["duration"]
    try:
        width = int(data.get("width") or data.get("with") or base["width"])
    except (TypeError, ValueError):
        width = base["width"]
    try:
        height = int(data.get("height") or base["height"])
    except (TypeError, ValueError):
        height = base["height"]

    shots = []
    seen = set()
    for i, item in enumerate(_as_list(data.get("shots_info"))):
        row = _clean_shot(item, i)
        if not row:
            continue
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        shots.append(row)
    for i, shot in enumerate(shots):
        shot["id"] = i + 1
        if i != 0:
            shot["prev_video_path"] = ""
        shot["is_first_shots"] = bool(i == 0 and not str(shot.get("prev_video_path") or "").strip())

    meta_file = str(
        data.get("metadata_file") or data.get("matedata_file") or ""
    ).strip()
    out = {
        "script": str(data.get("script") or ""),
        "script_name": str(data.get("script_name") or "").strip(),
        "duration": max(1, duration),
        "width": max(32, width),
        "height": max(32, height),
        "shots_prompt": str(data.get("shots_prompt") or "").strip(),
        "film_path": str(data.get("film_path") or "").strip(),
        "metadata_file": meta_file,
        "global": g,
        "shots_info": shots,
    }
    return out


def finalize_script_convert(
    data: Any,
    raw_script: str = "",
    width: int = 864,
    height: int = 480,
    bg_path: str = "",
    three_view_prompt: str = "",
) -> dict:
    """把 LLM 转换结果规范成看板可用的分镜资产 JSON。"""
    from .h3_parse import (
        finalize_global_assets,
        build_shot_prompt,
        coerce_global_prompt,
        ensure_continuation,
        extract_shot_text,
        subject_block_for_shot,
        _detailed_body,
    )

    if isinstance(data, str):
        data = extract_json(data)
    if isinstance(data, list):
        data = next((x for x in data if isinstance(x, dict)), {})
    if not isinstance(data, dict):
        raise RuntimeError("剧本转换结果无效：需要 JSON 对象。")

    try:
        w = int(data.get("width") or data.get("with") or width or 864)
    except (TypeError, ValueError):
        w = int(width or 864)
    try:
        h = int(data.get("height") or height or 480)
    except (TypeError, ValueError):
        h = int(height or 480)
    data["width"] = max(32, w)
    data.pop("with", None)
    data["height"] = max(32, h)

    if not str(data.get("script") or "").strip():
        data["script"] = str(raw_script or "").strip()[:4000]

    g = _as_dict(data.get("global"))
    if bg_path and not str(g.get("background_audio") or "").strip():
        g["background_audio"] = str(bg_path).strip()
    g["global_prompt"] = coerce_global_prompt(
        g.get("global_prompt") or data.get("global_prompt") or "",
        raw_script=raw_script,
        forbid_bgm=bool(str(g.get("background_audio") or "").strip() or bg_path),
    )
    data["global"] = g

    board = normalize_board_asset(data)
    g_board = board.get("global") if isinstance(board.get("global"), dict) else {}
    finalize_global_assets(g_board, three_view_prompt)
    board["global"] = g_board
    shots = board.get("shots_info") or []
    total = 0
    for i, item in enumerate(shots):
        sid = int(item.get("id") or (i + 1))
        item["id"] = sid
        item["is_first_shots"] = bool(i == 0)
        if i != 0:
            item["prev_video_path"] = ""
        raw_shot = str(item.get("shot") or "")
        bare = _detailed_body(raw_shot, sid) or extract_shot_text(raw_shot) or raw_shot
        # _detailed_body 可能仍带 subject 头；再剥一次 detailed
        if "detailed_description:" in bare.lower():
            bare = _detailed_body("detailed_description:\n" + bare, sid) or bare
        appear = _clean_appear(item.get("appear"))
        subject_block, appear, last_n = subject_block_for_shot(
            board, appear, item["is_first_shots"]
        )
        item["appear"] = appear
        body = bare.strip()
        if not re.match(r"(?is)^\[Shot\s+\d+\]", body):
            body = "[Shot %d] %s" % (sid, body)
        shot_text = build_shot_prompt(subject_block, body, item["is_first_shots"])
        shot_text = ensure_continuation(shot_text, item["is_first_shots"], last_n)
        item["shot"] = extract_shot_text(shot_text)
        try:
            dur = int(item.get("duration") or 0)
        except (TypeError, ValueError):
            dur = 0
        if dur <= 0:
            dur = 5
        item["duration"] = max(1, dur)
        total += item["duration"]
    if total > 0:
        board["duration"] = total
    elif not board.get("duration"):
        board["duration"] = max(1, int(data.get("duration") or 10))
    board["shots_info"] = shots
    return board


def script_fingerprint(data: dict) -> str:
    """Identify a board payload by script name + body for stale-media checks."""
    if not isinstance(data, dict):
        return ""
    name = str(data.get("script_name") or "").strip()
    body = str(data.get("script") or "").strip()
    return name + "\n" + body


def _force_non_diegetic_music_na(text: str) -> str:
    raw = str(text or "").strip()
    raw = re.sub(
        r"(?is)(?:^|\n)non_diegetic_music\s*:[\s\S]*?(?=(?:\n(?:overall_soundscape|subject_definitions|detailed_description)\s*:)|\Z)",
        "\n",
        raw,
    ).strip()
    raw = re.sub(r"\n{3,}", "\n\n", raw).strip()
    if not re.search(r"(?im)^overall_soundscape\s*:", raw):
        raw = (
            (raw + "\n\n" if raw else "")
            + "overall_soundscape:\nAmbient environmental sound continues throughout."
        )
    return (raw + "\n\nnon_diegetic_music:\nN/A").strip()


def sanitize_background_audio(data: dict) -> dict:
    """Drop background_audio when the path is empty or the file is gone.

    When a valid custom BGM path remains, force global_prompt.non_diegetic_music to N/A
    so video generation does not invent a score.
    """
    if not isinstance(data, dict):
        return data
    g = data.get("global")
    if not isinstance(g, dict):
        return data
    bg = str(g.get("background_audio") or "").strip()
    if not bg or not os.path.isfile(bg):
        g["background_audio"] = ""
    else:
        g["background_audio"] = bg
        g["global_prompt"] = _force_non_diegetic_music_na(g.get("global_prompt") or "")
    return data


def apply_incoming_bgm_policy(current: dict, incoming: dict) -> dict:
    """When upstream script changes, do not keep the previous board BGM."""
    if not isinstance(current, dict):
        return current
    if not isinstance(incoming, dict):
        return current
    if script_fingerprint(current) == script_fingerprint(incoming):
        return current
    g = current.setdefault("global", {})
    if not isinstance(g, dict):
        current["global"] = {}
        g = current["global"]
    inc_g = incoming.get("global") if isinstance(incoming.get("global"), dict) else {}
    bg = str((inc_g or {}).get("background_audio") or incoming.get("background_audio") or "").strip()
    g["background_audio"] = bg
    return sanitize_background_audio(current)


def dumps_board(data: dict) -> str:
    return json.dumps(normalize_board_asset(data), ensure_ascii=False, indent=2)


def allowed_media_roots() -> list[str]:
    import folder_paths
    from .h3_json_io import input_root, output_root

    roots = [
        os.path.abspath(input_root()),
        os.path.abspath(output_root()),
        os.path.abspath(folder_paths.get_input_directory()),
        os.path.abspath(folder_paths.get_output_directory()),
        os.path.abspath(folder_paths.get_temp_directory()),
    ]
    # Legacy plugin folders (read-only compatibility for old JSON paths).
    for legacy in (
        os.path.join(folder_paths.get_input_directory(), "minimax_h3_ref2va"),
        os.path.join(folder_paths.get_temp_directory(), "minimax_h3_ref2va"),
    ):
        if os.path.isdir(legacy):
            roots.append(os.path.abspath(legacy))
    return roots


def is_allowed_media_path(path: str) -> bool:
    if not path:
        return False
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return False
    for root in allowed_media_roots():
        try:
            if os.path.commonpath([abs_path, root]) == root:
                return True
        except ValueError:
            continue
    return False
