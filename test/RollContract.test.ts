import { describe, expect, it } from "vitest";
import { canChainRoll, rollChainWindowProgress } from "../src/movement/RollContract";

describe("roll chain window", () => {
  it("rejects input before the chain window", () => {
    expect(canChainRoll(rollChainWindowProgress - 0.01)).toBe(false);
  });

  it("accepts input at the chain window", () => {
    expect(canChainRoll(rollChainWindowProgress)).toBe(true);
  });

  it("rejects missing animation progress", () => {
    expect(canChainRoll(null)).toBe(false);
  });
});
