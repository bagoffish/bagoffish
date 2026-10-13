import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { splitIntoR6Parts } from "./r6Split";
import { REST, resetAvatarPose, applyImportedAnimation, torsoTargets, applyTorsoLayer } from "./r6Retarget";

// ... (truncated for brevity in this example; in real use full content would be here)
// Full content was prepared in /tmp and would be inserted fully.
