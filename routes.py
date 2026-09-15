# -*- coding: utf-8 -*-
"""HTTP routes for H3 Ref2VA Auto (OpenAI model list + media upload/view)."""
from __future__ import annotations

import json
import os
import time
import uuid

from aiohttp import web

import folder_paths

from .h3_board import is_allowed_media_path
from .h3_json_io import (
    IMAGES_STEM,
    MERGE_STEM,
    PREFIX_IMAGES,
    PREFIX_MERGE,
    PREFIX_SHOTS,
    SHOTS_STEM,
    input_root,
    input_tmp_dir,
    list_json_files,
    next_output_counter,
    output_images_dir,
    save_metadata_json,
    unique_input_path,
)
from .h3_llm import fetch_openai_model_ids


UPLOAD_SUBFOLDER = "h3_ref2va_auto"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mkv", ".mov", ".avi"}
AUDIO_EXTS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}


def _upload_dir():
    return input_root()


def _safe_ext(filename, allowed):
    ext = os.path.splitext(str(filename or ""))[1].lower()
    if ext in allowed:
        return ext
    return next(iter(allowed))


def _resolve_comfy_media(body: dict, allowed_exts: set[str]):
    """Resolve SaveImage/SaveVideo result to an absolute path under a Comfy directory."""
    filename = os.path.basename(str(body.get("filename") or "").strip())
    subfolder = str(body.get("subfolder") or "").replace("\\", "/").strip().strip("/")
    media_type = str(body.get("type") or "output").strip().lower()
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        return None, "非法文件名"
    if ".." in subfolder:
        return None, "非法子目录"
    if media_type not in ("output", "temp", "input"):
        return None, "非法 type"
    try:
        base = folder_paths.get_directory_by_type(media_type)
    except Exception:
        base = None
    if not base:
        return None, "无法解析目录类型"
    src = os.path.abspath(
        os.path.join(base, subfolder, filename) if subfolder else os.path.join(base, filename)
    )
    try:
        if os.path.commonpath([src, os.path.abspath(base)]) != os.path.abspath(base):
            return None, "路径越界"
    except ValueError:
        return None, "路径无效"
    if not os.path.isfile(src):
        return None, "源文件不存在"
    if os.path.splitext(filename)[1].lower() not in allowed_exts:
        if not is_allowed_media_path(src):
            return None, "不支持的文件类型"
    if not is_allowed_media_path(src):
        return None, "路径不在白名单"
    return src, ""


