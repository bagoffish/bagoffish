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
  rArm: [1, 0.5, 0],
  lArm: [-1, 0.5, 0],
  rLeg: [1, -1, 0],
  lLeg: [-1, -1, 0],
};

export const ROBLOX_JOINT_PART = {
  Torso: "torso",
  Head: "head",
  // The character faces +Z in this scene, so anatomical right is on scene -X.
  "Right Arm": "lArm",
  "Left Arm": "rArm",
  "Right Leg": "lLeg",
  "Left Leg": "rLeg",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function readCFrame(cframe, partName) {
  if (!Array.isArray(cframe) || cframe.length < 12 ||
      !cframe.slice(0, 12).every(Number.isFinite)) return null;

  // THREE.Matrix4.set accepts row-major arguments, matching the export format:
  // x, y, z, R00, R01, R02, R10, R11, R12, R20, R21, R22.
  const matrix = new THREE.Matrix4().set(
    cframe[3], cframe[4], cframe[5], 0,
    cframe[6], cframe[7], cframe[8], 0,
    cframe[9], cframe[10], cframe[11], 0,
    0, 0, 0, 1
  );
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
  quaternion.set(-quaternion.x, quaternion.y, -quaternion.z, quaternion.w).normalize();

  const rest = REST[partName];
  if (!rest) return null;
  const position = new THREE.Vector3(
    rest[0] - cframe[0],
    rest[1] + cframe[1],
    rest[2] - cframe[2]
  );
  return { position, quaternion };
}

// Pose.EasingStyle uses Enum.PoseEasingStyle, not the larger TweenService EasingStyle enum.
const EASING_STYLE_BY_VALUE = ["Linear", "Constant", "Elastic", "Cubic", "Bounce"];
const EASING_DIRECTION_BY_VALUE = ["In", "Out", "InOut"];

function enumLabel(value, numericLabels) {
  if (typeof value === "number") return numericLabels[value] || "Linear";
  if (typeof value !== "string") return "Linear";
  const label = value.replace(/^Enum\\.[^.]+\\./, "");
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
  if (style === "constant") return raw < 1 ? 0 : 1;
  if (direction === "out") return 1 - easeIn(1 - raw);
  if (direction === "inout") return raw < 0.5
    ? easeIn(raw * 2) / 2
    : 1 - easeIn((1 - raw) * 2) / 2;
  return easeIn(raw);
}

function getFramePair(frames, time) {
  if (time <= frames[0].time) return [frames[0], frames[0], 0];
  const last = frames[frames.length - 1];
  if (time >= last.time) return [last, last, 0];
  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i], b = frames[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = Math.max(1e-6, Number(b.time) - Number(a.time));
      return [a, b, clamp((time - Number(a.time)) / span, 0, 1)];
    }
  }
  return [last, last, 0];
}

/** Sample Roblox joint poses at a clip-local time, interpolating translation and rotation. */
export function sampleClip(clip, time) {
  if (!clip?.frames?.length) return {};
  const frames = clip.frames;
  const duration = Math.max(0, Number(clip.duration) || Number(frames[frames.length - 1]?.time) || 0);
  const localTime = duration > 0 && clip.loop !== false
    ? ((time % duration) + duration) % duration
    : clamp(time, 0, duration);
  const [a, b, alpha] = getFramePair(frames, localTime);
  const sampled = {};

  for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
    const ca = a.poses?.[jointName];
    const cb = b.poses?.[jointName];
    const from = readCFrame(ca || cb, partName);
    const to = readCFrame(cb || ca, partName);
    if (!from || !to) continue;
    // Roblox stores easing metadata on the earlier pose for the segment leading
    // to the next keyframe. Older exports have no metadata and remain linear.
    const easedAlpha = easeValue(alpha, a.easing?.[jointName]);
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
