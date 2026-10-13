import * as THREE from "three";

// Plays Roblox R6 keyframe data (public/avatar/animations.json) on the rebuilt avatar.
//
// A Roblox Pose CFrame is the Motor6D *Transform*, not the part's rotation. The part ends up at
//     Part1.CFrame = Part0.CFrame * C0 * Transform * C1^-1
// and C0/C1 carry a rotation that remaps the joint axes (for example a shoulder's Z axis points
// out of the torso, so a rotation about Z swings the arm forward and back). Applying the Transform
// directly as the part's rotation turns every limb about the wrong axis, which looks "wacky".
// This file applies the full formula, then converts Roblox axes (character faces -Z, right is +X)
// to this scene (character faces +Z toward the screen) with a 180 degree turn about Y.

// Default R6 Motor6D frames: [x, y, z, R00, R01, R02, R10, R11, R12, R20, R21, R22].
const ROOT_ROT = [-1, 0, 0, 0, 0, 1, 0, 1, 0];
const JOINTS = {
  "Torso":     { c0: [0, 0, 0, ...ROOT_ROT],            c1: [0, 0, 0, ...ROOT_ROT] },
  "Head":      { c0: [0, 1, 0, ...ROOT_ROT],            c1: [0, -0.5, 0, ...ROOT_ROT] },
  "Right Arm": { c0: [1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0],   c1: [-0.5, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0] },
  "Left Arm":  { c0: [-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0],  c1: [0.5, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0] },
  "Right Leg": { c0: [1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0],    c1: [0.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0] },
  "Left Leg":  { c0: [-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0],   c1: [-0.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0] },
};

// Keep Roblox anatomical sides aligned with the OBJ groups and pivots in r6Split.js.
// The avatar faces +Z, so its anatomical right is screen-left (-X): rArm/rLeg.
export const ROBLOX_JOINT_PART = {
  "Torso": "torso", "Head": "head",
  "Right Arm": "rArm", "Left Arm": "lArm",
  "Right Leg": "rLeg", "Left Leg": "lLeg",
};

// Joint positions at rest. The torso sits on the body (feet at y = 0); everything else hangs
// off the torso. These are the Motor6D C0 positions turned into scene axes (x and z negated).
export const REST = {
  torso: [0, 3, 0],
  head: [0, 1, 0],
  rArm: [-1, 0.5, 0], lArm: [1, 0.5, 0],
  rLeg: [-1, -1, 0],  lLeg: [1, -1, 0],
};

const rotation = cf => new THREE.Matrix4().set(
  cf[3], cf[4], cf[5], 0,
  cf[6], cf[7], cf[8], 0,
  cf[9], cf[10], cf[11], 0,
  0, 0, 0, 1
);
const PREP = {};
for (const [name, j] of Object.entries(JOINTS)) {
  PREP[name] = { r0: rotation(j.c0), r1Inv: rotation(j.c1).transpose(), p0: new THREE.Vector3(j.c0[0], j.c0[1], j.c0[2]) };
}

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();

// Joint transform in scene axes: position relative to the parent joint's frame, plus rotation.
function jointPose(name, cf, outPos, outQuat) {
  // The root/torso pose is not a Motor6D limb pose. Convert its translation
  // and rotation directly between Roblox axes and the scene axes.
  if (name === "Torso") {
    outPos.set(-cf[0], cf[1], -cf[2]);
    const rootRotation = rotation(cf);
    outQuat.setFromRotationMatrix(rootRotation).normalize();
    outQuat.set(-outQuat.x, outQuat.y, -outQuat.z, outQuat.w);
    return;
  }

  const j = PREP[name];
  if (!j) return;

  // Limb and neck poses are joint-local Motor6D transforms.
  tmpM.copy(j.r0).multiply(rotation(cf)).multiply(j.r1Inv);
  outQuat.setFromRotationMatrix(tmpM).normalize();

  tmpV.set(cf[0], cf[1], cf[2]).applyMatrix4(j.r0).add(j.p0);
  outPos.set(-tmpV.x, tmpV.y, -tmpV.z);
  outQuat.set(-outQuat.x, outQuat.y, -outQuat.z, outQuat.w);
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const pa = new THREE.Vector3(), pb = new THREE.Vector3();

// Returns { [robloxJointName]: { position, quaternion } } for the clip at `time` seconds.
export function sampleClip(clip, time) {
  const frames = clip.frames;
  let a = frames[0], b = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (time >= frames[i].time && time <= frames[i + 1].time) { a = frames[i]; b = frames[i + 1]; break; }
  }
  const span = Math.max(1e-6, (b.time || 0) - (a.time || 0));
  const alpha = Math.min(Math.max((time - (a.time || 0)) / span, 0), 1);
  const out = {};
  for (const name of Object.keys(JOINTS)) {
    const ca = a.poses?.[name], cb = b.poses?.[name];
    if (!ca && !cb) continue;
    jointPose(name, ca || cb, pa, qa);
    jointPose(name, cb || ca, pb, qb);
    out[name] = { position: pa.clone().lerp(pb, alpha), quaternion: qa.clone().slerp(qb, alpha).normalize() };
  }
  return out;
}

export function resetAvatarPose(av) {
  // Clear whatever the previous animation left behind so poses never stack up.
  av.body.position.set(0, 0, 0);
  av.body.rotation.set(0, 0, 0);
  av.body.scale.set(1, 1, 1);
  for (const [name, position] of Object.entries(REST)) {
    const part = av[name];
    if (!part) continue;
    part.quaternion.identity();
    if (name === "rLeg" || name === "lLeg") {
      part.position.set(position[0], REST.torso[1] + position[1], position[2]);
    } else {
      part.position.set(...position);
    }
    part.scale.set(1, 1, 1);
  }
}

export function applyImportedAnimation(av, clip, elapsed) {
  if (!clip?.frames?.length) return false;
  resetAvatarPose(av);
  const frames = clip.frames;
  const duration = Math.max(0, Number(clip.duration) || frames[frames.length - 1]?.time || 0);
  const time = duration > 0 && clip.loop !== false ? elapsed % duration : Math.min(elapsed, duration);
  // HumanoidRootPart is skipped on purpose: CoyCompanion moves the avatar, so root motion would double up.
  const joints = sampleClip(clip, time);
  let applied = 0;
  for (const [robloxName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
    const joint = joints[robloxName], part = av[partName];
    if (!joint || !part) continue;
    applied += 1;
    if (partName === "torso") {
      // Keep the imported joint rotation intact. Extrapolating beyond 1.0 made
      // torso rotations overshoot during dance loops and look twisted.
      part.quaternion.copy(joint.quaternion);
    } else {
      part.quaternion.copy(joint.quaternion);
    }
    part.position.copy(joint.position);
    if (partName === "torso") {
      part.position.y += REST.torso[1];   // pose offset is relative to the root part
    } else if (partName === "rLeg" || partName === "lLeg") {
      // Leg joint positions are now in body/root space so torso turns don't lift or drag the feet.
      part.position.y += REST.torso[1];
    }
  }
  return applied > 0;
}
