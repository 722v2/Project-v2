/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCandleSeries } from '../../src/packages/market-data/validator.ts';
import { Candle } from '../../src/types/market.ts';

test('Zero-Lookahead Bias: rejects candles closing in the future relative to evaluation clock', () => {
  const currentClock = 1700000000000;
  const candles: Candle[] = [
    {
      symbol: 'XAU/USD',
      timeframe: '5M',
      openTime: currentClock - 600000,
      closeTime: currentClock - 300000,
      open: 2350,
      high: 2355,
      low: 2348,
      close: 2352,
      volume: 100,
      isClosed: true,
    },
    {
      symbol: 'XAU/USD',
      timeframe: '5M',
      openTime: currentClock - 300000,
      closeTime: currentClock + 50000, // Lookahead: closes in the future!
      open: 2352,
      high: 2358,
      low: 2351,
      close: 2357,
      volume: 120,
      isClosed: true,
    },
  ];

  const result = validateCandleSeries(candles, {
    currentTimeMs: currentClock,
    allowUnclosedCurrentBar: false,
  });

  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some((err) => err.includes('Lookahead Bias Violation')));
});

test('Candle Integrity: accepts monotonic, closed candles within staleness limit', () => {
  const currentClock = 1700000000000;
  const candles: Candle[] = [
    {
      symbol: 'XAU/USD',
      timeframe: '5M',
      openTime: currentClock - 600000,
      closeTime: currentClock - 300000,
      open: 2350,
      high: 2355,
      low: 2348,
      close: 2352,
      volume: 100,
      isClosed: true,
    },
    {
      symbol: 'XAU/USD',
      timeframe: '5M',
      openTime: currentClock - 299999,
      closeTime: currentClock - 10000,
      open: 2352,
      high: 2356,
      low: 2350,
      close: 2354,
      volume: 110,
      isClosed: true,
    },
  ];

  const result = validateCandleSeries(candles, {
    currentTimeMs: currentClock,
    maxAllowedStalenessMs: 60000,
    allowUnclosedCurrentBar: false,
  });

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.cleanCandles.length, 2);
});
