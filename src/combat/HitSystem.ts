import type { Vector3 } from "three";
import type { TargetLock, TargetLockTarget } from "./TargetLock";
import type { createCharacterModelRuntime } from "../character/CharacterModelRuntime";

const PUNCH_HIT_PROGRESS = 0.5;
const PUNCH_HIT_RANGE = 1.12;

type CharacterRuntime = ReturnType<typeof createCharacterModelRuntime>;

export interface HitSystem {
  update(): boolean;
  dispose(): void;
}

export function createHitSystem(
  characterRuntime: CharacterRuntime,
  targetLock: TargetLock,
  playerPosition: Vector3
): HitSystem {
  let previousPunchProgress: number | null = null;
  let disposed = false;

  return {
    update() {
      if (disposed) return false;
      const progress = characterRuntime.getPunchProgress();
      if (progress === null) {
        previousPunchProgress = null;
        return false;
      }

      let hitConfirmed = false;
      if (
        previousPunchProgress !== null &&
        previousPunchProgress < PUNCH_HIT_PROGRESS &&
        progress >= PUNCH_HIT_PROGRESS
      ) {
        hitConfirmed = tryHitTarget(targetLock.target, playerPosition);
      }
      previousPunchProgress = progress;
      return hitConfirmed;
    },
    dispose() {
      disposed = true;
      previousPunchProgress = null;
    },
  };
}

function tryHitTarget(
  target: TargetLockTarget | null,
  playerPosition: Vector3
) {
  if (!target?.receiveHit) return false;
  if (playerPosition.distanceTo(target.group.position) > PUNCH_HIT_RANGE) return false;
  return target.receiveHit(playerPosition);
}
