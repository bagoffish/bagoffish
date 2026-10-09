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
const BACKEND_VERSION = "2026-10-09-bloxify-save-delete-fix";
const BLOXIFY_REQUEST_TIMEOUT = 15 * 60 * 1000;

const DATA_ROOT = process.env.DATA_ROOT || "/tmp/winxp-data";
const VISITOR_COUNT_PATH = process.env.VISITOR_COUNT_PATH || path.join(DATA_ROOT, "visitor-count-v2.json");
const COMMUNITY_DIR = process.env.COMMUNITY_DIR || path.join(DATA_ROOT, "bloxify-community");
const COMMUNITY_AUDIO_DIR = path.join(COMMUNITY_DIR, "audio");
const COMMUNITY_INDEX_PATH = path.join(COMMUNITY_DIR, "tracks.json");

const allowedOrigins = [
  "https://bagof.fish",
  "https://www.bagof.fish",
  "https://winxp-7yes.onrender.com",
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Accept", "Content-Type", "X-Requested-With"],
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: "2mb" }));

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
const PLAYERS_GITHUB_PATH = "site/players.json";
const COMMUNITY_GITHUB_INDEX = "site/community/index.json";
const COMMUNITY_MAX_BYTES = 12 * 1024 * 1024;
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
    const file = await rendererGhGet(VISITOR_GITHUB_PATH);
    if (!file) return rememberVisitorState(0, [], "");
    const parsed = JSON.parse(file.bytes.toString("utf8"));
    const count = Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : 0;
    const visitors = Array.isArray(parsed.visitors) ? parsed.visitors.map(String).slice(-100000) : [];
    return rememberVisitorState(count, visitors, file.sha);
  }
  const disk = await readVisitorDisk();
  return rememberVisitorState(disk.count, disk.visitors, "");
}

