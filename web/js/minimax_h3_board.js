import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "MinimaxH3ScriptBoard";
const UPLOAD_URL = "/h3_ref2va_auto/upload";
const MEDIA_URL = "/h3_ref2va_auto/media";
const IMPORT_OUTPUT_URL = "/h3_ref2va_auto/import_output_image";
const OUT_GEN_PROMPT = "gen_prompt";
const OUT_WIDTH = "width";
const OUT_HEIGHT = "height";
const OUT_VIDEO_PROMPT = "video_prompt";
const OUT_DURATION = "duration";
const OUT_FILM_VIDEO = "film_video";
const IMPORT_OUTPUT_VIDEO_URL = "/h3_ref2va_auto/import_output_video";
const EXTRACT_VIDEO_FRAME_URL = "/h3_ref2va_auto/extract_video_frame";
const COMPOSE_FILM_URL = "/h3_ref2va_auto/compose_film";
const SAVE_MATEDATA_URL = "/h3_ref2va_auto/save_matedata";
const PREFIX_IMAGES = "h3_ref2va_auto/images/h3_ref2va_auto_images_";
const PREFIX_SHOTS = "h3_ref2va_auto/shots/h3_ref2va_auto_shot_";
const PREFIX_MERGE = "h3_ref2va_auto/merge/h3_ref2va_auto_merge_";
/** 切走工作流时暂存已生成视频，切回后回写预览 */
const PENDING_VID_LS = "h3_ref2va_pending_shot_videos_v1";
/** 来自 user/default/workflows/test_h3_auto_video.json 已调好的节点尺寸 */
const DEFAULT_SIZE = [1800, 1628];
/** 标题栏 + 多路输出插槽占用（对齐导演台实测量级） */
const TOP_RESERVED = 260;
const PANEL_MIN_H = 400;
const NODE_MIN_H = PANEL_MIN_H + TOP_RESERVED;
const SIZE_MAX_H = 3600;

const TYPE_META = [
  ["roles", "角色"],
  ["prop", "道具"],
  ["scene", "场景"],
];

const CSS = `
.h3b{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;min-height:0;box-sizing:border-box;padding:6px 4px 8px;color:#ddd;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;overflow:hidden}
.h3b *{box-sizing:border-box}
.h3b-scroll{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding-right:2px}
.h3b-top{display:grid;grid-template-columns:minmax(0,1.8fr) repeat(3,minmax(64px,90px));gap:6px;align-items:end;flex:0 0 auto}
.h3b-bg{display:flex;align-items:center;gap:8px;flex:0 0 auto;min-width:0}
.h3b-bg .h3b-box{width:44px;height:44px}
.h3b-field{display:flex;flex-direction:column;gap:3px;min-width:0}
.h3b-label{font-size:10px;color:#8a8a8a}
.h3b-input,.h3b-area{width:100%;background:#262626;border:1px solid #444;border-radius:4px;color:#eee;padding:5px 7px;outline:none}
.h3b-area{resize:vertical;font-family:inherit;min-height:64px}
.h3b-input:focus,.h3b-area:focus{border-color:#777}
.h3b-input:disabled,.h3b-area:disabled{opacity:.55}
.h3b-sec{border:1px solid #333;border-radius:8px;background:#171717;padding:8px;display:flex;flex-direction:column;gap:8px}
.h3b-sec-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.h3b-sec-title{font-size:12px;font-weight:700;color:#cfd8e3}
.h3b-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.h3b-appear{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
.h3b-appear-wrap{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;width:100%;min-width:0}
.h3b-appear-wrap>.h3b-field{flex:1 1 auto;min-width:0}
.h3b-appear-side{flex:0 0 auto;display:flex;flex-direction:column;gap:3px;min-width:80px;max-width:96px;margin-left:auto;padding-left:12px;border-left:1px solid #3a3a3a}
.h3b-appear-side .h3b-label{font-size:10px;color:#8a8a8a}
.h3b-assets-wrap{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;width:100%;min-width:0}
.h3b-assets-wrap>.h3b-grid{flex:1 1 auto;min-width:0}
.h3b-assets-side{flex:0 0 auto;display:flex;flex-direction:column;gap:3px;min-width:80px;max-width:96px;margin-left:auto;padding-left:12px;border-left:1px solid #3a3a3a}
.h3b-assets-side .h3b-label{font-size:10px;color:#8a8a8a}
.h3b-clear-wrap{display:flex;justify-content:center;align-items:center;padding:18px 8px 10px;flex:0 0 auto}
.h3b-btn.clear-board{background:transparent;border-color:transparent;color:rgba(170,170,170,.28);box-shadow:none}
.h3b-btn.clear-board:hover{background:#4a1515;border-color:#a44;color:#fcc}
.h3b-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.h3b-tile{border:1px solid #3a3a3a;border-radius:6px;background:#1e1e1e;padding:4px;cursor:pointer;display:flex;flex-direction:column;gap:4px;min-width:0}
.h3b-tile:hover{border-color:#5a5a5a}
.h3b-tile.on{border-color:#4ea1f3;box-shadow:inset 0 0 0 1px rgba(78,161,243,.35)}
.h3b-tile.locked{cursor:default;opacity:.95;background:#4a3728;border:1px solid #8a6240;box-shadow:none}
.h3b-tile.locked:hover{border-color:#a7784e;background:#553e2d}
.h3b-tile.locked .h3b-tile-cover{background:#3d2c1f;border:1px dashed #8a6240;color:#e8c9a4}
.h3b-tile.locked .h3b-badge{background:#5c3d24;color:#f0d2b0}
.h3b-tile.locked.has{opacity:1;background:#5a4030;border:1px solid #e8b86a;box-shadow:inset 0 0 0 1px rgba(232,184,106,.35)}
.h3b-tile.locked.has:hover{border-color:#f0c98a;background:#664a36}
.h3b-tile.locked.has .h3b-tile-cover{background:#4a3426;border:1px dashed #d4a05a;color:#ffe2b8}
.h3b-tile.locked.has .h3b-badge{background:#6a4a28;color:#ffe2b8}
.h3b-tile.prev-ep{cursor:pointer;background:#4a3728;border:1px dashed #8a6240;box-shadow:none}
.h3b-tile.prev-ep:hover{border-color:#a7784e;background:#553e2d}
.h3b-tile.prev-ep .h3b-tile-cover{background:#3d2c1f;border:1px dashed #8a6240;color:#e8c9a4}
.h3b-tile.prev-ep .h3b-badge{background:#5c3d24;color:#f0d2b0}
.h3b-tile.prev-ep.has{background:#5a4030;border:1px solid #e8b86a;box-shadow:inset 0 0 0 1px rgba(232,184,106,.35)}
.h3b-tile.prev-ep.has:hover{border-color:#f0c98a;background:#664a36}
.h3b-tile.prev-ep.has .h3b-tile-cover{background:#4a3426;border:1px dashed #d4a05a;color:#ffe2b8}
.h3b-tile.prev-ep.has .h3b-badge{background:#6a4a28;color:#ffe2b8}
.h3b-tile.prev-ep video{width:100%;height:100%;object-fit:cover;pointer-events:none}
.h3b-tile.upload-cur{background:#1a3336;border:1px dashed #3d8a8f;box-shadow:none}
.h3b-tile.upload-cur:hover{border-color:#4eaeb4;background:#1e3c40}
.h3b-tile.upload-cur .h3b-tile-cover{background:#143033;border:1px dashed #3d8a8f;color:#8fd4d8;font-size:28px;font-weight:300;line-height:1}
.h3b-tile.upload-cur .h3b-tile-name{color:#9ed8dc;font-weight:500}
.h3b-tile.upload-cur .h3b-badge{background:#1e4548;color:#8fd4d8}
.h3b-tile.upload-cur.has{background:#1e4548;border:1px solid #3ecfd4;box-shadow:inset 0 0 0 1px rgba(62,207,212,.35)}
.h3b-tile.upload-cur.has:hover{border-color:#5adde0;background:#245356}
.h3b-tile.upload-cur.has .h3b-tile-cover{background:#163a3d;border:1px dashed #2a9ea3;color:#b8f0f2;font-size:11px;font-weight:600}
.h3b-tile.upload-cur.has .h3b-badge{background:#24666a;color:#b8f0f2}
.h3b-tile.upload-cur video{width:100%;height:100%;object-fit:cover;pointer-events:none}
.h3b-tile.bgm{background:#1a3336;border:1px dashed #3d8a8f;box-shadow:none}
.h3b-tile.bgm:hover{border-color:#4eaeb4;background:#1e3c40}
.h3b-tile.bgm .h3b-tile-cover{background:#143033;border:1px dashed #3d8a8f;color:#8fd4d8;font-size:22px;font-weight:300;line-height:1}
.h3b-tile.bgm .h3b-tile-name{color:#9ed8dc;font-weight:500}
.h3b-tile.bgm .h3b-badge{background:#1e4548;color:#8fd4d8}
.h3b-tile.bgm.has{background:#245356;border:1px solid #3ecfd4;box-shadow:inset 0 0 0 1px rgba(62,207,212,.4)}
.h3b-tile.bgm.has:hover{border-color:#5adde0;background:#2a6064}
.h3b-tile.bgm.has .h3b-tile-cover{background:#1a4a4e;border:1px dashed #2a9ea3;color:#b8f0f2;font-size:11px;font-weight:600}
.h3b-tile.bgm.has .h3b-badge{background:#24666a;color:#b8f0f2}
.h3b-tile.bgm .h3b-bgm-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.42);color:#dff;cursor:pointer;font-size:12px;line-height:1;padding:0}
.h3b-tile.bgm .h3b-bgm-play:hover{background:rgba(20,40,44,.85);border-color:#5adde0}
.h3b-tile-meta{display:flex;align-items:center;gap:4px;min-width:0}
.h3b-tile-name{font-size:11px;font-weight:650;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.h3b-badge{display:inline-flex;align-items:center;height:16px;padding:0 5px;border-radius:999px;background:#2b3542;color:#9ec5ff;font-size:9px;width:fit-content;flex:0 0 auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h3b-detail{border:1px solid #333;border-radius:8px;background:#1b1b1b;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:120px}
.h3b-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.h3b-btn{background:#2a2a2a;border:1px solid #444;color:#ddd;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:11px}
.h3b-btn.sm{padding:2px 6px;font-size:10px}
.h3b-btn:hover{background:#333;border-color:#666}
.h3b-btn.danger:hover{background:#4a1515;border-color:#a44;color:#fcc}
.h3b-btn.primary{border-color:#4ea1f3;color:#cfe6ff}
.h3b-btn.success{background:#1e3d2f;border-color:#3d9a6a;color:#c8f0d8}
.h3b-btn.success:hover{background:#245239;border-color:#4db87e;color:#e2ffe9}
.h3b-btn.on{border-color:#c9a227;color:#ffe9a8}
.h3b-btn:disabled{opacity:.45;cursor:not-allowed}
.h3b-box{width:76px;height:76px;border:1px dashed #555;border-radius:6px;background:#222;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:pointer;flex-shrink:0}
.h3b-box.sm{width:52px;height:52px}
.h3b-box.has{border-style:solid;border-color:#4ea1f3}
.h3b-box.has.audio-on{background:#2f4a52;border-color:#4ec4cf;box-shadow:inset 0 0 0 1px rgba(78,196,207,.28)}
.h3b-box.has.audio-on .ph{color:#b8eef2}
.h3b-box img{width:100%;height:100%;object-fit:cover}
.h3b-box .ph{color:#777;font-size:10px;text-align:center;padding:2px}
.h3b-box.sm .ph{font-size:9px}
.h3b-box .ph.audio-name{position:absolute;left:2px;right:2px;bottom:2px;z-index:1;pointer-events:none;font-size:8px;color:#b8eef2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.h3b-audio-play{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);z-index:3;width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.42);color:#dff;cursor:pointer;font-size:11px;line-height:1;padding:0}
.h3b-box.sm .h3b-audio-play{width:22px;height:22px;font-size:9px;top:42%}
.h3b-audio-play:hover{background:rgba(20,40,44,.85);border-color:#5adde0}
.h3b-box .ov{position:absolute;inset:0;background:rgba(0,0,0,.72);display:none;flex-direction:column;align-items:center;justify-content:center;gap:2px;z-index:2}
.h3b-box:hover .ov{display:flex}
.h3b-tile-cover{width:100%;aspect-ratio:1/1;border-radius:5px;background:#2a2a2a;border:1px dashed #444;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:11px;font-weight:600;text-align:center;padding:4px;word-break:break-word;position:relative}
.h3b-tile-cover img,.h3b-tile-cover video{width:100%;height:100%;object-fit:cover}
.h3b-zoom-host{position:relative}
.h3b-zoom{position:absolute;top:4px;right:4px;z-index:6;width:22px;height:22px;padding:0;margin:0;border:1px solid rgba(255,255,255,.35);border-radius:4px;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.h3b-zoom svg{width:13px;height:13px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.h3b-zoom-host:hover>.h3b-zoom,.h3b-box:hover>.h3b-zoom,.h3b-tile:hover>.h3b-tile-cover>.h3b-zoom,.h3b-film-clip:hover>.h3b-zoom,.h3b-zoom:focus{opacity:1;pointer-events:auto}
.h3b-zoom:hover{background:rgba(30,30,30,.85);border-color:#4ea1f3;color:#cfe6ff}
.h3b-lightbox{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.h3b-lightbox-inner{position:relative;max-width:min(96vw,1280px);max-height:92vh;display:flex;align-items:center;justify-content:center}
.h3b-lightbox-inner img,.h3b-lightbox-inner video{max-width:96vw;max-height:88vh;object-fit:contain;border-radius:6px;background:#000;box-shadow:0 8px 32px rgba(0,0,0,.45)}
.h3b-lightbox-close{position:absolute;top:-10px;right:-10px;width:32px;height:32px;border-radius:50%;border:1px solid #666;background:#222;color:#eee;cursor:pointer;font-size:18px;line-height:1;z-index:2}
.h3b-lightbox-close:hover{border-color:#4ea1f3;color:#fff}
.h3b-empty{color:#777;font-size:11px;padding:6px 2px}
.h3b-hint{font-size:10px;color:#666;flex:0 0 auto}
.h3b-lock{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:8px;flex:0 0 auto;padding:6px 2px;border:1px solid #333;border-radius:6px;background:#1a1a1a}
.h3b-lock label{display:flex;align-items:center;gap:6px;color:#eee;font-size:12px;font-weight:650;cursor:pointer;user-select:none;flex:0 0 auto}
.h3b-path{font-size:10px;color:#7a7;word-break:break-all;flex:1;min-width:0}
.h3b-status{font-size:11px;color:#9ec5ff;min-height:16px}
.h3b-status.err{color:#f99}
.h3b-status.ok{color:#8d8}
.h3b-film-stage{position:relative;width:100%;height:220px;min-height:220px;background:#0c0c0c;border:1px solid #333;border-radius:6px;overflow:hidden;cursor:pointer}
.h3b-film-stage-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;text-align:center;padding:16px;pointer-events:none;z-index:2}
.h3b-film-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;display:block}
.h3b-film-stage video.h3b-film-vid-hide{opacity:0;pointer-events:none;visibility:hidden}
.h3b-film-stage .h3b-film-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;pointer-events:none;z-index:1}
.h3b-film-stage-hit{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:transparent;border:0;padding:0;margin:0;cursor:pointer}
.h3b-film-stage-btn{width:58px;height:58px;border-radius:50%;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.38);color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s ease;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.h3b-film-stage:hover .h3b-film-stage-btn,.h3b-film-stage.show-ctrl .h3b-film-stage-btn{opacity:1}
.h3b-film-stage-btn svg{width:26px;height:26px;fill:currentColor;display:block}
.h3b-film-scroll{width:100%;overflow:auto;border:1px solid #333;border-radius:6px;background:#121212;cursor:pointer;user-select:none;max-height:120px}
.h3b-film-canvas{position:relative;min-height:84px}
.h3b-film-ruler{position:relative;height:22px;background:#161616;border-bottom:1px solid #2a2a2a;overflow:hidden}
.h3b-film-tick{position:absolute;top:0;bottom:0;border-left:1px solid #3a3a3a;pointer-events:none}
.h3b-film-tick.major{border-left-color:#6a6a6a}
.h3b-film-tick .t{position:absolute;left:3px;top:2px;font-size:9px;color:#8a8a8a;white-space:nowrap}
.h3b-film-track{position:relative;height:62px;background:#1a1a1a}
.h3b-film-clips{display:flex;height:100%;width:100%}
.h3b-film-clip{position:relative;height:100%;border-right:1px solid #2a2a2a;overflow:hidden;flex:0 0 auto;background:#222;box-sizing:border-box}
.h3b-film-clip.ph{background:#181818;border-right-color:#2f2f2f;opacity:.85}
.h3b-film-clip.on{box-shadow:inset 0 0 0 2px #4ea1f3}
.h3b-film-clip.cut{outline:1px dashed rgba(201,162,39,.55);outline-offset:-3px}
.h3b-film-clip.live{box-shadow:inset 0 0 0 2px #6bcf8e, inset 0 0 14px rgba(61,154,106,.42)}
.h3b-film-clip.cut.live{box-shadow:inset 0 0 0 2px #e0c35a, inset 0 0 16px rgba(201,162,39,.48)}
.h3b-film-clip.on.live{box-shadow:inset 0 0 0 2px #6bcf8e, inset 0 0 16px rgba(61,154,106,.5)}
.h3b-film-clip.on.cut.live{box-shadow:inset 0 0 0 2px #e0c35a, inset 0 0 18px rgba(201,162,39,.55)}
.h3b-film-clip img,.h3b-film-clip video{width:100%;height:100%;object-fit:cover;opacity:.85;pointer-events:none}
.h3b-film-clip .lab{position:absolute;left:4px;bottom:3px;font-size:9px;color:#eee;text-shadow:0 1px 2px #000;pointer-events:none}
.h3b-film-clip.ph .lab{color:#888;text-shadow:none}
.h3b-film-playhead{position:absolute;top:0;bottom:0;left:0;width:2px;background:#4ea1f3;pointer-events:none;z-index:3;will-change:transform;transform:translateX(0)}
.h3b-film-playhead::before{content:"";position:absolute;top:0;left:-4px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #4ea1f3}
.h3b-film-meta{font-size:10px;color:#9aa;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.h3b-film-vol{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.h3b-film-vol input[type=range]{width:92px;accent-color:#4ea1f3}
.h3b-film-speed{display:flex;align-items:center;gap:6px;flex:0 0 auto;font-size:10px;color:#9aa}
.h3b-film-speed select{background:#1a1a1a;color:#ddd;border:1px solid #444;border-radius:4px;padding:2px 4px;font-size:11px}
.h3b-film-speed label{display:inline-flex;align-items:center;gap:4px;cursor:pointer;user-select:none;white-space:nowrap}
.h3b-film-speed input[type=checkbox]{accent-color:#4ea1f3;margin:0}
.h3b-film-result{font-size:10px;color:#8d8;word-break:break-all}
.h3b-film-skip{font-size:10px;color:#888;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
`;

function ensureStyle() {
  const old = document.getElementById("h3b-board-style");
  if (old) old.remove();
  const style = document.createElement("style");
  style.id = "h3b-board-style";
  style.textContent = CSS;
  document.head.appendChild(style);
}

function widgetByName(node, name) {
  return (node.widgets || []).find((w) => w.name === name);
}

function setWidgetValue(widget, value) {
  if (!widget) return;
  widget.value = value;
  if (widget.inputEl) widget.inputEl.value = value;
  widget.callback?.(widget.value);
}

function readPendingShotVideos() {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_VID_LS) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_e) {
    return {};
  }
}

function writePendingShotVideos(map) {
  try {
    localStorage.setItem(PENDING_VID_LS, JSON.stringify(map || {}));
  } catch (_e) {}
}

function pendingShotVideoKey(scriptName, shotId) {
  return String(scriptName || "").trim() + "::" + String(shotId);
}

function stashPendingShotVideo(scriptName, shotId, payload) {
  const map = readPendingShotVideos();
  const key = pendingShotVideoKey(scriptName, shotId);
  map[key] = {
    script_name: String(scriptName || "").trim(),
    shot_id: Number(shotId),
    video_path: String((payload && payload.video_path) || "").trim(),
    first_frame_path: String((payload && payload.first_frame_path) || "").trim(),
    next_pre_last_frame_path: String((payload && payload.next_pre_last_frame_path) || "").trim(),
    ts: Date.now(),
  };
  const week = 7 * 24 * 3600 * 1000;
  for (const k of Object.keys(map)) {
    if (!map[k] || !map[k].ts || Date.now() - map[k].ts > week || !map[k].video_path) delete map[k];
  }
  writePendingShotVideos(map);
}

/** 把切走工作流期间生成的视频写回当前看板 state；返回是否有变更。 */
function applyPendingShotVideos(state) {
  if (!state || !Array.isArray(state.shots_info)) return false;
  const scriptName = String(state.script_name || "").trim();
  const map = readPendingShotVideos();
  let changed = false;
  const keep = {};
  for (const [k, v] of Object.entries(map)) {
    if (!v || !v.video_path) continue;
    if (v.ts && Date.now() - v.ts > 7 * 24 * 3600 * 1000) continue;
    const vScript = String(v.script_name || "").trim();
    if (vScript !== scriptName) {
      keep[k] = v;
      continue;
    }
    const shot = state.shots_info.find((s) => Number(s.id) === Number(v.shot_id));
    if (!shot) {
      keep[k] = v;
      continue;
    }
    if (String(shot.video_path || "").trim() !== v.video_path) {
      assignShotVideoPath(shot, v.video_path, null);
      changed = true;
    }
    if (v.first_frame_path && String(shot.first_frame_path || "").trim() !== v.first_frame_path) {
      shot.first_frame_path = v.first_frame_path;
      changed = true;
    }
    if (v.next_pre_last_frame_path) {
      const idx = state.shots_info.indexOf(shot);
      const next = state.shots_info[idx + 1];
      if (next && String(next.pre_last_frame_path || "").trim() !== v.next_pre_last_frame_path) {
        next.pre_last_frame_path = v.next_pre_last_frame_path;
        changed = true;
      }
    }
  }
  writePendingShotVideos(keep);
  return changed;
}

function boardNodeIsAlive(boardNode) {
  if (!boardNode || !app.graph) return false;
  const nodes = app.graph._nodes || app.graph.nodes || [];
  return nodes.some((n) => n && n === boardNode);
}

/** 当前看板节点已离开图时，尝试写入同剧本名的其它看板节点。 */
function persistStateToMatchingBoard(state, preferNode) {
  if (preferNode && boardNodeIsAlive(preferNode)) {
    const w = widgetByName(preferNode, "edit_json");
    if (w) {
      setWidgetValue(w, JSON.stringify(state, null, 2));
      if (preferNode._h3BoardReload) preferNode._h3BoardReload(JSON.stringify(state, null, 2), true);
      if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
      return true;
    }
  }
  const scriptName = String((state && state.script_name) || "").trim();
  const nodes = (app.graph && (app.graph._nodes || app.graph.nodes)) || [];
  for (const n of nodes) {
    if (!n || n.type !== NODE_NAME || n === preferNode) continue;
    const w = widgetByName(n, "edit_json");
    if (!w) continue;
    const cur = parseState(w.value || "");
    if (String(cur.script_name || "").trim() !== scriptName) continue;
    setWidgetValue(w, JSON.stringify(state, null, 2));
    if (n._h3BoardReload) n._h3BoardReload(JSON.stringify(state, null, 2), true);
    if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
    return true;
  }
  return false;
}

async function commitShotVideoResult(state, boardNode, shotId, pathOut, persistFn) {
  const shots = (state && state.shots_info) || [];
  const idx = shots.findIndex((x) => Number(x.id) === Number(shotId));
  const target = idx >= 0 ? shots[idx] : null;
  if (!target) throw new Error("回写失败：找不到分镜 #" + shotId);
  assignShotVideoPath(target, pathOut, null);
  await writeBackVideoFrames(shots, idx, pathOut);
  const next = shots[idx + 1];
  stashPendingShotVideo(state.script_name, shotId, {
    video_path: pathOut,
    first_frame_path: target.first_frame_path || "",
    next_pre_last_frame_path: (next && next.pre_last_frame_path) || "",
  });
  if (typeof persistFn === "function") persistFn();
  const alive = boardNodeIsAlive(boardNode);
  if (!alive) persistStateToMatchingBoard(state, boardNode);
  await saveBoardMatedata(state);
  return { alive, detached: !alive };
}

function hideWidget(widget) {
  if (!widget) return;
  widget.options = widget.options || {};
  widget.options.hidden = true;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  widget.computeLayoutSize = () => ({ minHeight: 0, maxHeight: 0, minWidth: 0 });
  widget.draw = () => {};
  if (widget.element) {
    widget.element.style.display = "none";
    widget.element.style.height = "0";
    widget.element.style.minHeight = "0";
    widget.element.style.overflow = "hidden";
  }
  if (widget.inputEl) {
    widget.inputEl.style.display = "none";
    if (widget.inputEl.parentElement) {
      widget.inputEl.parentElement.style.display = "none";
      widget.inputEl.parentElement.style.height = "0";
      widget.inputEl.parentElement.style.minHeight = "0";
      widget.inputEl.parentElement.style.overflow = "hidden";
    }
  }
}

function clampNodeSize(node) {
  if (!node) return DEFAULT_SIZE.slice();
  if (!node.size) node.size = DEFAULT_SIZE.slice();
  let w = Number(node.size[0]);
  let h = Number(node.size[1]);
  // 只修非法值，禁止在同步循环里把高度弹回 DEFAULT（会闪烁）
  if (!Number.isFinite(w) || w < 520) w = 900;
  if (!Number.isFinite(h) || h < NODE_MIN_H) h = NODE_MIN_H;
  if (h > SIZE_MAX_H) h = SIZE_MAX_H;
  node.size[0] = w;
  node.size[1] = h;
  return node.size;
}

function panelHeight(node) {
  const h = Number(node && node.size && node.size[1]);
  return Math.max(PANEL_MIN_H, (Number.isFinite(h) ? h : DEFAULT_SIZE[1]) - TOP_RESERVED);
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)))
      .map((k) => {
        const item = value[k];
        if (item && typeof item === "object" && item.id == null && /^\d+$/.test(String(k))) {
          return { ...item, id: Number(k) };
        }
        return item;
      })
      .filter((x) => x && typeof x === "object");
  }
  return [];
}

function emptyState() {
  return {
    script: "",
    script_name: "",
    duration: 10,
    width: 864,
    height: 480,
    shots_prompt: "",
    film_path: "",
    metadata_file: "",
    global: {
      roles: [],
      prop: [],
      scene: [],
      background_audio: "",
      background_audio_volume: 1,
      film_playback_rate: 1,
      bgm_follow_speed: false,
      global_prompt: "",
    },
    shots_info: [],
  };
}

