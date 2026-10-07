import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createHitStop,
  defaultHitStopDurationSeconds,
} from "../src/combat/HitStop";

test("hitstop freezes simulation for its configured duration", () => {
  const hitStop = createHitStop();
  hitStop.trigger();
  assert.equal(hitStop.active, true);
  assert.equal(hitStop.update(0.03), 0);
  assert.equal(hitStop.active, true);
  assert.equal(hitStop.update(0.08), 0);
  assert.equal(hitStop.active, false);
  assert.equal(hitStop.update(0.016), 0.016);
});

test("hitstop keeps the strongest overlapping trigger", () => {
  const hitStop = createHitStop();
  hitStop.trigger(0.03);
  hitStop.trigger(0.08);
  assert.equal(hitStop.update(0.05), 0);
  assert.equal(hitStop.update(0.03), 0);
  assert.equal(hitStop.active, false);
  assert.equal(defaultHitStopDurationSeconds, 0.11);
});
