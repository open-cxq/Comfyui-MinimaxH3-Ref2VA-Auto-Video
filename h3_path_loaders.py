# -*- coding: utf-8 -*-
"""Load IMAGE/AUDIO/VIDEO from absolute paths for board local queue injection."""
from __future__ import annotations

import os

import numpy as np
import torch
from PIL import Image, ImageOps, ImageSequence

from comfy_api.latest import InputImpl

from .h3_board import is_allowed_media_path


def _require_path(path: str) -> str:
    abs_path = os.path.abspath(str(path or "").strip())
    if not abs_path or not os.path.isfile(abs_path):
        raise RuntimeError("媒体路径不存在: %s" % path)
    if not is_allowed_media_path(abs_path):
        raise RuntimeError("媒体路径不在允许目录内: %s" % abs_path)
    return abs_path


def load_image_path(path: str):
    abs_path = _require_path(path)
    img = Image.open(abs_path)
    frames = []
    for frame in ImageSequence.Iterator(img):
        frame = ImageOps.exif_transpose(frame)
        if frame.mode == "I":
            frame = frame.point(lambda i: i * (1 / 255))
        rgb = frame.convert("RGB")
        arr = np.array(rgb).astype(np.float32) / 255.0
        frames.append(torch.from_numpy(arr)[None, ...])
    if not frames:
        raise RuntimeError("无法解码图片: %s" % abs_path)
    return torch.cat(frames, dim=0)


def load_audio_path(path: str):
    from comfy_extras.nodes_audio import load as load_audio_file

    abs_path = _require_path(path)
    waveform, sample_rate = load_audio_file(abs_path)
    return {"waveform": waveform.unsqueeze(0), "sample_rate": int(sample_rate)}


def load_video_path(path: str):
    abs_path = _require_path(path)
    return InputImpl.VideoFromFile(abs_path)


def placeholder_video():
    """Board film_video 口在尚无成片时的占位（1 帧黑场），避免 schema 缺输出。"""
    from fractions import Fraction

    import torch
    from comfy_api.latest._util.video_types import VideoComponents

    black = torch.zeros((1, 8, 8, 3), dtype=torch.float32)
    return InputImpl.VideoFromComponents(
        VideoComponents(images=black, audio=None, frame_rate=Fraction(1, 1))
    )
