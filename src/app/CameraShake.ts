import * as THREE from "three/webgpu";

export const defaultCameraShakeDurationSeconds = 0.12;
export const defaultCameraShakePositionStrength = 0.045;
export const defaultCameraShakeRotationStrength = 0.035;

export interface CameraShake {
  readonly active: boolean;
  trigger(): void;
  update(realDelta: number): void;
  apply(camera: THREE.PerspectiveCamera): void;
  reset(): void;
}

export function createCameraShake(
  duration = defaultCameraShakeDurationSeconds,
  positionStrength = defaultCameraShakePositionStrength,
  rotationStrength = defaultCameraShakeRotationStrength
): CameraShake {
  let remaining = 0;
  const offset = new THREE.Vector3();
  const rotation = new THREE.Vector3();

  return {
    get active() {
      return remaining > 0;
    },
    trigger() {
      if (duration <= 0) return;
      remaining = Math.max(remaining, duration);
    },
    update(realDelta) {
      if (remaining <= 0 || realDelta <= 0) {
        offset.set(0, 0, 0);
        rotation.set(0, 0, 0);
        return;
      }
      remaining = Math.max(0, remaining - realDelta);
      const strength = THREE.MathUtils.clamp(remaining / duration, 0, 1);
      const envelope = strength * strength;
      offset.set(
        (Math.random() * 2 - 1) * positionStrength * envelope,
        (Math.random() * 2 - 1) * positionStrength * 0.65 * envelope,
        (Math.random() * 2 - 1) * positionStrength * 0.35 * envelope
      );
      rotation.set(
        (Math.random() * 2 - 1) * rotationStrength * envelope,
        (Math.random() * 2 - 1) * rotationStrength * 0.6 * envelope,
        (Math.random() * 2 - 1) * rotationStrength * envelope
      );
    },
    apply(camera) {
      camera.position.add(offset);
      camera.rotation.x += rotation.x;
      camera.rotation.y += rotation.y;
      camera.rotation.z += rotation.z;
    },
    reset() {
      remaining = 0;
      offset.set(0, 0, 0);
      rotation.set(0, 0, 0);
    },
  };
}
