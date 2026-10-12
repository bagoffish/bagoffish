// Fetch the original Roblox 2013 green Dialog textures before a production build.
// Archived from the January 17, 2013 Windows Studio client texture package.
// We keep these as normal local public assets so the live site does not hotlink the archive.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEST = path.join(ROOT, "public", "images", "roblox-dialog");
const BASE =
  "https://archive.roblonium.com/Client/Windows/RobloxStudio/main%20%28roblox.com%29/2013/1.2013/January%2017%20%282013.1.16.4%29/version-bff7a07361c84c3c/content/textures/";

const ASSETS = [
  "chatBubble_botGreen_bkg.png",
  "chatBubble_botGreen_tail.png",
  "chatBubble_botGreen_tailRight.png",
];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(file) {
  try {
    const bytes = fs.readFileSync(file);
    return bytes.length > 128 && bytes.subarray(0, 8).equals(PNG_SIGNATURE);
  } catch (_) {
    return false;
  }
}

async function downloadAsset(name) {
  const destination = path.join(DEST, name);
  if (isPng(destination)) {
    console.log("Legacy Roblox texture already present: " + name);
    return;
  }

  const response = await fetch(BASE + name, {
    headers: { "User-Agent": "bagof.fish build asset fetcher" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    throw new Error("Could not download " + name + " (HTTP " + response.status + ")");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 128 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Downloaded file is not a valid PNG: " + name);
  }

  fs.mkdirSync(DEST, { recursive: true });
  const temporary = destination + ".download";
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, destination);
  console.log("Downloaded original 2013 Roblox texture: " + name + " (" + bytes.length + " bytes)");
}

(async () => {
  try {
    for (const name of ASSETS) await downloadAsset(name);
    console.log("Original Roblox green dialog textures are ready in public/images/roblox-dialog/.");
  } catch (error) {
    console.error("Failed to prepare original Roblox dialog textures:", error.message || error);
    process.exitCode = 1;
  }
})();
