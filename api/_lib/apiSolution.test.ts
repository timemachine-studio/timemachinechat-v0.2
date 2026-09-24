import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('API solution routing', () => {
  it('uses the showcase route for all three personas in the requested order', async () => {
    vi.stubEnv('API_SOLUTION', 'nuclear');
    const { activeProviderChain } = await import('./apiSolution.js');
    const expectedFallbacks = [
      'mimo-z/mimo-v2.6-flash',
      'gemini-z/gemini-3.1-flash-lite-preview',
      'fireworks-z/nemotron-lightning-3.5',
    ];
    for (const [persona, primary] of [
      ['default', 'poolside/laguna-xs-2.1'],
      ['girlie', 'poolside/laguna-xs-2.1'],
      ['pro', 'mimo-z/mimo-v2.6-pro'],
    ]) {
      const chain = activeProviderChain(persona, [{ provider: 'eaon', model: 'old-model' }]);
      expect(chain.map(hop => hop.model)).toEqual([primary, ...expectedFallbacks]);
      expect(chain.every(hop => hop.provider === 'osaii' && hop.vision === 'ocr')).toBe(true);
    }
  });

  it('leaves the existing routes intact when production is selected', async () => {
    vi.stubEnv('API_SOLUTION', 'production');
    const { activeProviderChain } = await import('./apiSolution.js');
    const production = [{ provider: 'eaon', model: 'existing-model' }];
    expect(activeProviderChain('pro', production)).toBe(production);
  });
});