function extractShotText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const keys = ["subject_definitions", "detailed_description", "overall_soundscape", "non_diegetic_music"];
  const found = [];
  for (const key of keys) {
    const m = raw.match(new RegExp("(^|\\n)(" + key + ")\\s*:", "i"));
    if (m) {
      const start = raw.search(new RegExp("(^|\\n)" + key + "\\s*:", "i"));
      found.push({ start: start < 0 ? 0 : start, key });
    }
  }
  found.sort((a, b) => a.start - b.start);
  const pick = {};
  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const bodyStart = raw.indexOf(":", cur.start) + 1;
    const bodyEnd = i + 1 < found.length ? found[i + 1].start : raw.length;
    pick[cur.key.toLowerCase()] = raw.slice(bodyStart, bodyEnd).trim();
  }
  const parts = [];
  if (pick.subject_definitions) parts.push("subject_definitions:\n" + pick.subject_definitions);
  if (pick.detailed_description) parts.push("detailed_description:\n" + pick.detailed_description);
  if (parts.length) return parts.join("\n\n");
  return raw.replace(/^(overall_soundscape|non_diegetic_music)\s*:[\s\S]*?(?=\n(?:subject_definitions|detailed_description)\s*:|$)/gim, "").trim();
}

/** Strip and rewrite non_diegetic_music to N/A (custom BGM uploaded → model must not invent score). */
function forceNonDiegeticMusicNA(text) {
  let raw = String(text || "").trim();
  raw = raw
    .replace(
      /(^|\n)non_diegetic_music\s*:[\s\S]*?(?=(?:\n(?:overall_soundscape|subject_definitions|detailed_description)\s*:)|\s*$)/gi,
      "\n"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!/(^|\n)overall_soundscape\s*:/i.test(raw)) {
    raw =
      (raw ? raw + "\n\n" : "") +
      "overall_soundscape:\nAmbient environmental sound continues throughout.";
  }
  return (raw + "\n\nnon_diegetic_music:\nN/A").trim();
}

/** When board has uploaded BGM, keep global_prompt.music = N/A. */
function syncGlobalPromptForBgm(state) {
  if (!state || typeof state !== "object") return state;
  if (!state.global || typeof state.global !== "object") state.global = {};
  const hasBgm = !!String(state.global.background_audio || "").trim();
  if (!hasBgm) return state;
  state.global.global_prompt = forceNonDiegeticMusicNA(state.global.global_prompt || "");
  return state;
}

/**
 * H3 video prompt = per-shot subject/detailed + global soundscape/music.
 * extractShotText alone drops overall_soundscape / non_diegetic_music — must re-merge here.
 */
function buildVideoPrompt(state, shotOrText) {
  const shotPart =
    typeof shotOrText === "string"
      ? extractShotText(shotOrText).trim()
      : extractShotText((shotOrText && shotOrText.shot) || "").trim();
  syncGlobalPromptForBgm(state);
  const globalPart = String((state && state.global && state.global.global_prompt) || "").trim();
  if (!globalPart) return shotPart;
  if (!shotPart) return globalPart;
  return shotPart + "\n\n" + globalPart;
}

function pickList(primary, fallback) {
  const a = asList(primary);
  return a.length ? a : asList(fallback);
}


function scriptFingerprint(st) {
  return String((st && st.script_name) || "").trim() + "\n" + String((st && st.script) || "").trim();
}

function clearStaleBackgroundAudio(current, incoming) {
  // Mutates current: when script identity changes, take BGM only from incoming.
  if (!current || !current.global) return current;
  if (!incoming) return current;
  if (scriptFingerprint(current) === scriptFingerprint(incoming)) return current;
  if (!current.global || typeof current.global !== "object") current.global = {};
  current.global.background_audio = String(
    (incoming.global && incoming.global.background_audio) || ""
  ).trim();
  return current;
}

function parseState(text) {
  try {
    const data = JSON.parse(String(text || "").trim() || "{}");
    if (!data || typeof data !== "object") return emptyState();
    const g = data.global && typeof data.global === "object" ? data.global : {};
    const width = Number(data.width || data.with || 864) || 864;
    const height = Number(data.height || 480) || 480;

    const seen = new Set();
    const shots_info = [];
    for (const shot of asList(data.shots_info)) {
      const id = Number(shot.id) || shots_info.length + 1;
      if (seen.has(id)) continue;
      seen.add(id);
      const appearIn = shot.appear && typeof shot.appear === "object" ? shot.appear : {};
      shots_info.push({
        ...shot,
        id,
        shot: extractShotText(shot.shot || shot.shot_body || ""),
        appear: {
          roles: asList(appearIn.roles).map(Number).filter(Boolean),
          prop: asList(appearIn.prop).map(Number).filter(Boolean),
          scene: asList(appearIn.scene).map(Number).filter(Boolean),
        },
        pre_last_frame_path: String(shot.pre_last_frame_path || shot.prev_last_frame_path || ""),
        first_frame_path: String(shot.first_frame_path || ""),
        video_path: String(shot.video_path || ""),
        prev_video_path: shots_info.length === 0 ? String(shot.prev_video_path || "") : "",
        duration: Number(shot.duration) || 5,
        is_first_shots: shots_info.length === 0 && !String(shot.prev_video_path || "").trim(),
        film_enabled: shot.film_enabled !== false,
        film_in: Math.max(0, Number(shot.film_in) || 0),
        film_out: Math.max(0, Number(shot.film_out) || 0),
        film_src_dur: Math.max(0, Number(shot.film_src_dur) || 0),
        film_src_path: String(shot.film_src_path || ""),
        film_rank: Number.isFinite(Number(shot.film_rank)) ? Number(shot.film_rank) : shots_info.length,
      });
    }
    syncShotFirstFlags(shots_info);

    const next = {
      ...emptyState(),
      ...data,
      script_name: String(data.script_name || ""),
      width,
      height,
      duration: Number(data.duration || 10) || 10,
      film_path: String(data.film_path || ""),
      metadata_file: String(data.metadata_file || data.matedata_file || ""),
      global: {
        roles: pickList(g.roles, data.roles),
        prop: pickList(g.prop, data.prop),
        scene: pickList(g.scene, data.scene),
        background_audio: g.background_audio || data.background_audio || "",
        background_audio_volume: Math.min(2, Math.max(0, Number(g.background_audio_volume ?? 1) || 1)),
        film_playback_rate: clampFilmPlaybackRate(g.film_playback_rate ?? 1),
        bgm_follow_speed: !!g.bgm_follow_speed,
        global_prompt: g.global_prompt || data.global_prompt || "",
      },
      shots_info,
    };
    delete next.with;
    return next;
  } catch (_err) {
    return emptyState();
  }
}

function mediaSrc(path, opts) {
  if (!path) return "";
  const p = String(path);
  // 默认稳定 URL，避免每次 render 都换 ?t= 导致浏览器掐断旧连接（WinError 10054）。
  // 同路径被覆盖后再显示时传 { bust: true }。
  if (opts && opts.bust) {
    mediaSrc._bust.set(p, String(Date.now()));
  }
  let q = MEDIA_URL + "?path=" + encodeURIComponent(p);
  const t = mediaSrc._bust.get(p);
  if (t) q += "&t=" + encodeURIComponent(t);
  return api.apiURL(q);
}
mediaSrc._bust = new Map();

function bustMedia(path) {
  if (!path) return;
  mediaSrc._bust.set(String(path), String(Date.now()));
}

function fileBase(path) {
  const s = String(path || "").replace(/\\/g, "/");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

const ZOOM_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="M20 20l-4.5-4.5"></path></svg>';

function closeMediaLightbox() {
  const old = document.getElementById("h3b-lightbox");
  if (old) old.remove();
  if (window.__h3bLightboxEsc) {
    document.removeEventListener("keydown", window.__h3bLightboxEsc);
    window.__h3bLightboxEsc = null;
  }
}

function openMediaLightbox(path, kind) {
  const p = String(path || "").trim();
  if (!p) return;
  closeMediaLightbox();
  const k = kind === "video" ? "video" : "image";
  const mask = el("div", "h3b-lightbox");
  mask.id = "h3b-lightbox";
  const inner = el("div", "h3b-lightbox-inner");
  const closeBtn = el("button", "h3b-lightbox-close", "×");
  closeBtn.type = "button";
  closeBtn.title = "关闭";
  closeBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    closeMediaLightbox();
  });
  if (k === "video") {
    const vid = document.createElement("video");
    vid.src = mediaSrc(p);
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    inner.appendChild(vid);
  } else {
    const img = el("img");
    img.src = mediaSrc(p);
    img.alt = "";
    inner.appendChild(img);
  }
  inner.appendChild(closeBtn);
  mask.appendChild(inner);
  mask.addEventListener("click", (ev) => {
    if (ev.target === mask) closeMediaLightbox();
  });
  window.__h3bLightboxEsc = (ev) => {
    if (ev.key === "Escape") closeMediaLightbox();
  };
  document.addEventListener("keydown", window.__h3bLightboxEsc);
  document.body.appendChild(mask);
}

/** 卡片悬停右上角放大镜；点击弹窗查看图片/视频，不触发卡片本体点击。 */
function attachMediaZoom(host, path, kind) {
  const p = String(path || "").trim();
  if (!host || !p) return host;
  const k = kind === "video" ? "video" : "image";
  host.classList.add("h3b-zoom-host");
  const btn = el("button", "h3b-zoom");
  btn.type = "button";
  btn.title = "放大查看";
  btn.innerHTML = ZOOM_ICON_SVG;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openMediaLightbox(p, k);
  });
  host.appendChild(btn);
  return host;
}

async function uploadFile(file, kind) {
  const body = new FormData();
  const k = kind === "audio" ? "audio" : kind === "video" ? "video" : "image";
  body.append("kind", k);
  body.append("file", file);
  const res = await api.fetchApi(UPLOAD_URL, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || ("HTTP " + res.status));
  return data.path;
}

/** 上一镜视频：本集第 2+ 镜用上一镜成片；第 1 镜用上传的 prev_video_path（第二集续写）。 */
function shotPrevVideoPath(shots, idx) {
  if (!Array.isArray(shots) || idx < 0 || !shots[idx]) return "";
  if (idx > 0) return String(shots[idx - 1].video_path || "").trim();
  return String(shots[0].prev_video_path || "").trim();
}

function shotIsColdStart(shots, idx) {
  return !shotPrevVideoPath(shots, idx);
}

function shotKindLabel(shots, idx) {
  if (idx < 0) return "分镜";
  if (shotIsColdStart(shots, idx)) return idx === 0 ? "首镜" : "分镜";
  return idx === 0 ? "续镜" : "分镜";
}

function syncShotFirstFlags(shots) {
  if (!Array.isArray(shots)) return;
  shots.forEach((s, i) => {
    if (i !== 0) s.prev_video_path = "";
    s.is_first_shots = shotIsColdStart(shots, i);
  });
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function field(label, control) {
  const wrap = el("div", "h3b-field");
  wrap.append(el("div", "h3b-label", label), control);
  return wrap;
}

function textInput(value, onChange) {
  const input = el("input", "h3b-input");
  input.type = "text";
  input.value = value ?? "";
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function numInput(value, onChange) {
  const input = el("input", "h3b-input");
  input.type = "number";
  input.min = "1";
  input.value = String(value ?? "");
  input.addEventListener("input", () => onChange(Number(input.value) || 0));
  return input;
}

function areaInput(value, onChange, rows = 4) {
  const area = el("textarea", "h3b-area");
  area.rows = rows;
  area.value = value ?? "";
  area.addEventListener("input", () => onChange(area.value));
  return area;
}

function mediaBox(path, kind, onUploaded, onCleared, opts) {
  const compact = !!(opts && opts.compact);
  const box = el("div", "h3b-box" + (compact ? " sm" : "") + (path ? " has" : ""));
  if (kind === "image" && path) {
    const img = el("img");
    img.src = mediaSrc(path);
    img.alt = "";
    box.appendChild(img);
    attachMediaZoom(box, path, "image");
  } else if (kind === "audio") {
    if (path) {
      box.classList.add("audio-on");
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = mediaSrc(path);
      audio.style.display = "none";
      box.appendChild(audio);
      const playBtn = el("button", "h3b-audio-play", "▶");
      playBtn.type = "button";
      playBtn.title = "播放预览";
      const syncPlayLabel = () => {
        playBtn.textContent = audio.paused ? "▶" : "❚❚";
      };
      playBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        if (audio.paused) {
          const p = audio.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          audio.pause();
        }
        syncPlayLabel();
      });
      audio.addEventListener("play", syncPlayLabel);
      audio.addEventListener("pause", syncPlayLabel);
      audio.addEventListener("ended", () => {
        audio.currentTime = 0;
        syncPlayLabel();
      });
      box.appendChild(playBtn);
      box.appendChild(el("div", "ph audio-name", fileBase(path) || "音频已绑"));
    } else {
      box.appendChild(el("div", "ph", "上传音频"));
    }
  } else {
    box.appendChild(el("div", "ph", path ? "图片已绑" : "上传图片"));
  }
  const ov = el("div", "ov");
  const btnCls = compact ? "h3b-btn sm" : "h3b-btn";
  const up = el("button", btnCls, "上传");
  up.type = "button";
  up.addEventListener("click", (evt) => {
    evt.stopPropagation();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "audio" ? "audio/*" : "image/*";
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      try {
        onUploaded(await uploadFile(file, kind));
      } catch (err) {
        alert("上传失败: " + (err && err.message ? err.message : err));
      }
    });
    document.body.appendChild(input);
    input.click();
  });
  ov.appendChild(up);
  if (path) {
    const clear = el("button", btnCls + " danger", "清除");
    clear.type = "button";
    clear.addEventListener("click", (evt) => {
      evt.stopPropagation();
      onCleared();
    });
    ov.appendChild(clear);
  }
  box.appendChild(ov);
  return box;
}

function tileMeta(badgeText, nameText) {
  const row = el("div", "h3b-tile-meta");
  row.append(el("div", "h3b-badge", badgeText), el("div", "h3b-tile-name", nameText));
  return row;
}

function snippet(text, n = 28) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : (s || "（空）");
}

function allAssets(state) {
  const out = [];
  for (const [key, label] of TYPE_META) {
    for (const item of state.global[key] || []) out.push({ key, label, item });
  }
  return out;
}

function assetImagePath(item) {
  return String((item && item.bing_image_path) || "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let h3LocalQueueDepth = 0;
let h3QueueGuardInstalled = false;

async function withH3LocalQueue(fn) {
  h3LocalQueueDepth += 1;
  try {
    return await fn();
  } finally {
    h3LocalQueueDepth -= 1;
  }
}

async function queuePromptLocal(number, data) {
  return withH3LocalQueue(async () => {
    try {
      return await api.queuePrompt(number, data);
    } catch (err) {
      throw new Error(formatComfyError(err));
    }
  });
}

function findScriptBoardNode() {
  const g = graphObj();
  const nodes = (g && (g._nodes || g.nodes)) || [];
  return nodes.find((n) => n && n.type === NODE_NAME) || null;
}

function setNodeWidget(node, name, value) {
  const w = (node.widgets || []).find((x) => x.name === name);
  if (!w) return false;
  w.value = value;
  if (w.callback) w.callback(value);
  return true;
}

function graphObj() {
  return app.graph || (app.canvas && app.canvas.graph) || null;
}

function graphGetNode(id) {
  const g = graphObj();
  if (!g || id == null) return null;
  if (typeof g.getNodeById === "function") {
    const n = g.getNodeById(id) || g.getNodeById(Number(id)) || g.getNodeById(String(id));
    if (n) return n;
  }
  const nodes = g._nodes || g.nodes || [];
  return nodes.find((n) => n && String(n.id) === String(id)) || null;
}

function normalizeLink(link, linkId) {
  if (!link) return null;
  if (Array.isArray(link)) {
    return {
      id: link[0] != null ? link[0] : linkId,
      origin_id: link[1],
      origin_slot: link[2],
      target_id: link[3],
      target_slot: link[4],
    };
  }
  return {
    id: link.id != null ? link.id : linkId,
    origin_id: link.origin_id,
    origin_slot: link.origin_slot,
    target_id: link.target_id,
    target_slot: link.target_slot,
  };
}

function graphGetLink(linkId) {
  const g = graphObj();
  if (!g || linkId == null) return null;
  const links = g.links;
  if (!links) return null;
  let raw = links[linkId];
  if (raw == null && typeof links.get === "function") raw = links.get(linkId);
  if (raw == null && typeof links.find === "function") {
    raw = links.find((l) => l && (l.id === linkId || l[0] === linkId || String(l.id) === String(linkId)));
  }
  if (raw == null && typeof links === "object") {
    for (const key of Object.keys(links)) {
      const l = links[key];
      if (!l) continue;
      const id = Array.isArray(l) ? l[0] : l.id;
      if (id == linkId || String(id) === String(linkId)) {
        raw = l;
        break;
      }
    }
  }
  return normalizeLink(raw, linkId);
}

function eachGraphLink(fn) {
  const g = graphObj();
  const links = g && g.links;
  if (!links) return;
  if (typeof links.values === "function") {
    for (const raw of links.values()) {
      const link = normalizeLink(raw, raw && (raw.id != null ? raw.id : raw[0]));
      if (link) fn(link);
    }
    return;
  }
  if (Array.isArray(links)) {
    for (const raw of links) {
      const link = normalizeLink(raw, raw && (raw.id != null ? raw.id : raw[0]));
      if (link) fn(link);
    }
    return;
  }
  for (const key of Object.keys(links)) {
    const raw = links[key];
    if (!raw) continue;
    const link = normalizeLink(raw, raw.id != null ? raw.id : key);
    if (link) fn(link);
  }
}

function outputSlotIndex(node, name) {
  const outs = node.outputs || [];
  const want = String(name || "").trim();
  const aliases = new Set([want].filter(Boolean));
  // 仅在查找生图提示词时加入中文别名；绝不能污染 width/height 查找
  if (want === "gen_prompt") {
    aliases.add("生图提示词");
    aliases.add("生成提示词");
  } else if (want === "width") {
    aliases.add("宽");
  } else if (want === "height") {
    aliases.add("高");
  } else if (want === "video_prompt") {
    aliases.add("生视频提示词");
  } else if (want === "duration") {
    aliases.add("时长");
  } else if (want === "film_video") {
    aliases.add("成片视频");
  }
  for (let i = 0; i < outs.length; i++) {
    const o = outs[i];
    if (!o) continue;
    if (aliases.has(String(o.name || ""))) return i;
    if (aliases.has(String(o.localized_name || ""))) return i;
    if (aliases.has(String(o.label || ""))) return i;
  }
  if (want === "gen_prompt") {
    const stringSlots = [];
    for (let i = 0; i < outs.length; i++) {
      const o = outs[i];
      if (!o) continue;
      if (String(o.type || "").toUpperCase() === "STRING") stringSlots.push(i);
    }
    if (stringSlots.length >= 2) return stringSlots[1];
    if (stringSlots.length === 1 && outs[stringSlots[0]].name !== "shots_json") return stringSlots[0];
  }
  return -1;
}

function inputNameAt(node, slot) {
  const inp = node && node.inputs && node.inputs[slot];
  if (!inp) return "";
  return String(inp.name || inp.localized_name || inp.label || "");
}

function isSubgraphLikeNode(node) {
  if (!node) return false;
  if (node.isSubgraphNode || node.subgraph) return true;
  const t = String(node.type || "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return true;
  const title = String(node.title || (node.subgraph && node.subgraph.name) || "");
  return /文生图|txt2img|t2i/i.test(title);
}

function isPromptTextInputName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return false;
  // 绝不能把字符串写进 positive/negative：那是 CONDITIONING，写进去会报 string index out of range
  if (n === "positive" || n === "negative" || n === "conditioning") return false;
  return (
    n === "text" ||
    n === "prompt" ||
    n === "string" ||
    n.endsWith("_text") ||
    n === "prompt_text" ||
    n.includes("prompt_text")
  );
}

function isTextLikeInputName(name) {
  return isPromptTextInputName(name);
}

function isRejectedPromptInputName(name) {
  const n = String(name || "").trim().toLowerCase();
  return [
    "steps",
    "width",
    "height",
    "cfg",
    "seed",
    "unet_name",
    "lora_name",
    "clip_name",
    "vae_name",
    "model",
    "ckpt_name",
    "samples",
    "images",
    "image",
  ].includes(n);
}

function linkedTargets(node, outputName) {
  if (!node) return [];
  const slot = outputSlotIndex(node, outputName);
  const out = [];
  const seen = new Set();
  const pushTarget = (link) => {
    if (!link) return;
    if (String(link.origin_id) !== String(node.id)) return;
    if (slot >= 0 && Number(link.origin_slot) !== Number(slot)) return;
    // slot 未知时：只要从该输出名对应口出去；口名对不上则仍接受同节点所有 STRING 出线的兜底在上层做
    const tgt = graphGetNode(link.target_id);
    if (!tgt) return;
    const key = String(tgt.id) + ":" + String(link.target_slot);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      node: tgt,
      slot: Number(link.target_slot),
      linkId: link.id,
      inputName: inputNameAt(tgt, link.target_slot),
    });
  };

  if (slot >= 0) {
    const links = (node.outputs[slot] && node.outputs[slot].links) || [];
    for (const linkId of links) pushTarget(graphGetLink(linkId));
  }
  // 前端有时 outputs[].links 为空，但 graph.links 仍有连线——按图扫描兜底
  eachGraphLink((link) => {
    if (String(link.origin_id) !== String(node.id)) return;
    if (slot >= 0 && Number(link.origin_slot) !== Number(slot)) return;
    pushTarget(link);
  });
  return out;
}

function findSaveImageDownstream(rootNode) {
  const seen = new Set();
  const stack = [rootNode];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (cur.type === "SaveImage" || cur.type === "SaveImageWebsocket") return cur;
    for (const out of cur.outputs || []) {
      for (const linkId of out.links || []) {
        const link = graphGetLink(linkId);
        if (!link) continue;
        const tgt = graphGetNode(link.target_id);
        if (tgt) stack.push(tgt);
      }
    }
  }
  // outputs[].links 空时，从图扫描下游
  eachGraphLink((link) => {
    if (!rootNode || String(link.origin_id) !== String(rootNode.id)) return;
    const tgt = graphGetNode(link.target_id);
    if (tgt && !seen.has(tgt.id)) stack.push(tgt);
  });
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (cur.type === "SaveImage" || cur.type === "SaveImageWebsocket") return cur;
    eachGraphLink((link) => {
      if (String(link.origin_id) !== String(cur.id)) return;
      const tgt = graphGetNode(link.target_id);
      if (tgt) stack.push(tgt);
    });
  }
  return null;
}

function findTxt2ImgBundle(boardNode) {
  if (!boardNode) throw new Error("看板节点无效");
  let targets = linkedTargets(boardNode, OUT_GEN_PROMPT);

  // 1) 明确的 text/prompt 口
  let chosen = targets.filter((t) => isTextLikeInputName(t.inputName));

  // 2) 子图节点：只要不是 steps/width 等，就接受（子图口名有时读不到）
  if (!chosen.length) {
    chosen = targets.filter(
      (t) => isSubgraphLikeNode(t.node) && !isRejectedPromptInputName(t.inputName)
    );
  }

  // 3) 按标题/类型找文生图子图
  if (!chosen.length) {
    const g = graphObj();
    const nodes = (g && (g._nodes || g.nodes)) || [];
    const titled = nodes.find(
      (n) => n && (isSubgraphLikeNode(n) || /文生图/.test(String(n.title || "")))
    );
    if (titled) {
      const viaTitle = [];
      eachGraphLink((link) => {
        if (String(link.origin_id) !== String(boardNode.id)) return;
        if (String(link.target_id) !== String(titled.id)) return;
        viaTitle.push({
          node: titled,
          slot: Number(link.target_slot),
          linkId: link.id,
          inputName: inputNameAt(titled, link.target_slot),
        });
      });
      chosen = viaTitle.filter((t) => isTextLikeInputName(t.inputName));
      if (!chosen.length) {
        chosen = viaTitle.filter((t) => !isRejectedPromptInputName(t.inputName));
      }
      if (!chosen.length && viaTitle.length) {
        const names = viaTitle.map((t) => t.inputName || ("slot#" + t.slot)).join(", ");
        throw new Error(
          "已连到「" +
            (titled.title || "文生图子流程") +
            "」，但接在 [" +
            names +
            "]。请把「生图提示词」改接到它的 text 输入（不要接 steps/width/height）"
        );
      }
    }
  }

  if (!chosen.length && targets.length) {
    const names = targets.map((t) => t.inputName || ("slot#" + t.slot)).join(", ");
    throw new Error(
      "「生图提示词」已连线，但目标是 [" +
        names +
        "]。请改接到文生图子流程的 text 输入"
    );
  }
  if (!chosen.length) {
    throw new Error(
      "未检测到「生图提示词」→ 文生图子流程.text 的连线。请确认接到 text 口后保存，并 Ctrl+F5 强刷"
    );
  }

  const t2i = chosen[0].node;
  const promptInputName = chosen[0].inputName || "text";
  const save = findSaveImageDownstream(t2i);
  if (!save) {
    throw new Error("文生图子流程未再连到 SaveImage，请把子流程 IMAGE 输出接到 SaveImage");
  }
  return { t2i, save, promptTargets: chosen, promptInputName };
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function collectUpstreamPrompt(output, rootIds, stopIds) {
  // stopIds：边界节点（如剧本看板）。不纳入 prompt，也不再向其上游回溯，
  // 避免每次局部生图/生视频把「剧本补全」整段又跑一遍。
  const stop = new Set((stopIds || []).map(String));
  const keep = new Set();
  const stack = rootIds.map(String);
  while (stack.length) {
    const id = stack.pop();
    if (keep.has(id) || !output[id]) continue;
    if (stop.has(id)) continue;
    keep.add(id);
    const inputs = (output[id] && output[id].inputs) || {};
    for (const key of Object.keys(inputs)) {
      const v = inputs[key];
      if (!Array.isArray(v) || v.length < 1) continue;
      const src = String(v[0]);
      if (stop.has(src)) continue;
      stack.push(src);
    }
  }
  const sub = {};
  for (const id of keep) sub[id] = deepClone(output[id]);
  return sub;
}

function inlineBoardOutputs(sub, boardNode, text, width, height) {
  const boardId = String(boardNode.id);
  const promptSlot = outputSlotIndex(boardNode, OUT_GEN_PROMPT);
  const widthSlot = outputSlotIndex(boardNode, OUT_WIDTH);
  const heightSlot = outputSlotIndex(boardNode, OUT_HEIGHT);
  const w = width > 0 ? Math.round(width) : 0;
  const h = height > 0 ? Math.round(height) : 0;

  for (const node of Object.values(sub)) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      if (!Array.isArray(v) || String(v[0]) !== boardId) continue;
      const slot = Number(v[1]);
      const k = String(key).toLowerCase();
      if (slot === promptSlot || isPromptTextInputName(k)) {
        node.inputs[key] = text;
      } else if (slot === widthSlot || k === "width") {
        node.inputs[key] = w || 512;
      } else if (slot === heightSlot || k === "height") {
        node.inputs[key] = h || 512;
      } else if (k.includes("width") && w > 0) {
        node.inputs[key] = w;
      } else if (k.includes("height") && h > 0) {
        node.inputs[key] = h;
      } else {
        // 未知连线：断开，避免留下指向已删除看板的引用
        delete node.inputs[key];
      }
    }
  }

  for (const node of Object.values(sub)) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      if (Array.isArray(v) && String(v[0]) === boardId) {
        const k = String(key).toLowerCase();
        if (k === "width") node.inputs[key] = w || 512;
        else if (k === "height") node.inputs[key] = h || 512;
        else if (isPromptTextInputName(k)) node.inputs[key] = text;
        else delete node.inputs[key];
      }
    }
  }
  delete sub[boardId];
}

