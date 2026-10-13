import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
import { REST, resetAvatarPose, applyImportedAnimation } from "./r6Retarget";

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
    case "land":   return P({ sq: .25, rZ: -.24, lZ: .24 });
    case "pat":    return P({ sq: Math.sin(t * 14) * .06, rZ: -.3, lZ: .3 });
    case "swordslash": { const a = (t % 0.9) / 0.9; return P({ rZ: a < .28 ? 1.8 : a < .58 ? -1.8 : .2, rX: a < .28 ? -0.7 : a < .58 ? 0.65 : 0, lZ: -0.25, tilt: a > .28 && a < .58 ? -0.12 : 0 }); }
    case "swordlunge": { const a = (t % 1.15) / 1.15; return P({ rZ: a < .25 ? 1.9 : a < .62 ? 2.8 : .1, rX: a < .25 ? -0.6 : a < .62 ? -1.0 : 0, lZ: a < .62 ? -0.7 : 0.1, tilt: a < .62 ? -0.28 : 0, bob: a < .62 ? 0.12 : 0 }); }
    case "gearhold": return P({ rZ: 1.2 + Math.sin(t * 2) * .04, rX: -0.55, lZ: -0.35 });
    case "climbing": { const a = Math.sin(t * 7); return P({ rZ: 1.9 + a * .25, lZ: -(1.9 - a * .25), rX: -0.6 + a * .2, lX: -0.6 - a * .2, rL: -a * .4, lL: a * .4, bob: Math.abs(a) * .08, tilt: -0.12 }); }
    case "grapple": { const a = Math.sin(t * 8); return P({ rZ: 1.35 + a * .12, rX: -0.5, lZ: -0.45, tilt: -0.08, bob: Math.abs(a) * .04 }); }
    default:       return P({ rZ: .1 + Math.sin(t * 2) * .03, lZ: -.1 - Math.sin(t * 2) * .03, bob: Math.sin(t * 2) * .03 });
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

