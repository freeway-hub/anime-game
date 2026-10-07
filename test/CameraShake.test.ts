import assert from "node:assert/strict";
import * as THREE from "three";
import { test } from "vitest";
import {
  createCameraShake,
  defaultCameraShakeDurationSeconds,
} from "../src/app/CameraShake";

test("camera shake applies a short impact offset", () => {
  const shake = createCameraShake();
  const camera = new THREE.PerspectiveCamera();

  shake.trigger();
  assert.equal(shake.active, true);
  shake.update(0.01);
  camera.position.set(0, 0, 0);
  shake.apply(camera);

  assert.ok(camera.position.length() > 0);
  assert.equal(shake.active, true);
});

test("camera shake expires after its real-time duration", () => {
  const shake = createCameraShake();
  const camera = new THREE.PerspectiveCamera();

  shake.trigger();
  shake.update(defaultCameraShakeDurationSeconds);
  shake.apply(camera);

  assert.equal(shake.active, false);
  assert.deepEqual(camera.position.toArray(), [0, 0, 0]);
});
