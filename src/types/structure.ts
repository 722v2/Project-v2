/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timeframe } from './market.ts';

export type SwingType = 'SWING_HIGH' | 'SWING_LOW';

export interface SwingPoint {
  id: string;
  timeframe: Timeframe;
  type: SwingType;
  price: number;
  timestamp: number;
  candleIndex: number;
  isConfirmed: boolean;
  broken: boolean;
}

export type StructureBreakType = 'BOS' | 'CHOCH';

export interface StructureBreak {
  id: string;
  timeframe: Timeframe;
  type: StructureBreakType;
  direction: 'BULLISH' | 'BEARISH';
  brokenSwing: SwingPoint;
  breakPrice: number;
  breakTimestamp: number;
  displacementRatio: number; // candle body vs ATR
}

export type LiquidityType = 'EXTERNAL' | 'INTERNAL' | 'EQUAL_HIGH' | 'EQUAL_LOW';

export interface LiquidityPool {
  id: string;
  timeframe: Timeframe;
  type: LiquidityType;
  levelPrice: number;
  upperTolerance: number;
  lowerTolerance: number;
  touches: number;
  isSwept: boolean;
  createdAt: number;
}

export interface LiquiditySweep {
  id: string;
  pool: LiquidityPool;
  sweepPrice: number;
  sweepTimestamp: number;
  rejectionWickRatio: number; // Wick size relative to total bar range
  reversalCandleClose: number;
  direction: 'BULLISH_SWEEP' | 'BEARISH_SWEEP'; // Swept low = Bullish sweep; Swept high = Bearish sweep
}

export type ZoneType = 'ORDER_BLOCK' | 'BREAKER_BLOCK' | 'MITIGATION_BLOCK';

export interface InstitutionalZone {
  id: string;
  timeframe: Timeframe;
  type: ZoneType;
  direction: 'BULLISH' | 'BEARISH';
  highPrice: number;
  lowPrice: number;
  meanPrice: number;
  timestamp: number;
  isValid: boolean;
  mitigated: boolean;
  displacementMagnitude: number;
}

export interface FairValueGap {
  id: string;
  timeframe: Timeframe;
  direction: 'BULLISH' | 'BEARISH';
  highPrice: number;
  lowPrice: number;
  midPrice: number;
  timestamp: number;
  isMitigated: boolean;
  isInverse: boolean;
}

export interface IndicatorMetrics {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    histogramPrev: number;
    momentumDirection: 'ACCELERATING' | 'DECELERATING' | 'NEUTRAL';
  };
}
