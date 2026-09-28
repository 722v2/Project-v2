/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Isolated mock test fixtures for offline unit tests only.
// STRICTLY FORBIDDEN IN PRODUCTION RUNTIME.

import { Candle, MarketRegime, MarketSnapshot } from '../../src/types/market.ts';
import { CandidateSetup } from '../../src/types/setup.ts';
import { Signal } from '../../src/types/signal.ts';
import { Trade, TradePosition, TradeOutcome } from '../../src/types/trade.ts';

export const FIXTURE_SNAPSHOT: MarketSnapshot = {
  symbol: 'XAU/USD',
  timestamp: 1700000000000,
  bidPrice: 2650.00,
  askPrice: 2650.30,
  midPrice: 2650.15,
  spread: 0.30,
  provider: 'mock_fixture',
  isStale: false,
  latencyMs: 12,
};

export const FIXTURE_REGIME: MarketRegime = {
  symbol: 'XAU/USD',
  timeframe: '15M',
  regime: 'TREND_UP',
  confidence: 80,
  contextNotes: 'Test fixture regime',
  evaluatedAt: 1700000000000,
};

export const FIXTURE_CANDLES: Candle[] = [
  {
    symbol: 'XAU/USD',
    timeframe: '5M',
    openTime: 1700000000000 - 300000,
    closeTime: 1700000000000,
    open: 2648.0,
    high: 2652.0,
    low: 2647.5,
    close: 2651.0,
    volume: 120,
    isClosed: true,
  },
];
