#!/usr/bin/env node
/**
 * Inspect local Roblox binary animation models. Files are never uploaded.
 * Usage: node scripts/inspect-rbxm-animations.mjs "<folder>"
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let reader;
try {
  reader = require("rbx-reader");
} catch {
  console.error("Parser is not installed. Run: npm install --no-save rbx-reader");
  process.exit(1);
}

const folder = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
  console.error('Usage: node scripts/inspect-rbxm-animations.mjs "C:\\Users\\coy29\\Downloads\\anims"');
  process.exit(1);
}
const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith(".rbxm")).sort();
if (!files.length) {
  console.error("No .rbxm files found in:", folder);
  process.exit(1);
}

function valueOf(instance, key) {
  try {
    if (typeof instance.get_property === "function") return instance.get_property(key);
    if (typeof instance.GetProperty === "function") return instance.GetProperty(key);
    return instance.properties?.[key] ?? instance[key];
  } catch { return undefined; }
}
function childrenOf(instance) {
  if (Array.isArray(instance?.children)) return instance.children;
  if (Array.isArray(instance?.Children)) return instance.Children;
  try { if (typeof instance?.GetChildren === "function") return instance.GetChildren(); } catch {}
  return [];
}
function short(value, depth = 0) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (depth > 2) return Object.prototype.toString.call(value);
  if (Array.isArray(value)) return value.slice(0, 12).map(v => short(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).slice(0, 20)) {
      if (typeof value[key] !== "function") out[key] = short(value[key], depth + 1);
    }
    return Object.keys(out).length ? out : Object.prototype.toString.call(value);
  }
  return String(value);
}
function walk(instance, rows, depth = 0) {
  const cls = instance?.class_name || instance?.ClassName || instance?.className || "(unknown class)";
  const name = valueOf(instance, "Name") ?? instance?.name ?? instance?.Name ?? "(unnamed)";
  const row = { depth, className: cls, name: String(name) };
  if (cls === "KeyframeSequence") {
    row.priority = short(valueOf(instance, "Priority"));
    row.loop = short(valueOf(instance, "Loop"));
  } else if (cls === "Keyframe") {
    row.time = short(valueOf(instance, "Time"));
  } else if (cls === "Pose") {
    row.cframe = short(valueOf(instance, "CFrame"));
    row.easingStyle = short(valueOf(instance, "EasingStyle"));
    row.easingDirection = short(valueOf(instance, "EasingDirection"));
  }
  rows.push(row);
  for (const child of childrenOf(instance)) walk(child, rows, depth + 1);
}
let failed = 0;
for (const filename of files) {
  try {
    const parsed = reader.parseBuffer(fs.readFileSync(path.join(folder, filename)));
    if (!parsed) throw new Error("Parser returned no model; the file may be unsupported.");
    const roots = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed.tree) ? parsed.tree
      : Array.isArray(parsed.children) ? parsed.children
      : [parsed];
    const rows = [];
    for (const root of roots) walk(root, rows);
    const report = {
      file: filename,
      sequences: rows.filter(r => r.className === "KeyframeSequence").length,
      keyframes: rows.filter(r => r.className === "Keyframe").length,
      poses: rows.filter(r => r.className === "Pose").length,
      hierarchy: rows
    };
    console.log("\\n=== " + filename + " ===");
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    failed++;
    console.error("\\nFAILED " + filename + ": " + (error?.stack || error));
  }
}
if (failed) process.exitCode = 1;
