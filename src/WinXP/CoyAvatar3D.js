import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
// All companion motion below is authored as local R6 joint angles and spring curves.
 // No Roblox CFrame/keyframe animation data is loaded or played.
const REST = {
  torso: [0, 3, 0],
  head: [0, 1, 0],
  rArm: [1, 0.5, 0],
  lArm: [-1, 0.5, 0],
  rLeg: [1, -1, 0],
  lLeg: [-1, -1, 0],
};
function resetAvatarPose(av) {
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

// R6 avatar rendered on a transparent canvas. Colors come from /avatar/avatar.json,
// which scripts/sync-avatar.mjs refreshes from Roblox on a schedule.
const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/";
const META_URL = BASE + "avatar.json";
const ASPECT = 0.9;          // canvas width / height
const FOOT = 0.09;           // fraction of canvas height below the feet
const DEFAULT_COLORS = { head: "#f5cd30", torso: "#2f6fed", leftArm: "#f5cd30", rightArm: "#f5cd30", leftLeg: "#2b2f3a", rightLeg: "#2b2f3a" };

const P = o => Object.assign({
  rArmZ: 0, lArmZ: 0, rArmX: 0, lArmX: 0,
  rLegX: 0, lLegX: 0, bob: 0, tilt: 0, sq: 0,
  headX: 0, headY: 0
}, o);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// R6 has one shoulder and one hip joint per side. These motions are explicit
// local joint angles (plus a small root lean/bob), not imported CFrame clips.
function target(name, t, dir, tiltIn) {
  const wave = (speed, phase = 0) => Math.sin(t * speed + phase);
  switch (name) {
    case "wave":
      // Anatomical RIGHT maps to av.lArm in our front-facing scene (screen-left).
      // Keep the elbow-free R6 arm raised and make the wave a small shoulder roll.
      return P({
        rArmZ: -2.22 - wave(7.5) * 0.20,
        rArmX: 0.08 + wave(8.5) * 0.16,
        lArmZ: 0.035,
        bob: wave(3.8) * 0.008,
        headX: -0.025,
        headY: -0.045 + wave(2.4) * 0.025
      });
    case "walk": {
      const step = wave(7.4);
      return P({
        rArmZ: -0.04, lArmZ: 0.04,
        // Opposite arm/leg swing makes a clear, simple walking gait.
        rArmX: -step * 0.28, lArmX: step * 0.28,
        rLegX: step * 0.46, lLegX: -step * 0.46,
        bob: 0.018 + Math.abs(step) * 0.025,
        tilt: wave(7.4) * 0.018,
        headX: Math.abs(step) * 0.012,
        headY: dir * 0.045
      });
    }
    case "dance":
    case "dance1": {
      const beat = wave(5.5);
      const sway = wave(2.75);
      return P({
        rArmZ: -1.05 - beat * 0.16,
        lArmZ: 1.05 + beat * 0.16,
        rArmX: 0.12 + wave(5.5, Math.PI / 2) * 0.12,
        lArmX: -0.12 - wave(5.5, Math.PI / 2) * 0.12,
        rLegX: -beat * 0.32,
        lLegX: beat * 0.32,
        bob: 0.025 + (0.5 + 0.5 * Math.cos(t * 5.5)) * 0.045,
        tilt: sway * 0.045,
        headY: sway * 0.07
      });
    }
    case "dance2": {
      const beat = wave(6.3);
      const sway = wave(3.15);
      return P({
        // A deliberately asymmetric step instead of spinning the whole avatar.
        rArmZ: -1.7 - beat * 0.13,
        lArmZ: 0.62 + beat * 0.18,
        rArmX: wave(6.3, 0.5) * 0.16,
        lArmX: -wave(6.3, 0.5) * 0.16,
        rLegX: -wave(6.3, 0.7) * 0.34,
        lLegX: wave(6.3, 0.7) * 0.34,
        bob: 0.022 + Math.max(0, beat) * 0.045,
        tilt: sway * 0.05,
        headY: -sway * 0.075
      });
    }
    case "dance3": {
      const beat = wave(4.8);
      const sway = wave(2.4);
      return P({
        rArmZ: -0.72 - beat * 0.34,
        lArmZ: 0.72 + beat * 0.34,
        rArmX: 0.16 + wave(4.8, 1.1) * 0.1,
        lArmX: -0.16 - wave(4.8, 1.1) * 0.1,
        rLegX: -beat * 0.29,
        lLegX: beat * 0.29,
        bob: 0.018 + Math.abs(beat) * 0.026,
        tilt: sway * 0.043,
        headY: -sway * 0.06
      });
    }
    case "held": {
      const wiggle = wave(6.8);
      return P({
        rArmZ: -2.02 - wiggle * 0.12,
        lArmZ: 2.02 + wiggle * 0.12,
        rArmX: wave(7.0) * 0.12,
        lArmX: -wave(7.0) * 0.12,
        rLegX: wave(4.0) * 0.18,
        lLegX: -wave(4.0) * 0.18,
        tilt: tiltIn,
        bob: wave(5.0) * 0.012
      });
    }
    case "fall":
      return P({
        rArmZ: -2.3, lArmZ: 2.3,
        rArmX: -0.16, lArmX: 0.16,
        rLegX: 0.32, lLegX: -0.26,
        tilt: tiltIn
      });
    case "land": {
      // Impact squash, one elastic rebound, then settle to neutral.
      const impact = Math.exp(-t * 8) * Math.cos(t * 20);
      return P({
        rArmZ: -0.18 - impact * 0.30,
        lArmZ: 0.18 + impact * 0.30,
        rArmX: -Math.exp(-t * 7) * 0.10,
        lArmX: Math.exp(-t * 7) * 0.10,
        rLegX: -Math.exp(-t * 8) * 0.10,
        lLegX: Math.exp(-t * 8) * 0.10,
        sq: 0.27 * impact,
        bob: Math.max(0, wave(20)) * 0.018 * Math.exp(-t * 8)
      });
    }
    case "pat": {
      // A quick, obvious pat squish with a small spring-back instead of a tiny idle pulse.
      const impact = Math.exp(-t * 7) * Math.cos(t * 20);
      return P({
        rArmZ: -0.12 - impact * 0.08,
        lArmZ: 0.12 + impact * 0.08,
        rArmX: -Math.exp(-t * 8) * 0.07,
        lArmX: Math.exp(-t * 8) * 0.07,
        sq: 0.17 * impact,
        bob: Math.max(0, wave(16)) * 0.015 * Math.exp(-t * 7),
        headX: -0.12 * Math.exp(-t * 7),
        headY: wave(10) * 0.035 * Math.exp(-t * 5)
      });
    }
    case "idle":
    case "idle1":
    case "idle2":
    default:
      return P({
        rArmZ: -0.035, lArmZ: 0.035,
        bob: wave(1.8) * 0.012,
        headX: wave(1.35) * 0.018,
        headY: wave(1.05) * 0.035
      });
  }
}

function buildAvatar(colors) {
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const fc = document.createElement("canvas"); fc.width = fc.height = 128;
  const x = fc.getContext("2d");
  x.fillStyle = colors.head; x.fillRect(0, 0, 128, 128); x.fillStyle = "#111";
  x.fillRect(34, 42, 12, 22); x.fillRect(82, 42, 12, 22);
  x.lineWidth = 6; x.lineCap = "round"; x.strokeStyle = "#111";
  x.beginPath(); x.arc(64, 70, 28, .2 * Math.PI, .8 * Math.PI); x.stroke();
  const faceMat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(fc) });

  const body = new THREE.Group();                         // origin = feet
  const torso = new THREE.Group();                         // torso joint (root joint)
  torso.position.set(...REST.torso);
  torso.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), mat(colors.torso)));
  body.add(torso);
  const head = new THREE.Group(); head.position.set(...REST.head); torso.add(head);
  const hm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), [mat(colors.head), mat(colors.head), mat(colors.head), mat(colors.head), faceMat, mat(colors.head)]);
  hm.position.y = .65; head.add(hm);
  // Each limb pivots on its real R6 joint; the box hangs from it. Everything joins the torso.
  const joint = (name, color, offset) => {
    const g = new THREE.Group(); g.position.set(...REST[name]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat(color)); m.position.set(offset[0], offset[1], 0);
    g.add(m); torso.add(g); return g;
  };
  const rArm = joint("rArm", colors.rightArm, [0.5, -0.5]), lArm = joint("lArm", colors.leftArm, [-0.5, -0.5]);
  const rLeg = joint("rLeg", colors.rightLeg, [-0.5, -1]), lLeg = joint("lLeg", colors.leftLeg, [0.5, -1]);
  return { body, torso, head, rArm, lArm, rLeg, lLeg };
}

