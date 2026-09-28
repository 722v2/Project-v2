/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Timeframe = '1M' | '5M' | '15M' | '1H';

export interface Candle {
  symbol: string;
  timeframe: Timeframe;
  openTime: number; // Unix timestamp ms
  closeTime: number; // Unix timestamp ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface MarketSnapshot {
  symbol: string;
  timestamp: number;
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  spread: number;
  provider: string;
  isStale: boolean;
  latencyMs: number;
  high24h?: number;
  low24h?: number;
  dayDiffPercent?: number;
  direction?: 'UP' | 'DOWN';
  marketState?: string;
  quoteAgeSeconds?: number;
}

export type RegimeType = 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'TRANSITION' | 'UNCLEAR';

export interface MarketRegime {
  symbol: string;
  timeframe: Timeframe;
  regime: RegimeType;
  confidence: number; // 0 - 100
  adxValue?: number;
  emaSlope?: number;
  rangeHigh?: number;
  rangeLow?: number;
  contextNotes: string;
  evaluatedAt: number;
}
