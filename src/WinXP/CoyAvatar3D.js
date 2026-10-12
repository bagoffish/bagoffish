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

function resetAvatarPose(av) {
  // Clear transforms from the previous animation system before another clip
  // is applied. Otherwise procedural Euler rotations and imported keyframes
  // can accumulate and make Coy look like two animations are playing at once.
  av.body.position.set(0, 0, 0);
  av.body.rotation.set(0, 0, 0);
  av.body.scale.set(1, 1, 1);
  const joints = [
    [av.torso || av.body, [0, 3, 0]],
    [av.head, [0, 1, 0]],
    [av.rArm, [1.5, 1, 0]],
    [av.lArm, [-1.5, 1, 0]],
    [av.rLeg, [0.5, 2, 0]],
    [av.lLeg, [-0.5, 2, 0]]
  ];
  joints.forEach(([part, position]) => {
    if (!part) return;
    part.quaternion.identity();
    part.position.set(...position);
  });
}

function captureAvatarPose(av) {
  const parts = [av.body, av.torso, av.head, av.rArm, av.lArm, av.rLeg, av.lLeg].filter(Boolean);
  return parts.map(part => ({ part, position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone() }));
}

function blendAvatarPose(snapshot, amount) {
  snapshot.forEach(from => {
    const part = from.part;
    const targetPosition = part.position.clone();
    const targetQuaternion = part.quaternion.clone();
    const targetScale = part.scale.clone();
    part.position.lerpVectors(from.position, targetPosition, amount);
    part.quaternion.copy(from.quaternion).slerp(targetQuaternion, amount).normalize();
    part.scale.lerpVectors(from.scale, targetScale, amount);
  });
}