function disposeAvatar(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    o.material && [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); });
  });
}

// Loads the Roblox OBJ/MTL that scripts/sync-avatar.mjs downloaded, then splits it into R6 limbs.
function loadModel(model) {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(BASE);
    mtlLoader.load(model.mtl, materials => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath(BASE);
      objLoader.load(model.obj, root => {
        root.traverse(o => {
          if (!o.isMesh) return;
          [].concat(o.material).forEach(m => {
            m.side = THREE.DoubleSide;                 // thin hair/hat meshes need both sides
            m.transparent = false;                     // prevent unintended see-through materials
            m.opacity = 1;
            m.depthWrite = true;
            if ("transmission" in m) m.transmission = 0;
            if (m.map) m.color.set(0xffffff);          // let the texture show at full brightness
            m.needsUpdate = true;
          });
        });
        try { resolve(splitIntoR6Parts(root)); } catch (e) { reject(e); }
      }, undefined, reject);
    }, undefined, reject);
  });
}

/**
 * props:
 *  size    - canvas width in px
 *  pose    - idle | walk | held | fall | land | pat | wave | dance | dance2 | dance3
 *  dir     - 1 or -1, walking direction
 *  vx      - horizontal speed (px/s), used to tilt while held or falling
 *  look    - { x, y } cursor position in px (head follows it while calm)
 *  getPos  - () => { x, y } of the canvas on screen, for head tracking
 */
