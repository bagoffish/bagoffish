// Ensure the classic Roblox Grapple Hook's Connect and Hit clips are served
// locally. The four sword/fire clips already live in public/sounds/coy-tools.
// Download at build time so gameplay never depends on Roblox CORS or redirects.
const fs = require("fs");
const path = require("path");

const DEST = path.resolve(__dirname, "..", "public", "sounds", "coy-tools");
const ASSETS = [
  { id: 13510737, name: "grapple-connect.mp3" },
  { id: 16211030, name: "grapple-hit.mp3" },
];
const SOURCES = id => [
  "https://assetdelivery.roblox.com/v1/asset/?id=" + id,
  "https://www.roblox.com/asset/?id=" + id,
];

function looksLikeAudio(bytes) {
  if (!bytes || bytes.length < 128) return false;
  const ascii = bytes.subarray(0, 4).toString("ascii");
  return ascii === "ID3" || ascii === "OggS" || ascii === "fLaC" ||
    ascii === "RIFF" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
}

async function download({ id, name }) {
  const target = path.join(DEST, name);
  if (fs.existsSync(target) && looksLikeAudio(fs.readFileSync(target))) {
    console.log("Classic Roblox gear sound already present: " + name);
    return;
  }

  let lastError;
  for (const url of SOURCES(id)) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "bagof.fish classic gear sound build fetcher" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const contentType = response.headers.get("content-type") || "";
      if (/text\/html|application\/json/i.test(contentType)) {
        throw new Error("non-audio response (" + contentType + ")");
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!looksLikeAudio(bytes)) throw new Error("response did not contain a recognized audio file");
      fs.mkdirSync(DEST, { recursive: true });
      const temporary = target + ".download";
      fs.writeFileSync(temporary, bytes);
      fs.renameSync(temporary, target);
      console.log("Downloaded classic Roblox gear sound " + id + " to " + name + " (" + bytes.length + " bytes)");
      return;
    } catch (error) {
      lastError = error;
      console.warn("Could not fetch Roblox sound " + id + " from " + url + ": " + (error.message || error));
    }
  }
  throw new Error("Could not prepare required local gear sound " + id + " (" + name + "): " + (lastError && lastError.message));
}

(async () => {
  try {
    for (const asset of ASSETS) await download(asset);
    console.log("All classic Roblox grapple audio clips are ready locally.");
  } catch (error) {
    console.error("Failed to prepare classic Roblox gear audio:", error.message || error);
    process.exitCode = 1;
  }
})();
