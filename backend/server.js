import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_VERSION = "2026-10-06-robloxify-web-ai";

const THUMBNAIL_CHUNKS_PATH = path.join(__dirname, "thumbnail_chunks");
const CACHE_PATH = path.join(__dirname, "avatar_index_cache.json");
const WORKER_PATH = path.join(__dirname, "chunkparser.js");
const VISITOR_COUNT_PATH = process.env.VISITOR_COUNT_PATH || "/var/data/visitor-count-v2.json";
const COMMUNITY_DIR = process.env.COMMUNITY_DIR || "/var/data/robloxify-community";
const COMMUNITY_AUDIO_DIR = path.join(COMMUNITY_DIR, "audio");
const COMMUNITY_INDEX_PATH = path.join(COMMUNITY_DIR, "tracks.json");

const allowedOrigins = [
  "https://bagof.fish",
  "https://www.bagof.fish",
  "http://localhost:3000",
  "http://localhost:3001",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

app.use((req, res, next) => {
  setCors(req, res);
  res.setHeader("X-WinXP-Backend", BACKEND_VERSION);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Accept", "Content-Type"],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.type("text").send("ok");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "winxp-7yes", version: BACKEND_VERSION });
});

let visitorCountQueue = Promise.resolve();
let memoryVisitorCount = 0;
const memoryVisitorIds = new Set();

function parseVisitorCookie(req) {
  const raw = String(req.headers.cookie || "");
  const match = raw.match(/(?:^|;\\s*)bagof-fish-visitor=([^;]+)/);
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
    console.error("Visitor counter read error:", err);
    res.status(500).json({ error: "Visitor counter unavailable" });
  }
});

app.get("/visitor-count/visit", async (req, res) => {
  const visitorId = String(
    req.query.visitor ||
    req.headers["x-visitor-id"] ||
    parseVisitorCookie(req) ||
    ""
  ).trim();

  if (!visitorId || visitorId.length > 200) {
    return res.status(400).json({ error: "Visitor cookie required" });
  }

  visitorCountQueue = visitorCountQueue.then(async () => {
    let { count, seen } = await getVisitorState();

    if (!seen.has(visitorId)) {
      seen.add(visitorId);
      count += 1;

      try {
        await fs.promises.mkdir(path.dirname(VISITOR_COUNT_PATH), { recursive: true });
        await fs.promises.writeFile(
          VISITOR_COUNT_PATH,
          JSON.stringify({
            count,
            visitors: Array.from(seen).slice(-100000),
          }),
          "utf8"
        );
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
    console.error("Visitor counter error:", err);
    res.status(500).json({ error: "Visitor counter unavailable" });
  }
});


/* ---------- avatar index ---------- */
const avatarIndex = new Map();

function fingerprintChunks(dir, files) {
  let totalSize = 0;
  let totalMtime = 0;
  for (const f of files) {
    const stat = fs.statSync(path.join(dir, f));
    totalSize += stat.size;
    totalMtime += Math.floor(stat.mtimeMs);
  }
  return `${files.length}:${totalSize}:${totalMtime}`;
}

function loadFromCache(fingerprint) {
  if (!fs.existsSync(CACHE_PATH)) return false;
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.fingerprint !== fingerprint) return false;
    for (const [id, avatars] of parsed.entries) {
      avatarIndex.set(id, avatars);
    }
    return true;
  } catch {
    return false;
  }
}

function saveToCache(fingerprint) {
  try {
    const entries = Array.from(avatarIndex.entries());
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ fingerprint, entries }));
  } catch (err) {
    console.warn("Could not write avatar index cache:", err.message);
  }
}

function mergeAvatars(id, avatars) {
  const existing = avatarIndex.get(id);
  if (!existing) {
    avatarIndex.set(id, avatars);
    return;
  }
  const seenUrls = new Set(existing.map((a) => a.url));
  for (const a of avatars) {
    if (!seenUrls.has(a.url)) {
      existing.push(a);
      seenUrls.add(a.url);
    }
  }
}

