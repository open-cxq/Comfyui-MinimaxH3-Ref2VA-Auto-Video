# -*- coding: utf-8 -*-
"""Parse LLM JSON / H3 Ref2VA prompt sections into shot assets."""
from __future__ import annotations

import ast
import json
import os
import re

CONTINUATION_PREFIX = "（This shot must strictly inherit the last frame state of the previous segment）"
LAST_FRAME_TMPL = (
    "<Subject {n}> is the last frame from the previous video clip in <Picture {n}>, "
    "which serves as the starting point for this scene."
)
SECTION_KEYS = (
    "subject_definitions",
    "summary",
    "retention_analysis",
    "detailed_description",
    "overall_soundscape",
    "non_diegetic_music",
)


def _escape_raw_controls_in_strings(blob: str) -> str:
    """Escape literal newlines/tabs/controls that appear inside JSON string literals.

    Models sometimes emit real line breaks instead of \\n, which breaks json.loads.
    """
    out = []
    in_string = False
    escape = False
    for ch in blob or "":
        if not in_string:
            out.append(ch)
            if ch == '"':
                in_string = True
            continue
        if escape:
            out.append(ch)
            escape = False
            continue
        if ch == "\\":
            out.append(ch)
            escape = True
            continue
        if ch == '"':
            out.append(ch)
            in_string = False
            continue
        if ch == "\n":
            out.append("\\n")
            continue
        if ch == "\r":
            out.append("\\r")
            continue
        if ch == "\t":
            out.append("\\t")
            continue
        code = ord(ch)
        if code < 0x20:
            out.append("\\u%04x" % code)
            continue
        out.append(ch)
    return "".join(out)


def _balance_json_brackets(blob: str) -> str:
    """Append missing } / ] after a truncated JSON object/array. Does not invent values."""
    text = blob or ""
    stack = []
    in_string = False
    escape = False
    for ch in text:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if stack and stack[-1] == ch:
                stack.pop()
    if in_string:
        text += '"'
    # Drop dangling comma before we close.
    text = re.sub(r",\s*$", "", text.rstrip())
    if stack:
        text += "".join(reversed(stack))
    return text


def _loads_loose(blob):
    blob = (blob or "").replace("\ufeff", "").strip()
    attempts = [blob]
    escaped = _escape_raw_controls_in_strings(blob)
    if escaped != blob:
        attempts.append(escaped)
    for candidate in list(attempts):
        repaired = re.sub(r",\s*}", "}", candidate)
        repaired = re.sub(r",\s*]", "]", repaired)
        if repaired != candidate:
            attempts.append(repaired)
        balanced = _balance_json_brackets(repaired if repaired != candidate else candidate)
        if balanced not in attempts:
            attempts.append(balanced)

    last_err = None
    seen = set()
    for candidate in attempts:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_err = exc
        try:
            return ast.literal_eval(candidate)
        except (ValueError, SyntaxError, MemoryError) as exc:
            last_err = exc
    raise RuntimeError("无法解析 JSON：%s" % (blob[:200] if blob else last_err))


def extract_json(text):
    raw = (text or "").strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fence:
        raw = fence.group(1).strip()
    # Prefer array then object, so [{"duration":45,...}] is kept as a list.
    candidates = []
    for left, right in (("[", "]"), ("{", "}")):
        start = raw.find(left)
        end = raw.rfind(right)
        if start >= 0 and end > start:
            candidates.append(raw[start:end + 1])
        elif start >= 0:
            # Truncated: take from first bracket to end and let balancer close it.
            candidates.append(raw[start:])
    if not candidates:
        raise RuntimeError("LLM 未返回 JSON：%s" % (text or "")[:200])
    last_err = None
    for blob in candidates:
        try:
            return _loads_loose(blob)
        except RuntimeError as exc:
            last_err = exc
    raise last_err or RuntimeError("LLM 未返回 JSON：%s" % (text or "")[:200])


