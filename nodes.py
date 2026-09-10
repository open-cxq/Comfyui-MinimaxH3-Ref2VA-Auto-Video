# -*- coding: utf-8 -*-
"""H3 Ref2VA Auto node exports. Node IDs are unchanged from the development plugin."""
from __future__ import annotations

from .nodes_board import MinimaxH3ScriptBoard, MinimaxH3TextEdit
from .nodes_io import (
    MinimaxH3LoadAudioPath,
    MinimaxH3LoadImagePath,
    MinimaxH3LoadJson,
    MinimaxH3LoadVideoPath,
    MinimaxH3SaveJson,
)
from .nodes_llm import (
    MinimaxH3AssetExtract,
    MinimaxH3OpenAIAPI,
    MinimaxH3ScriptComplete,
    MinimaxH3ScriptConverter,
    MinimaxH3ShotSplit,
)
from .nodes_media import (
    MinimaxH3CropVideoByFrame,
    MinimaxH3GetImageRangeFromBatch,
    MinimaxH3ImageCount,
    keep_frame_slice,
)

__all__ = [
    "MinimaxH3OpenAIAPI",
    "MinimaxH3ScriptComplete",
    "MinimaxH3AssetExtract",
    "MinimaxH3ShotSplit",
    "MinimaxH3ScriptBoard",
    "MinimaxH3TextEdit",
    "MinimaxH3SaveJson",
    "MinimaxH3LoadJson",
    "MinimaxH3LoadImagePath",
    "MinimaxH3LoadAudioPath",
    "MinimaxH3LoadVideoPath",
    "MinimaxH3GetImageRangeFromBatch",
    "MinimaxH3ImageCount",
    "MinimaxH3ScriptConverter",
    "MinimaxH3CropVideoByFrame",
    "keep_frame_slice",
]