function parseFilesInWorker(files) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData: { files } });
    const collected = [];
    worker.on("message", (msg) => {
      if (msg.warn) console.warn(msg.warn);
      else if (msg.done) collected.push(...msg.done);
    });
    worker.once("error", reject);
    worker.once("exit", () => resolve(collected));
  });
}

async function buildFromChunksParallel(files) {
  const workerCount = Math.max(1, Math.min(os.cpus().length, files.length));
  const buckets = Array.from({ length: workerCount }, () => []);
  files.forEach((f, i) =>
    buckets[i % workerCount].push(path.join(THUMBNAIL_CHUNKS_PATH, f))
  );
  const t0 = Date.now();
  const results = await Promise.all(
    buckets.filter((b) => b.length).map(parseFilesInWorker)
  );
  for (const entries of results) {
    for (const [id, avatars] of entries) mergeAvatars(id, avatars);
  }
  console.log(
    `Avatar index built from ${files.length} chunk files across ${workerCount} workers in ${Date.now() - t0}ms (${avatarIndex.size} users)`
  );
}

async function buildAvatarIndex() {
  if (!fs.existsSync(THUMBNAIL_CHUNKS_PATH)) return;
  const files = (await fs.promises.readdir(THUMBNAIL_CHUNKS_PATH)).filter((f) =>
    f.endsWith(".jsonl")
  );
  if (!files.length) return;
  const fingerprint = fingerprintChunks(THUMBNAIL_CHUNKS_PATH, files);
  const t0 = Date.now();
  if (loadFromCache(fingerprint)) {
    console.log(
      `Avatar index loaded from cache in ${Date.now() - t0}ms (${avatarIndex.size} users)`
    );
    return;
  }
  await buildFromChunksParallel(files);
  saveToCache(fingerprint);
}

const avatarIndexReady = buildAvatarIndex().catch((err) => {
  console.error("Avatar index build failed:", err);
});

/* ---------- cache ---------- */
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;


/* ---------- Robloxify player list ---------- */
const PLAYERS_DIR = process.env.PLAYERS_DIR || "/var/data/robloxify-players";
const PLAYERS_INDEX_PATH = path.join(PLAYERS_DIR, "players.json");
let memoryPlayers = new Map();

function normalizePlayerName(value) {
  return String(value || "").trim().replace(/\\s+/g, " ");
}
function playerKey(value) {
  return normalizePlayerName(value).toLocaleLowerCase();
}
function validPlayerName(value) {
  return /^[A-Za-z0-9._-]{2,20}(?: [A-Za-z0-9._-]{1,20})*$/.test(value);
}
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
    if (err.code !== "ENOENT" && !["EACCES","EROFS"].includes(err.code)) {
      console.warn("Player store unavailable:", err.message);
    }
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
function projectsForPlayer(player) {
  return Array.isArray(player.projects) ? player.projects.slice(0, 100) : [];
}
app.post("/players/register", async (req, res) => {
  try {
    await readPlayers();
    const name = normalizePlayerName(req.body?.name);
    if (!validPlayerName(name)) {
      return res.status(400).json({ error: "Names must be 2-20 characters and use letters, numbers, spaces, dots, underscores, or hyphens." });
    }
    const key = playerKey(name);
    const existing = memoryPlayers.get(key);
    if (existing && existing.name !== name) {
      return res.status(409).json({ error: "That player name is already taken." });
    }
    const player = existing || { name, createdAt: new Date().toISOString(), projects: [] };
    memoryPlayers.set(key, player);
    await writePlayers(Array.from(memoryPlayers.values()));
    res.json({ ok: true, player: { name: player.name, createdAt: player.createdAt }, projects: projectsForPlayer(player), tracks: [] });
  } catch (err) {
    console.error("Player registration error:", err);
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
    console.error("Player lookup error:", err);
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
    console.error("Player project save error:", err);
    res.status(500).json({ error: "Could not save project." });
  }
});

