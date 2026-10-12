#!/usr/bin/env node
/**
 * Inspect locally stored Roblox .rbxm files without uploading them anywhere.
 *
 * Usage:
 *   node scripts/inspect-rbxm-animations.mjs "C:\\path\\to\\animations"
 *
 * This intentionally reports the KeyframeSequence/Pose hierarchy and CFrame
 * property shapes first. It does not guess at joint transforms or generate
 * runtime animation data until the file's actual structure is confirmed.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let RobloxFile;
try {
  ({ RobloxFile } = require("rbxm-parser"));
} catch {
  console.error("Missing optional parser. From the project folder run:");
  console.error("  npm install --no-save rbxm-parser");
  process.exit(1);
}

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/inspect-rbxm-animations.mjs "<folder containing .rbxm files>"');
  process.exit(1);
}
const folder = path.resolve(input);
if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
  console.error("Folder not found:", folder);
  process.exit(1);
}

function childrenOf(instance) {
  try {
    if (typeof instance.GetChildren === "function") return instance.GetChildren();
    if (typeof instance.GetChildren === "undefined" && Array.isArray(instance.Children)) return instance.Children;
    if (Array.isArray(instance.children)) return instance.children;
  } catch {}
  return [];
}
function nameOf(instance) {
  try { return instance.Name || instance.name || instance.GetName?.() || "(unnamed)"; }
  catch { return "(unnamed)"; }
}
function classOf(instance) {
  try { return instance.ClassName || instance.className || instance.GetClassName?.() || "(unknown class)"; }
  catch { return "(unknown class)"; }
}
function prop(instance, key) {
  try {
    if (typeof instance.GetProperty === "function") return instance.GetProperty(key);
    if (typeof instance.get_property === "function") return instance.get_property(key);
    return instance[key];
  } catch { return undefined; }
}
function serialShape(value, depth = 0) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (depth > 2) return Object.prototype.toString.call(value);
  if (Array.isArray(value)) return value.slice(0, 8).map(v => serialShape(v, depth + 1));
  const out = {};
  for (const key of Object.keys(value).slice(0, 20)) {
    const v = value[key];
    if (typeof v !== "function") out[key] = serialShape(v, depth + 1);
  }
  return Object.keys(out).length ? out : Object.prototype.toString.call(value);
}
function walk(instance, rows, depth = 0) {
  const cls = classOf(instance);
  const row = { depth, className: cls, name: nameOf(instance) };
  if (cls === "KeyframeSequence") {
    row.priority = serialShape(prop(instance, "Priority"));
    row.loop = serialShape(prop(instance, "Loop"));
  }
  if (cls === "Keyframe") {
    row.time = serialShape(prop(instance, "Time"));
  }
  if (cls === "Pose") {
    row.cframe = serialShape(prop(instance, "CFrame"));
    row.easingStyle = serialShape(prop(instance, "EasingStyle"));
    row.easingDirection = serialShape(prop(instance, "EasingDirection"));
  }
  rows.push(row);
  for (const child of childrenOf(instance)) walk(child, rows, depth + 1);
}
const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith(".rbxm")).sort();
if (!files.length) {
  console.error("No .rbxm files found in:", folder);
  process.exit(1);
}
let failed = 0;
for (const filename of files) {
  const full = path.join(folder, filename);
  try {
    const file = RobloxFile.ReadFromBuffer(fs.readFileSync(full));
    if (!file) throw new Error("Parser returned no model (invalid/unsupported RBXM)");
    const rows = [];
    const roots = typeof file.GetChildren === "function" ? file.GetChildren()
      : Array.isArray(file.Children) ? file.Children
      : Array.isArray(file.children) ? file.children : [];
    for (const root of roots) walk(root, rows);
    const keyframes = rows.filter(r => r.className === "Keyframe").length;
    const poses = rows.filter(r => r.className === "Pose").length;
    const sequences = rows.filter(r => r.className === "KeyframeSequence").length;
    console.log("\\n=== " + filename + " ===");
    console.log(JSON.stringify({ keyframeSequences: sequences, keyframes, poses, hierarchy: rows }, null, 2));
  } catch (error) {
    failed++;
    console.error("\\nFAILED " + filename + ": " + (error?.stack || error));
  }
}
if (failed) process.exitCode = 1;
