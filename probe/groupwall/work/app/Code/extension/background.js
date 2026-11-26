// Roblox Omni Archiver (v8) - background service worker (module)
//
// Responsibilities:
// - maintain user settings
// - receive capture payloads from content scripts
// - queue + POST payloads to local ingest server
// - provide popup commands: ping, send_now, get_settings, set_settings, get_status
//
// Notes:
// - This build focuses on Roblox tables: static/hierarchy/assets/layout/misc/groups/walls/forums/events.
// - Roblox-specific normalization lives in ./roblox/roblox_bg.js

import {
  buildEnqueueForLayoutCapture,
  buildEnqueueForLinksCapture,
  buildEnqueueForRobloxRecords,
} from "./roblox/roblox_bg.js";

const DEFAULT_SETTINGS = Object.freeze({
  serverUrl: "http://127.0.0.1:8181",
  linksEnabled: false,
  assetsEnabled: false,
  assetsReencodeEnabled: true,
});

const STORAGE_KEYS = Object.freeze({
  SETTINGS: "settings",
  QUEUE: "send_queue_v2",
});

let settings = { ...DEFAULT_SETTINGS };
let sendQueue = [];
let flushing = false;

// Status for popup/debugging
const status = {
  lastOkAt: null,
  lastErrAt: null,
  lastErr: null,
  lastPingAt: null,
  lastPingOk: null,
  lastPingResult: null,
};

function nowIso() {
  return new Date().toISOString();
}

function safeBaseUrl(u) {
  return String(u || "").replace(/\/+$/, "");
}

