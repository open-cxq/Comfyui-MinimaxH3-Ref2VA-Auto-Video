# H3 Ref2VA Auto

**v1.0.0** — MiniMax H3 Ref2VA 自动分镜与看板插件。

用本地模型或 OpenAI 兼容接口，把一句话或剧本整理成可拍剧本，自动提取角色、道具、场景资产，再自动按 Ref2VA 格式拆分镜，并在看板上编辑、剪辑、单分镜抽卡、上传参考等多种操作，通过调度生图子流程、生视频子流程，来完成分镜无缝衔接和视频成片创作。

- 作者：cxq（梦想）
- 协议：开源 [MIT](LICENSE)
- 仓库：[github.com/open-cxq/Comfyui-MinimaxH3-Ref2VA-Auto-Video](https://github.com/open-cxq/Comfyui-MinimaxH3-Ref2VA-Auto-Video)
- English: [README_EN.md](README_EN.md)

`knowledge/ref-en.txt` 是 MiniMax H3 Ref2VA 全参考模式的提示词格式说明，供分镜拆解使用；格式文档来源 MiniMax H3 官方 Skill。

## 功能

- 支持剧本编写：本地模型和外部 API 接口。
- 支持剧本生成与编辑。
- 支持剧本资产结构化提取：人物、道具、场景。
- 支持结合 MiniMax H3 技能完成分镜拆解，包含标题、剧本、素材、分镜剧本、出场素材等，形成分镜结构化数据资产。
- 支持直接加载已有分镜资产文件，继续创作。
- 支持将 H3 剧本格式直接转换为分镜资产。
- 支持背景音乐，以及背景音乐音量调节与成片合并。
- 支持角色声音音频参考。
- 支持所需素材（人物、道具、场景）自定义增删改查。
- 支持分镜增删改查。
- 支持一键生成全部分镜。
- 支持重新生成单个分镜。
- 支持上一镜视频参考和尾帧参考，完成分镜无缝衔接、一镜到底。
- 支持成片时间线预览和播放，多分镜总体预览。
- 支持各分镜简单剪辑。
- 支持背景音乐和原视频声音的简单操作。
- 支持合成最终成片。
- 支持功能解耦，可自定义生图和生视频子流程。
- 支持按帧截取视频。

## 目录

- [功能](#功能)
- [安装](#安装)
- [配置](#配置)
- [节点](#节点)
- [资产路径](#资产路径)
- [分辨率参考](#分辨率参考)
- [看板](#看板)
- [示例工作流](#示例工作流)
- [免责声明](#免责声明)

## 安装

1. 将本仓库放到 `ComfyUI/custom_nodes/Comfyui-MinimaxH3-Ref2VA-Auto-Video`：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/open-cxq/Comfyui-MinimaxH3-Ref2VA-Auto-Video.git
```

2. 重启 ComfyUI。

本插件不额外要求 pip 包，依赖 ComfyUI 自带环境。可选：配置 OpenAI 兼容接口，或连接内置「加载 CLIP」。

## 配置

打开 ComfyUI **设置 → H3 Ref2VA Auto**：

- OpenAI API Key
- Base URL（默认 `https://api.openai.com/v1`，也可填兼容网关）
- 模型；可刷新 `/v1/models` 列表

Key 与 URL **只存在设置里**，不会写入工作流 JSON。也可使用环境变量 `OPENAI_API_KEY`。

## 节点

| 节点 ID | 显示名 | 作用 |
| --- | --- | --- |
| `MinimaxH3OpenAIAPI` | OpenAI API | 输出外部 LLM 句柄 |
| `MinimaxH3ScriptComplete` | 剧本补全 | 整理/补全剧情与时长 |
| `MinimaxH3AssetExtract` | 资产提取 | 角色/道具/场景 JSON |
| `MinimaxH3ShotSplit` | 分镜拆解 | 按 knowledge 生成分镜 |
| `MinimaxH3ScriptConverter` | H3剧本转换器 | 任意稿转看板 JSON |
| `MinimaxH3ScriptBoard` | 剧本预览与编辑 | 看板 |
| `MinimaxH3TextEdit` | 编辑文本 | 可锁定手改 |
| `MinimaxH3SaveJson` / `LoadJson` | 保存/加载 JSON | `output/.../data` |
| `MinimaxH3LoadImagePath` / `LoadAudioPath` / `LoadVideoPath` | 按路径加载 | 看板局部调度注入 |
| `MinimaxH3GetImageRangeFromBatch` | 从批次取图像范围 | 取帧 |
| `MinimaxH3ImageCount` | 图像计数 | 张数 |
| `MinimaxH3CropVideoByFrame` | 按帧裁剪视频 | 首/尾裁切 |

建议链路：OpenAI API 或 CLIP → 剧本补全 → 资产提取 → 分镜拆解 → 看板 → 保存 JSON。看板的「生图提示词 / 宽高 / 生视频提示词 / 成片视频」接到你自己的文生图、H3 生视频子流程与 SaveVideo。

LLM JSON 会先本地修语法（含字符串内真换行），解析失败再让模型重写，最多 2 次。

## 资产路径

均在本机 ComfyUI 目录下，插件不会上传到互联网。

| 用途 | 路径 |
| --- | --- |
| 上传与临时文件 | `input/h3_ref2va_auto/`（含 `tmp/`） |
| 元数据 JSON | `output/h3_ref2va_auto/data/metadata-{剧名}-{序号}.json` |
| 生成图 / 抽帧 | `output/h3_ref2va_auto/images/` |
| 分镜视频 | `output/h3_ref2va_auto/shots/` |
| 成片 | `output/h3_ref2va_auto/merge/` |

看板记住 `metadata_file` 后会覆盖同一份 JSON，而不是每次另存。

## 分辨率参考

宽高对齐官方 **Resolution Selector (Size)**（`megapixels × 1024²`，再 round 到 32 倍数）。完整分档见 [RESOLUTION.md](RESOLUTION.md)。  
默认 `16:9` + `0.4` → `864 × 480`；`0.2` → `608 × 352`。

## 看板

- **锁定编辑**：开启后运行不被上游 `shots_json` 覆盖。
- **清空看板**：滚动区底部中央，默认几乎透明，悬停变红；需二次确认。只清节点内编辑态，不删磁盘文件。
- **背景音乐**：素材栏右侧青色卡片（与出场栏「本镜视频」同类线隔离）。上传 mp3 等后可预览播放。
- 素材详情里的参考音频同样可播放，有文件时背景会变亮。
- 成片请把看板「成片视频」接到 SaveVideo；合成最终成片或全局运行最后一步才会送入该连线。

## 示例工作流

见 [`example_workflows/h3_ref2va_auto_script_board.json`](example_workflows/h3_ref2va_auto_script_board.json)。  
示例不含 API Key、不含本机绝对路径。加载后在设置里配好模型，再接到你的生图/生视频子流程。

## 免责声明

MiniMax、OpenAI 及其他 LLM / 视频服务为第三方。本插件不附带模型权重，不收集使用数据。请遵守你所调用服务的条款与当地法律。
