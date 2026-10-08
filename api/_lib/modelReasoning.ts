/** null means omit reasoning controls; it does not mean send "none". */
export type ReasoningEffort = string | null;

// Defaults also cover direct adapter calls outside the chat fallback loop.
export const POLLINATIONS_REASONING = {
  'openai/gpt-6-luna': 'low',
  'openai/gpt-5.6-luna': 'none',
  'openai/gpt-oss-20b': 'low',
  'nvidia/nemotron-3.5-lightning': 'none',
  'openai/gpt-6.1-sol': 'low',
  'openai/gpt-6-sol': 'low',
  'z-ai/glm-5.3': 'low',
  'x-ai/grok-4.6': null,
} as const satisfies Record<string, ReasoningEffort>;

export function pollinationsReasoning(model: string, effort?: ReasoningEffort): { reasoning_effort?: string } {
  const resolved = effort === undefined
    ? (POLLINATIONS_REASONING as Readonly<Record<string, ReasoningEffort>>)[model]
    : effort;
  return typeof resolved === 'string' ? { reasoning_effort: resolved } : {};
}
