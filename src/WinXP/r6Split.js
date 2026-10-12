import * as THREE from "three";

// Roblox's avatar-3d OBJ is already divided into named groups (Rig1..Rig6 and
// Handle1..HandleN). Keep those real part boundaries: splitting triangles by
// guessed X/Y coordinates cuts through the head and sends arm geometry to the
// wrong limbs, especially when hair/accessories extend past the body bounds.
const RIG_TO_PART = {
  Rig1: "lLeg",
  Rig2: "rLeg",
  Rig3: "lArm",
  Rig4: "rArm",
  Rig5: "torso",
  Rig6: "head",
};
const PIVOTS = {
  head: [0, 4, 0],
  torso: [0, 0, 0],
  rArm: [1.5, 4, 0],
  lArm: [-1.5, 4, 0],
  rLeg: [0.5, 2, 0],
  lLeg: [-0.5, 2, 0],
};

function sourcePartName(object) {
  for (let current = object; current; current = current.parent) {
    if (RIG_TO_PART[current.name]) return current.name;
    if (/^Handle\d+$/.test(current.name)) return "head";
  }
  return null;
}

export function splitIntoR6Parts(root) {
  root.updateMatrixWorld(true);

  // Normalize against the six actual body parts, not accessories. Tall hair or
  // hats must not shrink the avatar or move the feet away from the taskbar.
  const bodyBounds = new THREE.Box3();
  let foundRigParts = 0;
  root.traverse(object => {
    if (!object.isMesh || !RIG_TO_PART[sourcePartName(object)]) return;
    bodyBounds.expandByObject(object);
    foundRigParts += 1;
  });
  if (!foundRigParts || bodyBounds.isEmpty()) {
    throw new Error("Roblox OBJ has no named R6 Rig1..Rig6 parts");
  }

  const size = bodyBounds.getSize(new THREE.Vector3());
  if (!(size.y > 0)) throw new Error("Roblox R6 body has zero height");
  const scale = 5 / size.y;
  const centerX = (bodyBounds.min.x + bodyBounds.max.x) / 2;
  const centerZ = (bodyBounds.min.z + bodyBounds.max.z) / 2;
  const baseY = bodyBounds.min.y;

  const body = new THREE.Group();
  const parts = {};
  const counts = {};
  for (const [name, pivot] of Object.entries(PIVOTS)) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(...pivot);
    body.add(group);
    parts[name] = group;
    counts[name] = 0;
  }

  root.traverse(object => {
    if (!object.isMesh) return;
    const sourceName = sourcePartName(object);
    if (!sourceName) return;
    const partName = RIG_TO_PART[sourceName] || "head";
    const pivot = PIVOTS[partName];
    const geometry = object.geometry.clone();

    // Bake the original OBJ transforms, normalize to five studs tall, center
    // the body, then move vertices into the selected joint's local space.
    geometry.applyMatrix4(object.matrixWorld);
    geometry.scale(scale, scale, scale);
    geometry.translate(-centerX * scale, -baseY * scale, -centerZ * scale);
    geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, object.material);
    mesh.name = object.name || sourceName;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parts[partName].add(mesh);
    counts[partName] += geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3;
  });

  // An OBJ Handle is an accessory mesh. Keep it attached to the head instead
  // of classifying its triangles as random pieces of an arm or torso.
  for (const name of Object.keys(parts)) {
    if (!parts[name].children.length) {
      throw new Error("Roblox R6 part is missing: " + name);
    }
  }

  return { body, ...parts, counts };
}
