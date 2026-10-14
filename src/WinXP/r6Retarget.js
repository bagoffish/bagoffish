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
  // Every joint, including the torso's RootJoint, goes through the same Motor6D formula.
  // RootJoint has C0 = C1 = ROOT_ROT (a 180 degree turn about (0,1,1)), which swaps the
  // Y and Z axes: a Torso "Z" value in the clip is UP/DOWN in the world, "Y" is forward/back,
  // and a rotation about the joint's Z axis is a twist about the vertical. Reading the
  // torso CFrame directly (as this file used to) put dance bounces on the wrong axis
  // and turned twists into sideways rolls. In scene axes the net effect is
  // Rx(-90deg): position (x, y, z) -> (x, z, -y).
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
    // All rebuilt limbs are children of the torso, so REST positions are torso-local.
    // Adding REST.torso.y here lifted both legs by another 3 studs.
    part.position.set(...position);
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
    part.quaternion.copy(joint.quaternion);
    part.position.copy(joint.position);
    if (partName === "torso") {
      // Torso translation is relative to the feet/root origin.
      part.position.y += REST.torso[1];
    }
    // Limb positions are already torso-local from jointPose(); adding the torso's
    // 3-stud height to either leg makes it jump upward as soon as an imported clip loads.
  }
  return applied > 0;
}


// ---------------------------------------------------------------------------------------------
// Torso follow-through
//
// Roblox's stock R6 clips (and the sword / gear clips) animate almost only the limbs: across
// idle/walk/wave/dance the Torso joint rotates 2-14 degrees, and in swordslash, swordlunge and
// gearhold it does not move at all. That is why the body looks stiff. This layer adds the missing
// secondary motion on top of whatever clip is playing, driven by what the arms and legs are doing:
//   - shoulders twist toward the swinging arm (and against the stride while walking),
//   - the chest leans into reaching/lunging motions, plus a slow breathing sway.
// Legs are counter-rotated so the hips and feet stay planted, and the head only follows
// part of the twist so it keeps looking where it was.
// ---------------------------------------------------------------------------------------------
const _dir = new THREE.Vector3();
const _eul = new THREE.Euler();
const _qT = new THREE.Quaternion(), _qC = new THREE.Quaternion(), _qOld = new THREE.Quaternion();
const _qId = new THREE.Quaternion();

// z component of "where the limb points" in torso space (+z is forward, toward the screen).
const limbForward = part => _dir.set(0, -1, 0).applyQuaternion(part.quaternion).z;

// gain per clip: arm = twist from arm swing, leg = twist from stride, lean = forward lean.
export const TORSO_GAINS = {
  default:    { arm: 0.35, leg: 0.28, lean: 0.10, sway: 1 },
  idle1:      { arm: 0.10, leg: 0.00, lean: 0.00, sway: 1 },
  idle2:      { arm: 0.10, leg: 0.00, lean: 0.00, sway: 1 },
  walk:       { arm: 0.12, leg: 0.14, lean: 0.03, sway: 0 },
  dance1:     { arm: 0.30, leg: 0.20, lean: 0.08, sway: 0 },
  dance2:     { arm: 0.30, leg: 0.20, lean: 0.08, sway: 0 },
  dance3:     { arm: 0.30, leg: 0.20, lean: 0.08, sway: 0 },
  wave:       { arm: 0.18, leg: 0.00, lean: 0.04, sway: 1 },
  climbing:   { arm: 0.18, leg: 0.18, lean: 0.00, sway: 0 },
  gearhold:   { arm: 0.30, leg: 0.00, lean: 0.05, sway: 1 },
  swordslash: { arm: 0.75, leg: 0.00, lean: 0.00, sway: 0 },
  swordlunge: { arm: 0.70, leg: 0.00, lean: 0.00, sway: 0 },
};

// Computes the target { twist, lean } for the pose the clip just wrote into `av`.
export function torsoTargets(av, clipName, time) {
  const g = TORSO_GAINS[clipName] || TORSO_GAINS.default;
  const rz = limbForward(av.rArm), lz = limbForward(av.lArm);
  const rlz = limbForward(av.rLeg), llz = limbForward(av.lLeg);
  // Positive twist (about +Y) brings the anatomical right shoulder forward (+z).
  const armSwing = (rz - lz) / 2;
  const stride = (llz - rlz) / 2;           // left leg forward => right shoulder forward
  const reach = Math.max(rz, lz, 0);        // how far an arm is extended forward
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const twist = clamp(g.arm * armSwing + g.leg * stride, 0.45);
  const lean = clamp(g.lean * reach, 0.3) + g.sway * 0.012 * Math.sin(time * 2.1);
  return { twist, lean };
}

// Applies the follow-through. Call after the clip pose has been written and before head-look.
export function applyTorsoLayer(av, twist, lean, headFollow = 0.55) {
  if (!av.torso || (Math.abs(twist) < 1e-4 && Math.abs(lean) < 1e-4)) return;
  _qOld.copy(av.torso.quaternion);
  _qT.setFromEuler(_eul.set(lean, twist, 0, "YXZ"));
  av.torso.quaternion.premultiply(_qT).normalize();
  // Counter-rotate legs (position and orientation) so they stay where the clip put them.
  _qC.copy(_qOld).invert().multiply(_qT.clone().invert()).multiply(_qOld);
  for (const leg of [av.rLeg, av.lLeg]) {
    if (!leg) continue;
    leg.position.applyQuaternion(_qC);
    leg.quaternion.premultiply(_qC).normalize();
  }
  // The head follows only part of the twist, so it doesn't whip around with the shoulders.
  if (av.head) {
    _qId.identity();
    av.head.quaternion.premultiply(_qId.clone().slerp(_qC, 1 - headFollow)).normalize();
  }
}