/* ---------- Robloxify community places ---------- */
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

app.use("/community/audio", express.static(COMMUNITY_AUDIO_DIR, {
  fallthrough: false,
  maxAge: "1h",
  index: false,
}));

app.get("/community/tracks", async (req, res) => {
  try {
    const tracks = await readCommunityTracks();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      tracks: tracks.map(track => ({
        ...track,
        audioUrl: "/community/audio/" + encodeURIComponent(track.file),
      })),
    });
  } catch (err) {
    console.error("Community list error:", err);
    res.status(500).json({ error: "Could not load community places" });
  }
});

app.post("/community/tracks", async (req, res) => {
  try {
    const multer = (await import("multer")).default;
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024, files: 1 },
      fileFilter: (request, file, callback) => {
        const allowed = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/ogg", "audio/webm"]);
        callback(null, allowed.has(file.mimetype));
      },
    }).single("audio");

    await new Promise((resolve, reject) => {
      upload(req, res, err => err ? reject(err) : resolve());
    });

    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "A place name is required." });
    if (name.length > 40) return res.status(400).json({ error: "Place names must be 40 characters or shorter." });
    if (!req.file) return res.status(400).json({ error: "Upload a rendered audio file first." });

    const tracks = await readCommunityTracks();
    if (tracks.some(track => track.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return res.status(409).json({ error: "That place name is already taken." });
    }

    const id = crypto.randomUUID();
    const ext = req.file.mimetype === "audio/mpeg" ? ".mp3" : req.file.mimetype === "audio/ogg" ? ".ogg" : ".wav";
    const file = id + ext;
    await fs.promises.writeFile(path.join(COMMUNITY_AUDIO_DIR, file), req.file.buffer);

    const track = {
      id,
      name,
      file,
      createdAt: new Date().toISOString(),
    };
    tracks.unshift(track);
    await writeCommunityTracks(tracks);
    res.status(201).json({ ok: true, track: { ...track, audioUrl: "/community/audio/" + encodeURIComponent(file) } });
  } catch (err) {
    console.error("Community upload error:", err);
    res.status(400).json({ error: "Could not publish this place." });
  }
});

/* ---------- API: proxy-roblox ---------- */
app.get("/proxy-roblox-avatar", async (req, res) => {
  const source = String(req.query.url || "");
  if (!source) return res.status(400).end();
  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    return res.status(400).end();
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).end();

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": "WinXP Renderer/1.0" },
    });
    if (!upstream.ok || !upstream.body) return res.status(upstream.status || 502).end();

    const contentType = upstream.headers.get("content-type") || "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error("proxy-roblox-avatar error:", err.message);
    res.status(502).end();
  }
});

