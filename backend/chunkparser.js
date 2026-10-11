import { parentPort, workerData } from "worker_threads";
import fs from "fs";
import readline from "readline";

/* ---------- helpers (mirrors server.js logic) ---------- */
function ts(v) {
  if (!v) return null;
  return String(v).replace(/\D/g, "").padEnd(14, "0").slice(0, 14);
}

function isAvatar(url = "") {
  url = url.toLowerCase();
  return url.includes("avatar") || url.includes("headshot") || url.includes("bodyshot");
}

async function parseFile(filePath, targetId = "") {
  const entries = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line) continue;

    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (obj.type !== "user" || !obj.id || !Array.isArray(obj.images)) continue;
    if (targetId && String(obj.id) !== String(targetId)) continue;

    const avatars = [];
    for (const img of obj.images) {
      if (!isAvatar(img.url)) continue;

      const stamp = ts(img.backlinks?.[0]?.timestamp || img.first_seen || img.last_seen);

      avatars.push({
        url: img.url,
        wayback: stamp
          ? `https://web.archive.org/web/${stamp}im_/${img.url}`
          : `https://web.archive.org/web/*/${img.url}`,
      });
    }

    if (avatars.length) entries.push([String(obj.id), avatars]);
  }

  return entries;
}

(async () => {
  const { files, targetId = "" } = workerData;
  const out = [];

  for (const file of files) {
    try {
      const entries = await parseFile(file, targetId);
      out.push(...entries);
    } catch (err) {
      // one bad/corrupt chunk file shouldn't kill the whole build
      parentPort.postMessage({ warn: `Failed to parse ${file}: ${err.message}` });
    }
  }

  parentPort.postMessage({ done: out });
})();
