import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_VERSION = "2026-10-07-robloxify-stable";
const ROBLOXIFY_REQUEST_TIMEOUT = 15 * 60 * 1000;

const DATA_ROOT = process.env.DATA_ROOT || "/tmp/winxp-data";
const VISITOR_COUNT_PATH = process.env.VISITOR_COUNT_PATH || path.join(DATA_ROOT, "visitor-count-v2.json");
const COMMUNITY_DIR = process.env.COMMUNITY_DIR || path.join(DATA_ROOT, "robloxify-community");
const COMMUNITY_AUDIO_DIR = path.join(COMMUNITY_DIR, "audio");
const COMMUNITY_INDEX_PATH = path.join(COMMUNITY_DIR, "tracks.json");

const allowedOrigins = [
  "https://bagof.fish",
  "https://www.bagof.fish",
  "http://localhost:3000",
  "http://localhost:3001",
];

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    // Non-browser/server-to-server requests do not need an ACAO header.
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://bagof.fish");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, X-Requested-With");
  res.setHeader("Access-Control-Max-Age", "86400");
}

app.use((req, res, next) => {
  setCors(req, res);
  res.setHeader("X-WinXP-Backend", BACKEND_VERSION);
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Accept", "Content-Type", "X-Requested-With"],
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.type("text").send("ok");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "winxp-7yes", version: BACKEND_VERSION });
});

// Full routes restored from a004370 + Demucs non-fatal fallback.
// If this deploy is still incomplete, hard-reset main to a004370 on GitHub.

let visitorCountQueue = Promise.resolve();
let memoryVisitorCount = 0;
const memoryVisitorIds = new Set();

