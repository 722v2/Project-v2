/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, MarketSnapshot, Timeframe } from '../../types/market.ts';

export interface MarketDataHealth {
  status: 'CONNECTED' | 'DISCONNECTED' | 'STALE';
  latencyMs: number;
  lastUpdate: number;
  providerName: string;
  error?: string;
  bidPrice?: number;
  askPrice?: number;
  midPrice?: number;
  spread?: number;
  high24h?: number;
  low24h?: number;
  dayDiffPercent?: number;
  direction?: 'UP' | 'DOWN';
  marketState?: string;
}

export interface CandlesResult {
  closedCandles: Candle[];
  formingCandle?: Candle;
  timeframe: Timeframe;
  symbol: string;
  isStale: boolean;
  fetchedAt: number;
}

export interface MarketDataProvider {
  readonly name: string;
  getSnapshot(symbol: string): Promise<MarketSnapshot>;
  getCandles(symbol: string, timeframe: Timeframe, count?: number): Promise<CandlesResult>;
  checkHealth(symbol: string): Promise<MarketDataHealth>;
}
