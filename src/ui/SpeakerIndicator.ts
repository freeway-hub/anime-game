import * as THREE from "three/webgpu";

export function createSpeakerIndicator(scene: THREE.Scene) {
  const indicator = new THREE.Group();

  const material = new THREE.MeshBasicMaterial({
    color: 0xffe45c,
  });

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.25, 4),
    material
  );
  body.rotation.z = -Math.PI / 2;
  body.position.x = -0.08;

  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.18, 4),
    material
  );
  throat.rotation.z = -Math.PI / 2;
  throat.position.x = 0.09;

  const innerWave = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.018, 4, 12, Math.PI * 0.55),
    material
  );
  innerWave.rotation.y = Math.PI / 2;
  innerWave.rotation.z = Math.PI * 0.25;
  innerWave.position.x = 0.23;

  const outerWave = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.018, 4, 12, Math.PI * 0.48),
    material
  );
  outerWave.rotation.y = Math.PI / 2;
  outerWave.rotation.z = Math.PI * 0.25;
  outerWave.position.x = 0.25;

  indicator.add(body, throat, innerWave, outerWave);
  indicator.scale.setScalar(0.7);
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
      for (const object of [body, throat, innerWave, outerWave]) {
        object.geometry.dispose();
      }
      material.dispose();
    },
  };
}
