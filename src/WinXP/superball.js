import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// The Roblox superball after Coy lets go of it. A transparent WebGL canvas the size of the ball
// is dragged around the viewport by a tiny physics loop, bouncing off every edge of the site
// (and the top of the taskbar) until its time is up.
//
// Tune the feel here:
const GRAVITY = 1400;          // px/s^2
const WALL_BOUNCE = 1;         // 1 = a wall returns all of the ball's speed (it is a SUPER ball)
const FLOOR_BOUNCE = 0.985;    // each floor hit loses ~1.5% so the arcs stay huge for the whole 7 s
const FADE_MS = 2000;          // it turns slowly transparent over the last 2 s of its life

// ---- a little reflection (the Roblox superball is "slightly reflective") ----
// Mixes a soft studio-lit environment into the ball's surface. 0 = matte, 1 = chrome.
export const BALL_REFLECTIVITY = 0.28;
export function createBallEnvironment(renderer) {
  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture;
  generator.dispose();
  return texture;
}
export function makeBallReflective(material, environment) {
  if (!material || !environment) return;
  material.envMap = environment;
  material.combine = THREE.MixOperation;
  material.reflectivity = BALL_REFLECTIVITY;
  material.needsUpdate = true;
}

const BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/avatar/gears/";

// ---- model: load ball.obj / ball.mtl / ball.png once, reuse for every throw ----
let modelPromise = null;
export function preloadSuperBall() {
  if (modelPromise) return modelPromise;
  hookAudioUnlock();
  loadBounceSound();
  modelPromise = new Promise(resolve => {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(BASE);
    mtlLoader.load("ball.mtl", materials => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath(BASE);
      objLoader.load("ball.obj", root => {
        let geometry = null, map = null;
        root.traverse(object => {
          if (!object.isMesh || geometry) return;
          geometry = object.geometry;
          map = [].concat(object.material)[0]?.map || null;
        });
        resolve(geometry ? { geometry, map } : null);
      }, undefined, () => resolve(null));
    }, undefined, () => resolve(null));
  });
  return modelPromise;
}

