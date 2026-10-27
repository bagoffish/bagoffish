import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { createBallEnvironment, makeBallReflective } from "./superball";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
import { SWAP_AVATARS } from "./avatarRoster";
import { REST, resetAvatarPose, applyImportedAnimation, torsoTargets, applyTorsoLayer, sampleClip } from "./r6Retarget";

// R6 avatar rendered on a transparent canvas. Colors come from /avatar/avatar.json,
// which scripts/sync-avatar.mjs refreshes from Roblox on a schedule.
const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/";
const AVATARS_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatars/";
const TOOL_SOUND_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/sounds/coy-tools/";
const META_URL = BASE + "avatar.json";
const ASPECT = 0.9;          // canvas width / height
const FOOT = 0.09;           // fraction of canvas height below the feet
const DEFAULT_COLORS = { head: "#f5cd30", torso: "#2f6fed", leftArm: "#f5cd30", rightArm: "#f5cd30", leftLeg: "#2b2f3a", rightLeg: "#2b2f3a" };

const P = o => Object.assign({ rZ: .1, lZ: -.1, rX: 0, lX: 0, rL: 0, lL: 0, bob: 0, spin: 0, torsoTurn: 0, torsoLean: 0, tilt: 0, sq: 0 }, o);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const PROCEDURAL_POSES = new Set(["sit", "land", "grapple"]);

function target(pose, t, dir, tiltIn) {
  let s;
  switch (pose) {
    case "wave":   return P({ rZ: 2.6 + Math.sin(t * 12) * .35, torsoTurn: Math.sin(t * 2.5) * .28 });
    case "dance":  s = Math.sin(t * 8);  return P({ rZ: 2.2 + s * .5, lZ: -(2.2 - s * .5), rL: s * .6, lL: -s * .6, bob: Math.abs(s) * .35, spin: Math.sin(t * 4) * .6 });
    case "dance2": s = Math.sin(t * 10); return P({ rZ: .2, lZ: -.2, rX: -1.3 + s * .7, lX: -1.3 - s * .7, bob: Math.abs(s) * .4 });
    case "dance3": s = Math.sin(t * 6);  return P({ rZ: 1.6 + s * .8, lZ: -(1.6 + s * .8), rL: s * .3, lL: -s * .3, bob: Math.abs(s) * .15, spin: Math.sin(t * 3) * 1.1 });
    case "walk":   s = Math.sin(t * 8.5); return P({ rX: s * .58, lX: -s * .58, rL: -s * .48, lL: s * .48, bob: 0, spin: 0 });
    case "held":   s = Math.sin(t * 14); return P({ rZ: 2.5 + s * .4, lZ: -(2.5 - s * .4), rL: Math.sin(t * 9) * .5, lL: -Math.sin(t * 9) * .5, tilt: tiltIn });
    case "fall":   return P({ rZ: 2.7, lZ: -2.7, rL: .4, lL: -.4, tilt: tiltIn });
    // Rest the arms forward and lower the hips into the seat.
    case "sit":    return P({ rZ: 0, lZ: 0, rX: -1.42, lX: -1.42, rL: -1.42, lL: -1.42, bob: -1.2, tilt: 0 });
    case "land":   return P({ sq: .25, rZ: -.24, lZ: .24 });
    case "swordlunge": {
      const a = clamp(t / 0.9, 0, 1);
      const thrust = clamp((a - 0.18) / 0.12, 0, 1) * (1 - clamp((a - 0.74) / 0.16, 0, 1));
      return P({
        rZ: 1.2 - thrust * 1.05, rX: -0.55 - thrust * 0.85,
        lZ: -0.35, lX: thrust * 0.55,
        rL: -thrust * 0.55, lL: thrust * 0.65,
        torsoLean: 0,
      });
    }
    case "swordequip": return P({ rZ: 1.2, rX: -0.55, lZ: -0.35 });
    case "gearhold": return P({ rZ: 1.2 + Math.sin(t * 2) * .04, rX: -0.55, lZ: -0.35 });
    case "bodyswap": return P({ rZ: 1.2 + Math.sin(t * 2) * .04, rX: -0.55, lZ: -0.35 });
    case "climbing": { const a = Math.sin(t * 7); return P({ rZ: 1.9 + a * .25, lZ: -(1.9 - a * .25), rX: -0.6 + a * .2, lX: -0.6 - a * .2, rL: -a * .4, lL: a * .4, bob: Math.abs(a) * .08, tilt: -0.12 }); }
    case "grapple": { const a = Math.sin(t * 8); return P({ rZ: 1.35 + a * .12, rX: -0.5, lZ: -0.45, tilt: -0.08 + tiltIn, bob: Math.abs(a) * .04 }); }
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
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat(color)); m.position.set(offset[0], offset[1], 0);
    g.add(m);
    // All R6 limbs use the same torso-relative joint coordinates as REST and
    // r6Retarget. Keeping legs under the torso is essential: resetAvatarPose and
    // imported animation frames assign REST[name] directly to each part's position.
    // Parenting legs to body instead made those same coordinates place them incorrectly.
    g.position.set(...REST[name]);
    torso.add(g);
    return g;
  };
  // Right side is -X in this scene: arms hang outward from the shoulder, legs inward from the hip.
  const rArm = joint("rArm", colors.rightArm, [-0.5, -0.5]), lArm = joint("lArm", colors.leftArm, [0.5, -0.5]);
  const rLeg = joint("rLeg", colors.rightLeg, [0.5, -1]), lLeg = joint("lLeg", colors.leftLeg, [-0.5, -1]);
  return { body, torso, head, rArm, lArm, rLeg, lLeg };
}

function disposeAvatar(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    o.material && [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); });
  });
}

