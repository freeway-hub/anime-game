import type { CharacterAnimationStatus } from "../lib/ecctrl/index";

export const punchActionNames = ["Punch_Jab", "Punch_Cross"] as const;
export const heavyAttackActionNames = ["Melee_Hook", "OverhandThrow"] as const;
export const heavyHitReactionActionName = "Hit_Knockback";
export const heavyRecoveryActionName = "LayToIdle";
export const punchActionName = punchActionNames[0];
export const hitReactionActionNames = ["Hit_Chest", "Hit_Head"] as const;
export const rollActionName = "Roll";
export const idleTalkingActionName = "Idle_Talking_Loop";

export const statusToActionMap = {
  IDLE: "Idle_Loop",
  WALK: "Walk_Loop",
  RUN: "Jog_Fwd_Loop",
  JUMP_START: "Jump_Start",
  JUMP_IDLE: "Jump_Loop",
  JUMP_FALL: "Jump_Loop",
  JUMP_LAND: "Jump_Land",
} as const satisfies Record<CharacterAnimationStatus, string>;

export const requiredAnimationClipNames = Array.from(
  new Set([
    ...Object.values(statusToActionMap),
    ...punchActionNames,
    ...heavyAttackActionNames,
    heavyHitReactionActionName,
    heavyRecoveryActionName,
    ...hitReactionActionNames,
    rollActionName,
    idleTalkingActionName,
  ])
);