def register_routes():
    from server import PromptServer

    routes = PromptServer.instance.routes

    @routes.post("/h3_ref2va_auto/openai/models")
    async def openai_models(request):
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        models, err = fetch_openai_model_ids(
            api_key=str(body.get("api_key") or ""),
            base_url=str(body.get("base_url") or ""),
            timeout=int(body.get("timeout") or 30),
        )
        if err:
            return web.json_response({"models": models, "error": err}, status=200)
        return web.json_response({"models": models, "error": ""})

    @routes.get("/h3_ref2va_auto/openai/models")
    async def openai_models_get(_request):
        models, err = fetch_openai_model_ids()
        if err:
            return web.json_response({"models": models, "error": err}, status=200)
        return web.json_response({"models": models, "error": ""})

    @routes.post("/h3_ref2va_auto/upload")
    async def upload_media(request):
        try:
            reader = await request.multipart()
        except Exception as exc:
            return web.json_response({"error": "multipart 无效: %s" % exc}, status=400)

        kind = "image"
        file_field = None
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name == "kind":
                kind = (await part.text() or "image").strip().lower()
            elif part.name in ("file", "image", "audio", "video"):
                file_field = part
                break

        if file_field is None:
            return web.json_response({"error": "未收到文件"}, status=400)

        filename = file_field.filename or "upload.bin"
        if kind == "audio":
            ext = _safe_ext(filename, AUDIO_EXTS)
        elif kind == "video":
            ext = _safe_ext(filename, VIDEO_EXTS)
        else:
            ext = _safe_ext(filename, IMAGE_EXTS)
            kind = "image"

        out_name = "upload_%s_%s%s" % (
            time.strftime("%Y%m%d_%H%M%S"),
            uuid.uuid4().hex[:8],
            ext,
        )
        abs_path = os.path.abspath(os.path.join(_upload_dir(), out_name))
        size = 0
        size_limit = 200 * 1024 * 1024 if kind == "video" else 80 * 1024 * 1024
        with open(abs_path, "wb") as fh:
            while True:
                chunk = await file_field.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                if size > size_limit:
                    fh.close()
                    try:
                        os.remove(abs_path)
                    except OSError:
                        pass
                    return web.json_response(
                        {"error": "文件过大（上限 %dMB）" % (size_limit // (1024 * 1024))},
                        status=400,
                    )
                fh.write(chunk)

        return web.json_response(
            {
                "error": "",
                "path": abs_path,
                "filename": out_name,
                "subfolder": UPLOAD_SUBFOLDER,
                "type": "input",
                "kind": kind,
            }
        )

    @routes.get("/h3_ref2va_auto/media")
    async def media_view(request):
        path = str(request.rel_url.query.get("path") or "").strip()
        if not is_allowed_media_path(path):
            return web.Response(status=403, text="forbidden")
        abs_path = os.path.abspath(path)
        return web.FileResponse(
            abs_path,
            headers={"Cache-Control": "private, max-age=300"},
        )

    @routes.get("/h3_ref2va_auto/json_files")
    async def json_files(_request):
        return web.json_response({"files": list_json_files(), "error": ""})

    @routes.post("/h3_ref2va_auto/upload_json")
    async def upload_json(request):
        try:
            reader = await request.multipart()
        except Exception as exc:
            return web.json_response({"error": "multipart 无效: %s" % exc}, status=400)

        file_field = None
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name in ("file", "json"):
                file_field = part
                break

        if file_field is None:
            return web.json_response({"error": "未收到文件"}, status=400)

        filename = file_field.filename or "metadata.json"
        try:
            abs_path = os.path.abspath(unique_input_path(filename))
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)

        size = 0
        with open(abs_path, "wb") as fh:
            while True:
                chunk = await file_field.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                if size > 20 * 1024 * 1024:
                    fh.close()
                    try:
                        os.remove(abs_path)
                    except OSError:
                        pass
                    return web.json_response({"error": "文件过大（上限 20MB）"}, status=400)
                fh.write(chunk)

        try:
            with open(abs_path, "r", encoding="utf-8") as fh:
                json.loads(fh.read())
        except Exception:
            try:
                os.remove(abs_path)
            except OSError:
                pass
            return web.json_response({"error": "不是有效的 UTF-8 JSON"}, status=400)

        return web.json_response(
            {
                "error": "",
                "path": abs_path,
                "filename": os.path.basename(abs_path),
                "subfolder": UPLOAD_SUBFOLDER,
                "type": "input",
            }
        )

    def _resolve_output_media_response(src: str, media_kind: str):
        return web.json_response(
            {
                "error": "",
                "path": src,
                "filename": os.path.basename(src),
                "type": "output",
                "kind": media_kind,
                "copied": False,
            }
        )

    @routes.post("/h3_ref2va_auto/resolve_output_media")
    async def resolve_output_media(request):
        """Resolve SaveImage/SaveVideo output to absolute path without copying into input."""
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        kind = str(body.get("kind") or "image").strip().lower()
        allowed = VIDEO_EXTS if kind == "video" else IMAGE_EXTS
        src, err = _resolve_comfy_media(body, allowed)
        if err:
            status = 404 if err == "源文件不存在" else (403 if "越界" in err or "白名单" in err else 400)
            return web.json_response({"error": err}, status=status)
        return _resolve_output_media_response(src, "video" if kind == "video" else "image")

    @routes.post("/h3_ref2va_auto/import_output_image")
    async def import_output_image(request):
        """Resolve SaveImage result path (no copy into input)."""
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        src, err = _resolve_comfy_media(body, IMAGE_EXTS)
        if err:
            status = 404 if err == "源文件不存在" else (403 if "越界" in err or "白名单" in err else 400)
            return web.json_response({"error": err}, status=status)
        return _resolve_output_media_response(src, "image")

    @routes.post("/h3_ref2va_auto/import_output_video")
    async def import_output_video(request):
        """Resolve SaveVideo result path (no copy into input)."""
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        src, err = _resolve_comfy_media(body, VIDEO_EXTS)
        if err:
            status = 404 if err == "源文件不存在" else (403 if "越界" in err or "白名单" in err else 400)
            return web.json_response({"error": err}, status=status)
        return _resolve_output_media_response(src, "video")

    @routes.post("/h3_ref2va_auto/extract_video_frame")
    async def extract_video_frame(request):
        """Extract first/last frame into output/.../images/."""
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        path = str(body.get("path") or "").strip()
        which = str(body.get("which") or "first").strip().lower()
        if which not in ("first", "last"):
            which = "first"
        if not is_allowed_media_path(path):
            return web.json_response({"error": "非法或不存在的视频路径"}, status=400)
        try:
            from .h3_media import extract_video_frame as _extract

            out = _extract(path, which=which, out_dir=None)
        except Exception as exc:
            return web.json_response({"error": "抽帧失败: %s" % exc}, status=500)
        return web.json_response(
            {
                "error": "",
                "path": out,
                "filename": os.path.basename(out),
                "subfolder": "h3_ref2va_auto/images",
                "type": "output",
                "which": which,
            }
        )

    @routes.post("/h3_ref2va_auto/compose_film")
    async def compose_film(request):
        """Concat shot videos; default writes tmp under input/.../tmp."""
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        videos_in = body.get("videos") or []
        if not isinstance(videos_in, list):
            return web.json_response({"error": "videos 必须是路径数组"}, status=400)
        videos = []
        for raw in videos_in:
            if isinstance(raw, dict):
                path = str(raw.get("path") or "").strip()
                if not path:
                    continue
                if not is_allowed_media_path(path):
                    return web.json_response({"error": "非法或不存在的视频路径: %s" % path}, status=400)
                item = {"path": os.path.abspath(path)}
                if "in" in raw:
                    item["in"] = raw.get("in")
                if "out" in raw:
                    item["out"] = raw.get("out")
                videos.append(item)
                continue
            path = str(raw or "").strip()
            if not path:
                continue
            if not is_allowed_media_path(path):
                return web.json_response({"error": "非法或不存在的视频路径: %s" % path}, status=400)
            videos.append(os.path.abspath(path))
        if not videos:
            return web.json_response({"error": "没有可合成的视频"}, status=400)

        bgm = str(body.get("bgm") or "").strip()
        if bgm:
            if not is_allowed_media_path(bgm):
                # Stale board BGM from a previous script — compose without it.
                print("[H3 Ref2VA Auto] 背景音乐路径无效或文件不存在，已跳过: %s" % bgm)
                bgm = None
            else:
                bgm = os.path.abspath(bgm)
        else:
            bgm = None
        try:
            bgm_volume = float(body.get("bgm_volume", 1.0))
        except (TypeError, ValueError):
            bgm_volume = 1.0
        try:
            speed = float(body.get("speed", body.get("playback_rate", 1.0)))
        except (TypeError, ValueError):
            speed = 1.0
        bgm_follow_speed = bool(
            body.get("bgm_follow_speed", body.get("bgm_follow_playback_rate", False))
        )

        formal_merge = bool(body.get("formal_merge"))
        try:
            from .h3_media import compose_film as _compose

            out = _compose(
                videos,
                bgm=bgm,
                out_dir=None,
                bgm_volume=bgm_volume,
                formal_merge=formal_merge,
                speed=speed,
                bgm_follow_speed=bgm_follow_speed,
            )
        except Exception as exc:
            return web.json_response({"error": "合成失败: %s" % exc}, status=500)
        return web.json_response(
            {
                "error": "",
                "path": out,
                "filename": os.path.basename(out),
                "subfolder": "h3_ref2va_auto/merge" if formal_merge else "h3_ref2va_auto/tmp",
                "type": "output" if formal_merge else "input",
                "temporary": not formal_merge,
            }
        )

    @routes.post("/h3_ref2va_auto/save_matedata")
    async def save_matedata(request):
        """Overwrite remembered metadata file (or create next) under output/.../data/."""
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        data = body.get("data")
        if data is None and isinstance(body.get("shots_info"), (list, dict)):
            data = body
        if not isinstance(data, dict):
            return web.json_response({"error": "缺少有效的 JSON 对象 data"}, status=400)
        mode = str(body.get("mode") or "latest").strip().lower()
        if mode not in ("latest", "new"):
            mode = "latest"
        filename = str(
            body.get("filename")
            or body.get("metadata_file")
            or body.get("matedata_file")
            or ""
        ).strip() or None
        try:
            path, out_name = save_metadata_json(data, mode=mode, filename=filename)
        except Exception as exc:
            return web.json_response({"error": "保存失败: %s" % exc}, status=500)
        return web.json_response(
            {
                "error": "",
                "path": path,
                "filename": out_name,
                "mode": mode,
            }
        )

    @routes.get("/h3_ref2va_auto/next_counter")
    @routes.post("/h3_ref2va_auto/next_counter")
    async def next_counter(request):
        """Return next 5-digit counter and suggested Comfy filename_prefix for a kind."""
        try:
            if request.method == "GET":
                kind = str(request.rel_url.query.get("kind") or "").strip().lower()
            else:
                body = await request.json()
                if not isinstance(body, dict):
                    body = {}
                kind = str(body.get("kind") or "").strip().lower()
        except Exception:
            kind = ""
        mapping = {
            "images": ("images", IMAGES_STEM, PREFIX_IMAGES),
            "shots": ("shots", SHOTS_STEM, PREFIX_SHOTS),
            "merge": ("merge", MERGE_STEM, PREFIX_MERGE),
        }
        if kind not in mapping:
            return web.json_response(
                {"error": "kind 须为 images|shots|merge"},
                status=400,
            )
        subdir, stem, prefix = mapping[kind]
        try:
            nxt = next_output_counter(subdir, stem if stem.endswith("_") else stem + "_")
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=500)
        return web.json_response(
            {
                "error": "",
                "kind": kind,
                "next": nxt,
                "prefix": prefix,
                "images_dir": output_images_dir() if kind == "images" else "",
                "tmp_dir": input_tmp_dir(),
            }
        )
