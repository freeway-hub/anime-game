import * as THREE from "three/webgpu";
import type BVHEcctrl from "../lib/ecctrl/BVHEcctrl";

export const defaultKnockbackDurationSeconds = 0.18;
export const defaultKnockbackSpeed = 4.8;

export interface Knockback {
  readonly active: boolean;
  triggerFrom(sourcePosition: THREE.Vector3): void;
  update(delta: number): void;
  reset(): void;
}

export function createKnockback(
  controller: BVHEcctrl,
  duration = defaultKnockbackDurationSeconds,
  speed = defaultKnockbackSpeed
): Knockback {
  let remaining = 0;
  const direction = new THREE.Vector3();
  const velocity = new THREE.Vector3();

  return {
    get active() {
      return remaining > 0;
    },
    triggerFrom(sourcePosition) {
      direction.subVectors(controller.group.position, sourcePosition);
      direction.y = 0;
      if (direction.lengthSq() < 1e-8) return;
      direction.normalize();
      remaining = duration;
    },
    update(delta) {
      if (remaining <= 0 || delta <= 0) return;
      remaining = Math.max(0, remaining - delta);
      const strength = THREE.MathUtils.clamp(remaining / duration, 0, 1);
      velocity.copy(direction).multiplyScalar(speed * strength);
      controller.setLinVel(velocity);
      if (remaining === 0) controller.resetLinVel();
    },
    reset() {
      remaining = 0;
      controller.resetLinVel();
    },
  };
}
