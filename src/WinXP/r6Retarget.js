import * as THREE from "three";

// R6 joint-local animation runtime.
//
// The source JSON stores Roblox Pose.CFrame values as 12-number GetComponents()
// arrays. Convert them once when a clip is compiled, then animate with local
// Vector3 + Quaternion tracks. The render loop never decomposes matrices or
// allocates a Matrix4 for every joint on every frame.
export const REST = {
  torso: [0, 3, 0],
  head: [0, 1, 0],
  rArm: [-1, 0.5, 0],
  lArm: [1, 0.5, 0],
  rLeg: [-1, -1, 0],
  lLeg: [1, -1, 0],
};

export const ROBLOX_JOINT_PART = {
  Torso: "torso",
  Head: "head",
  "Right Arm": "rArm",
  "Left Arm": "lArm",
  "Right Leg": "rLeg",
  "Left Leg": "lLeg",
};

const JOINT_NAMES = Object.keys(ROBLOX_JOINT_PART);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const compiledClips = new WeakMap();

function validCFrame(value) {
  return Array.isArray(value) && value.length >= 12 &&
    value.slice(0, 12).every(Number.isFinite);
}

// Roblox GetComponents() is position followed by row-major R00..R22.
// Three.Matrix4.set accepts row-major arguments and stores column-major.
function compileCFrame(value, partName) {
  if (!validCFrame(value) || !REST[partName]) return null;
  const matrix = new THREE.Matrix4().set(
    value[3], value[4], value[5], value[0],
    value[6], value[7], value[8], value[1],
    value[9], value[10], value[11], value[2],
    0, 0, 0, 1
  );

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  // Pose.CFrame is a local Motor6D transform. The mesh groups are already
  // positioned at the R6 joint pivots, so apply its local translation as an
  // offset from that pivot. Keep the rotation local to the joint as well.
  position.add(new THREE.Vector3(...REST[partName]));
  quaternion.normalize();
  return { position, quaternion };
}

const EASING_STYLE = ["Linear", "Constant", "Elastic", "Cubic", "Bounce", "CubicV2"];
const EASING_DIRECTION = ["In", "Out", "InOut"];

function enumLabel(value, labels) {
  if (typeof value === "number") return labels[value] || "Linear";
  if (typeof value !== "string") return "Linear";
  return value.replace(/^Enum\.[^.]+\./, "") || "Linear";
}

function bounceOut(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + 0.984375;
}

function easeIn(t, style) {
  switch (style) {
    case "constant": return t < 1 ? 0 : 1;
    case "cubicv2": return t * t * (3 - 2 * t);
    case "quad": return t * t;
    case "cubic": return t * t * t;
    case "quart": return t * t * t * t;
    case "quint": return t * t * t * t * t;
    case "bounce": return 1 - bounceOut(1 - t);
    case "elastic": return t === 0 || t === 1 ? t : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI / 3));
    case "exponential": return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case "circular": return 1 - Math.sqrt(Math.max(0, 1 - t * t));
    case "back": return 2.70158 * t * t * t - 1.70158 * t * t;
    default: return t;
  }
}

function easeValue(raw, metadata) {
  if (!metadata) return raw;
  const style = enumLabel(metadata.style, EASING_STYLE).toLowerCase();
  const direction = enumLabel(metadata.direction, EASING_DIRECTION).toLowerCase();
  if (style === "linear") return raw;
  if (style === "constant") {
    if (direction === "out") return raw > 0 ? 1 : 0;
    if (direction === "inout") return raw < 0.5 ? 0 : 1;
    return raw < 1 ? 0 : 1;
  }
  if (direction === "out") return 1 - easeIn(1 - raw, style);
  if (direction === "inout") {
    return raw < 0.5
      ? easeIn(raw * 2, style) / 2
      : 1 - easeIn((1 - raw) * 2, style) / 2;
  }
  return easeIn(raw, style);
}

