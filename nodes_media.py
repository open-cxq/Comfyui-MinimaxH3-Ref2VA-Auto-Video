# -*- coding: utf-8 -*-
"""Image batch helpers and video crop nodes."""
from __future__ import annotations

from comfy_api.latest import io

from .nodes_common import CATEGORY, COMPONENT_NAME

KEEP_PART_FRONT = "前部分"
KEEP_PART_BACK = "后部分"
CROP_FROM_HEAD = "从头截起"
CROP_FROM_TAIL = "从尾截起"
INTERVAL_OPEN = "开区间(a,b)"
INTERVAL_CLOSED = "闭区间[a,b]"
INTERVAL_LCRO = "左闭右开[a,b)"
INTERVAL_LORC = "左开右闭(a,b]"


def keep_frame_slice(total, start_frame, keep_part, interval, crop_from=CROP_FROM_HEAD):
    """Map (start_frame, keep part, interval, crop_from) to a Python [start, end) slice.

    Front uses [0, a]; back uses [a, n] where n is the frame count (last index n-1).
    从头截起：a 从片头数。例 n=200,a=5,后部分,闭区间 → [5,200]（帧 5..199）。
    从尾截起：a 从片尾数。例 n=200,a=5,后部分,闭区间 → [195,200]（帧 195..199）。
    """
    n = int(total)
    a = int(start_frame)
    if n <= 0:
        raise ValueError("视频没有可裁剪的帧")
    if a < 0:
        raise ValueError("开始帧数不能为负")
    if crop_from == CROP_FROM_TAIL:
        a = n - a
    if keep_part == KEEP_PART_BACK:
        lo, hi = a, n
    else:
        lo, hi = 0, a
    if interval == INTERVAL_OPEN:
        start, end = lo + 1, hi
    elif interval == INTERVAL_LORC:
        start, end = lo + 1, hi + 1
    elif interval == INTERVAL_CLOSED:
        start, end = lo, hi + 1
    else:
        start, end = lo, hi
    start = max(0, start)
    end = min(n, end)
    if start >= end:
        raise ValueError(
            "裁剪结果为空：总帧 %s，开始帧 %s，%s，%s，%s"
            % (n, start_frame, crop_from, keep_part, interval)
        )
    return start, end


class MinimaxH3GetImageRangeFromBatch(io.ComfyNode):
    """替换 comfyui-kjnodes 的 GetImageRangeFromBatch。"""

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3GetImageRangeFromBatch",
            display_name="%s 从批次取图像范围" % COMPONENT_NAME,
            category=CATEGORY,
            description="从图像/遮罩批次中按起始下标与帧数截取一段。start_index=-1 表示取末尾 num_frames 帧。",
            inputs=[
                io.Image.Input("images", display_name="图像", optional=True),
                io.Mask.Input("masks", display_name="遮罩", optional=True),
                io.Int.Input(
                    "start_index",
                    display_name="起始下标",
                    default=0,
                    min=-1,
                    max=4096,
                    tooltip="从 0 起算；-1 表示取批次末尾的 num_frames 帧。",
                ),
                io.Int.Input(
                    "num_frames",
                    display_name="帧数",
                    default=1,
                    min=1,
                    max=4096,
                ),
            ],
            outputs=[
                io.Image.Output("IMAGE", display_name="图像"),
                io.Mask.Output("MASK", display_name="遮罩"),
            ],
        )

    @classmethod
    def execute(cls, start_index=0, num_frames=1, images=None, masks=None):
        try:
            start = int(start_index)
        except (TypeError, ValueError):
            start = 0
        try:
            count = max(1, int(num_frames))
        except (TypeError, ValueError):
            count = 1

        def _slice(batch, label):
            if batch is None:
                return None
            total = int(batch.shape[0])
            if total <= 0:
                raise RuntimeError("%s 批次为空" % label)
            idx = start
            if idx == -1:
                idx = max(0, total - count)
            if idx < 0 or idx >= total:
                raise RuntimeError("%s 起始下标越界: %s (总数 %s)" % (label, idx, total))
            end = min(idx + count, total)
            return batch[idx:end]

        return io.NodeOutput(_slice(images, "图像"), _slice(masks, "遮罩"))


