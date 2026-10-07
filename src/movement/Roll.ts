import * as THREE from "three/webgpu";
import type BVHEcctrl from "../lib/ecctrl/BVHEcctrl";

export const defaultRollDurationSeconds = 0.62;
export const defaultRollSpeed = 7.2;
export const defaultRollCooldownSeconds = 0.45;

export interface RollCharacter {
  playRoll(): boolean;
}

export interface RollCamera {
  getForwardDirection(target: THREE.Vector3): THREE.Vector3;
}

export interface Roll {
  readonly active: boolean;
  update(delta: number): void;
  setInputEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createRoll(
  controller: BVHEcctrl,
  characterRuntime: RollCharacter,
  camera: RollCamera,
  duration = defaultRollDurationSeconds,
  speed = defaultRollSpeed,
  cooldown = defaultRollCooldownSeconds
): Roll {
  const direction = new THREE.Vector3();
  let active = false;
  let remaining = 0;
  let nextAllowedTime = 0;
  let elapsed = 0;
  let inputEnabled = true;

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      !inputEnabled ||
      (event.code !== "ControlLeft" && event.code !== "ControlRight") ||
      event.repeat
    ) {
      return;
    }
    if (active || elapsed < nextAllowedTime || !controller.characterStatus.isOnGround) return;
    if (!characterRuntime.playRoll()) return;

    controller.model.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() < 1e-5) {
      camera.getForwardDirection(direction);
      direction.y = 0;
    }
    if (direction.lengthSq() < 1e-5) return;
    direction.normalize();

    active = true;
    remaining = duration;
    nextAllowedTime = elapsed + cooldown;
    controller.setLinVel(
      new THREE.Vector3(
        direction.x * speed,
        controller.characterStatus.linvel.y,
        direction.z * speed
      )
    );
  };

  const onBlur = () => {
    if (!active) return;
    active = false;
    remaining = 0;
    controller.resetLinVel();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);

  return {
    get active() {
      return active;
    },
    update(delta) {
      if (delta <= 0) return;
      elapsed += delta;
      if (!active) return;

      remaining = Math.max(0, remaining - delta);
      if (remaining <= 0) {
        active = false;
        controller.resetLinVel();
        return;
      }

      controller.setLinVel(
        new THREE.Vector3(
          direction.x * speed,
          controller.characterStatus.linvel.y,
          direction.z * speed
        )
      );
    },
    setInputEnabled(enabled) {
      inputEnabled = enabled;
      if (!enabled && active) {
        active = false;
        remaining = 0;
        controller.resetLinVel();
      }
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      active = false;
      controller.resetLinVel();
    },
  };
}