function compileClip(clip) {
  if (!clip || !Array.isArray(clip.frames) || !clip.frames.length) return null;
  const duration = Math.max(
    0,
    Number(clip.duration) || Number(clip.frames[clip.frames.length - 1]?.time) || 0
  );
  const tracks = {};

  for (const jointName of JOINT_NAMES) {
    const partName = ROBLOX_JOINT_PART[jointName];
    const keys = [];
    for (const frame of clip.frames) {
      const transform = compileCFrame(frame.poses?.[jointName], partName);
      if (!transform) continue;
      keys.push({
        time: Math.max(0, Number(frame.time) || 0),
        position: transform.position,
        quaternion: transform.quaternion,
        easing: frame.easing?.[jointName] || null,
      });
    }
    keys.sort((a, b) => a.time - b.time);
    if (keys.length) tracks[jointName] = keys;
  }

  if (!Object.keys(tracks).length) return null;
  return { duration, loop: clip.loop !== false, tracks };
}

/**
 * Compile an imported Roblox KeyframeSequence. Safe to call more than once:
 * the compiled transform tracks are cached by source clip object identity.
 */
export function prepareClip(clip) {
  if (!clip || typeof clip !== "object") return null;
  let compiled = compiledClips.get(clip);
  if (!compiled) {
    compiled = compileClip(clip);
    if (compiled) compiledClips.set(clip, compiled);
  }
  return compiled;
}

function findPair(keys, time, duration, looping) {
  if (!keys.length) return null;
  if (keys.length === 1) return { from: keys[0], to: keys[0], alpha: 0 };

  let nextIndex = keys.findIndex(key => key.time >= time);
  if (nextIndex === -1) {
    if (!looping || duration <= 0) {
      return { from: keys[keys.length - 1], to: keys[keys.length - 1], alpha: 0 };
    }
    const from = keys[keys.length - 1];
    const to = keys[0];
    const span = (duration - from.time) + to.time;
    return { from, to, alpha: span > 0 ? clamp((time - from.time) / span, 0, 1) : 0 };
  }

  if (nextIndex === 0) {
    const first = keys[0];
    if (time >= first.time || !looping || duration <= 0) {
      return { from: first, to: first, alpha: 0 };
    }
    const last = keys[keys.length - 1];
    const fromTime = last.time - duration;
    const span = first.time - fromTime;
    return { from: last, to: first, alpha: span > 0 ? clamp((time - fromTime) / span, 0, 1) : 0 };
  }

  const from = keys[nextIndex - 1];
  const to = keys[nextIndex];
  if (time === to.time || to.time <= from.time) return { from: to, to, alpha: 0 };
  return { from, to, alpha: clamp((time - from.time) / (to.time - from.time), 0, 1) };
}

/** Sample a source clip into local joint transforms at clip-local seconds. */
export function sampleClip(clip, time) {
  const compiled = prepareClip(clip);
  if (!compiled) return {};
  const duration = compiled.duration;
  const localTime = duration > 0
    ? (compiled.loop ? ((time % duration) + duration) % duration : clamp(time, 0, duration))
    : 0;
  const sampled = {};

  for (const [jointName, keys] of Object.entries(compiled.tracks)) {
    const pair = findPair(keys, localTime, duration, compiled.loop);
    if (!pair) continue;
    const alpha = easeValue(pair.alpha, pair.from.easing);
    sampled[jointName] = {
      position: pair.from.position.clone().lerp(pair.to.position, alpha),
      quaternion: pair.from.quaternion.clone().slerp(pair.to.quaternion, alpha).normalize(),
    };
  }
  return sampled;
}

export function resetAvatarPose(av) {
  if (!av) return;
  av.body.position.set(0, 0, 0);
  av.body.rotation.set(0, 0, 0);
  av.body.scale.set(1, 1, 1);
  for (const [partName, position] of Object.entries(REST)) {
    const part = av[partName];
    if (!part) continue;
    part.position.set(...position);
    part.quaternion.identity();
    part.scale.set(1, 1, 1);
  }
}

export function applyImportedAnimation(av, clip, elapsed) {
  if (!av || !clip?.frames?.length) return false;
  resetAvatarPose(av);
  const joints = sampleClip(clip, Math.max(0, Number(elapsed) || 0));
  let applied = 0;
  for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
    const joint = joints[jointName];
    const part = av[partName];
    if (!joint || !part) continue;
    part.position.copy(joint.position);
    part.quaternion.copy(joint.quaternion).normalize();
    applied += 1;
  }
  return applied > 0;
}
