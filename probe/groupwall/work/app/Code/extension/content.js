// Omni Archiver content script (v8)
//
// Roblox focus build:
// - layout capture (structure only; no text)
// - links capture (opt-in via popup setting; background decides)

function isRobloxHost(hostname) {
  try {
    const h = String(hostname || "").toLowerCase();
    return h === "www.roblox.com" || h.endsWith(".roblox.com") || h.endsWith(".rbxcdn.com");
  } catch {
    return false;
  }
}

function stableClassList(el) {
  const out = [];
  const cls = (el.classList ? Array.from(el.classList) : []);
  for (const c of cls) {
    if (!c) continue;
    // skip likely random / hashed / numeric classes
    if (/[0-9]{6,}/.test(c)) continue;
    if (/[a-f0-9]{8,}/i.test(c)) continue;
    if (c.length > 48) continue;
    if (c.startsWith("css-")) continue;
    out.push(c);
    if (out.length >= 4) break;
  }
  return out;
}

function buildLayoutTree(root, maxNodes) {
  let count = 0;

  function walk(node) {
    if (!node || count >= maxNodes) return null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    count++;

    const el = node;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    const role = el.getAttribute ? (el.getAttribute("role") || null) : null;

    const obj = {
      t: tag,
      r: role,
      c: stableClassList(el),
      ch: [],
    };

    const children = el.children ? Array.from(el.children) : [];
    const maxChildren = 25;
    for (let i = 0; i < children.length && i < maxChildren; i++) {
      const child = walk(children[i]);
      if (child) obj.ch.push(child);
      if (count >= maxNodes) break;
    }
    return obj;
  }

  const start = root || document.body || document.documentElement;
  const tree = walk(start) || { t: "empty", r: null, c: [], ch: [] };
  return { tree, nodeCount: count };
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function collectLinks(maxLinks) {
  const urls = new Set();
  const add = (u) => {
    if (!u || typeof u !== "string") return;
    const t = u.trim();
    if (!t) return;
    urls.add(t);
  };

  const nodes = document.querySelectorAll("a[href], img[src], link[href], script[src], source[src], video[src], audio[src]");
  for (const n of nodes) {
    if (urls.size >= maxLinks) break;
    if (n.getAttribute) {
      add(n.getAttribute("href"));
      add(n.getAttribute("src"));
    }
  }

  const ss = document.querySelectorAll("[srcset]");
  for (const n of ss) {
    if (urls.size >= maxLinks) break;
    const v = n.getAttribute("srcset");
    if (!v) continue;
    const parts = v.split(",");
    for (const part of parts) {
      const u = part.trim().split(/\s+/)[0];
      add(u);
      if (urls.size >= maxLinks) break;
    }
  }

  return Array.from(urls);
}

async function sendLayout() {
  try {
    const { tree, nodeCount } = buildLayoutTree(document.body, 5000);
    const url = location.href;
    const captured = new Date().toISOString();
    const normForHash = `roblox\n${JSON.stringify(tree)}`;
    const hash = await sha256Hex(normForHash);

    chrome.runtime.sendMessage({
      type: "layout_capture",
      payload: {
        url,
        captured,
        hash,
        structure: {
          tree,
          nodeCount,
          title: document.title || "",
          viewport: { w: window.innerWidth, h: window.innerHeight },
        },
      },
    }, () => {});
  } catch {
    // ignore
  }
}

async function sendLinks() {
  try {
    const url = location.href;
    const captured = new Date().toISOString();
    const links = collectLinks(8000);
    chrome.runtime.sendMessage({
      type: "links_capture",
      payload: {
        url,
        captured,
        key: "roblox",
        links,
      },
    }, () => {});
  } catch {
    // ignore
  }
}

function shouldRunHere() {
  return isRobloxHost(location.hostname);
}

// Run once + re-run on SPA navigations
let lastHref = location.href;
async function tick() {
  if (!shouldRunHere()) return;
  if (location.href !== lastHref) lastHref = location.href;
  await sendLayout();
  await sendLinks();
}

if (shouldRunHere()) {
  // Manual-only in this Roblox build: keep the generic content script loaded,
  // but do not auto-send layout/link captures on page load or SPA navigation.
}