function assetGenPrompt(item) {
  const prompt = String((item && item.gen_prompt) || "").trim();
  if (prompt) return prompt;
  const parts = [item && item.name, item && item.desc].map((x) => String(x || "").trim()).filter(Boolean);
  return parts.join(", ");
}

function pickImagesFromOutputs(outputs, saveNodeId) {
  if (!outputs || typeof outputs !== "object") return null;
  const keys = [saveNodeId, String(saveNodeId)];
  for (const key of keys) {
    const nodeOut = outputs[key];
    if (nodeOut && Array.isArray(nodeOut.images) && nodeOut.images.length) {
      return nodeOut.images.filter((im) => im && im.filename);
    }
  }
  // 不要随便拿其他节点的图：采样器预览噪声会被误当成最终结果
  return null;
}

async function fetchHistoryEntry(promptId) {
  try {
    const res = await api.fetchApi("/history/" + encodeURIComponent(promptId));
    if (!res.ok) return null;
    const hist = await res.json();
    if (!hist || typeof hist !== "object") return null;
    return hist[promptId] || hist[String(promptId)] || null;
  } catch (_e) {
    return null;
  }
}

/** Read board ui/output shots_json from a history (or executed) outputs map. */
function pickBoardShotsJsonFromOutputs(outputs, boardNodeId) {
  if (!outputs || typeof outputs !== "object") return "";
  const want = boardNodeId != null ? String(boardNodeId) : "";
  const readOne = (nodeOut) => {
    if (!nodeOut || typeof nodeOut !== "object") return "";
    const sj = nodeOut.shots_json;
    if (Array.isArray(sj) && sj.length) return String(sj[0] ?? "").trim();
    if (typeof sj === "string") return sj.trim();
    return "";
  };
  if (want && outputs[want]) {
    const hit = readOne(outputs[want]);
    if (hit) return hit;
  }
  for (const [key, nodeOut] of Object.entries(outputs)) {
    if (want && String(key) !== want) continue;
    const hit = readOne(nodeOut);
    if (hit) return hit;
  }
  return "";
}

/**
 * After stage1 finishes, prefer history/executed board JSON over edit_json widget.
 * edit_json can still hold the previous run for a few hundred ms (intermittent skip of 生图).
 */
async function reloadBoardAfterStage1(boardNode, editW, promptId) {
  if (!boardNode || typeof boardNode._h3BoardReload !== "function") return "none";
  let fromEvent = "";
  const onExecuted = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (promptId && String(detail.prompt_id || "") !== String(promptId)) return;
      const nodeId = detail.node != null ? detail.node : detail.display_node;
      if (String(nodeId) !== String(boardNode.id)) return;
      const hit = pickBoardShotsJsonFromOutputs({ [String(nodeId)]: detail.output || {} }, boardNode.id);
      if (hit) fromEvent = hit;
    } catch (_e) {}
  };
  try {
    if (api.addEventListener) api.addEventListener("executed", onExecuted);
  } catch (_e) {}
  try {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if (fromEvent) {
        boardNode._h3BoardReload(fromEvent, true);
        return "event";
      }
      if (promptId) {
        const entry = await fetchHistoryEntry(promptId);
        const fromHist = pickBoardShotsJsonFromOutputs(entry && entry.outputs, boardNode.id);
        if (fromHist) {
          boardNode._h3BoardReload(fromHist, true);
          return "history";
        }
      }
      await sleep(120);
    }
    if (editW) {
      boardNode._h3BoardReload(String(editW.value || ""), true);
      return "edit_widget";
    }
    return "none";
  } finally {
    try {
      if (api.removeEventListener) api.removeEventListener("executed", onExecuted);
    } catch (_e) {}
  }
}

function formatHistoryMessage(m) {
  if (m == null) return "";
  if (typeof m === "string") return m;
  if (!Array.isArray(m) || !m.length) {
    if (typeof m === "object") {
      return String(m.exception_message || m.message || m.status_str || "");
    }
    return String(m);
  }
  const type = String(m[0] || "");
  const data = m[1];
  if (type === "execution_interrupted") return "已中断";
  if (type === "execution_error") {
    if (data && typeof data === "object") {
      return formatExecutionDetail(data) || "执行失败";
    }
    return "执行失败";
  }
  if (
    type === "execution_start" ||
    type === "execution_cached" ||
    type === "execution_success" ||
    type === "execution_complete"
  ) {
    return "";
  }
  if (data != null && typeof data === "object") {
    const detail = data.exception_message || data.message;
    return detail ? type + ": " + detail : type;
  }
  return type;
}

function formatNodeErrors(nodeErrors) {
  if (!nodeErrors || typeof nodeErrors !== "object") return "";
  const parts = [];
  for (const [nodeId, info] of Object.entries(nodeErrors)) {
    const ctype = String((info && info.class_type) || "节点").trim() || "节点";
    const errs = (info && Array.isArray(info.errors) && info.errors.length)
      ? info.errors
      : [{}];
    for (const e of errs) {
      const rawMsg = String((e && (e.message || e.exception_message)) || "").trim();
      const details = String((e && e.details) || "").trim();
      let line = "";
      if (/required input is missing/i.test(rawMsg)) {
        const miss = details || rawMsg.replace(/^.*missing:\s*/i, "").trim() || "未知输入";
        line =
          "#" +
          nodeId +
          " " +
          ctype +
          " 缺少必填输入「" +
          miss +
          "」，请检查该节点连线/模型是否接好";
      } else if (/value not in list/i.test(rawMsg)) {
        line =
          "#" +
          nodeId +
          " " +
          ctype +
          " 选项无效" +
          (details ? "：" + details : "") +
          "，请重新选择模型/文件";
      } else if (rawMsg) {
        line = "#" + nodeId + " " + ctype + ": " + rawMsg + (details ? "（" + details + "）" : "");
      } else {
        line = "#" + nodeId + " " + ctype + " 校验失败";
      }
      parts.push(line);
    }
  }
  return parts.join("\n");
}

function formatExecutionDetail(detail) {
  if (!detail || typeof detail !== "object") return "";
  const id = detail.node_id != null ? "#" + detail.node_id + " " : "";
  const ctype = String(detail.node_type || detail.class_type || "").trim();
  const exType = String(detail.exception_type || "").trim();
  const exMsg = String(detail.exception_message || detail.message || "").trim();
  const bits = [];
  if (id || ctype) bits.push((id + ctype).trim());
  if (exType && exMsg && !exMsg.includes(exType)) bits.push(exType + ": " + exMsg);
  else if (exMsg) bits.push(exMsg);
  else if (exType) bits.push(exType);
  return bits.join(" — ");
}

/** ComfyUI PromptExecutionError.message 常为固定文案 "Prompt execution failed"，真因在 response.node_errors。 */
function formatComfyError(err) {
  if (err == null) return "未知错误";
  if (typeof err === "string") return err.trim() || "未知错误";

  const resp = err.response || err.promptError || null;
  if (resp && typeof resp === "object") {
    const fromNodes = formatNodeErrors(resp.node_errors);
    if (fromNodes) return fromNodes;
    const e = resp.error;
    if (typeof e === "string" && e.trim()) return e.trim();
    if (e && typeof e === "object") {
      const msg = String(e.message || "").trim();
      const details = String(e.details || "").trim();
      const joined = [msg, details].filter(Boolean).join(": ");
      if (joined) return joined;
    }
  }

  const fromExec = formatExecutionDetail(err);
  if (fromExec) return fromExec;

  const msg = String(err.message || "").trim();
  if (msg && !/^prompt execution failed$/i.test(msg)) return msg;

  try {
    if (typeof err.toString === "function") {
      const s = String(err.toString()).trim();
      if (s && s !== "[object Object]" && !/^error$/i.test(s) && !/^prompt execution failed$/i.test(s)) {
        // toString 常含 class_type / Required input...
        const rebuilt = formatNodeErrors(err.response && err.response.node_errors);
        if (rebuilt) return rebuilt;
        return s.replace(/^Error:\s*/i, "");
      }
    }
  } catch (_e) {}

  return msg || "执行失败";
}

function isInterruptMessage(text) {
  const s = String(text || "").toLowerCase();
  return s.includes("中断") || s.includes("interrupt");
}

function historyStatusError(entry) {
  const st = (entry && entry.status) || {};
  const statusStr = String(st.status_str || st.status || "").toLowerCase();
  if (statusStr.includes("interrupt")) return "已中断";
  if (statusStr === "error" || st.completed === false) {
    const msgs = (st.messages || []).map(formatHistoryMessage).filter(Boolean);
    if (msgs.some(isInterruptMessage)) return "已中断";
    return msgs.join("; ") || "执行失败";
  }
  return "";
}

async function waitPromptImages(promptId, saveNodeId) {
  const deadline = Date.now() + 15 * 60 * 1000;
  let sawEntry = false;
  let emptyIdle = 0;
  let lastErr = "";

  // 优先用执行事件拿图，避免轮询历史时序问题
  let eventImages = null;
  let eventError = null;
  const onExecuted = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      // 必须匹配本次 prompt；否则会误收采样器预览噪声图（看起来像乱码）
      if (String(detail.prompt_id || "") !== String(promptId)) return;
      const nodeId = detail.node != null ? detail.node : detail.display_node;
      if (saveNodeId != null && String(nodeId) !== String(saveNodeId)) return;
      const out = detail.output;
      if (out && Array.isArray(out.images) && out.images.length) {
        const imgs = out.images.filter((im) => im && im.filename);
        if (imgs.length) eventImages = imgs;
      }
    } catch (_e) {}
  };
  const onError = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (String(detail.prompt_id || "") !== String(promptId)) return;
      eventError = formatExecutionDetail(detail) || String(detail.exception_message || detail.message || "文生图执行失败");
    } catch (_e) {}
  };
  const onInterrupted = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (detail.prompt_id != null && String(detail.prompt_id) !== String(promptId)) return;
      eventError = "已中断";
    } catch (_e) {}
  };
  try {
    if (api.addEventListener) {
      api.addEventListener("executed", onExecuted);
      api.addEventListener("execution_error", onError);
      api.addEventListener("execution_interrupted", onInterrupted);
    }
  } catch (_e) {}

  try {
    while (Date.now() < deadline) {
      if (eventError) throw new Error(eventError);
      if (eventImages && eventImages.length) return eventImages;

      const entry = await fetchHistoryEntry(promptId);
      if (entry) {
        sawEntry = true;
        const err = historyStatusError(entry);
        if (err) throw new Error(err);
        const imgs = pickImagesFromOutputs(entry.outputs, saveNodeId);
        if (imgs && imgs.length) return imgs;
        // 已完成但仍无图
        const st = entry.status || {};
        if (st.completed === true || String(st.status_str || "").toLowerCase() === "success") {
          emptyIdle += 1;
          if (emptyIdle >= 8) {
            throw new Error("文生图已结束但未拿到图片，请检查「文生图子流程」与 SaveImage 连接");
          }
        } else {
          emptyIdle = 0;
        }
      } else {
        // 还没进 history：看队列是否已空
        try {
          const q = await api.getQueue();
          const running = (q.queue_running || q.Running || []).length;
          const pending = (q.queue_pending || q.Pending || []).length;
          if (running + pending === 0) {
            emptyIdle += 1;
            // 给 history 落盘留时间；未见 entry 时多等一会
            if (emptyIdle >= (sawEntry ? 8 : 15)) {
              throw new Error(lastErr || "文生图已结束但未拿到图片，请检查「文生图子流程」与 SaveImage 连接");
            }
          } else {
            emptyIdle = 0;
          }
        } catch (err) {
          const msg = String((err && err.message) || err || "");
          if (msg.includes("文生图") || isInterruptMessage(msg)) throw err;
          lastErr = msg;
        }
      }
      await sleep(800);
    }
    throw new Error("文生图超时（15 分钟）");
  } finally {
    try {
      if (api.removeEventListener) {
        api.removeEventListener("executed", onExecuted);
        api.removeEventListener("execution_error", onError);
        api.removeEventListener("execution_interrupted", onInterrupted);
      }
    } catch (_e) {}
  }
}

async function importGeneratedImage(imgInfo) {
  if (!imgInfo || !imgInfo.filename) throw new Error("无有效图片输出");
  const res = await api.fetchApi(IMPORT_OUTPUT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: imgInfo.filename,
      subfolder: imgInfo.subfolder || "",
      type: imgInfo.type || "output",
    }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error("解析产出路径接口返回非 JSON");
  }
  if (!res.ok || (data && data.error)) throw new Error((data && data.error) || ("解析图片路径失败 HTTP " + res.status));
  const outPath = String((data && data.path) || "").trim();
  if (!outPath) throw new Error("解析成功但未返回路径");
  return outPath;
}

async function runTxt2ImgOnce(boardNode, promptText, width, height) {
  const text = String(promptText || "").trim();
  if (!text) throw new Error("生图提示词为空");
  const { t2i, save, promptInputName } = findTxt2ImgBundle(boardNode);
  const textKey = promptInputName || "text";
  const w = width > 0 ? Math.round(Number(width)) : 0;
  const h = height > 0 ? Math.round(Number(height)) : 0;

  // widget 兜底：子流程未强制走输入口时仍能写上提示词/尺寸
  setNodeWidget(t2i, textKey, text);
  if (textKey !== "text") setNodeWidget(t2i, "text", text);
  if (w > 0) setNodeWidget(t2i, "width", w);
  if (h > 0) setNodeWidget(t2i, "height", h);
  if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);

  if (typeof app.graphToPrompt !== "function") throw new Error("当前前端不支持 graphToPrompt");
  const promptPack = await app.graphToPrompt();
  const output = promptPack.output || promptPack;
  const workflow = promptPack.workflow;

  const t2iKey = String(t2i.id);
  const saveKey = String(save.id);
  const prefix = t2iKey + ":";

  // 从 SaveImage + 文生图两侧收集；在看板处截断，不回溯剧本补全等上游
  const sub = collectUpstreamPrompt(output, [save.id, t2i.id], [boardNode.id]);
  for (const [nid, node] of Object.entries(output || {})) {
    const id = String(nid);
    if (id === t2iKey || id.startsWith(prefix) || id === saveKey) {
      if (!sub[id]) sub[id] = deepClone(node);
    }
  }
  if (!Object.keys(sub).length) {
    const t2iTitle = String(t2i.title || t2i.type || t2i.id);
    const t2iMode = t2i.mode;
    const saveMode = save.mode;
    const disabledHint =
      t2iMode === 4 || saveMode === 4
        ? "（当前「文生图子流程」或 SaveImage 为禁用 mode=4，graphToPrompt 不会收录它们）"
        : "（请确认文生图子流程与 SaveImage 已启用且连线完整）";
    throw new Error(
      "无法构建文生图子图 prompt：prompt 中找不到节点 #" +
        t2iKey +
        "「" +
        t2iTitle +
        "」或 SaveImage #" +
        saveKey +
        "。" +
        disabledHint
    );
  }

  inlineBoardOutputs(sub, boardNode, text, w, h);

  // 包装节点存在时，只写子流程暴露的 text/width/height
  if (sub[t2iKey] && sub[t2iKey].inputs) {
    sub[t2iKey].inputs[textKey] = text;
    if (textKey !== "text" && Object.prototype.hasOwnProperty.call(sub[t2iKey].inputs, "text")) {
      sub[t2iKey].inputs.text = text;
    }
    if (w > 0 && Object.prototype.hasOwnProperty.call(sub[t2iKey].inputs, "width")) {
      sub[t2iKey].inputs.width = w;
    }
    if (h > 0 && Object.prototype.hasOwnProperty.call(sub[t2iKey].inputs, "height")) {
      sub[t2iKey].inputs.height = h;
    }
  }

  // 展开节点：绝不能覆盖 positive/negative 等 CONDITIONING 连线。
  // 只处理「仍连向看板」的输入，或本身已是字符串的 text/prompt 控件值。
  for (const [nid, node] of Object.entries(sub)) {
    if (!node || !node.inputs) continue;
    if (nid !== t2iKey && !String(nid).startsWith(prefix)) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      const k = String(key).toLowerCase();
      const fromBoard = Array.isArray(v) && String(v[0]) === String(boardNode.id);
      const isPlainString = typeof v === "string";
      if (fromBoard) {
        if (isPromptTextInputName(k) || k === String(textKey).toLowerCase()) node.inputs[key] = text;
        else if (k === "width" || k.includes("width")) node.inputs[key] = w || 512;
        else if (k === "height" || k.includes("height")) node.inputs[key] = h || 512;
        else delete node.inputs[key];
      } else if (isPlainString && isPromptTextInputName(k)) {
        // 仅覆盖原本就是文本控件的值，不动数组连线
        node.inputs[key] = text;
      }
    }
  }

  const boardId = String(boardNode.id);
  for (const node of Object.values(sub)) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      if (!Array.isArray(v) || String(v[0]) !== boardId) continue;
      const k = String(key).toLowerCase();
      if (k === "width") node.inputs[key] = w || 512;
      else if (k === "height") node.inputs[key] = h || 512;
      else if (isPromptTextInputName(k)) node.inputs[key] = text;
      else delete node.inputs[key];
    }
  }

  if (!sub[saveKey] && !sub[save.id]) {
    throw new Error("局部 prompt 中缺少 SaveImage 节点");
  }
  if (sub[saveKey] && sub[saveKey].inputs) {
    sub[saveKey].inputs.filename_prefix = PREFIX_IMAGES;
  }
  const hasT2i = !!sub[t2iKey] || Object.keys(sub).some((k) => String(k).startsWith(prefix));
  if (!hasT2i) {
    throw new Error(
      "局部 prompt 中缺少文生图子流程节点（id=" +
        t2iKey +
        "）。请确认生图提示词已连到文生图子流程，且子流程 IMAGE 已连到 SaveImage"
    );
  }

  const queued = await queuePromptLocal(0, { output: sub, workflow });
  const promptId = queued.prompt_id || queued.promptId;
  if (!promptId) throw new Error("queuePrompt 未返回 prompt_id");
  const images = await waitPromptImages(promptId, save.id);
  return importGeneratedImage(images[0]);
}


function findSaveVideoDownstream(rootNode) {
  if (!rootNode) return null;
  const seen = new Set();
  const stack = [rootNode];
  eachGraphLink((link) => {
    if (String(link.origin_id) !== String(rootNode.id)) return;
    const tgt = graphGetNode(link.target_id);
    if (tgt) stack.push(tgt);
  });
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (cur.type === "SaveVideo") return cur;
    eachGraphLink((link) => {
      if (String(link.origin_id) !== String(cur.id)) return;
      const tgt = graphGetNode(link.target_id);
      if (tgt) stack.push(tgt);
    });
  }
  return null;
}

function nodeHasVideoInput(node) {
  return ((node && node.inputs) || []).some((inp) => {
    const n = String((inp && (inp.name || inp.localized_name || inp.label)) || "").trim().toLowerCase();
    return n === "video";
  });
}

function subgraphDisplayName(node) {
  if (!node) return "";
  const title = String(node.title || "").trim();
  if (title) return title;
  try {
    if (node.subgraph && node.subgraph.name) return String(node.subgraph.name).trim();
  } catch (_e) {}
  try {
    const propsName = node.properties && (node.properties.name || node.properties.title);
    if (propsName) return String(propsName).trim();
  } catch (_e) {}
  const type = String(node.type || "").trim();
  if (!type) return "";
  try {
    const g = graphObj();
    const pools = [
      g && g.definitions && g.definitions.subgraphs,
      app.graph && app.graph.definitions && app.graph.definitions.subgraphs,
      app.subgraphs,
    ];
    for (const list of pools) {
      if (!Array.isArray(list)) continue;
      const hit = list.find((s) => s && (s.id === type || String(s.id) === type));
      if (hit && hit.name) return String(hit.name).trim();
    }
  } catch (_e) {}
  return type;
}

function isFirstVideoSubgraph(node) {
  const title = subgraphDisplayName(node);
  if (/非首/.test(title)) return false;
  if (/首分镜|首镜/.test(title) && !/非/.test(title)) return true;
  // 非首镜对外有 video 口；首分镜没有
  return !nodeHasVideoInput(node);
}

function bustVideoPromptCaches(sub) {
  for (const node of Object.values(sub || {})) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const lk = String(key).toLowerCase();
      if (!(lk.includes("seed") || lk === "noise_seed")) continue;
      if (typeof node.inputs[key] === "number") {
        node.inputs[key] = Math.floor(Math.random() * 1e15);
      }
    }
  }
}

function forceBundlePromptText(sub, videoNodeId, text) {
  const vKey = String(videoNodeId);
  const prefix = vKey + ":";
  const t = String(text || "");
  for (const [nid, node] of Object.entries(sub || {})) {
    if (nid !== vKey && !String(nid).startsWith(prefix)) continue;
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const k = String(key).toLowerCase();
      if (!(isPromptTextInputName(k) || k === "prompt" || k === "text")) continue;
      const v = node.inputs[key];
      if (typeof v === "string" || v == null || v === "") node.inputs[key] = t;
    }
  }
}

async function mediaByteLength(path) {
  const url = mediaSrc(path);
  if (!url) return -1;
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) {
      const len = Number(head.headers.get("content-length"));
      if (Number.isFinite(len) && len > 0) return len;
    }
  } catch (_e) {}
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return -1;
    const buf = await res.arrayBuffer();
    return buf.byteLength;
  } catch (_e) {
    return -1;
  }
}

async function assertVideoResultDistinct(pathOut, prevVideoPath) {
  const prev = String(prevVideoPath || "").trim();
  const cur = String(pathOut || "").trim();
  if (!prev || !cur) return;
  if (prev === cur) {
    throw new Error("生视频结果路径与上一镜相同，非首镜未真正出新片（请检查是否走错子流程/命中缓存）");
  }
  const [a, b] = await Promise.all([mediaByteLength(prev), mediaByteLength(cur)]);
  if (a > 0 && b > 0 && a === b) {
    throw new Error(
      "生视频结果与上一镜文件大小完全一致，疑似未重新采样、直出了上一镜。" +
        "请确认点的是非首镜子流程，并清空队列缓存后重试"
    );
  }
}

function findVideoBundle(boardNode, wantFirst) {
  if (!boardNode) throw new Error("看板节点无效");
  let targets = linkedTargets(boardNode, OUT_VIDEO_PROMPT);
  let chosen = targets.filter((t) => {
    const n = String(t.inputName || "").toLowerCase();
    return !n || n === "prompt" || n === "text" || n.includes("prompt") || isTextLikeInputName(t.inputName);
  });
  if (!chosen.length) chosen = targets.slice();

  if (!chosen.length) {
    const g = graphObj();
    const nodes = (g && (g._nodes || g.nodes)) || [];
    for (const n of nodes) {
      if (!n) continue;
      const title = String(n.title || (n.subgraph && n.subgraph.name) || "");
      if (!(/生视频|首分镜|非首/.test(title) || nodeHasVideoInput(n) || isSubgraphLikeNode(n))) continue;
      if (!findSaveVideoDownstream(n)) continue;
      chosen.push({ node: n, slot: 0, linkId: null, inputName: "prompt" });
    }
  }

  let final = null;
  for (const t of chosen) {
    if (isFirstVideoSubgraph(t.node) === !!wantFirst) {
      final = t;
      break;
    }
  }
  if (!final) {
    throw new Error(
      wantFirst
        ? "未找到「首分镜」生视频子流程。请把看板「生视频提示词」连到其 prompt，并接到 SaveVideo"
        : "未找到「非首分镜」生视频子流程。请把看板「生视频提示词」连到其 prompt，并接到 SaveVideo"
    );
  }
  const vsub = final.node;
  const save = findSaveVideoDownstream(vsub);
  if (!save) throw new Error("生视频子流程未连到 SaveVideo");
  return { vsub, save, promptInputName: final.inputName || "prompt" };
}

function buildGenerationDropSet(output, boardNode) {
  const drop = new Set();
  const mark = (node, save) => {
    if (!node) return;
    drop.add(String(node.id));
    if (save) drop.add(String(save.id));
    const prefix = String(node.id) + ":";
    for (const id of Object.keys(output || {})) {
      if (id === String(node.id) || (save && id === String(save.id)) || id.startsWith(prefix)) {
        drop.add(String(id));
      }
    }
  };
  for (const wantFirst of [true, false]) {
    try {
      const { vsub, save } = findVideoBundle(boardNode, wantFirst);
      mark(vsub, save);
    } catch (_e) {}
  }
  try {
    const { t2i, save } = findTxt2ImgBundle(boardNode);
    mark(t2i, save);
  } catch (_e) {}
  for (const [id, node] of Object.entries(output || {})) {
    const ct = String((node && node.class_type) || "");
    if (ct === "SaveImage" || ct === "SaveVideo" || ct === "SaveImageWebsocket") {
      drop.add(String(id));
    }
  }
  return drop;
}

function isStage1OutputNode(node) {
  const ct = String((node && node.class_type) || "");
  if (!ct) return false;
  if (ct === "MinimaxH3SaveJson" || ct === "MinimaxH3ScriptBoard") return true;
  // 分镜拆解旁路的「编辑文本」预览（剧本文本/H3提示词/全局提示词）也要跑，
  // 否则 stage1 只沿看板上游执行时这些叶子节点不刷新，看起来像「只有 JSON 有值」。
  if (ct === "MinimaxH3TextEdit") return true;
  if (/^Preview/i.test(ct)) return true;
  if (ct === "ShowText" || ct === "PreviewAny") return true;
  return false;
}

/**
 * 全局运行第一阶段：跑剧本/拆解/保存JSON/预览/看板等，
 * 不含文生图与生视频（那些由后续局部调度）。
 * 注意：不能只收集看板上游，否则 SaveJson、Preview 等旁路输出不会执行。
 */
function collectGlobalStage1Prompt(output, boardNode) {
  if (!output) return {};
  const drop = buildGenerationDropSet(output, boardNode);
  const roots = [];
  if (boardNode && boardNode.id != null) roots.push(String(boardNode.id));
  for (const [id, node] of Object.entries(output)) {
    if (drop.has(String(id))) continue;
    if (isStage1OutputNode(node)) roots.push(String(id));
  }
  const uniq = Array.from(new Set(roots));
  if (!uniq.length) return {};
  const sub = collectUpstreamPrompt(output, uniq, []);
  for (const id of Object.keys(sub)) {
    if (drop.has(id) || Array.from(drop).some((d) => id.startsWith(d + ":"))) {
      delete sub[id];
    }
  }
  for (const node of Object.values(sub)) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      if (Array.isArray(v) && drop.has(String(v[0]))) delete node.inputs[key];
    }
  }
  return sub;
}

