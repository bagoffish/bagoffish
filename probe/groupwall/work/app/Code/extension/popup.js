function $(id) { return document.getElementById(id); }

async function bg(msg) {
  return await chrome.runtime.sendMessage(msg);
}

function logLine(s) {
  const el = $("log");
  const line = String(s || "").trim();
  if (!line) return;
  const ts = new Date().toISOString().replace('T',' ').replace('Z','');
  el.textContent = `${ts}  ${line}\n` + (el.textContent || "");
}

async function load() {
  const res = await bg({ type: "get_settings" });
  if (!res?.ok) {
    logLine(`get_settings failed: ${res?.error || "unknown"}`);
    return;
  }
  const s = res.settings || {};
  $("serverUrl").value = s.serverUrl || "";
  $("linksEnabled").checked = !!s.linksEnabled;
  $("assetsEnabled").checked = !!s.assetsEnabled;
  $("assetsReencodeEnabled").checked = !!s.assetsReencodeEnabled;
  await refreshStatus();
}

async function saveSettings() {
  const patch = {
    serverUrl: $("serverUrl").value.trim(),
    linksEnabled: $("linksEnabled").checked,
    assetsEnabled: $("assetsEnabled").checked,
    assetsReencodeEnabled: $("assetsReencodeEnabled").checked,
  };
  const res = await bg({ type: "set_settings", settings: patch });
  if (res?.ok) logLine("saved settings");
  else logLine(`save failed: ${res?.error || "unknown"}`);
  await refreshStatus();
}

async function ping() {
  const res = await bg({ type: "ping" });
  if (res?.ok) {
    const db = res.result?.db_path ? ` db=${res.result.db_path}` : "";
    logLine(`ping OK${db}`);
  } else {
    logLine(`ping FAILED: ${res?.error || "unknown"}`);
  }
  await refreshStatus();
}

async function sendNow() {
  const res = await bg({ type: "send_now" });
  if (res?.ok) logLine(`send_now ok (remaining=${res.remaining ?? "?"})`);
  else logLine(`send_now failed: ${res?.error || "unknown"} (remaining=${res?.remaining ?? "?"})`);
  await refreshStatus();
}

async function refreshStatus() {
  const res = await bg({ type: "get_status" });
  if (!res?.ok) return;
  const st = res.status || {};
  const parts = [];
  parts.push(`queue=${st.queueLen ?? 0}`);
  if (st.lastOkAt) parts.push(`last_ok=${st.lastOkAt}`);
  if (st.lastErrAt) parts.push(`last_err_at=${st.lastErrAt}`);
  if (st.lastErr) parts.push(`last_err=${st.lastErr}`);
  if (st.lastPingAt) parts.push(`last_ping=${st.lastPingAt} ok=${st.lastPingOk ? "1" : "0"}`);
  logLine(parts.join(" | "));
}

function pullAsset() {
  logLine("pending asset workflow is not enabled in this Roblox focus build");
  $("downloadAssetBtn").disabled = true;
}

function downloadAsset() {
  logLine("pending asset workflow is not enabled in this Roblox focus build");
}

$("pingBtn").addEventListener("click", ping);
$("saveBtn").addEventListener("click", saveSettings);
$("sendNowBtn").addEventListener("click", sendNow);
$("pullAssetBtn").addEventListener("click", pullAsset);
$("downloadAssetBtn").addEventListener("click", downloadAsset);

load().catch(() => {});
setInterval(() => { refreshStatus().catch(() => {}); }, 5000);
