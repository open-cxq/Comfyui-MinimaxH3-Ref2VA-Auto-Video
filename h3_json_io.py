# -*- coding: utf-8 -*-
"""Save / load H3 metadata JSON under ComfyUI output/input."""
from __future__ import annotations

import json
import os
import re

import folder_paths

ROOT_SUBDIR = "h3_ref2va_auto"
META_DIGITS = 5
META_FILE_PREFIX = "metadata-"
# metadata-{slug}-{5digits}.json
META_PATTERN = re.compile(
    r"^metadata-(.+)-(\d{%d})\.json$" % META_DIGITS,
    re.IGNORECASE,
)
EMPTY_CHOICE = "(暂无 JSON)"

# Comfy SaveImage/SaveVideo filename_prefix (relative to output/)
PREFIX_IMAGES = "h3_ref2va_auto/images/h3_ref2va_auto_images_"
PREFIX_SHOTS = "h3_ref2va_auto/shots/h3_ref2va_auto_shot_"
PREFIX_MERGE = "h3_ref2va_auto/merge/h3_ref2va_auto_merge_"

# Disk filename stems under output subdirs (Comfy adds 00001_)
IMAGES_STEM = "h3_ref2va_auto_images_"
SHOTS_STEM = "h3_ref2va_auto_shot_"
MERGE_STEM = "h3_ref2va_auto_merge_"


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return os.path.abspath(path)


def input_root() -> str:
    return _ensure_dir(os.path.join(folder_paths.get_input_directory(), ROOT_SUBDIR))


def input_tmp_dir() -> str:
    return _ensure_dir(os.path.join(input_root(), "tmp"))


def output_root() -> str:
    return _ensure_dir(os.path.join(folder_paths.get_output_directory(), ROOT_SUBDIR))


def output_data_dir() -> str:
    return _ensure_dir(os.path.join(output_root(), "data"))


def output_images_dir() -> str:
    return _ensure_dir(os.path.join(output_root(), "images"))


def output_shots_dir() -> str:
    return _ensure_dir(os.path.join(output_root(), "shots"))


def output_merge_dir() -> str:
    return _ensure_dir(os.path.join(output_root(), "merge"))


# Back-compat aliases used by older call sites
def output_meta_dir() -> str:
    return output_data_dir()


def input_meta_dir() -> str:
    return input_root()


def slug_script_name(name: str) -> str:
    text = str(name or "").strip()
    if not text:
        return "untitled"
    text = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", text)
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"_+", "_", text).strip("._")
    if not text:
        return "untitled"
    if len(text) > 80:
        text = text[:80].rstrip("._")
    return text or "untitled"


def _contained(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.realpath(path), os.path.realpath(root)]) == os.path.realpath(root)
    except ValueError:
        return False


def safe_json_basename(filename: str) -> str:
    name = os.path.basename(str(filename or "").replace("\\", "/").strip())
    name = name.replace("\x00", "")
    if not name or name in (".", "..") or ".." in name:
        raise ValueError("非法 JSON 文件名")
    if not name.lower().endswith(".json"):
        name = name + ".json"
    return name


def _max_meta_seq(root: str) -> int:
    best = 0
    if not os.path.isdir(root):
        return best
    for name in os.listdir(root):
        match = META_PATTERN.fullmatch(name)
        if match:
            best = max(best, int(match.group(2)))
    return best


def list_json_files() -> list[str]:
    root = output_data_dir()
    names = []
    if os.path.isdir(root):
        for name in os.listdir(root):
            if not META_PATTERN.fullmatch(name):
                continue
            full = os.path.join(root, name)
            if os.path.isfile(full):
                names.append(name)
    names.sort()
    return names


def combo_options() -> list[str]:
    names = list_json_files()
    return names if names else [EMPTY_CHOICE]


def next_metadata_path(script_name: str = "") -> tuple[str, str]:
    root = output_data_dir()
    slug = slug_script_name(script_name)
    nxt = _max_meta_seq(root) + 1
    filename = "%s%s-%0*d.json" % (META_FILE_PREFIX, slug, META_DIGITS, nxt)
    return os.path.join(root, filename), filename


