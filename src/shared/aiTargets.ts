/** Fixed destinations: opening an AI never submits a prompt or runs a command. */
export const AI_TARGETS = {
  codex: { name: 'Codex', url: 'codex://launch' },
  cc: { name: 'Claude Code (CC)', url: 'claude://code' },
  deepseek: { name: 'DeepSeek (DS)', url: 'https://chat.deepseek.com/' },
} as const;

export type AiTarget = keyof typeof AI_TARGETS;
export const isAiTarget = (value: unknown): value is AiTarget =>
  typeof value === 'string' && Object.hasOwn(AI_TARGETS, value);