export default function CoyAvatar3D({ size = 92, pose = "idle", dir = 1, vx = 0, look, getPos }) {
  const canvasRef = useRef(null);
  const live = useRef({});
  live.current = { pose, dir, vx, look, getPos };
  const W = size, H = Math.round(size / ASPECT);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, W / H, .1, 100);
    camera.position.set(0, 2.8, 12.5); camera.lookAt(0, 2.8, 0);
    scene.add(new THREE.AmbientLight(0xffffff, .7));
    const sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(3, 6, 8); scene.add(sun);

    let av = null, raf = 0, cancelled = false;
    let previousPose = "";
    let poseStart = 0;
    const pose = P({});
    const look = { x: 0, y: 0 };
    const clock = new THREE.Clock();

    // Re-checking the metadata lets the avatar change when your Roblox outfit does.
    let version = null;
    const loadMeta = () => fetch(META_URL, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then(async meta => {
        if (cancelled || (av && meta.version === version)) return;
        version = meta.version;
        let next = null;
        if (meta.model) {
          const v = "?v=" + (meta.model.hash || meta.version);
          try { next = await loadModel({ obj: meta.model.obj + v, mtl: meta.model.mtl + v }); }
          catch (e) { console.warn("Coy: avatar model failed to load, using blocks", e); }
        }
        if (!next) next = buildAvatar({ ...DEFAULT_COLORS, ...meta.bodyColors });
        if (cancelled) { disposeAvatar(next.body); return; }
        if (av) { scene.remove(av.body); disposeAvatar(av.body); }
        av = next;
        scene.add(av.body);
      });
    loadMeta();
    const metaTimer = setInterval(loadMeta, 5 * 60 * 1000);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!av || document.hidden) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const L = live.current;

      // Restart each animation's phase when the companion switches poses.
      if (L.pose !== previousPose) {
        previousPose = L.pose;
        poseStart = t;
        Object.assign(pose, P({}));
      }
      const localTime = t - poseStart;
      const tiltIn = clamp(-L.vx * 0.0006, -0.5, 0.5);
      const nextPose = target(L.pose, localTime, L.dir, tiltIn);
      const impactPose = L.pose === "pat" || L.pose === "land";
      const blend = 1 - Math.exp(-delta * (impactPose ? 30 : 15));

      // Rebuild a clean base pose every frame; only our explicitly authored
      // joint targets are then applied. No imported CFrames are layered over it.
      resetAvatarPose(av);
      for (const key in pose) pose[key] += (nextPose[key] - pose[key]) * blend;

      // Coy faces +Z. His anatomical RIGHT is therefore on screen-left (lArm/lLeg).
      av.lArm.rotation.set(pose.rArmX, 0, pose.rArmZ);
      av.rArm.rotation.set(pose.lArmX, 0, pose.lArmZ);
      av.lLeg.rotation.x = pose.rLegX;
      av.rLeg.rotation.x = pose.lLegX;

      av.body.position.y = pose.bob;
      // Keep Coy facing the visitor; directional movement is handled by the gait,
      // not by rotating the whole rig into a stiff side-on pose.
      av.body.rotation.y = 0;
      av.body.rotation.z = pose.tilt;
      av.body.scale.set(1 + pose.sq, 1 - pose.sq, 1 + pose.sq);

      // Look toward the cursor when calm, using absolute head angles so rotation
      // never accumulates frame after frame or inherits a previous dance pose.
      let wy = 0, wx = 0;
      if (["idle", "pat"].includes(L.pose) && L.look && L.getPos) {
        const p = L.getPos() || {};
        const px = Number.isFinite(p.x) ? p.x : p.left;
        const py = Number.isFinite(p.y) ? p.y : p.top;
        if (Number.isFinite(px) && Number.isFinite(py)) {
          wy = clamp((L.look.x - (px + W / 2)) / window.innerWidth * 2, -0.9, 0.9);
          wx = clamp((L.look.y - (py + H / 2)) / window.innerHeight, -0.5, 0.5);
        }
      }
      const lookBlend = 1 - Math.exp(-8 * delta);
      look.y += (wy - look.y) * lookBlend;
      look.x += (wx - look.x) * lookBlend;
      av.head.rotation.set(
        clamp(pose.headX + look.x * 0.32, -0.45, 0.45),
        clamp(pose.headY + look.y * 0.58, -0.65, 0.65),
        0
      );
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelled = true; cancelAnimationFrame(raf); clearInterval(metaTimer);
      scene.traverse(o => { o.geometry?.dispose(); o.material && [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); });
      renderer.dispose();
    };
  }, [W, H]);

  // The negative margin lets the feet sit exactly on the taskbar edge.
  return <canvas ref={canvasRef} aria-label="Coy" role="img"
    style={{ width: W, height: H, display: "block", marginBottom: -Math.round(H * FOOT), cursor: "grab", touchAction: "none", pointerEvents: "auto" }} />;
}
