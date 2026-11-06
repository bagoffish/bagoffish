import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_VERSION = "2026-11-05-cleanup-v1";

const DATA_ROOT = process.env.DATA_ROOT || "/tmp/winxp-data";
const VISITOR_COUNT_PATH = process.env.VISITOR_COUNT_PATH || path.join(DATA_ROOT, "visitor-count-v2.json");

const allowedOrigins = [
  "https://bagof.fish",
  "https://www.bagof.fish",
  "https://bagoffish.github.io",
  "https://winxp-7yes.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

function setCors(req, res) {
  // This API is intentionally public and does not use cookie-based auth.
  // A wildcard avoids browser CORS failures even on JSON-parser errors, 404s,
  // provider failures, and preflight requests—not only successful chat replies.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, X-Requested-With, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

app.use((req, res, next) => {
  setCors(req, res);
  res.setHeader("X-WinXP-Backend", BACKEND_VERSION);
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// CORS headers and OPTIONS preflight are handled by the middleware above.


app.use((err, req, res, next) => {
  setCors(req, res);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal error" });
});

app.use(express.json({ limit: "18mb" }));

app.get("/", (req, res) => {
  res.type("text").send("ok");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "winxp-7yes",
    version: BACKEND_VERSION,
    rendererCache: RENDERER_CACHE_TOKEN && RENDERER_CACHE_REPO ? "github" : "memory",
    visitorStore: RENDERER_CACHE_TOKEN && RENDERER_CACHE_REPO ? "github" : "disk",
  });
});

const VISITOR_GITHUB_PATH = "site/visitor-count.json";
let visitorCountQueue = Promise.resolve();
let memoryVisitorCount = 0;
const memoryVisitorIds = new Set();
let visitorHydrated = false;
let visitorGithubSha = "";

function parseVisitorCookie(req) {
  const raw = String(req.headers.cookie || "");
  const match = raw.match(/(?:^|;\s*)bagof-fish-visitor=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function rememberVisitorState(count, visitors, sha) {
  memoryVisitorCount = count;
  memoryVisitorIds.clear();
  for (const id of visitors) memoryVisitorIds.add(String(id));
  if (sha !== undefined) visitorGithubSha = sha || "";
  visitorHydrated = true;
  return { count: memoryVisitorCount, seen: memoryVisitorIds };
}

async function readVisitorDisk() {
  try {
    const raw = await fs.promises.readFile(VISITOR_COUNT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const count = Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : 0;
    const visitors = Array.isArray(parsed.visitors) ? parsed.visitors.map(String) : [];
    return { count, visitors };
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("Visitor counter disk read failed:", err.message);
    return { count: 0, visitors: [] };
  }
}

async function writeVisitorDisk(count, visitors) {
  try {
    await fs.promises.mkdir(path.dirname(VISITOR_COUNT_PATH), { recursive: true });
    await fs.promises.writeFile(VISITOR_COUNT_PATH, JSON.stringify({ count, visitors }), "utf8");
  } catch (err) {
    console.warn("Visitor counter disk write failed:", err.message);
  }
}

async function getVisitorState() {
  if (visitorHydrated) return { count: memoryVisitorCount, seen: memoryVisitorIds };
  if (rendererCacheEnabled()) {
    try {
      const file = await rendererGhGet(VISITOR_GITHUB_PATH);
      if (file) {
        const parsed = JSON.parse(file.bytes.toString("utf8"));
        const count = Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : 0;
        const visitors = Array.isArray(parsed.visitors) ? parsed.visitors.map(String).slice(-100000) : [];
        return rememberVisitorState(count, visitors, file.sha);
      }
    } catch (err) {
      console.warn("Visitor counter GitHub read failed; using local fallback:", err.message);
    }
  }
  const disk = await readVisitorDisk();
  return rememberVisitorState(disk.count, disk.visitors, "");
}

async function persistVisitorState(count, visitors) {
  const body = Buffer.from(JSON.stringify({ count, visitors }));
  if (rendererCacheEnabled()) {
    try {
      visitorGithubSha = await rendererGhPut(
        VISITOR_GITHUB_PATH,
        body,
        "Save visitor count",
        visitorGithubSha
      ) || visitorGithubSha;
    } catch (err) {
      // Keep the counter usable even if GitHub persistence is temporarily unavailable.
      console.warn("Visitor counter GitHub save failed; using local fallback:", err.message);
    }
  }
  await writeVisitorDisk(count, visitors);
}

function enqueueVisitorJob(job) {
  const pending = visitorCountQueue.catch(() => {}).then(job);
  visitorCountQueue = pending;
  return pending;
}

app.get("/visitor-count/current", async (req, res) => {
  try {
    const { count } = await enqueueVisitorJob(() => getVisitorState());
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ count });
  } catch (err) {
    console.warn("Visitor counter read failed:", err.message);
    res.status(500).json({ error: "Visitor counter unavailable" });
  }
});

app.get("/visitor-count/visit", async (req, res) => {
  const visitorId = String(req.query.visitor || req.headers["x-visitor-id"] || parseVisitorCookie(req) || "").trim();
  if (!visitorId || visitorId.length > 200) return res.status(400).json({ error: "Visitor cookie required" });
  try {
    const count = await enqueueVisitorJob(async () => {
      const { seen } = await getVisitorState();
      if (seen.has(visitorId)) return memoryVisitorCount;
      const visitors = Array.from(seen);
      visitors.push(visitorId);
      const trimmed = visitors.slice(-100000);
      const nextCount = memoryVisitorCount + 1;
      await persistVisitorState(nextCount, trimmed);
      rememberVisitorState(nextCount, trimmed, visitorGithubSha);
      return nextCount;
    });
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ count });
  } catch (err) {
    console.warn("Visitor counter save failed:", err.message);
    res.status(500).json({ error: "Visitor counter unavailable" });
  }
});

/* ---------- Roblox renderer (saved lookups) ---------- */
const RENDERER_PUBLIC_BASE = process.env.RENDERER_PUBLIC_URL || "https://fossils.onrender.com";
const RENDERER_CACHE_REPO = process.env.RENDERER_CACHE_REPO || "";
const RENDERER_CACHE_TOKEN = process.env.RENDERER_CACHE_GITHUB_TOKEN || "";
const RENDERER_CACHE_BRANCH = process.env.RENDERER_CACHE_BRANCH || "main";
const RENDERER_REFRESH_MS = 12 * 60 * 60 * 1000;
const ROBLOX_UA = { "User-Agent": "WinXP Renderer/1.0", "Accept": "application/json" };

const rendererById = new Map();
const rendererByName = new Map();
let rendererWriteQueue = Promise.resolve();

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function rendererCacheEnabled() {
  return Boolean(RENDERER_CACHE_TOKEN && RENDERER_CACHE_REPO);
}

function rendererGhHeaders() {
  return {
    Authorization: `Bearer ${RENDERER_CACHE_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "winxp-renderer-cache",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function rendererNameKey(username) {
  const key = String(username || "").trim().toLowerCase();
  return /^[a-z0-9_]{1,32}$/.test(key) ? key : "";
}

function rememberRenderer(record) {
  if (!record || !record.id) return record;
  rendererById.set(String(record.id), record);
  const key = rendererNameKey(record.username);
  if (key) rendererByName.set(key, String(record.id));
  for (const name of record.pastUsernames || []) {
    const pastKey = rendererNameKey(name);
    if (pastKey && !rendererByName.has(pastKey)) rendererByName.set(pastKey, String(record.id));
  }
  return record;
}

function rendererJson(record) {
  return {
    id: String(record.id),
    username: record.username,
    displayName: record.displayName,
    joinDate: record.joinDate,
    pastUsernames: record.pastUsernames || [],
    rolimons: record.rolimons || {},
    refreshedAt: record.refreshedAt || 0,
    savedAt: record.savedAt || 0,
  };
}

function rendererPayload(record, liveAvatarUrl) {
  // Always show the live Roblox thumbnail. Saved PNGs are history only.
  const thumbnailSource = liveAvatarUrl ||
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(String(record.id))}&size=180x180&format=Png`;
  const avatarUrl = `${RENDERER_PUBLIC_BASE}/proxy-roblox-avatar?url=${encodeURIComponent(thumbnailSource)}`;
  return {
    roblox: {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      joinDate: record.joinDate || "Unknown",
      avatarUrl,
            pastUsernames: record.pastUsernames || [],
    },
    rolimons: record.rolimons || {},
    detailsPending: false,
  };
}

function rendererDetailsPayload(record) {
  return {
    pastUsernames: record.pastUsernames || [],
    rolimons: record.rolimons || {},
      };
}

async function rendererGhGet(filePath) {
  if (!rendererCacheEnabled()) return null;
  const url = `https://api.github.com/repos/${RENDERER_CACHE_REPO}/contents/${filePath}?ref=${encodeURIComponent(RENDERER_CACHE_BRANCH)}`;
  const res = await fetch(url, { headers: rendererGhHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("renderer cache read " + res.status);
  const body = await res.json();
  const bytes = Buffer.from(body.content || "", "base64");
  return { sha: body.sha, bytes };
}

async function rendererGhGetRaw(filePath) {
  if (!rendererCacheEnabled()) return null;
  const url = `https://api.github.com/repos/${RENDERER_CACHE_REPO}/contents/${filePath}?ref=${encodeURIComponent(RENDERER_CACHE_BRANCH)}`;
  const res = await fetch(url, {
    headers: { ...rendererGhHeaders(), Accept: "application/vnd.github.raw" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("renderer cache raw " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

async function rendererGhPut(filePath, bytes, message, sha, attempt = 0) {
  const url = `https://api.github.com/repos/${RENDERER_CACHE_REPO}/contents/${filePath}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...rendererGhHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(bytes).toString("base64"),
      branch: RENDERER_CACHE_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if ((res.status === 409 || res.status === 422) && attempt < 1) {
    const current = await rendererGhGet(filePath);
    if (current) return rendererGhPut(filePath, bytes, message, current.sha, attempt + 1);
  }
  if (!res.ok) throw new Error("renderer cache write " + res.status);
  const body = await res.json();
  return body.content?.sha || sha || "";
}

function enqueueRendererWrite(job) {
  // Keep the queue alive after a failed write, but return the individual job's
  // rejection to its caller so the renderer can fall back to the live Roblox URL.
  const pending = rendererWriteQueue.catch(() => {}).then(job);
  rendererWriteQueue = pending.catch((err) => {
    console.warn("renderer cache write failed:", err.message);
  });
  return pending;
}

async function loadStoredRendererById(id) {
  const key = String(id || "");
  if (rendererById.has(key)) return rendererById.get(key);
  const file = await rendererGhGet(`users/${key}.json`);
  if (!file) return null;
  const record = JSON.parse(file.bytes.toString("utf8"));
  record._jsonSha = file.sha;
  return rememberRenderer(record);
}

async function loadStoredRendererByName(username) {
  const key = rendererNameKey(username);
  if (!key) return null;
  if (rendererByName.has(key)) return loadStoredRendererById(rendererByName.get(key));
  const file = await rendererGhGet(`names/${key}.txt`);
  if (!file) return null;
  const id = file.bytes.toString("utf8").trim();
  if (!/^\d+$/.test(id)) return null;
  rendererByName.set(key, id);
  return loadStoredRendererById(id);
}

async function saveRendererRecord(record, png) {
  if (!rendererCacheEnabled()) {
    rememberRenderer(record);
    return false;
  }

  const id = String(record.id);
  const json = Buffer.from(JSON.stringify(rendererJson(record), null, 2));
  record._jsonSha = await rendererGhPut(
    `users/${id}.json`,
    json,
    `Save renderer lookup ${record.username || id}`,
    record._jsonSha
  );
  const names = new Set([record.username, ...(record.pastUsernames || [])]);
  for (const name of names) {
    const key = rendererNameKey(name);
    if (!key) continue;
    const existing = await rendererGhGet(`names/${key}.txt`).catch(() => null);
    const current = existing ? existing.bytes.toString("utf8").trim() : "";
    if (current === id) {
      rendererByName.set(key, id);
      continue;
    }
    await rendererGhPut(`names/${key}.txt`, Buffer.from(id), `Index renderer name ${key}`, existing?.sha);
    rendererByName.set(key, id);
  }
  record.savedAt = Date.now();
  rememberRenderer(record);
  return true;
}

async function fetchRobloxProfile(username) {
  const userRes = await fetchWithTimeout("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { ...ROBLOX_UA, "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  if (!userRes.ok) throw new Error("Roblox username HTTP " + userRes.status);
  const userJson = await userRes.json();
  const id = userJson?.data?.[0]?.id;
  if (!id) return null;
  const [profileRes, headshotRes] = await Promise.all([
    fetchWithTimeout(`https://users.roblox.com/v1/users/${id}`, { headers: ROBLOX_UA }),
    fetchWithTimeout(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png`,
      { headers: ROBLOX_UA }
    ),
  ]);
  if (!profileRes.ok) throw new Error("Roblox profile HTTP " + profileRes.status);
  const profile = await profileRes.json();
  return {
    id: String(profile.id || id),
    username: profile.name,
    displayName: profile.displayName,
    joinDate: profile.created
      ? new Date(profile.created).toUTCString().replace(" GMT", "")
      : "Unknown",
    liveAvatarUrl: headshotRes && headshotRes.ok ? (await headshotRes.json())?.data?.[0]?.imageUrl || "" : "",
  };
}

const robloxUsernameHistoryCache = new Map();
const ROBLOX_USERNAME_HISTORY_CACHE_MS = 60 * 60 * 1000;

async function fetchRobloxUsernameHistory(id) {
  const cacheKey = String(id);
  const cached = robloxUsernameHistoryCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ROBLOX_USERNAME_HISTORY_CACHE_MS) {
    return cached.names;
  }

  const baseUrl = `https://users.roblox.com/v1/users/${encodeURIComponent(cacheKey)}/username-history`;
  let response = await fetchWithTimeout(
    `${baseUrl}?limit=100&sortOrder=Asc`,
    { headers: ROBLOX_UA },
    10000
  ).catch(() => null);

  // Roblox has intermittently returned HTTP 429 for requests containing
  // the limit parameter. Retry the official endpoint without query parameters.
  if (!response || response.status === 429) {
    response = await fetchWithTimeout(baseUrl, { headers: ROBLOX_UA }, 10000).catch(() => null);
  }

  if (!response || !response.ok) {
    console.warn(
      `Roblox username-history request failed for user ${cacheKey}: ${response ? response.status : "network error"}`
    );
    return cached?.names || [];
  }

  try {
    const history = await response.json();
    if (!Array.isArray(history.data)) {
      console.warn(`Roblox username-history response had no data array for user ${cacheKey}`);
      return cached?.names || [];
    }
    const names = [...new Set(history.data
      .map(entry => String(entry?.name || "").trim())
      .filter(Boolean))];
    robloxUsernameHistoryCache.set(cacheKey, { names, fetchedAt: Date.now() });
    return names;
  } catch (err) {
    console.warn(`Could not parse Roblox username-history for user ${cacheKey}:`, err.message);
    return cached?.names || [];
  }
}

async function fetchRobloxDetails(id) {
  const [userRes, pastUsernames, roliRes] = await Promise.all([
    fetchWithTimeout(`https://users.roblox.com/v1/users/${id}`, { headers: ROBLOX_UA }).catch(() => null),
    fetchRobloxUsernameHistory(id),
    fetchWithTimeout(`https://api.rolimons.com/players/v1/playerinfo/${id}`, { headers: ROBLOX_UA }, 6000).catch(() => null),
  ]);
  let rolimons = {};
  if (roliRes && roliRes.ok) {
    try {
      const body = await roliRes.json();
      rolimons = {
        rap: body.rap ?? "Unknown",
        value: body.value ?? "Unknown",
        terminated: !!body.terminated,
        lastOnline: body.last_online
          ? new Date(body.last_online * 1000).toUTCString().replace(" GMT", "")
          : "Unknown",
      };
    } catch {}
  }
  return { pastUsernames, rolimons };
}


async function refreshRendererRecord(record) {
  if (!record || record._refreshing) return;
  if (Date.now() - (record.refreshedAt || 0) < RENDERER_REFRESH_MS) return;
  record._refreshing = true;
  try {
    const details = await fetchRobloxDetails(record.id);
    record.pastUsernames = details.pastUsernames.length ? details.pastUsernames : (record.pastUsernames || []);
    record.rolimons = Object.keys(details.rolimons).length ? details.rolimons : (record.rolimons || {});
    const profileRes = await fetchWithTimeout(`https://users.roblox.com/v1/users/${record.id}`, { headers: ROBLOX_UA }).catch(() => null);
    let liveAvatarUrl = "";
    if (profileRes && profileRes.ok) {
      const profile = await profileRes.json();
      record.username = profile.name || record.username;
      record.displayName = profile.displayName || record.displayName;
    }
    const avatarRes = await fetchWithTimeout(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${record.id}&size=180x180&format=Png`,
      { headers: ROBLOX_UA }
    ).catch(() => null);
    if (avatarRes && avatarRes.ok) {
      const body = await avatarRes.json();
      liveAvatarUrl = body?.data?.[0]?.imageUrl || "";
    }
        record.refreshedAt = Date.now();
    rememberRenderer(record);
    await enqueueRendererWrite(() => saveRendererRecord(record, null));
  } catch (err) {
    console.warn("renderer refresh failed:", err.message);
  } finally {
    record._refreshing = false;
  }
}

app.get("/proxy-roblox", async (req, res) => {
  setCors(req, res);
  const username = String(req.query.username || "").trim();
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    const stored = await loadStoredRendererByName(username).catch((err) => {
      console.warn("renderer cache read failed:", err.message);
      return null;
    });
    if (stored) {
      // Cached profile details are enough to render immediately. Refresh Roblox,
      // username history, Rolimons, and GitHub persistence off the request path.
      // This avoids making every repeat lookup wait on several APIs and GitHub writes.
      res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
      res.json(rendererPayload(stored, ""));
      if (!stored._refreshing) {
        stored._refreshing = true;
        Promise.all([
          fetchRobloxProfile(username).catch(() => null),
          fetchRobloxDetails(stored.id).catch(() => null),
        ]).then(async ([live, details]) => {
          if (live) {
            stored.username = live.username || stored.username;
            stored.displayName = live.displayName || stored.displayName;
            stored.joinDate = live.joinDate || stored.joinDate;
          }
          if (details) {
            if (details.pastUsernames.length) stored.pastUsernames = details.pastUsernames;
            if (Object.keys(details.rolimons).length) stored.rolimons = details.rolimons;
          }
          stored.refreshedAt = Date.now();
          await enqueueRendererWrite(() => saveRendererRecord(stored, null)).catch((err) => {
            console.warn("renderer background refresh save failed:", err.message);
          });
        }).catch((err) => {
          console.warn("renderer background refresh failed:", err.message);
        }).finally(() => { stored._refreshing = false; });
      }
      return;
    }

    const profile = await fetchRobloxProfile(username);
    if (!profile) return res.status(404).json({ error: "Not found" });
    const details = await fetchRobloxDetails(profile.id);
    const record = rememberRenderer({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      joinDate: profile.joinDate,
      pastUsernames: details.pastUsernames,
      rolimons: details.rolimons,
      refreshedAt: Date.now(),
      savedAt: 0,
    });
    let saved = false;
    try {
      saved = await enqueueRendererWrite(() => saveRendererRecord(record, null));
    } catch (err) {
      console.warn("renderer cache write failed:", err.message);
    }
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(rendererPayload(record, profile.liveAvatarUrl));
  } catch (err) {
    console.error("proxy-roblox error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/proxy-roblox-details", async (req, res) => {
  setCors(req, res);
  const id = String(req.query.userId || "").trim();
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "User ID required" });

  try {
    const stored = await loadStoredRendererById(id).catch((err) => {
      console.warn("renderer cache read failed:", err.message);
      return null;
    });
    if (stored) {
      res.setHeader("Cache-Control", "private, max-age=60");
      res.json(rendererDetailsPayload(stored));
      refreshRendererRecord(stored);
      return;
    }

    const details = await fetchRobloxDetails(id);
    const record = rememberRenderer({
      id,
      username: "",
      displayName: "",
      joinDate: "Unknown",
      pastUsernames: details.pastUsernames,
      rolimons: details.rolimons,
      refreshedAt: Date.now(),
      savedAt: 0,
    });
    enqueueRendererWrite(() => saveRendererRecord(record, null)).catch(() => {});
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(rendererDetailsPayload(record));
  } catch (err) {
    console.error("proxy-roblox-details error:", err);
    res.status(500).json({ error: "Details unavailable" });
  }
});

const archivedAvatarCache = new Map();
const ARCHIVED_AVATAR_CACHE_LIMIT = 300;

app.get("/proxy-roblox-avatar", async (req, res) => {
  setCors(req, res);
  const source = String(req.query.url || "").trim();
  if (!source) return res.status(400).end();

  let parsed;
  try { parsed = new URL(source); } catch { return res.status(400).end(); }
  if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).end();

  // Only proxy expected Roblox/Wayback image hosts, not arbitrary URLs.
  const host = parsed.hostname.toLowerCase();
  const allowed = host === "web.archive.org" ||
    host === "wayback.archive-it.org" ||
    host === "roblox.com" || host.endsWith(".roblox.com") ||
    host === "rbxcdn.com" || host.endsWith(".rbxcdn.com");
  if (!allowed) return res.status(400).end();

  const cacheKey = parsed.toString();
  const cached = archivedAvatarCache.get(cacheKey);
  if (cached) {
    res.setHeader("Content-Type", cached.type);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.send(cached.body);
  }

  // Try the exact replay, a non-im_ replay, then Wayback's closest available capture.
  const candidates = [parsed.toString()];
  let archiveOriginalUrl = '';
  let archiveTimestamp = '';
  if (parsed.hostname.toLowerCase() === 'web.archive.org' && parsed.pathname.startsWith('/web/')) {
    const rest = parsed.pathname.slice(5);
    const match = rest.match(/^(\d{8,14})(?:id_|im_|if_|js_|cs_|oe_|mp_)?\/(https?:\/.*)$/i);
    if (match) {
      archiveTimestamp = match[1];
      // URL parsing moves the original Roblox API query (userIds, size, format,
      // etc.) into parsed.search. Keep it attached to the original URL; dropping
      // it makes archived thumbnail API requests return errors and every card
      // becomes "unavailable".
      archiveOriginalUrl = match[2] + parsed.search;
      const withoutModifier = parsed.origin + '/web/' + archiveTimestamp + '/' + archiveOriginalUrl;
      const withImageModifier = parsed.origin + '/web/' + archiveTimestamp + 'im_/' + archiveOriginalUrl;
      const withIdModifier = parsed.origin + '/web/' + archiveTimestamp + 'id_/' + archiveOriginalUrl;
      for (const candidate of [withImageModifier, withoutModifier, withIdModifier]) {
        if (!candidates.includes(candidate)) candidates.push(candidate);
      }
    }
  }

  // Avoid a Wayback availability API round-trip before every image. Exact replay
  // variants are tried directly below; the slower availability lookup is reserved
  // for thumbnail-API JSON responses where the actual CDN image must be resolved.

  // Thumbnail-index rows can point to Roblox's avatar thumbnail API itself.
  // If Wayback has no usable replay of that API response, try the live API as
  // a resolver; its imageUrl is still replayed through Wayback at the historical
  // timestamp before the live CDN URL is considered.
  if (archiveOriginalUrl && archiveTimestamp) {
    try {
      const original = new URL(archiveOriginalUrl);
      if (original.hostname.toLowerCase() === "thumbnails.roblox.com" &&
          /^\/v1\/users\/avatar(?:[-/]|$)/i.test(original.pathname) &&
          !candidates.includes(archiveOriginalUrl)) {
        candidates.push(archiveOriginalUrl);
      }
    } catch (_) {}
  }

  for (const candidate of candidates) {
    try {
      let upstream = await fetchWithTimeout(candidate, {
        headers: { "User-Agent": "WinXP Renderer/1.0", "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,application/json,*/*;q=0.8" },
      }, 12000);
      if (!upstream.ok || !upstream.body) continue;

      let type = (upstream.headers.get("content-type") || "").toLowerCase();
      // Some index entries point to Roblox's thumbnail API, which returns JSON
      // containing the actual CDN imageUrl instead of returning image bytes.
      // Resolve that URL before deciding the archive capture is unusable.
      if (!type.startsWith("image/") && (type.includes("json") || /thumbnails\.roblox\.com\/v1\/users\/avatar/i.test(candidate))) {
        let payload = null;
        try { payload = await upstream.json(); } catch (_) {}
        const rows = payload && Array.isArray(payload.data) ? payload.data : [];
        const imageUrl = rows.map((row) => row && row.imageUrl).find((url) => typeof url === "string" && /^https?:\/\//i.test(url));
        if (!imageUrl) continue;
        let imageHost;
        try { imageHost = new URL(imageUrl).hostname.toLowerCase(); } catch (_) { continue; }
        const imageHostAllowed = imageHost === "roblox.com" || imageHost.endsWith(".roblox.com") ||
          imageHost === "rbxcdn.com" || imageHost.endsWith(".rbxcdn.com") ||
          imageHost === "web.archive.org" || imageHost === "wayback.archive-it.org";
        if (!imageHostAllowed) continue;
        // If the archived thumbnail API response contains a CDN URL, first
        // replay that CDN URL through Wayback at the same capture timestamp.
        // Fetching only the live CDN URL loses historical images when the old
        // CDN asset has since been removed.
        const imageCandidates = [];
        if (archiveTimestamp) {
          // First try the exact capture date, then ask Wayback for the nearest
          // saved copy of the actual CDN asset. The thumbnail API capture date
          // and the CDN asset capture date often differ.
          imageCandidates.push(`https://web.archive.org/web/${archiveTimestamp}im_/${imageUrl}`);
          // Try the exact archived CDN URL first. Only pay for Wayback's
          // availability lookup if that exact replay misses.
          let resolvedImage = false;
          let exactReplayWorked = false;
          try {
            const exact = await fetchWithTimeout(imageCandidates[0], {
              headers: { "User-Agent": "WinXP Renderer/1.0", "Accept": "image/*,*/*;q=0.8" },
              redirect: "follow",
            }, 5000);
            const exactType = (exact.headers.get("content-type") || "").toLowerCase();
            if (exact.ok && exact.body && exactType.startsWith("image/")) {
              upstream = exact;
              type = exactType;
              resolvedImage = true;
              exactReplayWorked = true;
            }
          } catch (_) {}
          if (!exactReplayWorked) {
            try {
              const imageAvailabilityUrl = "https://archive.org/wayback/available?url=" +
                encodeURIComponent(imageUrl) + "&timestamp=" + encodeURIComponent(archiveTimestamp);
              const imageAvailability = await fetchWithTimeout(imageAvailabilityUrl, {
                headers: { "User-Agent": "WinXP Renderer/1.0", "Accept": "application/json" },
              }, 3000);
              if (imageAvailability.ok) {
                const availabilityData = await imageAvailability.json();
                const closestImage = availabilityData && availabilityData.archived_snapshots && availabilityData.archived_snapshots.closest;
                if (closestImage && closestImage.available && typeof closestImage.url === "string") {
                  const closestParsed = new URL(closestImage.url);
                  if (closestParsed.hostname.toLowerCase() === "web.archive.org" && closestParsed.pathname.startsWith("/web/")) {
                    const closestReplay = closestParsed.origin + closestParsed.pathname.replace(/^\/web\/(\d{8,14})(?:id_|im_|if_|js_|cs_|oe_|mp_)?\//i, "/web/$1im_/") + closestParsed.search;
                    imageCandidates.push(closestReplay, closestImage.url);
                  }
                }
              }
            } catch (_) {}
          }
        }
        imageCandidates.push(imageUrl);
        for (const imageCandidate of (resolvedImage ? [] : [...new Set(imageCandidates)])) {
          try {
            const imageResponse = await fetchWithTimeout(imageCandidate, {
              headers: { "User-Agent": "WinXP Renderer/1.0", "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
              redirect: "follow",
            }, 12000);
            const imageType = (imageResponse.headers.get("content-type") || "").toLowerCase();
            if (imageResponse.ok && imageResponse.body && imageType.startsWith("image/")) {
              upstream = imageResponse;
              type = imageType;
              resolvedImage = true;
              break;
            }
          } catch (_) {}
        }
        if (!resolvedImage) continue;
      }
      if (!type.startsWith("image/")) continue;
      const body = Buffer.from(await upstream.arrayBuffer());
      if (!body.length) continue;
      const normalizedType = type.includes("png") ? "image/png" :
        (type.includes("jpeg") || type.includes("jpg")) ? "image/jpeg" :
        type.includes("gif") ? "image/gif" :
        type.includes("webp") ? "image/webp" : type.split(";")[0];

      archivedAvatarCache.set(cacheKey, { body, type: normalizedType });
      if (archivedAvatarCache.size > ARCHIVED_AVATAR_CACHE_LIMIT) {
        archivedAvatarCache.delete(archivedAvatarCache.keys().next().value);
      }
      res.setHeader("Content-Type", normalizedType);
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      return res.send(body);
    } catch (_) {
      // Try the alternate Wayback replay URL, if available.
    }
  }

  // Do not cache failures; a later request may succeed when the archive recovers.
  // 204 keeps expected missing historical captures from flooding the browser console
  // with 404s. Image elements still fire their error event, so the renderer removes
  // the unavailable capture card instead of displaying a broken-image tile.
  res.setHeader("Cache-Control", "no-store");
  return res.status(204).end();
});


// Historical avatar renders via Wayback CDX (no pre-scraped files).
const waybackCache = new Map();
const WAYBACK_TTL = 6 * 60 * 60 * 1000;

const AVATAR_HISTORY_RELEASE_BASE = process.env.AVATAR_HISTORY_RELEASE_BASE || "https://github.com/bagoffish/bagoffish.github.io/releases/download/avatar-history-v1";
const FULL_THUMBNAIL_INDEX_RELEASE_BASE = process.env.FULL_THUMBNAIL_INDEX_RELEASE_BASE || "https://github.com/bagoffish/bagoffish/releases/download/thumbnail-index-full-v2";
const AVATAR_HISTORY_SHARD_COUNT = 256;
const AVATAR_HISTORY_INDEX_VERSION = "20261012-thumbnail-index-full-v3";
const avatarHistoryShardCache = new Map();
const AVATAR_HISTORY_SHARD_CACHE_LIMIT = 24;

async function loadAvatarHistoryShard(releaseBase, shardName) {
  const cacheKey = releaseBase + "/" + shardName + "?" + AVATAR_HISTORY_INDEX_VERSION;
  let contents = avatarHistoryShardCache.get(cacheKey);
  if (typeof contents === "string") {
    avatarHistoryShardCache.delete(cacheKey);
    avatarHistoryShardCache.set(cacheKey, contents);
    return contents;
  }

  const response = await fetchWithTimeout(`${releaseBase}/${shardName}?v=${AVATAR_HISTORY_INDEX_VERSION}`, {
    headers: { "User-Agent": "WinXP-Renderer/1.0", "Accept": "application/octet-stream" },
  }, 30000);
  if (!response.ok) return null;

  const compressed = Buffer.from(await response.arrayBuffer());
  contents = gunzipSync(compressed).toString("utf8");
  avatarHistoryShardCache.set(cacheKey, contents);
  while (avatarHistoryShardCache.size > AVATAR_HISTORY_SHARD_CACHE_LIMIT) {
    const oldestKey = avatarHistoryShardCache.keys().next().value;
    if (!oldestKey) break;
    avatarHistoryShardCache.delete(oldestKey);
  }
  return contents;
}

function parseAvatarHistoryShard(contents, userId, source) {
  const images = [];
  if (typeof contents !== "string") return images;
  for (const line of contents.split(/\r?\n/)) {
    if (!line) continue;
    const firstTab = line.indexOf("\t");
    if (firstTab < 0 || line.slice(0, firstTab) !== userId) continue;
    const secondTab = line.indexOf("\t", firstTab + 1);
    if (secondTab < 0) continue;
    const timestamp = line.slice(firstTab + 1, secondTab).trim();
    const originalUrl = line.slice(secondTab + 1).trim();
    if (!/^\d{8,14}$/.test(timestamp)) continue;
    if (!/^https?:\/\//i.test(originalUrl)) continue;
    images.push({
      url: `https://web.archive.org/web/${timestamp}im_/${originalUrl}`,
      timestamp,
      source,
    });
  }
  return images;
}

app.get("/proxy-roblox-history-index", async (req, res) => {
  setCors(req, res);
  const userId = String(req.query.userId || "").trim();
  if (!/^\d+$/.test(userId)) return res.status(400).json({ error: "User ID required" });

  try {
    const shardNumber = Number(BigInt(userId) % BigInt(AVATAR_HISTORY_SHARD_COUNT));
    const fullShardName = `full-s${shardNumber}.txt.gz`;
    let fullContents = null;
    let fullError = null;
    let oldContents = null;
    let oldError = null;

    const oldShardName = `s${shardNumber}.txt.gz`;
    // Fetch the two immutable compressed shards concurrently; serial downloads
    // made a cold history lookup pay both network latencies one after another.
    const shardResults = await Promise.allSettled([
      loadAvatarHistoryShard(FULL_THUMBNAIL_INDEX_RELEASE_BASE, fullShardName),
      loadAvatarHistoryShard(AVATAR_HISTORY_RELEASE_BASE, oldShardName),
    ]);
    if (shardResults[0].status === "fulfilled") fullContents = shardResults[0].value;
    else {
      fullError = shardResults[0].reason;
      console.warn("Full thumbnail index shard unavailable:", fullError && fullError.message ? fullError.message : fullError);
    }
    if (shardResults[1].status === "fulfilled") oldContents = shardResults[1].value;
    else {
      oldError = shardResults[1].reason;
      if (fullError) console.warn("Legacy avatar history shard also failed:", oldError && oldError.message ? oldError.message : oldError);
    }

    // Keep both sources merged until the full index passes validation.
    let images = parseAvatarHistoryShard(fullContents, userId, "full-thumbnail-index");
    images.push(...parseAvatarHistoryShard(oldContents, userId, "avatar-history-index"));

    const parsedEntryCount = images.length;
    const seen = new Set();
    images = images.filter((image) => {
      const key = image.timestamp + "|" + image.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    images.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      images,
      indexed: true,
      shard: fullContents !== null ? fullShardName + " + " + oldShardName : oldShardName,
      source: images.some((image) => image.source === "full-thumbnail-index") ? "merged-indexes" : "legacy-fallback",
      diagnostics: {
        userId,
        fullShardLoaded: fullContents !== null,
        legacyShardLoaded: oldContents !== null,
        fullShardError: fullError ? String(fullError.message || fullError) : null,
        legacyShardError: oldError ? String(oldError.message || oldError) : null,
        parsedEntryCount,
        returnedEntryCount: images.length,
        duplicateEntriesRemoved: parsedEntryCount - images.length,
        indexCompleteForUser: fullContents !== null && oldContents !== null,
        missingShardCount: Number(fullContents === null) + Number(oldContents === null),
        missingShards: [
          ...(fullContents === null ? [fullShardName] : []),
          ...(oldContents === null ? [oldShardName] : [])
        ],
        note: "Missing shards are reported explicitly. Exact missing source records can only be counted by comparing this user's rows with the original source dataset."
      },
    });
  } catch (error) {
    console.error("Avatar history index lookup failed:", error && error.message ? error.message : error);
    return res.status(502).json({ error: "Avatar history index lookup failed" });
  }
});

app.get("/proxy-roblox-archived", async (req, res) => {
  setCors(req, res);
  const userId = String(req.query.userId || "").trim();
  if (!/^\d+$/.test(userId)) return res.status(400).json({ error: "User ID required" });

  const cached = waybackCache.get(userId);
  if (cached && Date.now() - cached.at < WAYBACK_TTL) {
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json({ images: cached.images });
  }

  const patterns = [
    `https://www.roblox.com/users/${userId}/profile`,
    `http://www.roblox.com/User.aspx?ID=${userId}`,
  ];

  // Run CDX searches together, then replay archived profile captures concurrently.
  // The previous nested loops fetched captures one-by-one and made cold lookups stall.
  const imageMap = new Map();
  const replayJobs = [];
  const requestHeaders = { "User-Agent": "WinXP-Renderer/1.0" };
  const cdxResults = await Promise.all(patterns.map(async (original) => {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(original)}&output=json&fl=timestamp,original&filter=statuscode:200&collapse=timestamp:8&limit=40`;
    try {
      const response = await fetchWithTimeout(cdx, { headers: requestHeaders }, 12000);
      if (!response.ok) return [];
      const rows = await response.json();
      return Array.isArray(rows) ? rows.slice(1, 25) : [];
    } catch {
      return [];
    }
  }));

  cdxResults.forEach((rows) => {
    rows.forEach((row) => {
      const ts = row && row[0];
      const pageUrl = row && row[1];
      if (ts && pageUrl) replayJobs.push({ ts, url: `https://web.archive.org/web/${ts}/${pageUrl}` });
    });
  });

  // Keep concurrency bounded to avoid flooding Wayback on a single lookup.
  let cursor = 0;
  async function replayWorker() {
    while (cursor < replayJobs.length) {
      const job = replayJobs[cursor++];
      try {
        const page = await fetchWithTimeout(job.url, { headers: requestHeaders }, 10000);
        if (!page.ok) continue;
        const html = await page.text();
        const re = /https?:\/\/(?:tr|t[0-7])\.rbxcdn\.com\/[^\s"'<>]+(?:Avatar|avatar|Headshot|headshot)[^\s"'<>]*/gi;
        const matches = html.match(re) || [];
        for (const match of matches) {
          if (/placeholder|deleted|question|blank\.ashx|dialog_avatar/i.test(match)) continue;
          const key = job.ts + "|" + match;
          if (imageMap.has(key)) continue;
          imageMap.set(key, {
            url: `https://web.archive.org/web/${job.ts}im_/${match}`,
            timestamp: job.ts,
            source: "wayback",
          });
        }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, replayJobs.length) }, () => replayWorker()));

  const images = Array.from(imageMap.values())
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 40);
  waybackCache.set(userId, { at: Date.now(), images });
  res.setHeader("Cache-Control", "private, max-age=300");
  res.json({ images });
});

app.use((req, res) => {
  setCors(req, res);
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);
  if (!res.headersSent) {
    setCors(req, res);
    res.status(500).json({ error: "Internal error" });
  } else next(err);
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} (${BACKEND_VERSION})`);
});
server.keepAliveTimeout = 120000;
