import * as THREE from "three";
import type { CharacterStatus } from "./Types";

export function createCharacterStatus(): CharacterStatus {
  return {
    position: new THREE.Vector3(),
    linvel: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    inputDir: new THREE.Vector3(),
    movingDir: new THREE.Vector3(),
    isOnGround: false,
    isOnMovingPlatform: false,
    isAttacking: false,
    isTargetLocked: false,
    targetLockInput: new THREE.Vector3(),
    animationStatus: "IDLE",
  };
}

export const characterStatus = createCharacterStatus();
