import * as THREE from "three/webgpu";
import type { MovementInput } from "../lib/ecctrl/index";
import type BVHEcctrl from "../lib/ecctrl/BVHEcctrl";

export interface TargetLockTarget {
  readonly group: THREE.Object3D;
}

export interface TargetLock {
  readonly enabled: boolean;
  readonly target: TargetLockTarget | null;
  toggle(): void;
  update(input: MovementInput): MovementInput;
  applyFacing(): void;
  dispose(): void;
}

export function createTargetLock(
  controller: BVHEcctrl,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  targets: readonly TargetLockTarget[],
  enabled = true
): TargetLock {
  let locked = false;
  let currentTarget: TargetLockTarget | null = null;
  let disposed = false;
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const indicatorBounds = new THREE.Box3();
  const up = new THREE.Vector3(0, 1, 0);
  const targetQuaternion = new THREE.Quaternion();
  const lookMatrix = new THREE.Matrix4();
  const indicator = new THREE.Group();
  const indicatorArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.32, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe45c })
  );
  indicatorArrow.rotation.x = Math.PI;
  indicator.add(indicatorArrow);
  indicator.visible = false;
  scene.add(indicator);

  const selectNearestTarget = () => {
    const player = controller.group.position;
    let nearest: TargetLockTarget | null = null;
    let nearestDistance = Infinity;
    for (const candidate of targets) {
      const distance = player.distanceToSquared(candidate.group.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    }
    return nearest;
  };

  const setLocked = (value: boolean) => {
    locked = value;
    currentTarget = value ? selectNearestTarget() : null;
    controller.characterStatus.isTargetLocked = value && currentTarget !== null;
    indicator.visible = controller.characterStatus.isTargetLocked;
    controller.characterStores.animationStore
      .getState()
      .setAnimationStatus(controller.characterStatus.animationStatus);
    controller.characterStatus.targetLockInput.set(0, 0, 0);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (disposed || !enabled || event.repeat || event.code !== "Tab") return;
    event.preventDefault();
    setLocked(!locked);
  };

  window.addEventListener("keydown", onKeyDown);

  return {
    get enabled() {
      return enabled;
    },
    get target() {
      return currentTarget;
    },
    toggle() {
      if (enabled) setLocked(!locked);
    },
    update(input) {
      if (!locked || !currentTarget) {
        controller.characterStatus.targetLockInput.set(0, 0, 0);
        return input;
      }
      indicatorBounds.setFromObject(currentTarget.group);
      indicator.position.set(
        currentTarget.group.position.x,
        indicatorBounds.max.y + 0.35,
        currentTarget.group.position.z
      );
      camera.updateMatrixWorld();
      forward.subVectors(controller.group.position, camera.position);
      forward.y = 0;
      if (forward.lengthSq() < 1e-8) {
        controller.characterStatus.targetLockInput.set(0, 0, 0);
        return input;
      }
      forward.normalize();
      right.crossVectors(forward, up).normalize();
      movement.set(0, 0, 0);
      if (input.forward) movement.add(forward);
      if (input.backward) movement.sub(forward);
      if (input.leftward) movement.sub(right);
      if (input.rightward) movement.add(right);
      if (movement.lengthSq() > 1e-8) movement.normalize();
      controller.characterStatus.targetLockInput.copy(movement);
      return { ...input, direction: movement };
    },
    applyFacing() {
      if (!locked || !currentTarget) return;
      indicatorBounds.setFromObject(currentTarget.group);
      indicator.position.set(
        currentTarget.group.position.x,
        indicatorBounds.max.y + 0.35,
        indicatorBounds.max.z === -Infinity ? currentTarget.group.position.z : currentTarget.group.position.z
      );
      forward.subVectors(currentTarget.group.position, controller.group.position);
      forward.y = 0;
      if (forward.lengthSq() < 1e-8) return;
      forward.normalize();
      lookMatrix.lookAt(forward, new THREE.Vector3(), up);
      targetQuaternion.setFromRotationMatrix(lookMatrix);
      controller.model.quaternion.slerp(targetQuaternion, 0.3);
    },
    dispose() {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      setLocked(false);
      indicator.removeFromParent();
      indicatorArrow.geometry.dispose();
      indicatorArrow.material.dispose();
    },
  };
}
