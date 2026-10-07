const LANGUAGE_CODES: Record<string, string> = {
  english: "en-US",
  portuguese: "pt-BR",
  brazilian: "pt-BR",
  spanish: "es-ES",
  french: "fr-FR",
  german: "de-DE",
  italian: "it-IT",
  japanese: "ja-JP",
  korean: "ko-KR",
  chinese: "zh-CN",
  mandarin: "zh-CN",
  russian: "ru-RU",
  arabic: "ar-SA",
  hindi: "hi-IN",
  dutch: "nl-NL",
  polish: "pl-PL",
  turkish: "tr-TR",
  swedish: "sv-SE",
  norwegian: "nb-NO",
  danish: "da-DK",
  finnish: "fi-FI",
  czech: "cs-CZ",
  ukrainian: "uk-UA",
};

export function toSpeechLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (LANGUAGE_CODES[normalized]) return LANGUAGE_CODES[normalized];
  if (/^[a-z]{2}(?:-[a-z]{2})?$/.test(normalized)) return normalized;
  return "en-US";
}

export function isGroqSpeechLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  return normalized === "english" || normalized === "en" || normalized === "arabic" || normalized === "ar";
}
