# -*- coding: utf-8 -*-
"""Save IMAGE/AUDIO tensors to absolute paths and compute H3 output size."""
from __future__ import annotations

import math
import os
import re
import time
import uuid
import wave

import numpy as np
import torch
from PIL import Image

from .h3_json_io import (
    IMAGES_STEM,
    MERGE_STEM,
    allocate_output_filename,
    input_tmp_dir,
)

ASPECT_RATIOS = {
    "1:1 (Square)": (1, 1),
    "2:3 (Portrait Photo)": (2, 3),
    "3:2 (Photo)": (3, 2),
    "3:4 (Portrait Standard)": (3, 4),
    "4:3 (Standard)": (4, 3),
    "9:16 (Portrait Widescreen)": (9, 16),
    "16:9 (Widescreen)": (16, 9),
    "21:9 (Ultrawide)": (21, 9),
}

MEGAPIXELS = [
    "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "0.98",
    "1.0", "1.2", "1.5", "1.8", "2.0",
]
CANVAS_MULTIPLE = 32


def resolve_wh(ratio, resolution, multiple=CANVAS_MULTIPLE):
    """Same math as official Resolution Selector (Size).

    total_pixels = megapixels * 1024 * 1024
    scale = sqrt(total_pixels / (aw * ah))
    width  = round(aw * scale / multiple) * multiple
    height = round(ah * scale / multiple) * multiple

    See RESOLUTION.md.
    """
    rw, rh = ASPECT_RATIOS.get(ratio, (16, 9))
    try:
        mp = float(resolution)
    except (TypeError, ValueError):
        mp = 0.4
    mp = min(16.0, max(0.1, mp))
    try:
        mult = max(8, int(multiple or CANVAS_MULTIPLE))
    except (TypeError, ValueError):
        mult = CANVAS_MULTIPLE
    scale = math.sqrt((mp * 1024 * 1024) / (rw * rh))
    w = int(round((rw * scale) / mult) * mult)
    h = int(round((rh * scale) / mult) * mult)
    return max(w, mult), max(h, mult)


def work_dir():
    return input_tmp_dir()


def _iter_images(images):
    if images is None:
        return
    if isinstance(images, dict):
        items = []
        for key, val in images.items():
            if val is None:
                continue
            try:
                idx = int(str(key).rsplit("_", 1)[-1])
            except ValueError:
                idx = len(items)
            items.append((idx, val))
        for _, val in sorted(items, key=lambda x: x[0]):
            yield from _iter_images(val)
        return
    arr = images
    if hasattr(arr, "cpu"):
        arr = arr.detach().cpu().numpy()
    arr = np.asarray(arr)
    if arr.ndim == 3:
        arr = arr[None, ...]
    for i in range(arr.shape[0]):
        yield arr[i]


def as_image_batch(images):
    if images is None:
        return None
    if isinstance(images, dict):
        parts = []
        items = []
        for key, val in images.items():
            if val is None:
                continue
            try:
                idx = int(str(key).rsplit("_", 1)[-1])
            except ValueError:
                idx = len(items)
            items.append((idx, val))
        for _, val in sorted(items, key=lambda x: x[0]):
            batch = as_image_batch(val)
            if batch is not None:
                parts.append(batch)
        if not parts:
            return None
        target_h, target_w = int(parts[0].shape[1]), int(parts[0].shape[2])
        aligned = []
        for batch in parts:
            if tuple(batch.shape[1:3]) != (target_h, target_w):
                x = batch.permute(0, 3, 1, 2)
                x = torch.nn.functional.interpolate(
                    x, size=(target_h, target_w), mode="bilinear", align_corners=False
                )
                batch = x.permute(0, 2, 3, 1)
            aligned.append(batch)
        return torch.cat(aligned, dim=0)
    if not hasattr(images, "shape"):
        return None
    if images.ndim == 3:
        return images.unsqueeze(0)
    return images


def save_images(images, prefix="image"):
    paths = []
    root = work_dir()
    kind = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(prefix or "image")).strip("_") or "image"
    for frame in _iter_images(images):
        pix = frame
        if pix.dtype != np.uint8:
            pix = np.clip(pix * 255.0, 0, 255).astype(np.uint8)
        if pix.shape[-1] > 3:
            pix = pix[..., :3]
        im = Image.fromarray(pix)
        path = os.path.abspath(
            os.path.join(root, "tmp_%s_%s.png" % (kind, uuid.uuid4().hex[:12]))
        )
        im.save(path)
        paths.append(path)
    return paths


