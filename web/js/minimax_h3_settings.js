import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const MENU = "H3 Ref2VA Auto";
const ID_API_KEY = "H3Ref2VAAuto.OpenAI.ApiKey";
const ID_BASE_URL = "H3Ref2VAAuto.OpenAI.BaseUrl";
const ID_MODEL = "H3Ref2VAAuto.OpenAI.Model";
const ID_MODEL_LIST = "H3Ref2VAAuto.OpenAI.ModelList";

function buildModelPicker(name, setter, value) {
  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "8px";
  root.style.minWidth = "280px";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.alignItems = "center";

  const select = document.createElement("select");
  select.style.flex = "1";
  select.style.minWidth = "200px";
  select.style.maxWidth = "420px";

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "刷新模型列表";
  refresh.style.cursor = "pointer";
  refresh.style.whiteSpace = "nowrap";

  const status = document.createElement("div");
  status.style.opacity = "0.75";
  status.style.fontSize = "12px";
  status.style.lineHeight = "1.4";

  const applyOptions = (models, selected) => {
    select.innerHTML = "";
    const list = Array.isArray(models) ? models.slice() : [];
    if (selected && !list.includes(selected)) {
      list.unshift(selected);
    }
    if (!list.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(暂无模型，请先填写 Key/URL 后刷新)";
      select.appendChild(opt);
      return;
    }
    for (const mid of list) {
      const opt = document.createElement("option");
      opt.value = mid;
      opt.textContent = mid;
      if (mid === selected) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
  };

  applyOptions(value ? [value] : [], value || "");

  try {
    const cached = app.extensionManager.setting.get(ID_MODEL_LIST);
    if (Array.isArray(cached) && cached.length) {
      applyOptions(cached, value || cached[0] || "");
    }
  } catch (_e) {
    /* ignore */
  }

  select.addEventListener("change", () => {
    setter(select.value || "");
  });

  refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    status.textContent = "正在请求 /v1/models …";
    try {
      const key = app.extensionManager.setting.get(ID_API_KEY) || "";
      const base = app.extensionManager.setting.get(ID_BASE_URL) || "";
      const res = await api.fetchApi("/h3_ref2va_auto/openai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, base_url: base }),
      });
      const data = await res.json();
      if (data.error) {
        status.textContent = data.error;
        applyOptions(data.models || [], select.value || value || "");
        return;
      }
      const models = data.models || [];
      const selected =
        (select.value && models.includes(select.value) && select.value) ||
        (value && models.includes(value) && value) ||
        models[0] ||
        "";
      applyOptions(models, selected);
      try {
        await app.extensionManager.setting.set(ID_MODEL_LIST, models);
      } catch (_e) {
        /* ignore cache write errors */
      }
      if (selected) {
        setter(selected);
      }
      status.textContent = `已加载 ${models.length} 个模型（节点下拉需刷新页面后同步）`;
    } catch (err) {
      status.textContent = String(err?.message || err);
    } finally {
      refresh.disabled = false;
    }
  });

  row.append(select, refresh);
  root.append(row, status);
  return root;
}

app.registerExtension({
  name: "H3Ref2VAAuto.Settings",
  settings: [
    {
      id: ID_API_KEY,
      name: "OpenAI API Key",
      type: "text",
      defaultValue: "",
      tooltip:
        "仅保存在本机 Application Settings，不会写入工作流 JSON。也可设环境变量 OPENAI_API_KEY。",
      category: [MENU, "OpenAI", "API Key"],
      attrs: {
        type: "password",
        autocomplete: "off",
        placeholder: "sk-...",
      },
    },
    {
      id: ID_BASE_URL,
      name: "OpenAI Base URL",
      type: "text",
      defaultValue: "https://api.openai.com/v1",
      tooltip:
        "OpenAI 兼容网关根地址。仅保存在本机设置，不会写入工作流。",
      category: [MENU, "OpenAI", "Base URL"],
      attrs: {
        placeholder: "https://api.openai.com/v1",
      },
    },
    {
      id: ID_MODEL,
      name: "OpenAI Model",
      type: buildModelPicker,
      defaultValue: "",
      tooltip:
        "配置 Key/URL 后点击「刷新模型列表」，从 /v1/models 拉取可选模型。节点下拉会同步使用该默认值。",
      category: [MENU, "OpenAI", "Model"],
    },
    {
      id: ID_MODEL_LIST,
      name: "OpenAI Model List Cache",
      type: "hidden",
      defaultValue: [],
    },
  ],
});

