import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";

// R6 avatar rendered on a transparent canvas. Colors come from /avatar/avatar.json,
// which scripts/sync-avatar.mjs refreshes from Roblox on a schedule.
const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/";
const META_URL = BASE + "avatar.json";
const ASPECT = 0.9;          // canvas width / height
const FOOT = 0.09;           // fraction of canvas height below the feet
const DEFAULT_COLORS = { head: "#f5cd30", torso: "#2f6fed", leftArm: "#f5cd30", rightArm: "#f5cd30", leftLeg: "#2b2f3a", rightLeg: "#2b2f3a" };

const P = o => Object.assign({ rZ: .1, lZ: -.1, rX: 0, lX: 0, rL: 0, lL: 0, bob: 0, spin: 0, tilt: 0, sq: 0 }, o);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function target(pose, t, dir, tiltIn) {
  let s;
  switch (pose) {
    case "wave":   return P({ rZ: 2.6 + Math.sin(t * 12) * .35 });
    case "dance":  s = Math.sin(t * 8);  return P({ rZ: 2.2 + s * .5, lZ: -(2.2 - s * .5), rL: s * .6, lL: -s * .6, bob: Math.abs(s) * .35, spin: Math.sin(t * 4) * .6 });
    case "dance2": s = Math.sin(t * 10); return P({ rZ: .2, lZ: -.2, rX: -1.3 + s * .7, lX: -1.3 - s * .7, bob: Math.abs(s) * .4 });
    case "dance3": s = Math.sin(t * 6);  return P({ rZ: 1.6 + s * .8, lZ: -(1.6 + s * .8), rL: s * .3, lL: -s * .3, bob: Math.abs(s) * .15, spin: Math.sin(t * 3) * 1.1 });
    case "walk":   s = Math.sin(t * 10); return P({ rX: s * .8, lX: -s * .8, rL: -s * .7, lL: s * .7, bob: Math.abs(s) * .08, spin: dir * 1.1 });
    case "held":   s = Math.sin(t * 14); return P({ rZ: 2.5 + s * .4, lZ: -(2.5 - s * .4), rL: Math.sin(t * 9) * .5, lL: -Math.sin(t * 9) * .5, tilt: tiltIn });
    case "fall":   return P({ rZ: 2.7, lZ: -2.7, rL: .4, lL: -.4, tilt: tiltIn });
    case "land":   return P({ sq: .25 });
    case "pat":    return P({ sq: Math.sin(t * 14) * .06, rZ: .3, lZ: -.3 });
    default:       return P({ rZ: .1 + Math.sin(t * 2) * .03, lZ: -.1 - Math.sin(t * 2) * .03, bob: Math.sin(t * 2) * .03 });
  }
}

function poseQuaternion(cframe) {
  if (!Array.isArray(cframe) || cframe.length < 12) return null;
  const matrix = new THREE.Matrix4().set(
    cframe[3], cframe[4], cframe[5], 0,
    cframe[6], cframe[7], cframe[8], 0,
    cframe[9], cframe[10], cframe[11], 0,
    0, 0, 0, 1
  );
  return new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
}

function applyImportedAnimation(av, clip, elapsed) {
  if (!clip?.frames?.length) return false;
  const frames = clip.frames;
  const duration = Math.max(0, Number(clip.duration) || frames[frames.length - 1]?.time || 0);
  const time = duration > 0 && clip.loop !== false ? elapsed % duration : Math.min(elapsed, duration);
  let a = frames[0], b = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (time >= frames[i].time && time <= frames[i + 1].time) { a = frames[i]; b = frames[i + 1]; break; }
  }
  const span = Math.max(0.000001, (b.time || 0) - (a.time || 0));
  const alpha = clamp((time - (a.time || 0)) / span, 0, 1);
  const q = name => {
    const qa = poseQuaternion(a.poses?.[name]);
    const qb = poseQuaternion(b.poses?.[name]);
    if (!qa && !qb) return null;
    return (qa || qb).clone().slerp(qb || qa, alpha);
  };
  const torso = q("Torso"), head = q("Head");
  const rightArm = q("Right Arm"), leftArm = q("Left Arm");
  const rightLeg = q("Right Leg"), leftLeg = q("Left Leg");
  if (torso) av.body.quaternion.copy(torso);
  if (head) av.head.quaternion.copy(head);
  if (rightArm) av.rArm.quaternion.copy(rightArm);
  if (leftArm) av.lArm.quaternion.copy(leftArm);
  if (rightLeg) av.rLeg.quaternion.copy(rightLeg);
  if (leftLeg) av.lLeg.quaternion.copy(leftLeg);
  return true;
}

