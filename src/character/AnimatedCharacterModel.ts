import * as THREE from "three";
import {
  MToonMaterialLoaderPlugin,
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
} from "@pixiv/three-vrm";
import { MToonNodeMaterial } from "@pixiv/three-vrm/nodes";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  punchButtonId,
  punchMinIntervalSeconds,
  shouldStartPunchAction,
} from "./ActionContract";
import {
  hitReactionActionNames,
  idleTalkingActionName,
  punchActionName,
  punchActionNames,
  rollActionName,
  requiredAnimationClipNames,
  statusToActionMap,
} from "./AnimationContract";
import { canChainRoll } from "../movement/RollContract";
import {
  applyCharacterShadowSettings,
  type CharacterShadowSettings,
} from "./CharacterShadowSettings";
import { CharacterFootIK } from "./FootIK";
import { retargetHumanoidAnimationClips } from "./VrmAnimation";
import { adaptAul2AnimationClips } from "./Aul2AnimationAdapter";
import { getVrmMetaVersion, isVrm0 } from "./VrmMeta";
import { enableCharacterAoMaskLayer } from "../scene/RenderLayers";
import { waitForNextFrame } from "../utils/FrameYield";
import {
  type CharacterAnimationStatus,
} from "../lib/ecctrl/index";
import { playerCharacterStores, type CharacterStores } from "../lib/ecctrl/stores/ActorStores";

const aul1AnimationLibraryUrl = new URL(
  "../assets/AnimationLibraryAul1.glb",
  import.meta.url
).href;
const aul2AnimationLibraryUrl = new URL(
  "../assets/AnimationLibraryAul2.glb",
  import.meta.url
).href;
export const playerDefaultVrm = {
  name: "Kai.vrm",
  url: new URL("../assets/Kai.vrm", import.meta.url).href,
} as const;

export const sampleVrms = [
  { name: "sample.vrm", url: new URL("../assets/sample.vrm", import.meta.url).href },
  { name: "sample2.vrm", url: new URL("../assets/sample2.vrm", import.meta.url).href },
] as const;
let animationLibraryPromise: ReturnType<typeof loadAnimationLibraries> | null = null;

const oneShotActions: ReadonlySet<string> = new Set([
  statusToActionMap.JUMP_START,
  statusToActionMap.JUMP_LAND,
  ...punchActionNames,
  ...hitReactionActionNames,
  rollActionName,
]);

export class AnimatedCharacterModel {
  readonly group = new THREE.Group();
  readonly sourceName: string;
  readonly vrmVersionLabel: string;
  private readonly vrm: VRM;
  private readonly mixer: THREE.AnimationMixer;
  private readonly footIK: CharacterFootIK;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly characterStores: CharacterStores;
  private readonly unsubscribe: () => void;
  private previousActionName: string = getActionName("IDLE");
  private nextPunchTime = 0;
  private nextPunchIndex = 0;
  private nextHitReactionIndex = 0;
  private canPlayNext = true;
  private idleTalking = false;
  private disposed = false;

  constructor(
    vrm: VRM,
    animationGltf: { animations: THREE.AnimationClip[] },
    sourceName: string,
    characterStores: CharacterStores = playerCharacterStores
  ) {
    this.vrm = vrm;
    this.sourceName = sourceName;
    this.vrmVersionLabel = getVrmVersionLabel(vrm);
    this.characterStores = characterStores;
    this.group.name = "AnimatedCharacterModel";
    this.group.position.set(0, -1.1, 0);
    this.group.add(vrm.scene);
    this.prepareModel();

    this.mixer = new THREE.AnimationMixer(this.group);
    const clips = retargetHumanoidAnimationClips(
      animationGltf.animations,
      vrm,
      requiredAnimationClipNames
    );
    const punchClip = clips.find((clip) => clip.name === punchActionName);
    if (!punchClip) {
      throw new Error(`Active animation libraries are missing clip: ${punchActionName}`);
    }
    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.assertRequiredActions();
    this.footIK = new CharacterFootIK(vrm, this.group, this.characterStores.status);
    this.unsubscribe = this.bindAnimationState();
  }

  static async load(characterStores: CharacterStores = playerCharacterStores) {
    return AnimatedCharacterModel.loadFromUrl(
      playerDefaultVrm.url,
      playerDefaultVrm.name,
      characterStores
    );
  }

