import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "MinimaxH3LoadJson";
const LIST_URL = "/h3_ref2va_auto/json_files";
const UPLOAD_URL = "/h3_ref2va_auto/upload_json";
const EMPTY_CHOICE = "(暂无 JSON)";

function comboWidget(node) {
  return (node.widgets || []).find((w) => w.name === "filename");
}

const looksLikeJsonFile = (v) =>
  typeof v === "string" && v !== EMPTY_CHOICE && /\.json$/i.test(v);

function setComboValues(widget, files, selected) {
  if (!widget) return;
  const values = files.length ? files.slice() : [EMPTY_CHOICE];
  // 保留「已选中但列表快照里还没有」的文件：刚上传成功、或页面初始化时
  // 发出的旧列表请求迟到，都不该把用户/上传选中的项冲掉。
  for (const v of [String(widget.value || ""), selected ? String(selected) : ""]) {
    if (looksLikeJsonFile(v) && !values.includes(v)) values.unshift(v);
  }
  widget.options = widget.options || {};
  widget.options.values = values;
  if (selected && values.includes(selected)) {
    widget.value = selected;
  } else if (!values.includes(widget.value)) {
    widget.value = values[0];
  }
}

function markNodeDirty(node) {
  try {
    if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
  } catch (_e) {}
  try {
    if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);
  } catch (_e) {}
}

async function refreshFiles(node, prefer) {
  const widget = comboWidget(node);
  const res = await api.fetchApi(LIST_URL);
  if (!res.ok) throw new Error("读取 JSON 列表失败 HTTP " + res.status);
  const data = await res.json();
  const files = Array.isArray(data.files) ? data.files : [];
  setComboValues(widget, files, prefer);
  markNodeDirty(node);
  return files;
}

async function uploadJson(node, file) {
  const body = new FormData();
  body.append("file", file, file.name || "metadata.json");
  const res = await api.fetchApi(UPLOAD_URL, { method: "POST", body });
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error("上传接口返回非 JSON");
  }
  if (!res.ok || data.error) {
    throw new Error(data.error || ("上传失败 HTTP " + res.status));
  }
  // 服务端已把文件写入 output/.../data 并改成 metadata-*-#####.json，
  // 列表和后端 Combo 校验都会认它；这里刷新列表并直接选中新文件。
  const uploaded = String(data.filename || "").trim();
  await refreshFiles(node, uploaded || preferSelected(node));
  const widget = comboWidget(node);
  if (uploaded && widget) {
    widget.value = uploaded;
    if (!Array.isArray(widget.options?.values) || !widget.options.values.includes(uploaded)) {
      widget.options = widget.options || {};
      widget.options.values = [uploaded, ...(widget.options.values || [])];
    }
    try {
      widget.callback?.(uploaded);
    } catch (_e) {}
    markNodeDirty(node);
  }
  return uploaded;
}

function preferSelected(node) {
  const w = comboWidget(node);
  return w && w.value;
}

app.registerExtension({
  name: "H3Ref2VAAuto.JsonIO",
  async nodeCreated(node) {
    if (node.comfyClass !== NODE_NAME) return;
    if (node._h3JsonIoBound) return;
    node._h3JsonIoBound = true;

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".json,application/json";
    picker.style.display = "none";
    document.body.appendChild(picker);

    picker.addEventListener("change", async () => {
      const file = picker.files && picker.files[0];
      picker.value = "";
      if (!file) return;
      try {
        const name = await uploadJson(node, file);
        try {
          app.extensionManager?.toast?.add?.({
            severity: "success",
            summary: "JSON 已导入并选中",
            detail: name ? file.name + " → " + name : file.name,
            life: 3000,
          });
        } catch (_e) {}
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });

    node.addWidget("button", "上传 JSON", null, () => picker.click());
    node.addWidget("button", "刷新列表", null, () => {
      refreshFiles(node, preferSelected(node)).catch((err) =>
        window.alert(err.message || String(err))
      );
    });

    refreshFiles(node, comboWidget(node)?.value).catch(() => {});
  },
});
