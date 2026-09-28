/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketDataProvider } from './provider.ts';
import { BiquoteMarketDataProvider } from './biquote_provider.ts';
import { DEFAULT_CONFIG } from '../../config/index.ts';

export * from './provider.ts';
export * from './biquote_provider.ts';
export * from './validator.ts';

let defaultProviderInstance: MarketDataProvider | null = null;

export function getMarketDataProvider(): MarketDataProvider {
  if (!defaultProviderInstance) {
    // Configured live provider is Biquote
    const configuredBaseUrl =
      (typeof process !== 'undefined' && process.env?.BIQUOTE_BASE_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BIQUOTE_BASE_URL) ||
      undefined;

    defaultProviderInstance = new BiquoteMarketDataProvider({
      baseUrl: configuredBaseUrl,
      maxAllowedStalenessSeconds: DEFAULT_CONFIG.maxStalenessSeconds,
    });
  }
  return defaultProviderInstance;
}
