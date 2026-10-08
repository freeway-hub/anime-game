import * as THREE from "three";

const PLAYER_CAPSULE = [0.3, 0.8, 4, 8] as const;
const NPC_CAPSULE = [0.3, 0.8, 4, 8] as const;
const HIT_RANGE = 1.12;

export interface CombatDebug {
  update(): void;
  dispose(): void;
}

export function createCombatDebug(
  scene: THREE.Scene,
  player: THREE.Object3D,
  npc: THREE.Object3D,
  npcCanReceiveHit: () => boolean,
  getNpcCombatTargetPoint: (target: THREE.Vector3) => THREE.Vector3
): CombatDebug {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const playerCapsule = createCapsule(PLAYER_CAPSULE, 0x44aaff);
  const npcCapsule = createCapsule(NPC_CAPSULE, 0xff5555);
  const npcHitRange = new THREE.Mesh(
    new THREE.SphereGeometry(HIT_RANGE, 24, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      depthWrite: false,
    })
  );

  root.add(playerCapsule, npcCapsule, npcHitRange);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.code !== "F8") return;
    event.preventDefault();
    root.visible = !root.visible;
  };

  window.addEventListener("keydown", onKeyDown);

  return {
    update() {
      if (!root.visible) return;
      playerCapsule.position.copy(player.position);
      npcCapsule.position.copy(npc.position);
      const canReceiveHit = npcCanReceiveHit();
      npcCapsule.visible = canReceiveHit;
      npcHitRange.position.copy(getNpcCombatTargetPoint(npcHitRange.position));
      npcHitRange.visible = canReceiveHit;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      root.removeFromParent();
      disposeObject(playerCapsule);
      disposeObject(npcCapsule);
      disposeObject(npcHitRange);
    },
  };
}

function createCapsule(
  [radius, length, capSegments, radialSegments]: readonly [number, number, number, number],
  color: number
) {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments),
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      depthWrite: false,
    })
  );
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    child.material.dispose();
  });
}