  static async loadFromFile(file: File, characterStores: CharacterStores = playerCharacterStores) {
    const url = URL.createObjectURL(file);
    try {
      return await AnimatedCharacterModel.loadFromUrl(url, file.name, characterStores);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  static async loadFromUrl(
    url: string,
    sourceName: string,
    characterStores: CharacterStores = playerCharacterStores
  ) {
    let vrm: VRM | null = null;
    try {
      const [vrmResult, animationResult] = await Promise.allSettled([
        loadVrm(url),
        loadAnimationLibrary(),
      ]);
      if (vrmResult.status === "fulfilled") vrm = vrmResult.value;
      if (vrmResult.status === "rejected") throw vrmResult.reason;
      if (animationResult.status === "rejected") throw animationResult.reason;
      const model = new AnimatedCharacterModel(
        vrmResult.value,
        animationResult.value,
        sourceName,
        characterStores
      );
      vrm = null;
      return model;
    } catch (error) {
      if (vrm) VRMUtils.deepDispose(vrm.scene);
      throw error;
    }
  }

  update(delta: number) {
    this.mixer.update(delta);
    this.vrm.update(delta);
    this.footIK.update(delta);
  }

  setIdleTalking(active: boolean) {
    if (this.idleTalking === active) return;
    this.idleTalking = active;
    if (active) {
      const previousActionName = this.previousActionName;
      this.playAction(idleTalkingActionName, previousActionName);
      this.previousActionName = idleTalkingActionName;
      return;
    }
    this.canPlayNext = true;
    this.playStatus(this.characterStores.animationStore.getState().animationStatus);
  }

  setMouthOpen(value: number) {
    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) return;
    const amount = THREE.MathUtils.clamp(value, 0, 1);
    try {
      expressionManager.setValue("aa", amount);
    } catch {
      // Some VRM avatars do not expose the standard "aa" preset.
    }
  }

  getPunchProgress() {
    if (!isPunchActionName(this.previousActionName) || this.canPlayNext) return null;
    const action = this.actions.get(this.previousActionName);
    if (!action) return null;
    return Math.min(action.time / action.getClip().duration, 1);
  }

  getRollProgress() {
    if (this.previousActionName !== rollActionName || this.canPlayNext) return null;
    const action = this.actions.get(rollActionName);
    if (!action) return null;
    return Math.min(action.time / action.getClip().duration, 1);
  }

  playRoll() {
    if (!this.characterStores.status.isOnGround) return false;

    const rollPlaying = this.previousActionName === rollActionName && !this.canPlayNext;
    if (!rollPlaying && !this.canPlayNext) return false;
    if (rollPlaying && !canChainRoll(this.getRollProgress())) return false;

    this.playAction(rollActionName, this.previousActionName);
    this.previousActionName = rollActionName;
    return true;
  }

  playHitReaction() {
    if (!this.characterStores.status.isOnGround) return false;
    const reactionName = hitReactionActionNames[this.nextHitReactionIndex];
    this.nextHitReactionIndex =
      (this.nextHitReactionIndex + 1) % hitReactionActionNames.length;
    const previousActionName = this.previousActionName;
    const crossFadeFrom = isPunchActionName(previousActionName)
      ? getActionName(this.characterStores.animationStore.getState().animationStatus)
      : previousActionName;
    this.playAction(reactionName, crossFadeFrom);
    this.previousActionName = reactionName;
    return true;
  }

  setShadowSettings(settings: CharacterShadowSettings) {
    applyCharacterShadowSettings(this.vrm.scene, settings);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.mixer.removeEventListener("finished", this.handleFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.group);
    VRMUtils.deepDispose(this.vrm.scene);
    this.group.clear();
  }

  private prepareModel() {
    this.vrm.scene.traverse((object) => {
      enableCharacterAoMaskLayer(object);
      if (object instanceof THREE.SkinnedMesh) {
        object.frustumCulled = false;
      }
    });
  }

  private playInitialIdle() {
    const idleAction = this.actions.get(this.previousActionName);
    idleAction?.reset().play();
  }

  private bindAnimationState() {
    this.mixer.addEventListener("finished", this.handleFinished);
    const unsubscribeAnimation = this.characterStores.animationStore.subscribe((state) => {
      this.playStatus(state.animationStatus);
    });
    const unsubscribeButtons = this.characterStores.buttonStore.subscribe((state, previousState) => {
      if (state.buttons[punchButtonId] && !previousState.buttons[punchButtonId]) {
        this.playPunch();
      }
    });
    this.playInitialIdle();
    this.playStatus(this.characterStores.animationStore.getState().animationStatus);
    return () => {
      unsubscribeAnimation();
      unsubscribeButtons();
    };
  }

  private playStatus(status: CharacterAnimationStatus) {
    if (this.idleTalking) return;
    const nextActionName = getActionName(status);
    const nextAction = this.actions.get(nextActionName);
    if (!nextAction) throw new Error(`Missing animation action: ${nextActionName}`);

    const previousActionName = this.previousActionName;
    if (nextActionName !== previousActionName && this.canPlayNext) {
      this.playAction(nextActionName, previousActionName);
      this.previousActionName = nextActionName;
    }

    if (
      !this.canPlayNext &&
      previousActionName === getActionName("JUMP_START") &&
      status !== "JUMP_IDLE" &&
      status !== "JUMP_START"
    ) {
      this.allowNextAction();
    }

    if (
      !this.canPlayNext &&
      previousActionName === getActionName("JUMP_LAND") &&
      status !== "IDLE" &&
      status !== "JUMP_LAND"
    ) {
      this.allowNextAction();
    }
  }

  private playAction(nextActionName: string, previousActionName: string) {
    const nextAction = this.actions.get(nextActionName);
    const previousAction = this.actions.get(previousActionName);
    if (!nextAction) throw new Error(`Missing animation action: ${nextActionName}`);

    nextAction.reset();
    if (oneShotActions.has(nextActionName)) {
      this.canPlayNext = false;
      nextAction.timeScale = hitReactionActionNames.includes(
        nextActionName as (typeof hitReactionActionNames)[number]
      )
        ? 1
        : nextActionName === rollActionName
          ? 1
          : 1.6;
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      if (previousAction && previousAction !== nextAction) nextAction.crossFadeFrom(previousAction, 0.1, false);
      nextAction.play();
      return;
    }

    this.canPlayNext = true;
    nextAction.timeScale = 1;
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = false;
    if (previousAction) nextAction.crossFadeFrom(previousAction, 0.2, false);
    nextAction.play();
  }

  private playPunch() {
    if (!this.characterStores.status.isOnGround) return;

    const currentTime = this.mixer.time;
    const punchPlaying = isPunchActionName(this.previousActionName) && !this.canPlayNext;
    const punchProgress = punchPlaying ? this.getPunchProgress() : null;
    if (
      !shouldStartPunchAction(
        currentTime,
        this.nextPunchTime,
        punchPlaying,
        punchProgress
      )
    ) {
      return;
    }

    this.nextPunchTime = currentTime + punchMinIntervalSeconds;
    this.setAttackState(true);

    const punchName = punchActionNames[this.nextPunchIndex];
    const previousActionName = this.previousActionName;

    this.playAction(punchName, previousActionName);
    this.previousActionName = punchName;
    this.nextPunchIndex = (this.nextPunchIndex + 1) % punchActionNames.length;
  }

  private setAttackState(attacking: boolean) {
    this.characterStores.status.isAttacking = attacking;
    if (attacking && this.characterStores.status.isOnGround) {
      this.characterStores.status.linvel.x = 0;
      this.characterStores.status.linvel.z = 0;
    }
  }

  private readonly handleFinished = (event: { action: THREE.AnimationAction }) => {
    const actionName = event.action.getClip().name;
    if (
      !this.canPlayNext &&
      actionName === this.previousActionName &&
      oneShotActions.has(actionName)
    ) {
      this.allowNextAction();
      if (isPunchActionName(actionName)) this.setAttackState(false);
    }
  };

  private allowNextAction() {
    this.canPlayNext = true;
    this.playStatus(this.characterStores.animationStore.getState().animationStatus);
  }

  private assertRequiredActions() {
    for (const clipName of requiredAnimationClipNames) {
      if (!this.actions.has(clipName)) {
        throw new Error(`AnimationLibrary.glb is missing clip: ${clipName}`);
      }
    }
  }
}

function isPunchActionName(actionName: string) {
  return punchActionNames.includes(actionName as (typeof punchActionNames)[number]);
}

function getActionName(status: CharacterAnimationStatus) {
  return statusToActionMap[status];
}

function loadAnimationLibrary() {
  animationLibraryPromise ??= loadAnimationLibraries();
  return animationLibraryPromise;
}

async function loadAnimationLibraries() {
  const [aul1, aul2] = await Promise.all([
    loadGltfFromUrl(aul1AnimationLibraryUrl, new GLTFLoader()),
    loadGltfFromUrl(aul2AnimationLibraryUrl, new GLTFLoader()),
  ]);

  return {
    animations: [
      ...aul1.animations,
      ...adaptAul2AnimationClips(aul2.animations),
    ],
  };
}

async function loadVrm(url: string) {
  const loader = new GLTFLoader();
  loader.register((parser) => {
    const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
      materialType: MToonNodeMaterial,
    });
    return new VRMLoaderPlugin(parser, { mtoonMaterialPlugin });
  });
  const gltf = await loadGltfFromUrl(url, loader);
  return finishLoadVrm(gltf);
}

async function loadGltfFromUrl(url: string, loader: GLTFLoader) {
  const buffer = await fetchArrayBuffer(url);
  await waitForNextFrame();
  return loader.parseAsync(buffer, getResourcePath(url));
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch GLTF asset: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

function getResourcePath(url: string) {
  try {
    return new URL("./", url).href;
  } catch {
    return "";
  }
}

function finishLoadVrm(gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>) {
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error("Character VRM asset is missing VRM metadata.");
  if (isVrm0(vrm)) VRMUtils.rotateVRM0(vrm);
  return vrm;
}

function getVrmVersionLabel(vrm: VRM) {
  return getVrmMetaVersion(vrm) === "0" ? "VRM0" : "VRM1.0";
}
