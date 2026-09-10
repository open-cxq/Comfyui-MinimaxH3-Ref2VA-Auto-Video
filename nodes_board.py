# -*- coding: utf-8 -*-
"""Board and text-edit nodes."""
from __future__ import annotations

from comfy_api.latest import io

from .h3_board import dumps_board, parse_board_json
from .nodes_common import CATEGORY, COMPONENT_NAME


class MinimaxH3ScriptBoard(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3ScriptBoard",
            display_name="%s 剧本预览与编辑" % COMPONENT_NAME,
            category=CATEGORY,
            description=(
                "根据分镜资产结果 JSON 展示并编辑剧情、素材与分镜。"
                "可上传/补全参考图与音频。图片/视频生成接口后续再接。"
            ),
            is_output_node=True,
            inputs=[
                io.String.Input(
                    "shots_json",
                    display_name="分镜资产结果JSON",
                    force_input=True,
                    optional=True,
                    tooltip="连接「分镜拆解」或「H3剧本转换器」的分镜资产结果JSON。",
                ),
                io.String.Input(
                    "edit_json",
                    display_name="编辑JSON",
                    multiline=True,
                    default="",
                    socketless=True,
                    tooltip="由节点 UI 自动维护，勿手改。",
                ),
                io.Boolean.Input(
                    "lock_edit",
                    display_name="锁定编辑",
                    default=False,
                    socketless=True,
                    tooltip="关闭：每次运行用上游覆盖编辑区。开启：保留表单手改并输出手改内容。",
                ),
            ],
            outputs=[
                io.String.Output(
                    "shots_json",
                    display_name="分镜资产结果JSON",
                    tooltip="编辑后的完整分镜资产 JSON（后续可接图片/视频生成）。",
                ),
                io.String.Output(
                    "gen_prompt",
                    display_name="生图提示词",
                    tooltip="连接到「文生图子流程」的 text。看板点生成时按此连线调度，勿靠节点改名猜。",
                ),
                io.Int.Output(
                    "width",
                    display_name="宽",
                    tooltip="可选：连接到文生图/生视频子流程的 width。",
                ),
                io.Int.Output(
                    "height",
                    display_name="高",
                    tooltip="可选：连接到文生图/生视频子流程的 height。",
                ),
                io.String.Output(
                    "video_prompt",
                    display_name="生视频提示词",
                    tooltip="连接到「H3生视频子流程-首分镜/非首分镜」的 prompt。看板点生成时按此连线调度。",
                ),
                io.Int.Output(
                    "duration",
                    display_name="时长",
                    tooltip="可选：连接到生视频子流程的 values.a（时长）。",
                ),
                io.Video.Output(
                    "film_video",
                    display_name="成片视频",
                    tooltip="接到 SaveVideo：合成最终成片后会自动把成片送入该连线保存。全局运行第一阶段不会提前跑这个 SaveVideo。",
                ),
            ],
        )

    @classmethod
    def execute(cls, shots_json=None, edit_json="", lock_edit=False):
        from .h3_path_loaders import load_video_path, placeholder_video

        incoming = str(shots_json or "").strip()
        edited = str(edit_json or "").strip()
        if lock_edit and edited:
            raw = edited
        elif incoming:
            raw = incoming
        else:
            raw = edited
        try:
            data = parse_board_json(raw)
        except RuntimeError:
            data = parse_board_json("{}")
        out = dumps_board(data)
        try:
            width = int(data.get("width") or data.get("with") or 864)
        except (TypeError, ValueError):
            width = 864
        try:
            height = int(data.get("height") or 480)
        except (TypeError, ValueError):
            height = 480
        film_path = str(data.get("film_path") or "").strip()
        if film_path:
            try:
                film_video = load_video_path(film_path)
            except RuntimeError:
                film_video = placeholder_video()
        else:
            film_video = placeholder_video()
        return io.NodeOutput(
            out, "", max(1, width), max(1, height), "", 1, film_video, ui={"shots_json": (out,)}
        )


class MinimaxH3TextEdit(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3TextEdit",
            display_name="%s 编辑文本" % COMPONENT_NAME,
            category=CATEGORY,
            description="预览并编辑文本。默认每次运行用上游覆盖编辑区；勾选「锁定编辑」后保留手改。",
            is_output_node=True,
            inputs=[
                io.String.Input(
                    "text",
                    display_name="文本",
                    force_input=True,
                    optional=True,
                    tooltip="连接上游文本。",
                ),
                io.String.Input(
                    "text_edit",
                    display_name="文本编辑",
                    multiline=True,
                    default="",
                    socketless=True,
                    tooltip="运行后填入当前文本，可直接改。",
                ),
                io.Boolean.Input(
                    "lock_edit",
                    display_name="锁定编辑",
                    default=False,
                    socketless=True,
                    tooltip="关闭：每次运行用上游覆盖编辑区。开启：保留表单手改并输出手改内容。",
                ),
            ],
            outputs=[
                io.String.Output("text", display_name="编辑后文本"),
            ],
        )

    @classmethod
    def execute(cls, text=None, text_edit="", lock_edit=False):
        incoming = text if text is not None else ""
        edited = text_edit if text_edit is not None else ""
        if lock_edit and str(edited).strip():
            out = edited
        elif str(incoming).strip():
            out = incoming
        else:
            out = edited
        return io.NodeOutput(out, ui={"text": (out,)})