app.get("/proxy-roblox", async (req, res) => {
  setCors(req, res);

  // The thumbnail index is built from the bundled .jsonl chunks at startup.
  // Always wait for it before serving a lookup so the first request cannot
  // cache an incomplete avatar result.
  await avatarIndexReady;
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Username required" });

  const key = String(username).toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.t < CACHE_TTL) return res.json(cached.d);

  try {
    const userRes = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    }).then((r) => r.json());

    const id = userRes?.data?.[0]?.id;
    if (!id) return res.status(404).json({ error: "Not found" });

    const profile = await fetch(`https://users.roblox.com/v1/users/${id}`).then(
      (r) => r.json()
    );

    const avatarRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png`
    ).then((r) => r.json());

    let pastUsernames = [];
    try {
      const pastRes = await fetch(
        `https://users.roblox.com/v1/users/${id}/username-history`
      );
      if (pastRes.ok) {
        const pastData = await pastRes.json();
        pastUsernames = pastData.data?.map((x) => x.name) || [];
      }
    } catch {}

    let roli = {};
    try {
      const r = await fetch(
        `https://api.rolimons.com/players/v1/playerinfo/${id}`
      );
      if (r.ok) {
        const j = await r.json();
        roli = {
          rap: j.rap ?? "Unknown",
          value: j.value ?? "Unknown",
          terminated: !!j.terminated,
          lastOnline: j.last_online
            ? new Date(j.last_online * 1000).toUTCString().replace(" GMT", "")
            : "Unknown",
        };
      }
    } catch {}

    const chunkAvatars = avatarIndex.get(String(id)) || [];
    const chunkAvatarUrl = chunkAvatars.find((avatar) => avatar && avatar.url)?.url || "";
    const liveAvatarUrl = avatarRes?.data?.[0]?.imageUrl || "";
    const avatarSourceUrl = liveAvatarUrl || chunkAvatarUrl;
    const avatarUrl = avatarSourceUrl
      ? `https://winxp-backend-live.onrender.com/proxy-roblox-avatar?url=${encodeURIComponent(avatarSourceUrl)}`
      : "";

    const payload = {
      roblox: {
        id,
        username: profile.name,
        displayName: profile.displayName,
        joinDate: profile.created
          ? new Date(profile.created).toUTCString().replace(" GMT", "")
          : "Unknown",
        // Prefer the avatar captured in the thumbnail chunks. Roblox's live
        // thumbnail endpoint remains a fallback for users absent from the chunks.
        avatarUrl: avatarUrl || liveAvatarUrl,
        oldAvatars: chunkAvatars.slice(0, 100),
        pastUsernames,
      },
      rolimons: roli,
    };

    cache.set(key, { d: payload, t: Date.now() });
    res.json(payload);
  } catch (err) {
    console.error("proxy-roblox error:", err);
    setCors(req, res);
    res.status(500).json({ error: "Internal error" });
  }
});

/* ---------- API: robloxify (lazy-loaded so missing deps do not kill the server) ---------- */
let robloxifyBusy = false;
let robloxifyModulePromise = null;

async function loadRobloxify() {
  if (!robloxifyModulePromise) {
    robloxifyModulePromise = (async () => {
      const multer = (await import("multer")).default;
      const { transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS } = await import(
        "./robloxify.js"
      );
      return { multer, transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS };
    })().catch((err) => {
      robloxifyModulePromise = null;
      throw err;
    });
  }
  return robloxifyModulePromise;
}

app.post("/robloxify", async (req, res) => {
  setCors(req, res);
  try {
    const { multer, transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS } =
      await loadRobloxify();
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: ROBLOXIFY_LIMITS.MAX_BYTES, files: 1 },
    }).single("audio");

    await new Promise((resolve, reject) => {
      upload(req, res, (err) => (err ? reject(err) : resolve()));
    });

    if (robloxifyBusy) {
      return res.status(503).json({
        error:
          "Robloxify is busy processing another file. Try again in a moment.",
      });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Audio file required (field name: audio)" });
    }

    robloxifyBusy = true;
    const t0 = Date.now();
    try {
      const result = await transcribeAudioBuffer(req.file.buffer);
      const aiPlan = await createRobloxifyStylePlan(result.notes, result.duration);
      res.json({
        ok: true,
        notes: result.notes,
        duration: result.duration,
        sampleRate: result.sampleRate,
        noteCount: result.noteCount,
        aiPlan,
        ms: Date.now() - t0,
        version: BACKEND_VERSION,
      });
    } finally {
      robloxifyBusy = false;
    }
  } catch (err) {
    console.error("Robloxify failed:", err);
    setCors(req, res);
    const msg = err && err.message ? err.message : "Transcription failed";
    const status = /too large|shorter|Empty|busy/i.test(msg) ? 400 : 500;
    res.status(status).json({ error: msg });
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
  } else {
    next(err);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} (${BACKEND_VERSION})`);
});