def _shot_lines(shots):
    lines = []
    for i, shot in enumerate(shots or [], start=1):
        if not isinstance(shot, dict):
            lines.append("分镜%d：%s" % (i, shot))
            continue
        length = shot.get("length") or shot.get("duration") or ""
        head = "分镜%d" % i
        if length != "":
            head += "（%s秒）" % length
        parts = [head]
        for key, label in (
            ("description", "画面"),
            ("dialogue", "台词"),
            ("sound", "音效"),
            ("camera_move", "运镜"),
            ("frame", "景别"),
        ):
            val = str(shot.get(key) or "").strip()
            if val:
                parts.append("%s：%s" % (label, val))
        lines.append("\n".join(parts))
    return lines


def _max_timecode_seconds(script_text):
    """Best-effort end second from script timecodes like 40-45秒 / 0–5秒｜ / 45秒."""
    text = script_text or ""
    ends = []
    for m in re.finditer(
        r"(\d+)\s*[-–—~～到至]\s*(\d+)\s*秒?",
        text,
    ):
        ends.append(int(m.group(2)))
    for m in re.finditer(r"(?<!\d)(\d{1,3})\s*秒", text):
        ends.append(int(m.group(1)))
    return max(ends) if ends else 0


def script_complete_result(data, fallback_duration, recommend):
    """Normalize LLM script-complete payload into (script_text, final_duration)."""
    obj = data
    if isinstance(obj, list):
        obj = next((x for x in obj if isinstance(x, dict)), {})
    if not isinstance(obj, dict):
        raise RuntimeError("剧本补全返回格式无效。")

    duration = obj.get("duration")
    script = obj.get("script")
    shots = obj.get("shots")
    nested_duration = None

    # Nested payload stuffed into script as JSON/list text.
    if isinstance(script, str):
        nested = script.strip()
        if nested.startswith("{") or nested.startswith("["):
            try:
                inner = extract_json(nested)
                if isinstance(inner, list):
                    inner = next((x for x in inner if isinstance(x, dict)), {})
                if isinstance(inner, dict):
                    if inner.get("duration") not in (None, ""):
                        nested_duration = inner.get("duration")
                    if duration in (None, "", 0):
                        duration = inner.get("duration")
                    if not shots:
                        shots = inner.get("shots")
                    if inner.get("script"):
                        script = inner.get("script")
                    elif shots or inner.get("title") or nested_duration is not None:
                        obj = {**obj, **{k: v for k, v in inner.items() if k != "script"}}
                        script = None
            except RuntimeError:
                pass
    elif isinstance(script, (dict, list)):
        nested = script
        if isinstance(nested, list):
            nested = next((x for x in nested if isinstance(x, dict)), {})
        if isinstance(nested, dict):
            if nested.get("duration") not in (None, ""):
                nested_duration = nested.get("duration")
            if duration in (None, "", 0):
                duration = nested.get("duration")
            if not shots:
                shots = nested.get("shots")
            script = nested.get("script")
            obj = {**obj, **{k: v for k, v in nested.items() if k != "script"}}

    if not isinstance(script, str) or not script.strip():
        parts = []
        title = str(obj.get("title") or "").strip()
        style = str(obj.get("style") or "").strip()
        if title:
            parts.append("标题：%s" % title)
        if style:
            parts.append("风格：%s" % style)
        shown_duration = nested_duration if nested_duration not in (None, "") else duration
        if shown_duration not in (None, ""):
            parts.append("总时长：%s秒" % shown_duration)
        parts.extend(_shot_lines(shots if isinstance(shots, list) else []))
        script = "\n\n".join(parts).strip()
    else:
        script = script.strip()

    if not script:
        raise RuntimeError("剧本补全未返回可用剧本。")

    # Reject empty shells like "总时长：10秒" with no real story.
    plain = re.sub(r"\s+", "", script)
    plain = re.sub(r"总时长[:：]?\d+秒?", "", plain)
    if len(plain) < 40:
        raise RuntimeError(
            "剧本补全返回内容过短或为空壳。请重试；短标题输入应生成完整可拍剧情。"
        )

    shot_sum = 0
    if isinstance(shots, list):
        for shot in shots:
            if isinstance(shot, dict):
                try:
                    shot_sum += int(shot.get("length") or shot.get("duration") or 0)
                except (TypeError, ValueError):
                    pass

    script_end = _max_timecode_seconds(script)

    if recommend:
        candidates = []
        for value in (nested_duration, duration, shot_sum, script_end):
            try:
                n = int(value)
            except (TypeError, ValueError):
                continue
            if n > 0:
                candidates.append(n)
        final_duration = max(candidates) if candidates else int(fallback_duration)
        # If model clearly anchored to the form duration while script time codes
        # imply a longer piece, prefer the script-derived end.
        try:
            model_duration = int(duration)
        except (TypeError, ValueError):
            model_duration = 0
        if (
            model_duration > 0
            and model_duration == int(fallback_duration)
            and script_end > model_duration
        ):
            final_duration = script_end
    else:
        final_duration = int(fallback_duration)

    return script, max(1, final_duration)