async function persistVisitorState(count, visitors) {
  const body = Buffer.from(JSON.stringify({ count, visitors }));
  if (rendererCacheEnabled()) {
    visitorGithubSha = await rendererGhPut(
      VISITOR_GITHUB_PATH,
      body,
      "Save visitor count",
      visitorGithubSha
    ) || visitorGithubSha;
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

const PLAYERS_DIR = process.env.PLAYERS_DIR || path.join(DATA_ROOT, "bloxify-players");
const PLAYERS_INDEX_PATH = path.join(PLAYERS_DIR, "players.json");
let memoryPlayers = new Map();

function normalizePlayerName(value) { return String(value || "").trim().replace(/\s+/g, " "); }
function playerKey(value) { return normalizePlayerName(value).toLocaleLowerCase(); }
function validPlayerName(value) { return /^[A-Za-z0-9._-]{2,20}(?: [A-Za-z0-9._-]{1,20})*$/.test(value); }

let playersHydrated = false;
let playersGithubSha = "";
let playersQueue = Promise.resolve();

function enqueuePlayers(job) {
  const pending = playersQueue.catch(() => {}).then(job);
  playersQueue = pending;
  return pending;
}

function playersFromList(list) {
  const map = new Map();
  if (Array.isArray(list)) {
    list.forEach(player => { if (player && player.name) map.set(playerKey(player.name), player); });
  }
  return map;
}

async function readPlayers() {
  if (playersHydrated) return Array.from(memoryPlayers.values());
  if (rendererCacheEnabled()) {
    let file = null;
    try {
      file = await rendererGhGet(PLAYERS_GITHUB_PATH);
    } catch (err) {
      console.warn("Player store GitHub read failed:", err.message);
      file = await rendererGhGetRaw(PLAYERS_GITHUB_PATH).then((bytes) => (bytes ? { sha: "", bytes } : null));
    }
    if (file) {
      playersGithubSha = file.sha;
      memoryPlayers = playersFromList(JSON.parse(file.bytes.toString("utf8")));
      playersHydrated = true;
      return Array.from(memoryPlayers.values());
    }
  }
  try {
    await fs.promises.mkdir(PLAYERS_DIR, { recursive: true });
    const raw = await fs.promises.readFile(PLAYERS_INDEX_PATH, "utf8");
    memoryPlayers = playersFromList(JSON.parse(raw));
  } catch (err) {
    if (err.code !== "ENOENT" && !["EACCES","EROFS"].includes(err.code)) console.warn("Player store unavailable:", err.message);
  }
  playersHydrated = true;
  return Array.from(memoryPlayers.values());
}
async function writePlayers(players) {
  memoryPlayers = playersFromList(players);
  playersHydrated = true;
  const list = Array.from(memoryPlayers.values());
  try {
    await fs.promises.mkdir(PLAYERS_DIR, { recursive: true });
    const tmp = PLAYERS_INDEX_PATH + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(list), "utf8");
    await fs.promises.rename(tmp, PLAYERS_INDEX_PATH);
  } catch (err) {
    console.warn("Player store disk write failed:", err.message);
  }
  if (rendererCacheEnabled()) {
    playersGithubSha = await rendererGhPut(
      PLAYERS_GITHUB_PATH,
      Buffer.from(JSON.stringify(list)),
      "Save Bloxify players",
      playersGithubSha
    ) || playersGithubSha;
  }
}
function projectsForPlayer(player) { return Array.isArray(player.projects) ? player.projects.slice(0, 100) : []; }

function playerPayload(player) {
  return {
    ok: true,
    player: { name: player.name, createdAt: player.createdAt },
    projects: projectsForPlayer(player),
    tracks: [],
  };
}

app.post("/players/register", async (req, res) => {
  try {
    const outcome = await enqueuePlayers(async () => {
      await readPlayers();
      const name = normalizePlayerName(req.body?.name);
      if (!validPlayerName(name)) return { status: 400, body: { error: "Names must be 2-20 characters and use letters, numbers, spaces, dots, underscores, or hyphens." } };
      const existing = memoryPlayers.get(playerKey(name));
      if (existing && existing.name !== name) return { status: 409, body: { error: "That player name is already taken." } };
      const player = existing || { name, createdAt: new Date().toISOString(), projects: [] };
      const list = Array.from(memoryPlayers.values()).filter(item => playerKey(item.name) !== playerKey(name));
      list.push(player);
      await writePlayers(list);
      return { status: 200, body: playerPayload(player) };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.warn("Player register failed:", err.message);
    res.status(500).json({ error: "Could not save player name." });
  }
});
app.get("/players/:name", async (req, res) => {
  try {
    const player = await enqueuePlayers(async () => {
      await readPlayers();
      return memoryPlayers.get(playerKey(normalizePlayerName(req.params.name))) || null;
    });
    if (!player) return res.status(404).json({ error: "Player name not found." });
    res.setHeader("Cache-Control", "no-store");
    res.json(playerPayload(player));
  } catch (err) {
    console.warn("Player read failed:", err.message);
    res.status(500).json({ error: "Could not load player." });
  }
});
app.post("/players/:name/projects", async (req, res) => {
  try {
    const outcome = await enqueuePlayers(async () => {
      await readPlayers();
      const name = normalizePlayerName(req.params.name);
      const player = memoryPlayers.get(playerKey(name));
      if (!player) return { status: 404, body: { error: "Player name not found." } };
      const project = req.body?.project;
      if (!project || !project.id) return { status: 400, body: { error: "Project data required." } };
      const projects = projectsForPlayer(player).filter(item => String(item.id) !== String(project.id));
      projects.unshift(project);
      player.projects = projects.slice(0, 100);
      const list = Array.from(memoryPlayers.values());
      await writePlayers(list);
      return { status: 200, body: { ok: true, project } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.warn("Player project save failed:", err.message);
    res.status(500).json({ error: "Could not save project." });
  }
});

app.delete("/players/:name/projects/:id", async (req, res) => {
  try {
    const outcome = await enqueuePlayers(async () => {
      await readPlayers();
      const name = normalizePlayerName(req.params.name);
      const player = memoryPlayers.get(playerKey(name));
      if (!player) return { status: 404, body: { error: "Player name not found." } };
      const before = projectsForPlayer(player);
      const after = before.filter(item => String(item.id) !== String(req.params.id));
      player.projects = after;
      if (after.length !== before.length) await writePlayers(Array.from(memoryPlayers.values()));
      return { status: 200, body: { ok: true, deleted: after.length !== before.length } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.warn("Player project delete failed:", err.message);
    res.status(500).json({ error: "Could not delete project." });
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
  await fs.promises.writeFile(temp, JSON.stringify(tracks.slice(0, 200)), "utf8");
  await fs.promises.rename(temp, COMMUNITY_INDEX_PATH);
}

let communityTracksCache = null;
let communityIndexSha = "";
let communityQueue = Promise.resolve();
let communityUpload = null;

function enqueueCommunity(job) {
  const pending = communityQueue.catch(() => {}).then(job);
  communityQueue = pending;
  return pending;
}

function communityPublicTrack(track) {
  return {
    id: track.id,
    name: track.name,
    ownerName: track.ownerName || "",
    file: track.file,
    createdAt: track.createdAt,
    audioUrl: "/community/audio/" + encodeURIComponent(track.file),
  };
}

function safeCommunityFile(name) {
  const file = path.basename(String(name || ""));
  return /^[A-Za-z0-9._-]{1,80}$/.test(file) ? file : "";
}

async function loadCommunityTracks() {
  if (communityTracksCache) return communityTracksCache;
  if (rendererCacheEnabled()) {
    let file = null;
    try {
      file = await rendererGhGet(COMMUNITY_GITHUB_INDEX);
    } catch (err) {
      console.warn("Community index read failed:", err.message);
      const bytes = await rendererGhGetRaw(COMMUNITY_GITHUB_INDEX);
      if (bytes) file = { sha: "", bytes };
    }
    if (file) {
      communityIndexSha = file.sha;
      const parsed = JSON.parse(file.bytes.toString("utf8"));
      communityTracksCache = Array.isArray(parsed) ? parsed : [];
      return communityTracksCache;
    }
  }
  try {
    communityTracksCache = await readCommunityTracks();
  } catch (err) {
    console.warn("Community disk read failed:", err.message);
    communityTracksCache = [];
  }
  return communityTracksCache;
}

async function saveCommunityIndex(tracks) {
  const next = tracks.slice(0, 200);
  communityTracksCache = next;
  try {
    await writeCommunityTracks(next);
  } catch (err) {
    console.warn("Community disk write failed:", err.message);
  }
  if (rendererCacheEnabled()) {
    communityIndexSha = await rendererGhPut(
      COMMUNITY_GITHUB_INDEX,
      Buffer.from(JSON.stringify(next)),
      "Save community places",
      communityIndexSha
    ) || communityIndexSha;
  }
}

async function parseCommunityUpload(req, res) {
  if (!communityUpload) {
    const multer = (await import("multer")).default;
    communityUpload = multer({
      storage: multer.diskStorage({
        destination: (request, file, callback) => callback(null, os.tmpdir()),
        filename: (request, file, callback) => callback(null, crypto.randomUUID() + ".upload"),
      }),
      limits: { fileSize: COMMUNITY_MAX_BYTES, files: 1 },
    }).single("audio");
  }
  await new Promise((resolve, reject) => {
    communityUpload(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

app.get("/community/audio/:file", async (req, res) => {
  const file = safeCommunityFile(req.params.file);
  if (!file) return res.status(400).end();
  const diskPath = path.join(COMMUNITY_AUDIO_DIR, file);
  try {
    await fs.promises.access(diskPath);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(diskPath);
  } catch {
    // The free instance disk is empty after a restart. Fall through to GitHub.
  }
  try {
    if (!rendererCacheEnabled()) return res.status(404).end();
    const bytes = await rendererGhGetRaw(`site/community/audio/${file}`);
    if (!bytes || !bytes.length) return res.status(404).end();
    await fs.promises.mkdir(COMMUNITY_AUDIO_DIR, { recursive: true });
    await fs.promises.writeFile(diskPath, bytes).catch(() => {});
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(bytes);
  } catch (err) {
    console.warn("Community audio read failed:", err.message);
    if (!res.headersSent) res.status(502).end();
  }
});

app.get("/community/tracks", async (req, res) => {
  try {
    const tracks = await enqueueCommunity(() => loadCommunityTracks());
    res.setHeader("Cache-Control", "no-store");
    res.json({ tracks: tracks.map(communityPublicTrack) });
  } catch (err) {
    console.warn("Community list failed:", err.message);
    res.status(500).json({ error: "Could not load community places" });
  }
});

app.post("/community/tracks", async (req, res) => {
  setCors(req, res);
  let uploadPath = "";
  try {
    await parseCommunityUpload(req, res);
    if (!req.file) return res.status(400).json({ error: "Audio file required" });
    uploadPath = req.file.path;
    const name = String(req.body?.name || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
    const ownerName = String(req.body?.ownerName || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Give your place a name before publishing." });
    const id = crypto.randomUUID();
    const file = id + ".wav";
    const bytes = await fs.promises.readFile(uploadPath);
    await fs.promises.mkdir(COMMUNITY_AUDIO_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(COMMUNITY_AUDIO_DIR, file), bytes);
    const track = {
      id,
      name,
      ownerName,
      file,
      createdAt: new Date().toISOString(),
    };
    await enqueueCommunity(async () => {
      if (rendererCacheEnabled()) {
        await rendererGhPut(`site/community/audio/${file}`, bytes, `Publish community place ${name}`, "");
      }
      const tracks = await loadCommunityTracks();
      await saveCommunityIndex([track, ...tracks.filter(item => item && item.id !== id)]);
    });
    res.json({ ok: true, track: communityPublicTrack(track) });
  } catch (err) {
    console.warn("Community publish failed:", err.message);
    const tooLarge = err?.name === "MulterError" && err.code === "LIMIT_FILE_SIZE";
    if (!res.headersSent) {
      res.status(tooLarge ? 400 : 500).json({
        error: tooLarge ? "Audio file is too large to publish (max 12 MB)." : "Could not publish this place.",
      });
    }
  } finally {
    if (uploadPath) await fs.promises.unlink(uploadPath).catch(() => {});
  }
});

let bloxifyModulePromise = null;
let bloxifyBusy = false;
const bloxifyCache = new Map();
function getBloxifyCacheKey(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function rememberBloxifyResult(key, value) {
  if (bloxifyCache.size > 20) {
    const first = bloxifyCache.keys().next().value;
    bloxifyCache.delete(first);
  }
  bloxifyCache.set(key, value);
}
async function loadBloxify() {
  if (!bloxifyModulePromise) {
    bloxifyModulePromise = (async () => {
      const multer = (await import("multer")).default;
      const loaded = await import("./bloxify.cjs");
      const { transcribeAudioBuffer, createBloxifyStylePlan, BLOXIFY_LIMITS } = loaded.default || loaded;
      return { multer, transcribeAudioBuffer, createBloxifyStylePlan, BLOXIFY_LIMITS };
    })().catch((err) => { bloxifyModulePromise = null; throw err; });
  }
  return bloxifyModulePromise;
}

app.post(["/bloxify", "/robloxify"], async (req, res) => {
  setCors(req, res);
  if (bloxifyBusy) {
    res.setHeader("Retry-After", "5");
    return res.status(503).json({ error: "Bloxify is busy processing another file. Try again in a moment." });
  }
  bloxifyBusy = true;
  try {
    const { multer, transcribeAudioBuffer, createBloxifyStylePlan, BLOXIFY_LIMITS } = await loadBloxify();
    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, os.tmpdir()),
        filename: (req, file, cb) => cb(null, crypto.randomUUID() + ".upload"),
      }),
      limits: { fileSize: BLOXIFY_LIMITS.MAX_BYTES, files: 1 },
    }).single("audio");
    await new Promise((resolve, reject) => { upload(req, res, (err) => (err ? reject(err) : resolve())); });
    if (!req.file) return res.status(400).json({ error: "Audio file required (field name: audio)" });
    const fileBuffer = await fs.promises.readFile(req.file.path);
    await fs.promises.unlink(req.file.path).catch(() => {});
    const cacheKey = getBloxifyCacheKey(fileBuffer);
    const cachedResult = bloxifyCache.get(cacheKey);
    if (cachedResult) {
      bloxifyCache.delete(cacheKey);
      bloxifyCache.set(cacheKey, cachedResult);
      return res.json({ ...cachedResult, cached: true, ms: 0, version: BACKEND_VERSION });
    }
    const t0 = Date.now();
    const transcriptionStartedAt = Date.now();
    // Stem separation is intentionally done in the browser. Running Demucs here
    // makes the small Render instance unnecessarily memory-hungry.
    const transcriptionBuffer = fileBuffer;
    const transcriptionMime = req.file.mimetype;
    const stemSeparation = "browser";
    const result = await transcribeAudioBuffer(transcriptionBuffer, transcriptionMime);
    console.log(`Bloxify transcription total: ${Date.now() - transcriptionStartedAt}ms`);
    const aiPlan = await createBloxifyStylePlan(result.notes, result.duration);
    const response = {
      ok: true,
      notes: result.notes,
      duration: result.duration,
      sampleRate: result.sampleRate,
      noteCount: result.noteCount,
      aiPlan,
      stemSeparation,
    };
    rememberBloxifyResult(cacheKey, response);
    res.json({ ...response, cached: false, ms: Date.now() - t0, version: BACKEND_VERSION });
  } catch (err) {
    console.error("Bloxify failed:", err?.stack || err);
    setCors(req, res);
    const msg = err && err.message ? err.message : "Transcription failed";
    const isUploadError = err?.name === "MulterError" || /too large|shorter|empty|busy|decode|format|unsupported|invalid audio|could not determine|no usable samples/i.test(msg);
    const status = /busy/i.test(msg) ? 503 : isUploadError ? 400 : 500;
    if (status === 503) res.setHeader("Retry-After", "5");
    if (!res.headersSent) res.status(status).json({ error: msg });
  } finally {
    bloxifyBusy = false;
  }
});


/* ---------- Roblox renderer (saved lookups) ---------- */
const RENDERER_PUBLIC_BASE = process.env.RENDERER_PUBLIC_URL || "https://bloxify-backend-2apa.onrender.com";
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
    oldAvatars: record.oldAvatars || [],
    hasAvatar: Boolean(record.hasAvatar),
    avatarSha256: record.avatarSha256 || "",
    avatarCapturedAt: record.avatarCapturedAt || 0,
    refreshedAt: record.refreshedAt || 0,
    savedAt: record.savedAt || 0,
  };
}

function rendererPayload(record, liveAvatarUrl) {
  // Always show the live Roblox thumbnail. Saved PNGs are history only.
  const avatarUrl = liveAvatarUrl
    ? `${RENDERER_PUBLIC_BASE}/proxy-roblox-avatar?url=${encodeURIComponent(liveAvatarUrl)}`
    : "";
  return {
    roblox: {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      joinDate: record.joinDate || "Unknown",
      avatarUrl,
      oldAvatars: record.oldAvatars || [],
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
    oldAvatars: record.oldAvatars || [],
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
  rendererWriteQueue = rendererWriteQueue.then(job).catch((err) => {
    console.warn("renderer cache write failed:", err.message);
  });
  return rendererWriteQueue;
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

  // Current avatar images are not stored as the active renderer image.
  // When Roblox changes the thumbnail, archive the previous render instead.
  if (png && png.length) {
    const hash = crypto.createHash("sha256").update(png).digest("hex");
    const previousHash = String(record.avatarSha256 || "");

    if (previousHash && previousHash !== hash) {
      let previousPng = record.avatarPng || null;
      if (!previousPng) previousPng = await rendererGhGetRaw(`avatars/${id}.png`).catch(() => null);

      if (previousPng && previousPng.length) {
        const archivePath = `avatars/${id}-${previousHash}.png`;
        const existingArchive = await rendererGhGet(archivePath).catch(() => null);
        if (!existingArchive) {
          await rendererGhPut(archivePath, previousPng, `Archive old renderer avatar ${id}`, "");
        }
        const oldAvatars = Array.isArray(record.oldAvatars) ? record.oldAvatars.slice() : [];
        if (!oldAvatars.some((item) => item && item.hash === previousHash)) {
          oldAvatars.unshift({
            hash: previousHash,
            capturedAt: record.avatarCapturedAt || record.refreshedAt || Date.now(),
            url: `${RENDERER_PUBLIC_BASE}/renderer-old-avatar/${id}/${previousHash}.png`,
          });
          record.oldAvatars = oldAvatars.slice(0, 100);
        }
      }
    }

    record.avatarSha256 = hash;
    record.avatarCapturedAt = Date.now();
    record.hasAvatar = true;

    // Keep one private rollover copy only so the next avatar change can
    // archive this render. It is never returned as the current thumbnail.
    await rendererGhPut(
      `avatars/${id}.png`,
      png,
      `Update renderer avatar rollover ${id}`,
      ""
    );
    record.avatarPng = null;
  }

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
  const [profileRes, avatarRes] = await Promise.all([
    fetchWithTimeout(`https://users.roblox.com/v1/users/${id}`, { headers: ROBLOX_UA }),
    fetchWithTimeout(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png`,
      { headers: ROBLOX_UA }
    ),
  ]);
  if (!profileRes.ok) throw new Error("Roblox profile HTTP " + profileRes.status);
  const profile = await profileRes.json();
  const avatarResData = avatarRes.ok ? await avatarRes.json() : {};
  return {
    id: String(profile.id || id),
    username: profile.name,
    displayName: profile.displayName,
    joinDate: profile.created
      ? new Date(profile.created).toUTCString().replace(" GMT", "")
      : "Unknown",
    liveAvatarUrl: avatarResData?.data?.[0]?.imageUrl || "",
  };
}

async function fetchRobloxDetails(id) {
  const [pastRes, roliRes] = await Promise.all([
    fetchWithTimeout(`https://users.roblox.com/v1/users/${id}/username-history`, { headers: ROBLOX_UA }).catch(() => null),
    fetchWithTimeout(`https://api.rolimons.com/players/v1/playerinfo/${id}`, { headers: ROBLOX_UA }, 6000).catch(() => null),
  ]);
  let pastUsernames = [];
  if (pastRes && pastRes.ok) {
    try {
      const pastData = await pastRes.json();
      pastUsernames = pastData.data?.map((entry) => entry.name).filter(Boolean) || [];
    } catch {}
  }
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

async function downloadAvatarPng(imageUrl) {
  if (!imageUrl) return null;
  const res = await fetch(imageUrl, { headers: { "User-Agent": "WinXP Renderer/1.0" } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > 2_000_000) return null;
  return buf;
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
    const png = await downloadAvatarPng(liveAvatarUrl).catch(() => null);
    record.refreshedAt = Date.now();
    rememberRenderer(record);
    await enqueueRendererWrite(() => saveRendererRecord(record, png));
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
      // Re-query Roblox on every lookup so avatar changes appear immediately.
      // Stored data is metadata/history only, never the current thumbnail.
      const live = await fetchRobloxProfile(username);
      if (!live) return res.status(404).json({ error: "Not found" });
      const livePng = await downloadAvatarPng(live.liveAvatarUrl).catch(() => null);
      stored.username = live.username || stored.username;
      stored.displayName = live.displayName || stored.displayName;
      stored.joinDate = live.joinDate || stored.joinDate;
      const details = await fetchRobloxDetails(stored.id).catch(() => null);
      if (details) {
        if (details.pastUsernames.length) stored.pastUsernames = details.pastUsernames;
        if (Object.keys(details.rolimons).length) stored.rolimons = details.rolimons;
      }
      stored.refreshedAt = Date.now();
      try {
        await enqueueRendererWrite(() => saveRendererRecord(stored, livePng));
      } catch (err) {
        console.warn("renderer live-avatar history save failed:", err.message);
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(rendererPayload(stored, live.liveAvatarUrl));
      return;
    }

    const profile = await fetchRobloxProfile(username);
    if (!profile) return res.status(404).json({ error: "Not found" });
    const details = await fetchRobloxDetails(profile.id);
    const png = await downloadAvatarPng(profile.liveAvatarUrl).catch(() => null);
    const record = rememberRenderer({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      joinDate: profile.joinDate,
      pastUsernames: details.pastUsernames,
      rolimons: details.rolimons,
      oldAvatars: [],
      hasAvatar: false,
      refreshedAt: Date.now(),
      savedAt: 0,
    });
    let saved = false;
    try {
      saved = await enqueueRendererWrite(() => saveRendererRecord(record, png));
    } catch (err) {
      console.warn("renderer cache write failed:", err.message);
    }
    if (png) record.avatarPng = png;
    if (saved && png) record.hasAvatar = true;
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(rendererPayload(record, saved ? "" : profile.liveAvatarUrl));
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
      oldAvatars: [],
      hasAvatar: false,
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

app.get("/renderer-old-avatar/:id/:hash.png", async (req, res) => {
  const id = String(req.params.id || "");
  const hash = String(req.params.hash || "").toLowerCase();
  if (!/^\d+$/.test(id) || !/^[a-f0-9]{64}$/.test(hash)) return res.status(400).end();
  try {
    const file = await rendererGhGetRaw(`avatars/${id}-${hash}.png`);
    if (!file || !file.length) return res.status(404).end();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(file);
  } catch (err) {
    console.warn("old renderer avatar read failed:", err.message);
    res.status(502).end();
  }
});

app.get("/renderer-avatar/:id", async (req, res) => {
  // Current thumbnails are live-only. Do not serve a saved current avatar.
  return res.status(404).end();
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
server.requestTimeout = BLOXIFY_REQUEST_TIMEOUT;
server.timeout = BLOXIFY_REQUEST_TIMEOUT;
server.keepAliveTimeout = 120000;
server.headersTimeout = BLOXIFY_REQUEST_TIMEOUT + 5000;
