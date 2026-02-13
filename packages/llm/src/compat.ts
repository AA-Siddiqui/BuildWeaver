/** Backwards-compatible exports from the original stub. */
export type PromptRequest = {
  prompt: string;
};

export const mockPrompt = (prompt: string): PromptRequest => ({ prompt });
