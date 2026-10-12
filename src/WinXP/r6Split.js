import * as THREE from "three";

// Splits one merged Roblox avatar model (loaded from OBJ) into the six R6 parts so each
// can be animated. Coordinates are in "studs" after the model is scaled to 5 studs tall
// (R6: legs 2, torso 2, head 1), with the feet at y = 0.
// If a hat or hair lands on the wrong part, tweak the numbers below.
export const R6_SPLIT = {
  height: 5,          // the whole model is scaled to this height
  scale: null,        // or set a number to skip auto-scaling (useful if a tall hat shrinks the avatar)
  neckY: 4,           // everything above this belongs to the head
  hipY: 2,            // everything below this belongs to the legs
  torsoHalfWidth: 1,  // beyond this distance from the center, torso-height triangles are arms
  flipFront: false,   // set true if the avatar shows its back to the screen
  pivots: {
    head: [0, 4, 0], torso: [0, 0, 0],
    rArm: [1.5, 4, 0], lArm: [-1.5, 4, 0],
    rLeg: [0.5, 2, 0], lLeg: [-0.5, 2, 0],
  },
};

function classify(x, y, c) {
  if (y > c.neckY) return "head";
  if (y < c.hipY) return x >= 0 ? "rLeg" : "lLeg";
  if (Math.abs(x) > c.torsoHalfWidth) return x > 0 ? "rArm" : "lArm";
  return "torso";
}

export function splitIntoR6Parts(root, cfg = R6_SPLIT) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (!(size.y > 0)) throw new Error("avatar model is empty");
  const s = cfg.scale || cfg.height / size.y;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, y0 = box.min.y;
  const flip = cfg.flipFront ? -1 : 1;

  const parts = {};
  Object.keys(cfg.pivots).forEach(n => { parts[n] = new Map(); });
  const v = new THREE.Vector3(), n3 = new THREE.Vector3(), nm = new THREE.Matrix3();
  const tri = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

  root.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    nm.getNormalMatrix(o.matrixWorld);
    for (const g of groups) {
      for (let i = g.start; i + 2 < g.start + g.count; i += 3) {
        let ax = 0, ay = 0;
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld);
          tri[k][0] = (v.x - cx) * s * flip; tri[k][1] = (v.y - y0) * s; tri[k][2] = (v.z - cz) * s * flip;
          ax += tri[k][0]; ay += tri[k][1];
        }
        const name = classify(ax / 3, ay / 3, cfg);
        const mat = mats[g.materialIndex] || mats[0];
        let b = parts[name].get(mat);
        if (!b) { b = { pos: [], nor: [], uv: [] }; parts[name].set(mat, b); }
        const p = cfg.pivots[name];
        for (let k = 0; k < 3; k++) {
          b.pos.push(tri[k][0] - p[0], tri[k][1] - p[1], tri[k][2] - p[2]);
          if (nor) { n3.fromBufferAttribute(nor, i + k).applyMatrix3(nm).normalize(); b.nor.push(n3.x * flip, n3.y, n3.z * flip); }
          else b.nor.push(0, 0, 1);
          if (uv) b.uv.push(uv.getX(i + k), uv.getY(i + k)); else b.uv.push(0, 0);
        }
      }
    }
  });

  const out = { body: new THREE.Group(), counts: {} };
  for (const name of Object.keys(parts)) {
    const g = new THREE.Group();
    g.position.set(...cfg.pivots[name]);
    const mats = [], pos = [], nor = [], uv = [], ranges = [];
    for (const [mat, b] of parts[name]) {
      ranges.push([pos.length / 3, b.pos.length / 3, mats.length]);
      mats.push(mat);
      for (const x of b.pos) pos.push(x);
      for (const x of b.nor) nor.push(x);
      for (const x of b.uv) uv.push(x);
    }
    out.counts[name] = pos.length / 9;                 // triangles per part
    if (pos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nor), 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
      ranges.forEach(r => geo.addGroup(r[0], r[1], r[2]));
      g.add(new THREE.Mesh(geo, mats));
    }
    out[name] = g;
    out.body.add(g);
  }
  return out;
}
