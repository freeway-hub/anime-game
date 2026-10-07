const GROQ_API_URL = "https://api.groq.com/openai/v1";
const GROQ_API_KEY =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_GROQ_API_KEY ?? "";

export interface GroqConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function debug(message: string, details?: unknown) {
  window.dispatchEvent(
    new CustomEvent("game-console-log", {
      detail: { level: "info", source: "Groq", message, details },
    })
  );
}

function debugError(message: string, error: unknown) {
  window.dispatchEvent(
    new CustomEvent("game-console-log", {
      detail: {
        level: "error",
        source: "Groq",
        message,
        details: error instanceof Error ? error.message : String(error),
      },
    })
  );
}

async function groqFetch(path: string, init: RequestInit) {
  if (!GROQ_API_KEY) {
    debugError("Groq API key is not configured.", "VITE_GROQ_API_KEY is empty.");
    throw new Error("VITE_GROQ_API_KEY is not configured.");
  }

  debug("Request", path);
  try {
    const response = await fetch(`${GROQ_API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      const body = await response.text();
      debugError(`Groq API ${response.status}`, body || response.statusText);
      throw new Error(`Groq API ${response.status}: ${body || response.statusText}`);
    }
    debug("Response", `${response.status} ${path}`);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Groq API ")) throw error;
    debugError("Groq request failed.", error);
    throw error;
  }
}

export async function transcribeSpeech(audio: Blob) {
  debug("STT upload started.", `${audio.size} bytes`);
  const form = new FormData();
  form.append("file", audio, "npc-question.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  const response = await groqFetch("/audio/transcriptions", { method: "POST", body: form });
  const data = (await response.json()) as { text?: string; language?: string };
  const text = data.text?.trim() ?? "";
  const language = data.language?.trim().toLowerCase() || "en";
  debug("STT completed.", { text: text || "<empty>", language });
  return { text, language };
}

export async function generateNpcResponse(
  messages: readonly GroqConversationMessage[],
  systemPrompt: string
) {
  debug("NPC text generation started.", `${messages.length} conversation messages`);
  const response = await groqFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.8,
      max_completion_tokens: 180,
      reasoning_effort: "low",
    }),
  });
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  debug("NPC response received.", text || "<empty>");
  return text;
}

export async function synthesizeSpeech(text: string, language: string) {
  const normalized = language.trim().toLowerCase();
  const isArabic = normalized === "arabic" || normalized === "ar";
  const model = isArabic ? "canopylabs/orpheus-arabic-saudi" : "canopylabs/orpheus-v1-english";
  const voice = isArabic ? "fahad" : "troy";
  debug("TTS generation started.", { language, model, text });
  const response = await groqFetch("/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: isArabic ? "canopylabs/orpheus-arabic-saudi" : "canopylabs/orpheus-v1-english",
      voice: isArabic ? "fahad" : "troy",
      input: text.slice(0, 200),
      response_format: "wav",
    }),
  });
  const audio = await response.arrayBuffer();
  debug("TTS audio received.", `${audio.byteLength} bytes`);
  return audio;
}