class MinimaxH3ImageCount(io.ComfyNode):
    """替换 comfyui-easy-use 的 easy imageCount。"""

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3ImageCount",
            display_name="%s 图像计数" % COMPONENT_NAME,
            category=CATEGORY,
            description="统计图像批次张数，输出整数。",
            inputs=[io.Image.Input("images", display_name="图像")],
            outputs=[io.Int.Output("count", display_name="整数")],
        )

    @classmethod
    def execute(cls, images):
        if images is None:
            return io.NodeOutput(0)
        return io.NodeOutput(int(images.shape[0]))


class MinimaxH3CropVideoByFrame(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3CropVideoByFrame",
            display_name="%s 按帧裁剪视频" % COMPONENT_NAME,
            category=CATEGORY,
            description=(
                "按开始帧把视频裁成前部分或后部分。"
                "帧下标从 0 起算：200 帧视频的最后一帧是 199。"
                "从头截起、开始帧 5、闭区间：后部分 [5,200]；从尾截起同条件：后部分 [195,200]。"
            ),
            inputs=[
                io.Video.Input("video", display_name="视频"),
                io.Int.Input(
                    "start_frame",
                    display_name="开始帧数",
                    default=5,
                    min=0,
                    max=99999,
                    tooltip=(
                        "分界距离 a（从 0 起算）。"
                        "从头截起：a=5、后部分、闭区间 → [5,200]；"
                        "从尾截起：a=5、后部分、闭区间 → [195,200]。"
                    ),
                ),
                io.Combo.Input(
                    "crop_from",
                    display_name="裁剪形式",
                    options=[CROP_FROM_HEAD, CROP_FROM_TAIL],
                    default=CROP_FROM_HEAD,
                    socketless=True,
                    tooltip="从头截起：开始帧从片头数；从尾截起：开始帧从片尾数。",
                ),
                io.Combo.Input(
                    "keep_part",
                    display_name="保留部分",
                    options=[KEEP_PART_FRONT, KEEP_PART_BACK],
                    default=KEEP_PART_BACK,
                    socketless=True,
                    tooltip="前部分保留分界点之前；后部分保留分界点到片尾（或与裁剪形式组合后的对应一侧）。",
                ),
                io.Combo.Input(
                    "interval",
                    display_name="保留区间",
                    options=[INTERVAL_CLOSED, INTERVAL_OPEN, INTERVAL_LCRO, INTERVAL_LORC],
                    default=INTERVAL_CLOSED,
                    socketless=True,
                    tooltip="闭区间两端都保留。例：从头、后部分、a=5 → [5,200]；从尾同条件 → [195,200]。",
                ),
            ],
            outputs=[io.Video.Output("video", display_name="视频")],
        )

    @classmethod
    def execute(
        cls,
        video,
        start_frame=5,
        crop_from=CROP_FROM_HEAD,
        keep_part=KEEP_PART_BACK,
        interval=INTERVAL_CLOSED,
    ):
        total = int(video.get_frame_count())
        start, end = keep_frame_slice(total, start_frame, keep_part, interval, crop_from)
        fps = float(video.get_frame_rate())
        if fps <= 0:
            raise ValueError("视频帧率为 0，无法按帧裁剪")
        start_t = start / fps
        if end >= total:
            dur = max(0.0, float(video.get_duration()) - start_t)
        else:
            dur = (end - start) / fps
        trimmed = video.as_trimmed(start_t, dur, strict_duration=False)
        if trimmed is None and end >= total:
            dur = max(0.0, float(video.get_duration()) - start_t - 1e-4)
            trimmed = video.as_trimmed(start_t, dur, strict_duration=False)
        if trimmed is None:
            raise ValueError("按帧裁剪失败：总帧 %s，保留 [%s, %s)" % (total, start, end))
        return io.NodeOutput(trimmed)
