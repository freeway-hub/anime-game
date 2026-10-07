import * as THREE from "three/webgpu";
import { createLevelMaterial } from "./LevelMaterials";
import { addPlatform } from "./LevelPrimitives";

export function createLevelLayout(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = "player-base";
  const materials = createLevelMaterials();

  addPlatform(group, "start-deck", [14, 1, 10], 0, 0, 10, materials.floor);
  addPlatform(group, "start-back-rail", [14, 1, 0.35], 1, 0, 14.8, materials.rail);
  addPlatform(group, "start-left-rail", [0.35, 1, 10], 1, -6.8, 10, materials.rail);
  addPlatform(group, "start-right-rail", [0.35, 1, 10], 1, 6.8, 10, materials.rail);
  addPlatform(group, "start-front-rail", [14, 1, 0.35], 1, 0, 5, materials.rail);

  scene.add(group);
  return group;
}

function createLevelMaterials() {
  return {
    floor: createLevelMaterial(0xe98ab6),
    rail: createLevelMaterial(0xf6f1e7),
  };
}
