export const defaultHitStopDurationSeconds = 0.075;

export interface HitStop {
  readonly active: boolean;
  trigger(duration?: number): void;
  update(realDelta: number): number;
  reset(): void;
}

export function createHitStop(
  defaultDuration = defaultHitStopDurationSeconds
): HitStop {
  let remaining = 0;

  return {
    get active() {
      return remaining > 0;
    },
    trigger(duration = defaultDuration) {
      if (duration <= 0) return;
      remaining = Math.max(remaining, duration);
    },
    update(realDelta) {
      if (remaining <= 0 || realDelta <= 0) return realDelta;
      const frozenDelta = Math.min(realDelta, remaining);
      remaining -= frozenDelta;
      return realDelta - frozenDelta;
    },
    reset() {
      remaining = 0;
    },
  };
}