def load_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_knowledge_dir(kb_dir):
    root = os.path.abspath(str(kb_dir or ""))
    if not os.path.isdir(root):
        raise RuntimeError("未找到 knowledge 目录: %s" % root)
    parts = []
    for name in sorted(os.listdir(root)):
        if name.startswith("."):
            continue
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        parts.append("# " + name + "\n" + load_text(path))
    if not parts:
        raise RuntimeError("knowledge 目录为空: %s" % root)
    return "\n\n".join(parts)


def appear_from_shot_text(asset, body):
    """Match shot text to existing asset names; fallback to all assets."""
    text = (body or "")
    text_l = text.lower()
    g = asset.get("global") if isinstance(asset.get("global"), dict) else {}
    appear = {"roles": [], "prop": [], "scene": []}
    for key in ("roles", "prop", "scene"):
        for item in g.get(key) or []:
            if not isinstance(item, dict) or "id" not in item:
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            if name in text or name.lower() in text_l:
                appear[key].append(int(item["id"]))
    if not any(appear.values()):
        appear = {
            "roles": [int(r["id"]) for r in g.get("roles") or [] if isinstance(r, dict) and "id" in r],
            "prop": [int(p["id"]) for p in g.get("prop") or [] if isinstance(p, dict) and "id" in p],
            "scene": [int(s["id"]) for s in g.get("scene") or [] if isinstance(s, dict) and "id" in s],
        }
    return appear


def asset_brief_for_shot_llm(asset):
    """Compact asset for shot-split LLM: no script dump, no file paths."""
    g = asset.get("global") if isinstance(asset.get("global"), dict) else {}

    def items(key):
        out = []
        for item in g.get(key) or []:
            if not isinstance(item, dict):
                continue
            out.append({
                "id": item.get("id"),
                "name": item.get("name") or "",
                "desc": item.get("desc") or "",
            })
        return out

    return {
        "script_name": str(asset.get("script_name") or "").strip(),
        "duration": int(asset.get("duration") or 10),
        "roles": items("roles"),
        "prop": items("prop"),
        "scene": items("scene"),
        "has_background_audio": bool(str(g.get("background_audio") or "").strip()),
    }