function firstUi(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function widgetByName(node, name) {
  return (node.widgets || []).find((w) => w.name === name);
}

function setWidgetValue(widget, value) {
  if (!widget || value == null) {
    return;
  }
  widget.value = value;
  if (widget.inputEl) {
    widget.inputEl.value = value;
  }
  widget.callback?.(widget.value);
}

function clearForcedEditStyles(node, widgetName) {
  const edit = widgetByName(node, widgetName);
  const el = edit?.inputEl || edit?.element;
  if (!el) {
    return;
  }
  el.style.removeProperty("min-height");
  el.style.removeProperty("height");
  el.style.removeProperty("max-height");
  el.style.resize = "none";
  el.style.boxSizing = "border-box";
}

function removeLegacyCacheWidgets(node) {
  const legacy = new Set(["last_script", "last_duration", "last_text"]);
  if (!node.widgets?.length) {
    return false;
  }
  let removed = false;
  for (let i = node.widgets.length - 1; i >= 0; i--) {
    const w = node.widgets[i];
    if (!legacy.has(w.name)) {
      continue;
    }
    try {
      w.onRemove?.();
    } catch (_e) {
      /* ignore */
    }
    if (w.element?.remove) {
      w.element.remove();
    }
    if (w.inputEl?.parentElement) {
      w.inputEl.parentElement.style.display = "none";
    }
    node.widgets.splice(i, 1);
    removed = true;
  }
  if (removed) {
    try {
      node.setSize?.(node.computeSize?.() || node.size);
    } catch (_e) {
      /* ignore */
    }
  }
  return removed;
}

function hookTextEditor(nodeType, widgetName) {
  const onNodeCreated = nodeType.prototype.onNodeCreated;
  nodeType.prototype.onNodeCreated = function () {
    const r = onNodeCreated?.apply(this, arguments);
    removeLegacyCacheWidgets(this);
    const w = Math.max(this.size?.[0] || 0, 360);
    const h = Math.max(this.size?.[1] || 0, 300);
    this.size = [w, h];
    requestAnimationFrame(() => {
      removeLegacyCacheWidgets(this);
      clearForcedEditStyles(this, widgetName);
      this.onResize?.(this.size);
      app.graph?.setDirtyCanvas?.(true, false);
    });
    return r;
  };
  const onConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function () {
    const r = onConfigure?.apply(this, arguments);
    removeLegacyCacheWidgets(this);
    requestAnimationFrame(() => {
      removeLegacyCacheWidgets(this);
      clearForcedEditStyles(this, widgetName);
      this.onResize?.(this.size);
    });
    return r;
  };
  const onExecuted = nodeType.prototype.onExecuted;
  nodeType.prototype.onExecuted = function (message) {
    onExecuted?.apply(this, arguments);
    removeLegacyCacheWidgets(this);
    const text = firstUi(message?.text);
    setWidgetValue(widgetByName(this, widgetName), text != null ? String(text) : null);
    requestAnimationFrame(() => {
      removeLegacyCacheWidgets(this);
      clearForcedEditStyles(this, widgetName);
      this.onResize?.(this.size);
      app.graph?.setDirtyCanvas?.(true, false);
    });
  };
}

app.registerExtension({
  name: "H3Ref2VAAuto.TextEditors",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === "MinimaxH3TextEdit") {
      hookTextEditor(nodeType, "text_edit");
    }
  },
});