function applyImportedAnimation(av, clip, elapsed) {
  if (!clip?.frames?.length) return false;
  resetAvatarPose(av);
  const frames = clip.frames;
  const duration = Math.max(0, Number(clip.duration) || frames[frames.length - 1]?.time || 0);
  const time = duration > 0 && clip.loop !== false ? elapsed % duration : Math.min(elapsed, duration);
  let a = frames[0], b = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (time >= frames[i].time && time <= frames[i + 1].time) { a = frames[i]; b = frames[i + 1]; break; }
  }
  const span = Math.max(0.000001, (b.time || 0) - (a.time || 0));
  const alpha = clamp((time - (a.time || 0)) / span, 0, 1);
  let applied = 0;
  const applyPose = (part, name, basePosition) => {
    const ca = a.poses?.[name], cb = b.poses?.[name];
    if (!part || (!ca && !cb)) return;
    applied += 1;
    const from = ca || cb, to = cb || ca;
    const qa = poseQuaternion(from), qb = poseQuaternion(to);
    if (qa && qb) part.quaternion.copy(qa.slerp(qb, alpha));
    // Roblox Pose.CFrame is a joint-local transform. Preserve its translation
    // relative to the joint pivot instead of discarding it or treating it as
    // a world-space position. The avatar is normalized to five studs tall.
    const pa = ca || cb, pb = cb || ca;
    const tx = THREE.MathUtils.lerp(pa[0] || 0, pb[0] || 0, alpha);
    const ty = THREE.MathUtils.lerp(pa[1] || 0, pb[1] || 0, alpha);
    const tz = THREE.MathUtils.lerp(pa[2] || 0, pb[2] || 0, alpha);
    part.position.set(basePosition[0] + tx, basePosition[1] + ty, basePosition[2] + tz);
  };
  // Root translation moves the whole character; root rotation is handled by
  // the companion controller's facing direction.
  const rootA = a.poses?.HumanoidRootPart || b.poses?.HumanoidRootPart;
  const rootB = b.poses?.HumanoidRootPart || rootA;
  if (rootA && rootB) {
    av.body.position.set(
      THREE.MathUtils.lerp(rootA[0] || 0, rootB[0] || 0, alpha),
      THREE.MathUtils.lerp(rootA[1] || 0, rootB[1] || 0, alpha),
      THREE.MathUtils.lerp(rootA[2] || 0, rootB[2] || 0, alpha)
    );
  }
  applyPose(av.torso || av.body, "Torso", [0, 3, 0]);
  applyPose(av.head, "Head", [0, 1, 0]);
  applyPose(av.rArm, "Right Arm", [1.5, 1, 0]);
  applyPose(av.lArm, "Left Arm", [-1.5, 1, 0]);
  applyPose(av.rLeg, "Right Leg", [0.5, 2, 0]);
  applyPose(av.lLeg, "Left Leg", [-0.5, 2, 0]);
  return applied > 0;
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
  const torso = new THREE.Group();                         // torso joint pivot
  torso.position.set(0, 3, 0);
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), mat(colors.torso)); torsoMesh.position.y = 0; torso.add(torsoMesh); body.add(torso);
  const head = new THREE.Group(); head.position.set(0, 1, 0); torso.add(head);
  const hm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), [mat(colors.head), mat(colors.head), mat(colors.head), mat(colors.head), faceMat, mat(colors.head)]);
  hm.position.y = .65; head.add(hm);
  const rArm = limb(colors.rightArm, 1.5, 1), lArm = limb(colors.leftArm, -1.5, 1);
  const rLeg = limb(colors.rightLeg, .5, 2), lLeg = limb(colors.leftLeg, -.5, 2);
  torso.add(rArm, lArm); body.add(rLeg, lLeg);
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
export default function CoyAvatar3D({ size = 145, pose = "idle", dir = 1, vx = 0, look, getPos }) {
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
    let previousPose = "";
    let transitionFrom = null;
    let transitionStart = 0;
    const TRANSITION_SECONDS = 0.32;
    const pose = P({});
    const clock = new THREE.Clock();
    fetch(BASE + "animations.json?v=1", { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(data => {
        animations = data?.animations || {};
        const names = Object.keys(animations);
      })
      .catch(error => {
        animations = {};
        console.error("Coy: imported Roblox animations failed to load; using procedural fallback", error);
      });

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
      const t = clock.elapsedTime, L = live.current;
      const blend = 1 - Math.exp(-12 * delta);
      // Treat each requested pose as a fresh animation state. This prevents a
      // previous one-shot clip or smoothed procedural pose from leaking into the next.
      if (L.pose !== previousPose) {
        transitionFrom = captureAvatarPose(av);
        transitionStart = t;
        previousPose = L.pose;
        activeAnimation = "";
        animationStart = t;
        Object.assign(pose, P({}));
        resetAvatarPose(av);
        av.body.position.set(0, 0, 0);
        av.body.rotation.set(0, 0, 0);
        av.body.scale.set(1, 1, 1);
      }
      const clipName = ({ idle: "idle1", idle1: "idle1", dance: "dance1", dance1: "dance1" })[L.pose] || L.pose;
      const clip = animations[clipName];
      // Don't start the animation clock until its imported clip is actually available.
      // Otherwise a slow fetch/model load can consume a one-shot wave before Coy appears.
      if (clip && clipName !== activeAnimation) {
        // If the animation data arrived after the initial pose transition,
        // capture the current pose now so loading a clip never causes a snap.
        if (activeAnimation === "" && t - transitionStart >= TRANSITION_SECONDS) {
          transitionFrom = captureAvatarPose(av);
          transitionStart = t;
        }
        activeAnimation = clipName;
        animationStart = t;
      }
      // Use imported clips when present; pat/held/land remain procedural.
      const usingImported = Boolean(clip && clipName !== "pat" && applyImportedAnimation(av, clip, t - animationStart));
      if (!usingImported) {
        resetAvatarPose(av);
        const tg = target(L.pose, t, L.dir, clamp(-L.vx * .0006, -.5, .5));
        for (const k in pose) pose[k] += (tg[k] - pose[k]) * blend;
        av.rArm.rotation.z = pose.rZ; av.lArm.rotation.z = pose.lZ;
        av.rArm.rotation.x = pose.rX; av.lArm.rotation.x = pose.lX;
        av.rLeg.rotation.x = pose.rL; av.lLeg.rotation.x = pose.lL;
        av.body.position.y = pose.bob; av.body.rotation.y = pose.spin; av.body.rotation.z = pose.tilt;
        av.body.scale.set(1 + pose.sq, 1 - pose.sq, 1 + pose.sq);
      } else {
        // Imported clips own the whole pose for this frame; clear root transforms
        // left by procedural dance/fall/held poses before applying the clip.
        av.body.position.set(0, 0, 0);
        av.body.rotation.set(0, 0, 0);
        av.body.scale.set(1, 1, 1);
      }

      // Cross-fade body-part position, rotation and scale so animation changes
      // connect naturally, including squash/stretch and landing recovery.
      if (transitionFrom) {
        const raw = clamp((t - transitionStart) / TRANSITION_SECONDS, 0, 1);
        const eased = raw * raw * (3 - 2 * raw);
        blendAvatarPose(transitionFrom, eased);
        if (raw >= 1) transitionFrom = null;
      }

      // Face the actual direction of travel: front-facing at rest, a full 90° turn while walking.
      // Apply this after either imported or procedural animation so clips cannot override it.
      av.body.rotation.y = L.pose === "walk" ? L.dir * Math.PI / 2 : (usingImported ? 0 : av.body.rotation.y);

      let wy = 0, wx = 0;                                   // head follows the cursor when calm
      if (!usingImported && ["idle", "pat"].includes(L.pose) && L.look && L.getPos) {
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
