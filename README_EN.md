# H3 Ref2VA Auto

**v1.0.0** — ComfyUI nodes for MiniMax H3 Ref2VA script-to-shot workflows.

Use a local model or an OpenAI-compatible API to turn a one-line idea or a script into a shootable screenplay, automatically extract character / prop / scene assets, split shots in Ref2VA format, then edit, trim, regenerate single shots, and upload references on the board. Image and video subgraphs are dispatched separately so consecutive shots can join seamlessly into a finished film.

- Author: cxq（梦想）
- License: [MIT](LICENSE)
- Repository: [github.com/open-cxq/Comfyui-MinimaxH3-Ref2VA-Auto-Video](https://github.com/open-cxq/Comfyui-MinimaxH3-Ref2VA-Auto-Video)
- 中文说明：[README.md](README.md)

`knowledge/ref-en.txt` is the MiniMax H3 Ref2VA full-reference prompt format guide used by shot splitting. The format document originates from MiniMax;.


## Features

- Script writing with a local model or an external API.
- Script generation and editing.
- Structured asset extraction: characters, props, and scenes.
- Shot splitting with MiniMax H3 skills: title, script, assets, shot scripts, on-screen assets, as structured shot data.
- Load an existing shot-asset file and continue.
- Convert an H3-format script into shot assets.
- Background music, volume control, and mix into the final film.
- Character voice audio references.
- Custom create / read / update / delete for characters, props, and scenes.
- Custom create / read / update / delete for shots.
- Generate all shots in one click.
- Regenerate a single shot.
- Previous-shot video and last-frame references for seamless continuation (one continuous take).
- Film timeline preview and playback across shots.
- Simple per-shot trimming.
- Simple controls for BGM and source-video audio.
- Compose the final film.
- Decoupled image and video subgraphs you can customize.
- Crop video by frame.
- Support double speed adjustment.


## Contents

- [Features](#features)
- [Install](#install)
- [Settings](#settings)
- [Nodes](#nodes)
- [Asset paths](#asset-paths)
- [Resolution table](#resolution-table)
- [Board](#board)
- [Example workflows](#example-workflows)
- [Model Download](#model-download)
- [Environmental dependence](#environmental-dependence)
- [Disclaimer](#disclaimer)


## Install

1. Place this repo at `ComfyUI/custom_nodes/Comfyui-MinimaxH3-Ref2VA-Auto-Video`:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/open-cxq/Comfyui-MinimaxH3-Ref2VA-Auto-Video.git
```

1. Restart ComfyUI.

No extra pip packages. Optional: an OpenAI-compatible endpoint, or ComfyUI’s Load CLIP node.


## Settings

ComfyUI **Settings → H3 Ref2VA Auto**:

- OpenAI API Key
- Base URL (default `https://api.openai.com/v1`, or a compatible gateway)
- Model; refresh lists from `/v1/models`

Key and URL live in settings only and are **not** written into workflow JSON. `OPENAI_API_KEY` is also accepted.


## Nodes


| Node ID                                                      | UI name             | Role                         |
| ------------------------------------------------------------ | ------------------- | ---------------------------- |
| `MinimaxH3OpenAIAPI`                                         | OpenAI API          | External LLM handle          |
| `MinimaxH3ScriptComplete`                                    | Script complete     | Story + duration             |
| `MinimaxH3AssetExtract`                                      | Asset extract       | Roles / props / scenes       |
| `MinimaxH3ShotSplit`                                         | Shot split          | Ref2VA shots from knowledge  |
| `MinimaxH3ScriptConverter`                                   | Script converter    | Arbitrary draft → board JSON |
| `MinimaxH3ScriptBoard`                                       | Script board        | Visual editor                |
| `MinimaxH3TextEdit`                                          | Text edit           | Lockable text                |
| `MinimaxH3SaveJson` / `LoadJson`                             | Save / load JSON    | `output/.../data`            |
| `MinimaxH3LoadImagePath` / `LoadAudioPath` / `LoadVideoPath` | Load by path        | Board injection              |
| `MinimaxH3GetImageRangeFromBatch`                            | Image range         | Slice a batch                |
| `MinimaxH3ImageCount`                                        | Image count         | Batch length                 |
| `MinimaxH3CropVideoByFrame`                                  | Crop video by frame | Head / tail crop             |


Typical chain: OpenAI API or CLIP → script complete → asset extract → shot split → board → save JSON. Wire the board’s gen prompt / size / video prompt / film video into your own T2I, H3 video subgraphs, and SaveVideo.

LLM JSON is repaired locally first (including real newlines inside strings). If it still fails, the model is asked to rewrite, up to 2 times.

## Asset paths

Everything stays on the local ComfyUI machine. This plugin does not add telemetry.


| Use                    | Path                                                      |
| ---------------------- | --------------------------------------------------------- |
| Uploads and temp files | `input/h3_ref2va_auto/` (including `tmp/`)                |
| Metadata JSON          | `output/h3_ref2va_auto/data/metadata-{slug}-{index}.json` |
| Images / frames        | `output/h3_ref2va_auto/images/`                           |
| Shot videos            | `output/h3_ref2va_auto/shots/`                            |
| Merged film            | `output/h3_ref2va_auto/merge/`                            |


Once the board remembers `metadata_file`, later edits overwrite that file.


## Resolution table

Matches official **Resolution Selector (Size)** (`megapixels × 1024²`, then round each side to a multiple of 32). Full tables: [RESOLUTION.md](RESOLUTION.md).  
Default `16:9` + `0.4` → `864 × 480`; `0.2` → `608 × 352`.


## Board

- **Lock edit**: keep hand edits when the graph runs.
- **Clear board**: bottom center of the scroll area; nearly transparent until hover (turns red). Confirm twice. Clears in-node state only, not files on disk.
- **BGM**: cyan card on the right of the asset row (same divider pattern as the current-shot video in appear). MP3 (and other audio) can be previewed after upload.
- Reference audio in asset detail can be previewed; the tile background brightens when a file is bound.
- Connect **film video** to SaveVideo. That SaveVideo runs on final compose or the last step of a full run, not on every shot.


## Example workflows

Workflows live in `example_workflows/`. They include no API keys and no machine-local paths. After loading, configure the model in settings.

| File | Use |
| ---- | --- |
| [h3_ref2va_auto_full.json](example_workflows/h3_ref2va_auto_full.json) | Full video-generation workflow |
| [h3_ref2va_auto_one.json](example_workflows/h3_ref2va_auto_one.json) | One-line fully automatic video generation |
| [h3_ref2va_auto_script.json](example_workflows/h3_ref2va_auto_script.json) | Generate video from an H3 script prompt |
| [h3_ref2va_auto_base.json](example_workflows/h3_ref2va_auto_base.json) | Base workflow: edit the script by hand, then generate video |
| [h3_ref2va_auto_file.json](example_workflows/h3_ref2va_auto_file.json) | Generate video from a saved shot-asset JSON file |


## Model Download

Text generation:

- [https://hf-mirror.com/Comfy-Org/Qwen3-VL/tree/main](https://hf-mirror.com/Comfy-Org/Qwen3-VL/tree/main)

Image generation:

- [https://hf-mirror.com/Comfy-Org/Qwen-Image-Edit_ComfyUI/tree/main](https://hf-mirror.com/Comfy-Org/Qwen-Image-Edit_ComfyUI/tree/main)
- [https://hf-mirror.com/lightx2v/Qwen-Image-Edit-2511-Lightning/tree/main](https://hf-mirror.com/lightx2v/Qwen-Image-Edit-2511-Lightning/tree/main)
- [https://hf-mirror.com/Comfy-Org/Qwen-Image_ComfyUI/tree/main](https://hf-mirror.com/Comfy-Org/Qwen-Image_ComfyUI/tree/main)

Video generation:

- [https://hf-mirror.com/Comfy-Org/MiniMax-H3/tree/main](https://hf-mirror.com/Comfy-Org/MiniMax-H3/tree/main)

Other models:

- [https://hf-mirror.com/JOKER141/MiniMax-H3-Combat-Base-V2/tree/main](https://hf-mirror.com/JOKER141/MiniMax-H3-Combat-Base-V2/tree/main)


## Environmental dependence

ComfyUI version environment:
-ComfyUI version: 0.35.1 and above [https://github.com/Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)

Workflow dependent nodes:
-ComfyUI KJNodes 1.5.1 and above [https://github.com/kijai/ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes)
-ComfyUI Easy Use 1.3.6 and above [https://github.com/yolain/ComfyUI-Easy-Use](https://github.com/yolain/ComfyUI-Easy-Use)


## Disclaimer

MiniMax, OpenAI, and other LLM/video APIs are third-party services. This plugin ships no model weights and does not collect usage data. Follow the terms of the services you call and applicable law.