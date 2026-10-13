import * as THREE from "three";
import animationData from "../../public/avatar/animations.json";
import {
  REST,
  ROBLOX_JOINT_PART,
  sampleClip,
  createReactionClips,
} from "./r6Retarget";

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
      expect(sampled[jointName].position.x).toBeCloseTo(REST[partName][0]);
      expect(sampled[jointName].position.y).toBeCloseTo(REST[partName][1]);
      expect(sampled[jointName].position.z).toBeCloseTo(REST[partName][2]);
      expect(sampled[jointName].quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
    }
  });

  test("torso rotation does not introduce the old one-stud vertical offset", () => {
    const sampled = sampleClip(testClip([
      [0, { Torso: identity() }],
      [1, { Torso: cframeZ(Math.PI / 2) }],
    ]), 0.5).Torso;

    expect(sampled.position.x).toBeCloseTo(REST.torso[0]);
    expect(sampled.position.y).toBeCloseTo(REST.torso[1]);
    expect(sampled.position.z).toBeCloseTo(REST.torso[2]);
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

  test("custom held, land, and pat reactions are also CFrame clips", () => {
    const reactions = createReactionClips();
    expect(Object.keys(reactions)).toEqual(["held", "land", "pat"]);
    for (const clip of Object.values(reactions)) {
      expect(clip.frames.length).toBeGreaterThan(1);
      for (const frame of clip.frames) {
        expect(Object.keys(frame.poses).sort()).toEqual(Object.keys(ROBLOX_JOINT_PART).sort());
      }
      const sampled = sampleClip(clip, Math.min(clip.duration * 0.4, clip.duration));
      expect(Object.keys(sampled)).toHaveLength(6);
    }
  });

  test("CFrame translation is interpolated smoothly between keyframes", () => {
    const from = [0, 0, 0, ...identity().slice(3)];
    const to = [0.4, 0.2, 0, ...identity().slice(3)];
    const sampled = sampleClip(testClip([
      [0, { "Right Arm": from }],
      [1, { "Right Arm": to }],
    ]), 0.5)["Right Arm"];

    expect(sampled.position.x).toBeCloseTo(REST.rArm[0] - 0.2);
    expect(sampled.position.y).toBeCloseTo(REST.rArm[1] + 0.1);
  });
});