// ---- Gear grips -----------------------------------------------------------------------------
// Roblox attaches a Tool to the hand with a weld:
//     Handle.CFrame = RightArm.CFrame * C0 * Tool.Grip^-1
// where, for R6, C0 = CFrame.new(0, -1, 0) * CFrame.Angles(-pi/2, 0, 0) (the bottom of the arm,
// turned so the tool points along the arm). Tool.Grip is NOT the handle's position on the arm;
// it is the inverse of that offset. The old code used the Grip values directly as a position and
// rotation, which is why the weapons sat in odd spots and the grips looked wrong.
// The gear OBJs were exported in Roblox axes with the handle un-rotated, so mesh coordinates are
// handle coordinates; the scene is Roblox turned 180 degrees about Y (D), and the arm group's
// origin is the shoulder joint, which is 0.5 above / 0.5 inboard of the arm part's center.
//   gripPos     Tool.Grip Position (studs, handle space)
//   gripRotDeg  Tool.Grip Orientation in degrees (Roblox Vector3 X, Y, Z)
const GEAR = {
  // Classic Sword: Position (0,0,-1.5), Orientation (0,90,90). Hilt in the palm, blade up.
  sword:      { file: "Sword.obj",      scale: 0.9,  gripPos: [0, 0, -1.5],      gripRotDeg: [0, 90, 90] },
  grapple:    { file: "Grapple.obj",    scale: 0.78, gripPos: [0, -0.6, 1],      gripRotDeg: [0, 0, 0] },
  // gripPos is the handle's centre in the gear mesh's own (bounding-box-centred) coordinates, so the
  // hand closes around the handle. It used to sit at the handle's bottom edge, which left the whole
  // gun floating in front of the hand. Measured from the OBJs: GrappleGun handle z +0.67..+1.12,
  // y -0.58..-0.06; Gun handle z +0.35..+0.70, y -0.41..+0.12.
  gun:        { file: "Gun.obj",        scale: 0.78, gripPos: [0, -0.15, 0.53],  gripRotDeg: [0, 0, 0] },
  grappleGun: { file: "GrappleGun.obj", scale: 0.78, gripPos: [0, -0.32, 0.9],   gripRotDeg: [0, 0, 0] },
  // Bodyswap potion: a flat blue/red figure card. In its own mesh space it lies flat (thin in Y)
  // with its long axis along Z. This grip (Rx +90 degrees) stands it upright, face toward the
  // camera, in the outstretched gearhold arm; the hand holds it a little below its centre.
  // Superball: a unit-radius sphere (ball.obj). Scale 0.8 makes it a 1.6-stud ball (raise it for a bigger one). gripPos z 0.85 puts
  // the hand against the back of the ball so the ball floats just ahead of his fist.
  ball:       { file: "ball.obj",       scale: 0.8,  gripPos: [0, 0, 0.85],      gripRotDeg: [0, 0, 0] },
  potion:     { file: "bodyswap.obj",   scale: 0.8,  gripPos: [0, 0, -0.3],     gripRotDeg: [0, 0, 0],
                gripRotationMatrix: [1, 0, 0, 0, 0, -1, 0, 1, 0] },
};
const POSE_GEAR_GRIPS = {
  swordlungeout: {
    sword: {
      gripPos: [0, 0, -1.7],
      gripRotationMatrix: [0, 1, 0, 1, 0, 0, 0, 0, -1],
    },
  },
};
const toRad = d => d * Math.PI / 180;

