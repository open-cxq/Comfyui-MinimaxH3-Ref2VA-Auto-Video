# -*- coding: utf-8 -*-
"""LLM-backed H3 Ref2VA Auto nodes."""
from __future__ import annotations

import json

from comfy_api.latest import io

from .h3_board import dumps_board, finalize_script_convert
from .h3_llm import (
    NO_MODEL_PLACEHOLDER,
    SETTINGS_MENU,
    list_openai_model_options,
    llm_generate,
    llm_generate_json,
    make_openai_llm,
    resolve_openai_api_key,
    resolve_openai_model,
)
from .h3_media import (
    MEGAPIXELS,
    as_image_batch,
    catalog_lines,
    resolve_wh,
    save_audio,
    save_audios,
    save_images,
)
from .h3_parse import (
    asset_brief_for_shot_llm,
    extract_json,
    fill_shots_info,
    load_knowledge_dir,
    normalize_asset,
    script_complete_result,
)
from .nodes_common import (
    CATEGORY,
    COMPONENT_NAME,
    H3LLM,
    KNOWLEDGE_DIR,
    RATIO_OPTIONS,
    fill,
    first_audio,
    gen_kwargs,
    images_input,
    model_input,
    template,
)


class MinimaxH3OpenAIAPI(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        model_options = list_openai_model_options()
        default_model = resolve_openai_model() or model_options[0]
        if default_model not in model_options:
            model_options = [default_model] + model_options
        return io.Schema(
            node_id="MinimaxH3OpenAIAPI",
            display_name="%s OpenAI API" % COMPONENT_NAME,
            category=CATEGORY,
            description=(
                (
                    "OpenAI 兼容 Chat Completions。"
                    "API Key / Base URL 仅在「设置 → %s」配置，不会写入工作流 JSON。"
                    "模型列表来自 /v1/models。"
                )
                % SETTINGS_MENU
            ),
            inputs=[
                io.Combo.Input(
                    "model",
                    options=model_options,
                    default=default_model,
                    display_name="模型",
                    tooltip=(
                        "从「设置 → %s」配置的 API 拉取 /v1/models。"
                        "改 Key/URL 后可在设置页点「刷新模型列表」，并刷新节点定义。"
                    )
                    % SETTINGS_MENU,
                ),
                io.Int.Input(
                    "timeout",
                    display_name="超时(秒)",
                    default=180,
                    min=10,
                    max=3600,
                    step=10,
                ),
            ],
            outputs=[
                H3LLM.Output("llm", display_name="外部模型"),
            ],
        )

    @classmethod
    def execute(cls, model, timeout=180):
        if not resolve_openai_api_key():
            raise RuntimeError(
                (
                    "未配置 OpenAI API Key。请到 ComfyUI「设置 → %s → OpenAI API Key」填写，"
                    "或设置环境变量 OPENAI_API_KEY。"
                )
                % SETTINGS_MENU
            )
        chosen = resolve_openai_model(model)
        if not chosen or chosen == NO_MODEL_PLACEHOLDER:
            raise RuntimeError(
                (
                    "未选择模型。请到「设置 → %s」配置 API 后刷新模型列表，"
                    "并在本节点选择模型。"
                )
                % SETTINGS_MENU
            )
        return io.NodeOutput(make_openai_llm(chosen, timeout=timeout))


class MinimaxH3ScriptComplete(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3ScriptComplete",
            display_name="%s 剧本补全" % COMPONENT_NAME,
            category=CATEGORY,
            description="解析用户需求，补全故事逻辑、情感基调和总时长，生成完整叙事脚本。",
            inputs=[
                model_input(),
                images_input(),
                io.String.Input("prompt", display_name="用户提示词", multiline=True, default=""),
                io.Int.Input("duration", display_name="时长", default=10, min=1, max=600, step=1),
                io.Boolean.Input(
                    "duration_recommend",
                    display_name="时长推荐",
                    default=False,
                    tooltip="关闭：最终时长强制等于「时长」。开启：模型按叙事密度独立评估，用户时长仅作粗估参考。",
                ),
                io.Boolean.Input(
                    "thinking",
                    display_name="是否深度思考",
                    default=False,
                    tooltip="本地 CLIP 支持 thinking 时开启；外部 OpenAI API 会忽略此项。",
                ),
                io.Int.Input(
                    "seed",
                    display_name="种子",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
                    control_after_generate=True,
                ),
                io.Int.Input(
                    "max_length",
                    display_name="最大输出内容长度",
                    default=2048,
                    min=64,
                    max=32768,
                    step=64,
                ),
            ],
            outputs=[
                io.String.Output(
                    "script",
                    display_name="剧本文本",
                    tooltip="从模型 JSON 的 script 字段提取出的纯文本剧本。",
                ),
                io.Int.Output("duration", display_name="最终时长"),
                io.String.Output(
                    "result_json",
                    display_name="结果JSON",
                    tooltip="规范化后的完整结果：含 script、duration 等字段。",
                ),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs):
        return float("nan")

    @classmethod
    def execute(
        cls,
        model,
        prompt,
        duration,
        duration_recommend,
        thinking=False,
        seed=0,
        max_length=2048,
        images=None,
    ):
        mode_hint = (
            "判定规则：若用户已给出多镜/时间码/对白等细写→按完整稿忠实整理，禁止加戏；"
            "若只有标题或一句话（如「卖火柴的小女孩」）→必须补全为有人物、场景、分镜与对白的可拍剧本，"
            "禁止只输出总时长或空壳 script。"
        )
        if duration_recommend:
            rec_block = (
                "duration_recommend=true\n"
                "含义：必须按「讲完故事所需」独立填写 JSON.duration，禁止把用户粗估值原样写入 duration。\n"
                "用户粗估值（秒，仅供参考，禁止照抄）=%d\n"
                "残缺稿（如只有故事名）：完整可拍短剧常见 30–120 秒；"
                "像《卖火柴的小女孩》这类有起承转合的故事，通常至少 40–90 秒，"
                "禁止压成与粗估值相同的超短片。"
                % int(duration)
            )
            question = (
                "用户提示词：\n%s\n\n【时长控制】\n%s\n\n【整理规则】\n%s"
                % ((prompt or "").strip() or "（空）", rec_block, mode_hint)
            )
        else:
            rec_block = (
                "duration_recommend=false\n"
                "含义：JSON.duration 必须等于 %d，禁止改写；剧情须写满该秒数可拍内容。"
                % int(duration)
            )
            question = (
                "用户提示词：\n%s\n\n【时长控制】\n%s\n\n【整理规则】\n%s"
                % ((prompt or "").strip() or "（空）", rec_block, mode_hint)
            )
        filled = fill(template("script_complete.txt"), "##question##", question)
        print(
            "[MinimaxH3ScriptComplete] duration=%s recommend=%s seed=%s\n%s"
            % (duration, bool(duration_recommend), seed, question[:500])
        )
        data, raw = llm_generate_json(
            model,
            filled,
            image=as_image_batch(images),
            max_retries=2,
            **gen_kwargs(thinking, max_length, seed),
        )
        script, final_duration = script_complete_result(
            data,
            fallback_duration=int(duration),
            recommend=bool(duration_recommend),
        )
        result_json = json.dumps(
            {
                "script": script,
                "duration": final_duration,
                "complete": True,
            },
            ensure_ascii=False,
            indent=2,
        )
        return io.NodeOutput(script, final_duration, result_json)


class MinimaxH3AssetExtract(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3AssetExtract",
            display_name="%s 资产提取" % COMPONENT_NAME,
            category=CATEGORY,
            description="解析剧情元素，提取角色、道具、场景资产；参考图/音频按内容绑定绝对路径。",
            inputs=[
                model_input(),
                io.String.Input("script", display_name="剧本", multiline=True, default=""),
                images_input(),
                io.Autogrow.Input(
                    "audios",
                    optional=True,
                    tooltip="角色/道具音色参考（audio_0、audio_1…）。无则留空。",
                    template=io.Autogrow.TemplatePrefix(
                        input=io.Audio.Input("audio"),
                        prefix="audio_",
                        min=0,
                        max=8,
                    ),
                ),
                io.Audio.Input("background_audio", display_name="背景音频", optional=True),
                io.String.Input("prompt", display_name="用户提示词", multiline=True, default=""),
                io.Combo.Input("ratio", display_name="宽高比", options=RATIO_OPTIONS, default="16:9 (Widescreen)"),
                io.Combo.Input("resolution", display_name="分辨率", options=MEGAPIXELS, default="0.4"),
                io.Int.Input("duration", display_name="总时长", default=10, min=1, max=600, step=1),
                io.Boolean.Input(
                    "thinking",
                    display_name="是否深度思考",
                    default=False,
                    tooltip="本地 CLIP 支持 thinking 时开启；外部 OpenAI API 会忽略此项。",
                ),
                io.Int.Input(
                    "seed",
                    display_name="种子",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
                    control_after_generate=True,
                ),
                io.Int.Input(
                    "max_length",
                    display_name="最大输出内容长度",
                    default=2048,
                    min=64,
                    max=32768,
                    step=64,
                ),
            ],
            outputs=[
                io.String.Output("assets_json", display_name="资产结果JSON"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs):
        return float("nan")

    @classmethod
    def execute(
        cls,
        model,
        script,
        prompt,
        ratio,
        resolution,
        duration,
        thinking=False,
        seed=0,
        max_length=2048,
        images=None,
        audios=None,
        background_audio=None,
    ):
        width, height = resolve_wh(ratio, resolution)
        image = as_image_batch(images)
        image_paths = save_images(image, "ref_image") if image is not None else []
        audio_paths = save_audios(audios, "ref_audio")
        bg_path = save_audio(background_audio, "background_audio") if background_audio else ""
        catalog = catalog_lines(image_paths, audio_paths, bg_path)
        question = (
            "剧本：\n%s\n\n用户提示词：\n%s\n\n"
            "duration=%d\nwidth=%d\nheight=%d\nratio=%s\nresolution=%s MP\n\n媒体路径：\n%s"
            % (
                (script or "").strip(),
                (prompt or "").strip() or "（空）",
                int(duration),
                width,
                height,
                ratio,
                resolution,
                catalog,
            )
        )
        filled = fill(template("asset_extract.txt"), "##question##", question)
        data, raw = llm_generate_json(
            model,
            filled,
            image=image,
            audio=first_audio(audios) or background_audio,
            max_retries=2,
            **gen_kwargs(thinking, max_length, seed),
        )
        asset = normalize_asset(data, script, duration, width, height, bg_path)
        return io.NodeOutput(json.dumps(asset, ensure_ascii=False, indent=2))


class MinimaxH3ShotSplit(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3ShotSplit",
            display_name="%s 分镜拆解" % COMPONENT_NAME,
            category=CATEGORY,
            description="按 knowledge/ 中的 Ref2VA 知识生成分镜提示词，并拆成 shots_info。",
            inputs=[
                model_input(),
                io.String.Input("assets_json", display_name="资产结果JSON", multiline=True, default=""),
                io.String.Input("prompt", display_name="用户提示词", multiline=True, default=""),
                io.Boolean.Input(
                    "thinking",
                    display_name="是否深度思考",
                    default=False,
                    tooltip="本地 CLIP 支持 thinking 时开启；外部 OpenAI API 会忽略此项。",
                ),
                io.Int.Input(
                    "seed",
                    display_name="种子",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
                    control_after_generate=True,
                ),
                io.Int.Input(
                    "max_length",
                    display_name="最大输出内容长度",
                    default=4096,
                    min=64,
                    max=32768,
                    step=64,
                ),
            ],
            outputs=[
                io.String.Output("shots_json", display_name="分镜资产结果JSON"),
                io.String.Output("script", display_name="剧本文本"),
                io.String.Output("shots_prompt", display_name="H3剧本提示词"),
                io.String.Output("global_prompt", display_name="全局提示词"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs):
        return float("nan")

    @classmethod
    def execute(cls, model, assets_json, prompt, thinking=False, seed=0, max_length=4096):
        asset = extract_json(assets_json)
        if not isinstance(asset, dict):
            raise RuntimeError("资产结果JSON 无效。")
        bg = str((asset.get("global") or {}).get("background_audio") or "").strip()
        forbid = (
            "已提供 background_audio（参考音轨）：non_diegetic_music 必须写 N/A，禁止再编配乐，仅保留音效和对白。"
            if bg
            else (
                "未提供 background_audio（没有参考音轨文件）。"
                "请照常撰写 non_diegetic_music 配乐描述，不要因为没上传音频就写 N/A；"
                "仅当用户明确要求无配乐时才写 N/A。"
            )
        )
        brief = asset_brief_for_shot_llm(asset)
        question = (
            "剧本：\n%s\n\n用户提示词：\n%s\n\n资产摘要：\n%s\n\n%s\n总时长 %d 秒。"
            % (
                str(asset.get("script") or "").strip() or "（空）",
                (prompt or "").strip() or "（空）",
                json.dumps(brief, ensure_ascii=False, indent=2),
                forbid,
                int(asset.get("duration") or 10),
            )
        )
        tmpl = fill(template("shot_prompt.txt"), "##KB##", load_knowledge_dir(KNOWLEDGE_DIR))
        filled = fill(tmpl, "##question##", question)
        gen = gen_kwargs(thinking, max_length, seed)
        shots_prompt = llm_generate(model, filled, **gen)
        filled_asset = fill_shots_info(asset, shots_prompt, [], forbid_bgm=bool(bg))
        g = filled_asset.get("global") if isinstance(filled_asset.get("global"), dict) else {}
        return io.NodeOutput(
            json.dumps(filled_asset, ensure_ascii=False, indent=2),
            str(filled_asset.get("script") or ""),
            str(filled_asset.get("shots_prompt") or shots_prompt or "").strip(),
            str(g.get("global_prompt") or "").strip(),
        )


class MinimaxH3ScriptConverter(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MinimaxH3ScriptConverter",
            display_name="%s H3剧本转换器" % COMPONENT_NAME,
            category=CATEGORY,
            description=(
                "把任意格式的剧本/分镜稿经 LLM 转成【分镜资产结果JSON】，"
                "可直接连接「剧本预览与编辑」。中英双份时以英文为准。"
            ),
            inputs=[
                model_input(),
                io.String.Input(
                    "script",
                    display_name="剧本/分镜原文",
                    multiline=True,
                    default="",
                    tooltip="粘贴任意格式原文：H3 skill 稿、中英剧本、大纲、分镜表等均可。",
                ),
                images_input(),
                io.Autogrow.Input(
                    "audios",
                    optional=True,
                    tooltip="角色/道具音色参考（audio_0、audio_1…）。无则留空。",
                    template=io.Autogrow.TemplatePrefix(
                        input=io.Audio.Input("audio"),
                        prefix="audio_",
                        min=0,
                        max=8,
                    ),
                ),
                io.Audio.Input("background_audio", display_name="背景音频", optional=True),
                io.String.Input("prompt", display_name="用户提示词", multiline=True, default=""),
                io.Combo.Input(
                    "ratio",
                    display_name="宽高比",
                    options=RATIO_OPTIONS,
                    default="16:9 (Widescreen)",
                ),
                io.Combo.Input(
                    "resolution",
                    display_name="分辨率",
                    options=MEGAPIXELS,
                    default="0.4",
                ),
                io.Boolean.Input(
                    "thinking",
                    display_name="是否深度思考",
                    default=False,
                    tooltip="本地 CLIP 支持 thinking 时开启；外部 OpenAI API 会忽略此项。",
                ),
                io.Int.Input(
                    "seed",
                    display_name="种子",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
                    control_after_generate=True,
                ),
                io.Int.Input(
                    "max_length",
                    display_name="最大输出内容长度",
                    default=8192,
                    min=64,
                    max=32768,
                    step=64,
                ),
            ],
            outputs=[
                io.String.Output(
                    "shots_json",
                    display_name="分镜资产结果JSON",
                    tooltip="直接连接到「剧本预览与编辑」的分镜资产结果JSON。",
                ),
                io.String.Output("script_name", display_name="剧本名称"),
                io.Int.Output("duration", display_name="总时长"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs):
        return float("nan")

    @classmethod
    def execute(
        cls,
        model,
        script,
        prompt="",
        ratio="16:9 (Widescreen)",
        resolution="0.4",
        thinking=False,
        seed=0,
        max_length=8192,
        images=None,
        audios=None,
        background_audio=None,
    ):
        raw_script = str(script or "").strip()
        if not raw_script:
            raise RuntimeError("剧本/分镜原文为空。")
        width, height = resolve_wh(ratio, resolution)
        image = as_image_batch(images)
        image_paths = save_images(image, "ref_image") if image is not None else []
        audio_paths = save_audios(audios, "ref_audio")
        bg_path = save_audio(background_audio, "background_audio") if background_audio else ""
        catalog = catalog_lines(image_paths, audio_paths, bg_path)
        if bg_path:
            bg_rule = (
                "已提供 background_audio（参考音轨）：global_prompt 的 non_diegetic_music 必须写 N/A，"
                "禁止再编配乐；overall_soundscape 保留音效。"
            )
        else:
            bg_rule = (
                "未提供 background_audio。未上传背景音乐不等于无配乐。"
                "global_prompt 必须写成 overall_soundscape / non_diegetic_music 两段；"
                "原文有配乐说明就保留，禁止不按格式要求写。"
            )
        question = (
            "用户输入的分镜/剧本原文（格式不固定，请自行理解后转换）：\n%s\n\n用户提示词：\n%s\n\n"
            "width=%d\nheight=%d\nratio=%s\nresolution=%s MP\n\n%s\n\n媒体路径：\n%s"
            % (
                raw_script,
                (prompt or "").strip() or "（空）",
                width,
                height,
                ratio,
                resolution,
                bg_rule,
                catalog,
            )
        )
        filled = fill(template("script_convert.txt"), "##question##", question)
        data, raw = llm_generate_json(
            model,
            filled,
            image=image,
            audio=first_audio(audios) or background_audio,
            max_retries=2,
            **gen_kwargs(thinking, max_length, seed),
        )
        board = finalize_script_convert(
            data,
            raw_script=raw_script,
            width=width,
            height=height,
            bg_path=bg_path,
        )
        return io.NodeOutput(
            dumps_board(board),
            str(board.get("script_name") or ""),
            int(board.get("duration") or 1),
        )