def strip_code_fences(text):
    """Remove markdown wrappers the model sometimes wraps around Ref2VA text."""
    raw = str(text or "").strip()
    if not raw:
        return ""
    # Prefer fenced body: ```text ... ``` / ``` ... ```
    m = re.search(r"```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```", raw)
    if m:
        raw = m.group(1).strip()
    else:
        # Unclosed trailing fence: ...text\n```
        raw = re.sub(r"^```(?:[a-zA-Z0-9_-]+)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
    # Drop leading markdown titles like **Ref2VA**
    raw = re.sub(r"^\*\*[^*]+\*\*\s*", "", raw).strip()
    # Any leftover fence markers inside section text
    raw = re.sub(r"```+", "", raw).strip()
    return raw


def split_sections(prompt_text):
    text = strip_code_fences(prompt_text)
    found = []
    for key in SECTION_KEYS:
        m = re.search(r"(?im)^%s\s*:" % re.escape(key), text)
        if m:
            found.append((m.start(), key, m.end()))
    found.sort()
    out = {k: "" for k in SECTION_KEYS}
    for i, (_, key, body_start) in enumerate(found):
        body_end = found[i + 1][0] if i + 1 < len(found) else len(text)
        out[key] = strip_code_fences(text[body_start:body_end])
    return out


def parse_shot_blocks(detailed):
    chunks = re.split(r"\[Shot\s+(\d+)\]", detailed or "", flags=re.IGNORECASE)
    shots = []
    if len(chunks) < 3:
        return shots
    intro = chunks[0]
    for i in range(1, len(chunks), 2):
        sid = int(chunks[i])
        body = chunks[i + 1].strip() if i + 1 < len(chunks) else ""
        # Skip empty / section-header-only bodies that are not real shots.
        if not body or re.match(
            r"(?is)^(overall_soundscape|non_diegetic_music|subject_definitions|detailed_description)\s*:",
            body,
        ):
            continue
        start = 0.0
        tm = re.match(r"(?is)^At\s+(\d{2}):(\d{2})(?:\.(\d+))?", body)
        if tm:
            start = int(tm.group(1)) * 60 + int(tm.group(2)) + int((tm.group(3) or "0")[:3].ljust(3, "0")) / 1000.0
        elif shots:
            start = None
        shots.append({"id": sid, "body": body, "start": start, "intro": intro if sid == 1 else ""})
    # Keep first occurrence per shot id; renumber gaps later in fill_shots_info.
    deduped = []
    seen = set()
    for shot in shots:
        if shot["id"] in seen:
            continue
        seen.add(shot["id"])
        deduped.append(shot)
    return deduped


def _ids(seq):
    out = []
    for item in seq or []:
        if isinstance(item, dict) and "id" in item:
            out.append(int(item["id"]))
        elif isinstance(item, int):
            out.append(item)
    return out


def global_prompt_text(sections, forbid_bgm):
    sound = strip_code_fences(sections.get("overall_soundscape") or "") or (
        "Ambient environmental sound continues throughout."
    )
    music = strip_code_fences(sections.get("non_diegetic_music") or "")
    if forbid_bgm:
        music = "N/A"
    return (
        "overall_soundscape:\n%s\n\nnon_diegetic_music:\n%s"
        % (sound, music)
    )


_MUSIC_PLACEHOLDER = re.compile(r"(?is)^\s*(?:music\s*=\s*)?N/?A\s*$")


def _is_music_placeholder(text):
    return not str(text or "").strip() or bool(_MUSIC_PLACEHOLDER.match(str(text or "").strip()))


def coerce_global_prompt(llm_text, raw_script="", forbid_bgm=False):
    """Build overall_soundscape + non_diegetic_music. Recover from source H3 script.

    Uploading no BGM is not the same as no score: keep source music unless forbid_bgm.
    Reject LLM shortcuts such as `music=N/A`.
    """
    llm_sec = split_sections(llm_text or "")
    src_sec = split_sections(raw_script or "")
    whole = str(llm_text or "").strip()
    sound = strip_code_fences(llm_sec.get("overall_soundscape") or "").strip()
    music = strip_code_fences(llm_sec.get("non_diegetic_music") or "").strip()
    src_sound = strip_code_fences(src_sec.get("overall_soundscape") or "").strip()
    src_music = strip_code_fences(src_sec.get("non_diegetic_music") or "").strip()

    if _is_music_placeholder(whole) or not re.search(
        r"(?im)^(?:overall_soundscape|non_diegetic_music)\s*:", whole
    ):
        if src_sound:
            sound = src_sound
        if src_music:
            music = src_music
    else:
        if not sound and src_sound:
            sound = src_sound
        if _is_music_placeholder(music) and src_music and not _is_music_placeholder(src_music):
            music = src_music

    if not sound and src_sound:
        sound = src_sound
    if _is_music_placeholder(music) and src_music and not _is_music_placeholder(src_music):
        music = src_music

    return global_prompt_text(
        {"overall_soundscape": sound, "non_diegetic_music": music},
        forbid_bgm,
    )


def last_frame_line(n):
    return LAST_FRAME_TMPL.format(n=n)


_ANIMAL_HINT = re.compile(
    r"(狗|猫|犬|鸟|马|动物|dog|cat|puppy|kitten|animal|retriever|samoyed|wolf)",
    re.I,
)


def _identity_for_subject(item, fallback):
    """Subject line identity: asset name only (never appearance desc)."""
    name = str((item or {}).get("name") or "").strip()
    return name or fallback


def _role_kind_label(item):
    blob = " ".join(
        str((item or {}).get(k) or "")
        for k in ("name", "desc", "gen_prompt")
    )
    if _ANIMAL_HINT.search(blob):
        if re.search(r"(狗|犬|dog|puppy|retriever|samoyed)", blob, re.I):
            return "dog"
        return "animal"
    return "person"


def subject_block_for_shot(asset, appear, is_first):
    roles = {int(r["id"]): r for r in (asset.get("global") or {}).get("roles") or [] if "id" in r}
    props = {int(p["id"]): p for p in (asset.get("global") or {}).get("prop") or [] if "id" in p}
    scenes = {int(s["id"]): s for s in (asset.get("global") or {}).get("scene") or [] if "id" in s}
    appear = appear or {}
    lines = []
    n = 1
    mapping = {"roles": [], "prop": [], "scene": []}
    for rid in _ids(appear.get("roles")):
        item = roles.get(rid) or {"name": "role %d" % rid, "desc": ""}
        identity = _identity_for_subject(item, "character")
        kind = _role_kind_label(item)
        lines.append(
            "<Subject %d> is the %s in <Picture %d> %s."
            % (n, kind, n, identity)
        )
        mapping["roles"].append(rid)
        n += 1
    for pid in _ids(appear.get("prop")):
        item = props.get(pid) or {"name": "prop %d" % pid, "desc": ""}
        identity = _identity_for_subject(item, "prop")
        lines.append(
            "<Subject %d> is the prop in <Picture %d> %s."
            % (n, n, identity)
        )
        mapping["prop"].append(pid)
        n += 1
    for sid in _ids(appear.get("scene")):
        item = scenes.get(sid) or {"name": "scene %d" % sid, "desc": ""}
        identity = _identity_for_subject(item, "scene")
        lines.append(
            "<Subject %d> is the scene in <Picture %d> %s."
            % (n, n, identity)
        )
        mapping["scene"].append(sid)
        n += 1
    if not is_first:
        lines.append(last_frame_line(n))
    return "subject_definitions:\n" + "\n".join(lines), mapping, n if not is_first else None


def build_shot_prompt(subject_block, shot_body, is_first):
    parts = [subject_block.strip(), ""]
    if not is_first:
        parts.append(CONTINUATION_PREFIX)
        parts.append("")
    parts.append("detailed_description:")
    parts.append(shot_body.strip())
    return "\n".join(p for p in parts if p is not None).strip()


def extract_shot_text(text):
    """Keep subject_definitions + detailed_description; drop soundscape/music."""
    raw = str(text or "").strip()
    if not raw:
        return ""
    sections = split_sections(raw)
    subj = (sections.get("subject_definitions") or "").strip()
    det = (sections.get("detailed_description") or "").strip()
    parts = []
    if subj:
        parts.append("subject_definitions:\n" + subj)
    if det:
        parts.append("detailed_description:\n" + det)
    if parts:
        return "\n\n".join(parts)
    stripped = re.sub(
        r"(?is)^(?:overall_soundscape|non_diegetic_music)\s*:[\s\S]*?(?=^(?:subject_definitions|detailed_description)\s*:|\Z)",
        "",
        raw,
        flags=re.M,
    ).strip()
    return stripped


def _detailed_body(text, sid):
    raw = str(text or "").strip()
    if not raw:
        return ""
    sections = split_sections(raw)
    det = (sections.get("detailed_description") or "").strip() or raw
    m = re.search(r"\[Shot\s+%d\]\s*([\s\S]*)" % int(sid or 1), det, flags=re.I)
    if m:
        det = m.group(1).strip()
    if re.match(r"(?is)^(overall_soundscape|non_diegetic_music|subject_definitions)\s*:", det):
        parts = re.split(r"\[Shot\s+\d+\]", det, flags=re.I)
        if len(parts) >= 2:
            det = parts[-1].strip()
    return det


def parse_cut_seconds(text):
    raw = str(text or "")
    m = re.search(r"(?is)\bAt\s+(\d{1,2}):(\d{2})(?:\.(\d+))?", raw)
    if m:
        frac = int((m.group(3) or "0")[:3].ljust(3, "0")) / 1000.0
        return int(m.group(1)) * 60 + int(m.group(2)) + frac
    m = re.search(r"(?is)\bAt\s+(\d+(?:\.\d+)?)\s*(?:seconds?|s)\b", raw)
    if m:
        return float(m.group(1))
    return None


def _fit_durations(durs, total):
    total = max(1, int(total))
    n = len(durs)
    if n == 0:
        return []
    durs = [max(1, int(round(float(d)))) for d in durs]
    extra = total - sum(durs)
    i = n - 1
    guard = 0
    while extra != 0 and guard < 10000:
        step = 1 if extra > 0 else -1
        nxt = durs[i] + step
        if nxt >= 1:
            durs[i] = nxt
            extra -= step
        i = (i - 1) % n
        guard += 1
    drift = total - sum(durs)
    durs[-1] += drift
    if durs[-1] < 1:
        need = 1 - durs[-1]
        durs[-1] = 1
        for j in range(n - 2, -1, -1):
            take = min(need, durs[j] - 1)
            if take > 0:
                durs[j] -= take
                need -= take
            if need <= 0:
                break
    return durs


def durations_from_cuts(texts, total):
    n = len(texts)
    if n <= 0:
        return None
    starts = []
    for i, text in enumerate(texts):
        if i == 0:
            starts.append(0.0)
            continue
        t = parse_cut_seconds(text)
        if t is None:
            return None
        starts.append(float(t))
    if any(starts[i] <= starts[i - 1] for i in range(1, n)):
        return None
    if starts[-1] >= float(total):
        return None
    durs = []
    for i, st in enumerate(starts):
        end = float(total) if i == n - 1 else starts[i + 1]
        durs.append(max(1, int(round(end - st))))
    return _fit_durations(durs, total)


def durations_from_script(script, n, total):
    spans = re.findall(
        r"(\d+(?:\.\d+)?)\s*[–—\-至到]\s*(\d+(?:\.\d+)?)\s*秒",
        str(script or ""),
    )
    if len(spans) != n:
        return None
    durs = []
    for a, b in spans:
        durs.append(max(1, int(round(float(b) - float(a)))))
    return _fit_durations(durs, total)


def clamp_shot_durations(shots, total, script=""):
    total = max(1, int(total))
    n = max(1, len(shots))
    if n == 1:
        shots[0]["duration"] = total
        return shots
    texts = [str(s.get("shot") or "") for s in shots]
    durs = durations_from_cuts(texts, total)
    if durs is None:
        durs = durations_from_script(script, n, total)
    if durs is None:
        existing = []
        for s in shots:
            try:
                existing.append(int(round(float(s.get("duration") or 0))))
            except (TypeError, ValueError):
                existing.append(0)
        if existing and all(d > 0 for d in existing) and sum(existing) == total:
            durs = existing
        else:
            base = max(1, total // n)
            durs = _fit_durations([base] * n, total)
    for s, d in zip(shots, durs):
        s["duration"] = max(1, int(d))
    return shots


def ensure_continuation(shot_text, is_first, last_n):
    text = (shot_text or "").strip()
    if is_first:
        return text
    if CONTINUATION_PREFIX not in text:
        text = CONTINUATION_PREFIX + "\n" + text
    needle = last_frame_line(last_n) if last_n else ""
    if needle and needle not in text:
        text = text.replace("subject_definitions:", "subject_definitions:\n" + needle, 1)
        if needle not in text:
            text = needle + "\n" + text
    return text


def _script_name_from_text(script):
    text = str(script or "").strip()
    if not text:
        return ""
    m = re.search(r"[《「『]([^》」』]{1,40})[》」』]", text)
    if m:
        return m.group(1).strip()
    first = re.split(r"[\n。！？!?]", text, maxsplit=1)[0].strip()
    first = re.sub(r"^标题[:：]\s*", "", first)
    if 1 <= len(first) <= 40:
        return first
    return ""


def normalize_asset(data, script, duration, width, height, bg_audio_path=""):
    g = data.get("global") if isinstance(data.get("global"), dict) else {}
    if bg_audio_path and not (g.get("background_audio") or "").strip():
        g["background_audio"] = bg_audio_path
    if not g.get("background_audio"):
        g["background_audio"] = ""
    for key in ("roles", "prop", "scene"):
        items = g.get(key) or []
        if not isinstance(items, list):
            items = []
        cleaned = []
        for i, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                continue
            cleaned.append({
                "id": int(item.get("id") or i),
                "name": str(item.get("name") or ""),
                "desc": str(item.get("desc") or ""),
                "gen_prompt": str(item.get("gen_prompt") or ""),
                "bing_image_path": str(item.get("bing_image_path") or ""),
                "bing_audio_path": str(item.get("bing_audio_path") or ""),
            })
        g[key] = cleaned
    script_name = str(
        data.get("script_name") or data.get("title") or data.get("name") or ""
    ).strip()
    if not script_name:
        script_name = _script_name_from_text(script)
    out = {
        # 剧本原文直接用节点输入，不采信模型回传，节省生成开销。
        "script": str(script or ""),
        "script_name": script_name,
        "duration": int(duration),
        "width": int(width),
        "height": int(height),
        "global": g,
    }
    return out


def fill_shots_info(asset, shots_prompt, shots_info, forbid_bgm):
    shots_prompt = strip_code_fences(shots_prompt)
    sections = split_sections(shots_prompt)
    gprompt = global_prompt_text(sections, forbid_bgm)
    g = asset.get("global") if isinstance(asset.get("global"), dict) else {}
    g["global_prompt"] = gprompt
    asset["global"] = g
    asset["shots_prompt"] = shots_prompt.strip()
    parsed_blocks = parse_shot_blocks(sections.get("detailed_description") or "")
    if not parsed_blocks:
        parsed_blocks = parse_shot_blocks(shots_prompt)
    info = shots_info if isinstance(shots_info, list) and shots_info else []
    if not info and parsed_blocks:
        info = []
        for block in parsed_blocks:
            info.append({
                "id": block["id"],
                "shot": block["body"],
                "is_first_shots": block["id"] == 1,
                "pre_last_frame_path": "",
                "duration": 0,
                "appear": appear_from_shot_text(asset, block["body"]),
            })
    if not info:
        info = [{
            "id": 1,
            "shot": shots_prompt.strip(),
            "is_first_shots": True,
            "pre_last_frame_path": "",
            "duration": int(asset.get("duration") or 5),
            "appear": {
                "roles": [r["id"] for r in g.get("roles") or []],
                "prop": [p["id"] for p in g.get("prop") or []],
                "scene": [s["id"] for s in g.get("scene") or []],
            },
        }]
    # Dedupe identical shot ids (LLM sometimes repeats [Shot 1]).
    info = sorted(info, key=lambda x: int(x.get("id") or 0) or 0)
    deduped_info = []
    seen_ids = set()
    for item in info:
        try:
            sid0 = int(item.get("id") or 0)
        except (TypeError, ValueError):
            sid0 = 0
        if sid0 in seen_ids:
            continue
        if sid0:
            seen_ids.add(sid0)
        deduped_info.append(item)
    info = deduped_info
    body_by_id = {b["id"]: b["body"] for b in parsed_blocks}
    for i, item in enumerate(info):
        sid = int(item.get("id") or (i + 1))
        item["id"] = sid
        is_first = i == 0
        item["is_first_shots"] = bool(is_first)
        item["pre_last_frame_path"] = str(
            item.get("pre_last_frame_path")
            or item.get("pre_last_frame_path")
            or item.get("prev_last_frame_path")
            or ""
        )
        raw_body = body_by_id.get(sid) or str(item.get("shot") or "")
        bare = _detailed_body(raw_body, sid)
        if not bare:
            bare = _detailed_body(str(item.get("shot_body") or ""), sid)
        appear = item.get("appear") if isinstance(item.get("appear"), dict) else {}
        appear = {
            "roles": _ids(appear.get("roles")),
            "prop": _ids(appear.get("prop")),
            "scene": _ids(appear.get("scene")),
        }
        if not any(appear.values()):
            appear = appear_from_shot_text(asset, bare)
        subject_block, appear, last_n = subject_block_for_shot(asset, appear, item["is_first_shots"])
        item["appear"] = appear
        shot_text = build_shot_prompt(subject_block, "[Shot %d] %s" % (sid, bare), item["is_first_shots"])
        shot_text = ensure_continuation(shot_text, item["is_first_shots"], last_n)
        item["shot"] = extract_shot_text(shot_text)
        item.pop("shot_body", None)
    clamp_shot_durations(info, int(asset.get("duration") or 5), asset.get("script") or "")
    asset["shots_info"] = info
    return asset
