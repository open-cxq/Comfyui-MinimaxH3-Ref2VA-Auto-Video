# -*- coding: utf-8 -*-
"""Shared constants and helpers for H3 Ref2VA Auto nodes."""
from __future__ import annotations

import os

from comfy_api.latest import io

from .h3_llm import H3_LLM_TYPE
from .h3_media import ASPECT_RATIOS
from .h3_parse import load_text

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPT_DIR = os.path.join(PLUGIN_DIR, "prompt")
KNOWLEDGE_DIR = os.path.join(PLUGIN_DIR, "knowledge")
RATIO_OPTIONS = list(ASPECT_RATIOS.keys())
COMPONENT_NAME = "H3 Ref2VA Auto"
CATEGORY = COMPONENT_NAME
H3LLM = io.Custom(H3_LLM_TYPE)
MODEL_TIP = "连接内置「加载 CLIP」，或「%s OpenAI API」节点。" % COMPONENT_NAME


def model_input():
    return io.MultiType.Input(
        "model",
        [io.Clip, H3LLM],
        display_name="模型",
        tooltip=MODEL_TIP,
    )


def images_input():
    # 不要给 Autogrow 本身加 display_name，否则会多出一个不可用的「参考图」口。
    return io.Autogrow.Input(
        "images",
        optional=True,
        tooltip="可连接多张参考图（image_0、image_1…）。无则留空。",
        template=io.Autogrow.TemplatePrefix(
            input=io.Image.Input("image"),
            prefix="image_",
            min=0,
            max=8,
        ),
    )


def template(name):
    return load_text(os.path.join(PROMPT_DIR, name))


def fill(tmpl, slot, value):
    return tmpl.replace(slot, value)


def first_audio(audios):
    if not audios:
        return None
    if isinstance(audios, dict) and "waveform" in audios:
        return audios
    if isinstance(audios, dict):
        items = []
        for key, val in audios.items():
            if val is None:
                continue
            try:
                idx = int(str(key).rsplit("_", 1)[-1])
            except ValueError:
                idx = len(items)
            items.append((idx, val))
        if items:
            return sorted(items, key=lambda x: x[0])[0][1]
    return audios


def gen_kwargs(thinking, max_length, seed=0):
    return {
        "thinking": bool(thinking),
        "max_length": int(max_length),
        "seed": int(seed),
    }
