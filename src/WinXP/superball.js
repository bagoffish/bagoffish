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
let sharedCanvas = null, sharedRenderer = null, sharedScene = null, sharedCamera = null;
let sharedEnvironment = null, sharedFrame = 0, sharedWidth = 0, sharedHeight = 0;
const sharedLightsReady = () => {
  if (sharedScene) return;
  sharedScene = new THREE.Scene();
  sharedCamera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, 0.1, 100);
  sharedCamera.position.set(0, 0, 20);
  sharedScene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(0.25, 0.3, 1);
  sharedScene.add(sun);
};
function ensureSharedRenderer() {
  if (sharedRenderer) return true;
  try {
    sharedCanvas = document.createElement("canvas");
    sharedCanvas.setAttribute("aria-hidden", "true");
    Object.assign(sharedCanvas.style, {
      position: "fixed", inset: "0", width: "100vw", height: "100vh",
      pointerEvents: "none", zIndex: "9998", background: "transparent"
    });
    document.body.appendChild(sharedCanvas);
    sharedRenderer = new THREE.WebGLRenderer({ canvas: sharedCanvas, alpha: true, antialias: true });
    sharedRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    sharedRenderer.setClearColor(0x000000, 0);
    sharedLightsReady();
    sharedEnvironment = createBallEnvironment(sharedRenderer);
    return true;
  } catch (error) {
    console.warn("Coy: superball could not start WebGL", error);
    sharedCanvas?.remove();
    sharedCanvas = null;
    sharedRenderer = null;
    sharedScene = null;
    sharedCamera = null;
    return false;
  }
}
function resizeSharedRenderer() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  if (width === sharedWidth && height === sharedHeight) return;
  sharedWidth = width;
  sharedHeight = height;
  sharedRenderer.setSize(width, height, false);
  sharedCamera.left = 0;
  sharedCamera.right = width;
  sharedCamera.top = 0;
  sharedCamera.bottom = height;
  sharedCamera.updateProjectionMatrix();
}
function scheduleSharedFrame() {
  if (!sharedFrame && active.size) sharedFrame = window.requestAnimationFrame(renderSharedFrame);
}
function renderSharedFrame(now) {
  sharedFrame = 0;
  if (!active.size || !sharedRenderer) return;
  resizeSharedRenderer();
  const W = sharedWidth, H = sharedHeight;
  for (const ball of [...active]) {
    if (ball.stopped) continue;
    const dt = Math.min((now - ball.last) / 1000, 0.033);
    ball.last = now;
    ball.age += dt * 1000;
    if (ball.age >= ball.duration) {
      ball.stop();
      continue;
    }
    const floor = Math.min(H, Number(ball.getFloor?.()) || H);
    ball.pvy += GRAVITY * dt;
    ball.px += ball.pvx * dt;
    ball.py += ball.pvy * dt;
    if (ball.px < ball.r) { ball.px = ball.r; ball.pvx = Math.abs(ball.pvx) * WALL_BOUNCE; ball.hit("x", Math.abs(ball.pvx)); }
    if (ball.px > W - ball.r) { ball.px = W - ball.r; ball.pvx = -Math.abs(ball.pvx) * WALL_BOUNCE; ball.hit("x", Math.abs(ball.pvx)); }
    if (ball.py < ball.r) { ball.py = ball.r; ball.pvy = Math.abs(ball.pvy) * WALL_BOUNCE; ball.hit("y", Math.abs(ball.pvy)); }
    if (ball.py > floor - ball.r) { ball.py = floor - ball.r; ball.pvy = -Math.abs(ball.pvy) * FLOOR_BOUNCE; ball.hit("y", Math.abs(ball.pvy)); }

    ball.squash *= Math.exp(-dt * 16);
    const fade = ball.age > ball.duration - FADE_MS ? Math.max(0, (ball.duration - ball.age) / FADE_MS) : 1;
    ball.material.opacity = fade;
    const sx = ball.squashAxis === "x" ? 1 - ball.squash : 1 + ball.squash * 0.6;
    const sy = ball.squashAxis === "y" ? 1 - ball.squash : 1 + ball.squash * 0.6;
    ball.pivot.position.set(ball.px, H - ball.py, 0);
    ball.pivot.scale.set(sx, sy, 1 + ball.squash * 0.6);
  }
  if (active.size) {
    sharedRenderer.render(sharedScene, sharedCamera);
    scheduleSharedFrame();
  }
}
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
  if (!ensureSharedRenderer()) {
    onDone?.();
    return { stop() {} };
  }
  resizeSharedRenderer();

  let stopped = false;
  let ownedGeometry = null;
  let mesh = null;
  const pivot = new THREE.Group();
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff, shininess: 80, specular: 0x666666,
    transparent: true, opacity: 1
  });
  makeBallReflective(material, sharedEnvironment);
  sharedScene.add(pivot);

  const buildMesh = model => {
    if (stopped || mesh) return;
    if (model?.geometry) {
      material.map = model.map || null;
      if (!model.map) material.color.set(0x971f33);
      material.needsUpdate = true;
      mesh = new THREE.Mesh(model.geometry, material); // model geometry/texture are shared
    } else {
      material.color.set(0x971f33);
      ownedGeometry = new THREE.SphereGeometry(1, 32, 20);
      mesh = new THREE.Mesh(ownedGeometry, material);
    }
    const scale = Math.ceil(r * 3.4) / 3.4;
    mesh.scale.setScalar(scale);
    pivot.add(mesh);
  };

  const ball = {
    stopped: false, duration, getFloor, onDone, r,
    px: x, py: y, pvx: vx, pvy: vy, age: 0, squash: 0, squashAxis: "y",
    last: performance.now(), pivot, material,
    hit(axis, speed) {
      this.squash = Math.min(0.32, 0.08 + speed / 5000);
      this.squashAxis = axis;
      boing(Math.min(1, speed / 1400));
    },
    stop() {
      if (this.stopped) return;
      this.stopped = true;
      active.delete(this);
      sharedScene?.remove(pivot);
      ownedGeometry?.dispose();
      material.dispose();
      onDone?.();
      if (!active.size && sharedFrame) {
        window.cancelAnimationFrame(sharedFrame);
        sharedFrame = 0;
      }
    }
  };
  active.add(ball);
  preloadSuperBall().then(buildMesh);
  scheduleSharedFrame();
  return ball;
}
