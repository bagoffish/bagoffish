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
const BACKEND_VERSION = "2026-10-07-robloxify-demucs-fix";

const THUMBNAIL_CHUNKS_PATH = path.join(__dirname, "thumbnail_chunks");
const CACHE_PATH = path.join(__dirname, "avatar_index_cache.json");
const WORKER_PATH = path.join(__dirname, "chunkparser.js");
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

// NOTE: Full server restored in follow-up if truncated - critical path only for now
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} (${BACKEND_VERSION})`);
});
