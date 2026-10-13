import * as THREE from "three";

// Applies the real Roblox R6 KeyframeSequence data in public/avatar/animations.json.
// Each exported Pose.CFrame is the local Motor6D Transform. Standard R6 Motor6D
// C0/C1 rotations are identity; the avatar groups are already placed at the joint
// pivots by r6Split.js, so the pose translation is an offset from REST.
//
// Roblox characters face -Z; this scene faces +Z toward the camera. Convert both
// position and rotation through a 180-degree Y basis change (x and z are negated).
export const REST = {
  torso: [0, 3, 0],
  head: [0, 1, 0],
  // Coy faces the camera (+Z): his right limbs belong on screen-left (-X).
  rArm: [-1, 0.5, 0],
  lArm: [1, 0.5, 0],
  rLeg: [-1, -1, 0],
  lLeg: [1, -1, 0],
};

export const ROBLOX_JOINT_PART = {
  Torso: "torso",
  Head: "head",
  // The imported avatar's named R6 groups are already assigned to their matching
  // Roblox body parts in r6Split.js. Do not apply a second left/right swap here:
  // that made the authored Right Arm track animate the opposite visible arm.
  "Right Arm": "rArm",
  "Left Arm": "lArm",
  "Right Leg": "rLeg",
  "Left Leg": "lLeg",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function readCFrame(cframe, partName) {
  if (!Array.isArray(cframe) || cframe.length < 12 ||
      !cframe.slice(0, 12).every(Number.isFinite)) return null;

  const rest = REST[partName];
  if (!rest) return null;

  // Roblox GetComponents() data is position + row-major R00..R22.
  // Keep this matrix in the imported rig's local coordinate system: r6Split.js
  // keeps the OBJ mesh and pivots in that same basis. Converting only the pose
  // by 180 degrees (without rotating the mesh) reverses shoulder/hip rotation
  // direction and makes correct Roblox tracks look mirrored or twisted.
  const robloxMatrix = new THREE.Matrix4().set(
    cframe[3], cframe[4], cframe[5], cframe[0],
    cframe[6], cframe[7], cframe[8], cframe[1],
    cframe[9], cframe[10], cframe[11], cframe[2],
    0, 0, 0, 1
  );

  // Pose.CFrame is a joint-local transform. Add its translation to the joint's
  // rest pivot, then decompose the unmodified rotation for Three.js.
  const pivot = new THREE.Matrix4().makeTranslation(rest[0], rest[1], rest[2]);
  const localJoint = pivot.multiply(robloxMatrix);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  localJoint.decompose(position, quaternion, scale);
  quaternion.normalize();
  return { position, quaternion };
}

// Pose.EasingStyle uses Enum.PoseEasingStyle, not the larger TweenService EasingStyle enum.
const EASING_STYLE_BY_VALUE = ["Linear", "Constant", "Elastic", "Cubic", "Bounce", "CubicV2"];
const EASING_DIRECTION_BY_VALUE = ["In", "Out", "InOut"];

function enumLabel(value, numericLabels) {
  if (typeof value === "number") return numericLabels[value] || "Linear";
  if (typeof value !== "string") return "Linear";
  const label = value.replace(/^Enum\.[^.]+\./, "");
  return label || "Linear";
}

function bounceOut(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + 0.984375;
}

function easeValue(raw, metadata) {
  const easing = metadata || {};
  const style = enumLabel(easing.style, EASING_STYLE_BY_VALUE).toLowerCase();
  const direction = enumLabel(easing.direction, EASING_DIRECTION_BY_VALUE).toLowerCase();
  const easeIn = t => {
    switch (style) {
      case "constant": return t < 1 ? 0 : 1;
      case "cubicv2": return t * t * (3 - 2 * t);
      case "sine": return 1 - Math.cos(t * Math.PI / 2);
      case "back": return 2.70158 * t * t * t - 1.70158 * t * t;
      case "quad": return t * t;
      case "quart": return t * t * t * t;
      case "quint": return t * t * t * t * t;
      case "bounce": return 1 - bounceOut(1 - t);
      case "elastic": return t === 0 || t === 1 ? t : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI / 3));
      case "exponential": return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
      case "circular": return 1 - Math.sqrt(Math.max(0, 1 - t * t));
      case "cubic": return t * t * t;
      default: return t;
    }
  };
  if (style === "linear") return raw;
  if (style === "constant") {
    if (direction === "out") return raw > 0 ? 1 : 0;
    if (direction === "inout") return raw < 0.5 ? 0 : 1;
    return raw < 1 ? 0 : 1;
  }
  if (direction === "out") return 1 - easeIn(1 - raw);
  if (direction === "inout") return raw < 0.5
    ? easeIn(raw * 2) / 2
    : 1 - easeIn((1 - raw) * 2) / 2;
  return easeIn(raw);
}

function validPoseCFrame(cframe) {
  return Array.isArray(cframe) && cframe.length >= 12 &&
    cframe.slice(0, 12).every(Number.isFinite);
}

// Roblox tracks are joint-specific. A Keyframe may omit a Pose for one joint;
// don't freeze that joint to an adjacent key just because another joint has a
// key at this time. Find the surrounding keys for this joint itself.
function getJointFramePair(frames, jointName, time) {
  let previous = null;
  let next = null;
  for (const frame of frames) {
    const cframe = frame.poses?.[jointName];
    if (!validPoseCFrame(cframe)) continue;
    const key = { frame, cframe, time: Number(frame.time) || 0 };
    if (key.time <= time) previous = key;
    if (key.time >= time) {
      next = key;
      break;
    }
  }
  if (!previous) previous = next;
  if (!next) next = previous;
  if (!previous || !next) return null;
  if (previous === next || next.time <= previous.time) return { previous, next, alpha: 0 };
  return {
    previous,
    next,
    alpha: clamp((time - previous.time) / (next.time - previous.time), 0, 1)
  };
}

/** Sample Roblox joint poses at a clip-local time, interpolating each joint's own key track. */
export function sampleClip(clip, time) {
  if (!clip?.frames?.length) return {};
  const frames = clip.frames;
  const duration = Math.max(0, Number(clip.duration) || Number(frames[frames.length - 1]?.time) || 0);
  const localTime = duration > 0 && clip.loop !== false
    ? ((time % duration) + duration) % duration
    : clamp(time, 0, duration);
  const sampled = {};

  for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
    const pair = getJointFramePair(frames, jointName, localTime);
    if (!pair) continue;
    const { previous, next, alpha } = pair;
    const from = readCFrame(previous.cframe, partName);
    const to = readCFrame(next.cframe, partName);
    if (!from || !to) continue;

    // Easing is attached to the earlier key on this particular joint track.
    // Older exports have no metadata and stay linear rather than guessing.
    const easedAlpha = easeValue(alpha, previous.frame.easing?.[jointName]);
    sampled[jointName] = {
      position: from.position.clone().lerp(to.position, easedAlpha),
      quaternion: from.quaternion.clone().slerp(to.quaternion, easedAlpha).normalize()
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
