import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "MinimaxH3LoadJson";
const LIST_URL = "/h3_ref2va_auto/json_files";
const UPLOAD_URL = "/h3_ref2va_auto/upload_json";

function comboWidget(node) {
  return (node.widgets || []).find((w) => w.name === "filename");
}

function setComboValues(widget, files, selected) {
  if (!widget) return;
  const values = files.length ? files : ["(暂无 JSON)"];
  widget.options = widget.options || {};
  widget.options.values = values;
  if (selected && values.includes(selected)) {
    widget.value = selected;
  } else if (!values.includes(widget.value)) {
    widget.value = values[0];
  }
}

async function refreshFiles(node, prefer) {
  const widget = comboWidget(node);
  const res = await api.fetchApi(LIST_URL);
  const data = await res.json();
  const files = Array.isArray(data.files) ? data.files : [];
  setComboValues(widget, files, prefer);
  node.setDirtyCanvas(true);
  return files;
}

async function uploadJson(node, file) {
  const body = new FormData();
  body.append("file", file, file.name || "metadata.json");
  const res = await api.fetchApi(UPLOAD_URL, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || ("上传失败 HTTP " + res.status));
  }
  // 上传落在 input/，加载列表只扫 output/.../data；刷新后仍用原选中项
  await refreshFiles(node, preferSelected(node));
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
        await uploadJson(node, file);
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });

    node.addWidget("button", "上传 JSON", null, () => picker.click());
    node.addWidget("button", "刷新列表", null, () => {
      refreshFiles(node).catch((err) => window.alert(err.message || String(err)));
    });

    refreshFiles(node, comboWidget(node)?.value).catch(() => {});
  },
});
