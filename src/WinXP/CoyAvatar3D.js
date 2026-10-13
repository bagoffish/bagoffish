import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
import { REST, ROBLOX_JOINT_PART, sampleClip, prepareClip, createReactionClips, resetAvatarPose } from "./r6Retarget";

// Play Roblox's exported R6 KeyframeSequence CFrames from /avatar/animations.json.
// R6 avatar rendered on a transparent canvas. Model and color metadata are loaded
// from the checked-in /avatar/avatar.json and static model assets.
const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/";
const META_URL = BASE + "avatar.json";
const ANIMATIONS_URL = BASE + "animations.json";
const ASPECT = 0.9;          // canvas width / height
const FOOT = 0.09;           // fraction of canvas height below the feet
const DEFAULT_COLORS = { head: "#f5cd30", torso: "#2f6fed", leftArm: "#f5cd30", rightArm: "#f5cd30", leftLeg: "#2b2f3a", rightLeg: "#2b2f3a" };

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

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
  // The geometry sits at the end of the Motor6D pivot: arms extend outward
  // by half a stud and down by half a stud; legs extend inward and down by one.
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

// Loads the checked-in Roblox OBJ/MTL and splits its named groups into R6 limbs.
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
    let previousAnimationMode = "";
    let poseStart = 0;
    let bodyYaw = 0;
    let transitionFrom = null;
    let transitionStart = 0;
    let animationClips = createReactionClips();
    for (const clip of Object.values(animationClips)) prepareClip(clip);
    let idleClipName = "idle1";
    const look = { x: 0, y: 0 };
    const clock = new THREE.Clock();

    const capturePose = () => {
      if (!av) return null;
      const parts = {};
      for (const partName of Object.keys(REST)) {
        const part = av[partName];
        if (part) parts[partName] = {
          position: part.position.clone(),
          quaternion: part.quaternion.clone()
        };
      }
      return {
        parts,
        bodyPosition: av.body.position.clone(),
        bodyScale: av.body.scale.clone(),
        bodyTilt: av.body.rotation.z
      };
    };

    const keyframeNameForPose = name => {
      switch (name) {
        case "idle": return idleClipName;
        case "idle1": return "idle1";
        case "idle2": return "idle2";
        case "walk": return "walk";
        case "wave": return "wave";
        case "dance":
        case "dance1": return "dance1";
        case "dance2": return "dance2";
        case "dance3": return "dance3";
        case "fall": return "fall";
        case "held": return "held";
        case "land": return "land";
        case "pat": return "pat";
        default: return null;
      }
    };

    // Use the exported KeyframeSequence CFrames for each clip that exists.
    // Native clips and custom reactions are all played through the same CFrame track sampler.
    fetch(ANIMATIONS_URL, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(payload => {
        const clips = payload && payload.animations;
        if (!clips || !Object.values(clips).some(clip => clip?.frames?.length)) {
          throw new Error("R6 keyframe file contains no usable KeyframeSequence clips");
        }
        if (!cancelled) {
          // Imported Roblox clips and custom reactions share one CFrame player.
          animationClips = { ...clips, ...createReactionClips() };
          for (const clip of Object.values(animationClips)) prepareClip(clip);
          // Expose minimal diagnostics to verify actual source clips load in the browser.
          window.__coyAnimationStatus = {
            source: "Roblox Pose.CFrame",
            url: ANIMATIONS_URL,
            loadedAt: new Date().toISOString(),
            error: null,
            current: {
              pose: live.current.pose,
              mode: "waiting for the next render frame",
              clip: null
            },
            clips: Object.fromEntries(Object.entries(animationClips)
              .filter(([, clip]) => clip?.frames?.length)
              .map(([name, clip]) => [name, {
                frames: clip.frames.length,
                duration: clip.duration,
                joints: Array.from(new Set(clip.frames.flatMap(frame => Object.keys(frame.poses || {}))))
              }]))
          };
        }
      })
      .catch(error => {
        if (!cancelled) {
          window.__coyAnimationStatus = {
            source: "Roblox CFrame data unavailable",
            url: ANIMATIONS_URL,
            error: String(error?.message || error),
            current: { pose: live.current.pose, mode: "safe rest pose; CFrame data unavailable", clip: null },
            clips: {}
          };
          console.warn("Coy: R6 CFrame animation data failed to load; keeping the rig in its safe rest pose.", error);
        }
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
      const t = clock.elapsedTime;
      const L = live.current;

      if (L.pose !== previousPose) {
        previousPose = L.pose;
        poseStart = t;
        if (L.pose === "idle") idleClipName = Math.random() < 0.9 ? "idle1" : "idle2";
      }
      const requestedClipName = keyframeNameForPose(L.pose);
      const clip = requestedClipName && animationClips ? animationClips[requestedClipName] : null;
      const animationMode = clip ? "cframe:" + L.pose + ":" + requestedClipName : "rest:" + L.pose;

      // When keyframes finish loading, this resets the greeting to its first frame.
      if (animationMode !== previousAnimationMode) {
        transitionFrom = capturePose();
        transitionStart = t;
        poseStart = t;
        // Start the new clip from the canonical rig pose; the transition below
        // blends the captured previous pose into this clip's first CFrame sample.
        if (clip || previousAnimationMode.startsWith("cframe:")) resetAvatarPose(av);
        previousAnimationMode = animationMode;
        if (window.__coyAnimationStatus) {
          window.__coyAnimationStatus.current = {
            pose: L.pose,
            mode: clip ? "Roblox CFrame keyframes" : "safe rest pose (no clip)",
            clip: clip ? requestedClipName : null,
            elapsed: 0
          };
        }
      }
      const localTime = t - poseStart;
      if (window.__coyAnimationStatus) {
        window.__coyAnimationStatus.current = {
          pose: L.pose,
          mode: clip ? "Roblox CFrame keyframes" : "safe rest pose (no clip)",
          clip: clip ? requestedClipName : null,
          elapsed: localTime
        };
      }
      resetAvatarPose(av);
      if (clip) {
        // Apply the original Roblox Pose.CFrame transforms. The anatomical RIGHT
        // arm maps to the screen-left group in our front-facing R6 scene.
        const joints = sampleClip(clip, localTime);
        for (const [jointName, partName] of Object.entries(ROBLOX_JOINT_PART)) {
          const transform = joints[jointName];
          const part = av[partName];
          if (!transform || !part) continue;
          part.position.copy(transform.position);
          part.quaternion.copy(transform.quaternion).normalize();
        }
      }

      // Smoothly cross-fade actual part transforms when changing clips/reactions.
      if (transitionFrom) {
        const rawAlpha = clamp((t - transitionStart) / 0.22, 0, 1);
        const alpha = rawAlpha * rawAlpha * (3 - 2 * rawAlpha);
        for (const [partName, from] of Object.entries(transitionFrom.parts)) {
          const part = av[partName];
          if (!part) continue;
          const targetPosition = part.position.clone();
          const targetQuaternion = part.quaternion.clone();
          part.position.copy(from.position).lerp(targetPosition, alpha);
          part.quaternion.copy(from.quaternion).slerp(targetQuaternion, alpha).normalize();
        }
        const bodyPosition = av.body.position.clone();
        const bodyScale = av.body.scale.clone();
        const bodyTilt = av.body.rotation.z;
        av.body.position.copy(transitionFrom.bodyPosition).lerp(bodyPosition, alpha);
        av.body.scale.copy(transitionFrom.bodyScale).lerp(bodyScale, alpha);
        av.body.rotation.z = transitionFrom.bodyTilt + (bodyTilt - transitionFrom.bodyTilt) * alpha;
        if (rawAlpha >= 1) transitionFrom = null;
      }

      // Walking faces +/-90 degrees in the direction of travel, easing back to
      // front view when he stops instead of snapping or spinning through random angles.
      const desiredYaw = L.pose === "walk"
        ? (L.dir >= 0 ? Math.PI / 2 : -Math.PI / 2)
        : 0;
      const yawDelta = Math.atan2(
        Math.sin(desiredYaw - bodyYaw),
        Math.cos(desiredYaw - bodyYaw)
      );
      bodyYaw += yawDelta * (1 - Math.exp(-delta * 5.2));
      av.body.rotation.y = bodyYaw;

      // Cursor look is a small local offset. It never overwrites imported keyframes.
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
      if (clip) {
        if (L.pose === "idle") {
          const headLook = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            clamp(look.x * 0.20, -0.14, 0.14),
            clamp(look.y * 0.38, -0.24, 0.24),
            0
          ));
          av.head.quaternion.multiply(headLook).normalize();
        }
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