def resolve_metadata_path(filename: str) -> str | None:
    try:
        name = safe_json_basename(filename)
    except ValueError:
        return None
    path = os.path.abspath(os.path.join(output_data_dir(), name))
    if os.path.isfile(path) and _contained(path, output_data_dir()):
        return path
    return None


def save_metadata_json(
    data: dict,
    mode: str = "latest",
    filename: str | None = None,
) -> tuple[str, str]:
    """Write board JSON under output/h3_ref2va_auto/data/.

    mode=new: always create next metadata-{slug}-{seq}.json.
    mode=latest: overwrite remembered metadata_file if present; else create new.
    Mutates data to set metadata_file (and drops legacy matedata_file).
    """
    if not isinstance(data, dict):
        raise ValueError("保存内容不是 JSON 对象")
    kind = str(mode or "latest").strip().lower()
    script_name = str(data.get("script_name") or "").strip()
    remembered = str(
        filename
        or data.get("metadata_file")
        or data.get("matedata_file")
        or ""
    ).strip()

    if kind == "new":
        path, out_name = next_metadata_path(script_name)
    else:
        path = resolve_metadata_path(remembered) if remembered else None
        if path:
            out_name = os.path.basename(path)
        else:
            path, out_name = next_metadata_path(script_name)

    data["metadata_file"] = out_name
    if "matedata_file" in data:
        del data["matedata_file"]
    pretty = json.dumps(data, ensure_ascii=False, indent=2)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(pretty)
        fh.write("\n")
    return path, out_name


# Back-compat name used by older imports
def save_matedata_json(data: dict, mode: str = "latest", filename: str | None = None) -> tuple[str, str]:
    return save_metadata_json(data, mode=mode, filename=filename)


def next_matedata_path() -> tuple[str, str]:
    return next_metadata_path("")


def resolve_json_file(filename: str) -> str:
    raw = str(filename or "").strip()
    if not raw or raw == EMPTY_CHOICE:
        raise FileNotFoundError("请先保存或上传 metadata JSON")
    name = safe_json_basename(raw)
    path = resolve_metadata_path(name)
    if path:
        return path
    # Uploaded JSON may still live under input/h3_ref2va_auto (not in load combo).
    input_path = os.path.abspath(os.path.join(input_root(), name))
    if os.path.isfile(input_path) and _contained(input_path, input_root()):
        return input_path
    raise FileNotFoundError("找不到 JSON：%s" % name)


def unique_input_path(filename: str) -> str:
    name = safe_json_basename(filename)
    root = input_root()
    stem, ext = os.path.splitext(name)
    path = os.path.join(root, name)
    n = 1
    while os.path.exists(path):
        path = os.path.join(root, "%s_%d%s" % (stem, n, ext))
        n += 1
    return path


def next_output_counter(subdir: str, stem: str) -> int:
    """Next 5-digit counter for files like {stem}00001_.png under output/.../{subdir}."""
    mapping = {
        "images": output_images_dir,
        "shots": output_shots_dir,
        "merge": output_merge_dir,
    }
    getter = mapping.get(str(subdir or "").strip().lower())
    if not getter:
        raise ValueError("未知产出子目录: %s" % subdir)
    root = getter()
    pat = re.compile(
        r"^%s(\d{%d})_?" % (re.escape(stem), META_DIGITS),
        re.IGNORECASE,
    )
    best = 0
    for name in os.listdir(root):
        match = pat.match(name)
        if match:
            best = max(best, int(match.group(1)))
    return best + 1


def allocate_output_filename(subdir: str, stem: str, ext: str) -> tuple[str, str, int]:
    """Return (abs_path, basename, seq) for Comfy-like names: {stem}00001_.ext."""
    mapping = {
        "images": output_images_dir,
        "shots": output_shots_dir,
        "merge": output_merge_dir,
    }
    getter = mapping.get(str(subdir or "").strip().lower())
    if not getter:
        raise ValueError("未知产出子目录: %s" % subdir)
    root = getter()
    if not stem.endswith("_"):
        stem = stem + "_"
    seq = next_output_counter(subdir, stem)
    ext = str(ext or "").strip()
    if not ext.startswith("."):
        ext = "." + ext
    basename = "%s%0*d_%s" % (stem, META_DIGITS, seq, ext)
    return os.path.join(root, basename), basename, seq
