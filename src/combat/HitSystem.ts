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
  let previousHeavyProgress: number | null = null;
  let disposed = false;

  return {
    update() {
      if (disposed) return false;

      const punchProgress = characterRuntime.getPunchProgress();
      const heavyProgress = characterRuntime.getHeavyAttackProgress();
      let hitConfirmed = false;

      if (punchProgress === null) {
        previousPunchProgress = null;
      } else {
        if (
          previousPunchProgress !== null &&
          previousPunchProgress < PUNCH_HIT_PROGRESS &&
          punchProgress >= PUNCH_HIT_PROGRESS
        ) {
          hitConfirmed = tryHitTarget(targetLock.target, playerPosition, false) || hitConfirmed;
        }
        previousPunchProgress = punchProgress;
      }

      if (heavyProgress === null) {
        previousHeavyProgress = null;
      } else {
        if (
          previousHeavyProgress !== null &&
          previousHeavyProgress < PUNCH_HIT_PROGRESS &&
          heavyProgress >= PUNCH_HIT_PROGRESS
        ) {
          hitConfirmed = tryHitTarget(targetLock.target, playerPosition, true) || hitConfirmed;
        }
        previousHeavyProgress = heavyProgress;
      }

      return hitConfirmed;
    },
    dispose() {
      disposed = true;
      previousPunchProgress = null;
      previousHeavyProgress = null;
    },
  };
}

function tryHitTarget(
  target: TargetLockTarget | null,
  playerPosition: Vector3,
  heavy: boolean
) {
  if (!target?.receiveHit) return false;
  if (playerPosition.distanceTo(target.group.position) > PUNCH_HIT_RANGE) return false;
  return target.receiveHit(playerPosition, heavy);

}