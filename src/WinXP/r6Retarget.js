import * as THREE from "three";

// CFrame-first R6 runtime. Every authored key is converted to a local joint
// transform once, then played as position + quaternion tracks. The rig groups
// are located at their actual Motor6D pivots (r6Split.js), so no fake limb
// center offsets or torso-specific correction translations belong here.
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clipCache = new WeakMap();

function validCFrame(value) {
  return Array.isArray(value) && value.length >= 12 &&
    value.slice(0, 12).every(Number.isFinite);
}

// Roblox CFrame:GetComponents(): x,y,z,R00,R01,R02,R10,R11,R12,R20,R21,R22.
// Pose.CFrame is a joint-local Motor6D Transform. Preserve that local rotation
// as-is; the avatar's facing direction belongs to the root rig, not each joint.
function readLocalCFrame(value, partName) {
  if (!validCFrame(value)) return null;
  const rest = REST[partName];
  if (!rest) return null;
  const local = new THREE.Matrix4().set(
    value[3], value[4], value[5], value[0],
    value[6], value[7], value[8], value[1],
    value[9], value[10], value[11], value[2],
    0, 0, 0, 1
  );
  // Pose.CFrame for the torso is the character root transform, not a
  // Motor6D limb offset. Convert Roblox's coordinate handedness and apply
  // the root translation directly; adding the torso rest offset here makes
  // the whole avatar drift and causes every imported animation to look wrong.
  const position = partName === "torso"
    ? new THREE.Vector3(-value[0], value[1], -value[2])
    : new THREE.Vector3(rest[0] + value[0], rest[1] + value[1], rest[2] + value[2]);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(local);
  if (partName === "torso") {
    quaternion.set(-quaternion.x, quaternion.y, -quaternion.z, quaternion.w);
  }
  quaternion.normalize();
  return { position, quaternion };
}
const STYLE = ["Linear", "Constant", "Elastic", "Cubic", "Bounce", "CubicV2"];
const DIRECTION = ["In", "Out", "InOut"];

function enumLabel(value, labels) {
  if (typeof value === "number") return labels[value] || "Linear";
  if (typeof value !== "string") return "Linear";
  return value.replace(/^Enum\.[^.]+\./, "") || "Linear";
}

function easeIn(t, style) {
  switch (style) {
    case "constant": return t < 1 ? 0 : 1;
    case "cubicv2": return t * t * (3 - 2 * t);
    case "cubic": return t * t * t;
    case "bounce": {
      const bounceOut = x => {
        if (x < 1 / 2.75) return 7.5625 * x * x;
        if (x < 2 / 2.75) { x -= 1.5 / 2.75; return 7.5625 * x * x + 0.75; }
        if (x < 2.5 / 2.75) { x -= 2.25 / 2.75; return 7.5625 * x * x + 0.9375; }
        x -= 2.625 / 2.75;
        return 7.5625 * x * x + 0.984375;
      };
      return 1 - bounceOut(1 - t);
    }
    case "elastic":
      return t === 0 || t === 1 ? t : -Math.pow(2, 10 * t - 10) *
        Math.sin((t * 10 - 10.75) * (2 * Math.PI / 3));
    default: return t;
  }
}

function ease(raw, metadata) {
  if (!metadata) return raw;
  const style = enumLabel(metadata.style, STYLE).toLowerCase();
  const direction = enumLabel(metadata.direction, DIRECTION).toLowerCase();
  if (style === "linear") return raw;
  if (style === "constant") {
    if (direction === "out") return raw > 0 ? 1 : 0;
    if (direction === "inout") return raw < 0.5 ? 0 : 1;
    return raw < 1 ? 0 : 1;
  }
  if (direction === "out") return 1 - easeIn(1 - raw, style);
  if (direction === "inout") return raw < 0.5
    ? easeIn(raw * 2, style) / 2
    : 1 - easeIn((1 - raw) * 2, style) / 2;
  return easeIn(raw, style);
}

