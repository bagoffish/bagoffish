// Roblox Omni Archiver (v8) - Roblox-specific background helpers
//
// This module contains ONLY Roblox-focused message normalization + enqueue payload shaping.
// It is imported by background.js (MV3 module service worker).

function safeUrlParts(url) {
  try {
    const u = new URL(url);
    return {
      href: u.href,
      host: u.host,
      hostname: u.hostname,
      origin: u.origin,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
    };
  } catch {
    return {
      href: String(url || ""),
      host: "",
      hostname: "",
      origin: "",
      pathname: "",
      search: "",
      hash: "",
    };
  }
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return obj[k];
  }
  return null;
}

export function isRobloxHost(hostname) {
  return typeof hostname === "string" && (hostname === "www.roblox.com" || hostname.endsWith(".roblox.com"));
}

export function isRobloxUrl(url) {
  return isRobloxHost(safeUrlParts(url).hostname);
}

export function classifyRobloxLayoutKey(url) {
  const p = safeUrlParts(url).pathname || "";
  // Coarse page types (avoid per-ID layouts)
  if (p === "/" || p.startsWith("/home")) return "Home";
  if (p.startsWith("/communities/") || p.startsWith("/groups/")) return "Communities";
  if (p.startsWith("/users/")) return "User";
  if (p.startsWith("/games/")) return "Game";
  if (p.startsWith("/catalog/")) return "Catalog";
  if (p.startsWith("/events/")) return "Event";
  if (p.startsWith("/discover")) return "Discover";
  if (p.startsWith("/search")) return "Search";
  return "Other";
}

// Accepts both v7-style and legacy content.js shapes.
export function buildEnqueueForLayoutCapture(msg, nowIso) {
  const payload = msg?.payload || {};
  const url = pick(payload, ["url", "pageUrl", "page_url"]) || "";
  if (!url || !isRobloxUrl(url)) return null;

  const captured = pick(payload, ["captured", "captured_at"]) || nowIso();
  const hash = pick(payload, ["hash", "layoutHash", "layout_hash"]) || null;

  const structure =
    pick(payload, ["structure", "layout", "tree", "layoutTree", "layout_tree"]) ||
    null;

  const layout_key = classifyRobloxLayoutKey(url);
  return {
    type: "roblox_layout",
    source: pick(payload, ["source", "src"]) || "layout_capture",
    captured,
    url,
    layout: {
      layout_key,
      hash,
      captured,
      structure,
    },
  };
}

export function buildEnqueueForRobloxRecords(msg, nowIso) {
  const payload = msg?.payload || {};
  const records = Array.isArray(payload.records) ? payload.records : [];
  if (!records.length) return null;

  const url = pick(payload, ["url", "pageUrl", "page_url"]) || "";
  if (url && !isRobloxUrl(url)) return null;

  return {
    type: "roblox_records",
    source: pick(payload, ["source", "src"]) || "roblox_capture",
    captured: pick(payload, ["captured", "captured_at"]) || nowIso(),
    url,
    records,
  };
}

export function buildEnqueueForLinksCapture(msg, nowIso, linksEnabled) {
  if (!linksEnabled) return null;
  const payload = msg?.payload || {};
  const url = pick(payload, ["url", "pageUrl", "page_url"]) || "";
  if (!url || !isRobloxUrl(url)) return null;

  const links = Array.isArray(payload.links)
    ? payload.links
    : (Array.isArray(payload.urls) ? payload.urls : []);
  if (!links.length) return null;

  const key = pick(payload, ["key", "site", "siteKey"]) || "roblox";
  return {
    type: "links_capture",
    captured: pick(payload, ["captured", "captured_at"]) || nowIso(),
    url,
    key,
    links,
  };
}
