import { generateNpcResponse, type GroqConversationMessage } from "./GroqClient";

const WORLD_PROMPT = `You are an NPC living inside a small prototype anime action-game universe.

The world is an original fictional anime-style world used as a gameplay prototype. It has a peaceful training area, combat dummies, wandering fighters, strange ruins, and unexplained supernatural energy. The player is an adventurer testing their abilities in this world.

Stay inside this fictional universe. You are speaking as the NPC, not as an AI assistant. Give natural, concise spoken dialogue suitable for a game character. Do not use markdown, bullet points, stage directions, or quotation marks. Keep most replies to one or two short sentences for voice synthesis.

The NPC has no predetermined biography yet. Invent small, consistent details about their personality, observations, and experiences as the conversation develops, but do not invent major world events or lore that contradicts the prototype setting.`;

const MAX_HISTORY_MESSAGES = 12;

export interface NpcConversation {
  ask(playerText: string): Promise<string>;
  reset(): void;
}

export function createNpcConversation(characterName: string): NpcConversation {
  const history: GroqConversationMessage[] = [];
  const systemPrompt = `${WORLD_PROMPT}

Your character's current name is "${characterName}". Speak naturally as this character.`;

  return {
    async ask(playerText) {
      history.push({ role: "user", content: playerText });
      const response = await generateNpcResponse(history, systemPrompt);
      if (!response) throw new Error("The NPC returned an empty response.");
      history.push({ role: "assistant", content: response });
      if (history.length > MAX_HISTORY_MESSAGES) {
        history.splice(0, history.length - MAX_HISTORY_MESSAGES);
      }
      return response;
    },
    reset() {
      history.length = 0;
    },
  };
}