function compileClip(clip) {
  if (!clip?.frames?.length) return null;
  const lastTime = Number(clip.frames[clip.frames.length - 1]?.time) || 0;
  const duration = Math.max(0, Number(clip.duration) || lastTime);
  const tracks = {};
  for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
    const keys = [];
    for (const frame of clip.frames) {
      const transform = readLocalCFrame(frame.poses?.[jointName], partName);
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
  return Object.keys(tracks).length ? { duration, loop: clip.loop !== false, tracks } : null;
}

export function prepareClip(clip) {
  if (!clip || typeof clip !== "object") return null;
  if (clipCache.has(clip)) return clipCache.get(clip);
  const compiled = compileClip(clip);
  clipCache.set(clip, compiled);
  return compiled;
}

function pairAt(keys, time, duration, looping) {
  if (!keys.length) return null;
  if (keys.length === 1) return { a: keys[0], b: keys[0], alpha: 0 };
  let nextIndex = keys.findIndex(k => k.time >= time);
  if (nextIndex === -1) {
    if (!looping || duration <= 0) {
      const last = keys[keys.length - 1];
      return { a: last, b: last, alpha: 0 };
    }
    const a = keys[keys.length - 1], b = keys[0];
    const span = duration - a.time + b.time;
    return { a, b, alpha: span > 0 ? clamp((time - a.time) / span, 0, 1) : 0 };
  }
  if (nextIndex === 0) {
    const first = keys[0];
    if (time >= first.time || !looping || duration <= 0) {
      return { a: first, b: first, alpha: 0 };
    }
    const last = keys[keys.length - 1];
    const fromTime = last.time - duration;
    const span = first.time - fromTime;
    return { a: last, b: first, alpha: span > 0 ? clamp((time - fromTime) / span, 0, 1) : 0 };
  }
  const a = keys[nextIndex - 1], b = keys[nextIndex];
  if (b.time <= a.time) return { a: b, b, alpha: 0 };
  return { a, b, alpha: clamp((time - a.time) / (b.time - a.time), 0, 1) };
}

export function sampleClip(clip, elapsed) {
  const compiled = prepareClip(clip);
  if (!compiled) return {};
  const duration = compiled.duration;
  const time = duration > 0
    ? (compiled.loop ? ((elapsed % duration) + duration) % duration : clamp(elapsed, 0, duration))
    : 0;
  const result = {};
  for (const [jointName, keys] of Object.entries(compiled.tracks)) {
    const pair = pairAt(keys, time, duration, compiled.loop);
    if (!pair) continue;
    const alpha = ease(pair.alpha, pair.a.easing);
    result[jointName] = {
      position: pair.a.position.clone().lerp(pair.b.position, alpha),
      quaternion: pair.a.quaternion.clone().slerp(pair.b.quaternion, alpha).normalize(),
    };
  }
  return result;
}


function sceneCFrame(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const position = new THREE.Vector3(x, y, z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "XYZ"));
  const sceneMatrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1));
  // Keep custom reaction transforms in the same scene-local basis as the
  // imported joint-local transforms. Do not conjugate these a second time.
  const e = sceneMatrix.elements;
  return [e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
}

function reactionFrame(time, pose) {
  // Every generated key contains every joint, so omitted joints return to their
  // neutral CFrame instead of starting at the first key that happens to exist.
  const poses = {};
  for (const joint of Object.keys(ROBLOX_JOINT_PART)) poses[joint] = sceneCFrame();
  for (const [joint, values] of Object.entries(pose)) poses[joint] = sceneCFrame(...values);
  return { time, poses };
}