function isNodeExecutable(node) {
  if (!node) return false;
  const m = Number(node.mode);
  // ComfyUI / LiteGraph：2=Bypass，4=Never（禁用）。禁用节点不应劫持全局运行。
  if (m === 2 || m === 4) return false;
  return true;
}

/** 仅当看板与生视频链路均启用时，才接管全局 Queue 跑成片管线。 */
function boardHasVideoPipeline(boardNode) {
  if (!boardNode || !isNodeExecutable(boardNode)) return false;
  for (const wantFirst of [true, false]) {
    try {
      const { vsub, save } = findVideoBundle(boardNode, wantFirst);
      if (isNodeExecutable(vsub) && isNodeExecutable(save)) return true;
    } catch (_e) {}
  }
  return false;
}

function boardHasShotsJsonLink(boardNode) {
  const inputs = (boardNode && boardNode.inputs) || [];
  for (const inp of inputs) {
    if (!inp) continue;
    const name = String(inp.name || inp.localized_name || "").toLowerCase();
    if (name === "shots_json" || name.includes("分镜资产")) {
      return inp.link != null;
    }
  }
  return false;
}

/**
 * 看板 shots_json 输入不是必须。仅在「无上游 + 看板本身也无可用内容」时提示补全。
 * 有上游连线时交给第一阶段跑通；有本地剧本/分镜则可直接继续。
 */
function collectBoardRunMissingHints(boardNode, state) {
  const miss = [];
  const hasShots = ((state && state.shots_info) || []).length > 0;
  const hasScript = !!String((state && state.script) || "").trim();
  const linked = boardHasShotsJsonLink(boardNode);
  if (!linked && !hasShots && !hasScript) {
    miss.push(
      "剧本/分镜内容（可选连接「分镜资产结果JSON」，或在看板中导入/编辑剧本与分镜）"
    );
  }
  return miss;
}

async function waitPromptFinished(promptId) {
  const deadline = Date.now() + 30 * 60 * 1000;
  let eventError = null;
  const onError = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (String(detail.prompt_id || "") !== String(promptId)) return;
      eventError = formatExecutionDetail(detail) || String(detail.exception_message || detail.message || "执行失败");
    } catch (_e) {}
  };
  const onInterrupted = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (detail.prompt_id != null && String(detail.prompt_id) !== String(promptId)) return;
      eventError = "已中断";
    } catch (_e) {}
  };
  try {
    if (api.addEventListener) {
      api.addEventListener("execution_error", onError);
      api.addEventListener("execution_interrupted", onInterrupted);
    }
  } catch (_e) {}
  try {
    while (Date.now() < deadline) {
      if (eventError) throw new Error(eventError);
      const entry = await fetchHistoryEntry(promptId);
      if (entry) {
        const err = historyStatusError(entry);
        if (err) throw new Error(err);
        const st = entry.status || {};
        if (st.completed === true || String(st.status_str || "").toLowerCase() === "success") return entry;
      } else {
        try {
          const q = await api.getQueue();
          const running = (q.queue_running || q.Running || []).length;
          const pending = (q.queue_pending || q.Pending || []).length;
          if (running + pending === 0) {
            const again = await fetchHistoryEntry(promptId);
            if (again) {
              const err = historyStatusError(again);
              if (err) throw new Error(err);
              return again;
            }
          }
        } catch (err) {
          const msg = String((err && err.message) || err || "");
          if (msg.includes("执行失败") || isInterruptMessage(msg)) throw err;
        }
      }
      await sleep(500);
    }
    throw new Error("上游执行超时（30 分钟）");
  } finally {
    try {
      if (api.removeEventListener) {
        api.removeEventListener("execution_error", onError);
        api.removeEventListener("execution_interrupted", onInterrupted);
      }
    } catch (_e) {}
  }
}

function installH3QueueGuard() {
  if (h3QueueGuardInstalled) return;
  h3QueueGuardInstalled = true;
  const origApi = api.queuePrompt.bind(api);
  api.queuePrompt = async function (number, prompt) {
    if (h3LocalQueueDepth > 0) return origApi(number, prompt);
    const board = findScriptBoardNode();
    if (!board || typeof board._h3RunGlobalFilm !== "function" || !boardHasVideoPipeline(board)) {
      return origApi(number, prompt);
    }
    return board._h3RunGlobalFilm();
  };
  if (typeof app.queuePrompt === "function") {
    const origApp = app.queuePrompt.bind(app);
    app.queuePrompt = async function (number, batchCount) {
      if (h3LocalQueueDepth > 0) return origApp(number, batchCount);
      const board = findScriptBoardNode();
      if (!board || typeof board._h3RunGlobalFilm !== "function" || !boardHasVideoPipeline(board)) {
        return origApp(number, batchCount);
      }
      return board._h3RunGlobalFilm();
    };
  }
}

function collectShotRefMedia(state, shot) {
  // 顺序必须与 subject_definitions 的 Picture 顺序一致：角色 → 道具 → 场景 →（非首镜）上一镜尾帧
  const images = [];
  const audios = [];
  const missingImages = [];
  const missingAudios = [];
  const appear = (shot && shot.appear) || {};
  const findAsset = (key, id) => (state.global[key] || []).find((x) => Number(x.id) === Number(id));
  const labels = { roles: "角色", prop: "道具", scene: "场景" };
  for (const key of ["roles", "prop", "scene"]) {
    for (const id of appear[key] || []) {
      const item = findAsset(key, id);
      const label = (labels[key] || key) + "#" + id + (item && item.name ? " " + item.name : "");
      if (!item) {
        missingImages.push(label + "（素材不存在）");
        continue;
      }
      const ip = String(item.bing_image_path || "").trim();
      if (ip) images.push(ip);
      else missingImages.push(label);
      if (key === "roles") {
        const ap = String(item.bing_audio_path || "").trim();
        if (ap) audios.push(ap);
        else missingAudios.push(label);
      }
    }
  }
  const lastFrame = String((shot && shot.pre_last_frame_path) || "").trim();
  if (lastFrame) images.push(lastFrame);
  return {
    images: images.slice(0, 9),
    audios: audios.slice(0, 3),
    missingImages,
    missingAudios,
  };
}

function nextSyntheticId(promptObj) {
  let maxId = 0;
  for (const k of Object.keys(promptObj || {})) {
    const n = Number(String(k).split(":")[0]);
    if (Number.isFinite(n)) maxId = Math.max(maxId, n);
  }
  return maxId + 1;
}

function nodesInVideoBundle(sub, videoNodeId) {
  const vKey = String(videoNodeId);
  const prefix = vKey + ":";
  const out = [];
  for (const [nid, node] of Object.entries(sub || {})) {
    if (!node || !node.inputs) continue;
    const id = String(nid);
    if (id === vKey || id.startsWith(prefix)) out.push(node);
  }
  return out;
}

function findRefConsumers(sub, videoNodeId) {
  // 子图展开后必须打到真正吃参考口的节点，绝不能写到 CreateVideo
  // （CreateVideo 只有 images/audio，写入 ref_images.* 会报 unexpected keyword）。
  // 参考口不必再暴露到子流程外壳：按 class_type 直接找 MiniMax 即可注入。
  const bundle = nodesInVideoBundle(sub, videoNodeId);
  const all = Object.values(sub || {}).filter((n) => n && n.inputs);
  const pickMiniMax = (nodes) =>
    nodes.filter((n) => String(n.class_type || "") === "MiniMaxH3ReferenceToVideo");
  let minimax = pickMiniMax(bundle);
  if (!minimax.length) minimax = pickMiniMax(all);

  const byImgKey = (nodes) =>
    nodes.filter((n) => {
      const ct = String(n.class_type || "");
      if (ct === "CreateVideo" || ct === "SaveVideo") return false;
      return Object.keys(n.inputs || {}).some((k) => /^ref_images\.ref_image_\d+$/i.test(k));
    });
  const byAudKey = (nodes) =>
    nodes.filter((n) => {
      const ct = String(n.class_type || "");
      if (ct === "CreateVideo" || ct === "SaveVideo") return false;
      return Object.keys(n.inputs || {}).some((k) => /^ref_audios\.ref_audio_\d+$/i.test(k));
    });

  const imageNodes = minimax.length ? minimax : byImgKey(bundle).length ? byImgKey(bundle) : byImgKey(all);
  const audioNodes = minimax.length ? minimax : byAudKey(bundle).length ? byAudKey(bundle) : byAudKey(all);
  return { imageNodes, audioNodes };
}

function isVideoSliceNode(node) {
  const ct = String((node && node.class_type) || "");
  return /Video\s*Slice/i.test(ct) || /^VideoSlice$/i.test(ct);
}

function isPrevVideoCropNode(node) {
  return String((node && node.class_type) || "") === "MinimaxH3CropVideoByFrame";
}

function createVideoIdsOf(sub) {
  const ids = new Set();
  for (const [nid, node] of Object.entries(sub || {})) {
    if (node && String(node.class_type || "") === "CreateVideo") ids.add(String(nid));
  }
  return ids;
}

function isFedByCreateVideo(node, createIds) {
  const cur = node && node.inputs && node.inputs.video;
  return Array.isArray(cur) && createIds.has(String(cur[0]));
}

/**
 * 上一镜 video 注入：
 * 1) 已有 MinimaxH3CropVideoByFrame（非 CreateVideo 成片那路）
 * 2) 子图壳对外 video 口
 * 3) 旧 Video Slice
 * 4) 裁掉时重建 Crop + GetVideoComponents / AddGuide
 * 绝不能盖到 VideoTemporalCrop（否则成片变上一镜裁剪副本）。
 */
function injectPrevVideoPath(sub, videoNodeId, prevVideoPath) {
  const path = String(prevVideoPath || "").trim();
  if (!path) return;

  let nextId = nextSyntheticId(sub);
  const loaderId = String(nextId++);
  sub[loaderId] = { class_type: "MinimaxH3LoadVideoPath", inputs: { path } };

  const vKey = String(videoNodeId);
  const shell = sub[vKey];
  const createIds = createVideoIdsOf(sub);

  const cropEntries = [];
  for (const [nid, node] of Object.entries(sub || {})) {
    if (!isPrevVideoCropNode(node)) continue;
    if (isFedByCreateVideo(node, createIds)) continue;
    if (!node.inputs) node.inputs = {};
    node.inputs.video = [loaderId, 0];
    cropEntries.push([String(nid), node]);
  }
  if (cropEntries.length) return;

  // 未展开时：挂到子图对外 video 口（子图内再接到按帧裁剪）
  if (shell) {
    if (!shell.inputs) shell.inputs = {};
    shell.inputs.video = [loaderId, 0];
    return;
  }

  const sliceEntries = [];
  for (const [nid, node] of Object.entries(sub || {})) {
    if (!isVideoSliceNode(node)) continue;
    if (!node.inputs) node.inputs = {};
    if (node.inputs.start_time == null) node.inputs.start_time = -1;
    if (node.inputs.duration == null) node.inputs.duration = 1;
    if (node.inputs.strict_duration == null) node.inputs.strict_duration = false;
    node.inputs.video = [loaderId, 0];
    sliceEntries.push([String(nid), node]);
  }
  if (sliceEntries.length) return;

  const cropId = String(nextId++);
  sub[cropId] = {
    class_type: "MinimaxH3CropVideoByFrame",
    inputs: {
      video: [loaderId, 0],
      start_frame: 5,
      crop_from: "从尾截起",
      keep_part: "后部分",
      interval: "闭区间[a,b]",
    },
  };

  let wired = 0;
  for (const [, node] of Object.entries(sub || {})) {
    if (!node || String(node.class_type || "") !== "GetVideoComponents") continue;
    if (isFedByCreateVideo(node, createIds)) continue;
    if (!node.inputs) node.inputs = {};
    node.inputs.video = [cropId, 0];
    wired += 1;
  }
  if (wired) return;

  const gvcId = String(nextId++);
  sub[gvcId] = { class_type: "GetVideoComponents", inputs: { video: [cropId, 0] } };

  // 优先接到 GetImageRangeFromBatch / 本插件等价节点（工作流里 AddGuide 吃的是它的抽帧）
  for (const [, node] of Object.entries(sub || {})) {
    if (
      !node ||
      !/GetImageRangeFromBatch|MinimaxH3GetImageRangeFromBatch/i.test(String(node.class_type || ""))
    ) {
      continue;
    }
    const img = node.inputs && node.inputs.images;
    if (Array.isArray(img) && sub[String(img[0])]) continue;
    if (!node.inputs) node.inputs = {};
    node.inputs.images = [gvcId, 0];
    wired += 1;
  }
  if (wired) return;

  const addGuides = Object.values(sub || {}).filter(
    (n) => n && /AddGuide/i.test(String(n.class_type || ""))
  );
  if (addGuides.length) {
    for (const ag of addGuides) {
      if (!ag.inputs) ag.inputs = {};
      ag.inputs.image = [gvcId, 0];
    }
    return;
  }

  const sample = Object.values(sub || {})
    .map((n) => (n && n.class_type) || "")
    .filter(Boolean)
    .slice(0, 12)
    .join(", ");
  throw new Error(
    "局部 prompt 中无法接入上一镜 video（按帧裁剪/Video Slice 已被裁掉且无 AddGuide/抽帧节点）。节点示例: " +
      (sample || "(空)")
  );
}

function clearMatchingSlots(node, patternOrKey) {
  if (!node || !node.inputs) return;
  if (typeof patternOrKey === "string") {
    delete node.inputs[patternOrKey];
    return;
  }
  for (const key of Object.keys(node.inputs)) {
    if (patternOrKey.test(key)) delete node.inputs[key];
  }
}

function injectPathLoaders(sub, videoNodeId, imagePaths, audioPaths, prevVideoPath) {
  let nextId = nextSyntheticId(sub);
  const { imageNodes, audioNodes } = findRefConsumers(sub, videoNodeId);

  const imageIds = [];
  for (let i = 0; i < (imagePaths || []).length && i < 9; i++) {
    const id = String(nextId++);
    sub[id] = { class_type: "MinimaxH3LoadImagePath", inputs: { path: imagePaths[i] } };
    imageIds.push(id);
  }
  const audioIds = [];
  for (let i = 0; i < (audioPaths || []).length && i < 3; i++) {
    const id = String(nextId++);
    sub[id] = { class_type: "MinimaxH3LoadAudioPath", inputs: { path: audioPaths[i] } };
    audioIds.push(id);
  }

  if (imageIds.length) {
    if (!imageNodes.length) {
      throw new Error("局部 prompt 中找不到可接收 ref_images 的节点（MiniMaxH3ReferenceToVideo）");
    }
    for (const node of imageNodes) {
      clearMatchingSlots(node, /^ref_images\.ref_image_\d+$/i);
      for (let i = 0; i < imageIds.length; i++) {
        node.inputs["ref_images.ref_image_" + i] = [imageIds[i], 0];
      }
    }
  }
  if (audioIds.length) {
    if (!audioNodes.length) {
      throw new Error("局部 prompt 中找不到可接收 ref_audios 的节点（MiniMaxH3ReferenceToVideo）");
    }
    for (const node of audioNodes) {
      clearMatchingSlots(node, /^ref_audios\.ref_audio_\d+$/i);
      for (let i = 0; i < audioIds.length; i++) {
        node.inputs["ref_audios.ref_audio_" + i] = [audioIds[i], 0];
      }
    }
  }
  if (prevVideoPath) {
    injectPrevVideoPath(sub, videoNodeId, prevVideoPath);
  }
}

function inlineBoardVideoOutputs(sub, boardNode, promptText, width, height, duration) {
  const boardId = String(boardNode.id);
  const promptSlot = outputSlotIndex(boardNode, OUT_VIDEO_PROMPT);
  const widthSlot = outputSlotIndex(boardNode, OUT_WIDTH);
  const heightSlot = outputSlotIndex(boardNode, OUT_HEIGHT);
  const durSlot = outputSlotIndex(boardNode, OUT_DURATION);
  const w = width > 0 ? Math.round(width) : 0;
  const h = height > 0 ? Math.round(height) : 0;
  const d = duration > 0 ? Math.round(duration) : 5;
  const text = String(promptText || "");
  for (const node of Object.values(sub)) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      if (!Array.isArray(v) || String(v[0]) !== boardId) continue;
      const slot = Number(v[1]);
      const k = String(key).toLowerCase();
      if (slot === promptSlot || k === "prompt" || isPromptTextInputName(k)) node.inputs[key] = text;
      else if (slot === widthSlot || k === "width") node.inputs[key] = w || 512;
      else if (slot === heightSlot || k === "height") node.inputs[key] = h || 512;
      else if (slot === durSlot || k === "values.a" || k === "duration" || k.endsWith(".a")) node.inputs[key] = d;
      else delete node.inputs[key];
    }
  }
  delete sub[boardId];
}

function pickVideosFromOutputs(outputs, saveNodeId) {
  if (!outputs || typeof outputs !== "object") return null;
  for (const key of [saveNodeId, String(saveNodeId)]) {
    const nodeOut = outputs[key];
    if (!nodeOut) continue;
    const list = nodeOut.images || nodeOut.gifs || nodeOut.videos || [];
    if (!Array.isArray(list) || !list.length) continue;
    const vids = list.filter((im) => {
      if (!im || !im.filename) return false;
      const name = String(im.filename).toLowerCase();
      return /\.(mp4|webm|mkv|mov|avi)$/.test(name) || im.animated;
    });
    if (vids.length) return vids;
    const any = list.filter((im) => im && im.filename);
    if (any.length) return any;
  }
  return null;
}

async function waitPromptVideos(promptId, saveNodeId) {
  const deadline = Date.now() + 30 * 60 * 1000;
  let sawEntry = false;
  let emptyIdle = 0;
  let lastErr = "";
  let eventVideos = null;
  let eventError = null;
  const onExecuted = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (String(detail.prompt_id || "") !== String(promptId)) return;
      const nodeId = detail.node != null ? detail.node : detail.display_node;
      if (saveNodeId != null && String(nodeId) !== String(saveNodeId)) return;
      const out = detail.output;
      const list = (out && (out.images || out.gifs || out.videos)) || [];
      if (Array.isArray(list) && list.length) {
        const vids = list.filter((im) => im && im.filename);
        if (vids.length) eventVideos = vids;
      }
    } catch (_e) {}
  };
  const onError = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (String(detail.prompt_id || "") !== String(promptId)) return;
      eventError = formatExecutionDetail(detail) || String(detail.exception_message || detail.message || "生视频执行失败");
    } catch (_e) {}
  };
  const onInterrupted = (ev) => {
    try {
      const detail = ev && (ev.detail || ev);
      if (!detail) return;
      if (detail.prompt_id != null && String(detail.prompt_id) !== String(promptId)) return;
      eventError = "已中断";
    } catch (_e) {}
  };
  try {
    if (api.addEventListener) {
      api.addEventListener("executed", onExecuted);
      api.addEventListener("execution_error", onError);
      api.addEventListener("execution_interrupted", onInterrupted);
    }
  } catch (_e) {}
  try {
    while (Date.now() < deadline) {
      if (eventError) throw new Error(eventError);
      if (eventVideos && eventVideos.length) return eventVideos;
      const entry = await fetchHistoryEntry(promptId);
      if (entry) {
        sawEntry = true;
        const err = historyStatusError(entry);
        if (err) throw new Error(String(err).replace(/文生图/g, "生视频"));
        const vids = pickVideosFromOutputs(entry.outputs, saveNodeId);
        if (vids && vids.length) return vids;
        const st = entry.status || {};
        if (st.completed === true || String(st.status_str || "").toLowerCase() === "success") {
          emptyIdle += 1;
          if (emptyIdle >= 8) throw new Error("生视频已结束但未拿到视频，请检查子流程与 SaveVideo 连接");
        } else emptyIdle = 0;
      } else {
        try {
          const q = await api.getQueue();
          const running = (q.queue_running || q.Running || []).length;
          const pending = (q.queue_pending || q.Pending || []).length;
          if (running + pending === 0) {
            emptyIdle += 1;
            if (emptyIdle >= (sawEntry ? 8 : 15)) {
              throw new Error(lastErr || "生视频已结束但未拿到视频，请检查子流程与 SaveVideo 连接");
            }
          } else emptyIdle = 0;
        } catch (err) {
          const msg = String((err && err.message) || err || "");
          if (msg.includes("生视频") || isInterruptMessage(msg)) throw err;
          lastErr = msg;
        }
      }
      await sleep(1000);
    }
    throw new Error("生视频超时（30 分钟）");
  } finally {
    try {
      if (api.removeEventListener) {
        api.removeEventListener("executed", onExecuted);
        api.removeEventListener("execution_error", onError);
        api.removeEventListener("execution_interrupted", onInterrupted);
      }
    } catch (_e) {}
  }
}


function formatFilmTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

function formatFilmClock(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const frac = Math.round((rest - whole) * 10);
  if (frac <= 0) {
    return String(m).padStart(2, "0") + ":" + String(whole).padStart(2, "0");
  }
  if (frac >= 10) {
    return String(m).padStart(2, "0") + ":" + String(whole + 1).padStart(2, "0");
  }
  return String(m).padStart(2, "0") + ":" + String(whole).padStart(2, "0") + "." + frac;
}

/** Map viewport clientX to element-local X, undoing LiteGraph/CSS scale. */
function localXFromClient(el, clientX) {
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const localW = el.offsetWidth || el.clientWidth || 1;
  const scaleX = rect.width / Math.max(1, localW);
  return (clientX - rect.left) / (scaleX || 1);
}

function formatFilmTick(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s < 60) {
    if (Math.abs(s - Math.round(s)) < 0.001) return String(Math.round(s)) + "s";
    return s.toFixed(1) + "s";
  }
  return formatFilmTime(s);
}

function filmTickStep(pxPerSec) {
  const pps = Math.max(1, Number(pxPerSec) || 40);
  const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const step of candidates) {
    if (step * pps >= 52) return step;
  }
  return 300;
}

function clampFilmPxPerSec(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 40;
  return Math.min(240, Math.max(6, n));
}

function bgmVolumeOf(state) {
  const n = Number(state && state.global && state.global.background_audio_volume);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0, n));
}

function clampFilmPlaybackRate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(4, Math.max(0.25, n));
}

function filmPlaybackRateOf(state) {
  return clampFilmPlaybackRate(state && state.global && state.global.film_playback_rate);
}

function bgmFollowSpeedOf(state) {
  return !!(state && state.global && state.global.bgm_follow_speed);
}

const FILM_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function clearShotFilmSrcCache(shot, measured) {
  if (!shot) return;
  const prevPath = String(shot.film_src_path || shot.video_path || "").trim();
  shot.film_src_dur = 0;
  shot.film_src_path = "";
  if (measured && prevPath) delete measured[prevPath];
}

function assignShotVideoPath(shot, path, measured) {
  if (!shot) return;
  const next = String(path || "").trim();
  const prev = String(shot.video_path || "").trim();
  if (prev !== next) clearShotFilmSrcCache(shot, measured);
  if (next) bustMedia(next);
  shot.video_path = next;
}

function filmSourceDuration(shot, measured) {
  const vp = String((shot && shot.video_path) || "").trim();
  const md = measured && vp ? Number(measured[vp]) : 0;
  if (Number.isFinite(md) && md > 0.2) return md;
  // 缓存必须绑定到当前 video_path，否则撤销/换片后会串时长
  const cached = Number(shot && shot.film_src_dur) || 0;
  const cachedPath = String((shot && shot.film_src_path) || "").trim();
  if (vp && cachedPath === vp && Number.isFinite(cached) && cached > 0.2) return cached;
  if (vp) {
    const fo = Number(shot && shot.film_out) || 0;
    if (fo > 0.2) return fo;
    return Math.max(0.1, Number(shot && shot.duration) || 5);
  }
  return Math.max(0.1, Number(shot && shot.duration) || 5);
}

/** 把实测时长写回「路径 → 时长」以及 video_path 匹配的分镜。 */
function writeMeasuredDuration(shots, measured, path, md, preferShotId) {
  const p = String(path || "").trim();
  const dur = Math.round(Number(md) * 1000) / 1000;
  if (!p || !(dur > 0.2)) return false;
  const prev = measured ? Number(measured[p]) || 0 : 0;
  if (measured) measured[p] = dur;
  let changed = Math.abs(prev - dur) > 0.08;
  const list = Array.isArray(shots) ? shots : [];
  for (const shot of list) {
    if (String(shot.video_path || "").trim() !== p) continue;
    if (preferShotId != null && Number(shot.id) !== Number(preferShotId)) {
      // 仍更新同路径分镜；prefer 只是调用方提示
    }
    if (Number(shot.film_src_dur) !== dur || String(shot.film_src_path || "") !== p) {
      shot.film_src_dur = dur;
      shot.film_src_path = p;
      changed = true;
    }
  }
  return changed;
}

/** 丢掉与当前 video_path 不一致的过期片长缓存（撤销/换片后常见）。 */
function reconcileShotFilmSrcCaches(state, measured) {
  let changed = false;
  for (const shot of (state && state.shots_info) || []) {
    const vp = String(shot.video_path || "").trim();
    const cachedPath = String(shot.film_src_path || "").trim();
    const cached = Number(shot.film_src_dur) || 0;
    if (!vp) {
      if (cached > 0 || cachedPath) {
        clearShotFilmSrcCache(shot, measured);
        changed = true;
      }
      continue;
    }
    if (cachedPath && cachedPath !== vp) {
      clearShotFilmSrcCache(shot, measured);
      changed = true;
      continue;
    }
    // 无 path 戳记的旧数据不可信，强制失效以便重测
    if (cached > 0.2 && !cachedPath) {
      shot.film_src_dur = 0;
      shot.film_src_path = "";
      if (measured) delete measured[vp];
      changed = true;
    }
  }
  return changed;
}

function probeVideoDuration(path) {
  const src = mediaSrc(path);
  if (!src) return Promise.resolve(0);
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    let done = false;
    const finish = (n) => {
      if (done) return;
      done = true;
      try { v.removeAttribute("src"); v.load(); } catch (_e) {}
      resolve(n);
    };
    const timer = setTimeout(() => finish(0), 12000);
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      const md = Number(v.duration);
      finish(Number.isFinite(md) && md > 0.2 ? md : 0);
    };
    v.onerror = () => {
      clearTimeout(timer);
      finish(0);
    };
    v.src = src;
  });
}

function filmTrimRange(shot, srcDur) {
  let inn = Math.max(0, Number(shot && shot.film_in) || 0);
  let out = Number(shot && shot.film_out) || 0;
  const cap = Math.max(0.1, srcDur);
  if (!(out > inn + 0.05)) out = cap;
  out = Math.min(cap, out);
  inn = Math.min(inn, Math.max(0, out - 0.1));
  return { srcIn: inn, srcOut: out, duration: Math.max(0.1, out - inn) };
}