function guessTargetAddressSpace(url) {
  // Best-effort support for Chrome Local Network Access / Private Network Access.
  // - loopback: 127.0.0.1, localhost, ::1
  // - private: RFC1918 ranges (10/8, 172.16/12, 192.168/16)
  try {
    const u = new URL(url);
    const h = (u.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") return "loopback";
    if (h.startsWith("10.")) return "private";
    if (h.startsWith("192.168.")) return "private";
    const m = h.match(/^172\.(\d+)\./);
    if (m) {
      const n = Number(m[1]);
      if (n >= 16 && n <= 31) return "private";
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchWithPna(url, options) {
  const opt = { ...options };
  opt.cache = "no-store";
  // Unknown keys are ignored by fetch implementations that don't support them.
  const tas = guessTargetAddressSpace(url);
  if (tas) opt.targetAddressSpace = tas;
  return await fetch(url, opt);
}

async function loadSettings() {
  const res = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
  if (res && res[STORAGE_KEYS.SETTINGS] && typeof res[STORAGE_KEYS.SETTINGS] === "object") {
    settings = { ...DEFAULT_SETTINGS, ...res[STORAGE_KEYS.SETTINGS] };
  } else {
    settings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(partial) {
  settings = { ...settings, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

async function loadQueue() {
  const res = await chrome.storage.local.get([STORAGE_KEYS.QUEUE]);
  const q = res?.[STORAGE_KEYS.QUEUE];
  if (Array.isArray(q)) sendQueue = q;
}

let persistTimer = null;
function schedulePersistQueue() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      const MAX_QUEUE = 800;
      if (sendQueue.length > MAX_QUEUE) sendQueue = sendQueue.slice(sendQueue.length - MAX_QUEUE);
      await chrome.storage.local.set({ [STORAGE_KEYS.QUEUE]: sendQueue });
    } catch {
      // ignore
    }
  }, 400);
}

async function postJson(path, obj) {
  const base = safeBaseUrl(settings.serverUrl);
  const url = base + path;
  const res = await fetchWithPna(url, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
  return await res.json().catch(() => ({}));
}

async function getJson(path) {
  const base = safeBaseUrl(settings.serverUrl);
  const url = base + path;
  const res = await fetchWithPna(url, { method: "GET", mode: "cors" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
  return await res.json().catch(() => ({}));
}

async function pingServer() {
  const base = safeBaseUrl(settings.serverUrl);
  const url = base + "/ping";
  const res = await fetchWithPna(url, { method: "GET", mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json().catch(() => ({}));
}

async function proxyFetchJson(url, proxyValue, headers) {
  const base = safeBaseUrl(settings.serverUrl);
  if (!base) throw new Error("server_url_not_set");
  const res = await fetchWithPna(base + "/proxy_fetch_json", {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: String(url || ""),
      proxy: String(proxyValue || "").trim(),
      headers: (headers && typeof headers === "object") ? headers : {},
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
  return await res.json().catch(() => ({ ok: false, status: 0, error: "invalid_server_json" }));
}

function enqueue(payload) {
  sendQueue.push(payload);
  schedulePersistQueue();
  flushQueueSoon();
}

let flushTimer = null;
function flushQueueSoon() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue().catch(() => {});
  }, 200);
}

async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    if (!settings.serverUrl) return;
    if (!sendQueue.length) return;

    while (sendQueue.length > 0) {
      const item = sendQueue[0];
      try {
        await postJson("/ingest", item);
        sendQueue.shift();
        schedulePersistQueue();
        status.lastOkAt = nowIso();
        status.lastErr = null;
        status.lastErrAt = null;
      } catch (e) {
        status.lastErrAt = nowIso();
        status.lastErr = String(e?.message || e);
        break; // keep item, stop; user can fix server + press Send Now
      }
    }
  } finally {
    flushing = false;
  }
}

async function init() {
  await loadSettings();
  await loadQueue();
  // Do not auto-flush queued items on startup. The user must explicitly start a
  // capture or press Send Now. This prevents requests being sent immediately
  // after reload/open.
}

chrome.runtime.onInstalled.addListener(() => {
  init().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  init().catch(() => {});
});

// best-effort init
init().catch(() => {});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const type = msg?.type;

if (type === "inject_roa_hook") {
  const tabId = sender?.tab?.id;
  if (typeof tabId !== "number") {
    sendResponse({ ok: false, error: "no_tab_id" });
    return;
  }
  (async () => {
    try {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          files: ["roblox/roblox_page_hook.js"],
        });
      } catch (e) {
        // Fallback for older Chrome builds that don't support world:'MAIN'
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["roblox/roblox_page_hook.js"],
        });
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // async
}


  if (type === "get_settings") {
    loadSettings()
      .then(() => sendResponse({ ok: true, settings }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (type === "set_settings") {
    const patch = msg?.settings || {};
    saveSettings(patch)
      .then(() => sendResponse({ ok: true, settings }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (type === "get_status") {
    sendResponse({
      ok: true,
      status: {
        ...status,
        queueLen: sendQueue.length,
        serverUrl: settings.serverUrl || "",
      },
    });
    return false;
  }

  if (type === "ping") {
    pingServer()
      .then((r) => {
        status.lastPingAt = nowIso();
        status.lastPingOk = true;
        status.lastPingResult = r;
        sendResponse({ ok: true, result: r });
      })
      .catch((e) => {
        status.lastPingAt = nowIso();
        status.lastPingOk = false;
        status.lastPingResult = null;
        sendResponse({ ok: false, error: String(e?.message || e) });
      });
    return true;
  }

  if (type === "proxy_fetch_json") {
    proxyFetchJson(msg?.url, msg?.proxyValue || msg?.proxy, msg?.headers)
      .then((result) => sendResponse(result && typeof result === "object" ? result : { ok: false, status: 0, error: "empty_proxy_result" }))
      .catch((e) => sendResponse({ ok: false, status: 0, error: String(e?.message || e) }));
    return true;
  }

  if (type === "server_post_json") {
    postJson(String(msg?.path || ""), msg?.payload && typeof msg.payload === "object" ? msg.payload : {})
      .then((result) => sendResponse(result && typeof result === "object" ? result : { ok: false, error: "empty_server_result" }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (type === "server_get_json") {
    getJson(String(msg?.path || ""))
      .then((result) => sendResponse(result && typeof result === "object" ? result : { ok: false, error: "empty_server_result" }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (type === "send_now") {
    flushQueue()
      .then(() => sendResponse({ ok: true, remaining: sendQueue.length }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e), remaining: sendQueue.length }));
    return true;
  }

  if (type === "layout_capture") {
    sendResponse({ ok: true, disabled: true });
    return false;
  }

  if (type === "links_capture") {
    const obj = buildEnqueueForLinksCapture(msg, nowIso, !!settings.linksEnabled);
    if (obj) enqueue(obj);
    sendResponse({ ok: true });
    return false;
  }

  if (type === "roblox_records" || type === "ROBLOX_RECORDS") {
    // Accept both current and legacy roblox_capture.js message shapes.
    // Current shape: {type:'roblox_records', payload:{url,captured,records,...}}
    // Legacy shape: {type:'ROBLOX_RECORDS', records:[...], url?, captured?}
    let m = msg;
    try {
      if (!m || typeof m !== "object") m = {};
      if (!m.payload || typeof m.payload !== "object") {
        const urlGuess = (m.url || (sender && sender.tab && sender.tab.url) || "");
        m = {
          type: "roblox_records",
          payload: {
            source: "roblox_capture_legacy",
            url: urlGuess,
            captured: m.captured || nowIso(),
            records: Array.isArray(m.records) ? m.records : [],
          },
        };
      }
    } catch (e) {
      // fall back to a minimal wrapper
      m = { type: "roblox_records", payload: { records: [] } };
    }

    const obj = buildEnqueueForRobloxRecords(m, nowIso);
    if (obj) enqueue(obj);
    sendResponse({ ok: true });
    return false;
  }

  sendResponse({ ok: false, error: "unknown_message" });
  return false;
});