function buildAvatar(colors) {
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const limb = (c, px, py) => {
    const g = new THREE.Group(); g.position.set(px, py, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat(c)); m.position.y = -1; g.add(m); return g;
  };
  const fc = document.createElement("canvas"); fc.width = fc.height = 128;
  const x = fc.getContext("2d");
  x.fillStyle = colors.head; x.fillRect(0, 0, 128, 128); x.fillStyle = "#111";
  x.fillRect(34, 42, 12, 22); x.fillRect(82, 42, 12, 22);
  x.lineWidth = 6; x.lineCap = "round"; x.strokeStyle = "#111";
  x.beginPath(); x.arc(64, 70, 28, .2 * Math.PI, .8 * Math.PI); x.stroke();
  const faceMat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(fc) });

  const body = new THREE.Group();                         // origin = feet
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), mat(colors.torso)); torso.position.y = 3; body.add(torso);
  const head = new THREE.Group(); head.position.set(0, 4, 0); body.add(head);
  const hm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), [mat(colors.head), mat(colors.head), mat(colors.head), mat(colors.head), faceMat, mat(colors.head)]);
  hm.position.y = .65; head.add(hm);
  const rArm = limb(colors.rightArm, 1.5, 4), lArm = limb(colors.leftArm, -1.5, 4);
  const rLeg = limb(colors.rightLeg, .5, 2), lLeg = limb(colors.leftLeg, -.5, 2);
  body.add(rArm, lArm, rLeg, lLeg);
  return { body, head, rArm, lArm, rLeg, lLeg };
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
    let animations = {};
    let activeAnimation = "";
    let animationStart = 0;
    const pose = P({});
    const clock = new THREE.Clock();
    fetch(BASE + "animations.json")
      .then(response => response.ok ? response.json() : null)
      .then(data => { animations = data?.animations || {}; })
      .catch(() => { /* keep the hand-authored fallback if no exported clips exist */ });

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
      clock.getDelta();
      const t = clock.elapsedTime, L = live.current;
      const clipName = ({ idle: "idle1", idle1: "idle1", idle2: "idle2", dance: "dance1", dance1: "dance1" })[L.pose] || L.pose;
      const clip = animations[clipName];
      if (clipName !== activeAnimation) { activeAnimation = clipName; animationStart = t; }
      const usingImported = applyImportedAnimation(av, clip, t - animationStart);
      if (!usingImported) {
        const tg = target(L.pose, t, L.dir, clamp(-L.vx * .0006, -.5, .5));
        for (const k in pose) pose[k] += (tg[k] - pose[k]) * .15;
        av.rArm.rotation.z = pose.rZ; av.lArm.rotation.z = pose.lZ;
        av.rArm.rotation.x = pose.rX; av.lArm.rotation.x = pose.lX;
        av.rLeg.rotation.x = pose.rL; av.lLeg.rotation.x = pose.lL;
        av.body.position.y = pose.bob; av.body.rotation.y = pose.spin; av.body.rotation.z = pose.tilt;
        av.body.scale.set(1 + pose.sq, 1 - pose.sq, 1 + pose.sq);
      } else {
        av.body.position.y = 0;
        av.body.scale.set(1, 1, 1);
      }

      let wy = 0, wx = 0;                                   // head follows the cursor when calm
      if (!usingImported && ["idle", "wave", "pat"].includes(L.pose) && L.look && L.getPos) {
        const p = L.getPos();
        wy = clamp((L.look.x - (p.x + W / 2)) / window.innerWidth * 2, -.9, .9);
        wx = clamp((L.look.y - (p.y + H / 2)) / window.innerHeight, -.5, .5);
      }
      if (!usingImported) {
        av.head.rotation.y += (wy - pose.spin * .5 - av.head.rotation.y) * .12;
        av.head.rotation.x += (wx - av.head.rotation.x) * .12;
      }
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
