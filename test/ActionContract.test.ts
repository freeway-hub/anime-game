import assert from "node:assert/strict";
import { test } from "vitest";
import {
  punchChainWindowProgress,
  punchMinIntervalSeconds,
  shouldStartPunchAction,
} from "../src/character/ActionContract";

test("punch action requires the configured interval", () => {
  assert.equal(punchMinIntervalSeconds, 0.3);
  assert.equal(shouldStartPunchAction(1, 1, false, null), true);
  assert.equal(shouldStartPunchAction(1.29, 1.3, false, null), false);
});

test("punch action can chain only inside the late animation window", () => {
  assert.equal(
    shouldStartPunchAction(2, 1.5, true, punchChainWindowProgress - 0.01),
    false
  );
  assert.equal(
    shouldStartPunchAction(2, 1.5, true, punchChainWindowProgress),
    true
  );
});

test("punch action cannot chain before the interval even inside the window", () => {
  assert.equal(
    shouldStartPunchAction(1.4, 1.5, true, punchChainWindowProgress),
    false
  );
});
