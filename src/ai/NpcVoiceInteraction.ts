import * as THREE from "three/webgpu";
import { transcribeSpeech, synthesizeSpeech } from "./GroqClient";
import { createNpcConversation, type NpcConversation } from "./NpcConversation";
import { toSpeechLanguage } from "./NpcLanguage";
import { createSpeakerIndicator } from "../ui/SpeakerIndicator";
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
  camera: THREE.Camera,
  player: THREE.Object3D,
  npcs: readonly Npc[],
  isTargetLocked: () => boolean,
  setStatus?: (text: string) => void,
  log?: (message: string, details?: unknown) => void,
  setPlayerMouthOpen?: (value: number) => void
): NpcVoiceInteraction {
  const conversations = new Map<Npc, NpcConversation>();
  const indicators = new Map<Npc, ReturnType<typeof createSpeakerIndicator>>();
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const audioSamples = new Uint8Array(analyser.fftSize);
  const microphoneAnalyser = audioContext.createAnalyser();
  microphoneAnalyser.fftSize = 256;
  const microphoneSamples = new Uint8Array(microphoneAnalyser.fftSize);
  analyser.connect(audioContext.destination);
  let mouthOpen = 0;
  let microphone: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recordingStartedAt = 0;
  let selectedNpc: Npc | null = null;
  let enabled = true;
  let busy = false;
  let disposed = false;
  let audioSource: AudioBufferSourceNode | null = null;
  let speakingNpc: Npc | null = null;
  let browserSpeechActive = false;
  let speechMouthTarget = 0;
  let lastSpeechMouthUpdate = 0;
  let recordingPlayerMouthOpen = 0;
  let recordingPlayerMouthTarget = 0;
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
      indicator = createSpeakerIndicator(scene);
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
    window.speechSynthesis.cancel();
    browserSpeechActive = false;
    if (audioSource) {
      audioSource.stop();
      audioSource.disconnect();
      audioSource = null;
    }
    mouthOpen = 0;
    speechMouthTarget = 0;
    speakingNpc?.setMouthOpen(0);
    speakingNpc?.setIdleTalking(false);
    speakingNpc = null;
    for (const npc of indicators.keys()) {
      indicators.get(npc)?.setVisible(false);
    }
  };

  const playSpeech = async (
    npc: Npc,
    text: string,
    audioData: ArrayBuffer | null,
    language: string
  ) => {
    stopAudio();
    if (!audioData) {
      const indicator = getIndicator(npc);
      updateIndicatorPosition(npc);
      indicator.setVisible(true);
      speakingNpc = npc;
      npc.setIdleTalking(true);
      browserSpeechActive = true;
      speechMouthTarget = 0.25;
      lastSpeechMouthUpdate = performance.now();
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = toSpeechLanguage(language);
        const voice = window.speechSynthesis
          .getVoices()
          .find((candidate) => candidate.lang.toLowerCase().startsWith(utterance.lang.toLowerCase().split("-")[0]));
        if (voice) utterance.voice = voice;
        utterance.onend = () => {
          browserSpeechActive = false;
          speakingNpc = null;
          speechMouthTarget = 0;
          npc.setMouthOpen(0);
          npc.setIdleTalking(false);
          indicator.setVisible(false);
          resolve();
        };
        utterance.onerror = (event) => {
          browserSpeechActive = false;
          speakingNpc = null;
          npc.setMouthOpen(0);
          indicator.setVisible(false);
          reject(new Error(`System speech synthesis failed: ${event.error}`));
        };
        window.speechSynthesis.speak(utterance);
      });
      return;
    }

    await audioContext.resume();
    const buffer = await audioContext.decodeAudioData(audioData.slice(0));
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    audioSource = source;
    const indicator = getIndicator(npc);
    updateIndicatorPosition(npc);
    indicator.setVisible(true);
    speakingNpc = npc;
    npc.setIdleTalking(true);
    speechMouthTarget = 0.25;
    lastSpeechMouthUpdate = performance.now();
    mouthOpen = 0;
    source.onended = () => {
      if (audioSource !== source) return;
      audioSource = null;
      mouthOpen = 0;
      speechMouthTarget = 0;
      npc.setMouthOpen(0);
      npc.setIdleTalking(false);
      speakingNpc = null;
      indicator.setVisible(false);
    };
    source.start();
  };

  const processRecording = async (audio: Blob, npc: Npc) => {
    busy = true;
    setStatus?.("LISTENING COMPLETE");
    try {
      const transcription = await transcribeSpeech(audio);
      log?.("Player transcription", transcription);
      if (!transcription.text) {
        setStatus?.("COULDN'T HEAR YOU");
        return;
      }
      setStatus?.("NPC THINKING");
      const response = await getConversation(npc).ask(transcription.text, transcription.language);
      log?.("NPC response generated", { language: transcription.language, response });
      setStatus?.("NPC SPEAKING");
      await playSpeech(
        npc,
        response,
        await synthesizeSpeech(response, transcription.language),
        transcription.language
      );
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
    const microphoneSource = audioContext.createMediaStreamSource(microphone);
    microphoneSource.connect(microphoneAnalyser);
    recorder = new MediaRecorder(microphone, { mimeType });
    recordingStartedAt = performance.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      microphoneSource.disconnect();
      recordingPlayerMouthTarget = 0;
      recordingPlayerMouthOpen = 0;
      setPlayerMouthOpen?.(0);
      player.setIdleTalking(false);
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
    player.setIdleTalking(true);
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
      if (recorder?.state === "recording") {
        microphoneAnalyser.getByteTimeDomainData(microphoneSamples);
        let sum = 0;
        for (const sample of microphoneSamples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / microphoneSamples.length);
        recordingPlayerMouthTarget = THREE.MathUtils.clamp((rms - 0.008) * 12, 0, 1);
        recordingPlayerMouthOpen = THREE.MathUtils.lerp(recordingPlayerMouthOpen, recordingPlayerMouthTarget, 0.45);
        setPlayerMouthOpen?.(recordingPlayerMouthOpen);
      } else if (audioSource && speakingNpc) {
        analyser.getByteTimeDomainData(audioSamples);
        let sum = 0;
        for (const sample of audioSamples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / audioSamples.length);
        const audioTarget = THREE.MathUtils.clamp((rms - 0.008) * 10, 0, 1);
        const now = performance.now();
        if (now - lastSpeechMouthUpdate >= 75) {
          lastSpeechMouthUpdate = now;
          speechMouthTarget = audioTarget > 0.03
            ? audioTarget
            : 0.18 + Math.random() * 0.52;
        }
        mouthOpen = THREE.MathUtils.lerp(mouthOpen, speechMouthTarget, 0.42);
        speakingNpc.setMouthOpen(mouthOpen);
      } else if (browserSpeechActive && speakingNpc) {
        const now = performance.now();
        if (now - lastSpeechMouthUpdate >= 90) {
          lastSpeechMouthUpdate = now;
          speechMouthTarget = 0.15 + Math.random() * 0.5;
        }
        mouthOpen = THREE.MathUtils.lerp(mouthOpen, speechMouthTarget, 0.32);
        speakingNpc.setMouthOpen(mouthOpen);
      } else if (mouthOpen > 0.001) {
        mouthOpen = THREE.MathUtils.lerp(mouthOpen, 0, 0.25);
        speakingNpc?.setMouthOpen(mouthOpen);
      }
      for (const npc of npcs) {
        const indicator = indicators.get(npc);
        if (!indicator) continue;
        updateIndicatorPosition(npc);
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
