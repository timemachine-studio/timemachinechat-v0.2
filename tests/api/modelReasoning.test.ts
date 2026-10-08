import { describe, expect, it } from 'vitest';
import { pollinationsReasoning } from '../../api/_lib/modelReasoning';
import { AIR_ROUTE, PRO_ROUTE } from '../../api/_lib/personaRoutes';
import { buildProviderChain } from '../../api/ai-proxy';

describe('per-model reasoning', () => {
  it('preserves each fallback setting through the serializable worker chain', () => {
    for (const route of [AIR_ROUTE, PRO_ROUTE]) {
      const chain = buildProviderChain(route.provider, route.model, [...route.fallbacks], route);
      const roundTrip = JSON.parse(JSON.stringify(chain));
      expect(roundTrip.map((hop: { reasoningEffort?: string | null }) => hop.reasoningEffort))
        .toEqual([route.reasoningEffort, ...route.fallbacks.map(hop => hop.reasoningEffort)]);
    }
  });

  it.each([
    ['openai/gpt-6-luna', 'low'],
    ['openai/gpt-5.6-luna', 'none'],
    ['openai/gpt-oss-20b', 'low'],
    ['nvidia/nemotron-3.5-lightning', 'none'],
    ['openai/gpt-6.1-sol', 'low'],
    ['openai/gpt-6-sol', 'low'],
    ['z-ai/glm-5.3', 'low'],
  ])('uses the verified default for %s', (model, effort) => {
    expect(pollinationsReasoning(model)).toEqual({ reasoning_effort: effort });
  });

  it('omits controls for Grok and unknown models', () => {
    expect(pollinationsReasoning('x-ai/grok-4.6')).toEqual({});
    expect(pollinationsReasoning('new/model')).toEqual({});
  });

  it('distinguishes explicit omission from none and accepts a model override', () => {
    expect(pollinationsReasoning(PRO_ROUTE.model, null)).toEqual({});
    expect(pollinationsReasoning(PRO_ROUTE.model, 'low')).toEqual({ reasoning_effort: 'low' });
    expect(pollinationsReasoning(AIR_ROUTE.model, 'none')).toEqual({ reasoning_effort: 'none' });
  });
});
