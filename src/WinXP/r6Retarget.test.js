import * as THREE from "three";
import { prepareClip, sampleClip, REST } from "./r6Retarget";
import animationData from "../../public/avatar/animations.json";

const cframe = (x = 0, y = 0, z = 0, angleZ = 0) => {
  const c = Math.cos(angleZ);
  const s = Math.sin(angleZ);
  return [x, y, z, c, -s, 0, s, c, 0, 0, 0, 1];
};

const clip = (frames, options = {}) => ({
  duration: options.duration ?? 1,
  loop: options.loop ?? false,
  frames,
});

describe("R6 Roblox keyframe runtime", () => {
  test("compiles source CFrames into the mapped joint's local pivot", () => {
    const source = clip([
      { time: 0, poses: { "Right Arm": cframe() } },
    ]);
    const compiled = prepareClip(source);
    const sampled = sampleClip(source, 0);

    expect(compiled).toBeTruthy();
    expect(sampled["Right Arm"]).toBeTruthy();
    expect(sampled["Right Arm"].position.x).toBeCloseTo(REST.rArm[0]);
    expect(sampled["Right Arm"].position.y).toBeCloseTo(REST.rArm[1]);
    expect(sampled["Right Arm"].position.z).toBeCloseTo(REST.rArm[2]);
    expect(sampled["Right Arm"].quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  test("interpolates translations and rotations without changing the joint mapping", () => {
    const source = clip([
      { time: 0, poses: { "Right Arm": cframe(0, 0, 0, 0) } },
      { time: 1, poses: { "Right Arm": cframe(0.4, 0.2, 0, Math.PI / 2) } },
    ]);
    const sampled = sampleClip(source, 0.5)["Right Arm"];

    expect(sampled.position.x).toBeCloseTo(REST.rArm[0] + 0.2);
    expect(sampled.position.y).toBeCloseTo(REST.rArm[1] + 0.1);
    expect(sampled.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), Math.PI / 4
    ))).toBeCloseTo(0);
  });

  test("keeps a joint with one authored key stable while other tracks animate", () => {
    const source = clip([
      { time: 0, poses: {
        "Right Arm": cframe(),
        Head: cframe(),
      } },
      { time: 0.5, poses: { "Right Arm": cframe(0.2, 0, 0, 0.4) } },
      { time: 1, poses: { "Right Arm": cframe(0.4, 0, 0, 0.8) } },
    ]);
    const sampled = sampleClip(source, 0.75);

    expect(sampled.Head.position.x).toBeCloseTo(REST.head[0]);
    expect(sampled.Head.position.y).toBeCloseTo(REST.head[1]);
    expect(sampled["Right Arm"].position.x).toBeCloseTo(REST.rArm[0] + 0.3);
    expect(Number.isFinite(sampled["Right Arm"].quaternion.w)).toBe(true);
  });

  test("wraps a looping track smoothly between its last and first keys", () => {
    const source = clip([
      { time: 0, poses: { "Right Arm": cframe(0, 0, 0, 0) } },
      { time: 0.5, poses: { "Right Arm": cframe(0.5, 0, 0, Math.PI / 2) } },
    ], { duration: 1, loop: true });
    const sampled = sampleClip(source, 0.75)["Right Arm"];

    expect(sampled.position.x).toBeCloseTo(REST.rArm[0] + 0.25);
    expect(sampled.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), Math.PI / 4
    ))).toBeCloseTo(0);
  });

  test("all checked-in Roblox animation clips compile and produce finite transforms", () => {
    const expected = ["walk", "wave", "fall", "idle1", "idle2", "dance1", "dance2", "dance3"];
    for (const name of expected) {
      const source = animationData.animations[name];
      expect(source?.frames?.length).toBeGreaterThan(0);
      expect(prepareClip(source)).toBeTruthy();

      for (const t of [0, source.duration * 0.37, source.duration * 0.93]) {
        const sampled = sampleClip(source, t);
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

});
