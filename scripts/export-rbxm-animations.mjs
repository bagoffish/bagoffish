#!/usr/bin/env node
/**
 * Export Roblox KeyframeSequence data from local .rbxm files to compact JSON.
 * Files stay local; output is written to public/avatar/animations.json by default.
 * Usage: node scripts/export-rbxm-animations.mjs "C:\\Users\\coy29\\Downloads\\anims"
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let reader;
try { reader = require("rbx-reader"); }
catch { console.error("Parser missing. Run: npm install --no-save rbx-reader"); process.exit(1); }

const folder = path.resolve(process.argv[2] || "");
const output = path.resolve(process.argv[3] || "public/avatar/animations.json");
if (!process.argv[2] || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
  console.error('Usage: node scripts/export-rbxm-animations.mjs "<folder>" ["output.json"]');
  process.exit(1);
}
const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith(".rbxm")).sort();
function cls(i) { return String(i?.ClassName || i?.class_name || i?.className || ""); }
function name(i) { return String(valueOf(i, "Name") ?? i?.Name ?? i?.name ?? ""); }
function valueOf(i, key) {
  try {
    if (typeof i?.getProperty === "function") return i.getProperty(key);
    if (typeof i?.get_property === "function") return i.get_property(key);
    if (typeof i?.GetProperty === "function") return i.GetProperty(key);
    return i?.Properties?.[key]?.value ?? i?.properties?.[key] ?? i?.[key];
  } catch { return undefined; }
}
function childrenOf(i) {
  if (Array.isArray(i?.Children)) return i.Children;
  if (Array.isArray(i?.children)) return i.children;
  if (Array.isArray(i?.tree)) return i.tree;
  try {
    if (typeof i?.getChildren === "function") return i.getChildren();
    if (typeof i?.GetChildren === "function") return i.GetChildren();
  } catch {}
  return [];
}
function plain(v, depth = 0) {
  if (v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (depth > 4) return null;
  if (Array.isArray(v)) return v.map(x => plain(x, depth + 1));
  if (typeof v === "object") {
    if (Array.isArray(v.components)) return v.components.map(Number);
    const keys = Object.keys(v);
    const out = {};
    for (const k of keys) if (typeof v[k] !== "function") out[k] = plain(v[k], depth + 1);
    return out;
  }
  return null;
}
function findAll(root, predicate, out = []) {
  if (predicate(root)) out.push(root);
  for (const child of childrenOf(root)) findAll(child, predicate, out);
  return out;
}
function readPose(pose, out) {
  const cf = plain(valueOf(pose, "CFrame"));
  if (Array.isArray(cf) && cf.length >= 12 && cf.every(Number.isFinite)) out[name(pose)] = cf.slice(0, 12);
  for (const child of childrenOf(pose)) if (cls(child) === "Pose") readPose(child, out);
}
function readSequence(sequence) {
  const frames = findAll(sequence, i => cls(i) === "Keyframe").map(keyframe => {
    const poses = {};
    for (const child of childrenOf(keyframe)) if (cls(child) === "Pose") readPose(child, poses);
    return { time: Number(valueOf(keyframe, "Time")) || 0, poses };
  }).sort((a, b) => a.time - b.time);
  return {
    duration: frames.reduce((max, f) => Math.max(max, f.time), 0),
    loop: true,
    priority: valueOf(sequence, "Priority") ?? null,
    frames
  };
}
const animations = {};
const errors = [];
for (const file of files) {
  try {
    const parsed = reader.parseBuffer(fs.readFileSync(path.join(folder, file)));
    const roots = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.result) ? parsed.result
      : Array.isArray(parsed?.tree) ? parsed.tree
      : Array.isArray(parsed?.children) ? parsed.children
      : [parsed?.result || parsed];
    const sequences = roots.flatMap(root => findAll(root, i => cls(i) === "KeyframeSequence"));
    if (!sequences.length) throw new Error("No KeyframeSequence found");
    const key = path.basename(file, path.extname(file)).toLowerCase();
    animations[key] = readSequence(sequences[0]);
    console.log(key + ": " + animations[key].frames.length + " keyframes, " + Object.keys(animations[key].frames[0]?.poses || {}).length + " top-level poses");
  } catch (error) {
    errors.push(file + ": " + (error?.message || error));
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ version: 1, animations }, null, 2) + "\n");
console.log("Wrote " + output + " (" + Object.keys(animations).length + " animations)");
