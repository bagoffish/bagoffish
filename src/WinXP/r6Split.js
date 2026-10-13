import * as THREE from "three";

// Roblox's avatar-3d OBJ is already divided into named groups (Rig1..Rig6 and
// Handle1..HandleN). Keep those real part boundaries: splitting triangles by
// guessed X/Y coordinates cuts through the head and sends arm geometry to the
// wrong limbs, especially when hair/accessories extend past the body bounds.
const RIG_TO_PART = {
  // The OBJ's negative-X groups are on the avatar's anatomical right when
  // facing the camera (+Z). Keep the mesh labels aligned with Roblox's Pose names.
  Rig1: "rLeg",
  Rig2: "lLeg",
  Rig3: "rArm",
  Rig4: "lArm",
  Rig5: "torso",
  Rig6: "head",
};
// Joint pivots in centered scene coordinates (feet at y = 0). The avatar faces +Z,
// so anatomical right is on screen-left (-X), and anatomical left is on screen-right (+X).
const PIVOTS = {
  head: [0, 4, 0],
  torso: [0, 3, 0],
  rArm: [-1, 3.5, 0],
  lArm: [1, 3.5, 0],
  rLeg: [-1, 2, 0],
  lLeg: [1, 2, 0],
};

function isTorsoAccessory(object) {
  // This tail is a back accessory, not part of the head. Keep it in torso space
  // so head-look rotations don't swing the tail around with the head.
  for (let current = object; current; current = current.parent) {
    const candidates = [
      current.name,
      current.userData?.name,
      current.userData?.objectName,
      current.userData?.groupName,
    ].filter(value => typeof value === "string");
    // Roblox's OBJ export strips the accessory name and exposes this avatar's
    // OpossumTail as Handle7. Without this fallback it gets attached to the head,
    // so it swings away from the torso when the head looks around.
    if (candidates.some(value => /OpossumTail/i.test(value) || /^Handle7$/i.test(value.trim()))) return true;
  }
  return false;
}

function sourcePartName(object) {
  // OBJLoader versions differ in whether a "g" name is stored on the mesh,
  // its parent, or the object's userData. Check all of them before falling back.
  for (let current = object; current; current = current.parent) {
    const candidates = [
      current.name,
      current.userData?.name,
      current.userData?.objectName,
      current.userData?.groupName,
    ].filter(value => typeof value === "string");
    for (const candidate of candidates) {
      const rig = candidate.match(/(?:^|\s)(Rig[1-6])(?:$|\s)/);
      if (rig && RIG_TO_PART[rig[1]]) return rig[1];
      const handle = candidate.match(/(?:^|\s)(Handle\d+)(?:$|\s)/);
      if (handle) return handle[1];
    }
  }
  // Preserve unknown accessory meshes rather than dropping them.
  return "head";
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
  // Roblox OBJ units are studs. Keep 1:1 when the body is a normal R6 height so the joint
  // pivots line up exactly; otherwise normalize to five studs tall.
  const scale = size.y > 4.5 && size.y < 6.5 ? 1 : 5 / size.y;
  const centerX = (bodyBounds.min.x + bodyBounds.max.x) / 2;
  const centerZ = (bodyBounds.min.z + bodyBounds.max.z) / 2;
  const baseY = bodyBounds.min.y;

  const body = new THREE.Group();
  const parts = {};
  const counts = {};
  const torsoMeshes = [];
  const headMeshes = [];
  const headAccessoryMeshes = [];
  const tailMeshes = [];
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
    const isTail = isTorsoAccessory(object);
    const partName = isTail ? "torso" : (RIG_TO_PART[sourceName] || "head");
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
    if (isTail) tailMeshes.push(mesh);
    else if (partName === "torso") torsoMeshes.push(mesh);
    else if (/^Handle\\d+$/i.test(sourceName)) headAccessoryMeshes.push(mesh);
    else if (partName === "head") headMeshes.push(mesh);
    counts[partName] += geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3;
  });

  // The tail's exported attachment transform can leave its base floating away
  // from the torso even when it is parented to the torso group. Align its nearest
  // end with the torso's back surface in the same normalized model space.
  if (tailMeshes.length && torsoMeshes.length) {
    const torsoBounds = new THREE.Box3();
    for (const mesh of torsoMeshes) {
      mesh.geometry.computeBoundingBox();
      torsoBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    }
    for (const tail of tailMeshes) {
      tail.geometry.computeBoundingBox();
      const tailBounds = tail.geometry.boundingBox.clone().applyMatrix4(tail.matrix);
      const overlap = 0.08;
      // Move the whole accessory only along axes where its bounding box is
      // completely detached from the torso. This catches vertical/sideways
      // offsets too, rather than assuming the export is wrong only on Z.
      for (const axis of ["x", "y", "z"]) {
        const min = torsoBounds.min[axis];
        const max = torsoBounds.max[axis];
        const tailMin = tailBounds.min[axis];
        const tailMax = tailBounds.max[axis];
        if (tailMax < min) {
          const shift = min - tailMax - overlap;
          tail.position[axis] += shift;
          tailBounds.min[axis] += shift;
          tailBounds.max[axis] += shift;
        } else if (tailMin > max) {
          const shift = max - tailMin + overlap;
          tail.position[axis] += shift;
          tailBounds.min[axis] += shift;
          tailBounds.max[axis] += shift;
        }
      }
    }
  }

  // Keep head accessories (hair, clips, hats, etc.) physically touching the head.
  // OBJ exports sometimes preserve the accessory's world position but lose its
  // attachment joint; when a Handle is entirely detached on any axis, shift it
  // just enough to overlap the head rather than leaving it floating nearby.
  if (headAccessoryMeshes.length && headMeshes.length) {
    const headBounds = new THREE.Box3();
    for (const mesh of headMeshes) {
      mesh.geometry.computeBoundingBox();
      headBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    }
    for (const accessory of headAccessoryMeshes) {
      accessory.geometry.computeBoundingBox();
      const accessoryBounds = accessory.geometry.boundingBox.clone().applyMatrix4(accessory.matrix);
      const overlap = 0.035;
      for (const axis of ["x", "y", "z"]) {
        const min = headBounds.min[axis];
        const max = headBounds.max[axis];
        const accessoryMin = accessoryBounds.min[axis];
        const accessoryMax = accessoryBounds.max[axis];
        if (accessoryMax < min) {
          const shift = min - accessoryMax - overlap;
          accessory.position[axis] += shift;
          accessoryBounds.min[axis] += shift;
          accessoryBounds.max[axis] += shift;
        } else if (accessoryMin > max) {
          const shift = max - accessoryMin + overlap;
          accessory.position[axis] += shift;
          accessoryBounds.min[axis] += shift;
          accessoryBounds.max[axis] += shift;
        }
      }
    }
  }

  // An OBJ Handle is an accessory mesh. Keep it attached to the head instead
  // of classifying its triangles as random pieces of an arm or torso.
  for (const name of Object.keys(parts)) {
    if (!parts[name].children.length) {
      throw new Error("Roblox R6 part is missing: " + name);
    }
  }

  // In R6 the head, arms and legs are all joined to the torso, so torso motion carries them along.
  // Mesh vertices are already expressed relative to their own pivots.
  parts.torso.add(parts.head, parts.rArm, parts.lArm, parts.rLeg, parts.lLeg);
  parts.head.position.set(0, 1, 0);
  parts.rArm.position.set(-1, 0.5, 0);
  parts.lArm.position.set(1, 0.5, 0);
  parts.rLeg.position.set(-1, -1, 0);
  parts.lLeg.position.set(1, -1, 0);

  return { body, ...parts, counts };
}
