import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_VERSION = "2026-10-06-worker-path-fix";

const THUMBNAIL_CHUNKS_PATH = path.join(__dirname, "thumbnail_chunks");
const CACHE_PATH = path.join(__dirname, "avatar_index_cache.json");
const WORKER_PATH = path.join(__dirname, "chunkparser.js");

const allowedOrigins = new Set([
  "https://bagof.fish",
  "https://www.bagof.fish",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function applyCorsHeaders(req, res, next) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
  }
  next();
}

app.use(applyCorsHeaders);
app.use((req, res, next) => {
  res.setHeader("X-WinXP-Backend", BACKEND_VERSION);
  next();
});
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Accept", "Content-Type"],
  optionsSuccessStatus: 204,
}));

app.options("*", (req, res) => {
  res.sendStatus(204);
});

app.use(express.json());

// health check / root
app.get("/", (req, res) => {
  res.type("text").send("ok");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "winxp-7yes", version: BACKEND_VERSION });
});

/* ---------- avatar index ---------- */
const avatarIndex = new Map();

// Cheap fingerprint of the chunks directory (file count + total bytes +
// summed mtimes) so we can tell whether thumbnail_chunks changed since the
// cache was last built, without re-reading a single byte of file content.
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

// Merges a freshly-parsed avatar list into whatever is already in the
// index for this id, instead of overwriting it. A given Roblox id can
// legitimately appear in more than one chunk file (scraped at different
// times), and every one of those sightings should be kept — the old
// behavior silently dropped whichever chunk didn't process last.
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
      if (msg.warn) {
        console.warn(msg.warn);
      } else if (msg.done) {
        collected.push(...msg.done);
      }
    });
    worker.once("error", reject);
    worker.once("exit", () => resolve(collected));
  });
}

// Splits the chunk files across one worker thread per CPU core and parses
// them all in parallel, instead of the old one-file-at-a-time readline loop.
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
    for (const [id, avatars] of entries) {
      mergeAvatars(id, avatars);
    }
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

  // Fast path: chunks haven't changed since we last built the index, so
  // just load the small precomputed cache instead of re-scanning 8+ GB.
  const t0 = Date.now();
  if (loadFromCache(fingerprint)) {
    console.log(
      `Avatar index loaded from cache in ${Date.now() - t0}ms (${avatarIndex.size} users)`
    );
    return;
  }

  // Slow path (first boot, or thumbnail_chunks changed): parallel build,
  // then cache the result so every future boot takes the fast path above.
  await buildFromChunksParallel(files);
  saveToCache(fingerprint);
}

buildAvatarIndex().catch((err) => console.error("Avatar index build failed:", err));

/* ---------- cache ---------- */
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

/* ---------- API: proxy-roblox ---------- */
app.get("/proxy-roblox", async (req, res) => {
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

    const profile = await fetch(`https://users.roblox.com/v1/users/${id}`).then((r) => r.json());

    const avatarRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png`
    ).then((r) => r.json());

    let pastUsernames = [];
    try {
      const pastRes = await fetch(`https://users.roblox.com/v1/users/${id}/username-history`);
      if (pastRes.ok) {
        const pastData = await pastRes.json();
        pastUsernames = pastData.data?.map((x) => x.name) || [];
      }
    } catch {}

    let roli = {};
    try {
      const r = await fetch(`https://api.rolimons.com/players/v1/playerinfo/${id}`);
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

    const payload = {
      roblox: {
        id,
        username: profile.name,
        displayName: profile.displayName,
        joinDate: profile.created ? new Date(profile.created).toUTCString().replace(" GMT", "") : "Unknown",
        avatarUrl: avatarRes?.data?.[0]?.imageUrl,
        oldAvatars: avatarIndex.get(String(id))?.slice(0, 100) || [],
        pastUsernames,
      },
      rolimons: roli,
    };

    cache.set(key, { d: payload, t: Date.now() });
    res.json(payload);
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

// API 404 (optional, but nice)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Keep CORS headers on unexpected API failures as well.
app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);
  if (!res.headersSent) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.status(500).json({ error: "Internal error" });
  } else {
    next(err);
  }
});

/* ---------- start server ---------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
