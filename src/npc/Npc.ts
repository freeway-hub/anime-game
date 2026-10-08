import * as THREE from "three/webgpu";
import { createCharacterModelRuntime } from "../character/CharacterModelRuntime";
import { sampleVrms } from "../character/AnimatedCharacterModel";
import { createNpcController, type NpcController } from "./NpcController";
import { createKnockback, type Knockback } from "../combat/Knockback";

export class Npc {
  readonly controller: NpcController;
  readonly group: THREE.Group;
  readonly name: string;
  private readonly runtime: ReturnType<typeof createCharacterModelRuntime>;
  private readonly knockback: Knockback;
  private heavyRecoveryWaitingForReaction = false;
  private heavyRecoveryRemaining = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    position: THREE.Vector3,
    sourceUrl = sampleVrms[0].url,
    sourceName = "npc.vrm"
  ) {
    this.controller = createNpcController(camera, scene);
    this.group = this.controller.controller.group;
    this.name = sourceName.replace(/\\.vrm$/i, "").replace(/[-_]+/g, " ").trim() || "NPC";
    this.group.position.copy(position);
    this.runtime = createCharacterModelRuntime(this.controller.controller, {
      characterStores: this.controller.characterStores,
    });
    this.knockback = createKnockback(this.controller.controller);
    this.runtime.loadUrl(sourceUrl, sourceName);
  }

  update(delta: number, elapsed: number) {
    this.knockback.update(delta);
    if (this.heavyRecoveryWaitingForReaction) {
      if (this.runtime.getHeavyHitReactionProgress() === null) {
        this.heavyRecoveryWaitingForReaction = false;
        this.heavyRecoveryRemaining = 1;
      }
    } else if (this.heavyRecoveryRemaining > 0) {
      this.heavyRecoveryRemaining = Math.max(0, this.heavyRecoveryRemaining - delta);
      if (this.heavyRecoveryRemaining === 0) {
        this.runtime.playLayToIdle();
      }
    }
    if (
      this.heavyRecoveryWaitingForReaction ||
      this.heavyRecoveryRemaining > 0
    ) {
      if (this.controller.controller.characterStatus.isOnGround) {
        this.controller.controller.resetLinVel();
      }
    }
    this.controller.update(delta, elapsed);
    this.runtime.update(delta, elapsed);
  }

  setMouthOpen(value: number) {
    this.runtime.setMouthOpen(value);
  }

  setIdleTalking(active: boolean) {
    this.runtime.setIdleTalking(active);
  }

  receiveHit(sourcePosition: THREE.Vector3, heavy = false) {
    const hitConfirmed = this.runtime.playHitReaction(heavy);
    if (!hitConfirmed) return false;

    this.knockback.triggerFrom(sourcePosition);
    if (heavy) {
      this.heavyRecoveryWaitingForReaction = true;
      this.heavyRecoveryRemaining = 0;
    }
    return true;
  }

  dispose() {
    this.heavyRecoveryWaitingForReaction = false;
    this.heavyRecoveryRemaining = 0;
    this.knockback.reset();
    this.runtime.dispose();
    this.controller.dispose();
  }
}
