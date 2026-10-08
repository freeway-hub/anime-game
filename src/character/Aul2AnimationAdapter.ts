import * as THREE from "three";

const boneNameMap: Record<string, string> = {
  pelvis: "DEF-hips",
  spine_01: "DEF-spine001",
  spine_02: "DEF-spine002",
  spine_03: "DEF-spine003",
  neck_01: "DEF-neck",
  Head: "DEF-head",
  clavicle_l: "DEF-shoulderL",
  upperarm_l: "DEF-upper_armL",
  lowerarm_l: "DEF-forearmL",
  hand_l: "DEF-handL",
  thigh_l: "DEF-thighL",
  calf_l: "DEF-shinL",
  foot_l: "DEF-footL",
  ball_l: "DEF-toeL",
  clavicle_r: "DEF-shoulderR",
  upperarm_r: "DEF-upper_armR",
  lowerarm_r: "DEF-forearmR",
  hand_r: "DEF-handR",
  thigh_r: "DEF-thighR",
  calf_r: "DEF-shinR",
  foot_r: "DEF-footR",
  ball_r: "DEF-toeR",
  thumb_01_l: "DEF-thumb01L",
  thumb_02_l: "DEF-thumb02L",
  thumb_03_l: "DEF-thumb03L",
  index_01_l: "DEF-f_index01L",
  index_02_l: "DEF-f_index02L",
  index_03_l: "DEF-f_index03L",
  middle_01_l: "DEF-f_middle01L",
  middle_02_l: "DEF-f_middle02L",
  middle_03_l: "DEF-f_middle03L",
  ring_01_l: "DEF-f_ring01L",
  ring_02_l: "DEF-f_ring02L",
  ring_03_l: "DEF-f_ring03L",
  pinky_01_l: "DEF-f_pinky01L",
  pinky_02_l: "DEF-f_pinky02L",
  pinky_03_l: "DEF-f_pinky03L",
  thumb_01_r: "DEF-thumb01R",
  thumb_02_r: "DEF-thumb02R",
  thumb_03_r: "DEF-thumb03R",
  index_01_r: "DEF-f_index01R",
  index_02_r: "DEF-f_index02R",
  index_03_r: "DEF-f_index03R",
  middle_01_r: "DEF-f_middle01R",
  middle_02_r: "DEF-f_middle02R",
  middle_03_r: "DEF-f_middle03R",
  ring_01_r: "DEF-f_ring01R",
  ring_02_r: "DEF-f_ring02R",
  ring_03_r: "DEF-f_ring03R",
  pinky_01_r: "DEF-f_pinky01R",
  pinky_02_r: "DEF-f_pinky02R",
  pinky_03_r: "DEF-f_pinky03R",
};

export function adaptAul2AnimationClips(clips: THREE.AnimationClip[]) {
  return clips.map((clip) => {
    const tracks = clip.tracks.map((track) => {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      const mappedNodeName = parsed.nodeName
        ? boneNameMap[parsed.nodeName]
        : undefined;
      if (!mappedNodeName) return track.clone();
      return cloneTrackWithNodeName(track, mappedNodeName);
    });
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });
}

function cloneTrackWithNodeName(
  track: THREE.KeyframeTrack,
  nodeName: string
) {
  const parsed = THREE.PropertyBinding.parseTrackName(track.name);
  const suffix = track.name.slice(parsed.nodeName.length);
  const cloned = track.clone();
  cloned.name = `${nodeName}${suffix}`;
  return cloned;
}
