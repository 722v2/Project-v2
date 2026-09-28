/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../../types/market.ts';

export interface CandleValidationResult {
  isValid: boolean;
  errors: string[];
  cleanCandles: Candle[];
}

/**
 * Validates a series of candles, enforcing zero-lookahead bias,
 * chronological monotonicity, non-staleness, and candle integrity.
 */
export function validateCandleSeries(
  candles: Candle[],
  options: {
    currentTimeMs: number;
    maxAllowedStalenessMs?: number;
    allowUnclosedCurrentBar?: boolean;
    clockSkewToleranceMs?: number;
  }
): CandleValidationResult {
  const errors: string[] = [];
  const cleanCandles: Candle[] = [];
  const maxStaleness = options.maxAllowedStalenessMs ?? 120_000;
  const clockSkewTolerance = options.clockSkewToleranceMs ?? 5_000;

  if (!candles || candles.length === 0) {
    return { isValid: false, errors: ['Candle series is empty'], cleanCandles: [] };
  }

  let prevCloseTime = -1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // 1. Basic price sanity
    if (c.high < c.low || c.open < 0 || c.close < 0 || c.high < 0 || c.low < 0) {
      errors.push(`Candle at index ${i} has invalid OHLC: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`);
      continue;
    }

    // 2. Chronological sequence
    if (c.openTime < prevCloseTime) {
      errors.push(`Candle timestamp sequence violation at index ${i}: openTime ${c.openTime} < prevCloseTime ${prevCloseTime}`);
      continue;
    }

    // 3. ZERO-LOOKAHEAD BIAS ENFORCEMENT:
    // If not allowing unclosed bar, candle closeTime MUST be <= currentTimeMs (with 5s skew tolerance)
    if (!options.allowUnclosedCurrentBar && c.closeTime > (options.currentTimeMs + clockSkewTolerance)) {
      errors.push(
        `Lookahead Bias Violation: Candle ${i} closeTime (${c.closeTime}) is in the future relative to evaluation clock (${options.currentTimeMs})`
      );
      continue;
    }

    // Must be marked closed for strategy decision making
    if (!options.allowUnclosedCurrentBar && !c.isClosed) {
      errors.push(`Incomplete Candle: Candle at index ${i} is not closed.`);
      continue;
    }

    cleanCandles.push(c);
    prevCloseTime = c.closeTime;
  }

  // 4. Staleness check on most recent closed candle
  if (cleanCandles.length > 0) {
    const latest = cleanCandles[cleanCandles.length - 1];
    const staleness = options.currentTimeMs - latest.closeTime;
    if (staleness > maxStaleness) {
      errors.push(`Market Data Stale: Latest candle closed ${Math.round(staleness / 1000)}s ago (limit: ${Math.round(maxStaleness / 1000)}s)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanCandles,
  };
}
