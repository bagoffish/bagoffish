// Refreshes public/avatar/avatar.json from Roblox so Coy's R6 avatar follows your outfit.
// Run by .github/workflows/sync-avatar.yml; also works locally: node scripts/sync-avatar.mjs
// Uses unofficial Roblox endpoints, which can change without notice.
import fs from "fs";
import crypto from "crypto";

const USER_ID = process.env.ROBLOX_USER_ID || "37753591";
const OUT = "public/avatar/avatar.json";

// Partial BrickColor table, used only if the API returns color IDs instead of hex values.
const BRICK = { 1: "F2F3F3", 5: "D7C59A", 18: "CC8E69", 21: "C4281C", 23: "0D69AC", 24: "F5CD30", 26: "1B2A35",
  28: "287F47", 37: "4B974B", 38: "A05F35", 101: "DA867A", 102: "6E99CA", 104: "6B327C", 106: "DA8541",
  125: "EAB892", 192: "694028", 194: "A3A2A5", 199: "635F62", 217: "7C5C46", 1001: "F8F8F8", 1002: "CDCDCD",
  1003: "111111", 1004: "FF0000", 1010: "0000FF", 1011: "002060", 1013: "04AFEC", 1016: "FF66CC" };

// Roblox CDN: a file hash maps to one of t0..t7.rbxcdn.com.
const cdn = h => { let i = 31; for (const c of h) i ^= c.charCodeAt(0); return `https://t${i % 8}.rbxcdn.com/${h}`; };
const getJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(url + " " + r.status); return r.json(); };

// Downloads the 3D model (OBJ + MTL + textures) when it changed. Returns the metadata the site needs,
// or the previous metadata if Roblox has not finished rendering the new one.
async function syncModel(prevModel) {
  try {
    const t = await getJson(`https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${USER_ID}`);
    if (t.state !== "Completed" || !t.imageUrl) { console.log("3D render not ready:", t.state); return prevModel || null; }
    const m = await getJson(t.imageUrl);                   // { obj, mtl, textures: [hash, ...] }
    if (!m.obj || !m.mtl) throw new Error("model description has no obj/mtl: " + JSON.stringify(m).slice(0, 200));
    const hash = crypto.createHash("sha1").update(JSON.stringify([m.obj, m.mtl, m.textures])).digest("hex").slice(0, 10);
    if (prevModel && prevModel.hash === hash) return prevModel;
    const files = { "avatar.obj": m.obj, "avatar.mtl": m.mtl };
    for (const h of m.textures || []) files[h] = h;
    const save = async (name, h) => {
      const r = await fetch(cdn(h));
      if (!r.ok) throw new Error(cdn(h) + " " + r.status);
      fs.writeFileSync(`public/avatar/${name}`, Buffer.from(await r.arrayBuffer()));
    };
    fs.mkdirSync("public/avatar", { recursive: true });
    for (const [name, h] of Object.entries(files)) await save(name, h);
    for (const f of fs.readdirSync("public/avatar")) {      // remove textures from older outfits
      if (f !== "avatar.json" && !(f in files)) fs.unlinkSync(`public/avatar/${f}`);
    }
    console.log("downloaded model", hash, Object.keys(files));
    return { obj: "avatar.obj", mtl: "avatar.mtl", hash };
  } catch (e) {
    console.warn("3D model sync failed, keeping previous:", e.message);
    return prevModel || null;
  }
}

const hex = v => (v ? "#" + String(v).replace(/^#/, "") : null);
const res = await fetch(`https://avatar.roblox.com/v1/users/${USER_ID}/avatar`);
if (!res.ok) { console.error("Roblox avatar API failed:", res.status); process.exit(0); }  // keep the old file
const info = await res.json();

if (info.playerAvatarType && info.playerAvatarType !== "R6") console.warn("Avatar type is", info.playerAvatarType, "- switch it to R6 on Roblox");

const c3 = info.bodyColor3s || {};
const ids = info.bodyColors || {};
const pick = (c3Key, idKey) => hex(c3[c3Key]) || (BRICK[ids[idKey]] ? "#" + BRICK[ids[idKey]] : null);
const bodyColors = Object.fromEntries(Object.entries({
  head: pick("headColor3", "headColorId"),
  torso: pick("torsoColor3", "torsoColorId"),
  leftArm: pick("leftArmColor3", "leftArmColorId"),
  rightArm: pick("rightArmColor3", "rightArmColorId"),
  leftLeg: pick("leftLegColor3", "leftLegColorId"),
  rightLeg: pick("rightLegColor3", "rightLegColorId"),
}).filter(([, v]) => v));                                   // missing parts fall back to defaults in the component

let prevMeta = {};
try { prevMeta = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
const model = await syncModel(prevMeta.model);

const assets = (info.assets || []).map(a => a.id).sort((a, b) => a - b);
const version = crypto.createHash("sha1").update(JSON.stringify([bodyColors, assets, model && model.hash])).digest("hex").slice(0, 10);

if (prevMeta.version === version) { console.log("unchanged"); process.exit(0); }

fs.mkdirSync("public/avatar", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version, rig: info.playerAvatarType || "R6", bodyColors, model, assets, updated: new Date().toISOString() }, null, 2) + "\n");
console.log("updated", version, bodyColors);
