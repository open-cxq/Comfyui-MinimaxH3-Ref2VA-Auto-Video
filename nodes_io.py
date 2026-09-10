# -*- coding: utf-8 -*-
"""JSON save/load and path loader nodes."""
from __future__ import annotations

import json
import os

from comfy_api.latest import io

from .h3_json_io import combo_options, resolve_json_file, save_metadata_json
from .h3_parse import extract_json
from .nodes_common import CATEGORY, COMPONENT_NAME


class MinimaxH3SaveJson(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3SaveJson",
            display_name="%s 保存JSON文件" % COMPONENT_NAME,
            category=CATEGORY,
            description="将分镜资产 JSON 保存到 output/h3_ref2va_auto/data/metadata-{剧名}-{序号}.json。"
            "看板编辑会覆盖同一 metadata_file。",
            is_output_node=True,
            inputs=[
                io.String.Input(
                    "shots_json",
                    display_name="分镜资产结果JSON",
                    force_input=True,
                    tooltip="连接「剧本预览与编辑」的分镜资产结果JSON。",
                ),
            ],
            outputs=[
                io.String.Output("filename", display_name="文件名"),
                io.String.Output("path", display_name="保存路径"),
                io.String.Output("shots_json", display_name="分镜资产结果JSON"),
            ],
        )

    @classmethod
    def execute(cls, shots_json=""):
        text = str(shots_json or "").strip()
        if not text:
            raise ValueError("没有可保存的 JSON")
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            try:
                data = extract_json(text)
            except RuntimeError as exc:
                raise ValueError("保存内容不是有效 JSON") from exc
        if not isinstance(data, dict):
            raise ValueError("保存内容不是 JSON 对象")
        path, filename = save_metadata_json(data, mode="new")
        pretty = json.dumps(data, ensure_ascii=False, indent=2)
        return io.NodeOutput(
            filename,
            path,
            pretty,
            ui={"text": (path,)},
        )


class MinimaxH3LoadJson(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        options = combo_options()
        return io.Schema(
            node_id="MinimaxH3LoadJson",
            display_name="%s 加载JSON文件" % COMPONENT_NAME,
            category=CATEGORY,
            description="从 output/h3_ref2va_auto/data 选择并加载 metadata JSON（不含 input 上传文件）。",
            inputs=[
                io.Combo.Input(
                    "filename",
                    display_name="JSON文件",
                    options=options,
                    default=options[0],
                    socketless=True,
                    tooltip="选择 data/ 下的 metadata-*.json。可用节点上的「上传 JSON」写入 input（不出现在此列表）。",
                ),
            ],
            outputs=[
                io.String.Output("shots_json", display_name="分镜资产结果JSON"),
                io.String.Output("filename", display_name="文件名"),
                io.String.Output("path", display_name="文件路径"),
            ],
        )

    @classmethod
    def validate_inputs(cls, filename=""):
        try:
            resolve_json_file(filename)
        except (ValueError, FileNotFoundError) as exc:
            return str(exc)
        return True

    @classmethod
    def fingerprint_inputs(cls, filename=""):
        try:
            path = resolve_json_file(filename)
            return "%s:%s" % (path, os.path.getmtime(path))
        except (ValueError, FileNotFoundError, OSError):
            return str(filename or "")

    @classmethod
    def execute(cls, filename=""):
        path = resolve_json_file(filename)
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
        json.loads(text)
        return io.NodeOutput(text, os.path.basename(path), path, ui={"text": (text,)})


class MinimaxH3LoadImagePath(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3LoadImagePath",
            display_name="%s 按路径加载图片" % COMPONENT_NAME,
            category=CATEGORY,
            description="从绝对路径加载图片，供看板局部调度注入参考图。",
            inputs=[io.String.Input("path", display_name="图片路径", default="")],
            outputs=[io.Image.Output("image", display_name="图片")],
        )

    @classmethod
    def execute(cls, path=""):
        from .h3_path_loaders import load_image_path

        return io.NodeOutput(load_image_path(path))


class MinimaxH3LoadAudioPath(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3LoadAudioPath",
            display_name="%s 按路径加载音频" % COMPONENT_NAME,
            category=CATEGORY,
            description="从绝对路径加载音频，供看板局部调度注入参考音。",
            inputs=[io.String.Input("path", display_name="音频路径", default="")],
            outputs=[io.Audio.Output("audio", display_name="音频")],
        )

    @classmethod
    def execute(cls, path=""):
        from .h3_path_loaders import load_audio_path

        return io.NodeOutput(load_audio_path(path))


class MinimaxH3LoadVideoPath(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3LoadVideoPath",
            display_name="%s 按路径加载视频" % COMPONENT_NAME,
            category=CATEGORY,
            description="从绝对路径加载视频，供非首分镜承接上一镜。",
            inputs=[io.String.Input("path", display_name="视频路径", default="")],
            outputs=[io.Video.Output("video", display_name="视频")],
        )

    @classmethod
    def execute(cls, path=""):
        from .h3_path_loaders import load_video_path

        return io.NodeOutput(load_video_path(path))