def _pcm16(audio):
    waveform = audio["waveform"]
    sr = int(audio["sample_rate"])
    if hasattr(waveform, "detach"):
        waveform = waveform.detach().cpu().numpy()
    arr = np.asarray(waveform)
    if arr.ndim == 3:
        arr = arr[0]
    if arr.ndim == 1:
        arr = arr[None, :]
    arr = np.clip(arr, -1.0, 1.0)
    pcm = (arr * 32767.0).astype(np.int16)
    channels = pcm.shape[0]
    interleaved = np.ascontiguousarray(pcm.T).reshape(-1)
    return sr, channels, interleaved.tobytes()


def save_audio(audio, name="audio"):
    if not audio:
        return ""
    sr, channels, data = _pcm16(audio)
    kind = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(name or "audio")).strip("_") or "audio"
    path = os.path.abspath(
        os.path.join(work_dir(), "tmp_%s_%s.wav" % (kind, uuid.uuid4().hex[:12]))
    )
    with wave.open(path, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(data)
    return path


def save_audios(audios, prefix="audio"):
    if not audios:
        return []
    if isinstance(audios, dict) and "waveform" in audios:
        return [save_audio(audios, prefix)]
    paths = []
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
        for _, val in sorted(items, key=lambda x: x[0]):
            paths.append(save_audio(val, prefix))
        return paths
    return [save_audio(audios, prefix)]


def extract_video_frame(video_path: str, which: str = "first", out_dir: str | None = None) -> str:
    """Save first/last frame of a video as PNG under output/.../images/; return absolute path."""
    src = os.path.abspath(str(video_path or "").strip())
    if not src or not os.path.isfile(src):
        raise RuntimeError("视频不存在: %s" % src)
    pos = str(which or "first").strip().lower()
    if pos not in ("first", "last"):
        pos = "first"
    if out_dir:
        root = out_dir
        os.makedirs(root, exist_ok=True)
        out = os.path.abspath(
            os.path.join(
                root,
                "board_frame_%s_%s_%s.png"
                % (pos, time.strftime("%Y%m%d_%H%M%S"), uuid.uuid4().hex[:8]),
            )
        )
    else:
        out, _, _ = allocate_output_filename("images", IMAGES_STEM, ".png")

    err_cv = None
    try:
        import cv2

        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            raise RuntimeError("OpenCV 无法打开视频")
        try:
            if pos == "last":
                total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                if total > 1:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, total - 1)
            ok, frame = cap.read()
            if (not ok or frame is None) and pos == "last":
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                last = None
                while True:
                    ok2, fr = cap.read()
                    if not ok2:
                        break
                    last = fr
                if last is not None:
                    ok, frame = True, last
            if not ok or frame is None:
                raise RuntimeError("读取视频帧失败")
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            Image.fromarray(rgb).save(out)
            return out
        finally:
            cap.release()
    except Exception as exc:
        err_cv = exc

    # ffmpeg fallback
    import shutil as _shutil
    import subprocess

    ffmpeg = _shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("抽帧失败（OpenCV: %s；且未找到 ffmpeg）" % err_cv)
    if pos == "last":
        cmd = [ffmpeg, "-y", "-sseof", "-0.05", "-i", src, "-frames:v", "1", out]
    else:
        cmd = [ffmpeg, "-y", "-i", src, "-frames:v", "1", out]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not os.path.isfile(out):
        raise RuntimeError("ffmpeg 抽帧失败: %s" % ((proc.stderr or proc.stdout or "")[-400:]))
    return out


def catalog_lines(image_paths, audio_paths, bg_audio_path):
    lines = []
    for i, path in enumerate(image_paths, start=1):
        lines.append("参考图 %d 绝对路径: %s" % (i, path))
    for i, path in enumerate(audio_paths, start=1):
        lines.append("参考音频 %d 绝对路径: %s" % (i, path))
    if bg_audio_path:
        lines.append("背景音频绝对路径: %s" % bg_audio_path)
    if not lines:
        lines.append("无参考图、参考音频、背景音频。对应路径字段必须留空字符串。")
    return "\n".join(lines)


def _ffmpeg_bin():
    import shutil as _shutil

    exe = _shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("未找到 ffmpeg，无法合成成片")
    return exe


def _normalize_film_clips(videos):
    clips = []
    for raw in videos or []:
        if isinstance(raw, dict):
            path = os.path.abspath(str(raw.get("path") or "").strip())
            try:
                start = float(raw.get("in") or 0)
            except (TypeError, ValueError):
                start = 0.0
            try:
                end = float(raw.get("out") or 0)
            except (TypeError, ValueError):
                end = 0.0
        else:
            path = os.path.abspath(str(raw or "").strip())
            start = 0.0
            end = 0.0
        if not path or not os.path.isfile(path):
            raise RuntimeError("视频不存在: %s" % (raw if not isinstance(raw, dict) else path))
        clips.append({"path": path, "start": max(0.0, start), "end": max(0.0, end)})
    if not clips:
        raise RuntimeError("没有可合成的视频")
    return clips