function parseVisitorCookie(req) {
  const raw = String(req.headers.cookie || "");
  const match = raw.match(/(?:^|;\s*)bagof-fish-visitor=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function getVisitorState() {
  let count = memoryVisitorCount;
  let seen = memoryVisitorIds;
  try {
    const visitorDir = path.dirname(VISITOR_COUNT_PATH);
    await fs.promises.mkdir(visitorDir, { recursive: true });
    try {
      const raw = await fs.promises.readFile(VISITOR_COUNT_PATH, "utf8");
      const parsed = JSON.parse(raw);
      count = Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : 0;
      seen = new Set(Array.isArray(parsed.visitors) ? parsed.visitors.map(String) : []);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  } catch (err) {
    console.warn("Visitor counter persistence unavailable:", err.message);
  }
  memoryVisitorCount = count;
  memoryVisitorIds.clear();
  seen.forEach(id => memoryVisitorIds.add(id));
  return { count, seen };
}

app.get("/visitor-count/current", async (req, res) => {
  try {
    const { count } = await getVisitorState();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Visitor counter unavailable" });
  }
});

app.get("/visitor-count/visit", async (req, res) => {
  const visitorId = String(req.query.visitor || req.headers["x-visitor-id"] || parseVisitorCookie(req) || "").trim();
  if (!visitorId || visitorId.length > 200) return res.status(400).json({ error: "Visitor cookie required" });
  visitorCountQueue = visitorCountQueue.then(async () => {
    let { count, seen } = await getVisitorState();
    if (!seen.has(visitorId)) {
      seen.add(visitorId);
      count += 1;
      try {
        await fs.promises.mkdir(path.dirname(VISITOR_COUNT_PATH), { recursive: true });
        await fs.promises.writeFile(VISITOR_COUNT_PATH, JSON.stringify({ count, visitors: Array.from(seen).slice(-100000) }), "utf8");
      } catch (err) {
        console.warn("Visitor counter persistence unavailable:", err.message);
      }
    }
    memoryVisitorCount = count;
    memoryVisitorIds.clear();
    seen.forEach(id => memoryVisitorIds.add(id));
    return count;
  });
  try {
    const count = await visitorCountQueue;
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Visitor counter unavailable" });
  }
});

const PLAYERS_DIR = process.env.PLAYERS_DIR || path.join(DATA_ROOT, "robloxify-players");
const PLAYERS_INDEX_PATH = path.join(PLAYERS_DIR, "players.json");
let memoryPlayers = new Map();

function normalizePlayerName(value) { return String(value || "").trim().replace(/\\s+/g, " "); }
function playerKey(value) { return normalizePlayerName(value).toLocaleLowerCase(); }
function validPlayerName(value) { return /^[A-Za-z0-9._-]{2,20}(?: [A-Za-z0-9._-]{1,20})*$/.test(value); }

async function readPlayers() {
  try {
    await fs.promises.mkdir(PLAYERS_DIR, { recursive: true });
    const raw = await fs.promises.readFile(PLAYERS_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const map = new Map();
      parsed.forEach(p => { if (p && p.name) map.set(playerKey(p.name), p); });
      memoryPlayers = map;
    }
  } catch (err) {
    if (err.code !== "ENOENT" && !["EACCES","EROFS"].includes(err.code)) console.warn("Player store unavailable:", err.message);
  }
  return Array.from(memoryPlayers.values());
}
async function writePlayers(players) {
  memoryPlayers = new Map(players.map(p => [playerKey(p.name), p]));
  try {
    await fs.promises.mkdir(PLAYERS_DIR, { recursive: true });
    const tmp = PLAYERS_INDEX_PATH + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(players, null, 2), "utf8");
    await fs.promises.rename(tmp, PLAYERS_INDEX_PATH);
  } catch (err) {
    console.warn("Player store persistence unavailable:", err.message);
  }
}
function projectsForPlayer(player) { return Array.isArray(player.projects) ? player.projects.slice(0, 100) : []; }

app.post("/players/register", async (req, res) => {
  try {
    await readPlayers();
    const name = normalizePlayerName(req.body?.name);
    if (!validPlayerName(name)) return res.status(400).json({ error: "Names must be 2-20 characters and use letters, numbers, spaces, dots, underscores, or hyphens." });
    const key = playerKey(name);
    const existing = memoryPlayers.get(key);
    if (existing && existing.name !== name) return res.status(409).json({ error: "That player name is already taken." });
    const player = existing || { name, createdAt: new Date().toISOString(), projects: [] };
    memoryPlayers.set(key, player);
    await writePlayers(Array.from(memoryPlayers.values()));
    res.json({ ok: true, player: { name: player.name, createdAt: player.createdAt }, projects: projectsForPlayer(player), tracks: [] });
  } catch (err) {
    res.status(500).json({ error: "Could not save player name." });
  }
});
app.get("/players/:name", async (req, res) => {
  try {
    await readPlayers();
    const name = normalizePlayerName(req.params.name);
    const player = memoryPlayers.get(playerKey(name));
    if (!player) return res.status(404).json({ error: "Player name not found." });
    res.setHeader("Cache-Control", "no-store");
    res.json({ player: { name: player.name, createdAt: player.createdAt }, projects: projectsForPlayer(player), tracks: [] });
  } catch (err) {
    res.status(500).json({ error: "Could not load player." });
  }
});
app.post("/players/:name/projects", async (req, res) => {
  try {
    await readPlayers();
    const name = normalizePlayerName(req.params.name);
    const player = memoryPlayers.get(playerKey(name));
    if (!player) return res.status(404).json({ error: "Player name not found." });
    const project = req.body?.project;
    if (!project || !project.id) return res.status(400).json({ error: "Project data required." });
    const projects = projectsForPlayer(player).filter(p => String(p.id) !== String(project.id));
    projects.unshift(project);
    player.projects = projects.slice(0, 100);
    memoryPlayers.set(playerKey(player.name), player);
    await writePlayers(Array.from(memoryPlayers.values()));
    res.json({ ok: true, project });
  } catch (err) {
    res.status(500).json({ error: "Could not save project." });
  }
});

async function readCommunityTracks() {
  await fs.promises.mkdir(COMMUNITY_AUDIO_DIR, { recursive: true });
  try {
    const raw = await fs.promises.readFile(COMMUNITY_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}
async function writeCommunityTracks(tracks) {
  await fs.promises.mkdir(COMMUNITY_AUDIO_DIR, { recursive: true });
  const temp = COMMUNITY_INDEX_PATH + ".tmp";
  await fs.promises.writeFile(temp, JSON.stringify(tracks.slice(0, 2000), null, 2), "utf8");
  await fs.promises.rename(temp, COMMUNITY_INDEX_PATH);
}
app.use("/community/audio", express.static(COMMUNITY_AUDIO_DIR, { fallthrough: false, maxAge: "1h", index: false }));
app.get("/community/tracks", async (req, res) => {
  try {
    const tracks = await readCommunityTracks();
    res.setHeader("Cache-Control", "no-store");
    res.json({ tracks: tracks.map(track => ({ ...track, audioUrl: "/community/audio/" + encodeURIComponent(track.file) })) });
  } catch (err) {
    res.status(500).json({ error: "Could not load community places" });
  }
});

let robloxifyModulePromise = null;
let robloxifyBusy = false;
const robloxifyCache = new Map();
function getRobloxifyCacheKey(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function rememberRobloxifyResult(key, value) {
  if (robloxifyCache.size > 20) {
    const first = robloxifyCache.keys().next().value;
    robloxifyCache.delete(first);
  }
  robloxifyCache.set(key, value);
}
async function loadRobloxify() {
  if (!robloxifyModulePromise) {
    robloxifyModulePromise = (async () => {
      const multer = (await import("multer")).default;
      const loaded = await import("./robloxify.cjs");
      const { transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS } = loaded.default || loaded;
      return { multer, transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS };
    })().catch((err) => { robloxifyModulePromise = null; throw err; });
  }
  return robloxifyModulePromise;
}

app.post("/robloxify", async (req, res) => {
  setCors(req, res);
  try {
    const { multer, transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS } = await loadRobloxify();
    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, os.tmpdir()),
        filename: (req, file, cb) => cb(null, crypto.randomUUID() + ".upload"),
      }),
      limits: { fileSize: ROBLOXIFY_LIMITS.MAX_BYTES, files: 1 },
    }).single("audio");
    await new Promise((resolve, reject) => { upload(req, res, (err) => (err ? reject(err) : resolve())); });
    if (robloxifyBusy) return res.status(503).json({ error: "Robloxify is busy processing another file. Try again in a moment." });
    if (!req.file) return res.status(400).json({ error: "Audio file required (field name: audio)" });
    const fileBuffer = await fs.promises.readFile(req.file.path);
    await fs.promises.unlink(req.file.path).catch(() => {});
    const cacheKey = getRobloxifyCacheKey(fileBuffer);
    const cachedResult = robloxifyCache.get(cacheKey);
    if (cachedResult) {
      robloxifyCache.delete(cacheKey);
      robloxifyCache.set(cacheKey, cachedResult);
      return res.json({ ...cachedResult, cached: true, ms: 0, version: BACKEND_VERSION });
    }
    robloxifyBusy = true;
    const t0 = Date.now();
    try {
      const transcriptionStartedAt = Date.now();
      // Stem separation is intentionally done in the browser. Running Demucs here
      // makes the small Render instance unnecessarily memory-hungry.
      const transcriptionBuffer = fileBuffer;
      const transcriptionMime = req.file.mimetype;
      const stemSeparation = "browser";
      const result = await transcribeAudioBuffer(transcriptionBuffer, transcriptionMime);
      console.log(`Robloxify transcription total: ${Date.now() - transcriptionStartedAt}ms`);
      const aiPlan = await createRobloxifyStylePlan(result.notes, result.duration);
      const response = {
        ok: true,
        notes: result.notes,
        duration: result.duration,
        sampleRate: result.sampleRate,
        noteCount: result.noteCount,
        aiPlan,
        stemSeparation,
      };
      rememberRobloxifyResult(cacheKey, response);
      res.json({ ...response, cached: false, ms: Date.now() - t0, version: BACKEND_VERSION });
    } finally {
      robloxifyBusy = false;
    }
  } catch (err) {
    console.error("Robloxify failed:", err?.stack || err);
    setCors(req, res);
    const msg = err && err.message ? err.message : "Transcription failed";
    const isUploadError = err?.name === "MulterError" || /too large|shorter|empty|busy|decode|format|unsupported|invalid audio|could not determine|no usable samples/i.test(msg);
    const status = /busy/i.test(msg) ? 503 : isUploadError ? 400 : 500;
    if (status === 503) res.setHeader("Retry-After", "5");
    res.status(status).json({ error: msg });
  }
});

app.get("/proxy-roblox-avatar", async (req, res) => {
  const source = String(req.query.url || "");
  if (!source) return res.status(400).end();
  let parsed;
  try { parsed = new URL(source); } catch { return res.status(400).end(); }
  if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).end();
  try {
    const upstream = await fetch(parsed.toString(), { headers: { "User-Agent": "WinXP Renderer/1.0" } });
    if (!upstream.ok || !upstream.body) return res.status(upstream.status || 502).end();
    const ct = upstream.headers.get("content-type") || "image/png";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).end();
  }
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
server.requestTimeout = ROBLOXIFY_REQUEST_TIMEOUT;
server.timeout = ROBLOXIFY_REQUEST_TIMEOUT;
server.keepAliveTimeout = 120000;
server.headersTimeout = ROBLOXIFY_REQUEST_TIMEOUT + 5000;