function gripMatrix(name, leftHand = false, pose) {
  const cfg = { ...GEAR[name], ...(POSE_GEAR_GRIPS[pose]?.[name] || {}) };
  const D = new THREE.Matrix4().makeScale(-1, 1, -1);                    // Roblox -> scene axes
  const armCenter = new THREE.Matrix4().makeTranslation(leftHand ? -0.5 : 0.5, -0.5, 0);
  const c0 = new THREE.Matrix4().makeTranslation(0, -1, 0)
    .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const [gx, gy, gz] = cfg.gripPos.map(v => v * cfg.scale);              // mesh is scaled, so is the grip point
  const [rx, ry, rz] = cfg.gripRotDeg.map(toRad);
  let gripRotation;
  if (cfg.gripRotationMatrix) {
    const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = cfg.gripRotationMatrix;
    gripRotation = new THREE.Matrix4().set(
      m00, m01, m02, 0,
      m10, m11, m12, 0,
      m20, m21, m22, 0,
      0, 0, 0, 1
    );
  } else {
    gripRotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, "YXZ"));
  }
  const grip = new THREE.Matrix4().makeTranslation(gx, gy, gz).multiply(gripRotation);
  return D.multiply(armCenter).multiply(c0).multiply(grip.invert());
}
function placeGear(gear, name, leftHand = false, pose, worldOffset = null) {
  if (!gear) return;
  const matrix = gripMatrix(name, leftHand, pose);
  if (worldOffset && gear.parent) {
    gear.parent.updateWorldMatrix(true, false);
    const parentInverse = gear.parent.matrixWorld.clone().invert();
    const origin = new THREE.Vector3().applyMatrix4(parentInverse);
    const offset = new THREE.Vector3(...worldOffset).applyMatrix4(parentInverse).sub(origin);
    matrix.premultiply(new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z));
  }
  gear.matrixAutoUpdate = false;
  gear.matrix.copy(matrix);
  gear.matrixWorldNeedsUpdate = true;
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
        const muzzleZ = bounds.getSize(new THREE.Vector3()).z * scale / 2;   // barrel tip, in gun space
        const tipVertices = new Map();
        root.traverse(object => {
          if (!object.isMesh) return;
          const positions = object.geometry.attributes.position;
          const vertex = new THREE.Vector3();
          for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (Math.abs(vertex.z - bounds.min.z) < 0.001) {
              const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)}`;
              if (!tipVertices.has(key)) tipVertices.set(key, vertex.clone());
            }
          }
        });
        const tip = tipVertices.size
          ? [...tipVertices.values()].reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
            .multiplyScalar(scale / tipVertices.size).sub(center.clone().multiplyScalar(scale))
          : new THREE.Vector3(0, 0, -muzzleZ);
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
        root.userData.muzzleZ = muzzleZ;
        root.userData.tip = tip;
        root.visible = false;
        resolve(root);
      }, undefined, reject);
    }, undefined, reject);
  });
}

// Loads the Roblox OBJ/MTL that scripts/sync-avatar.mjs downloaded, then splits it into R6 limbs.
function loadModel(model, base = BASE, options = {}) {
  return new Promise((resolve, reject) => {
    // Avatar OBJ/MTL/PNG files are replaced in-place in public/. Give each page
    // load a fresh URL so browser/CDN caches cannot keep an older body or texture.
    const cacheBust = "v=" + Math.floor(performance.timeOrigin || Date.now());
    const withCacheBust = url => url + (url.includes("?") ? "&" : "?") + cacheBust;
    const fileLoader = new THREE.FileLoader();
    fileLoader.setPath(base);
    const mtlLoader = new MTLLoader();
    mtlLoader.setResourcePath(base);

    // Load the MTL as text so texture-map URLs receive the same cache key as the
    // material file. MTLLoader's normal load() path leaves referenced PNG URLs
    // unchanged, which is why swapping only the OBJ/MTL URL is not enough.
    fileLoader.load(withCacheBust(model.mtl), mtlText => {
      const cacheBustedMtl = mtlText.replace(
        /^(\\s*map_\\w+\\s+)(.+?)\\s*$/gim,
        (line, directive, filename) => directive + withCacheBust(filename.trim())
      );
      const materials = mtlLoader.parse(cacheBustedMtl, base);
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      // OBJLoader preserves "o" object names but discards the names in "g" group
      // declarations. Roblox avatar exports use "g" for each R6 body part, so
      // convert those declarations to objects before parsing to retain names like
      // Katamarimo1..6 and Cdplusr1..6 for the R6 splitter.
      fileLoader.load(withCacheBust(model.obj), objText => {
        const normalizedObjText = objText.replace(/\r/g, "");
        // Grub's export uses the avatar-specific Katamarimo1..6 names rather
        // than the standard Rig1..Rig6 names. Normalize those six body groups
        // directly so they cannot be mistaken for accessory meshes.
        const namedObjText = normalizedObjText
          .replace(/^g[ \t]+Katamarimo([1-6])$/gm, "o Rig$1")
          .replace(/^g[ \t]+([^\r\n]+)$/gm, "o $1");
        const root = objLoader.parse(namedObjText);
        root.traverse(o => {
          if (!o.isMesh) return;
          [].concat(o.material).forEach(m => {
            m.side = THREE.DoubleSide;
            m.transparent = false;
            m.opacity = 1;
            m.depthWrite = true;
            if ("transmission" in m) m.transmission = 0;

            // Coy's Handle4 hairclip is intentionally neon green; other avatars'
            // Handle4 is a real textured accessory.
            if (options.neonClip && /^Handle4Mtl$/i.test(m.name || "")) {
              m.map = null;
              m.alphaMap = null;
              m.color.set("#39ff14");
            } else if (m.map) {
              m.color.set(0xffffff);
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
 *  pose    - idle | walk | held | fall | land | wave | dance | dance2 | dance3
 *  dir     - 1 or -1, walking direction
 *  vx      - horizontal speed (px/s), used to tilt while held or falling
 *  look    - { x, y } cursor position in px (head follows it while calm)
 *  getPos  - () => { x, y } of the canvas on screen, for head tracking
 *  swap    - id of an avatar in public/avatars/<id>/ to wear (bodyswap potion); null = Coy
 *  swapPreload - id to start loading early (while the potion is still being raised)
 *  grapple - shared ref object. When grapple.active the parent owns the rope: the arm aims at
 *            (grapple.ax, grapple.ay) in screen px and the muzzle's screen position is written
 *            back to grapple.mx / grapple.my so the parent can draw the cable to it.
 */
export default function CoyAvatar3D({ size = 92, pose = "idle", dir = 1, vx = 0, impact = 0, look, getPos, grapple, ball, swap = null, swapPreload = null, onReady }) {
  const canvasRef = useRef(null);
  const live = useRef({});
  live.current = { pose, dir, vx, impact, look, getPos, grapple, ball, swap, swapPreload, onReady };
  const W = size, H = Math.round(size / ASPECT);
  // Keep the drag/collision footprint compact, but make the actual WebGL viewport
  // far larger so swinging limbs, turns, and accessories don't get cut at its edges.
  const RENDER_W = Math.round(W * 3), RENDER_H = Math.round(H * 2.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    const basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let currentRenderWidth = RENDER_W, currentRenderHeight = RENDER_H, currentPixelRatio = basePixelRatio;
    renderer.setPixelRatio(basePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(RENDER_W, RENDER_H, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, RENDER_W / RENDER_H, .1, 100);
    // Scale distance with the taller viewport to preserve Coy's on-screen size.
    camera.position.set(0, 2.8, 12.5 * (RENDER_H / H)); camera.lookAt(0, 2.8, 0);
    const resizeViewport = fullScreen => {
      const width = fullScreen ? Math.max(RENDER_W, Math.ceil(window.innerWidth * 2)) : RENDER_W;
      const height = fullScreen ? Math.max(RENDER_H, Math.ceil(window.innerHeight * 2)) : RENDER_H;
      const pixelRatio = fullScreen ? Math.min(basePixelRatio, 1) : basePixelRatio;
      if (width === currentRenderWidth && height === currentRenderHeight && pixelRatio === currentPixelRatio) return;
      currentRenderWidth = width; currentRenderHeight = height; currentPixelRatio = pixelRatio;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, 2.8, 12.5 * (height / H));
      camera.lookAt(0, 2.8, 0);
      camera.far = Math.max(100, camera.position.z + 100);
      camera.updateProjectionMatrix();
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.left = `${-Math.round((width - W) / 2)}px`;
      canvas.style.top = `${-Math.round((height - H) / 2)}px`;
    };
    scene.add(new THREE.AmbientLight(0xffffff, .7));
    const sun = new THREE.DirectionalLight(0xffffff, .8); sun.position.set(3, 6, 8); scene.add(sun);

    // No substitute model: wait for the actual Roblox avatar before spawning Coy.
    let av = null, raf = 0, cancelled = false;
    let swordGear = null, grappleGear = null, gunGear = null, grappleGunGear = null, potionGear = null, ballGear = null, ballEnvironment = null;
    let grappleHitPlayed = false;
    // Serve gear sounds from this site's own origin. Roblox's asset endpoint
    // can redirect, reject CORS, or return a non-audio response in Safari.
    // The four verified classic clips are bundled under public/sounds/coy-tools.
    const soundIds = {
      swordLunge: TOOL_SOUND_BASE + "lunge.mp3",
      swordSlash: TOOL_SOUND_BASE + "slash.mp3",
      unsheath: TOOL_SOUND_BASE + "unsheath.mp3",
      grappleFire: TOOL_SOUND_BASE + "grapple.mp3",
      grappleConnect: TOOL_SOUND_BASE + "grapple-connect.mp3",
      grappleHit: TOOL_SOUND_BASE + "grapple-hit.mp3"
    };
    // Use short HTMLAudioElement effects rather than creating a Web Audio
    // AudioContext. On iOS, a page-owned AudioContext can sometimes cause other
    // media to duck or pause; the page cannot override the OS audio-session policy,
    // but avoiding a persistent context reduces the chance of disrupting music.
    const soundPools = new Map();
    const soundBuffers = new Map();
    const audioContext = null;
    let audioUnlocked = false;
    const soundUrl = source => typeof source === "number"
      ? "https://www.roblox.com/asset/?id=" + source
      : source;
    const getSoundPool = source => {
      const src = soundUrl(source);
      if (!soundPools.has(src)) {
        const pool = Array.from({ length: 3 }, () => {
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = src;
          audio.load();
          return audio;
        });
        soundPools.set(src, { pool, next: 0 });
      }
      return soundPools.get(src);
    };
    const localSoundSources = Object.values(soundIds);
    // Start loading local gear sounds immediately so they are ready for early actions.
    if (audioContext) {
      localSoundSources.forEach(source => {
        const url = soundUrl(source);
        fetch(url, { cache: "force-cache" }).then(response => {
          if (!response.ok) throw new Error("HTTP " + response.status + " loading " + url);
          const type = response.headers.get("content-type") || "";
          if (/text\/html|application\/json/i.test(type)) throw new Error("Non-audio response (" + type + ") for " + url);
          return response.arrayBuffer();
        }).then(bytes => {
          if (!bytes || bytes.byteLength < 128) throw new Error("Audio file is empty or truncated: " + url);
          return audioContext.decodeAudioData(bytes);
        }).then(buffer => {
          soundBuffers.set(url, buffer);
        }).catch(error => {
          console.warn("Coy: local gear sound preload failed; HTML audio fallback will be used", url, error);
        });
      });
    }
    // HTMLAudioElement playback starts loading immediately; if requested before a clip
    // finishes loading, the browser can queue playback until the clip is ready.
    localSoundSources.forEach(getSoundPool);
    // Do not "unlock" audio by briefly playing and pausing every pooled clip.
    // On iOS Safari, that synthetic playback can interrupt/duck music from another
    // app. Effects are instead started only when their actual gameplay action occurs.
    // Keep no persistent AudioContext: HTMLAudioElement effects are independent of
    // the page's media session as far as the browser/OS permits.
    // Browsers block media playback until the visitor interacts with the page.
    // Wait for a real gesture before attempting gear effects, so startup poses
    // don't spam NotAllowedError warnings or repeatedly try blocked playback.
    const unlockGearAudio = () => { audioUnlocked = true; };
    const soundUnlockEvents = ["pointerdown", "keydown", "touchstart"];
    const unlockWhenReady = () => unlockGearAudio();
    soundUnlockEvents.forEach(eventName => window.addEventListener(eventName, unlockWhenReady, true));

    const playGearSound = (source, volume = 0.16) => {
      if (!audioUnlocked) return;
      try {
        const src = soundUrl(source);
        const buffer = soundBuffers.get(src);
        if (audioContext && buffer && audioContext.state === "running") {
          const node = audioContext.createBufferSource();
          const gain = audioContext.createGain();
          node.buffer = buffer;
          gain.gain.value = Math.max(0, Math.min(1, volume));
          node.connect(gain);
          gain.connect(audioContext.destination);
          node.start(0);
          return;
        }
        const entry = getSoundPool(source);
        const audio = entry.pool[entry.next];
        entry.next = (entry.next + 1) % entry.pool.length;
        audio.pause();
        try { audio.currentTime = 0; } catch (_) {}
        audio.volume = Math.max(0, Math.min(1, volume));
        const attempt = audio.play();
        if (attempt && typeof attempt.catch === "function") {
          attempt.catch(error => console.warn("Coy: gear sound could not play", audio.currentSrc || audio.src, error));
        }
      } catch (error) {
        console.warn("Coy: gear sound setup failed", error);
      }
    };
    const attachGear = () => {
      if (!av) return;
      if (swordGear) av.rArm.add(swordGear);
      if (gunGear) av.rArm.add(gunGear);
      if (grappleGunGear) av.rArm.add(grappleGunGear);
      if (potionGear) av.rArm.add(potionGear);
      if (ballGear) av.rArm.add(ballGear);
    };
    const detachGear = () => {
      [swordGear, grappleGear, gunGear, grappleGunGear, potionGear, ballGear].forEach(gear => gear?.removeFromParent());
    };
    loadGear(GEAR.sword.file, GEAR.sword.scale).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      swordGear = gear;
      placeGear(swordGear, "sword");
      attachGear();
    }).catch(e => console.warn("Coy: sword gear failed to load", e));
    loadGear(GEAR.grapple.file, GEAR.grapple.scale).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      grappleGear = gear;
      grappleGear.visible = false;
      scene.add(grappleGear);
    }).catch(e => console.warn("Coy: grapple gear failed to load", e));
    loadGear(GEAR.gun.file, GEAR.gun.scale).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      gunGear = gear;
      placeGear(gunGear, "gun");
      attachGear();
    }).catch(e => console.warn("Coy: gun gear failed to load", e));
    loadGear(GEAR.grappleGun.file, GEAR.grappleGun.scale).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      grappleGunGear = gear;
      placeGear(grappleGunGear, "grappleGun");
      attachGear();
    }).catch(e => console.warn("Coy: grapple gun gear failed to load", e));
    loadGear(GEAR.potion.file, GEAR.potion.scale).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      potionGear = gear;
      placeGear(potionGear, "potion");
      attachGear();
    }).catch(e => console.warn("Coy: bodyswap potion failed to load", e));
    loadGear(GEAR.ball.file, GEAR.ball.scale).then(gear => {
      if (cancelled) { disposeAvatar(gear); return; }
      ballGear = gear;
      ballEnvironment = createBallEnvironment(renderer);
      ballGear.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => makeBallReflective(m, ballEnvironment)); });
      placeGear(ballGear, "ball");
      attachGear();
    }).catch(e => console.warn("Coy: superball failed to load", e));
    const bodyBaseScale = new THREE.Vector3(1, 1, 1);
    const headBaseScale = new THREE.Vector3(1, 1, 1);
    let previousPose = "";
    let poseStartedAt = 0;
    // Persist facing independently of the pose reset/imported animation each frame.
    let facingYaw = 0;
    let swordFacingDirection = 1;
    let animations = {};
    let activeAnimation = "";
    let animationStart = 0;
    let transitionFrom = null;
    let transitionStartedAt = 0;
    let transitionDuration = 0.34;
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
    const torsoLayer = { twist: 0, lean: 0 };
    const look = { x: 0, y: 0 }, lookQuat = new THREE.Quaternion(), lookEuler = new THREE.Euler();
    const clock = new THREE.Clock();
    const readAnimationFile = url => fetch(url, { cache: "force-cache" })
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

    // ---- Bodyswap: the other avatars live in public/avatars/<id>/ and load on demand ----
    // Coy (from /avatar/, kept fresh by the Roblox sync) is always the default. coyAv is kept
    // loaded while someone else is worn so changing back is instant.
    const swapCache = new Map();     // id -> loaded R6 avatar
    const swapLoading = new Set();
    const swapFailed = new Set();
    let coyAv = null, shownKey = "coy", swapPulseAt = -10;

    const showAvatar = (next, key) => {
      if (av === next) {
        shownKey = key;
        return;
      }
      if (av) {
        detachGear();
        scene.remove(av.body);
      }
      av = next;
      shownKey = key;
      bodyBaseScale.copy(av.body.scale);
      if (av.head) headBaseScale.copy(av.head.scale);
      scene.add(av.body);
      attachGear();
    };
    const ensureSwapAvatar = id => {
      if (!SWAP_AVATARS.includes(id) || swapCache.has(id) || swapLoading.has(id) || swapFailed.has(id)) return;
      swapLoading.add(id);
      loadModel({ obj: id + ".obj", mtl: id + ".mtl" }, AVATARS_BASE + id + "/")
        .then(model => {
          swapLoading.delete(id);
          if (cancelled) { disposeAvatar(model.body); return; }
          swapCache.set(id, model);
          // Keep memory modest: at most three swap avatars stay loaded (never the one on screen).
          while (swapCache.size > 3) {
            const oldest = [...swapCache.keys()].find(key => key !== shownKey && key !== id);
            if (!oldest) break;
            disposeAvatar(swapCache.get(oldest).body);
            swapCache.delete(oldest);
          }
        })
        .catch(error => {
          swapLoading.delete(id);
          swapFailed.add(id);
          console.warn("Coy: bodyswap avatar failed to load", id, error);
        });
    };

    // Re-checking the metadata lets the avatar change when your Roblox outfit does.
    let version = null;
    const loadMeta = () => fetch(META_URL, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then(async meta => {
        if (cancelled || (coyAv && meta.version === version)) return;
        version = meta.version;
        // Do not show a block placeholder if metadata or the real model is unavailable.
        if (!meta.model) return;
        const v = "?v=" + (meta.model.hash || meta.version);
        let next;
        try {
          next = await loadModel({ obj: meta.model.obj + v, mtl: meta.model.mtl + v }, BASE, { neonClip: true });
        } catch (e) {
          version = null; // let the next metadata poll retry this same avatar
          console.warn("Coy: real avatar model failed to load; will retry", e);
          return;
        }
        if (cancelled) { disposeAvatar(next.body); return; }
        const previousCoy = coyAv;
        coyAv = next;
        // If someone else is being worn right now, the new Coy waits in the wings.
        if (shownKey === "coy") showAvatar(next, "coy");
        if (previousCoy) disposeAvatar(previousCoy.body);
        live.current.onReady?.();
      });
    loadMeta();
    const metaTimer = setInterval(loadMeta, 5 * 60 * 1000);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!av || document.hidden) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime, L = live.current;
      // Bodyswap: wear L.swap while it is set, otherwise Coy.
      const wantKey = SWAP_AVATARS.includes(L.swap) && !swapFailed.has(L.swap) ? L.swap : "coy";
      if (L.swapPreload) ensureSwapAvatar(L.swapPreload);
      if (wantKey !== shownKey) {
        const next = wantKey === "coy" ? coyAv : swapCache.get(wantKey);
        if (next) {
          showAvatar(next, wantKey);
          swapPulseAt = t;
        }
        else if (wantKey !== "coy") ensureSwapAvatar(wantKey);
      }
      const enteredPose = L.pose !== previousPose;
      if (enteredPose) {
        const priorPose = previousPose;
        previousPose = L.pose;
        poseStartedAt = t;
        if (L.pose === "swordequip" || L.pose === "swordlunge" || L.pose === "ballhold") {
          swordFacingDirection = L.dir < 0 ? -1 : 1;
        }
        transitionDuration = L.pose === "swordlunge" ? 0.12 : 0.34;
        // Holding the grapple gear is silent; play tool sounds only when a move begins.
        if (L.pose === "swordequip") {
          playGearSound(soundIds.unsheath);
        } else if (L.pose === "swordlunge") {
          if (!["swordequip", "swordlunge"].includes(priorPose)) playGearSound(soundIds.unsheath, 0.10);
          playGearSound(soundIds.swordLunge);
        } else if (L.pose === "swordslash") {
          playGearSound(soundIds.swordSlash);
        } else if (L.pose === "grapple") {
          grappleHitPlayed = false;
          playGearSound(soundIds.grappleFire);
        }
        // Preserve the exact currently-rendered pose so every state change crossfades,
        // including the quarter-turn into walk and the return to idle.
        if (av && L.pose !== "land") {
          transitionFrom = capturePose();
          transitionStartedAt = t;
          // Sword poses keep the head level; don't fade in the idle cursor-look tilt.
          if (["swordequip", "swordlunge"].includes(L.pose)) {
            transitionFrom.parts.head = null;
            look.x = 0; look.y = 0;
          }
        } else if (L.pose === "land") {
          // Landing is an impact, not a blended animation: let the squash hit now.
          transitionFrom = null;
        }
      }
      // Being held uses the real Roblox falling clip, like picking up a character in Roblox.
      const clipName = ({ idle: "idle1", idle1: "idle1", dance: "dance1", dance1: "dance1", held: "fall", bodyswap: "gearhold", ballhold: "gearhold" })[L.pose] || L.pose;
      // Keep grounded sit, landing, and live-aim grapple procedural; preserve the imported CFrame clips for other moves.
      const clip = PROCEDURAL_POSES.has(L.pose) ? null : animations[clipName];
      // Don't start the animation clock until its imported clip is actually available.
      // Otherwise a slow fetch/model load can consume a one-shot wave before Coy appears.
      if (clip && clipName !== activeAnimation) {
        activeAnimation = clipName;
        animationStart = t;
        console.debug("Coy: playing imported animation", clipName);
      } else if (!clip) {
        activeAnimation = "";            // so a one-shot (wave, sword) replays after a procedural pose
      }
      av.body.scale.copy(bodyBaseScale);
      if (av.head) av.head.scale.copy(headBaseScale);
      const usingImported = Boolean(clip) && applyImportedAnimation(av, clip, t - animationStart);
      if (usingImported) {
        // The clips barely move the torso; add shoulder twist / lean / breathing from the limbs.
        const want = clipName === "walk" ? { twist: 0, lean: 0 } : torsoTargets(av, clipName, t - animationStart);
        const k = 1 - Math.exp(-14 * delta);
        torsoLayer.twist += (want.twist - torsoLayer.twist) * k;
        torsoLayer.lean += (want.lean - torsoLayer.lean) * k;
        applyTorsoLayer(av, torsoLayer.twist, torsoLayer.lean);
      } else {
        torsoLayer.twist = 0; torsoLayer.lean = 0;
      }
      if (!usingImported) {
        resetAvatarPose(av);                                  // never mix leftovers from the last clip
        const tg = target(L.pose, t, L.dir, clamp(-L.vx * .0006, -.5, .5));
        const ext = L.grapple && L.grapple.active ? { x: L.grapple.ax, y: L.grapple.ay } : null;
        const aimAt = ext || L.look;
        if (L.pose === "grapple" && aimAt && L.getPos) {
          // Aim the actual arm/gun at the anchor (a wall point, the cursor) or the cursor by default.
          const p = L.getPos() || {};
          const px = Number.isFinite(p.x) ? p.x : p.left;
          const py = Number.isFinite(p.y) ? p.y : p.top;
          if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(aimAt.x) && Number.isFinite(aimAt.y)) {
            const dx = aimAt.x - (px + W / 2);
            const dy = aimAt.y - (py + H / 2);
            tg.rZ = clamp(Math.atan2(dx, dy), -2.65, 2.65);
            tg.rX = clamp(-dy / Math.max(H, 1) * 2.2, -1.2, 1.2);
          }
        }
        for (const k in pose) pose[k] += (tg[k] - pose[k]) * .15;
        av.rArm.rotation.z = pose.rZ; av.lArm.rotation.z = pose.lZ;
        av.rArm.rotation.x = pose.rX; av.lArm.rotation.x = pose.lX;
        av.rLeg.rotation.x = pose.rL; av.lLeg.rotation.x = pose.lL;
        av.body.position.y = pose.bob; av.body.rotation.y = pose.spin; av.body.rotation.z = pose.tilt;
        av.torso.rotation.x = pose.torsoLean; av.torso.rotation.y = pose.torsoTurn;
        av.body.scale.set(1 + pose.sq, 1 - pose.sq, 1 + pose.sq);
      }
      // After letting go of the rope he is still holding the grapple gun. Keep the fall clip on
      // the body, legs and left arm, but hold the right arm out in the gearhold pose instead of
      // letting it flail up with the rest of the fall animation.
      const gripFall = L.pose === "fall" && Boolean(L.grapple && L.grapple.gripFall);
      if (gripFall) {
        const holdClip = animations.gearhold;
        const holdFrames = holdClip?.frames;
        const holdDuration = holdFrames?.length
          ? Math.max(0, Number(holdClip.duration) || holdFrames[holdFrames.length - 1]?.time || 0)
          : 0;
        const holdArm = holdFrames?.length
          ? sampleClip(holdClip, holdDuration > 0 ? t % holdDuration : 0)["Right Arm"]
          : null;
        if (holdArm) {
          av.rArm.quaternion.copy(holdArm.quaternion);
          av.rArm.position.copy(holdArm.position);
        } else {
          av.rArm.rotation.set(-0.55, 0, 1.2);               // procedural gearhold fallback
        }
      }
      // Show classic gear only during its matching emote.
      if (swordGear) swordGear.visible = ["swordequip", "swordslash", "swordlunge"].includes(L.pose);
      const holdingGrapple = ["gearhold", "climbing", "grapple"].includes(L.pose) || gripFall;
      const grappleMode = typeof window === "undefined" ? "grapplegun" : window.__coyGear?.mode || "grapplegun";
      // The pose and rope are updated independently; either marks the firing interval.
      const firingGrapple = L.pose === "grapple" || Boolean(L.grapple && L.grapple.active);
      const pairedGrapple = grappleMode === "grapple+gun" || (grappleMode === "grapplegun" && firingGrapple);
      if (potionGear) potionGear.visible = L.pose === "bodyswap";
      if (ballGear) ballGear.visible = L.pose === "ballhold" && Boolean(L.ball && L.ball.held);
      if (gunGear) gunGear.visible = holdingGrapple && pairedGrapple;
      if (grappleGunGear) grappleGunGear.visible = holdingGrapple && !pairedGrapple;
      const externalGrapple = Boolean(L.grapple && L.grapple.active);
      resizeViewport(externalGrapple);
      if (externalGrapple && Number(L.grapple.travel) >= 1 && !grappleHitPlayed) {
        grappleHitPlayed = true;
        playGearSound(soundIds.grappleHit);
        window.setTimeout(() => playGearSound(soundIds.grappleConnect), 400);
      }
      // Held or falling: lean with the sideways speed.
      if (usingImported && (L.pose === "held" || L.pose === "fall")) av.body.rotation.z = clamp(-L.vx * .0006, -.5, .5);

      // Head follows the cursor when calm, layered on top of whatever clip is playing.
      let wy = 0, wx = 0;
      const swordPose = ["swordequip", "swordlunge"].includes(L.pose);
      const canTrackCursor = L.pose === "idle";
      if (canTrackCursor && L.look && L.getPos) {
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
      if (canTrackCursor) {
        look.y += ((wy - (usingImported ? 0 : pose.spin * .5)) - look.y) * lookBlend;
        look.x += (wx - look.x) * lookBlend;
      } else {
        look.x = 0;
        look.y = 0;
      }
      if (canTrackCursor && av.head && Number.isFinite(look.x) && Number.isFinite(look.y)) {
        lookEuler.set(look.x, look.y, 0);
        av.head.quaternion.multiply(lookQuat.setFromEuler(lookEuler));
      } else if (swordPose && av.head) {
        av.head.quaternion.identity();
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
      // Keep the head level through sword clips that pitch the torso forward.
      if (swordPose && av.head && av.torso) {
        av.head.quaternion.copy(av.torso.quaternion).invert();
      }
      // Apply the facing turn after pose crossfading; otherwise the crossfade can
      // repeatedly blend the body back toward its old, front-facing quaternion.
      // Walking and climbing turn with movement; sword poses keep their captured
      // side-facing direction, while grapple aims toward its anchor.
      const ballPose = L.pose === "ballhold";
      const sideFacing = ["walk", "climbing", "grapple", "swordequip", "swordlunge"].includes(L.pose) || ballPose;
      const position = L.getPos ? (L.getPos() || {}) : {};
      const px = Number.isFinite(position.x) ? position.x : position.left;
      const aimAt = L.pose === "grapple" && L.grapple && L.grapple.active
        ? { x: L.grapple.ax, y: L.grapple.ay }
        : null;
      const cursorX = Number.isFinite(aimAt?.x) && Number.isFinite(px)
        ? aimAt.x - (px + W / 2)
        : 0;
      const toolFacing = ["grapple", "swordequip", "swordlunge"].includes(L.pose) || ballPose;
      // Sword poses use the direction captured when the sword came out, so he stays turned
      // toward the target for the whole equip -> lunge instead of following live walk dir.
      const toolDirection = L.pose === "grapple" && Math.abs(cursorX) > 4
        ? Math.sign(cursorX)
        : ((swordPose || ballPose) ? swordFacingDirection : (L.dir < 0 ? -1 : 1));
      const targetYaw = sideFacing ? (toolFacing ? toolDirection : (L.dir < 0 ? -1 : 1)) * Math.PI / 2 : 0;
      const yawAlpha = 1 - Math.exp(-Math.max(delta, 0.001) * (sideFacing ? 10 : 8));
      // Imported clips call resetAvatarPose() every frame, and the procedural
      // walk pose writes body.rotation.y every frame too. A quaternion slerp
      // from that freshly reset angle can never accumulate to 90 degrees.
      // Smooth a persistent yaw angle instead, then apply it after all pose code.
      const yawDelta = Math.atan2(Math.sin(targetYaw - facingYaw), Math.cos(targetYaw - facingYaw));
      facingYaw += yawDelta * yawAlpha;
      av.body.rotation.y = facingYaw;
      av.body.updateMatrixWorld(true);
      const rightSide = Math.sign(av.rArm.position.x) || 1;
      const rightShoulderZ = new THREE.Vector3(rightSide, 0, 0).transformDirection(av.torso.matrixWorld).z;
      if (L.pose === "grapple") {
        const aimX = Number.isFinite(aimAt?.x) && Number.isFinite(px) ? aimAt.x - (px + W / 2) : 0;
        const aimY = Number.isFinite(aimAt?.y) && Number.isFinite(position.y) ? (position.y + H / 2) - aimAt.y : 0;
        const aimWorld = new THREE.Vector3(aimX, aimY, rightShoulderZ < -0.15 ? 1.2 : 0);
        if (aimWorld.lengthSq() < 1) aimWorld.set(0, 0, 1).transformDirection(av.body.matrixWorld);
        aimWorld.normalize();
        const parentRotation = av.rArm.parent.getWorldQuaternion(new THREE.Quaternion());
        const aimLocal = aimWorld.applyQuaternion(parentRotation.invert()).normalize();
        av.rArm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aimLocal);
        av.body.updateMatrixWorld(true);
      }
      const farSideOffset = L.pose === "climbing" && rightShoulderZ < -0.15
        ? [0, 0, 1]
        : null;
      const lungeElapsed = t - poseStartedAt;
      const swordGripPose = L.pose === "swordlunge" && lungeElapsed >= 0.2 && lungeElapsed < 0.8
        ? "swordlungeout"
        : L.pose;
      placeGear(swordGear, "sword", false, swordGripPose, [0, 0.18, 0]);
      placeGear(gunGear, "gun", false, L.pose);
      placeGear(grappleGunGear, "grappleGun", false, L.pose);
      placeGear(potionGear, "potion", false, L.pose);
      placeGear(ballGear, "ball", false, L.pose);
      // Report where the ball is on screen (and how big). When the parent decides to throw, it
      // spawns the bouncing superball at exactly this spot.
      if (ballGear && ballGear.visible && L.ball) {
        av.body.updateMatrixWorld(true);
        ballGear.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        const centre = new THREE.Vector3(0, 0, 0);
        ballGear.localToWorld(centre);
        const edge = centre.clone(); edge.x += 1;
        centre.project(camera); edge.project(camera);
        const rect = canvas.getBoundingClientRect();
        L.ball.sx = rect.left + (centre.x * 0.5 + 0.5) * rect.width;
        L.ball.sy = rect.top + (-centre.y * 0.5 + 0.5) * rect.height;
        L.ball.ppu = Math.abs(edge.x - centre.x) * 0.5 * rect.width;   // screen px per scene unit
        L.ball.r = clamp(GEAR.ball.scale * L.ball.ppu, 12, 70);         // the ball's radius on screen, px
      }
      // Project the muzzle only after the body turn and grip offset are applied.
      const activeGrappleGear = pairedGrapple ? gunGear : grappleGunGear;
      let muzzleWorld = null, muzzleDepth = 0;
      if (L.grapple && activeGrappleGear && activeGrappleGear.visible) {
        av.body.updateMatrixWorld(true);
        activeGrappleGear.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        const muzzle = (activeGrappleGear.userData.tip || new THREE.Vector3(
          0, 0, -(activeGrappleGear.userData.muzzleZ || 1.5)
        )).clone();
        activeGrappleGear.localToWorld(muzzle);
        muzzleWorld = muzzle.clone();
        muzzle.project(camera);
        muzzleDepth = muzzle.z;
        const rect = canvas.getBoundingClientRect();
        L.grapple.mx = rect.left + (muzzle.x * 0.5 + 0.5) * rect.width;
        L.grapple.my = rect.top + (-muzzle.y * 0.5 + 0.5) * rect.height;
      }
      if (grappleGear) {
        if (grappleGear.parent !== scene) scene.add(grappleGear);
        const projectileActive = externalGrapple && holdingGrapple && Number.isFinite(L.grapple.mx)
          && Number.isFinite(L.grapple.my) && Number.isFinite(L.grapple.ax) && Number.isFinite(L.grapple.ay);
        grappleGear.visible = Boolean(projectileActive);
        if (projectileActive) {
          const rect = canvas.getBoundingClientRect();
          const travel = clamp(Number(L.grapple.travel) || 0, 0, 1);
          const progress = travel < 0.5
            ? 4 * travel * travel * travel
            : 1 - Math.pow(-2 * travel + 2, 3) / 2;
          const screenX = L.grapple.mx + (L.grapple.ax - L.grapple.mx) * progress;
          const screenY = L.grapple.my + (L.grapple.ay - L.grapple.my) * progress;
          // Share the exact hook-tip screen position with the rope overlay.
          L.grapple.hx = screenX;
          L.grapple.hy = screenY;
          const screenToWorld = (x, y) => new THREE.Vector3(
            ((x - rect.left) / rect.width) * 2 - 1,
            1 - ((y - rect.top) / rect.height) * 2,
            muzzleDepth
          ).unproject(camera);
          const hookTip = screenToWorld(screenX, screenY);
          const towardAnchor = screenToWorld(L.grapple.ax, L.grapple.ay).sub(muzzleWorld || grappleGear.position);
          if (towardAnchor.lengthSq() > 0) {
            towardAnchor.normalize();
            grappleGear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), towardAnchor);
          }
          grappleGear.scale.setScalar(1);
          const hookTipLocal = grappleGear.userData.tip || new THREE.Vector3(
            0, 0, -(grappleGear.userData.muzzleZ || 0)
          );
          grappleGear.position.copy(hookTip).sub(hookTipLocal.clone().applyQuaternion(grappleGear.quaternion));
        }
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
      // Quick squash-and-stretch pop each time the body changes.
      const swapAge = t - swapPulseAt;
      if (swapAge >= 0 && swapAge < 0.7) {
        const pop = Math.exp(-swapAge * 6) * Math.cos(swapAge * 24);
        av.body.scale.set(bodyBaseScale.x * (1 + pop * 0.3), bodyBaseScale.y * (1 - pop * 0.35), bodyBaseScale.z * (1 + pop * 0.3));
      }
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelled = true;
      soundUnlockEvents.forEach(eventName => window.removeEventListener(eventName, unlockWhenReady, true));
      soundPools.forEach(({ pool }) => pool.forEach(audio => { audio.pause(); audio.src = ""; }));
      soundPools.clear();
      soundBuffers.clear();
      if (audioContext && audioContext.state !== "closed") audioContext.close().catch(() => {});
      cancelAnimationFrame(raf); clearInterval(metaTimer);
      detachGear();
      swapCache.forEach(model => disposeAvatar(model.body));
      swapCache.clear();
      if (potionGear) disposeAvatar(potionGear);
      if (ballGear) disposeAvatar(ballGear);
      ballEnvironment?.dispose();
      if (swordGear) disposeAvatar(swordGear);
      if (grappleGear) disposeAvatar(grappleGear);
      if (gunGear) disposeAvatar(gunGear);
      if (grappleGunGear) disposeAvatar(grappleGunGear);
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