// Load classic Roblox gear, recentering exported world-space vertices and scaling for R6.
function loadGear(filename, scale) {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(BASE + "gears/");
    mtlLoader.load(filename.replace(/\.obj$/i, ".mtl"), materials => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath(BASE + "gears/");
      objLoader.load(filename, root => {
        root.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(root);
        if (bounds.isEmpty()) { reject(new Error("Empty gear model: " + filename)); return; }
        const center = bounds.getCenter(new THREE.Vector3());
        root.traverse(object => {
          if (!object.isMesh) return;
          object.geometry = object.geometry.clone();
          object.geometry.applyMatrix4(object.matrixWorld);
          object.geometry.translate(-center.x, -center.y, -center.z);
          object.geometry.scale(scale, scale, scale);
          object.position.set(0, 0, 0);
          object.rotation.set(0, 0, 0);
          object.scale.set(1, 1, 1);
          const materials = [].concat(object.material).map(material => {
            const m = material.clone();
            m.side = THREE.DoubleSide;
            m.transparent = false;
            m.depthWrite = true;
            if (m.map) m.color.set(0xffffff);
            m.needsUpdate = true;
            return m;
          });
          object.material = materials.length === 1 ? materials[0] : materials;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        root.scale.set(1, 1, 1);
        root.visible = false;
        resolve(root);
      }, undefined, reject);
    }, undefined, reject);
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

            // Handle4Mtl is Coy's @ hairclip, which should stay neon green.
            // Its exported 1x1 texture is unreliable, so color the clip explicitly.
            if (/^Handle4Mtl$/i.test(m.name || "")) {
              m.map = null;
              m.alphaMap = null;
              m.color.set("#39ff14");
            } else if (m.map) {
              m.color.set(0xffffff);                   // let real textures show at full brightness
            }
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
export default function CoyAvatar3D({ size = 92, pose = "idle", dir = 1, vx = 0, impact = 0, look, getPos }) {
  const canvasRef = useRef(null);
  const live = useRef({});
  live.current = { pose, dir, vx, impact, look, getPos };
  const W = size, H = Math.round(size / ASPECT);
  // Keep the drag/collision footprint compact, but make the actual WebGL viewport
  // far larger so swinging limbs, turns, and accessories don't get cut at its edges.
  const RENDER_W = Math.round(W * 3), RENDER_H = Math.round(H * 2.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(RENDER_W, RENDER_H, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, RENDER_W / RENDER_H, .1, 100);
    // Scale distance with the taller viewport to preserve Coy's on-screen size.
    camera.position.set(0, 2.8, 12.5 * (RENDER_H / H)); camera.lookAt(0, 2.8, 0);
    scene.add(new THREE.AmbientLight(0xffffff, .7));
    const sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(3, 6, 8); scene.add(sun);

    let av = null, raf = 0, cancelled = false;
    let swordGear = null, grappleGear = null;
    let grappleHook = null, grappleCable = null;
    const cableGeometry = new THREE.BufferGeometry();
    cableGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    const cableMaterial = new THREE.LineBasicMaterial({ color: 0x171717, depthTest: false });
    grappleCable = new THREE.Line(cableGeometry, cableMaterial);
    grappleCable.frustumCulled = false; grappleCable.renderOrder = 20; scene.add(grappleCable);
    grappleHook = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), new THREE.MeshStandardMaterial({ color: 0x292929, metalness: 0.65, roughness: 0.4 }));
    grappleHook.visible = false; grappleHook.renderOrder = 21; scene.add(grappleHook);
    let grappleStartAt = 0;
    const attachGear = () => {
      if (!av) return;
      if (swordGear) av.rArm.add(swordGear);
      if (grappleGear) av.rArm.add(grappleGear);
    };
    loadGear("Sword.obj", 0.52).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      swordGear = gear;
      swordGear.position.set(0.12, -0.48, 0.24);
      swordGear.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
      attachGear();
    }).catch(e => console.warn("Coy: sword gear failed to load", e));
    loadGear("GrappleGun.obj", 0.72).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      grappleGear = gear;
      grappleGear.position.set(0.08, -0.42, 0.22);
      grappleGear.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
      attachGear();
    }).catch(e => console.warn("Coy: grapple gear failed to load", e));
    const bodyBaseScale = new THREE.Vector3(1, 1, 1);
    const headBaseScale = new THREE.Vector3(1, 1, 1);
    let previousPose = "";
    let poseStartedAt = 0;
    let animations = {};
    let activeAnimation = "";
    let animationStart = 0;
    let transitionFrom = null;
    let transitionStartedAt = 0;
    const transitionDuration = 0.34;
    const partNames = ["torso", "head", "rArm", "lArm", "rLeg", "lLeg"];
    const capturePose = () => ({
      bodyPosition: av.body.position.clone(),
      bodyQuaternion: av.body.quaternion.clone(),
      bodyScale: av.body.scale.clone(),
      parts: Object.fromEntries(partNames.map(name => {
        const part = av[name];
        return [name, part ? { position: part.position.clone(), quaternion: part.quaternion.clone(), scale: part.scale.clone() } : null];
      }))
    });
    const pose = P({});
    const look = { x: 0, y: 0 }, lookQuat = new THREE.Quaternion(), lookEuler = new THREE.Euler();
    const clock = new THREE.Clock();
    const readAnimationFile = url => fetch(url, { cache: "no-store" })
      .then(response => response.ok ? response.json() : {})
      .catch(() => ({}));
    Promise.all([
      readAnimationFile(BASE + "animations.json?v=2"),
      readAnimationFile(BASE + "coy-tools-animations.json?v=1")
    ]).then(([baseData, toolData]) => {
      animations = { ...(baseData?.animations || {}), ...(toolData?.animations || {}) };
      // Gear hold and climbing are held poses, regardless of the sequence's Loop flag.
      for (const name of ["gearhold", "climbing"]) {
        if (animations[name]) animations[name] = { ...animations[name], loop: true };
      }
      const names = Object.keys(animations);
      if (!names.length) console.warn("Coy: no imported animation clips found; using procedural fallback");
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
        if (av) {
          swordGear?.removeFromParent(); grappleGear?.removeFromParent();
          scene.remove(av.body); disposeAvatar(av.body);
        }
        av = next;
        bodyBaseScale.copy(av.body.scale);
        if (av.head) headBaseScale.copy(av.head.scale);
        scene.add(av.body);
        attachGear();
      });
    loadMeta();
    const metaTimer = setInterval(loadMeta, 5 * 60 * 1000);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!av || document.hidden) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime, L = live.current;
      if (L.pose !== previousPose) {
        previousPose = L.pose;
        poseStartedAt = t;
        // Preserve the exact currently-rendered pose so every state change crossfades,
        // including the quarter-turn into walk and the return to idle.
        if (av && L.pose !== "land") {
          transitionFrom = capturePose();
          transitionStartedAt = t;
        } else if (L.pose === "land") {
          // Landing is an impact, not a blended animation: let the squash hit now.
          transitionFrom = null;
        }
      }
      // Being held uses the real Roblox falling clip, like picking up a character in Roblox.
      const clipName = ({ idle: "idle1", idle1: "idle1", dance: "dance1", dance1: "dance1", held: "fall" })[L.pose] || L.pose;
      // Keep landing/patting procedural: imported clips can twist the arms through the torso
      // right as the body compresses, making the squash look inside-out.
      const clip = (L.pose === "land" || L.pose === "pat") ? null : animations[clipName];
      // Don't start the animation clock until its imported clip is actually available.
      // Otherwise a slow fetch/model load can consume a one-shot wave before Coy appears.
      if (clip && clipName !== activeAnimation) {
        activeAnimation = clipName;
        animationStart = t;
        console.debug("Coy: playing imported animation", clipName);
      }
      av.body.scale.copy(bodyBaseScale);
      if (av.head) av.head.scale.copy(headBaseScale);
      const usingImported = Boolean(clip) && applyImportedAnimation(av, clip, t - animationStart);
      // The R6 sit clip bends the legs but keeps the root at standing height.
      // Lower the whole rig so Coy visibly settles onto the taskbar/ground.
      if (usingImported && L.pose === "sit") {
        const sitBlend = clamp((t - poseStartedAt) / 320, 0, 1);
        av.body.position.y -= 1.05 * sitBlend;
      }
      if (!usingImported) {
        resetAvatarPose(av);                                  // never mix leftovers from the last clip
        const tg = target(L.pose, t, L.dir, clamp(-L.vx * .0006, -.5, .5));
        for (const k in pose) pose[k] += (tg[k] - pose[k]) * .15;
        av.rArm.rotation.z = pose.rZ; av.lArm.rotation.z = pose.lZ;
        av.rArm.rotation.x = pose.rX; av.lArm.rotation.x = pose.lX;
        av.rLeg.rotation.x = pose.rL; av.lLeg.rotation.x = pose.lL;
        av.body.position.y = pose.bob; av.body.rotation.y = pose.spin; av.body.rotation.z = pose.tilt;
        av.body.scale.set(1 + pose.sq, 1 - pose.sq, 1 + pose.sq);
      }
      // Patting uses a damped spring instead of a sharp repeated pulse: a soft
      // compression, a little rebound, then a smooth settle with no scale drift.
      if (L.pose === "pat") {
        const elapsed = Math.max(0, t - poseStartedAt);
        const pulse = Math.sin(elapsed * 17) * Math.exp(-elapsed * 4.6);
        av.body.scale.set(
          av.body.scale.x * (1 + pulse * 0.045),
          av.body.scale.y * (1 - pulse * 0.085),
          av.body.scale.z * (1 + pulse * 0.045)
        );
        if (av.head) {
          av.head.scale.set(
            headBaseScale.x * (1 + pulse * 0.018),
            headBaseScale.y * (1 - pulse * 0.035),
            headBaseScale.z * (1 + pulse * 0.018)
          );
        }
      }

      // Show classic gear only during its matching emote.
      if (swordGear) swordGear.visible = L.pose === "swordslash" || L.pose === "swordlunge";
      if (grappleGear) grappleGear.visible = ["gearhold", "climbing", "grapple"].includes(L.pose);
      // Rotate the sword through the attack arc, rather than leaving it as a rigid prop.
      if (swordGear) {
        const phase = Math.max(0, (t - poseStartedAt) / (L.pose === "swordlunge" ? 1.15 : 0.9));
        const attack = L.pose === "swordlunge" ? 1 : 0;
        swordGear.rotation.set(Math.PI / 2 + (attack ? -0.65 : 0.35) * Math.sin(phase * Math.PI * 2), 0, -Math.PI / 2 + (attack ? -1.15 : 1.45) * Math.sin(phase * Math.PI * 2));
      }
      if (grappleGear) grappleGear.rotation.set(Math.PI / 2 + Math.sin(t * 5) * 0.04, 0, -Math.PI / 2 - (L.pose === "grapple" ? 0.12 : 0));
      // Hook projectile + dark cable. The hook flies out, connects, pulls Coy upward, then retracts.
      if (grappleCable && grappleHook) {
        const firing = L.pose === "grapple";
        if (firing && previousPose !== "grapple") grappleStartAt = t;
        const elapsed = t - grappleStartAt;
        const active = firing && elapsed < 1.7;
        grappleCable.visible = active; grappleHook.visible = active;
        if (active) {
          av.body.updateMatrixWorld(true); grappleGear?.updateMatrixWorld(true);
          const origin = new THREE.Vector3(0.08, 0.05, 0.45);
          if (grappleGear) grappleGear.localToWorld(origin); else av.rArm.localToWorld(origin);
          const targetPoint = new THREE.Vector3(1.6 + Math.sin(grappleStartAt * 2.7) * 0.65, 4.1 + Math.cos(grappleStartAt * 1.9) * 0.35, 0.1);
          const travel = clamp(elapsed / 0.42, 0, 1);
          const hookPos = origin.clone().lerp(targetPoint, travel);
          grappleHook.position.copy(hookPos);
          const arr = cableGeometry.attributes.position.array;
          arr[0] = origin.x; arr[1] = origin.y; arr[2] = origin.z;
          arr[3] = (origin.x + hookPos.x) / 2; arr[4] = (origin.y + hookPos.y) / 2; arr[5] = (origin.z + hookPos.z) / 2;
          arr[6] = hookPos.x; arr[7] = hookPos.y; arr[8] = hookPos.z;
          cableGeometry.attributes.position.needsUpdate = true; cableGeometry.computeBoundingSphere();
          if (elapsed > 0.42) { const pull = clamp((elapsed - 0.42) / 0.8, 0, 1); av.body.position.y += (Math.min(1.15, pull * 1.15) - av.body.position.y) * 0.08; av.body.rotation.z = -0.08; }
        }
      }
      // Smoothly turn toward the walking direction instead of snapping the whole rig.
      // Use exponential damping so turns remain stable at different frame rates.
      const targetYaw = L.pose === "walk" ? L.dir * Math.PI / 2 : 0;
      const yawAlpha = 1 - Math.exp(-Math.max(delta, 0.001) * (L.pose === "walk" ? 5.5 : 7));
      const yawTarget = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw);
      av.body.quaternion.slerp(yawTarget, yawAlpha).normalize();
      // Held or falling: lean with the sideways speed.
      if (usingImported && (L.pose === "held" || L.pose === "fall")) av.body.rotation.z = clamp(-L.vx * .0006, -.5, .5);

      // Head follows the cursor when calm, layered on top of whatever clip is playing.
      let wy = 0, wx = 0;
      if (["idle", "pat"].includes(L.pose) && L.look && L.getPos) {
        const p = L.getPos() || {};
        const px = Number.isFinite(p.x) ? p.x : p.left;          // accept {x, y} or {left, top}
        const py = Number.isFinite(p.y) ? p.y : p.top;
        if (Number.isFinite(px) && Number.isFinite(py)) {
          wy = clamp((L.look.x - (px + W / 2)) / window.innerWidth * 2, -.9, .9);
          wx = clamp((L.look.y - (py + H / 2)) / window.innerHeight, -.5, .5);
        }
      }
      if (!Number.isFinite(wy)) wy = 0;                          // NaN would make the head vanish for good
      if (!Number.isFinite(wx)) wx = 0;
      const lookBlend = 1 - Math.exp(-8 * delta);
      look.y += ((wy - (usingImported ? 0 : pose.spin * .5)) - look.y) * lookBlend;
      look.x += (wx - look.x) * lookBlend;
      if (av.head && Number.isFinite(look.x) && Number.isFinite(look.y)) {
        lookEuler.set(look.x, look.y, 0);
        av.head.quaternion.multiply(lookQuat.setFromEuler(lookEuler));
      }
      // Crossfade from the last rendered transform to the new animation target.
      // Smoothstep avoids a sudden start/stop and quaternion slerp makes turns rotate
      // along the short arc instead of snapping (notably idle <-> 90-degree walk).
      if (transitionFrom) {
        const raw = clamp((t - transitionStartedAt) / transitionDuration, 0, 1);
        const alpha = raw * raw * (3 - 2 * raw);
        const bodyPosition = av.body.position.clone();
        const bodyQuaternion = av.body.quaternion.clone();
        const bodyScale = av.body.scale.clone();
        av.body.position.copy(transitionFrom.bodyPosition).lerp(bodyPosition, alpha);
        av.body.quaternion.copy(transitionFrom.bodyQuaternion).slerp(bodyQuaternion, alpha).normalize();
        av.body.scale.copy(transitionFrom.bodyScale).lerp(bodyScale, alpha);
        for (const name of partNames) {
          const from = transitionFrom.parts[name], part = av[name];
          if (!from || !part) continue;
          const position = part.position.clone();
          const quaternion = part.quaternion.clone();
          const scale = part.scale.clone();
          part.position.copy(from.position).lerp(position, alpha);
          part.quaternion.copy(from.quaternion).slerp(quaternion, alpha).normalize();
          part.scale.copy(from.scale).lerp(scale, alpha);
        }
        if (raw >= 1) transitionFrom = null;
      }
      // Landing squash is driven by the actual downward impact speed (px/s),
      // not drop height. Apply it on the first landing frame, then rebound quickly.
      if (L.pose === "land") {
        const age = Math.max(0, t - poseStartedAt);
        const impactSpeed = Math.max(0, Number(L.impact) || 0);
        const strength = 0.10 + 0.20 * clamp(impactSpeed / 1100, 0, 1);
        const pulse = strength * Math.exp(-age * 10) * Math.cos(age * 19);
        av.body.scale.set(
          bodyBaseScale.x * (1 + pulse * 0.72),
          bodyBaseScale.y * (1 - pulse),
          bodyBaseScale.z * (1 + pulse * 0.72)
        );
      }
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelled = true; cancelAnimationFrame(raf); clearInterval(metaTimer);
      swordGear?.removeFromParent(); grappleGear?.removeFromParent();
      if (swordGear) disposeAvatar(swordGear);
      if (grappleGear) disposeAvatar(grappleGear);
      scene.traverse(o => { o.geometry?.dispose(); o.material && [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); });
      renderer.dispose();
    };
  }, [W, H, RENDER_W, RENDER_H]);

  // The visible canvas extends well beyond Coy's drag/collision footprint.
  // Explicit transparency and overflow-visible parents prevent a visible square frame.
  return <div style={{ position: "relative", width: W, height: H, marginBottom: -Math.round(H * FOOT), overflow: "visible", background: "transparent", border: 0, outline: 0, pointerEvents: "none" }}>
    <canvas ref={canvasRef} aria-label="Coy" role="img"
      style={{ position: "absolute", left: -Math.round((RENDER_W - W) / 2), top: -Math.round((RENDER_H - H) / 2), width: RENDER_W, height: RENDER_H, display: "block", background: "transparent", border: 0, outline: 0, cursor: "grab", touchAction: "none", pointerEvents: "none" }} />
  </div>;
}



