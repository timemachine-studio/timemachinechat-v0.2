/** Primary and fallback model settings shared by chat, Notes and PRO jobs. */
import type { VisionCapability } from './providerTypes.js';
import { POLLINATIONS_REASONING as reasoning } from './modelReasoning.js';

export interface PersonaRoute extends VisionCapability {
  provider: string;
  model: string;
  reasoningEffort?: string | null;
  fallbacks: ReadonlyArray<{ provider: string; model: string; reasoningEffort?: string | null } & VisionCapability>;
}

// Girlie shares Air's models and reasoning settings.
export const AIR_ROUTE = {
  provider: 'pollinations',
  model: 'openai/gpt-6-luna',
  reasoningEffort: reasoning['openai/gpt-6-luna'],
  vision: 'native',
  fallbacks: [
    { provider: 'pollinations', model: 'openai/gpt-5.6-luna', reasoningEffort: reasoning['openai/gpt-5.6-luna'], vision: 'native' },
    { provider: 'nvidia', model: 'nvidia/nemotron-3.5-lightning-30b-a3b', reasoningEffort: 'none', vision: 'ocr' },
    { provider: 'pollinations', model: 'openai/gpt-oss-20b', reasoningEffort: reasoning['openai/gpt-oss-20b'], vision: 'ocr' },
    { provider: 'pollinations', model: 'nvidia/nemotron-3.5-lightning', reasoningEffort: reasoning['nvidia/nemotron-3.5-lightning'], vision: 'ocr' },
  ],
} as const satisfies PersonaRoute;

export const PRO_ROUTE = {
  provider: 'pollinations',
  model: 'openai/gpt-6.1-sol',
  reasoningEffort: reasoning['openai/gpt-6.1-sol'],
  vision: 'native',
  fallbacks: [
    { provider: 'pollinations', model: 'openai/gpt-6-sol', reasoningEffort: reasoning['openai/gpt-6-sol'], vision: 'native' },
    { provider: 'pollinations', model: 'z-ai/glm-5.3', reasoningEffort: reasoning['z-ai/glm-5.3'], vision: 'ocr' },
    // This endpoint rejects reasoning_effort; null omits the parameter.
    { provider: 'pollinations', model: 'x-ai/grok-4.6', reasoningEffort: reasoning['x-ai/grok-4.6'], vision: 'native' },
  ],
} as const satisfies PersonaRoute;
