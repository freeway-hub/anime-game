import * as THREE from "three/webgpu";
import type { TargetLock } from "./TargetLock";
import type { createCharacterModelRuntime } from "../character/CharacterModelRuntime";
import type BVHEcctrl from "../lib/ecctrl/BVHEcctrl";

const MAGNET_START_PROGRESS = 0.05;
const MAGNET_END_PROGRESS = 0.76;
const MAGNET_STOP_DISTANCE = 0.52;
const MAGNET_START_DISTANCE = 3.0;
const MAGNET_FULL_PULL_DISTANCE = 2.2;
const MAGNET_MAX_SPEED = 16.0;
const MAGNET_RESPONSE = 52;
const MAGNET_MAX_STEP = 0.34;

type CharacterRuntime = ReturnType<typeof createCharacterModelRuntime>;

export interface AttackMagnetism {
  update(delta: number): void;
  dispose(): void;
}

export function createAttackMagnetism(
  controller: BVHEcctrl,
  characterRuntime: CharacterRuntime,
  targetLock: TargetLock
): AttackMagnetism {
  const targetOffset = new THREE.Vector3();
  const desiredVelocity = new THREE.Vector3();
  const currentVelocity = new THREE.Vector3();
  const targetRotation = new THREE.Matrix4();
  const targetQuaternion = new THREE.Quaternion();
  let disposed = false;

  return {
    update(delta) {
      if (disposed || !targetLock.target) return;
      if (targetLock.target.canReceiveHit && !targetLock.target.canReceiveHit()) return;

      const progress =
        characterRuntime.getPunchProgress() ??
        characterRuntime.getHeavyAttackProgress();
      if (
        progress === null ||
        progress < MAGNET_START_PROGRESS ||
        progress > MAGNET_END_PROGRESS
      ) {
        return;
      }

      const targetPoint = targetLock.target.getCombatTargetPoint
        ? targetLock.target.getCombatTargetPoint(controller.group.position)
        : targetLock.target.group.position;
      targetOffset.subVectors(targetPoint, controller.group.position);
      targetOffset.y = 0;
      const distance = targetOffset.length();
      if (distance <= MAGNET_STOP_DISTANCE || distance < 1e-5) {
        currentVelocity.copy(controller.characterStatus.linvel);
        currentVelocity.y = 0;
        currentVelocity.multiplyScalar(0.25);

        targetRotation.lookAt(
          targetOffset,
          controller.model.position,
          new THREE.Vector3(0, 1, 0)
        );
        targetQuaternion.setFromRotationMatrix(targetRotation);
        const rotationBlend = 1 - Math.exp(-56 * delta);
        controller.model.quaternion.slerp(targetQuaternion, rotationBlend);

        controller.setLinVel(currentVelocity);
        return;
      }

      if (distance > MAGNET_START_DISTANCE) return;

      const pullDistance = distance - MAGNET_STOP_DISTANCE;
      const pullStrength = THREE.MathUtils.clamp(
        pullDistance / (MAGNET_FULL_PULL_DISTANCE - MAGNET_STOP_DISTANCE),
        0,
        1
      );
      const speed = MAGNET_MAX_SPEED * pullStrength;
      desiredVelocity.copy(targetOffset).normalize().multiplyScalar(speed);

      currentVelocity.copy(controller.characterStatus.linvel);
      currentVelocity.y = 0;
      const blend = 1 - Math.exp(-MAGNET_RESPONSE * delta);
      currentVelocity.lerp(desiredVelocity, blend);
      const step = Math.min(currentVelocity.length() * delta, MAGNET_MAX_STEP);
      if (step > 0) {
        targetOffset.normalize();
        controller.group.position.addScaledVector(targetOffset, step);
        controller.group.updateMatrixWorld();
      }

      targetRotation.lookAt(
        targetOffset,
        controller.model.position,
        new THREE.Vector3(0, 1, 0)
      );
      targetQuaternion.setFromRotationMatrix(targetRotation);
      const rotationBlend = 1 - Math.exp(-56 * delta);
      controller.model.quaternion.slerp(targetQuaternion, rotationBlend);

      controller.setLinVel(currentVelocity);
    },
    dispose() {
      disposed = true;
    },
  };
}
