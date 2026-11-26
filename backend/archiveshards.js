// Per-user archive shards published as GitHub release assets.
//
// Each release has a manifest.json:
//   { "shards": 1000, "prefix": "gw-s", "suffix": ".txt.gz", "records": 123, "users": 45 }
// and shard files <prefix><userId % shards><suffix>. A shard is gzip-compressed text,
// one record per line: "<userId>\t<json>", grouped by user and sorted inside each user.
import { gunzipSync } from "zlib";

export function shardNumber(userId, count) {
  return Number(BigInt(String(userId)) % BigInt(count));
}

// Find every record for userId without splitting the whole shard into lines.
export function findUserRecords(text, userId) {
  const records = [];
  if (typeof text !== "string" || !/^\d+$/.test(String(userId))) return records;
  const needle = `${userId}\t`;
  let pos = text.startsWith(needle) ? 0 : text.indexOf("\n" + needle);
  if (pos > 0) pos += 1;
  while (pos !== -1 && pos < text.length) {
    const end = text.indexOf("\n", pos);
    const line = text.slice(pos + needle.length, end === -1 ? text.length : end);
    try {
      const value = JSON.parse(line);
      if (value && typeof value === "object") records.push(value);
    } catch {}
    if (end === -1) break;
    // Records for one user are contiguous; stop at the first line for someone else.
    if (text.startsWith(needle, end + 1)) pos = end + 1;
    else {
      const next = text.indexOf("\n" + needle, end);
      pos = next === -1 ? -1 : next + 1;
    }
  }
  return records;
}

export function createShardStore({ releaseBase, fetchImpl, cacheLimit = 6, timeoutMs = 45000, version = "1" }) {
  let manifest = null;
  let manifestAt = 0;
  const cache = new Map();
  const inflight = new Map();

  async function timedFetch(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        signal: controller.signal,
        headers: { "User-Agent": "bagof.fish-user-checker/1.0", "Accept": "application/octet-stream" },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function getManifest() {
    if (manifest && Date.now() - manifestAt < 30 * 60 * 1000) return manifest;
    const response = await timedFetch(`${releaseBase}/manifest.json?v=${version}`);
    if (!response.ok) {
      const err = new Error(`manifest HTTP ${response.status}`);
      err.code = response.status === 404 ? "ARCHIVE_NOT_PUBLISHED" : "ARCHIVE_UNAVAILABLE";
      throw err;
    }
    const body = await response.json();
    const shards = Number(body.shards);
    if (!Number.isInteger(shards) || shards < 1) throw new Error("manifest has no shard count");
    manifest = { shards, prefix: String(body.prefix || "s"), suffix: String(body.suffix || ".txt.gz"), meta: body };
    manifestAt = Date.now();
    return manifest;
  }

  async function loadShard(name) {
    if (cache.has(name)) {
      const text = cache.get(name);
      cache.delete(name);
      cache.set(name, text);
      return text;
    }
    if (inflight.has(name)) return inflight.get(name);
    const job = (async () => {
      const response = await timedFetch(`${releaseBase}/${name}?v=${version}`);
      if (response.status === 404) return "";
      if (!response.ok) {
        const err = new Error(`shard HTTP ${response.status}`);
        err.code = "ARCHIVE_UNAVAILABLE";
        throw err;
      }
      const text = gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
      cache.set(name, text);
      while (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
      return text;
    })().finally(() => inflight.delete(name));
    inflight.set(name, job);
    return job;
  }

  async function recordsFor(userId) {
    const m = await getManifest();
    const name = `${m.prefix}${shardNumber(userId, m.shards)}${m.suffix}`;
    const text = await loadShard(name);
    return { records: findUserRecords(text, userId), shard: name, manifest: m.meta };
  }

  return { recordsFor, getManifest };
}

export function pageOf(list, offsetRaw, limitRaw, maxLimit = 100) {
  const offset = Math.max(0, Number.parseInt(offsetRaw, 10) || 0);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(limitRaw, 10) || 25));
  const items = list.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return { items, offset, limit, total: list.length, nextOffset: nextOffset < list.length ? nextOffset : null };
}
