import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
import { REST, ROBLOX_JOINT_PART, sampleClip, resetAvatarPose } from "./r6Retarget";

// Play Roblox's exported R6 KeyframeSequence CFrames from /avatar/animations.json.
// R6 avatar rendered on a transparent canvas. Model and color metadata are loaded
// from the checked-in /avatar/avatar.json and static model assets.
const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/";
const META_URL = BASE + "avatar.json";
const ANIMATIONS_URL = BASE + "animations.json";
const ASPECT = 0.9;          // canvas width / height
const FOOT = 0.09;           // fraction of canvas height below the feet
const DEFAULT_COLORS = { head: "#f5cd30", torso: "#2f6fed", leftArm: "#f5cd30", rightArm: "#f5cd30", leftLeg: "#2b2f3a", rightLeg: "#2b2f3a" };

const P = o => Object.assign({
  rArmZ: 0, lArmZ: 0, rArmX: 0, lArmX: 0,
  rLegX: 0, lLegX: 0, bob: 0, tilt: 0, sq: 0,
  headX: 0, headY: 0
}, o);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// Procedural fallback for reactions without a source clip (pat, held, land).
// Walk, wave, idle, and dances use the original imported Roblox Pose.CFrame data.
function target(name, t, dir, tiltIn) {
  const sin = (speed, phase = 0) => Math.sin(t * speed + phase);
  const cos = (speed, phase = 0) => Math.cos(t * speed + phase);
  switch (name) {
    case "wave": {
      // A held-up anatomical RIGHT arm (screen-left), with a small shoulder
      // sway to read as a wave on an elbow-free R6 rig.
      const wave = sin(8.5);
      return P({
        rArmZ: -2.22 - wave * 0.19,
        rArmX: 0.11 + sin(8.5, 1.1) * 0.15,
        lArmZ: 0.025,
        lArmX: sin(2.3) * 0.025,
        bob: sin(3.2) * 0.008,
        headX: -0.035 + sin(2.0) * 0.015,
        headY: -0.05 + sin(2.4) * 0.025
      });
    }

    case "walk": {
      // A relaxed alternating gait: opposing arm/leg swing, soft foot lift,
      // and a slight counter-sway rather than pumping the entire body.
      const stride = sin(8.1);
      const lift = Math.max(0, cos(16.2));
      return P({
        rArmZ: -0.025 + sin(4.05, Math.PI) * 0.035,
        lArmZ: 0.025 + sin(4.05) * 0.035,
        rArmX: -stride * 0.30,
        lArmX: stride * 0.30,
        rLegX: stride * 0.48,
        lLegX: -stride * 0.48,
        bob: 0.008 + lift * 0.025,
        tilt: -stride * 0.018,
        headX: 0.008 + lift * 0.01,
        headY: dir * 0.035
      });
    }

    case "dance":
    case "dance1": {
      // Side-to-side two-step. The hands stay within a believable R6 range;
      // hips and shoulders alternate on one shared beat.
      const beat = sin(5.2);
      const sway = sin(2.6);
      const bounce = Math.max(0, cos(5.2));
      return P({
        rArmZ: -0.92 - beat * 0.18,
        lArmZ: 0.92 + beat * 0.18,
        rArmX: 0.10 + sin(5.2, 1.15) * 0.13,
        lArmX: -0.10 - sin(5.2, 1.15) * 0.13,
        rLegX: -beat * 0.34,
        lLegX: beat * 0.34,
        bob: 0.008 + bounce * 0.045,
        tilt: sway * 0.055,
        headX: -0.015 + bounce * 0.025,
        headY: sway * 0.065
      });
    }

    case "dance2": {
      // An alternating step-touch with one arm leading; no whole-body spinning.
      const beat = sin(6.0);
      const sway = sin(3.0);
      const lift = Math.max(0, beat);
      return P({
        rArmZ: -1.48 - beat * 0.16,
        lArmZ: 0.48 + beat * 0.13,
        rArmX: sin(6.0, 0.4) * 0.14,
        lArmX: -sin(6.0, 0.4) * 0.12,
        rLegX: -sin(6.0, 0.35) * 0.36,
        lLegX: sin(6.0, 0.35) * 0.36,
        bob: 0.012 + lift * 0.04,
        tilt: sway * 0.048,
        headX: -0.02,
        headY: -sway * 0.065
      });
    }

    case "dance3": {
      // A gentle groove: loose arms, smaller steps and slower upper-body sway.
      const beat = sin(4.5);
      const sway = sin(2.25, 0.3);
      return P({
        rArmZ: -0.60 - beat * 0.27,
        lArmZ: 0.60 + beat * 0.27,
        rArmX: 0.13 + sin(4.5, 1.0) * 0.10,
        lArmX: -0.13 - sin(4.5, 1.0) * 0.10,
        rLegX: -beat * 0.27,
        lLegX: beat * 0.27,
        bob: 0.008 + Math.abs(beat) * 0.026,
        tilt: sway * 0.042,
        headX: sway * 0.018,
        headY: -sway * 0.055
      });
    }

    case "held": {
      // A restrained dangling reaction when picked up, with the pointer speed
      // providing the lean. Arms and legs wobble slightly instead of flailing.
      const wobble = sin(6.6);
      return P({
        rArmZ: -1.98 - wobble * 0.12,
        lArmZ: 1.98 + wobble * 0.12,
        rArmX: sin(5.6, 0.4) * 0.12,
        lArmX: -sin(5.6, 0.4) * 0.12,
        rLegX: sin(4.0) * 0.17,
        lLegX: -sin(4.0) * 0.17,
        tilt: tiltIn + wobble * 0.025,
        bob: sin(4.8) * 0.012
      });
    }

    case "fall": {
      // A compact startled pose while falling; tilt follows the throw direction.
      const flutter = sin(7.0);
      return P({
        rArmZ: -2.24 - flutter * 0.07,
        lArmZ: 2.24 + flutter * 0.07,
        rArmX: -0.17 + flutter * 0.035,
        lArmX: 0.17 - flutter * 0.035,
        rLegX: 0.30 + sin(5.0, 0.5) * 0.06,
        lLegX: -0.25 - sin(5.0, 0.5) * 0.06,
        tilt: tiltIn
      });
    }

    case "land": {
      // One visible impact, one softer rebound, then a quick return to rest.
      const impact = Math.exp(-t * 7.5) * Math.cos(t * 18);
      const settle = Math.exp(-t * 8.5);
      return P({
        rArmZ: -0.12 - impact * 0.24,
        lArmZ: 0.12 + impact * 0.24,
        rArmX: -settle * 0.09,
        lArmX: settle * 0.09,
        rLegX: -settle * 0.085,
        lLegX: settle * 0.085,
        sq: 0.22 * impact,
        bob: Math.max(0, sin(18)) * 0.018 * settle,
        tilt: sin(9) * 0.025 * settle
      });
    }

    case "pat": {
      // A strong pat squash and elastic recovery, with a small head dip.
      const impact = Math.exp(-t * 7.0) * Math.cos(t * 18.5);
      const settle = Math.exp(-t * 7.5);
      return P({
        rArmZ: -0.09 - impact * 0.07,
        lArmZ: 0.09 + impact * 0.07,
        rArmX: -settle * 0.065,
        lArmX: settle * 0.065,
        sq: 0.17 * impact,
        bob: Math.max(0, sin(18.5)) * 0.014 * settle,
        headX: -0.105 * settle,
        headY: sin(9.25) * 0.03 * settle
      });
    }

    case "idle":
    case "idle1":
    case "idle2":
    default: {
      // Quiet breathing, relaxed hands and tiny head movements; nothing loops
      // fast enough to look like jittering when Coy is meant to be standing.
      const breath = sin(1.65);
      const glance = sin(0.9, 0.8);
      return P({
        rArmZ: -0.035 + breath * 0.012,
        lArmZ: 0.035 - breath * 0.012,
        rArmX: sin(1.25, Math.PI) * 0.018,
        lArmX: sin(1.25) * 0.018,
        bob: breath * 0.012,
        tilt: sin(0.72) * 0.008,
        headX: sin(1.1, 0.4) * 0.018,
        headY: glance * 0.04
      });
    }
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
    let animationClips = null;
    let idleClipName = "idle1";
    const pose = P({});
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
        case "walk": return "walk";
        case "wave": return "wave";
        case "dance":
        case "dance1": return "dance1";
        case "dance2": return "dance2";
        case "dance3": return "dance3";
        case "fall": return "fall";
        default: return null;
      }
    };

    // Use the exported KeyframeSequence CFrames for each clip that exists.
    // A missing optional clip must not force every other animation back to procedural motion.
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
          animationClips = clips;
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
            clips: Object.fromEntries(Object.entries(clips)
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
            source: "procedural fallback",
            url: ANIMATIONS_URL,
            error: String(error?.message || error),
            current: { pose: live.current.pose, mode: "procedural fallback", clip: null },
            clips: {}
          };
          console.warn("Coy: using procedural animation fallback; R6 keyframes failed to load.", error);
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
      const animationMode = clip ? "keyframe:" + L.pose + ":" + requestedClipName : "procedural:" + L.pose;

      // When keyframes finish loading, this resets the greeting to its first frame.
      if (animationMode !== previousAnimationMode) {
        transitionFrom = capturePose();
        transitionStart = t;
        poseStart = t;
        // The procedural pose accumulator must not carry a raised arm or dance
        // pose into a later custom pat/land reaction (or into imported clips).
        if (clip || previousAnimationMode.startsWith("keyframe:")) Object.assign(pose, P({}));
        previousAnimationMode = animationMode;
        if (window.__coyAnimationStatus) {
          window.__coyAnimationStatus.current = {
            pose: L.pose,
            mode: clip ? "Roblox Pose.CFrame" : "procedural fallback",
            clip: clip ? requestedClipName : null,
            elapsed: 0
          };
        }
      }
      const localTime = t - poseStart;
      if (window.__coyAnimationStatus) {
        window.__coyAnimationStatus.current = {
          pose: L.pose,
          mode: clip ? "Roblox Pose.CFrame" : "procedural fallback",
          clip: clip ? requestedClipName : null,
          elapsed: localTime
        };
      }
      const tiltIn = clamp(-L.vx * 0.0006, -0.5, 0.5);

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
      } else {
        const nextPose = target(L.pose, localTime, L.dir, tiltIn);
        const impactPose = L.pose === "pat" || L.pose === "land";
        const blend = 1 - Math.exp(-delta * (impactPose ? 20 : 11.5));
        for (const key in pose) pose[key] += (nextPose[key] - pose[key]) * blend;

        // Keep fallback posing aligned with the one-to-one imported joint map.
        av.rArm.rotation.set(pose.rArmX, 0, pose.rArmZ);
        av.lArm.rotation.set(pose.lArmX, 0, pose.lArmZ);
        av.rLeg.rotation.x = pose.rLegX;
        av.lLeg.rotation.x = pose.lLegX;
        av.body.position.y = pose.bob;
        av.body.rotation.z = pose.tilt;
        av.body.scale.set(1 + pose.sq, 1 - pose.sq, 1 + pose.sq);
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
      } else {
        av.head.rotation.set(
          clamp(pose.headX + look.x * 0.32, -0.45, 0.45),
          clamp(pose.headY + look.y * 0.58, -0.65, 0.65),
          0
        );
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