// ---- bounce sound ----
// Drop the classic Roblox superball "boing" at public/sounds/coy-tools/superball-bounce.mp3
// (.wav and .ogg are tried too). It is played on EVERY bounce, off the floor, the walls and the
// ceiling, with a little random pitch so repeated bounces don't sound robotic. If no file is
// found, a short synthesized boing plays instead so the ball is never silent.
const SOUND_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "") + "/sounds/coy-tools/";
const SOUND_FILES = ["superball-bounce.mp3"];
const BOUNCE_VOLUME = 0.8;     // 0..1, scaled down for soft hits
let audioContext = null, bounceBuffer = null, bounceLoad = null, unlockHooked = false;
const getAudioContext = () => {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { audioContext = new Ctx(); } catch (_) { audioContext = null; }
  return audioContext;
};
// Browsers keep audio muted until the visitor interacts with the page; resume on the first touch/click/key.
function hookAudioUnlock() {
  if (unlockHooked || typeof window === "undefined") return;
  unlockHooked = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    if (ctx && ctx.state !== "suspended") ["pointerdown", "keydown", "touchstart"].forEach(name => window.removeEventListener(name, unlock, true));
  };
  ["pointerdown", "keydown", "touchstart"].forEach(name => window.addEventListener(name, unlock, true));
}
function loadBounceSound() {
  if (bounceLoad) return bounceLoad;
  bounceLoad = (async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    for (const file of SOUND_FILES) {
      try {
        const response = await fetch(SOUND_BASE + file);
        const type = response.headers.get("content-type") || "";
        if (!response.ok || /text\/html/i.test(type)) continue;   // dev servers answer 404s with index.html
        bounceBuffer = await ctx.decodeAudioData(await response.arrayBuffer());
        return;
      } catch (_) { /* try the next format */ }
    }
    console.info("Coy: no superball-bounce sound file found in /sounds/coy-tools/, using the synthesized boing.");
  })();
  return bounceLoad;
}
let lastBounceSoundAt = 0;
function boing(strength) {
  try {
    const now = performance.now();
    if (now - lastBounceSoundAt < 45) return;          // a corner hit counts as one bounce
    lastBounceSoundAt = now;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (ctx.state !== "running") return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    if (bounceBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = bounceBuffer;
      source.playbackRate.value = 0.94 + Math.random() * 0.14;
      gain.gain.value = BOUNCE_VOLUME * (0.45 + 0.55 * strength);
      source.connect(gain);
      source.start(t);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380 + 220 * strength, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05 + 0.07 * strength, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch (_) { /* sound is optional */ }
}

const active = new Set();
export function clearSuperBalls() {
  [...active].forEach(ball => ball.stop());
}

/**
 * Throw a superball.
 *   x, y        screen position of the ball's centre when it leaves the hand (viewport px)
 *   r           ball radius in px
 *   vx, vy      launch velocity (px/s)
 *   duration    how long it lives, ms
 *   getFloor    () => y of the floor (the taskbar top); defaults to the viewport bottom
 *   onDone      called once the ball has disappeared
 */
export function launchSuperBall({ x, y, r = 12, vx = 700, vy = -1000, duration = 7000, getFloor, onDone }) {
  clearSuperBalls();                                   // only ever one ball in the air
  const size = Math.ceil(r * 3.4);                     // room for the squash-and-stretch
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed", left: "0px", top: "0px", width: size + "px", height: size + "px",
    pointerEvents: "none", zIndex: "9998", background: "transparent", willChange: "transform",
    transform: `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)`
  });
  document.body.appendChild(canvas);

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
  } catch (error) {
    console.warn("Coy: superball could not start WebGL", error);
    canvas.remove();
    onDone?.();
    return { stop() {} };
  }
  const scene = new THREE.Scene();
  const half = 1.7;                                    // the unit sphere fills ~60% of the canvas
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
  camera.position.set(0, 0, 8);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-3, 4, 6);
  scene.add(sun);

  const pivot = new THREE.Group();                     // squashed on impact
  scene.add(pivot);
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80, specular: 0x666666, transparent: true, opacity: 1 });
  const environment = createBallEnvironment(renderer);
  makeBallReflective(material, environment);
  let ownedGeometry = null;
  let mesh = null;
  const buildMesh = model => {
    if (stopped || mesh) return;
    if (model && model.geometry) {
      material.map = model.map || null;
      if (!model.map) material.color.set(0x971f33);
      material.needsUpdate = true;
      mesh = new THREE.Mesh(model.geometry, material);        // geometry/texture are shared: don't dispose them
    } else {
      material.color.set(0x971f33);
      ownedGeometry = new THREE.SphereGeometry(1, 32, 20);
      mesh = new THREE.Mesh(ownedGeometry, material);
    }
    pivot.add(mesh);
  };

  let stopped = false, raf = 0;
  let px = x, py = y, pvx = vx, pvy = vy;
  let age = 0, squash = 0, squashAxis = "y";
  let last = performance.now();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    active.delete(handle);
    window.cancelAnimationFrame(raf);
    ownedGeometry?.dispose();
    material.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
    onDone?.();
  };
  const handle = { stop };
  active.add(handle);

  const hit = (axis, speed) => {
    squash = Math.min(0.32, 0.08 + speed / 5000);
    squashAxis = axis;
    boing(Math.min(1, speed / 1400));
  };

  const frame = now => {
    if (stopped) return;
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    age += dt * 1000;
    if (age >= duration) { stop(); return; }

    const W = window.innerWidth, H = window.innerHeight;
    const floor = Math.min(H, Number(getFloor?.()) || H);
    pvy += GRAVITY * dt;
    px += pvx * dt;
    py += pvy * dt;
    if (px < r)         { px = r;         pvx =  Math.abs(pvx) * WALL_BOUNCE; hit("x", Math.abs(pvx)); }
    if (px > W - r)     { px = W - r;     pvx = -Math.abs(pvx) * WALL_BOUNCE; hit("x", Math.abs(pvx)); }
    if (py < r)         { py = r;         pvy =  Math.abs(pvy) * WALL_BOUNCE; hit("y", Math.abs(pvy)); }
    if (py > floor - r) { py = floor - r; pvy = -Math.abs(pvy) * FLOOR_BOUNCE; hit("y", Math.abs(pvy)); }

    squash *= Math.exp(-dt * 16);
    const fade = age > duration - FADE_MS ? Math.max(0, (duration - age) / FADE_MS) : 1;   // 1 -> 0 over the last FADE_MS
    material.opacity = fade;                           // fade out by turning transparent, not by shrinking
    const sx = squashAxis === "x" ? 1 - squash : 1 + squash * 0.6;
    const sy = squashAxis === "y" ? 1 - squash : 1 + squash * 0.6;
    pivot.scale.set(sx, sy, 1 + squash * 0.6);

    canvas.style.transform = `translate3d(${(px - size / 2).toFixed(1)}px, ${(py - size / 2).toFixed(1)}px, 0)`;
    if (mesh) renderer.render(scene, camera);
  };

  // The model is normally cached already (it is preloaded when Coy mounts), so this is near instant.
  preloadSuperBall().then(buildMesh);
  raf = window.requestAnimationFrame(frame);
  return handle;
}