export function createReactionClips() {
  const held = {
    duration: 0.8, loop: true, frames: [
      reactionFrame(0, {
        Torso: [0, 0, 0, 0, 0, -0.035],
        "Right Arm": [0, 0, 0, 0.08, 0, -1.9],
        "Left Arm": [0, 0, 0, -0.08, 0, 1.9],
        "Right Leg": [0, 0, 0, 0.12, 0, 0],
        "Left Leg": [0, 0, 0, -0.12, 0, 0],
      }),
      reactionFrame(0.4, {
        Torso: [0, 0, 0, 0, 0, 0.035],
        "Right Arm": [0, 0, 0, -0.08, 0, -1.82],
        "Left Arm": [0, 0, 0, 0.08, 0, 1.82],
        "Right Leg": [0, 0, 0, -0.08, 0, 0],
        "Left Leg": [0, 0, 0, 0.08, 0, 0],
      }),
      reactionFrame(0.8, {
        Torso: [0, 0, 0, 0, 0, -0.035],
        "Right Arm": [0, 0, 0, 0.08, 0, -1.9],
        "Left Arm": [0, 0, 0, -0.08, 0, 1.9],
        "Right Leg": [0, 0, 0, 0.12, 0, 0],
        "Left Leg": [0, 0, 0, -0.12, 0, 0],
      }),
    ],
  };
  const land = {
    duration: 0.52, loop: false, frames: [
      reactionFrame(0, {
        Torso: [0, -0.04, 0, 0, 0, 0],
        "Right Arm": [0, 0, 0, 0, 0, -0.18],
        "Left Arm": [0, 0, 0, 0, 0, 0.18],
        "Right Leg": [0, 0, 0, -0.08, 0, 0],
        "Left Leg": [0, 0, 0, 0.08, 0, 0],
      }),
      reactionFrame(0.16, {
        Torso: [0, -0.22, 0, 0, 0, 0],
        "Right Arm": [0, 0, 0, 0, 0, -0.38],
        "Left Arm": [0, 0, 0, 0, 0, 0.38],
        "Right Leg": [0, 0, 0, -0.18, 0, 0],
        "Left Leg": [0, 0, 0, 0.18, 0, 0],
      }),
      reactionFrame(0.52, {
        Torso: [0, 0, 0, 0, 0, 0],
        "Right Arm": [0, 0, 0, 0, 0, 0],
        "Left Arm": [0, 0, 0, 0, 0, 0],
        "Right Leg": [0, 0, 0, 0, 0, 0],
        "Left Leg": [0, 0, 0, 0, 0, 0],
      }),
    ],
  };
  const pat = {
    duration: 0.65, loop: false, frames: [
      reactionFrame(0, { Head: [0, 0, 0, 0, 0, 0] }),
      reactionFrame(0.16, {
        Torso: [0, -0.10, 0, 0, 0, 0],
        Head: [0, 0, 0, -0.13, 0, 0],
        "Right Arm": [0, 0, 0, -0.05, 0, -0.12],
        "Left Arm": [0, 0, 0, 0.05, 0, 0.12],
      }),
      reactionFrame(0.34, {
        Torso: [0, -0.03, 0, 0, 0, 0],
        Head: [0, 0, 0, 0.06, 0, 0],
      }),
      reactionFrame(0.65, {
        Torso: [0, 0, 0, 0, 0, 0],
        Head: [0, 0, 0, 0, 0, 0],
        "Right Arm": [0, 0, 0, 0, 0, 0],
        "Left Arm": [0, 0, 0, 0, 0, 0],
      }),
    ],
  };
  return { held, land, pat };
}

export function resetAvatarPose(avatar) {
  if (!avatar) return;
  avatar.body.position.set(0, 0, 0);
  avatar.body.rotation.set(0, 0, 0);
  avatar.body.scale.set(1, 1, 1);
  for (const [name, position] of Object.entries(REST)) {
    const joint = avatar[name];
    if (!joint) continue;
    joint.position.set(...position);
    joint.quaternion.identity();
    joint.scale.set(1, 1, 1);
  }
}

export function applyImportedAnimation(avatar, clip, elapsed) {
  if (!avatar || !clip?.frames?.length) return false;
  resetAvatarPose(avatar);
  const sampled = sampleClip(clip, Math.max(0, Number(elapsed) || 0));
  let count = 0;
  for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
    const transform = sampled[jointName], joint = avatar[partName];
    if (!transform || !joint) continue;
    joint.position.copy(transform.position);
    joint.quaternion.copy(transform.quaternion).normalize();
    count++;
  }
  return count > 0;
}
