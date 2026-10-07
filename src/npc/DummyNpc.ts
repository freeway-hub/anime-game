import * as THREE from "three/webgpu";
import { Npc } from "./Npc";

const DUMMY_POSITION = new THREE.Vector3(0, 1.1, 5.8);

export class DummyNpc extends Npc {
  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    super(camera, scene, DUMMY_POSITION, undefined, "dummy.vrm");
    this.controller.setMovement({
      forward: false,
      backward: false,
      leftward: false,
      rightward: false,
      run: false,
      jump: false,
    });
    this.controller.resetLinVel();
  }
}
