import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
import { REST, resetAvatarPose } from "./r6Retarget";

// R6 avatar rendered on a transparent canvas. Colors come from /avatar/avatar.json,
// which scripts/sync-avatar.mjs refreshes from Roblox on a schedule.
const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/";
const META_URL = BASE + "avatar.json";
const ASPECT = 0.9;          // canvas width / height
const FOOT = 0.09;           // fraction of canvas height below the feet
const DEFAULT_COLORS = { head: "#f5cd30", torso: "#2f6fed", leftArm: "#f5cd30", rightArm: "#f5cd30", leftLeg: "#2b2f3a", rightLeg: "#2b2f3a" };

const P = o => Object.assign({
  // Angles are labelled by the character's anatomy, not the side of the screen.
  rArmZ: 0, lArmZ: 0, rArmX: 0, lArmX: 0,
  rLegX: 0, lLegX: 0, bob: 0, spin: 0, tilt: 0, sq: 0,
  headX: 0, headY: 0
}, o);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// Procedural classic-R6 motion. Roblox's R6 has one shoulder and one hip joint
// per side (no elbows/knees), so every pose is made from restrained joint angles
// and a root bob/turn. This intentionally avoids applying exported Pose.CFrames
// directly as world transforms, which was causing limbs to slide and cross over.
function target(name, t, dir, tiltIn) {
  const cycle = (speed, phase = 0) => Math.sin(t * speed + phase);
  switch (name) {
    case "wave":
      // Raise the character's anatomical RIGHT arm (screen-left while facing us)
      // and wave it from the shoulder without swapping to the other arm.
      return P({
        rArmZ: 2.22 + (0.5 + 0.5 * cycle(10.5)) * 0.24,
        rArmX: 0.08 + cycle(8.8) * 0.12,
        lArmZ: 0.08,
        bob: cycle(5.8) * 0.012,
        headY: -0.04 + cycle(2.2) * 0.035
      });
    case "walk": {
      const s = cycle(9.5);
      return P({
        rArmZ: -0.08, lArmZ: 0.08,
        rArmX: -s * 0.38, lArmX: s * 0.38,
        rLegX: s * 0.68, lLegX: -s * 0.68,
        bob: 0.025 + Math.abs(s) * 0.025,
        headX: Math.abs(s) * 0.015
      });
    }
    case "dance":
    case "dance1": {
      const s = cycle(7.2);
      const opposite = cycle(7.2, Math.PI);
      return P({
        rArmZ: -1.42 - s * 0.3, lArmZ: 1.42 + s * 0.3,
        rArmX: 0.18 + s * 0.3, lArmX: -0.18 - s * 0.3,
        rLegX: opposite * 0.52, lLegX: s * 0.52,
        bob: 0.065 + Math.abs(s) * 0.055,
        spin: cycle(3.6) * 0.08,
        headY: cycle(3.6, 0.7) * 0.12
      });
    }
    case "dance2": {
      const s = cycle(9.2);
      return P({
        rArmZ: -2.08 - s * 0.24, lArmZ: 2.08 + s * 0.24,
        rArmX: s * 0.32, lArmX: -s * 0.32,
        rLegX: cycle(9.2, Math.PI) * 0.65,
        lLegX: s * 0.65,
        bob: 0.055 + Math.abs(s) * 0.06,
        spin: cycle(4.6) * 0.06,
        headY: cycle(4.6, 0.8) * 0.1
      });
    }
    case "dance3": {
      const s = cycle(6.4);
      return P({
        rArmZ: -1.25 - s * 0.6, lArmZ: 1.25 + s * 0.6,
        rArmX: cycle(6.4, 1.1) * 0.26,
        lArmX: cycle(6.4, Math.PI + 1.1) * 0.26,
        rLegX: cycle(6.4, Math.PI) * 0.58,
        lLegX: s * 0.58,
        bob: 0.045 + Math.abs(s) * 0.035,
        spin: cycle(3.2) * 0.12,
        headY: -cycle(3.2) * 0.1
      });
    }
    case "held": {
      const s = cycle(13.5);
      return P({
        rArmZ: -2.18 - s * 0.2, lArmZ: 2.18 + s * 0.2,
        rArmX: s * 0.25, lArmX: -s * 0.25,
        rLegX: cycle(8.5) * 0.35, lLegX: -cycle(8.5) * 0.35,
        tilt: tiltIn, bob: cycle(6) * 0.018
      });
    }
    case "fall":
      return P({
        rArmZ: -2.42, lArmZ: 2.42,
        rArmX: -0.22, lArmX: 0.22,
        rLegX: 0.46, lLegX: -0.34,
        tilt: tiltIn
      });
    case "land":
      return P({ rArmZ: -0.24, lArmZ: 0.24, sq: 0.13 * Math.exp(-t * 9) });
    case "pat": {
      const s = cycle(15);
      return P({
        rArmZ: -0.16, lArmZ: 0.16,
        sq: Math.abs(s) * 0.055,
        headX: -0.06 + Math.abs(s) * 0.04
      });
    }
    case "idle":
    case "idle1":
    case "idle2":
    default:
      return P({
        rArmZ: -0.045, lArmZ: 0.045,
        bob: cycle(2.1) * 0.022,
        headX: cycle(1.4) * 0.025,
        headY: cycle(1.1) * 0.045
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
      const blend = 1 - Math.exp(-delta * 12);

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
      av.body.rotation.y = L.pose === "walk" ? L.dir * Math.PI / 2 : pose.spin;
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