def _probe_has_audio(ffmpeg: str, path: str) -> bool:
    import shutil as _shutil
    import subprocess

    ffprobe = _shutil.which("ffprobe")
    if not ffprobe and ffmpeg:
        cand = ffmpeg.replace("ffmpeg", "ffprobe").replace("FFMPEG", "ffprobe")
        if os.path.isfile(cand):
            ffprobe = cand
    if not ffprobe:
        return True
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
        return proc.returncode == 0 and "audio" in (proc.stdout or "").lower()
    except Exception:
        return True


def _clamp_playback_speed(speed):
    try:
        rate = float(speed)
    except (TypeError, ValueError):
        rate = 1.0
    if not math.isfinite(rate) or rate <= 0:
        rate = 1.0
    return min(4.0, max(0.25, rate))


def _atempo_chain(rate):
    """Build atempo filter chain; each stage must stay within [0.5, 2.0]."""
    r = float(rate)
    parts = []
    # Push rate into the legal window by stacking 2.0 / 0.5 stages.
    while r > 2.0 + 1e-9:
        parts.append("atempo=2.0")
        r /= 2.0
    while r < 0.5 - 1e-9:
        parts.append("atempo=0.5")
        r /= 0.5
    parts.append("atempo=%.6f" % r)
    return ",".join(parts)


