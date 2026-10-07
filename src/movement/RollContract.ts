export const rollChainWindowProgress = 0.5;

export function canChainRoll(progress: number | null) {
  return progress !== null && progress >= rollChainWindowProgress;
}
