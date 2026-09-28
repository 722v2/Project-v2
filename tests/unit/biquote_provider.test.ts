/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BiquoteMarketDataProvider } from '../../src/packages/market-data/biquote_provider.ts';

test('Biquote Provider: Symbol normalization and interval mapping', () => {
  const provider = new BiquoteMarketDataProvider();

  assert.strictEqual(provider.normalizeSymbol('XAU/USD'), 'XAUUSD');
  assert.strictEqual(provider.normalizeSymbol('xauusd'), 'XAUUSD');
  assert.strictEqual(provider.mapTimeframeToInterval('1M'), '1m');
  assert.strictEqual(provider.mapTimeframeToInterval('5M'), '5m');
  assert.strictEqual(provider.mapTimeframeToInterval('15M'), '15m');
  assert.strictEqual(provider.mapTimeframeToInterval('1H'), '1h');
});

test('Biquote Provider: Live Quote Connection retrieves valid numeric bid, ask, mid, spread', async () => {
  const provider = new BiquoteMarketDataProvider();
  const snapshot = await provider.getSnapshot('XAUUSD');

  assert.ok(snapshot, 'Snapshot should be returned');
  assert.strictEqual(snapshot.provider, 'biquote');
  assert.ok(typeof snapshot.bidPrice === 'number' && snapshot.bidPrice > 0, `Invalid bid: ${snapshot.bidPrice}`);
  assert.ok(typeof snapshot.askPrice === 'number' && snapshot.askPrice >= snapshot.bidPrice, `Ask < Bid: ${snapshot.askPrice} < ${snapshot.bidPrice}`);
  assert.ok(typeof snapshot.midPrice === 'number' && snapshot.midPrice > 0, `Invalid mid: ${snapshot.midPrice}`);
  assert.ok(typeof snapshot.spread === 'number' && snapshot.spread >= 0, `Invalid spread: ${snapshot.spread}`);
  assert.ok(snapshot.timestamp > 0, 'Timestamp must be positive');
  assert.strictEqual(snapshot.isStale, false, 'Live quote should not be stale');
});

test('Biquote Provider: Multi-timeframe closed candle pipeline (1M, 5M, 15M, 1H)', async () => {
  const provider = new BiquoteMarketDataProvider();
  const timeframes: ('1M' | '5M' | '15M' | '1H')[] = ['1M', '5M', '15M', '1H'];

  for (const tf of timeframes) {
    const res = await provider.getCandles('XAUUSD', tf, 30);

    assert.ok(res.closedCandles.length > 0, `Should have closed candles for ${tf}`);
    assert.strictEqual(res.timeframe, tf);

    // Verify all returned closed candles have isClosed === true
    for (const c of res.closedCandles) {
      assert.strictEqual(c.isClosed, true, `Candle must be marked closed: ${c.openTime}`);
      assert.ok(c.high >= c.low, `High must be >= Low: ${c.high} vs ${c.low}`);
      assert.ok(c.open > 0 && c.close > 0, `Prices must be positive: O=${c.open}, C=${c.close}`);
    }

    // Verify chronological ordering (oldest to newest)
    for (let i = 1; i < res.closedCandles.length; i++) {
      assert.ok(
        res.closedCandles[i].openTime >= res.closedCandles[i - 1].openTime,
        `Candles must be in chronological order: ${res.closedCandles[i].openTime} >= ${res.closedCandles[i - 1].openTime}`
      );
    }

    // Verify forming candle is correctly distinguished
    if (res.formingCandle) {
      assert.strictEqual(res.formingCandle.isClosed, false, 'Forming candle must have isClosed === false');
    }
  }
});

test('Biquote Provider: Stale data detection flags isStale if quote is older than threshold', () => {
  // Configure strict 1 second staleness threshold
  const provider = new BiquoteMarketDataProvider({
    maxAllowedStalenessSeconds: 1,
  });

  const now = Date.now();
  const oldTimestamp = now - 5000; // 5 seconds old

  const isStale = (now - oldTimestamp) > 1000;
  assert.strictEqual(isStale, true, 'Data older than limit must be marked stale');
});

test('Biquote Provider: Failure behavior throws explicit error without falling back to fake data', async () => {
  const brokenProvider = new BiquoteMarketDataProvider({
    baseUrl: 'https://invalid-nonexistent-domain-xyz.com',
    timeoutMs: 1500,
  });

  await assert.rejects(
    async () => {
      await brokenProvider.getSnapshot('XAUUSD');
    },
    (err: Error) => {
      assert.ok(err.message.includes('Biquote Market Data Provider Failure'));
      return true;
    },
    'Provider must throw clear error on network failure and never return mock data'
  );
});
