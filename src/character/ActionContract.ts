export const punchButtonId = "punch";
export const heavyAttackButtonId = "heavy-attack";
export const punchMinIntervalSeconds = 0.3;
export const punchChainWindowProgress = 0.5;

export function shouldStartPunchAction(
  currentTime: number,
  nextAllowedTime: number,
  punchPlaying: boolean,
  punchProgress: number | null
) {
  if (!punchPlaying) return currentTime >= nextAllowedTime;
  return (
    punchProgress !== null &&
    punchProgress >= punchChainWindowProgress &&
    currentTime >= nextAllowedTime
  );
}
