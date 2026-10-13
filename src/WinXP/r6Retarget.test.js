import * as THREE from "three";
import {
  REST,
  ROBLOX_JOINT_PART,
  sampleClip,
  applyImportedAnimation,
} from "./r6Retarget";

const animationData = JSON.parse(require("fs").readFileSync(
  require("path").join(process.cwd(), "public/avatar/animations.json"), "utf8"
));

const identity = () => [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
const cframeZ = angle => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [0, 0, 0, c, -s, 0, s, c, 0, 0, 0, 1];
};
const testClip = (poses, duration = 1, loop = false) => ({
  duration,
  loop,
  frames: poses.map(([time, pose]) => ({ time, poses: pose })),
});

describe("R6 CFrame rig", () => {
  test("identity CFrames land each group exactly on its Motor6D pivot", () => {
    const pose = {};
    for (const jointName of Object.keys(ROBLOX_JOINT_PART)) pose[jointName] = identity();
    const sampled = sampleClip(testClip([[0, pose]]), 0);

    for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
      const expected = partName === "torso" ? [0, 0, 0] : REST[partName];
      expect(sampled[jointName].position.x).toBeCloseTo(expected[0]);
      expect(sampled[jointName].position.y).toBeCloseTo(expected[1]);
      expect(sampled[jointName].position.z).toBeCloseTo(expected[2]);
      expect(sampled[jointName].quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
    }
  });

  test("torso rotation does not introduce the old one-stud vertical offset", () => {
    const sampled = sampleClip(testClip([
      [0, { Torso: identity() }],
      [1, { Torso: cframeZ(Math.PI / 2) }],
    ]), 0.5).Torso;

    expect(sampled.position.x).toBeCloseTo(0);
    expect(sampled.position.y).toBeCloseTo(0);
    expect(sampled.position.z).toBeCloseTo(0);
    expect(Number.isFinite(sampled.quaternion.w)).toBe(true);
  });

  test("every original Roblox clip yields finite transforms across its timeline", () => {
    const names = ["walk", "wave", "fall", "idle1", "idle2", "dance1", "dance2", "dance3"];
    for (const name of names) {
      const clip = animationData.animations[name];
      expect(clip?.frames?.length).toBeGreaterThan(0);
      for (const time of [0, clip.duration * 0.37, clip.duration * 0.93]) {
        const sampled = sampleClip(clip, time);
        expect(Object.keys(sampled).length).toBeGreaterThan(0);
        for (const transform of Object.values(sampled)) {
          expect(Number.isFinite(transform.position.x)).toBe(true);
          expect(Number.isFinite(transform.position.y)).toBe(true);
          expect(Number.isFinite(transform.position.z)).toBe(true);
          expect(Number.isFinite(transform.quaternion.w)).toBe(true);
        }
      }
    }
  });

  test("identity animation preserves the avatar's grounded rest pivots", () => {
    const avatar = { body: new THREE.Group() };
    for (const partName of Object.values(ROBLOX_JOINT_PART)) avatar[partName] = new THREE.Group();
    const poses = Object.fromEntries(Object.keys(ROBLOX_JOINT_PART).map(name => [name, identity()]));

    expect(applyImportedAnimation(avatar, testClip([[0, poses]]), 0)).toBe(true);
    expect(avatar.torso.position.y).toBeCloseTo(REST.torso[1]);
    for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
      for (const axis of ["x", "y", "z"]) {
        expect(avatar[partName].position[axis]).toBeCloseTo(REST[partName][["x", "y", "z"].indexOf(axis)]);
      }
    }
  });

  test("CFrame translation is interpolated smoothly between keyframes", () => {
    const from = [0, 0, 0, ...identity().slice(3)];
    const to = [0.4, 0.2, 0, ...identity().slice(3)];
    const sampled = sampleClip(testClip([
      [0, { "Right Arm": from }],
      [1, { "Right Arm": to }],
    ]), 0.5)["Right Arm"];

    expect(sampled.position.x).toBeCloseTo(REST.rArm[0]);
    expect(sampled.position.y).toBeCloseTo(REST.rArm[1] + 0.1);
    expect(sampled.position.z).toBeCloseTo(0.2);
  });
});
