# -*- coding: utf-8 -*-
"""H3 Ref2VA Auto — ComfyUI custom nodes for MiniMax H3 script-to-video workflows.

Author: cxq（梦想）. License: MIT.
"""
from .nodes import (
    MinimaxH3OpenAIAPI,
    MinimaxH3ScriptComplete,
    MinimaxH3AssetExtract,
    MinimaxH3ShotSplit,
    MinimaxH3ScriptBoard,
    MinimaxH3TextEdit,
    MinimaxH3SaveJson,
    MinimaxH3LoadJson,
    MinimaxH3LoadImagePath,
    MinimaxH3LoadAudioPath,
    MinimaxH3LoadVideoPath,
    MinimaxH3GetImageRangeFromBatch,
    MinimaxH3ImageCount,
    MinimaxH3ScriptConverter,
    MinimaxH3CropVideoByFrame,
)

__version__ = "1.0.0"

NODE_CLASS_MAPPINGS = {
    "MinimaxH3OpenAIAPI": MinimaxH3OpenAIAPI,
    "MinimaxH3ScriptComplete": MinimaxH3ScriptComplete,
    "MinimaxH3AssetExtract": MinimaxH3AssetExtract,
    "MinimaxH3ShotSplit": MinimaxH3ShotSplit,
    "MinimaxH3ScriptBoard": MinimaxH3ScriptBoard,
    "MinimaxH3TextEdit": MinimaxH3TextEdit,
    "MinimaxH3SaveJson": MinimaxH3SaveJson,
    "MinimaxH3LoadJson": MinimaxH3LoadJson,
    "MinimaxH3LoadImagePath": MinimaxH3LoadImagePath,
    "MinimaxH3LoadAudioPath": MinimaxH3LoadAudioPath,
    "MinimaxH3LoadVideoPath": MinimaxH3LoadVideoPath,
    "MinimaxH3GetImageRangeFromBatch": MinimaxH3GetImageRangeFromBatch,
    "MinimaxH3ImageCount": MinimaxH3ImageCount,
    "MinimaxH3ScriptConverter": MinimaxH3ScriptConverter,
    "MinimaxH3CropVideoByFrame": MinimaxH3CropVideoByFrame,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MinimaxH3OpenAIAPI": "H3 Ref2VA Auto OpenAI API",
    "MinimaxH3ScriptComplete": "H3 Ref2VA Auto 剧本补全",
    "MinimaxH3AssetExtract": "H3 Ref2VA Auto 资产提取",
    "MinimaxH3ShotSplit": "H3 Ref2VA Auto 分镜拆解",
    "MinimaxH3ScriptBoard": "H3 Ref2VA Auto 剧本预览与编辑",
    "MinimaxH3TextEdit": "H3 Ref2VA Auto 编辑文本",
    "MinimaxH3SaveJson": "H3 Ref2VA Auto 保存JSON文件",
    "MinimaxH3LoadJson": "H3 Ref2VA Auto 加载JSON文件",
    "MinimaxH3LoadImagePath": "H3 Ref2VA Auto 按路径加载图片",
    "MinimaxH3LoadAudioPath": "H3 Ref2VA Auto 按路径加载音频",
    "MinimaxH3LoadVideoPath": "H3 Ref2VA Auto 按路径加载视频",
    "MinimaxH3GetImageRangeFromBatch": "H3 Ref2VA Auto 从批次取图像范围",
    "MinimaxH3ImageCount": "H3 Ref2VA Auto 图像计数",
    "MinimaxH3ScriptConverter": "H3 Ref2VA Auto H3剧本转换器",
    "MinimaxH3CropVideoByFrame": "H3 Ref2VA Auto 按帧裁剪视频",
}

WEB_DIRECTORY = "./web/js"

try:
    from . import routes as _routes

    _routes.register_routes()
except Exception as exc:
    print("[H3 Ref2VA Auto] 路由注册失败:", exc)

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
    "__version__",
]