def _ffmpeg_speed_rewrite(ffmpeg, src, dst, speed):
    """Time-compress/expand video+audio to `speed` (2.0 => half duration)."""
    import subprocess

    rate = _clamp_playback_speed(speed)
    if abs(rate - 1.0) < 1e-6:
        import shutil as _shutil

        _shutil.copy2(src, dst)
        return dst
    has_a = _probe_has_audio(ffmpeg, src)
    if has_a:
        filt = "[0:v]setpts=PTS/%.6f[v];[0:a]%s[a]" % (rate, _atempo_chain(rate))
        cmd = [
            ffmpeg,
            "-y",
            "-i",
            src,
            "-filter_complex",
            filt,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            dst,
        ]
    else:
        cmd = [
            ffmpeg,
            "-y",
            "-i",
            src,
            "-vf",
            "setpts=PTS/%.6f" % rate,
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            dst,
        ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not os.path.isfile(dst):
        raise RuntimeError("成片倍速处理失败: %s" % ((proc.stderr or proc.stdout or "")[-500:]))
    return dst


def compose_film(
    videos,
    bgm=None,
    out_dir=None,
    bgm_volume=1.0,
    formal_merge=False,
    speed=1.0,
    bgm_follow_speed=False,
):
    """Concat board shot videos in order; keep shot audio; optionally mix looping BGM.

    clips may be path strings or {path, in, out} dicts (out<=0 means to EOF).
    Default writes a temp file under input/.../tmp. With formal_merge=True (or an
    explicit out_dir), writes under output/.../merge with sequential naming.
    `speed` > 1 shortens the film (2.0 => half duration). When mixing BGM,
    `bgm_follow_speed` controls whether BGM is time-stretched with the picture.
    """
    import shutil as _shutil
    import subprocess
    import tempfile

    clips = _normalize_film_clips(videos)
    rate = _clamp_playback_speed(speed)
    follow_bgm = bool(bgm_follow_speed)

    bgm_path = ""
    if bgm:
        bgm_path = os.path.abspath(str(bgm).strip())
        if not os.path.isfile(bgm_path):
            # Stale path from a previous script upload — continue without BGM.
            print("[H3 Ref2VA Auto] 背景音乐不存在，已跳过: %s" % bgm)
            bgm_path = ""
    try:
        vol = float(bgm_volume)
    except (TypeError, ValueError):
        vol = 1.0
    vol = min(2.0, max(0.0, vol))

    if out_dir:
        root = out_dir
        os.makedirs(root, exist_ok=True)
        out_name = "film_%s_%s.mp4" % (
            time.strftime("%Y%m%d_%H%M%S"),
            uuid.uuid4().hex[:8],
        )
        out_path = os.path.abspath(os.path.join(root, out_name))
    elif formal_merge:
        out_path, _, _ = allocate_output_filename("merge", MERGE_STEM, ".mp4")
    else:
        root = work_dir()
        out_name = "tmp_film_%s_%s.mp4" % (
            time.strftime("%Y%m%d_%H%M%S"),
            uuid.uuid4().hex[:8],
        )
        out_path = os.path.abspath(os.path.join(root, out_name))
    ffmpeg = _ffmpeg_bin()
    tmp_dir = tempfile.mkdtemp(prefix="h3_film_")
    try:
        parts = []
        for i, clip in enumerate(clips):
            part = os.path.join(tmp_dir, "c_%02d.mp4" % i)
            has_a = _probe_has_audio(ffmpeg, clip["path"])
            dur = None
            if clip["end"] > clip["start"] + 0.05:
                dur = clip["end"] - clip["start"]

            def _base_cmd():
                cmd = [ffmpeg, "-y"]
                if clip["start"] > 0.001:
                    cmd.extend(["-ss", "%.3f" % clip["start"]])
                cmd.extend(["-i", clip["path"]])
                return cmd

            if has_a:
                cmd_part = _base_cmd()
                if dur is not None:
                    cmd_part.extend(["-t", "%.3f" % dur])
                cmd_part.extend(
                    [
                        "-vf",
                        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-c:a",
                        "aac",
                        "-ar",
                        "44100",
                        "-ac",
                        "2",
                        "-b:a",
                        "192k",
                        part,
                    ]
                )
            else:
                cmd_part = _base_cmd()
                cmd_part.extend(
                    [
                        "-f",
                        "lavfi",
                        "-i",
                        "anullsrc=channel_layout=stereo:sample_rate=44100",
                    ]
                )
                if dur is not None:
                    cmd_part.extend(["-t", "%.3f" % dur])
                cmd_part.extend(
                    [
                        "-vf",
                        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        "-map",
                        "0:v:0",
                        "-map",
                        "1:a:0",
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-c:a",
                        "aac",
                        "-shortest",
                        part,
                    ]
                )
            proc = subprocess.run(cmd_part, capture_output=True, text=True)
            if (proc.returncode != 0 or not os.path.isfile(part)) and has_a:
                cmd_part = _base_cmd()
                cmd_part.extend(
                    [
                        "-f",
                        "lavfi",
                        "-i",
                        "anullsrc=channel_layout=stereo:sample_rate=44100",
                    ]
                )
                if dur is not None:
                    cmd_part.extend(["-t", "%.3f" % dur])
                cmd_part.extend(
                    [
                        "-vf",
                        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        "-map",
                        "0:v:0",
                        "-map",
                        "1:a:0",
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-c:a",
                        "aac",
                        "-shortest",
                        part,
                    ]
                )
                proc = subprocess.run(cmd_part, capture_output=True, text=True)
            if proc.returncode != 0 or not os.path.isfile(part):
                raise RuntimeError("裁剪片段失败: %s" % ((proc.stderr or proc.stdout or "")[-500:]))
            parts.append(part)

        list_file = os.path.join(tmp_dir, "concat.txt")
        with open(list_file, "w", encoding="utf-8") as fh:
            for p in parts:
                safe = p.replace("\\", "/").replace("'", "'\\''")
                fh.write("file '%s'\n" % safe)

        concat_mp4 = os.path.join(tmp_dir, "concat.mp4")
        cmd_concat = [
            ffmpeg,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            list_file,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            concat_mp4,
        ]
        proc = subprocess.run(cmd_concat, capture_output=True, text=True)
        if proc.returncode != 0 or not os.path.isfile(concat_mp4):
            raise RuntimeError("拼接视频失败: %s" % ((proc.stderr or proc.stdout or "")[-500:]))

        timed_mp4 = concat_mp4
        if abs(rate - 1.0) >= 1e-6:
            sped = os.path.join(tmp_dir, "speed.mp4")
            _ffmpeg_speed_rewrite(ffmpeg, concat_mp4, sped, rate)
            timed_mp4 = sped

        if not bgm_path:
            _shutil.copy2(timed_mp4, out_path)
            return out_path

        bgm_af = (
            "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=%.4f"
            % vol
        )
        if follow_bgm and abs(rate - 1.0) >= 1e-6:
            bgm_af = (
                "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
                "%s,volume=%.4f" % (_atempo_chain(rate), vol)
            )
        cmd_mux = [
            ffmpeg,
            "-y",
            "-i",
            timed_mp4,
            "-stream_loop",
            "-1",
            "-i",
            bgm_path,
            "-filter_complex",
            "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a0];"
            "[1:a]%s[a1];"
            "[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]" % bgm_af,
            "-map",
            "0:v:0",
            "-map",
            "[a]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            out_path,
        ]
        proc = subprocess.run(cmd_mux, capture_output=True, text=True)
        if proc.returncode != 0 or not os.path.isfile(out_path):
            raise RuntimeError("混入背景音乐失败: %s" % ((proc.stderr or proc.stdout or "")[-500:]))
        return out_path
    finally:
        try:
            _shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass
