export type PromptRequest = {
  prompt: string;
};

export const mockPrompt = (prompt: string): PromptRequest => ({ prompt });
