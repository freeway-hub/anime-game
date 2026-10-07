import * as THREE from "three/webgpu";
import { transcribeSpeech, synthesizeSpeech } from "./GroqClient";
import { createNpcConversation, type NpcConversation } from "./NpcConversation";
import { createTargetIndicator } from "../ui/TargetIndicator";
import type { Npc } from "../npc/Npc";

const INTERACTION_RANGE = 5;
const MIN_RECORDING_MS = 250;

export interface NpcVoiceInteraction {
  update(): void;
  setInputEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createNpcVoiceInteraction(
  scene: THREE.Scene,
  player: THREE.Object3D,
  npcs: readonly Npc[],
  isTargetLocked: () => boolean,
  setStatus?: (text: string) => void,
  log?: (message: string, details?: unknown) => void
): NpcVoiceInteraction {
  const conversations = new Map<Npc, NpcConversation>();
  const indicators = new Map<Npc, ReturnType<typeof createTargetIndicator>>();
  const audioContext = new AudioContext();
  let microphone: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recordingStartedAt = 0;
  let selectedNpc: Npc | null = null;
  let enabled = true;
  let busy = false;
  let disposed = false;
  let audioSource: AudioBufferSourceNode | null = null;
  const bounds = new THREE.Box3();

  const getConversation = (npc: Npc) => {
    let conversation = conversations.get(npc);
    if (!conversation) {
      conversation = createNpcConversation(npc.name);
      conversations.set(npc, conversation);
    }
    return conversation;
  };

  const getIndicator = (npc: Npc) => {
    let indicator = indicators.get(npc);
    if (!indicator) {
      indicator = createTargetIndicator(scene);
      indicators.set(npc, indicator);
    }
    return indicator;
  };

  const findNearestNpc = () => {
    let nearest: Npc | null = null;
    let nearestDistance = INTERACTION_RANGE * INTERACTION_RANGE;
    for (const npc of npcs) {
      const distance = player.position.distanceToSquared(npc.group.position);
      if (distance <= nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    return nearest;
  };

  const updateIndicatorPosition = (npc: Npc) => {
    bounds.setFromObject(npc.group);
    const position = npc.group.position.clone();
    position.y = bounds.max.y + 0.35;
    getIndicator(npc).setPosition(position);
  };

  const stopAudio = () => {
    if (audioSource) {
      audioSource.stop();
      audioSource.disconnect();
      audioSource = null;
    }
    for (const npc of indicators.keys()) {
      indicators.get(npc)?.setVisible(false);
    }
  };

  const playSpeech = async (npc: Npc, audioData: ArrayBuffer) => {
    await audioContext.resume();
    const buffer = await audioContext.decodeAudioData(audioData.slice(0));
    stopAudio();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    audioSource = source;
    const indicator = getIndicator(npc);
    updateIndicatorPosition(npc);
    indicator.setVisible(true);
    source.onended = () => {
      if (audioSource !== source) return;
      audioSource = null;
      indicator.setVisible(false);
    };
    source.start();
  };

  const processRecording = async (audio: Blob, npc: Npc) => {
    busy = true;
    setStatus?.("LISTENING COMPLETE");
    try {
      const playerText = await transcribeSpeech(audio);
      log?.("Player transcription", playerText);
      if (!playerText) {
        setStatus?.("COULDN'T HEAR YOU");
        return;
      }
      setStatus?.("NPC THINKING");
      const response = await getConversation(npc).ask(playerText);
      log?.("NPC response generated", response);
      setStatus?.("NPC SPEAKING");
      await playSpeech(npc, await synthesizeSpeech(response));
      log?.("NPC audio playback started", npc.name);
      setStatus?.("");
    } catch (error) {
      log?.("NPC voice interaction failed", error instanceof Error ? error.message : String(error));
      console.error("NPC voice interaction failed.", error);
      setStatus?.("NPC VOICE ERROR");
      stopAudio();
    } finally {
      busy = false;
    }
  };

  const stopRecording = () => {
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
    recorder = null;
  };

  const startRecording = async () => {
    if (!enabled || busy || disposed || isTargetLocked()) return;
    const npc = findNearestNpc();
    if (!npc) return;
    selectedNpc = npc;
    chunks = [];
    await audioContext.resume();
    microphone ??= await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    recorder = new MediaRecorder(microphone, { mimeType });
    recordingStartedAt = performance.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const duration = performance.now() - recordingStartedAt;
      const audio = new Blob(chunks, { type: mimeType });
      if (selectedNpc && duration >= MIN_RECORDING_MS && audio.size > 0) {
        void processRecording(audio, selectedNpc);
      } else {
        setStatus?.("");
      }
      selectedNpc = null;
      chunks = [];
    };
    recorder.start();
    log?.("Microphone recording started", npc.name);
    setStatus?.("LISTENING");
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.code !== "KeyV") return;
    void startRecording().catch((error) => {
      console.error("Could not start NPC voice recording.", error);
      setStatus?.("MICROPHONE ERROR");
      stopRecording();
    });
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "KeyV") stopRecording();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    update() {
      if (disposed) return;
      for (const npc of npcs) {
        if (indicators.has(npc)) updateIndicatorPosition(npc);
      }
    },
    setInputEnabled(value) {
      enabled = value;
      if (!value) {
        stopRecording();
        microphone?.getTracks().forEach((track) => track.stop());
        microphone = null;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopRecording();
      microphone?.getTracks().forEach((track) => track.stop());
      microphone = null;
      stopAudio();
      for (const indicator of indicators.values()) indicator.dispose();
      indicators.clear();
      void audioContext.close();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
