import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { test } from "vitest";
import { requiredAnimationClipNames } from "../src/character/AnimationContract";
import {
  restPoseClipName,
  requiredRetargetHumanBoneNames,
  sourceBoneToHumanBone,
  vrm0HumanBoneAliases,
} from "../src/character/VrmAnimationContract";

interface GltfJson {
  animations: GltfAnimation[];
  nodes: GltfNode[];
  extensionsUsed?: string[];
  extensions?: {
    VRM?: {
      humanoid?: {
        humanBones?: Vrm0HumanBone[];
      };
    };
    VRMC_vrm?: {
      specVersion?: string;
      humanoid?: {
        humanBones?: Record<string, unknown>;
      };
    };
  };
}

interface GltfAnimation {
  name: string;
  channels: GltfAnimationChannel[];
}

interface GltfAnimationChannel {
  target: {
    node: number;
    path: string;
  };
}

interface GltfNode {
  name: string;
}

interface Vrm0HumanBone {
  bone: string;
}

const requiredNodes = ["root"];
const vrmCharacterAssets = ["sample.vrm", "sample2.vrm"];
const vrmCharacterVersions = new Map([
  ["sample.vrm", "0"],
  ["sample2.vrm", "1.0"],
]);
const aul1AnimationLibraryJsonPromise = readGlbJson(
  "src/assets/AnimationLibraryAul1.glb"
);
const aul2AnimationLibraryJsonPromise = readGlbJson(
  "src/assets/AnimationLibraryAul2.glb"
);
const aul2RequiredClipNames = ["Melee_Hook", "OverhandThrow"];

const aul1RequiredClipNames = [
  "Idle_Loop",
  "Walk_Loop",
  "Jog_Fwd_Loop",
  "Roll",
  "Idle_Talking_Loop",
  "Punch_Jab",
  "Punch_Cross",
  "Hit_Chest",
  "Hit_Head",
  "Jump_Start",
  "Jump_Loop",
  "Jump_Land",
];

test("animation libraries contain required clips", async () => {
  const [aul1, aul2] = await Promise.all([
    aul1AnimationLibraryJsonPromise,
    aul2AnimationLibraryJsonPromise,
  ]);
  const aul1ClipNames = new Set(aul1.animations.map((clip) => clip.name));
  const aul2ClipNames = new Set(aul2.animations.map((clip) => clip.name));

  for (const clipName of aul1RequiredClipNames) {
    assert.equal(aul1ClipNames.has(clipName), true, `missing AUL1 clip: ${clipName}`);
  }
  for (const clipName of requiredAnimationClipNames.filter((name) => !aul2RequiredClipNames.includes(name))) {
    assert.equal(
      aul1ClipNames.has(clipName),
      true,
      `missing AUL1 clip: ${clipName}`
    );
  }
  for (const clipName of aul2RequiredClipNames) {
    assert.equal(
      aul2ClipNames.has(clipName),
      true,
      `missing AUL2 clip: ${clipName}`
    );
  }
  assert.equal(new Set(aul1.nodes.map((node) => node.name)).has("root"), true);
  assert.equal(new Set(aul2.nodes.map((node) => node.name)).has("root"), true);
});

test("AUL1 fallback library contains source humanoid quaternion tracks", async () => {
  const json = await aul1AnimationLibraryJsonPromise;
  const sourceBoneNames = Object.keys(sourceBoneToHumanBone);
  const clipNames = [...aul1RequiredClipNames, restPoseClipName];

  for (const clipName of clipNames) {
    const trackNames = getAnimationTrackNames(json, clipName);
    assert.equal(
      trackNames.has("root.quaternion"),
      true,
      `missing ${clipName} track: root.quaternion`
    );
    for (const sourceBoneName of sourceBoneNames) {
      assert.equal(
        trackNames.has(`${sourceBoneName}.quaternion`),
        true,
        `missing ${clipName} track: ${sourceBoneName}.quaternion`
      );
    }
  }
});

test("bundled VRM avatars contain required humanoid bones", async () => {
  for (const assetName of vrmCharacterAssets) {
    const json = parseGlbJson(await readFile(`src/assets/${assetName}`));
    const humanBones = getVrmHumanBones(json);

    assert.equal(
      json.extensionsUsed?.some((name) => name.toLowerCase().includes("vrm")),
      true,
      `${assetName} is missing VRM extension`
    );
    assert.equal(
      getVrmVersion(json),
      vrmCharacterVersions.get(assetName),
      `${assetName} has unexpected VRM version`
    );
    for (const boneName of requiredRetargetHumanBoneNames) {
      assert.equal(
        humanBones.has(boneName),
        true,
        `${assetName} missing bone: ${boneName}`
      );
    }
  }
});

function parseGlbJson(bytes: Buffer): GltfJson {
  const magic = bytes.readUInt32LE(0);
  assert.equal(magic, 0x46546c67);
  let offset = 12;
  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(
        bytes.subarray(offset, offset + chunkLength).toString()
      ) as GltfJson;
    }
    offset += chunkLength;
  }
  throw new Error("Missing GLB JSON chunk.");
}

async function readGlbJson(path: string) {
  return parseGlbJson(await readFile(path));
}

function getAnimationTrackNames(json: GltfJson, clipName: string) {
  const animation = json.animations.find((item) => item.name === clipName);
  assert.ok(animation, `missing clip: ${clipName}`);
  return new Set(
    animation.channels.map((channel) => {
      const nodeName = THREE.PropertyBinding.sanitizeNodeName(
        json.nodes[channel.target.node].name
      );
      return `${nodeName}.${getThreeTrackPath(channel.target.path)}`;
    })
  );
}

function getThreeTrackPath(gltfPath: string) {
  if (gltfPath === "rotation") return "quaternion";
  if (gltfPath === "translation") return "position";
  return gltfPath;
}

function getVrmHumanBones(json: GltfJson) {
  const vrm1Bones = json.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (vrm1Bones) return new Set(Object.keys(vrm1Bones));

  return new Set(
    json.extensions?.VRM?.humanoid?.humanBones?.map(
      (bone) => vrm0HumanBoneAliases[bone.bone] ?? bone.bone
    ) ?? []
  );
}

function getVrmVersion(json: GltfJson) {
  if (json.extensions?.VRM) return "0";
  return json.extensions?.VRMC_vrm?.specVersion;
}
