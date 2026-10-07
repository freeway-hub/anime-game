import * as THREE from "three/webgpu";
import BVHEcctrl, { type MovementInput } from "../lib/ecctrl/index";
import { createCharacterStores, type CharacterStores } from "../lib/ecctrl/stores/ActorStores";

const NPC_COLLIDER_OPTIONS = {
  delay: 0,
  colliderCapsuleArgs: [0.3, 0.8, 4, 8] as [number, number, number, number],
  floatHeight: 0.4,
  floatPullBackHeight: 0.25,
  floatSensorRadius: 0.12,
  floatSpringK: 900,
  floatDampingC: 30,
  maxWalkSpeed: 1.1,
  maxRunSpeed: 5.5,
  acceleration: 26,
  deceleration: 30,
  airDragFactor: 0.3,
  walkAirDragFactor: 0.55,
  jumpVel: 6,
};

export interface NpcController {
  readonly controller: BVHEcctrl;
  readonly characterStores: CharacterStores;
  readonly movementInput: MovementInput;
  setMovement(input: MovementInput): void;
  setAttack(active: boolean): void;
  setJump(active: boolean): void;
  resetLinVel(): void;
  update(delta: number, elapsed: number): void;
  dispose(): void;
}export function createNpcController(
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene
): NpcController {
  const characterStores = createCharacterStores();
  const controller = new BVHEcctrl(
    { camera, scene, ...NPC_COLLIDER_OPTIONS },
    characterStores
  );
  controller.model.rotation.y = 0;
  scene.add(controller.group);

  const movementInput: MovementInput = {
    forward: false,
    backward: false,
    leftward: false,
    rightward: false,
    run: false,
    jump: false,
  };

  return {
    controller,
    characterStores,
    movementInput,
    setMovement(input) {
      Object.assign(movementInput, input);
      controller.setMovement(movementInput);
    },
    setAttack(active) {
      characterStores.buttonStore
        .getState()
        .setButtonActive("punch", active, "npc");
    },
    setJump(active) {
      movementInput.jump = active;
      controller.setMovement(movementInput);
    },
    resetLinVel() {
      controller.resetLinVel();
    },
    update(delta, elapsed) {
      controller.update(delta, elapsed);
    },
    dispose() {
      characterStores.buttonStore.getState().resetAllButtons();
      controller.dispose();
    },
  };
}
