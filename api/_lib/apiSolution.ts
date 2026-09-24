import type { ProviderHop } from './providerResilience.js';

/** Showcase defaults to nuclear. Set API_SOLUTION=production to restore the existing routes. */
export const API_SOLUTION: 'production' | 'nuclear' = process.env.API_SOLUTION === 'production'
  ? 'production'
  : 'nuclear';

export const OSAII_CHAT_URL = 'https://osaii.wyvernhub.net/api/v1/chat/completions';

const NUCLEAR_FALLBACKS: readonly ProviderHop[] = [
  { provider: 'osaii', model: 'mimo-z/mimo-v2.6-flash', vision: 'ocr' },
  { provider: 'osaii', model: 'gemini-z/gemini-3.1-flash-lite-preview', vision: 'ocr' },
  { provider: 'osaii', model: 'fireworks-z/nemotron-lightning-3.5', vision: 'ocr' },
];

export function nuclearProviderChain(persona: string): ProviderHop[] {
  const primary = persona === 'pro' ? 'mimo-z/mimo-v2.6-pro' : 'poolside/laguna-xs-2.1';
  return [{ provider: 'osaii', model: primary, vision: 'ocr' }, ...NUCLEAR_FALLBACKS];
}

export function activeProviderChain(persona: string, productionChain: ProviderHop[]): ProviderHop[] {
  return API_SOLUTION === 'nuclear' ? nuclearProviderChain(persona) : productionChain;
}
