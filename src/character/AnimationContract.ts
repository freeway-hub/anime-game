import type { CharacterAnimationStatus } from "../lib/ecctrl/index";

export const punchActionNames = ["Melee_Hook", "OverhandThrow"] as const;
export const punchActionName = punchActionNames[0];
export const hitReactionActionNames = ["Hit_Knockback"] as const;
export const rollActionName = "Roll";
export const idleTalkingActionName = "Idle_Talking_Loop";

export const statusToActionMap = {
  IDLE: "Idle_Loop",
  WALK: "Walk_Loop",
  RUN: "Jog_Fwd_Loop",
  JUMP_START: "NinjaJump_Start",
  JUMP_IDLE: "NinjaJump_Idle_Loop",
  JUMP_FALL: "NinjaJump_Idle_Loop",
  JUMP_LAND: "NinjaJump_Land",
} as const satisfies Record<CharacterAnimationStatus, string>;

export const requiredAnimationClipNames = Array.from(
  new Set([
    ...Object.values(statusToActionMap),
    ...punchActionNames,
    ...hitReactionActionNames,
    rollActionName,
    idleTalkingActionName,
  ])
);
