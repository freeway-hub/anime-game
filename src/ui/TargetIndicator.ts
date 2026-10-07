import * as THREE from "three/webgpu";

export function createTargetIndicator(scene: THREE.Scene) {
  const indicator = new THREE.Group();
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.32, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe45c })
  );
  arrow.rotation.x = Math.PI;
  indicator.add(arrow);
  indicator.visible = false;
  scene.add(indicator);

  return {
    object: indicator,
    setPosition(position: THREE.Vector3) {
      indicator.position.copy(position);
    },
    setVisible(visible: boolean) {
      indicator.visible = visible;
    },
    dispose() {
      indicator.removeFromParent();
      arrow.geometry.dispose();
      arrow.material.dispose();
    },
  };
}