function rankedVideoShots(state) {
  const shots = (state && state.shots_info) || [];
  const rows = [];
  shots.forEach((shot, idx) => {
    if (!String(shot.video_path || "").trim()) return;
    const rank = Number.isFinite(Number(shot.film_rank)) ? Number(shot.film_rank) : idx;
    rows.push({ shot, idx, rank });
  });
  rows.sort((a, b) => a.rank - b.rank || a.idx - b.idx);
  return rows;
}

function buildFilmClips(state, measured) {
  const clips = [];
  const skipped = [];
  let cursor = 0;
  for (const row of rankedVideoShots(state)) {
    const shot = row.shot;
    const vp = String(shot.video_path || "").trim();
    const srcDur = filmSourceDuration(shot, measured);
    const trim = filmTrimRange(shot, srcDur);
    const item = {
      id: shot.id,
      path: vp,
      cover: String(shot.first_frame_path || "").trim(),
      srcDur,
      srcIn: trim.srcIn,
      srcOut: trim.srcOut,
      duration: trim.duration,
      start: cursor,
      enabled: shot.film_enabled !== false,
    };
    if (!item.enabled) {
      skipped.push(item);
      continue;
    }
    clips.push(item);
    cursor += item.duration;
  }
  return { clips, skipped, total: cursor };
}

/** 尚无视频时按分镜时长占位；无分镜则给一段默认时间轴。 */
function buildFilmPlaceholderClips(state) {
  const shots = (state && state.shots_info) || [];
  const rows = [];
  shots.forEach((shot, idx) => {
    const rank = Number.isFinite(Number(shot.film_rank)) ? Number(shot.film_rank) : idx;
    rows.push({ shot, idx, rank });
  });
  rows.sort((a, b) => a.rank - b.rank || a.idx - b.idx);
  const clips = [];
  let cursor = 0;
  for (const row of rows) {
    const shot = row.shot;
    if (shot.film_enabled === false) continue;
    const dur = Math.max(0.1, Number(shot.duration) || 5);
    clips.push({
      id: shot.id,
      path: "",
      cover: "",
      placeholder: true,
      srcDur: dur,
      srcIn: 0,
      srcOut: dur,
      duration: dur,
      start: cursor,
      enabled: true,
    });
    cursor += dur;
  }
  return { clips, total: cursor > 0 ? cursor : 10 };
}

async function composeFilmRequest(videos, bgm, bgmVolume, formalMerge, speed, bgmFollowSpeed) {
  const res = await api.fetchApi(COMPOSE_FILM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videos: videos || [],
      bgm: bgm || "",
      bgm_volume: bgmVolume,
      formal_merge: !!formalMerge,
      speed: clampFilmPlaybackRate(speed == null ? 1 : speed),
      bgm_follow_speed: !!bgmFollowSpeed,
    }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error("合成接口返回非 JSON");
  }
  if (!res.ok || (data && data.error)) {
    throw new Error((data && data.error) || ("合成失败 HTTP " + res.status));
  }
  const out = String((data && data.path) || "").trim();
  if (!out) throw new Error("合成成功但未返回路径");
  return out;
}

let _matedataSaveTimer = null;

function scheduleSaveBoardMatedata(state, delayMs) {
  if (_matedataSaveTimer) {
    clearTimeout(_matedataSaveTimer);
    _matedataSaveTimer = null;
  }
  if (!state || typeof state !== "object") return;
  const wait = delayMs == null ? 700 : Number(delayMs);
  const run = () => {
    _matedataSaveTimer = null;
    saveBoardMatedata(state);
  };
  if (!Number.isFinite(wait) || wait <= 0) {
    run();
    return;
  }
  _matedataSaveTimer = setTimeout(run, wait);
}

/** 把看板当前 state 回写到 output/h3_ref2va_auto/data/metadata-*.json（覆盖同一 metadata_file）。 */
async function saveBoardMatedata(state, mode) {
  if (!state || typeof state !== "object") return null;
  if (_matedataSaveTimer) {
    clearTimeout(_matedataSaveTimer);
    _matedataSaveTimer = null;
  }
  try {
    const remembered = String(state.metadata_file || state.matedata_file || "").trim();
    const res = await api.fetchApi(SAVE_MATEDATA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: state,
        mode: mode || "latest",
        filename: remembered || undefined,
        metadata_file: remembered || undefined,
      }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_e) {
      throw new Error("保存 metadata 接口返回非 JSON");
    }
    if (!res.ok || (data && data.error)) {
      throw new Error((data && data.error) || ("保存 metadata 失败 HTTP " + res.status));
    }
    if (data && data.filename) {
      state.metadata_file = data.filename;
      if (state.matedata_file) delete state.matedata_file;
    }
    return data;
  } catch (err) {
    console.warn("[H3 Board] save metadata failed", err);
    return null;
  }
}

/** 看板「成片视频」口下游的 SaveVideo（可直接连，也可经中间节点）。 */
function findFilmSaveNodes(boardNode) {
  const targets = linkedTargets(boardNode, OUT_FILM_VIDEO);
  const saves = [];
  const seen = new Set();
  for (const t of targets) {
    if (!t || !t.node) continue;
    let save = null;
    if (String(t.node.type || "") === "SaveVideo") save = t.node;
    else save = findSaveVideoDownstream(t.node);
    if (!save) continue;
    const id = String(save.id);
    if (seen.has(id)) continue;
    seen.add(id);
    saves.push(save);
  }
  return saves;
}

/**
 * 合成后把成片经 MinimaxH3LoadVideoPath 注入到「成片视频」连线的 SaveVideo。
 * 返回 SaveVideo 正式产出绝对路径；未接线则返回 ""。
 */
async function saveComposedFilmToLinkedNodes(boardNode, filmPath) {
  const path = String(filmPath || "").trim();
  if (!path || !boardNode) return "";
  const saves = findFilmSaveNodes(boardNode);
  if (!saves.length) return "";
  if (typeof app.graphToPrompt !== "function") {
    throw new Error("当前前端不支持 graphToPrompt，无法把成片送入 SaveVideo");
  }
  const promptPack = await app.graphToPrompt();
  const output = promptPack.output || promptPack;
  const workflow = promptPack.workflow;
  const sub = {};
  const loadId = String(nextSyntheticId(output));
  sub[loadId] = { class_type: "MinimaxH3LoadVideoPath", inputs: { path } };
  let primarySave = null;
  for (const save of saves) {
    const sk = String(save.id);
    const src = output[sk];
    if (!src) throw new Error("局部 prompt 中缺少成片 SaveVideo 节点 #" + sk);
    sub[sk] = deepClone(src);
    if (!sub[sk].inputs) sub[sk].inputs = {};
    sub[sk].inputs.video = [loadId, 0];
    sub[sk].inputs.filename_prefix = PREFIX_MERGE;
    if (!primarySave) primarySave = save;
  }
  const queued = await queuePromptLocal(0, { output: sub, workflow });
  const promptId = queued && (queued.prompt_id || queued.promptId);
  if (!promptId) throw new Error("成片保存 queuePrompt 未返回 prompt_id");
  const videos = await waitPromptVideos(promptId, primarySave.id);
  return importGeneratedVideo(videos[0]);
}

async function importGeneratedVideo(vidInfo) {
  if (!vidInfo || !vidInfo.filename) throw new Error("无有效视频输出");
  const res = await api.fetchApi(IMPORT_OUTPUT_VIDEO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: vidInfo.filename,
      subfolder: vidInfo.subfolder || "",
      type: vidInfo.type || "output",
    }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error("解析视频路径接口返回非 JSON");
  }
  if (!res.ok || (data && data.error)) {
    throw new Error((data && data.error) || ("解析视频路径失败 HTTP " + res.status));
  }
  const outPath = String((data && data.path) || "").trim();
  if (!outPath) throw new Error("解析成功但未返回路径");
  return outPath;
}


async function extractVideoFrameClient(videoPath, which) {
  const url = mediaSrc(videoPath);
  if (!url) throw new Error("视频路径无效");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("视频加载超时")), 20000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("视频加载失败"));
    };
    video.src = url;
  });
  const dur = Number(video.duration);
  let t = 0;
  if (which === "last") {
    t = Number.isFinite(dur) && dur > 0 ? Math.max(0, dur - 0.08) : 0;
  } else {
    t = Number.isFinite(dur) && dur > 0 ? Math.min(0.04, dur * 0.01) : 0;
  }
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("视频定位超时")), 20000);
    video.onseeked = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("视频定位失败"));
    };
    try {
      video.currentTime = t;
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, video.videoWidth || 640);
  canvas.height = Math.max(1, video.videoHeight || 360);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("画布导出失败");
  const file = new File([blob], "frame_" + (which === "last" ? "last" : "first") + ".png", {
    type: "image/png",
  });
  return uploadFile(file, "image");
}

async function extractVideoFrame(videoPath, which) {
  const pos = which === "last" ? "last" : "first";
  try {
    const res = await api.fetchApi(EXTRACT_VIDEO_FRAME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: String(videoPath || ""), which: pos }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_e) {
      data = null;
    }
    if (!res.ok || (data && data.error)) {
      throw new Error((data && data.error) || ("抽帧失败 HTTP " + res.status));
    }
    const out = String((data && data.path) || "").trim();
    if (!out) throw new Error("抽帧成功但未返回路径");
    return out;
  } catch (err) {
    console.warn("[H3 Board] server extract failed, fallback client", err);
    return extractVideoFrameClient(videoPath, pos);
  }
}

async function writeBackVideoFrames(shots, idx, videoPath) {
  if (!videoPath || !Array.isArray(shots) || !shots[idx]) return;
  const shot = shots[idx];
  try {
    const first = await extractVideoFrame(videoPath, "first");
    if (first) {
      bustMedia(first);
      shot.first_frame_path = first;
    }
  } catch (err) {
    console.warn("[H3 Board] extract first frame failed", err);
  }
  try {
    const last = await extractVideoFrame(videoPath, "last");
    if (last && shots[idx + 1]) {
      bustMedia(last);
      shots[idx + 1].pre_last_frame_path = last;
    }
  } catch (err) {
    console.warn("[H3 Board] extract last frame failed", err);
  }
}

const _frameRepairBusy = new Set();
async function ensurePrevLastFrame(shots, idx) {
  if (!Array.isArray(shots) || idx < 0) return false;
  const shot = shots[idx];
  if (!shot) return false;
  if (String(shot.pre_last_frame_path || "").trim()) return false;
  const vid = shotPrevVideoPath(shots, idx);
  if (!vid) return false;
  const key = "prevlast:" + idx + ":" + vid;
  if (_frameRepairBusy.has(key)) return false;
  _frameRepairBusy.add(key);
  try {
    const last = await extractVideoFrame(vid, "last");
    if (!last) return false;
    shot.pre_last_frame_path = last;
    return true;
  } catch (err) {
    console.warn("[H3 Board] ensure prev last frame failed", err);
    return false;
  } finally {
    _frameRepairBusy.delete(key);
  }
}

async function repairMissingShotFrames(state, persistFn, renderFn) {
  const shots = (state && state.shots_info) || [];
  let changed = false;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const vid = String(shot.video_path || "").trim();
    if (vid && !String(shot.first_frame_path || "").trim()) {
      const key = "first:" + vid;
      if (!_frameRepairBusy.has(key)) {
        _frameRepairBusy.add(key);
        try {
          const first = await extractVideoFrame(vid, "first");
          if (first) {
            shot.first_frame_path = first;
            changed = true;
          }
        } catch (err) {
          console.warn("[H3 Board] repair first frame failed", err);
        } finally {
          _frameRepairBusy.delete(key);
        }
      }
    }
    if (await ensurePrevLastFrame(shots, i)) changed = true;
  }
  if (changed) {
    if (typeof persistFn === "function") persistFn();
    if (typeof renderFn === "function") renderFn();
  }
}

async function runVideoOnce(boardNode, promptText, width, height, duration, refMedia, prevVideoPath, isFirst) {
  const text = String(promptText || "").trim();
  if (!text) throw new Error("分镜提示词为空");
  const { vsub, save, promptInputName } = findVideoBundle(boardNode, !!isFirst);
  const bundleName = subgraphDisplayName(vsub) || String(vsub.id);
  if (!!isFirst === false) {
    // 非首镜必须落到带 video 口 / 名称含「非首」的子流程，避免误跑首分镜缓存片
    if (isFirstVideoSubgraph(vsub)) {
      throw new Error("非首分镜误选到首分镜子流程「" + bundleName + "」，已中止以免覆盖成上一镜");
    }
    if (!nodeHasVideoInput(vsub) && !/非首/.test(bundleName)) {
      throw new Error("未确认非首镜子流程（" + bundleName + "），已中止");
    }
  } else if (/非首/.test(bundleName)) {
    throw new Error("首分镜误选到非首子流程「" + bundleName + "」，已中止");
  }
  const textKey = promptInputName || "prompt";
  const w = width > 0 ? Math.round(Number(width)) : 0;
  const h = height > 0 ? Math.round(Number(height)) : 0;
  const d = duration > 0 ? Math.round(Number(duration)) : 5;

  setNodeWidget(vsub, textKey, text);
  if (textKey !== "prompt") setNodeWidget(vsub, "prompt", text);
  if (w > 0) setNodeWidget(vsub, "width", w);
  if (h > 0) setNodeWidget(vsub, "height", h);
  setNodeWidget(vsub, "values.a", d);
  if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);

  if (typeof app.graphToPrompt !== "function") throw new Error("当前前端不支持 graphToPrompt");
  const promptPack = await app.graphToPrompt();
  const output = promptPack.output || promptPack;
  const workflow = promptPack.workflow;

  const vKey = String(vsub.id);
  const saveKey = String(save.id);
  const prefix = vKey + ":";

  // 在看板处截断：只跑生视频子流程 + SaveVideo，不回溯剧本补全
  const sub = collectUpstreamPrompt(output, [save.id, vsub.id], [boardNode.id]);
  const defType = String(vsub.type || "");
  const defPrefix = defType ? defType + ":" : "";
  for (const [nid, node] of Object.entries(output || {})) {
    const id = String(nid);
    const inBundle =
      id === vKey ||
      id.startsWith(prefix) ||
      id === saveKey ||
      (defPrefix && id.startsWith(defPrefix));
    if (inBundle && !sub[id]) sub[id] = deepClone(node);
  }
  // 非首镜：上一镜按帧裁剪/Video Slice 常因 video 未接线被裁掉，尽量从全量 output 找回
  if (!isFirst && prevVideoPath) {
    for (const [nid, node] of Object.entries(output || {})) {
      if (!node || (!isPrevVideoCropNode(node) && !isVideoSliceNode(node))) continue;
      const id = String(nid);
      if (!sub[id]) sub[id] = deepClone(node);
    }
  }
  if (!Object.keys(sub).length) throw new Error("无法构建生视频子图 prompt");

  inlineBoardVideoOutputs(sub, boardNode, text, w, h, d);
  forceBundlePromptText(sub, vsub.id, text);

  if (sub[vKey] && sub[vKey].inputs) {
    sub[vKey].inputs[textKey] = text;
    if (textKey !== "prompt" && Object.prototype.hasOwnProperty.call(sub[vKey].inputs, "prompt")) {
      sub[vKey].inputs.prompt = text;
    }
    if (w > 0 && Object.prototype.hasOwnProperty.call(sub[vKey].inputs, "width")) sub[vKey].inputs.width = w;
    if (h > 0 && Object.prototype.hasOwnProperty.call(sub[vKey].inputs, "height")) sub[vKey].inputs.height = h;
    sub[vKey].inputs["values.a"] = d;
  }

  const images = (refMedia && refMedia.images) || [];
  const audios = (refMedia && refMedia.audios) || [];
  // 参考图 / 参考音频均为可选；非首分镜才强制需要上一镜视频
  if (!isFirst && !prevVideoPath) {
    throw new Error("非首分镜需要上一镜视频，请先生成上一分镜");
  }
  injectPathLoaders(sub, vKey, images, audios, isFirst ? "" : prevVideoPath);

  const boardId = String(boardNode.id);
  for (const node of Object.values(sub)) {
    if (!node || !node.inputs) continue;
    for (const key of Object.keys(node.inputs)) {
      const v = node.inputs[key];
      if (Array.isArray(v) && String(v[0]) === boardId) delete node.inputs[key];
    }
  }

  if (!sub[saveKey] && !sub[save.id]) throw new Error("局部 prompt 中缺少 SaveVideo 节点");
  const hasSub =
    !!sub[vKey] ||
    Object.keys(sub).some((k) => String(k).startsWith(prefix) || (defPrefix && String(k).startsWith(defPrefix))) ||
    Object.values(sub).some(
      (n) =>
        n &&
        /MiniMaxH3ReferenceToVideo|CreateVideo|Video\s*Slice/i.test(String(n.class_type || ""))
    );
  if (!hasSub) throw new Error("局部 prompt 中缺少生视频子流程节点");

  // SaveVideo 落盘到 output/.../shots/
  bustVideoPromptCaches(sub);
  if (sub[saveKey] && sub[saveKey].inputs) {
    sub[saveKey].inputs.filename_prefix = PREFIX_SHOTS;
  }

  const queued = await queuePromptLocal(0, { output: sub, workflow });
  const promptId = queued.prompt_id || queued.promptId;
  if (!promptId) throw new Error("queuePrompt 未返回 prompt_id");
  const videos = await waitPromptVideos(promptId, save.id);
  const pathOut = await importGeneratedVideo(videos[0]);
  if (!isFirst) await assertVideoResultDistinct(pathOut, prevVideoPath);
  return pathOut;
}


