import assert from "node:assert/strict";
import * as THREE from "three/webgpu";
import { test } from "vitest";
import {
  createKnockback,
  defaultKnockbackDurationSeconds,
  defaultKnockbackSpeed,
} from "../src/combat/Knockback";

function createController() {
  const group = new THREE.Group();
  let lastVelocity = new THREE.Vector3();
  return {
    group,
    characterStatus: { linvel: new THREE.Vector3() },
    setLinVel(velocity: THREE.Vector3) {
      lastVelocity = velocity.clone();
    },
    resetLinVel() {
      lastVelocity.set(0, 0, 0);
    },
    getVelocity() {
      return lastVelocity;
    },
  };
}

test("knockback pushes the target away from the attacker", () => {
  const controller = createController();
  const knockback = createKnockback(controller as never);

  knockback.triggerFrom(new THREE.Vector3(0, 0, -1));
  knockback.update(0.016);

  assert.ok(controller.getVelocity().z > 0);
  assert.equal(controller.getVelocity().x, 0);
  assert.equal(controller.getVelocity().y, 0);
  assert.ok(
    controller.getVelocity().z > 0 &&
      controller.getVelocity().z <= defaultKnockbackSpeed
  );
});

test("knockback fades out and stops after its duration", () => {
  const controller = createController();
  const knockback = createKnockback(controller as never);

  knockback.triggerFrom(new THREE.Vector3(0, 0, -1));
  knockback.update(defaultKnockbackDurationSeconds / 2);
  assert.equal(knockback.active, true);
  assert.ok(
    controller.getVelocity().z < defaultKnockbackSpeed &&
      controller.getVelocity().z > 0
  );

  knockback.update(defaultKnockbackDurationSeconds / 2);
  assert.equal(knockback.active, false);
  assert.equal(controller.getVelocity().lengthSq(), 0);
});

test("knockback ignores a zero horizontal direction", () => {
  const controller = createController();
  const knockback = createKnockback(controller as never);

  knockback.triggerFrom(new THREE.Vector3(0, 2, 0));
  assert.equal(knockback.active, false);
});
