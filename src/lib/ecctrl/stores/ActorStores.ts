import { createStore, type StoreApi } from "zustand/vanilla";
import { useAnimationStore, type AnimationStoreState } from "./AnimationStore";
import { useButtonStore, type ButtonStoreState } from "./ButtonStore";
import { createCharacterStatus } from "../CharacterStatus";
import type { CharacterStatus } from "../Types";

export interface CharacterStores {
  animationStore: StoreApi<AnimationStoreState>;
  buttonStore: StoreApi<ButtonStoreState>;
  status: CharacterStatus;
}

export const playerCharacterStores: CharacterStores = {
  animationStore: useAnimationStore,
  buttonStore: useButtonStore,
  status: createCharacterStatus(),
};

export function createCharacterStores(): CharacterStores {
  return {
    animationStore: createStore<AnimationStoreState>()((set) => ({
      animationStatus: "IDLE",
      setAnimationStatus: (animationStatus) => set({ animationStatus }),
    })),
    buttonStore: createStore<ButtonStoreState>()((set) => ({
      buttons: {},
      buttonSources: {},
      setButtonActive: (id, active, source = "default") =>
        set((state) => {
          const sources = { ...(state.buttonSources[id] ?? {}) };
          if (active) sources[source] = true;
          else delete sources[source];
          return {
            buttons: { ...state.buttons, [id]: Object.keys(sources).length > 0 },
            buttonSources: { ...state.buttonSources, [id]: sources },
          };
        }),
      resetAllButtons: (source) =>
        set((state) => {
          if (!source) return { buttons: {}, buttonSources: {} };
          const buttons = { ...state.buttons };
          const buttonSources = { ...state.buttonSources };
          for (const id of Object.keys(buttonSources)) {
            delete buttonSources[id][source];
            buttons[id] = Object.keys(buttonSources[id]).length > 0;
          }
          return { buttons, buttonSources };
        }),
    })),
    status: createCharacterStatus(),
  };
}