app.registerExtension({
  name: "H3Ref2VAAuto.ScriptBoard",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_NAME) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const ret = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
      ensureStyle();

      const node = this;
      const editW = widgetByName(node, "edit_json");
      const lockW = widgetByName(node, "lock_edit");
      const noAutoW = widgetByName(node, "no_auto_run");
      hideWidget(editW);
      hideWidget(lockW);
      hideWidget(noAutoW);

      const root = el("div", "h3b");
      const dom = this.addDOMWidget("h3_script_board_ui", "div", root, {
        serialize: false,
        hideOnZoom: false,
      });

      const calcPanelH = () => panelHeight(node);

      // 严格对齐导演台 syncW：只把 root 贴到 wrapper 实际客户区。
      // 绝不要写 wrap.style.height / 交替清空——那是高度闪烁的根因。
      const syncPanel = () => {
        try {
          hideWidget(editW);
          hideWidget(lockW);
          hideWidget(noAutoW);
          if (dom && dom.width !== undefined) dom.width = undefined;
          const wrap = root.parentElement;
          if (!wrap) return;
          const cw = wrap.clientWidth;
          const ch = wrap.clientHeight;
          if (cw > 0 && ch > 0) {
            if (root.style.width !== cw + "px") root.style.width = cw + "px";
            if (root.style.height !== ch + "px") root.style.height = ch + "px";
          }
          if (wrap.style.overflow !== "hidden") wrap.style.overflow = "hidden";
        } catch (_e) {}
      };

      // 不要设 computeSize（固定高 → 操作区塌缩 + 底部空白）。
      // computedSize 让 wrapper 高度跟随节点；内容只读 wrapper.clientHeight。
      if (dom) {
        try {
          delete dom.computeSize;
        } catch (_e) {
          dom.computeSize = undefined;
        }
        dom.computedSize = () => [
          Math.max((node.size && node.size[0]) || DEFAULT_SIZE[0], 900),
          calcPanelH(),
        ];
        dom.computeLayoutSize = () => ({
          minHeight: PANEL_MIN_H,
          minWidth: 900,
          maxHeight: undefined,
        });
      }

      const prevComputeSize = node.computeSize;
      node.computeSize = function () {
        // 只返回最小尺寸，避免 Math.max(拖拽, computeSize) 顶住无法拖矮
        let w = 900;
        try {
          const sz = prevComputeSize ? prevComputeSize.apply(this, arguments) : null;
          if (sz && sz[0]) w = Math.max(900, Number(sz[0]) || 900);
        } catch (_e) {}
        return [w, NODE_MIN_H];
      };

      const prevResize = node.onResize;
      node.onResize = function (size) {
        if (size && size.length >= 2) {
          size[0] = Math.max(900, Math.min(Number(size[0]) || DEFAULT_SIZE[0], 4000));
          size[1] = Math.max(NODE_MIN_H, Math.min(Number(size[1]) || DEFAULT_SIZE[1], SIZE_MAX_H));
          this.size[0] = size[0];
          this.size[1] = size[1];
        }
        const out = prevResize ? prevResize.apply(this, arguments) : undefined;
        syncPanel();
        return out;
      };

      let state = parseState(editW && editW.value ? editW.value : "");
      let selectedAsset = null;
      let selectedShotId = null;
      let rendering = false;
      let generating = false;
      let genStatus = "";
      let genStatusKind = "";
      const filmPlayer = {
        clipIndex: 0,
        globalTime: 0,
        playing: false,
        composedPath: String(state.film_path || ""),
        measured: {},
        status: "",
        statusKind: "",
        selectedId: null,
        pxPerSec: 40,
        scrollLeft: 0,
        muteSource: false,
        scrubbing: false,
        _seekToken: 0,
        _raf: 0,
        _bgmPreview: null,
      };

      const stopBgmPreview = () => {
        const a = filmPlayer._bgmPreview;
        if (!a) return;
        try { a.pause(); } catch (_e) {}
        try { a.currentTime = 0; } catch (_e) {}
      };

      const ensureBgmPreview = (path) => {
        const p = String(path || "").trim();
        if (!p) {
          stopBgmPreview();
          return null;
        }
        let a = filmPlayer._bgmPreview;
        if (!a) {
          a = document.createElement("audio");
          a.preload = "metadata";
          filmPlayer._bgmPreview = a;
        }
        if (a.getAttribute("data-path") !== p) {
          a.setAttribute("data-path", p);
          a.src = mediaSrc(p);
        }
        return a;
      };

      const setGenStatus = (text, kind) => {
        genStatus = text || "";
        genStatusKind = kind || "";
      };

      const generateForItem = async (item, key) => {
        if (!item || generating) return;
        const prompt = assetGenPrompt(item);
        if (!prompt) {
          alert("请先填写生图提示词（或名称/简述）");
          return;
        }
        generating = true;
        setGenStatus("正在生成「" + (item.name || key) + "」…", "");
        render();
        try {
          const path = await runTxt2ImgOnce(node, prompt, state.width, state.height);
          if (!path) throw new Error("生成完成但未返回图片路径");
          bustMedia(path);
          item.bing_image_path = path;
          // 确保当前选中项就是刚生成的素材，方便预览区立刻刷新
          if (selectedAsset) {
            selectedAsset = { key: selectedAsset.key, id: Number(item.id) };
          }
          persist();
          await saveBoardMatedata(state);
          setGenStatus("已生成「" + (item.name || key) + "」", "ok");
        } catch (err) {
          setGenStatus(formatComfyError(err), "err");
          alert("生成图片失败: " + formatComfyError(err));
        } finally {
          generating = false;
          render();
        }
      };

      const generateMissingImages = async (opts) => {
        const throwOnError = !!(opts && opts.throwOnError);
        const silentIfNone = !!(opts && opts.silentIfNone);
        if (generating) {
          if (throwOnError) throw new Error("看板正在生成，请稍候");
          return false;
        }
        const missing = allAssets(state).filter((e) => !assetImagePath(e.item));
        if (!missing.length) {
          if (silentIfNone) {
            setGenStatus("全局运行：素材图已齐全，跳过生图", "ok");
            return true;
          }
          alert("没有缺失图片的素材");
          return false;
        }
        const emptyPrompt = missing.filter((e) => !assetGenPrompt(e.item));
        if (emptyPrompt.length) {
          const msg =
            "以下素材缺少提示词，无法生成：\n" +
            emptyPrompt.map((e) => e.label + "#" + e.item.id + " " + (e.item.name || "")).join("\n");
          if (throwOnError) throw new Error(msg);
          alert(msg);
          return false;
        }
        generating = true;
        try {
          for (let i = 0; i < missing.length; i++) {
            const entry = missing[i];
            const prefix = throwOnError ? "全局运行：素材图 " : "一键生成 ";
            setGenStatus(
              prefix + (i + 1) + "/" + missing.length + "：「" + (entry.item.name || entry.label) + "」…",
              ""
            );
            render();
            const path = await runTxt2ImgOnce(node, assetGenPrompt(entry.item), state.width, state.height);
            bustMedia(path);
            entry.item.bing_image_path = path;
            persist();
          }
          await saveBoardMatedata(state);
          setGenStatus((throwOnError ? "全局运行：素材图完成，共 " : "一键生成完成，共 ") + missing.length + " 张", "ok");
          return true;
        } catch (err) {
          setGenStatus(formatComfyError(err), "err");
          if (throwOnError) throw err;
          alert("一键生成失败: " + formatComfyError(err));
          return false;
        } finally {
          generating = false;
          render();
        }
      };

      const generateCurrentShot = async () => {
        if (generating) return;
        const shots = state.shots_info || [];
        const shot = shots.find((x) => Number(x.id) === Number(selectedShotId));
        if (!shot) {
          alert("请先选择一个分镜");
          return;
        }
        const shotId = Number(shot.id);
        const existingVideo = String(shot.video_path || "").trim();
        if (existingVideo) {
          if (
            !window.confirm(
              "分镜 #" + shotId + " 已有视频。\n重新生成将覆盖当前分镜视频，是否继续？"
            )
          ) {
            return;
          }
        }
        const idx = shots.findIndex((x) => Number(x.id) === shotId);
        const prompt = buildVideoPrompt(state, shot);
        if (!prompt) {
          alert("当前分镜提示词为空");
          return;
        }
        const isFirst = shotIsColdStart(shots, idx);
        const prevVideo = shotPrevVideoPath(shots, idx);
        if (!isFirst && !prevVideo) {
          alert(
            idx === 0
              ? "续镜需要上传上一分镜视频"
              : ("非首分镜需要上一镜视频，请先生成分镜 #" + (shots[idx - 1] && shots[idx - 1].id))
          );
          return;
        }
        generating = true;
        setGenStatus(
          "正在生成分镜 #" + shotId + "（" + (isFirst ? "首分镜" : "非首镜/续镜") + "子流程）…",
          ""
        );
        render();
        try {
          if (!shotIsColdStart(shots, idx)) {
            await ensurePrevLastFrame(shots, idx);
            persist();
          }
          const refs = collectShotRefMedia(state, shot);
          if (!isFirst && !prevVideo) {
            throw new Error("非首分镜必须传入上一镜视频");
          }
          setGenStatus(
            "生成中… 参考图" + refs.images.length + " / 参考音" + refs.audios.length +
            (isFirst ? "" : " / 已接上一镜视频"),
            ""
          );
          render();
          const pathOut = await runVideoOnce(
            node,
            prompt,
            state.width,
            state.height,
            shot.duration || 5,
            refs,
            prevVideo,
            isFirst
          );
          const commit = await commitShotVideoResult(state, node, shotId, pathOut, persist);
          if (commit.detached) {
            setGenStatus(
              "已生成分镜 #" + shotId + "（已暂存；切回本工作流后自动写入预览）",
              "ok"
            );
          } else {
            setGenStatus("已生成分镜 #" + shotId, "ok");
          }
        } catch (err) {
          setGenStatus(formatComfyError(err), "err");
          alert("生成分镜失败: " + formatComfyError(err));
        } finally {
          generating = false;
          render();
        }
      };

      const generateAllShots = async (opts) => {
        const throwOnError = !!(opts && opts.throwOnError);
        if (generating) {
          if (throwOnError) throw new Error("看板正在生成，请稍候");
          return false;
        }
        const shots = state.shots_info || [];
        if (!shots.length) {
          if (throwOnError) throw new Error("暂无分镜");
          alert("暂无分镜");
          return false;
        }
        const empty = shots.filter((s) => !extractShotText(s.shot || "").trim());
        if (empty.length) {
          const msg = "以下分镜缺少提示词：\n" + empty.map((s) => "#" + s.id).join(", ");
          if (throwOnError) throw new Error(msg);
          alert(msg);
          return false;
        }
        generating = true;
        try {
          for (let i = 0; i < shots.length; i++) {
            const shot = shots[i];
            const isFirst = shotIsColdStart(shots, i);
            const prevVideo = shotPrevVideoPath(shots, i);
            if (!isFirst && !prevVideo) {
              throw new Error(
                i === 0
                  ? "分镜 #" + shot.id + " 为续镜，请先上传上一分镜视频"
                  : ("分镜 #" + shot.id + " 缺少上一镜视频")
              );
            }
            setGenStatus(
              "一键生成分镜 " + (i + 1) + "/" + shots.length + "：#" + shot.id +
              "（" + (isFirst ? "首分镜" : "非首镜") + "）…",
              ""
            );
            render();
            if (!isFirst) {
              await ensurePrevLastFrame(shots, i);
              persist();
            }
            const refs = collectShotRefMedia(state, shot);
            setGenStatus(
              "生成中… 参考图" + refs.images.length + " / 参考音" + refs.audios.length +
              (isFirst ? "" : " / 已接上一镜视频"),
              ""
            );
            render();
            const pathOut = await runVideoOnce(
              node,
              buildVideoPrompt(state, shot),
              state.width,
              state.height,
              shot.duration || 5,
              refs,
              prevVideo,
              isFirst
            );
            const commit = await commitShotVideoResult(state, node, shot.id, pathOut, persist);
            if (commit.detached) {
              setGenStatus(
                "分镜 #" + shot.id + " 已生成并暂存（切回本工作流后写入预览） " +
                (i + 1) + "/" + shots.length,
                "ok"
              );
            }
          }
          setGenStatus("一键生成全部分镜完成，共 " + shots.length + " 个", "ok");
          render();
          return true;
        } catch (err) {
          setGenStatus(formatComfyError(err), "err");
          if (throwOnError) throw err;
          alert("一键生成分镜失败: " + formatComfyError(err));
          return false;
        } finally {
          generating = false;
          render();
        }
      };


      const persist = () => {
        if (rendering) return;
        state.width = Number(state.width) || 864;
        state.height = Number(state.height) || 480;
        delete state.with;
        state.duration = Number(state.duration) || 10;
        syncShotFirstFlags(state.shots_info || []);
        for (const shot of state.shots_info || []) {
          shot.shot = extractShotText(shot.shot || "");
          delete shot.shot_body;
        }
        syncGlobalPromptForBgm(state);
        setWidgetValue(editW, JSON.stringify(state, null, 2));
        if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
        scheduleSaveBoardMatedata(state);
      };

      const composeEnabledFilm = async () => {
        const pack = buildFilmClips(state, filmPlayer.measured);
        if (!pack.clips.length) throw new Error("没有可合成的分镜视频");
        const bgmPath = String((state.global && state.global.background_audio) || "").trim();
        const vol = bgmVolumeOf(state);
        const playRate = filmPlaybackRateOf(state);
        const bgmFollow = bgmFollowSpeedOf(state);
        const payload = pack.clips.map((c) => ({
          path: c.path,
          in: c.srcIn || 0,
          out: c.srcOut || 0,
        }));
        filmPlayer.status = "正在合成临时成片…";
        filmPlayer.statusKind = "";
        render();
        const tmpOut = await composeFilmRequest(payload, bgmPath, vol, false, playRate, bgmFollow);
        filmPlayer.composedPath = tmpOut;
        const hasSave = findFilmSaveNodes(node).length > 0;
        if (hasSave) {
          filmPlayer.status = "临时合成完成，正在经 SaveVideo 正式落盘…";
          filmPlayer.statusKind = "";
          render();
          let formalPath = "";
          try {
            formalPath = await saveComposedFilmToLinkedNodes(node, tmpOut);
          } catch (err) {
            filmPlayer.status =
              "临时合成完成，但 SaveVideo 落盘失败: " +
              (err && err.message ? err.message : err);
            filmPlayer.statusKind = "err";
            persist();
            render();
            throw err;
          }
          if (!formalPath) throw new Error("SaveVideo 未返回成片路径");
          bustMedia(formalPath);
          state.film_path = formalPath;
          filmPlayer.composedPath = formalPath;
          filmPlayer.status = "合成完成，成片已写入 merge/（SaveVideo）";
          filmPlayer.statusKind = "ok";
          persist();
          await saveBoardMatedata(state);
          render();
          return formalPath;
        }
        filmPlayer.status = "未连接成片 SaveVideo，改用 ffmpeg 写入 merge/…";
        filmPlayer.statusKind = "";
        render();
        const formalOut = await composeFilmRequest(payload, bgmPath, vol, true, playRate, bgmFollow);
        bustMedia(formalOut);
        state.film_path = formalOut;
        filmPlayer.composedPath = formalOut;
        filmPlayer.status = "合成完成（未接线 SaveVideo，ffmpeg 已写入 merge/）";
        filmPlayer.statusKind = "ok";
        persist();
        await saveBoardMatedata(state);
        render();
        return formalOut;
      };

      node._h3RunGlobalFilm = async () => {
        if (generating) throw new Error("看板正在生成，请稍候");
        return withH3LocalQueue(async () => {
          const preflight = collectBoardRunMissingHints(node, state);
          if (preflight.length) {
            const msg =
              "请补全以下必填参数后再运行：\n- " +
              preflight.join("\n- ") +
              "\n\n说明：看板「分镜资产结果JSON」输入不是必须的；也可在看板内直接编辑后再执行。";
            setGenStatus(msg, "err");
            render();
            alert(msg);
            return { prompt_id: null, film: null, blocked: true };
          }
          setGenStatus("全局运行：先跑剧本链路（含保存JSON/预览，不含生图生视频）…", "");
          render();
          let promptPack = null;
          let stage1PromptId = null;
          try {
            if (typeof app.graphToPrompt === "function") promptPack = await app.graphToPrompt();
          } catch (err) {
            console.warn("[H3 Board] graphToPrompt skipped (likely subgraph validation)", err);
          }
          if (promptPack) {
            const output = promptPack.output || promptPack;
            const workflow = promptPack.workflow;
            const stage1 = collectGlobalStage1Prompt(output, node);
            if (Object.keys(stage1).length) {
              let queued = null;
              try {
                queued = await api.queuePrompt(0, { output: stage1, workflow });
              } catch (err) {
                throw new Error(formatComfyError(err));
              }
              stage1PromptId = queued && (queued.prompt_id || queued.promptId);
              if (stage1PromptId) await waitPromptFinished(stage1PromptId);
            }
          }
          // 必须用 stage1 历史/executed 的看板 JSON，不能立刻读 edit_json：
          // 偶发时 widget 仍是上一轮（已有 bing_image_path），会跳过生图并沿用旧参考图。
          if (stage1PromptId) {
            await reloadBoardAfterStage1(node, editW, stage1PromptId);
          } else if (editW && node._h3BoardReload) {
            node._h3BoardReload(String(editW.value || ""), true);
          }
          if (noAutoW && noAutoW.value) {
            setGenStatus("已停在看板（不自动运行）：请手动补素材/照片后再点生成", "ok");
            render();
            return { prompt_id: null, film: null, stopped_at_board: true };
          }
          if (!(state.shots_info || []).length) {
            const msg =
              "请补全必填参数：当前没有分镜，无法继续生图/生视频/成片。\n" +
              "请连接上游分镜 JSON，或在看板中补全剧本与分镜后再运行。";
            setGenStatus(msg, "err");
            render();
            alert(msg);
            return { prompt_id: null, film: null, blocked: true };
          }
          setGenStatus("全局运行：生成缺失素材图片…", "");
          render();
          await generateMissingImages({ throwOnError: true, silentIfNone: true });
          setGenStatus("全局运行：逐镜生成视频…", "");
          render();
          await generateAllShots({ throwOnError: true });
          setGenStatus("全局运行：合成最终成片…", "");
          render();
          const out = await composeEnabledFilm();
          setGenStatus(
            findFilmSaveNodes(node).length
              ? "全局运行完成，成片已写入 merge/（SaveVideo）"
              : "全局运行完成，成片已写入 merge/（未接线 SaveVideo，ffmpeg 兜底）",
            "ok"
          );
          render();
          return { prompt_id: null, film: out };
        }).catch((err) => {
          const msg = formatComfyError(err);
          setGenStatus(msg, "err");
          render();
          if (isInterruptMessage(msg)) {
            alert("全局运行已中断");
          } else {
            alert("全局运行失败:\n" + msg);
          }
          throw err;
        });
      };

      const ensureSelection = () => {
        const assets = allAssets(state);
        if (selectedAsset) {
          const ok = assets.some(
            (a) => a.key === selectedAsset.key && Number(a.item.id) === Number(selectedAsset.id)
          );
          if (!ok) selectedAsset = null;
        }
        if (!selectedAsset && assets.length) {
          selectedAsset = { key: assets[0].key, id: Number(assets[0].item.id) };
        }
        const shots = state.shots_info || [];
        if (selectedShotId != null) {
          if (!shots.some((s) => Number(s.id) === Number(selectedShotId))) selectedShotId = null;
        }
        if (selectedShotId == null && shots.length) {
          selectedShotId = Number(shots[0].id);
        }
      };

      const renderAssetDetail = (host) => {
        const item = selectedAsset
          ? (state.global[selectedAsset.key] || []).find((x) => Number(x.id) === Number(selectedAsset.id))
          : null;
        const typeLabel = selectedAsset
          ? (TYPE_META.find((x) => x[0] === selectedAsset.key) || [null, "素材"])[1]
          : "素材";
        host.appendChild(el("div", "h3b-sec-title", "素材详情 · " + typeLabel + " #" + (item ? item.id : "—")));

        const nameIn = textInput(item ? (item.name || "") : "", (v) => {
          if (!item) return;
          item.name = v;
          persist();
          render();
        });
        const descIn = areaInput(item ? (item.desc || "") : "", (v) => {
          if (!item) return;
          item.desc = v;
          persist();
        }, 2);
        const promptIn = areaInput(item ? (item.gen_prompt || "") : "", (v) => {
          if (!item) return;
          item.gen_prompt = v;
          persist();
        }, 2);
        if (!item) {
          nameIn.disabled = true;
          descIn.disabled = true;
          promptIn.disabled = true;
        }
        host.appendChild(field("名称", nameIn));
        host.appendChild(field("简述", descIn));
        host.appendChild(field("生图提示词", promptIn));

        const media = el("div", "h3b-row");
        media.append(
          mediaBox(
            item ? assetImagePath(item) : "",
            "image",
            (p) => { if (!item) return; bustMedia(p); item.bing_image_path = p; persist(); render(); },
            () => { if (!item) return; item.bing_image_path = ""; persist(); render(); },
            { compact: true }
          ),
          mediaBox(
            item ? String(item.bing_audio_path || "") : "",
            "audio",
            (p) => { if (!item) return; bustMedia(p); item.bing_audio_path = p; persist(); render(); },
            () => { if (!item) return; item.bing_audio_path = ""; persist(); render(); },
            { compact: true }
          )
        );
        const genBtn = el("button", "h3b-btn success", generating ? "生成中…" : "生成图片");
        genBtn.type = "button";
        genBtn.disabled = !item || generating;
        genBtn.title = "沿「生图提示词」连线调度文生图子流程，生成并绑定图片";
        genBtn.addEventListener("click", () => {
          if (!item || !selectedAsset) return;
          generateForItem(item, selectedAsset.key);
        });
        media.appendChild(genBtn);
        host.appendChild(media);
        if (genStatus) {
          host.appendChild(el("div", "h3b-status" + (genStatusKind === "err" ? " err" : genStatusKind === "ok" ? " ok" : ""), genStatus));
        }

        const del = el("button", "h3b-btn danger", "删除此素材");
        del.type = "button";
        del.disabled = !item;
        del.addEventListener("click", () => {
          if (!item || !selectedAsset) return;
          const label = item.name || (typeLabel + " #" + item.id);
          if (!window.confirm("确认删除素材「" + label + "」？此操作不可撤销。")) return;
          state.global[selectedAsset.key] = (state.global[selectedAsset.key] || []).filter(
            (x) => Number(x.id) !== Number(item.id)
          );
          selectedAsset = null;
          persist();
          render();
        });
        host.appendChild(del);
        if (!item) {
          host.appendChild(el("div", "h3b-empty", "暂无素材时仍保留完整编辑布局，请点右上角添加"));
        }
      };

      const renderAppearCards = (host, shot, idx) => { // frame-card-last
        const appear = shot.appear || (shot.appear = { roles: [], prop: [], scene: [] });
        const grid = el("div", "h3b-appear");
        const shots = state.shots_info || [];

        const assets = allAssets(state);
        if (!assets.length && idx <= 0) {
          grid.appendChild(el("div", "h3b-empty", "暂无素材可选（卡片区布局保留）"));
        }
        for (const entry of assets) {
          const item = entry.item;
          const id = Number(item.id);
          const on = (appear[entry.key] || []).map(Number).includes(id);
          const tile = el("div", "h3b-tile" + (on ? " on" : ""));
          const cover = el("div", "h3b-tile-cover");
          const imgPath = assetImagePath(item);
          if (imgPath) {
            const img = el("img");
            img.src = mediaSrc(imgPath);
            cover.appendChild(img);
            attachMediaZoom(cover, imgPath, "image");
          } else {
            cover.textContent = item.name || (entry.label + id);
          }
          tile.appendChild(cover);
          tile.appendChild(tileMeta(entry.label + " #" + id, item.name || (entry.label + id)));
          tile.addEventListener("click", () => {
            const set = new Set((appear[entry.key] || []).map(Number));
            if (set.has(id)) set.delete(id);
            else set.add(id);
            appear[entry.key] = Array.from(set);
            persist();
            render();
          });
          grid.appendChild(tile);
        }

        // 续写尾帧：本集第 2+ 镜用上一镜成片；第 1 镜若上传了上一镜视频也显示
        const prevVideo = shotPrevVideoPath(shots, idx);
        const needsTail = idx > 0 || (idx === 0 && !!prevVideo);
        if (needsTail) {
          if (!String(shot.pre_last_frame_path || "").trim()) {
            ensurePrevLastFrame(shots, idx).then((ok) => {
              if (!ok) return;
              persist();
              if (!rendering) render();
            });
          }
          const framePath = String(shot.pre_last_frame_path || "").trim();
          const frameTile = el("div", "h3b-tile locked" + (framePath ? " has" : ""));
          const frameCover = el("div", "h3b-tile-cover");
          if (framePath) {
            const img = el("img");
            img.src = mediaSrc(framePath);
            frameCover.appendChild(img);
            attachMediaZoom(frameCover, framePath, "image");
          } else if (!prevVideo) {
            frameCover.textContent = "未生成";
          } else {
            frameCover.textContent = "抽取中…";
          }
          frameTile.appendChild(frameCover);
          frameTile.appendChild(tileMeta("尾帧", idx === 0 ? "上一镜视频" : "上一分镜"));
          frameTile.title = framePath
            ? ("上一镜尾帧（自动，不可上传）\n" + framePath)
            : (prevVideo ? "正在从上一镜视频自动抽取尾帧" : "上一镜尚无视频，无法抽取尾帧");
          grid.appendChild(frameTile);
        }

        // 本集第一位：可上传「上一集/上一镜」视频，转为续镜并走非首子流程
        if (idx === 0) {
          const prevPath = String(shot.prev_video_path || "").trim();
          const prevTile = el("div", "h3b-tile prev-ep" + (prevPath ? " has" : ""));
          const prevCover = el("div", "h3b-tile-cover");
          if (prevPath) {
            const vid = document.createElement("video");
            vid.src = mediaSrc(prevPath);
            vid.muted = true;
            vid.preload = "metadata";
            prevCover.appendChild(vid);
            attachMediaZoom(prevCover, prevPath, "video");
          } else {
            prevCover.textContent = "上传上一镜视频";
          }
          prevTile.appendChild(prevCover);
          prevTile.appendChild(tileMeta("续写", prevPath ? "已绑定" : "可选"));
          prevTile.title = prevPath
            ? ("上一镜视频（点选可更换/清除）\n" + prevPath)
            : "第二集等续写场景：上传上一镜视频后，本镜改为续镜并走非首生子流程";
          prevTile.addEventListener("click", () => {
            if (prevPath) {
              const pick = window.confirm(
                "已绑定上一镜视频。\n确定：清除\n取消：重新上传"
              );
              if (pick) {
                shot.prev_video_path = "";
                shot.pre_last_frame_path = "";
                syncShotFirstFlags(shots);
                persist();
                render();
                return;
              }
            }
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "video/*";
            input.style.display = "none";
            input.addEventListener("change", async () => {
              const file = input.files && input.files[0];
              input.remove();
              if (!file) return;
              if (String(shot.video_path || "").trim()) {
                if (
                  !window.confirm(
                    "本镜已有生成视频。绑定上一镜视频不会改已生成成片，但下次生成本镜会按续镜重跑。是否继续？"
                  )
                ) {
                  return;
                }
              }
              try {
                setGenStatus("正在上传上一镜视频…", "");
                render();
                const path = await uploadFile(file, "video");
                shot.prev_video_path = path;
                shot.pre_last_frame_path = "";
                syncShotFirstFlags(shots);
                persist();
                setGenStatus("正在抽取上一镜尾帧…", "");
                render();
                const last = await extractVideoFrame(path, "last");
                if (last) shot.pre_last_frame_path = last;
                persist();
                await saveBoardMatedata(state);
                setGenStatus("已绑定上一镜视频，本镜为续镜", "ok");
                render();
              } catch (err) {
                setGenStatus(String(err && err.message ? err.message : err), "err");
                alert("上传失败: " + (err && err.message ? err.message : err));
                render();
              }
            });
            document.body.appendChild(input);
            input.click();
          });
          grid.appendChild(prevTile);
        }

        const wrap = el("div", "h3b-appear-wrap");
        wrap.appendChild(field("出场素材", grid));

        // 本镜视频：靠右独立区，避免混入出场素材
        {
          const shotId = Number(shot.id);
          const liveShot = () => (state.shots_info || []).find((s) => Number(s.id) === shotId) || shot;
          const curShot = liveShot();
          const curPath = String((curShot && curShot.video_path) || "").trim();
          const firstPath = String((curShot && curShot.first_frame_path) || "").trim();
          const side = el("div", "h3b-appear-side");
          side.appendChild(el("div", "h3b-label", "本镜视频"));
          const upTile = el("div", "h3b-tile upload-cur" + (curPath ? " has" : ""));
          const upCover = el("div", "h3b-tile-cover");
          if (curPath && firstPath) {
            const img = el("img");
            img.src = mediaSrc(firstPath);
            upCover.appendChild(img);
            attachMediaZoom(upCover, curPath, "video");
          } else if (curPath) {
            const vid = document.createElement("video");
            vid.src = mediaSrc(curPath);
            vid.muted = true;
            vid.preload = "metadata";
            upCover.appendChild(vid);
            attachMediaZoom(upCover, curPath, "video");
          } else {
            upCover.textContent = "+";
          }
          upTile.appendChild(upCover);
          upTile.appendChild(tileMeta(curPath ? "已上传" : "上传", "当前分镜"));
          upTile.title = curPath
            ? ("仅替换分镜 #" + shotId + " 的当前视频\n" + curPath)
            : ("上传视频作为分镜 #" + shotId + " 的成片");
          upTile.addEventListener("click", () => {
            const before = liveShot();
            const existing = String((before && before.video_path) || "").trim();
            if (existing) {
              if (!window.confirm("将替换分镜 #" + shotId + " 的当前视频，是否继续？")) return;
            }
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "video/*";
            input.style.display = "none";
            input.addEventListener("change", async () => {
              const file = input.files && input.files[0];
              input.remove();
              if (!file) return;
              try {
                setGenStatus("正在上传分镜 #" + shotId + " 当前视频…", "");
                render();
                const path = await uploadFile(file, "video");
                const shotsNow = state.shots_info || [];
                const target = shotsNow.find((s) => Number(s.id) === shotId);
                if (!target) throw new Error("找不到分镜 #" + shotId);
                const idxNow = shotsNow.indexOf(target);
                assignShotVideoPath(target, path, filmPlayer.measured);
                target.first_frame_path = "";
                // 只回写本镜，绝不改动其它分镜的 video_path
                if (idxNow >= 0) await writeBackVideoFrames(shotsNow, idxNow, path);
                stashPendingShotVideo(state.script_name, shotId, {
                  video_path: path,
                  first_frame_path: target.first_frame_path || "",
                  next_pre_last_frame_path:
                    (shotsNow[idxNow + 1] && shotsNow[idxNow + 1].pre_last_frame_path) || "",
                });
                persist();
                await saveBoardMatedata(state);
                setGenStatus("已更新分镜 #" + shotId + " 当前视频", "ok");
                render();
              } catch (err) {
                setGenStatus(String(err && err.message ? err.message : err), "err");
                alert("上传失败: " + (err && err.message ? err.message : err));
                render();
              }
            });
            document.body.appendChild(input);
            input.click();
          });
          side.appendChild(upTile);
          wrap.appendChild(side);
        }

        host.appendChild(wrap);
      };

      const renderShotDetail = (host) => {
        const shots = state.shots_info || [];
        const shot = shots.find((x) => Number(x.id) === Number(selectedShotId));
        const idx = shot ? shots.findIndex((x) => Number(x.id) === Number(shot.id)) : -1;
        const kind = shot ? shotKindLabel(shots, idx) : "";
        host.appendChild(
          el("div", "h3b-sec-title", "分镜详情 · #" + (shot ? shot.id : "—") + (kind ? " · " + kind : ""))
        );

        const durIn = numInput(shot ? (shot.duration || 5) : 5, (v) => {
          if (!shot) return;
          shot.duration = v;
          persist();
          render();
        });
        const bodyIn = areaInput(shot ? extractShotText(shot.shot || "") : "", (v) => {
          if (!shot) return;
          shot.shot = extractShotText(v);
          persist();
        }, 8);
        if (!shot) {
          durIn.disabled = true;
          bodyIn.disabled = true;
        }
        host.appendChild(field("时长(秒)", durIn));
        host.appendChild(field("分镜提示词", bodyIn));

        if (shot) {
          renderAppearCards(host, shot, idx);
        } else {
          const emptyGrid = el("div", "h3b-appear");
          emptyGrid.appendChild(el("div", "h3b-empty", "暂无分镜时仍保留出场素材卡片布局"));
          host.appendChild(field("出场素材", emptyGrid));
        }

        const hasShotVideo = !!(shot && String(shot.video_path || "").trim());
        const genShotLabel = generating
          ? "生成中…"
          : hasShotVideo
            ? "重新生成当前分镜"
            : "生成当前分镜";
        const genShotBtn = el("button", "h3b-btn success", genShotLabel);
        genShotBtn.type = "button";
        genShotBtn.disabled = !shot || generating;
        const contHint =
          shot && idx === 0 && !shotIsColdStart(shots, idx)
            ? "（本镜为续镜，走非首子流程）"
            : "";
        genShotBtn.title = hasShotVideo
          ? "将覆盖当前分镜已有视频，需二次确认" + contHint
          : "按连线调度首分镜/非首分镜子流程生成当前分镜视频" + contHint;
        genShotBtn.addEventListener("click", () => generateCurrentShot());
        host.appendChild(genShotBtn);

        const del = el("button", "h3b-btn danger", "删除此分镜");
        del.type = "button";
        del.disabled = !shot;
        del.addEventListener("click", () => {
          if (!shot) return;
          const label = "分镜 #" + shot.id;
          if (!window.confirm("确认删除「" + label + "」？此操作不可撤销。")) return;
          state.shots_info = (state.shots_info || []).filter((x) => Number(x.id) !== Number(shot.id));
          state.shots_info.forEach((s, i) => {
            s.id = i + 1;
          });
          syncShotFirstFlags(state.shots_info);
          selectedShotId = null;
          persist();
          render();
        });
        host.appendChild(del);
        if (!shot) {
          host.appendChild(el("div", "h3b-empty", "暂无分镜时仍保留完整编辑布局，请点右上角添加"));
        }
      };


      const stopFilmPlayback = () => {
        filmPlayer.playing = false;
        if (filmPlayer._raf) {
          cancelAnimationFrame(filmPlayer._raf);
          filmPlayer._raf = 0;
        }
        if (filmPlayer._video) {
          try { filmPlayer._video.pause(); } catch (_e) {}
        }
        if (filmPlayer._audio) {
          try { filmPlayer._audio.pause(); } catch (_e) {}
        }
      };

      const locateFilmClip = (clips, globalTime) => {
        if (!clips.length) return { index: 0, local: 0 };
        let t = Math.max(0, Number(globalTime) || 0);
        for (let i = 0; i < clips.length; i++) {
          const c = clips[i];
          if (t < c.start + c.duration || i === clips.length - 1) {
            return { index: i, local: Math.min(Math.max(0, t - c.start), c.duration) };
          }
        }
        const last = clips[clips.length - 1];
        return { index: clips.length - 1, local: last.duration };
      };

      const syncFilmPlayhead = (playheadEl, pxPerSec) => {
        if (!playheadEl) return;
        const pps = clampFilmPxPerSec(pxPerSec != null ? pxPerSec : filmPlayer.pxPerSec);
        const x = Math.max(0, Number(filmPlayer.globalTime) || 0) * pps;
        playheadEl.style.transform = "translateX(" + x + "px)";
      };

      const syncFilmBgm = (audioEl, bgmPath, globalTime, playing) => {
        if (!audioEl || !bgmPath) return;
        const src = mediaSrc(bgmPath);
        const vol = bgmVolumeOf(state);
        const rate = filmPlaybackRateOf(state);
        const follow = bgmFollowSpeedOf(state);
        audioEl.volume = Math.min(1, vol);
        try {
          audioEl.playbackRate = follow ? rate : 1;
        } catch (_e) {}
        if (audioEl.getAttribute("data-path") !== bgmPath) {
          audioEl.setAttribute("data-path", bgmPath);
          audioEl.src = src;
          audioEl.loop = true;
        }
        const apply = () => {
          try {
            const dur = Number(audioEl.duration);
            if (Number.isFinite(dur) && dur > 0) {
              const t = follow ? globalTime : globalTime / Math.max(0.25, rate);
              audioEl.currentTime = ((t % dur) + dur) % dur;
            }
          } catch (_e) {}
          if (playing) {
            const p = audioEl.play();
            if (p && p.catch) p.catch(() => {});
          } else {
            audioEl.pause();
          }
        };
        if (audioEl.readyState >= 1) apply();
        else audioEl.onloadedmetadata = () => apply();
      };

      const applyFilmPlaybackRate = (videoEl) => {
        if (!videoEl) return;
        try {
          videoEl.playbackRate = filmPlaybackRateOf(state);
        } catch (_e) {}
      };

      const loadFilmClip = (videoEl, clips, index, localTime, autoplay) => {
        if (!videoEl || !clips.length) return Promise.resolve();
        const clip = clips[Math.max(0, Math.min(index, clips.length - 1))];
        filmPlayer.clipIndex = clips.indexOf(clip);
        const needSrc = videoEl.getAttribute("data-path") !== clip.path;
        const startAt = Math.min(
          Math.max(clip.srcIn || 0, (clip.srcIn || 0) + Math.max(0, localTime || 0)),
          Math.max(clip.srcIn || 0, (clip.srcOut || clip.duration) - 0.05)
        );
        return new Promise((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve(clip);
          };
          const onReady = () => {
            videoEl.muted = !!filmPlayer.muteSource;
            videoEl.volume = 1;
            applyFilmPlaybackRate(videoEl);
            const afterSeek = () => {
              if (settled) return;
              applyFilmPlaybackRate(videoEl);
              if (autoplay) {
                const p = videoEl.play();
                if (p && p.catch) p.catch(() => {});
              }
              finish();
            };
            let seekTimer = 0;
            const onSeeked = () => {
              videoEl.removeEventListener("seeked", onSeeked);
              if (seekTimer) clearTimeout(seekTimer);
              afterSeek();
            };
            seekTimer = setTimeout(onSeeked, 900);
            videoEl.addEventListener("seeked", onSeeked);
            try {
              if (Math.abs((Number(videoEl.currentTime) || 0) - startAt) < 0.02) {
                onSeeked();
              } else {
                videoEl.currentTime = startAt;
              }
            } catch (_e) {
              onSeeked();
            }
          };
          const waitCanPlay = (cb) => {
            if (videoEl.readyState >= 2) {
              cb();
              return;
            }
            const onCanPlay = () => {
              videoEl.removeEventListener("canplay", onCanPlay);
              cb();
            };
            videoEl.addEventListener("canplay", onCanPlay);
            setTimeout(() => {
              videoEl.removeEventListener("canplay", onCanPlay);
              cb();
            }, 1200);
          };
          if (needSrc) {
            const loadPath = clip.path;
            const loadId = clip.id;
            videoEl.setAttribute("data-path", loadPath);
            videoEl.onloadedmetadata = () => {
              // 防止双缓冲/seek 抢源后，过期 metadata 写错分镜时长
              if (videoEl.getAttribute("data-path") !== loadPath) return;
              const md = Number(videoEl.duration);
              if (Number.isFinite(md) && md > 0.2) {
                const changed = writeMeasuredDuration(
                  state.shots_info,
                  filmPlayer.measured,
                  loadPath,
                  md,
                  loadId
                );
                if (changed && typeof filmPlayer._onSrcDurMeasured === "function") {
                  filmPlayer._onSrcDurMeasured(loadPath, md);
                }
              }
              waitCanPlay(onReady);
            };
            videoEl.onerror = () => finish();
            videoEl.src = mediaSrc(loadPath);
            try { videoEl.load(); } catch (_e) {}
          } else {
            waitCanPlay(onReady);
          }
        });
      };

      const prefetchFilmClip = (videoEl, clip) => {
        if (!videoEl || !clip) return;
        if (videoEl.getAttribute("data-path") === clip.path) return;
        videoEl.setAttribute("data-path", clip.path);
        videoEl.preload = "auto";
        videoEl.src = mediaSrc(clip.path);
        try { videoEl.load(); } catch (_e) {}
      };

      const findShotById = (id) => (state.shots_info || []).find((s) => Number(s.id) === Number(id));

      const persistFilmEdit = () => {
        persist();
        render();
      };

      const moveFilmClip = (shotId, dir) => {
        const rows = rankedVideoShots(state);
        const at = rows.findIndex((r) => Number(r.shot.id) === Number(shotId));
        if (at < 0) return;
        const nxt = at + dir;
        if (nxt < 0 || nxt >= rows.length) return;
        const tmp = rows[at];
        rows[at] = rows[nxt];
        rows[nxt] = tmp;
        rows.forEach((r, i) => { r.shot.film_rank = i; });
        persistFilmEdit();
      };

      const renderFilmTimeline = (host) => {
        const sec = el("div", "h3b-sec");
        const head = el("div", "h3b-sec-head");
        head.appendChild(el("div", "h3b-sec-title", "成片时间线"));
        const actions = el("div", "h3b-row");
        const playBtn = el("button", "h3b-btn success", filmPlayer.playing ? "暂停" : "播放");
        playBtn.type = "button";
        const restartBtn = el("button", "h3b-btn", "回开头");
        restartBtn.type = "button";
        const muteSrcBtn = el(
          "button",
          "h3b-btn" + (filmPlayer.muteSource ? " on" : ""),
          filmPlayer.muteSource ? "原声已关" : "关闭原声"
        );
        muteSrcBtn.type = "button";
        muteSrcBtn.title = "预览时开关分镜原声（不影响 BGM；合成成片始终保留原声）";
        const composeBtn = el("button", "h3b-btn primary", "合成最终成片");
        composeBtn.type = "button";
        actions.append(playBtn, restartBtn, muteSrcBtn, composeBtn);
        head.appendChild(actions);
        sec.appendChild(head);

        const speedBox = el("div", "h3b-film-speed");
        speedBox.appendChild(el("span", null, "播放倍速"));
        const speedSel = document.createElement("select");
        const curRate = filmPlaybackRateOf(state);
        const speedOpts = FILM_SPEED_PRESETS.slice();
        if (!speedOpts.some((x) => Math.abs(x - curRate) < 1e-6)) speedOpts.push(curRate);
        speedOpts.sort((a, b) => a - b);
        for (const r of speedOpts) {
          const opt = document.createElement("option");
          opt.value = String(r);
          opt.textContent = (Math.round(r * 100) / 100) + "x";
          if (Math.abs(r - curRate) < 1e-6) opt.selected = true;
          speedSel.appendChild(opt);
        }
        speedSel.title = "预览与保存成片共用此倍速（例如 2x 会把 10 秒压成 5 秒）";
        speedSel.addEventListener("change", () => {
          if (!state.global || typeof state.global !== "object") state.global = {};
          state.global.film_playback_rate = clampFilmPlaybackRate(speedSel.value);
          persist();
          render();
        });
        const followLab = document.createElement("label");
        const followChk = document.createElement("input");
        followChk.type = "checkbox";
        followChk.checked = bgmFollowSpeedOf(state);
        followChk.title = "勾选后背景音乐随画面一起加速；不勾选则 BGM 保持原速，按成片缩短后的时长混音";
        followChk.addEventListener("change", () => {
          if (!state.global || typeof state.global !== "object") state.global = {};
          state.global.bgm_follow_speed = !!followChk.checked;
          persist();
          if (filmPlayer._audio) {
            syncFilmBgm(
              filmPlayer._audio,
              String((state.global && state.global.background_audio) || "").trim(),
              filmPlayer.globalTime,
              !!filmPlayer.playing
            );
          }
        });
        followLab.append(followChk, document.createTextNode("BGM跟随加速"));
        speedBox.append(speedSel, followLab);
        actions.appendChild(speedBox);

        // 先清掉与 video_path 不一致的过期片长（撤销/换片后易串镜）
        reconcileShotFilmSrcCaches(state, filmPlayer.measured);
        // 仅灌入「路径戳记匹配」的缓存
        for (const shot of state.shots_info || []) {
          const vp = String(shot.video_path || "").trim();
          const cached = Number(shot.film_src_dur) || 0;
          const cachedPath = String(shot.film_src_path || "").trim();
          if (vp && cachedPath === vp && cached > 0.2 && !(Number(filmPlayer.measured[vp]) > 0.2)) {
            filmPlayer.measured[vp] = cached;
          }
        }
        const pack = buildFilmClips(state, filmPlayer.measured);
        let clips = pack.clips;
        const skipped = pack.skipped || [];
        let total = pack.total;
        const timelineGen = (filmPlayer._timelineGen = (Number(filmPlayer._timelineGen) || 0) + 1);
        const bgmPath = String((state.global && state.global.background_audio) || "").trim();
        const vol = bgmVolumeOf(state);
        if (bgmPath) {
          const volBox = el("div", "h3b-film-vol");
          volBox.appendChild(el("span", null, "BGM音量"));
          const rng = document.createElement("input");
          rng.type = "range";
          rng.min = "0";
          rng.max = "200";
          rng.step = "5";
          rng.value = String(Math.round(vol * 100));
          const volLab = el("span", null, Math.round(vol * 100) + "%");
          rng.addEventListener("input", () => {
            const next = Math.min(2, Math.max(0, Number(rng.value) / 100));
            state.global.background_audio_volume = next;
            volLab.textContent = Math.round(next * 100) + "%";
            if (filmPlayer._audio) filmPlayer._audio.volume = Math.min(1, next);
          });
          rng.addEventListener("change", () => persist());
          volBox.append(rng, volLab);
          actions.appendChild(volBox);
        }

        const editRow = el("div", "h3b-row");
        const mkEdit = (label, fn) => {
          const b = el("button", "h3b-btn sm", label);
          b.type = "button";
          b.addEventListener("click", fn);
          editRow.appendChild(b);
          return b;
        };
        mkEdit("去掉前面", () => {
          const shot = findShotById(filmPlayer.selectedId);
          const clip = clips.find((c) => Number(c.id) === Number(filmPlayer.selectedId));
          if (!shot || !clip) { alert("请先点选时间线上的片段"); return; }
          const srcT = clip.srcIn + Math.max(0, filmPlayer.globalTime - clip.start);
          if (srcT >= clip.srcOut - 0.1) { alert("开始位置需早于结束位置"); return; }
          shot.film_in = Math.round(srcT * 100) / 100;
          persistFilmEdit();
        });
        mkEdit("去掉后面", () => {
          const shot = findShotById(filmPlayer.selectedId);
          const clip = clips.find((c) => Number(c.id) === Number(filmPlayer.selectedId));
          if (!shot || !clip) { alert("请先点选时间线上的片段"); return; }
          const srcT = clip.srcIn + Math.max(0, filmPlayer.globalTime - clip.start);
          if (srcT <= clip.srcIn + 0.1) { alert("结束位置需晚于开始位置"); return; }
          shot.film_out = Math.round(srcT * 100) / 100;
          persistFilmEdit();
        });
        mkEdit("清除裁剪", () => {
          const shot = findShotById(filmPlayer.selectedId);
          if (!shot) { alert("请先点选时间线上的片段"); return; }
          shot.film_in = 0;
          shot.film_out = 0;
          persistFilmEdit();
        });
        mkEdit("停用片段", () => {
          const shot = findShotById(filmPlayer.selectedId);
          if (!shot) { alert("请先点选时间线上的片段"); return; }
          shot.film_enabled = false;
          persistFilmEdit();
        });
        mkEdit("← 左移", () => {
          if (filmPlayer.selectedId == null) { alert("请先点选时间线上的片段"); return; }
          moveFilmClip(filmPlayer.selectedId, -1);
        });
        mkEdit("右移 →", () => {
          if (filmPlayer.selectedId == null) { alert("请先点选时间线上的片段"); return; }
          moveFilmClip(filmPlayer.selectedId, 1);
        });
        if (clips.length || skipped.length) {
          sec.appendChild(editRow);
          sec.appendChild(el("div", "h3b-hint", "点选片段后：把播放头移到要裁的位置，点「去掉前面 / 去掉后面」裁切；停用后不进入成片；左右移只改成片顺序。已裁片段虚线标出；指针落在已裁片段上时金色内发光。蓝框=选中。预览音量上限 100%，超过部分只作用于合成。播放倍速同时作用于预览与保存成片；「BGM跟随加速」控制背景音乐是否一起变速。"));
        }

        if (skipped.length) {
          const skipRow = el("div", "h3b-film-skip");
          skipRow.appendChild(el("span", null, "已停用"));
          for (const item of skipped) {
            const b = el("button", "h3b-btn sm", "恢复 #" + item.id);
            b.type = "button";
            b.addEventListener("click", () => {
              const shot = findShotById(item.id);
              if (!shot) return;
              shot.film_enabled = true;
              persistFilmEdit();
            });
            skipRow.appendChild(b);
          }
          sec.appendChild(skipRow);
        }

        if (!clips.length) {
          const stage = el("div", "h3b-film-stage");
          stage.appendChild(el(
            "div",
            "h3b-film-stage-ph",
            skipped.length
              ? "当前没有启用的片段。可恢复上方停用片段。"
              : "暂无分镜视频，预览区占位。生成后将在此连续播放。"
          ));
          sec.appendChild(stage);

          const phPack = buildFilmPlaceholderClips(state);
          const phClips = phPack.clips;
          const total = Math.max(0.1, Number(phPack.total) || 10);
          filmPlayer.pxPerSec = clampFilmPxPerSec(filmPlayer.pxPerSec || 40);

          const scrollBox = el("div", "h3b-film-scroll");
          const canvas = el("div", "h3b-film-canvas");
          const ruler = el("div", "h3b-film-ruler");
          const track = el("div", "h3b-film-track");
          const row = el("div", "h3b-film-clips");
          const playhead = el("div", "h3b-film-playhead");

          const step = filmTickStep(filmPlayer.pxPerSec);
          const minor = step / 2;
          const endT = total + step;
          for (let t = 0; t <= endT + 0.0001; t += minor) {
            const major = Math.abs((t / step) - Math.round(t / step)) < 0.001;
            if (!major && minor * filmPlayer.pxPerSec < 10) continue;
            const tick = el("div", "h3b-film-tick" + (major ? " major" : ""));
            tick.style.left = (t * filmPlayer.pxPerSec) + "px";
            if (major) tick.appendChild(el("div", "t", formatFilmTick(t)));
            ruler.appendChild(tick);
          }

          if (phClips.length) {
            for (const clip of phClips) {
              const cell = el("div", "h3b-film-clip ph");
              cell.style.width = Math.max(1, clip.duration * filmPlayer.pxPerSec) + "px";
              cell.title = "#" + clip.id + " 占位 · " + formatFilmTime(clip.duration);
              cell.appendChild(el("div", "lab", "#" + clip.id + " · 待生成 · " + formatFilmTime(clip.duration)));
              row.appendChild(cell);
            }
          } else {
            const cell = el("div", "h3b-film-clip ph");
            cell.style.width = Math.max(1, total * filmPlayer.pxPerSec) + "px";
            cell.appendChild(el("div", "lab", "时间轴占位"));
            row.appendChild(cell);
          }

          canvas.style.width = Math.max(1, total * filmPlayer.pxPerSec) + "px";
          track.appendChild(row);
          canvas.append(ruler, track, playhead);
          scrollBox.appendChild(canvas);
          sec.appendChild(scrollBox);
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);

          const meta = el("div", "h3b-film-meta");
          meta.appendChild(el("span", null, formatFilmClock(0) + " / " + formatFilmTime(total)));
          meta.appendChild(el("span", null, Math.round(filmPlayer.pxPerSec) + "px/s · 占位"));
          sec.appendChild(meta);
          sec.appendChild(el("div", "h3b-status", filmPlayer.status || ""));
          host.appendChild(sec);
          return;
        }

        const stage = el("div", "h3b-film-stage");
        const mkVid = () => {
          const v = document.createElement("video");
          v.playsInline = true;
          v.preload = "auto";
          v.muted = !!filmPlayer.muteSource;
          v.volume = 1;
          v.controls = false;
          return v;
        };
        const videoA = mkVid();
        const videoB = mkVid();
        videoB.classList.add("h3b-film-vid-hide");
        const posterEl = el("img", "h3b-film-poster");
        posterEl.alt = "";
        posterEl.style.display = "none";
        const stageHit = document.createElement("button");
        stageHit.type = "button";
        stageHit.className = "h3b-film-stage-hit";
        stageHit.title = "播放 / 暂停";
        const stageBtn = el("div", "h3b-film-stage-btn");
        const PLAY_ICON =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
        const PAUSE_ICON =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
        stageBtn.innerHTML = filmPlayer.playing ? PAUSE_ICON : PLAY_ICON;
        stageHit.appendChild(stageBtn);
        stage.append(videoA, videoB, posterEl, stageHit);
        sec.appendChild(stage);

        const audioEl = document.createElement("audio");
        audioEl.preload = "metadata";
        audioEl.style.display = "none";
        sec.appendChild(audioEl);

        let activeSlot = 0;
        const slots = [videoA, videoB];
        filmPlayer._slots = slots;
        const applySourceMute = () => {
          const muted = !!filmPlayer.muteSource;
          for (const v of slots) {
            v.muted = muted;
            v.volume = 1;
            applyFilmPlaybackRate(v);
          }
        };
        const activeVideo = () => slots[activeSlot];
        const idleVideo = () => slots[1 - activeSlot];
        filmPlayer._video = activeVideo();
        filmPlayer._audio = audioEl;
        filmPlayer._stage = stage;
        filmPlayer._applySourceMute = applySourceMute;

        const syncPlayUi = () => {
          playBtn.textContent = filmPlayer.playing ? "暂停" : "播放";
          stageHit.setAttribute("aria-label", filmPlayer.playing ? "暂停" : "播放");
          stageBtn.innerHTML = filmPlayer.playing ? PAUSE_ICON : PLAY_ICON;
        };

        const showPosterForClip = (clip) => {
          const cover = clip && String(clip.cover || "").trim();
          if (!cover) {
            posterEl.style.display = "none";
            posterEl.removeAttribute("src");
            return;
          }
          posterEl.src = mediaSrc(cover);
          posterEl.style.display = "block";
        };
        const hidePoster = () => {
          posterEl.style.display = "none";
        };

        const swapToSlot = (slot) => {
          activeSlot = slot;
          slots.forEach((v, i) => {
            v.classList.toggle("h3b-film-vid-hide", i !== activeSlot);
            if (i !== activeSlot) {
              try { v.pause(); } catch (_e) {}
            }
          });
          filmPlayer._video = activeVideo();
          hidePoster();
        };

        const showClipOnStage = async (index, localTime, autoplay) => {
          const clip = clips[Math.max(0, Math.min(index, clips.length - 1))];
          if (!clip) return;
          showPosterForClip(clip);
          const cur = activeVideo();
          const same = cur.getAttribute("data-path") === clip.path;
          if (same) {
            await loadFilmClip(cur, clips, index, localTime, autoplay);
            hidePoster();
            const nxtSame = clips[index + 1];
            if (nxtSame) prefetchFilmClip(idleVideo(), nxtSame);
            return;
          }
          try { cur.pause(); } catch (_e) {}
          const nextEl = idleVideo();
          await loadFilmClip(nextEl, clips, index, localTime, false);
          swapToSlot(1 - activeSlot);
          if (autoplay) {
            const p = activeVideo().play();
            if (p && p.catch) p.catch(() => {});
          }
          hidePoster();
          const nxt = clips[index + 1];
          if (nxt) prefetchFilmClip(idleVideo(), nxt);
        };

        const scrollBox = el("div", "h3b-film-scroll");
        const canvas = el("div", "h3b-film-canvas");
        const ruler = el("div", "h3b-film-ruler");
        const track = el("div", "h3b-film-track");
        const row = el("div", "h3b-film-clips");
        const playhead = el("div", "h3b-film-playhead");
        filmPlayer.pxPerSec = clampFilmPxPerSec(filmPlayer.pxPerSec || 40);

        const paintRuler = () => {
          ruler.innerHTML = "";
          const step = filmTickStep(filmPlayer.pxPerSec);
          const minor = step / 2;
          const endT = total + step;
          for (let t = 0; t <= endT + 0.0001; t += minor) {
            const major = Math.abs((t / step) - Math.round(t / step)) < 0.001;
            if (!major && minor * filmPlayer.pxPerSec < 10) continue;
            const tick = el("div", "h3b-film-tick" + (major ? " major" : ""));
            tick.style.left = (t * filmPlayer.pxPerSec) + "px";
            if (major) tick.appendChild(el("div", "t", formatFilmTick(t)));
            ruler.appendChild(tick);
          }
        };

        const paintClips = () => {
          row.innerHTML = "";
          const liveLoc = locateFilmClip(clips, filmPlayer.globalTime);
          const liveId = clips[liveLoc.index] ? clips[liveLoc.index].id : null;
          for (const clip of clips) {
            const srcCap = Number(clip.srcDur) || Number(clip.srcOut) || clip.duration;
            const hasVideo = !!(clip.path && !clip.placeholder);
            const trimmed = hasVideo && (clip.srcIn > 0.04 || clip.srcOut < srcCap - 0.04);
            const isOn = Number(filmPlayer.selectedId) === Number(clip.id);
            // 仅「已有视频且已裁切」时，指针落在其上才高亮（避免未上传占位像被选中）
            const isLive = trimmed && Number(liveId) === Number(clip.id);
            const cell = el(
              "div",
              "h3b-film-clip"
                + (isOn ? " on" : "")
                + (trimmed ? " cut" : "")
                + (isLive ? " live" : "")
            );
            cell.dataset.clipId = String(clip.id);
            cell.dataset.cut = trimmed ? "1" : "0";
            cell.dataset.hasVideo = hasVideo ? "1" : "0";
            cell.style.width = Math.max(1, clip.duration * filmPlayer.pxPerSec) + "px";
            cell.title = "#" + clip.id + "  " + formatFilmTime(clip.srcIn) + "-" + formatFilmTime(clip.srcOut)
              + " (" + formatFilmTime(clip.duration) + ")" + (trimmed ? " · 已裁" : "");
            if (clip.cover) {
              const img = el("img");
              img.src = mediaSrc(clip.cover);
              cell.appendChild(img);
            } else {
              const v = document.createElement("video");
              v.src = mediaSrc(clip.path);
              v.muted = true;
              v.preload = "metadata";
              cell.appendChild(v);
            }
            if (clip.path && !clip.placeholder) {
              attachMediaZoom(cell, clip.path, "video");
            }
            cell.appendChild(el("div", "lab", "#" + clip.id + (trimmed ? " 裁" : "") + " · " + formatFilmTime(clip.duration)));
            cell.addEventListener("click", (ev) => {
              ev.stopPropagation();
              filmPlayer.selectedId = clip.id;
              Array.from(row.children).forEach((n) => {
                n.classList.toggle("on", Number(n.dataset.clipId) === Number(clip.id));
              });
              seekTo(timeFromPointer(ev.clientX), filmPlayer.playing);
            });
            row.appendChild(cell);
          }
        };

        const syncLiveClipClass = () => {
          const liveLoc = locateFilmClip(clips, filmPlayer.globalTime);
          const liveId = clips[liveLoc.index] ? clips[liveLoc.index].id : null;
          Array.from(row.children).forEach((n) => {
            const id = Number(n.dataset.clipId);
            const cut = n.dataset.cut === "1" && n.dataset.hasVideo === "1";
            n.classList.toggle("live", cut && id === Number(liveId));
            n.classList.toggle("on", id === Number(filmPlayer.selectedId));
          });
        };

        const rememberSrcDur = (clipOrShotId, path, md) =>
          writeMeasuredDuration(state.shots_info, filmPlayer.measured, path, md, clipOrShotId);

        const rebuildClipsFromMeasured = () => {
          if (timelineGen !== filmPlayer._timelineGen) return;
          const p = buildFilmClips(state, filmPlayer.measured);
          clips = p.clips;
          total = p.total;
          if (filmPlayer.globalTime > total) filmPlayer.globalTime = total;
          layoutTimeline();
          timeLab.textContent = formatFilmClock(filmPlayer.globalTime) + " / " + formatFilmTime(total);
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
          syncLiveClipClass();
          persist();
        };

        const layoutTimeline = () => {
          canvas.style.width = Math.max(1, total * filmPlayer.pxPerSec) + "px";
          paintRuler();
          paintClips();
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
        };

        track.appendChild(row);
        canvas.append(ruler, track, playhead);
        scrollBox.appendChild(canvas);
        sec.appendChild(scrollBox);
        scrollBox.scrollLeft = Math.max(0, Number(filmPlayer.scrollLeft) || 0);
        scrollBox.addEventListener("scroll", () => {
          filmPlayer.scrollLeft = scrollBox.scrollLeft;
        });

        const meta = el("div", "h3b-film-meta");
        const timeLab = el("span", null, formatFilmClock(filmPlayer.globalTime) + " / " + formatFilmTime(total));
        const zoomLab = el("span", null, Math.round(filmPlayer.pxPerSec) + "px/s · 滚轮缩放");
        meta.appendChild(timeLab);
        meta.appendChild(el("span", null, "片段 " + clips.length + " 段"));
        meta.appendChild(el("span", null, bgmPath ? ("BGM：" + Math.round(vol * 100) + "%") : "BGM：未设置"));
        const rateNow = filmPlaybackRateOf(state);
        const outDur = total / Math.max(0.25, rateNow);
        meta.appendChild(
          el(
            "span",
            null,
            rateNow === 1
              ? "倍速 1x"
              : ("倍速 " + rateNow + "x · 成片约 " + formatFilmTime(outDur))
          )
        );
        meta.appendChild(zoomLab);
        sec.appendChild(meta);

        const statusEl = el("div", "h3b-status" + (filmPlayer.statusKind === "err" ? " err" : (filmPlayer.statusKind === "ok" ? " ok" : "")), filmPlayer.status || "");
        sec.appendChild(statusEl);

        const ensurePlayheadVisible = () => {
          const x = filmPlayer.globalTime * filmPlayer.pxPerSec;
          const left = scrollBox.scrollLeft;
          const right = left + scrollBox.clientWidth;
          if (x < left + 24) scrollBox.scrollLeft = Math.max(0, x - 24);
          else if (x > right - 24) scrollBox.scrollLeft = Math.max(0, x - scrollBox.clientWidth + 24);
          filmPlayer.scrollLeft = scrollBox.scrollLeft;
        };

        const updatePlayheadFromVideo = () => {
          const clip = clips[filmPlayer.clipIndex];
          const videoEl = activeVideo();
          if (!clip || !filmPlayer.playing || filmPlayer.scrubbing || !videoEl) return;
          if (videoEl.getAttribute("data-path") !== clip.path) return;
          const ct = Number(videoEl.currentTime) || 0;
          const srcIn = Number(clip.srcIn) || 0;
          const srcOut = Number(clip.srcOut) || (srcIn + clip.duration);
          // 仍在 seek / 未落到裁切窗内时，不要回写 globalTime（否则会污染裁剪点）
          if (ct < srcIn - 0.12) return;
          if (ct >= srcOut - 0.03) {
            goNextClip();
            return;
          }
          filmPlayer.globalTime = clip.start + Math.max(0, ct - srcIn);
          filmPlayer.selectedId = clip.id;
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
          syncLiveClipClass();
          timeLab.textContent = formatFilmClock(filmPlayer.globalTime) + " / " + formatFilmTime(total);
          ensurePlayheadVisible();
        };

        const startSmoothClock = () => {
          if (filmPlayer._raf) cancelAnimationFrame(filmPlayer._raf);
          const tick = () => {
            filmPlayer._raf = 0;
            if (!filmPlayer.playing) return;
            updatePlayheadFromVideo();
            if (filmPlayer.playing) filmPlayer._raf = requestAnimationFrame(tick);
          };
          filmPlayer._raf = requestAnimationFrame(tick);
        };

        const goNextClip = async () => {
          if (filmPlayer._advancing) return;
          filmPlayer._advancing = true;
          const next = filmPlayer.clipIndex + 1;
          if (next >= clips.length) {
            filmPlayer.playing = false;
            filmPlayer.globalTime = total;
            stopFilmPlayback();
            syncPlayUi();
            syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
            syncLiveClipClass();
            timeLab.textContent = formatFilmClock(filmPlayer.globalTime) + " / " + formatFilmTime(total);
            filmPlayer._advancing = false;
            return;
          }
          const clip = clips[next];
          filmPlayer.globalTime = clip.start;
          filmPlayer.selectedId = clip.id;
          syncLiveClipClass();
          await showClipOnStage(next, 0, true);
          syncFilmBgm(audioEl, bgmPath, filmPlayer.globalTime, !!bgmPath);
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
          syncLiveClipClass();
          filmPlayer._advancing = false;
        };

        const seekTo = async (gTime, autoplay) => {
          const totalDur = total > 0 ? total : 1;
          filmPlayer.globalTime = Math.min(Math.max(0, gTime), totalDur);
          const loc = locateFilmClip(clips, filmPlayer.globalTime);
          const clip = clips[loc.index];
          if (clip) filmPlayer.selectedId = clip.id;
          filmPlayer._seekToken = (filmPlayer._seekToken || 0) + 1;
          const token = filmPlayer._seekToken;
          filmPlayer.scrubbing = true;
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
          syncLiveClipClass();
          timeLab.textContent = formatFilmClock(filmPlayer.globalTime) + " / " + formatFilmTime(total);
          ensurePlayheadVisible();
          try {
            await showClipOnStage(loc.index, loc.local, !!autoplay);
            if (token !== filmPlayer._seekToken) return;
            syncFilmBgm(audioEl, bgmPath, filmPlayer.globalTime, !!autoplay && !!bgmPath);
            if (autoplay) startSmoothClock();
          } finally {
            if (token === filmPlayer._seekToken) filmPlayer.scrubbing = false;
          }
        };

        const timeFromPointer = (clientX) => {
          const x = localXFromClient(canvas, clientX);
          return Math.min(total, Math.max(0, x / filmPlayer.pxPerSec));
        };

        layoutTimeline();
        seekTo(filmPlayer.globalTime, false);
        filmPlayer._onSrcDurMeasured = () => {
          if (timelineGen === filmPlayer._timelineGen) rebuildClipsFromMeasured();
        };

        // 每次挂载都重测真实时长，纠正串镜/过期缓存（不再因旧缓存跳过）
        (async () => {
          let changed = false;
          const list = clips.slice().filter((c) => c.path);
          await Promise.all(
            list.map(async (c) => {
              const md = await probeVideoDuration(c.path);
              if (timelineGen !== filmPlayer._timelineGen) return;
              if (md > 0.2 && rememberSrcDur(c.id, c.path, md)) changed = true;
            })
          );
          if (changed && timelineGen === filmPlayer._timelineGen) rebuildClipsFromMeasured();
        })();

        scrollBox.addEventListener("click", (ev) => {
          seekTo(timeFromPointer(ev.clientX), filmPlayer.playing);
        });

        scrollBox.addEventListener("wheel", (ev) => {
          ev.preventDefault();
          const anchorTime = timeFromPointer(ev.clientX);
          const factor = ev.deltaY < 0 ? 1.12 : (1 / 1.12);
          const next = clampFilmPxPerSec(filmPlayer.pxPerSec * factor);
          if (Math.abs(next - filmPlayer.pxPerSec) < 0.01) return;
          filmPlayer.pxPerSec = next;
          layoutTimeline();
          zoomLab.textContent = Math.round(filmPlayer.pxPerSec) + "px/s · 滚轮缩放";
          const localMouseX = localXFromClient(scrollBox, ev.clientX);
          scrollBox.scrollLeft = Math.max(0, anchorTime * filmPlayer.pxPerSec - localMouseX);
          filmPlayer.scrollLeft = scrollBox.scrollLeft;
          syncFilmPlayhead(playhead, filmPlayer.pxPerSec);
          syncLiveClipClass();
        }, { passive: false });

        const bindVideoEvents = (videoEl) => {
          videoEl.addEventListener("timeupdate", () => {
            if (videoEl !== activeVideo()) return;
            if (!filmPlayer.playing || filmPlayer.scrubbing) return;
            updatePlayheadFromVideo();
          });
          videoEl.addEventListener("ended", () => {
            if (videoEl !== activeVideo()) return;
            if (!filmPlayer.playing) return;
            goNextClip();
          });
        };
        bindVideoEvents(videoA);
        bindVideoEvents(videoB);

        const toggleFilmPlay = () => {
          if (filmPlayer.playing) {
            filmPlayer.playing = false;
            stopFilmPlayback();
            syncPlayUi();
            return;
          }
          if (filmPlayer.globalTime >= total - 0.05) filmPlayer.globalTime = 0;
          filmPlayer.playing = true;
          syncPlayUi();
          seekTo(filmPlayer.globalTime, true);
        };

        stageHit.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleFilmPlay();
        });
        stage.addEventListener("mouseenter", () => stage.classList.add("show-ctrl"));
        stage.addEventListener("mouseleave", () => stage.classList.remove("show-ctrl"));
        // 触控：点一下先显按钮，再点切换
        stage.addEventListener(
          "pointerdown",
          (ev) => {
            if (ev.pointerType === "touch" || ev.pointerType === "pen") {
              stage.classList.add("show-ctrl");
            }
          },
          { passive: true }
        );

        playBtn.addEventListener("click", () => toggleFilmPlay());

        restartBtn.addEventListener("click", () => {
          filmPlayer.globalTime = 0;
          const was = filmPlayer.playing;
          seekTo(0, was);
          syncPlayUi();
        });

        muteSrcBtn.addEventListener("click", () => {
          filmPlayer.muteSource = !filmPlayer.muteSource;
          muteSrcBtn.textContent = filmPlayer.muteSource ? "原声已关" : "关闭原声";
          muteSrcBtn.classList.toggle("on", !!filmPlayer.muteSource);
          applySourceMute();
        });

        composeBtn.addEventListener("click", async () => {
          if (generating) return;
          composeBtn.disabled = true;
          try {
            await composeEnabledFilm();
          } catch (err) {
            const msg = String(err && err.message ? err.message : err);
            if (!filmPlayer.statusKind) {
              filmPlayer.status = msg;
              filmPlayer.statusKind = "err";
            }
            alert("合成失败: " + msg);
            render();
          } finally {
            composeBtn.disabled = false;
          }
        });

        host.appendChild(sec);
      };

      const render = () => {
        if (applyPendingShotVideos(state)) {
          try {
            setWidgetValue(editW, JSON.stringify(state, null, 2));
          } catch (_e) {}
          saveBoardMatedata(state);
          if (!genStatus || genStatusKind !== "err") {
            setGenStatus("已从暂存恢复分镜视频到预览区", "ok");
          }
        }
        rendering = true;
        ensureSelection();
        root.innerHTML = "";

        const top = el("div", "h3b-top");
        top.append(
          field("剧本名称", textInput(state.script_name || "", (v) => { state.script_name = v; persist(); })),
          field("时长(秒)", numInput(state.duration, (v) => { state.duration = v; persist(); })),
          field("宽", numInput(state.width, (v) => { state.width = v; persist(); })),
          field("高", numInput(state.height, (v) => { state.height = v; persist(); }))
        );
        root.appendChild(top);

        // 锁定放在顶部固定区，避免被 overflow 裁掉或滚出视野
        const lockBar = el("div", "h3b-lock");
        lockBar.appendChild(el("div", "h3b-hint", "开启后运行保留手改，不被上游覆盖"));
        const lockLab = el("label");
        const lockCb = document.createElement("input");
        lockCb.type = "checkbox";
        lockCb.checked = !!(lockW && lockW.value);
        lockCb.addEventListener("change", () => {
          if (!lockW) return;
          lockW.value = !!lockCb.checked;
          lockW.callback?.(lockW.value);
          if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
        });
        lockLab.append(lockCb, document.createTextNode("锁定编辑"));
        lockBar.appendChild(lockLab);
        const noAutoLab = el("label");
        const noAutoCb = document.createElement("input");
        noAutoCb.type = "checkbox";
        noAutoCb.checked = !!(noAutoW && noAutoW.value);
        noAutoCb.addEventListener("change", () => {
          if (!noAutoW) return;
          noAutoW.value = !!noAutoCb.checked;
          noAutoW.callback?.(noAutoW.value);
          if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
        });
        noAutoLab.append(noAutoCb, document.createTextNode("不自动运行"));
        noAutoLab.title = "开启后：全局运行只跑到看板为止，方便人工补素材/照片";
        lockBar.appendChild(noAutoLab);
        root.appendChild(lockBar);

        const scroll = el("div", "h3b-scroll");

        const assetSec = el("div", "h3b-sec");
        const assetHead = el("div", "h3b-sec-head");
        assetHead.appendChild(el("div", "h3b-sec-title", "素材"));
        const addAssetRow = el("div", "h3b-row");
        for (const [key, label] of TYPE_META) {
          const btn = el("button", "h3b-btn primary", "+ " + label);
          btn.type = "button";
          btn.addEventListener("click", () => {
            const arr = state.global[key] || (state.global[key] = []);
            const nextId = (arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) || 0) + 1;
            arr.push({
              id: nextId,
              name: label + nextId,
              desc: "",
              gen_prompt: "",
              bing_image_path: "",
              bing_audio_path: "",
            });
            selectedAsset = { key, id: nextId };
            persist();
            render();
          });
          addAssetRow.appendChild(btn);
        }
        const batchBtn = el("button", "h3b-btn success", generating ? "生成中…" : "一键生成缺失图片");
        batchBtn.type = "button";
        batchBtn.disabled = generating;
        batchBtn.title = "按「生图提示词」连线，为所有缺图素材依次调度文生图子流程";
        batchBtn.addEventListener("click", () => generateMissingImages());
        addAssetRow.appendChild(batchBtn);
        assetHead.appendChild(addAssetRow);
        assetSec.appendChild(assetHead);

        const assetsWrap = el("div", "h3b-assets-wrap");
        const grid = el("div", "h3b-grid");
        const assets = allAssets(state);
        if (!assets.length) {
          grid.appendChild(el("div", "h3b-empty", "暂无素材卡片（布局保留）— 请点右上角添加"));
        }
        for (const entry of assets) {
          const item = entry.item;
          const on = !!(selectedAsset
            && selectedAsset.key === entry.key
            && Number(selectedAsset.id) === Number(item.id));
          const tile = el("div", "h3b-tile" + (on ? " on" : ""));
          const cover = el("div", "h3b-tile-cover");
          const imgPath = assetImagePath(item);
          if (imgPath) {
            const img = el("img");
            img.src = mediaSrc(imgPath);
            cover.appendChild(img);
            attachMediaZoom(cover, imgPath, "image");
          } else {
            cover.textContent = item.name || "无图";
          }
          tile.appendChild(cover);
          tile.appendChild(tileMeta(entry.label + " #" + item.id, item.name || (entry.label + item.id)));
          tile.addEventListener("click", () => {
            selectedAsset = { key: entry.key, id: Number(item.id) };
            render();
          });
          grid.appendChild(tile);
        }
        assetsWrap.appendChild(grid);

        // 背景音乐：素材栏右侧独立青色卡片（线隔离），样式对齐出场栏「本镜视频」
        {
          const bgmPath = String((state.global && state.global.background_audio) || "").trim();
          const side = el("div", "h3b-assets-side");
          side.appendChild(el("div", "h3b-label", "背景音乐"));
          const bgmTile = el("div", "h3b-tile bgm" + (bgmPath ? " has" : ""));
          const cover = el("div", "h3b-tile-cover");
          if (bgmPath) {
            cover.textContent = "♪";
            const preview = ensureBgmPreview(bgmPath);
            const playBtn = el("button", "h3b-bgm-play", preview && !preview.paused ? "❚❚" : "▶");
            playBtn.type = "button";
            playBtn.title = "播放预览";
            playBtn.addEventListener("click", (evt) => {
              evt.stopPropagation();
              const a = ensureBgmPreview(bgmPath);
              if (!a) return;
              if (a.paused) {
                const p = a.play();
                if (p && p.catch) p.catch(() => {});
                playBtn.textContent = "❚❚";
              } else {
                a.pause();
                playBtn.textContent = "▶";
              }
            });
            if (preview) {
              preview.onended = () => {
                playBtn.textContent = "▶";
              };
            }
            cover.appendChild(playBtn);
          } else {
            cover.textContent = "+";
            stopBgmPreview();
          }
          bgmTile.appendChild(cover);
          bgmTile.appendChild(tileMeta(bgmPath ? "已上传" : "上传", bgmPath ? fileBase(bgmPath) : "BGM"));
          bgmTile.title = bgmPath
            ? ("背景音乐\n" + bgmPath + "\n点击卡片可替换")
            : "上传背景音乐（mp3 等）";
          bgmTile.addEventListener("click", () => {
            const existing = String((state.global && state.global.background_audio) || "").trim();
            if (existing) {
              if (!window.confirm("将替换当前背景音乐，是否继续？")) return;
            }
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "audio/*";
            input.style.display = "none";
            input.addEventListener("change", async () => {
              const file = input.files && input.files[0];
              input.remove();
              if (!file) return;
              try {
                stopBgmPreview();
                const path = await uploadFile(file, "audio");
                state.global.background_audio = path;
                syncGlobalPromptForBgm(state);
                bustMedia(path);
                persist();
                render();
              } catch (err) {
                alert("上传失败: " + (err && err.message ? err.message : err));
              }
            });
            document.body.appendChild(input);
            input.click();
          });
          side.appendChild(bgmTile);
          if (bgmPath) {
            const clearBtn = el("button", "h3b-btn sm danger", "清除");
            clearBtn.type = "button";
            clearBtn.style.marginTop = "2px";
            clearBtn.addEventListener("click", (evt) => {
              evt.stopPropagation();
              stopBgmPreview();
              state.global.background_audio = "";
              persist();
              render();
            });
            side.appendChild(clearBtn);
          }
          assetsWrap.appendChild(side);
        }

        assetSec.appendChild(assetsWrap);
        const assetDetail = el("div", "h3b-detail");
        renderAssetDetail(assetDetail);
        assetSec.appendChild(assetDetail);
        scroll.appendChild(assetSec);

        const promptSec = el("div", "h3b-sec");
        const promptHead = el("div", "h3b-sec-head");
        promptHead.appendChild(el("div", "h3b-sec-title", "全局提示"));
        promptSec.appendChild(promptHead);
        syncGlobalPromptForBgm(state);
        promptSec.appendChild(areaInput(state.global.global_prompt || "", (v) => {
          state.global.global_prompt = v;
          syncGlobalPromptForBgm(state);
          persist();
        }, 4));
        if (String((state.global && state.global.background_audio) || "").trim()) {
          promptSec.appendChild(
            el(
              "div",
              "h3b-hint",
              "已上传背景音乐：生视频时会合并本段；non_diegetic_music 固定为 N/A，禁止模型再生成配乐，仅保留音效与对白。"
            )
          );
        }
        scroll.appendChild(promptSec);

        const shotSec = el("div", "h3b-sec");
        const shotHead = el("div", "h3b-sec-head");
        shotHead.appendChild(el("div", "h3b-sec-title", "分镜"));
        const shotActions = el("div", "h3b-row");
        const genAllShotsBtn = el("button", "h3b-btn success", generating ? "生成中…" : "一键生成全部分镜");
        genAllShotsBtn.type = "button";
        genAllShotsBtn.disabled = generating;
        genAllShotsBtn.title = "按顺序调度首分镜/非首分镜子流程，生成并写回各分镜视频";
        genAllShotsBtn.addEventListener("click", () => {
          const shots = state.shots_info || [];
          if (!shots.length) {
            alert("暂无分镜");
            return;
          }
          const hasVideo = shots.filter((s) => String(s.video_path || "").trim()).length;
          const msg =
            "确认一键生成全部 " +
            shots.length +
            " 个分镜视频？" +
            (hasVideo
              ? "\n其中 " + hasVideo + " 个分镜已有视频，将被覆盖。"
              : "") +
            "\n将按顺序调度首分镜/非首分镜子流程。";
          if (!window.confirm(msg)) return;
          generateAllShots();
        });
        const addShot = el("button", "h3b-btn primary", "+ 添加分镜");
        addShot.type = "button";
        addShot.addEventListener("click", () => {
          const arr = state.shots_info || (state.shots_info = []);
          const id = arr.length + 1;
          arr.push({
            id,
            shot: "",
            is_first_shots: id === 1,
            pre_last_frame_path: "",
            first_frame_path: "",
            video_path: "",
            prev_video_path: "",
            duration: 5,
            appear: { roles: [], prop: [], scene: [] },
          });
          syncShotFirstFlags(arr);
          selectedShotId = id;
          persist();
          render();
        });
        shotActions.appendChild(addShot);
        shotActions.appendChild(genAllShotsBtn);
        shotHead.appendChild(shotActions);
        shotSec.appendChild(shotHead);

        const shotGrid = el("div", "h3b-shots");
        const shots = state.shots_info || [];
        if (!shots.length) {
          shotGrid.appendChild(el("div", "h3b-empty", "暂无分镜卡片（布局保留）— 请点右上角添加"));
        }
        shots.forEach((shot, idx) => {
          const on = Number(shot.id) === Number(selectedShotId);
          const tile = el("div", "h3b-tile" + (on ? " on" : ""));
          const cover = el("div", "h3b-tile-cover");
          const coverPath = String(shot.first_frame_path || "").trim();
          if (coverPath) {
            const img = el("img");
            img.src = mediaSrc(coverPath);
            cover.appendChild(img);
            const zoomPath = String(shot.video_path || "").trim() || coverPath;
            attachMediaZoom(cover, zoomPath, String(shot.video_path || "").trim() ? "video" : "image");
          } else if (String(shot.video_path || "").trim()) {
            const vid = document.createElement("video");
            vid.src = mediaSrc(shot.video_path);
            vid.muted = true;
            vid.preload = "metadata";
            vid.style.width = "100%";
            vid.style.height = "100%";
            vid.style.objectFit = "cover";
            cover.appendChild(vid);
            attachMediaZoom(cover, shot.video_path, "video");
          } else {
            cover.textContent = shotKindLabel(shots, idx);
          }
          tile.appendChild(cover);
          tile.appendChild(tileMeta(
            shotKindLabel(shots, idx) + " · " + (shot.duration || 5) + "s",
            "分镜 #" + shot.id
          ));
          tile.addEventListener("click", () => {
            selectedShotId = Number(shot.id);
            render();
          });
          shotGrid.appendChild(tile);
        });
        shotSec.appendChild(shotGrid);
        const shotDetail = el("div", "h3b-detail");
        renderShotDetail(shotDetail);
        shotSec.appendChild(shotDetail);
        scroll.appendChild(shotSec);
        renderFilmTimeline(scroll);
        scroll.appendChild(el("div", "h3b-hint", "全局运行：第一阶段跑剧本/拆解/保存JSON/预览/看板（不含生图生视频）→ 再局部逐张素材图 → 逐镜视频 → 成片。开启「不自动运行」时只跑到看板。看板「分镜资产结果JSON」输入不是必须；若无上游且看板也无剧本/分镜，点运行会提示补全。成片请把看板「成片视频」接到 SaveVideo；合成后自动送入，不在看板下展示成片文件。单次生图/生视频只跑看板下游。参考图/音与上一镜视频由看板注入。不要删子图内部 video 槽；看板「时长」不要接到 values.a。"));

        const clearWrap = el("div", "h3b-clear-wrap");
        const clearBoardBtn = el("button", "h3b-btn clear-board", "清空看板");
        clearBoardBtn.type = "button";
        clearBoardBtn.title = "清空剧本、素材、分镜与生成结果引用，恢复为刚拖出节点时的空状态";
        clearBoardBtn.addEventListener("click", () => {
          if (!window.confirm("确认清空看板？将清除剧本、素材、分镜、成片与媒体引用，恢复为空状态。此操作不可撤销。")) {
            return;
          }
          stopBgmPreview();
          if (filmPlayer._audio) {
            try { filmPlayer._audio.pause(); } catch (_e) {}
          }
          if (filmPlayer._raf) {
            try { cancelAnimationFrame(filmPlayer._raf); } catch (_e) {}
            filmPlayer._raf = 0;
          }
          state = emptyState();
          selectedAsset = null;
          selectedShotId = null;
          filmPlayer.clipIndex = 0;
          filmPlayer.globalTime = 0;
          filmPlayer.playing = false;
          filmPlayer.composedPath = "";
          filmPlayer.measured = {};
          filmPlayer.status = "";
          filmPlayer.statusKind = "";
          filmPlayer.selectedId = null;
          filmPlayer.scrollLeft = 0;
          filmPlayer.scrubbing = false;
          filmPlayer._seekToken = (filmPlayer._seekToken || 0) + 1;
          setWidgetValue(editW, JSON.stringify(state, null, 2));
          if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
          setGenStatus("看板已清空", "ok");
          render();
        });
        clearWrap.appendChild(clearBoardBtn);
        scroll.appendChild(clearWrap);

        root.appendChild(scroll);

        rendering = false;
        requestAnimationFrame(syncPanel);
      };

      node._h3BoardSync = syncPanel;
      node._h3BoardReload = (text, force) => {
        const lock = !!(lockW && lockW.value);
        const prevState = state;
        const incomingState = parseState(text);
        if (_matedataSaveTimer) {
          clearTimeout(_matedataSaveTimer);
          _matedataSaveTimer = null;
        }
        if (lock && !force && String((editW && editW.value) || "").trim()) {
          state = parseState(editW.value);
          if (String(text || "").trim()) {
            // Keep hand edits, but drop previous-script BGM when upstream script changes.
            clearStaleBackgroundAudio(state, incomingState);
            if (!String((state.global && state.global.background_audio) || "").trim()) {
              stopBgmPreview();
            }
            setWidgetValue(editW, JSON.stringify(state, null, 2));
          }
        } else {
          // Upstream overwrite: use incoming payload; also scrub if script identity flipped.
          state = incomingState;
          clearStaleBackgroundAudio(state, incomingState);
          if (prevState) clearStaleBackgroundAudio(prevState, incomingState);
          if (!String((state.global && state.global.background_audio) || "").trim()) {
            stopBgmPreview();
          }
          setWidgetValue(editW, JSON.stringify(state, null, 2));
        }
        // Persist cleared/updated BGM so metadata JSON does not keep the old path.
        scheduleSaveBoardMatedata(state);
        filmPlayer.measured = {};
        reconcileShotFilmSrcCaches(state, filmPlayer.measured);
        if (applyPendingShotVideos(state)) {
          setWidgetValue(editW, JSON.stringify(state, null, 2));
          saveBoardMatedata(state);
        }
        filmPlayer.composedPath = String(state.film_path || "");
        selectedAsset = null;
        selectedShotId = null;
        render();
      };

      if (!this.__h3BoardSyncTimer) {
        this.__h3BoardSyncTimer = setInterval(syncPanel, 400);
        const prevRemoved = this.onRemoved;
        this.onRemoved = function () {
          if (this.__h3BoardSyncTimer) {
            clearInterval(this.__h3BoardSyncTimer);
            this.__h3BoardSyncTimer = null;
          }
          if (prevRemoved) prevRemoved.apply(this, arguments);
        };
      }

      node._h3BoardReload((editW && editW.value) || "", true);
      // 工作流里 edit_json 已有路径但磁盘 matedata 仍为空时，打开看板补写一份
      if (
        (state.shots_info || []).some(
          (s) =>
            String((s && s.video_path) || "").trim() ||
            String((s && s.first_frame_path) || "").trim() ||
            String((s && s.pre_last_frame_path) || "").trim()
        ) ||
        String(state.film_path || "").trim()
      ) {
        saveBoardMatedata(state);
      }
      // 仅在异常飙高时拉回默认；正常用户高度一律保留
      if (!this.size || !Number.isFinite(this.size[1]) || this.size[1] > SIZE_MAX_H) {
        this.size = [DEFAULT_SIZE[0], DEFAULT_SIZE[1]];
        if (this.setSize) this.setSize(this.size.slice());
      } else {
        clampNodeSize(this);
      }
      requestAnimationFrame(syncPanel);
      return ret;
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const ret = onConfigure ? onConfigure.apply(this, arguments) : undefined;
      requestAnimationFrame(() => {
        hideWidget(widgetByName(this, "edit_json"));
        hideWidget(widgetByName(this, "lock_edit"));
        hideWidget(widgetByName(this, "no_auto_run"));
        const editW = widgetByName(this, "edit_json");
        if (this._h3BoardReload) this._h3BoardReload((editW && editW.value) || "", true);
        if (this.size && Number.isFinite(this.size[1]) && this.size[1] > SIZE_MAX_H) {
          this.size = [Math.max(this.size[0] || DEFAULT_SIZE[0], 900), DEFAULT_SIZE[1]];
          if (this.setSize) this.setSize(this.size.slice());
        }
        if (this._h3BoardSync) this._h3BoardSync();
      });
      return ret;
    };

    const onExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      if (onExecuted) onExecuted.apply(this, arguments);
      const raw = Array.isArray(message && message.shots_json)
        ? message.shots_json[0]
        : (message && message.shots_json);
      if (raw == null) return;
      const lockW = widgetByName(this, "lock_edit");
      const lock = !!(lockW && lockW.value);
      if (this._h3BoardReload) this._h3BoardReload(String(raw), !lock);
    };
  },
  async setup() {
    installH3QueueGuard();
  },
});
