# -*- coding: utf-8 -*-
"""Local CLIP generate + OpenAI-compatible chat for H3 Auto Video nodes."""
from __future__ import annotations

import base64
import io
import json
import os
import re
import urllib.error
import urllib.request

import folder_paths
import numpy as np
from PIL import Image

H3_LLM_TYPE = "H3_LLM"
SETTING_API_KEY = "H3Ref2VAAuto.OpenAI.ApiKey"
SETTING_BASE_URL = "H3Ref2VAAuto.OpenAI.BaseUrl"
SETTING_MODEL = "H3Ref2VAAuto.OpenAI.Model"
SETTING_MODEL_LIST = "H3Ref2VAAuto.OpenAI.ModelList"
# Legacy ids from early MinimaxH3 naming; still read as fallback.
_LEGACY_SETTING_API_KEY = "MinimaxH3.OpenAI.ApiKey"
_LEGACY_SETTING_BASE_URL = "MinimaxH3.OpenAI.BaseUrl"
DEFAULT_BASE_URL = "https://api.openai.com/v1"
SETTINGS_MENU = "H3 Ref2VA Auto"
NO_MODEL_PLACEHOLDER = "(请在设置中配置 API 并刷新模型列表)"


def make_clip_llm(clip):
    return {"kind": "clip", "clip": clip}


def make_openai_llm(model, timeout=180):
    # Do not store api_key/base_url on the graph object; resolve from settings at call time.
    return {
        "kind": "openai",
        "model": (model or "").strip(),
        "timeout": int(timeout),
    }


def is_h3_llm(value):
    return isinstance(value, dict) and value.get("kind") in ("clip", "openai")


def normalize_llm(model):
    if is_h3_llm(model):
        return model
    # Direct CLIP connection (backward compatible).
    if model is not None and hasattr(model, "tokenize") and hasattr(model, "generate"):
        return make_clip_llm(model)
    raise RuntimeError("模型输入无效：请连接「加载 CLIP」或「H3 OpenAI API」节点。")


def _iter_settings_files():
    root = folder_paths.get_user_directory()
    # Prefer the common single-user profile first.
    preferred = os.path.join(root, "default", "comfy.settings.json")
    if os.path.isfile(preferred):
        yield preferred
    try:
        for name in sorted(os.listdir(root)):
            path = os.path.join(root, name, "comfy.settings.json")
            if path == preferred:
                continue
            if os.path.isfile(path):
                yield path
    except OSError:
        return


def read_comfy_setting(setting_id, default=""):
    """Read a value from user/*/comfy.settings.json (Application Settings)."""
    for path in _iter_settings_files():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                continue
            if setting_id not in data:
                continue
            value = data.get(setting_id)
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            return value
        except Exception:
            continue
    return default


def resolve_openai_api_key(override=""):
    key = (override or "").strip()
    if key:
        return key
    for sid in (SETTING_API_KEY, _LEGACY_SETTING_API_KEY):
        setting = read_comfy_setting(sid, "")
        if isinstance(setting, str) and setting.strip():
            return setting.strip()
    return (
        os.environ.get("OPENAI_API_KEY", "").strip()
        or os.environ.get("H3_REF2VA_AUTO_OPENAI_API_KEY", "").strip()
    )


def resolve_openai_base_url(override=""):
    url = (override or "").strip().rstrip("/")
    if url:
        return url
    for sid in (SETTING_BASE_URL, _LEGACY_SETTING_BASE_URL):
        setting = read_comfy_setting(sid, "")
        if isinstance(setting, str) and setting.strip():
            return setting.strip().rstrip("/")
    env = os.environ.get("OPENAI_BASE_URL", "").strip().rstrip("/")
    return env or DEFAULT_BASE_URL


def resolve_openai_model(override=""):
    model = (override or "").strip()
    if model and model != NO_MODEL_PLACEHOLDER:
        return model
    saved = read_comfy_setting(SETTING_MODEL, "")
    if isinstance(saved, str) and saved.strip() and saved.strip() != NO_MODEL_PLACEHOLDER:
        return saved.strip()
    return ""


def openai_v1_root(base_url=""):
    root = resolve_openai_base_url(base_url)
    if root.lower().endswith("/v1"):
        return root
    return root + "/v1"


