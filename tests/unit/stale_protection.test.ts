/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingEngine } from '../../src/services/trading_engine.ts';

test('Stale Protection: Engine refuses scanner execution and signal generation when data is stale', async () => {
  const engine = TradingEngine.getInstance();
  const state = engine.getState();

  // Simulate stale data condition (150 seconds old > 120s limit)
  state.dataFreshnessSeconds = 150;
  state.providerHealth.status = 'STALE';

  // Run scanner
  await engine.runScannerCycle();

  // Signal must remain null (no signals manufactured from stale data)
  assert.strictEqual(
    engine.getState().activeSignal,
    null,
    'Scanner must not generate signals from stale market data'
  );
});

test('Stale Protection: Engine refuses scanner execution when provider is disconnected', async () => {
  const engine = TradingEngine.getInstance();
  const state = engine.getState();

  state.providerHealth.status = 'DISCONNECTED';

  await engine.runScannerCycle();

  assert.strictEqual(
    engine.getState().activeSignal,
    null,
    'Scanner must not generate signals when provider is disconnected'
  );
});

test('Trade Monitor: Calculates dynamic unrealized P&L and R-multiple from live price', () => {
  const engine = TradingEngine.getInstance();
  const state = engine.getState();

  // Set up an active trade: BUY at 4140.00, SL at 4135.00 ($5 risk), lots = 0.02
  state.activeTrade = {
    tradeId: 'tr_test_01',
    signalId: 'sig_test_01',
    setupId: 'setup_test_01',
    symbol: 'XAU/USD',
    direction: 'BUY',
    entryPrice: 4140.00,
    stopLoss: 4135.00,
    takeProfit1: 4147.50,
    takeProfit2: 4153.50,
    plannedRiskUsd: 1.00,
    positionSizeLots: 0.02,
    status: 'ACTIVE',
    openedAt: Date.now() - 60000,
    createdAt: Date.now() - 60000,
  };

  state.activePosition = {
    tradeId: 'tr_test_01',
    currentMarketPrice: 4140.00,
    unrealizedPnlUsd: 0,
    currentRMultiple: 0,
    distanceToSl: 5.0,
    distanceToTp1: 7.5,
    distanceToTp2: 13.5,
    mfePrice: 4140.00,
    mfeR: 0,
    maePrice: 4140.00,
    maeR: 0,
    tp1Hit: false,
    tp2Hit: false,
    slHit: false,
    isBreakeven: false,
    isPartialClosed: false,
    reversalWatchStatus: 'NORMAL',
    lastEvaluatedAt: Date.now(),
  };

  // Set live market price at 4145.00 (+$5 gain = +1.00 R)
  state.currentPrice = 4145.00;

  engine.runTradeMonitorCycle();

  const pos = engine.getState().activePosition;
  assert.ok(pos, 'Position should exist');
  assert.strictEqual(pos.currentMarketPrice, 4145.00);
  assert.strictEqual(pos.currentRMultiple, 1.00);
  // 0.02 lots * 100 * $5 = $10.00
  assert.strictEqual(pos.unrealizedPnlUsd, 10.00);
  assert.strictEqual(pos.mfeR, 1.00);
});