def fetch_openai_model_ids(api_key="", base_url="", timeout=30):
    """GET {base}/models — returns (models, error_message)."""
    key = resolve_openai_api_key(api_key)
    if not key:
        return [], (
            "未配置 OpenAI API Key。请到「设置 → %s → OpenAI API Key」填写。"
            % SETTINGS_MENU
        )
    endpoint = openai_v1_root(base_url) + "/models"
    req = urllib.request.Request(
        endpoint,
        headers={"Authorization": "Bearer " + key},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=int(timeout)) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:400]
        return [], "OpenAI HTTP %s: %s" % (exc.code, body or exc.reason)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        return [], "拉取模型失败: %s" % exc

    if isinstance(result, dict) and result.get("error"):
        err = result["error"]
        return [], str(err.get("message") if isinstance(err, dict) else err)

    rows = result.get("data") if isinstance(result, dict) else result
    if not isinstance(rows, list):
        return [], "无法解析 /models 响应。"

    models = []
    seen = set()
    for row in rows:
        mid = ""
        if isinstance(row, dict):
            mid = str(row.get("id") or "").strip()
        elif isinstance(row, str):
            mid = row.strip()
        if not mid or mid in seen:
            continue
        seen.add(mid)
        models.append(mid)
    models.sort(key=str.lower)
    if not models:
        return [], "接口返回空模型列表。"
    return models, ""


def list_openai_model_options():
    """Combo options for the OpenAI API node.

    Prefer the model list cached by the settings page refresh (no network during
    schema build). Fall back to the saved default model, then a placeholder.
    """
    models = []
    cached = read_comfy_setting(SETTING_MODEL_LIST, None)
    if isinstance(cached, list):
        for item in cached:
            mid = str(item or "").strip()
            if mid and mid not in models:
                models.append(mid)
    elif isinstance(cached, str) and cached.strip():
        try:
            parsed = json.loads(cached)
            if isinstance(parsed, list):
                for item in parsed:
                    mid = str(item or "").strip()
                    if mid and mid not in models:
                        models.append(mid)
        except Exception:
            pass
    saved = resolve_openai_model()
    if saved and saved not in models:
        models = [saved] + models
    if not models:
        return [NO_MODEL_PLACEHOLDER]
    return models


def _images_to_data_urls(image, max_side=768, max_images=8):
    if image is None:
        return []
    arr = image
    if hasattr(arr, "detach"):
        arr = arr.detach().cpu().numpy()
    arr = np.asarray(arr)
    if arr.ndim == 3:
        arr = arr[None, ...]
    urls = []
    for i in range(min(int(arr.shape[0]), max_images)):
        frame = arr[i]
        if frame.dtype != np.uint8:
            frame = np.clip(frame * 255.0, 0, 255).astype(np.uint8)
        if frame.shape[-1] > 3:
            frame = frame[..., :3]
        im = Image.fromarray(frame)
        w, h = im.size
        scale = min(1.0, float(max_side) / float(max(w, h)))
        if scale < 1.0:
            im = im.resize(
                (max(1, int(w * scale)), max(1, int(h * scale))),
                Image.Resampling.BILINEAR,
            )
        buf = io.BytesIO()
        im.convert("RGB").save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        urls.append("data:image/jpeg;base64," + b64)
    return urls


def _strip_output(text):
    text = re.sub(r"<think>.*?(?:</think>|$)", "", text or "", flags=re.DOTALL).strip()
    fence = re.search(r"^```(?:\w+)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    return text


def clip_generate(
    clip,
    prompt,
    image=None,
    audio=None,
    video=None,
    max_length=2048,
    thinking=False,
    seed=0,
):
    tokens = clip.tokenize(
        prompt,
        image=image,
        skip_template=False,
        min_length=1,
        thinking=bool(thinking),
        video=video,
        audio=audio,
    )
    generated_ids = clip.generate(
        tokens,
        do_sample=True,
        max_length=int(max_length),
        temperature=0.7,
        top_k=64,
        top_p=0.95,
        min_p=0.05,
        repetition_penalty=1.05,
        presence_penalty=0.0,
        seed=int(seed),
    )
    text = _strip_output(clip.decode(generated_ids))
    if not text:
        raise RuntimeError(
            "CLIP 文本生成为空。请用内置「加载 CLIP」接入支持 generate 的模型"
            "（如 Qwen3-VL Instruct）。"
        )
    return text


def openai_chat_generate(
    *,
    base_url,
    api_key,
    model,
    prompt,
    image=None,
    max_length=2048,
    seed=0,
    timeout=180,
    temperature=0.7,
):
    if not (model or "").strip():
        raise RuntimeError("未指定 OpenAI 模型名。")
    key = resolve_openai_api_key(api_key)
    if not key:
        raise RuntimeError(
            (
                "未配置 OpenAI API Key。请到 ComfyUI「设置 → %s → OpenAI API Key」填写，"
                "或设置环境变量 OPENAI_API_KEY。"
            )
            % SETTINGS_MENU
        )
    root = openai_v1_root(base_url)
    endpoint = root + "/chat/completions"

    image_urls = _images_to_data_urls(image)
    if image_urls:
        content = [{"type": "text", "text": prompt}]
        for url in image_urls:
            content.append({"type": "image_url", "image_url": {"url": url}})
        user_message = {"role": "user", "content": content}
    else:
        user_message = {"role": "user", "content": prompt}

    payload = {
        "model": model.strip(),
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant. Follow the user instructions exactly.",
            },
            user_message,
        ],
        "temperature": float(temperature),
        "max_tokens": int(max_length),
        "stream": False,
        "seed": int(seed),
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=int(timeout)) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError("OpenAI HTTP %s %s: %s" % (exc.code, endpoint, body or exc.reason)) from exc
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("OpenAI 调用失败: %s (%s)" % (exc, endpoint)) from exc

    if isinstance(result, dict) and result.get("error"):
        err = result["error"]
        raise RuntimeError(
            "OpenAI API error: %s" % (err.get("message") if isinstance(err, dict) else err)
        )

    choice = (result.get("choices") or [{}])[0] or {}
    message = choice.get("message") or {}
    text = message.get("content") or ""
    if isinstance(text, list):
        parts = []
        for item in text:
            if isinstance(item, dict) and item.get("type") in (None, "text"):
                parts.append(str(item.get("text") or ""))
            elif isinstance(item, str):
                parts.append(item)
        text = "".join(parts)
    text = _strip_output(str(text or ""))
    if not text:
        raise RuntimeError("OpenAI 返回内容为空。")
    return text


def llm_generate(
    model,
    prompt,
    image=None,
    audio=None,
    video=None,
    max_length=2048,
    thinking=False,
    seed=0,
):
    llm = normalize_llm(model)
    if llm["kind"] == "clip":
        return clip_generate(
            llm["clip"],
            prompt,
            image=image,
            audio=audio,
            video=video,
            max_length=max_length,
            thinking=thinking,
            seed=seed,
        )
    return openai_chat_generate(
        base_url=resolve_openai_base_url(),
        api_key=resolve_openai_api_key(),
        model=resolve_openai_model(llm.get("model") or ""),
        prompt=prompt,
        image=image,
        max_length=max_length,
        seed=seed,
        timeout=int(llm.get("timeout") or 180),
    )


def _json_rewrite_prompt(original_prompt: str, bad_text: str, err: Exception) -> str:
    bad = str(bad_text or "")
    if len(bad) > 6000:
        bad = bad[:3000] + "\n…(中间省略)…\n" + bad[-2000:]
    return (
        "你上次输出的内容不是合法 JSON，无法解析（可能被截断，或字符串里直接换行未写成 \\n，"
        "或夹带了说明文字）。\n"
        "请按原任务要求重新输出：只输出一份完整、可被 json.loads 解析的 JSON；"
        "不要 markdown 代码块，不要解释，不要前后缀。\n"
        "字符串内的换行必须写成 \\n，不要在引号内直接按回车换行。\n"
        "解析错误：%s\n\n"
        "【原任务】\n%s\n\n"
        "【上次错误输出】\n%s\n"
        % (err, original_prompt, bad)
    )


def llm_generate_json(
    model,
    prompt,
    image=None,
    audio=None,
    video=None,
    max_length=2048,
    thinking=False,
    seed=0,
    max_retries=2,
):
    """Generate then parse JSON. On parse failure, rewrite up to max_retries times."""
    from .h3_parse import extract_json

    retries = max(0, int(max_retries))
    last_err = None
    last_raw = ""
    cur_prompt = prompt
    cur_max = int(max_length)
    for attempt in range(retries + 1):
        raw = llm_generate(
            model,
            cur_prompt,
            image=image,
            audio=audio,
            video=video,
            max_length=cur_max,
            thinking=thinking,
            seed=int(seed) + attempt,
        )
        last_raw = raw
        try:
            return extract_json(raw), raw
        except RuntimeError as exc:
            last_err = exc
            if attempt >= retries:
                break
            print(
                "[H3 LLM JSON] parse failed (attempt %d/%d): %s"
                % (attempt + 1, retries + 1, exc)
            )
            cur_prompt = _json_rewrite_prompt(prompt, raw, exc)
            # Truncation is common; give a bit more room on rewrite.
            cur_max = min(int(cur_max * 1.5) if cur_max > 0 else 3072, max(cur_max + 1024, cur_max))
    raise RuntimeError(
        "LLM JSON 解析失败（已重写 %d 次）：%s\n原文片段：%s"
        % (retries, last_err, (last_raw or "")[:300])
    )
