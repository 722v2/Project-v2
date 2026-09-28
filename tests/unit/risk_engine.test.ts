/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { RiskEngine } from '../../src/packages/risk/risk_engine.ts';

test('Risk Engine: Computes exact 1% risk lot sizing on $100 capital', () => {
  const engine = new RiskEngine(
    {
      id: 'TEST_ACCT',
      startingCapital: 100.00,
      currentCapital: 100.00,
      currency: 'USD',
      updatedAt: Date.now(),
    },
    {
      id: 'TEST_RISK',
      riskPercentPerTrade: 1.00, // 1% = $1.00 planned risk
      maxDailyRiskPercent: 3.00,
      maxConcurrentTrades: 2,
      maxAllowedSlDistance: 12.00,
      minRiskRewardRatio: 1.50,
      maxDrawdownLimitPercent: 10.00,
      updatedAt: Date.now(),
    }
  );

  const evalResult = engine.evaluateTradeRisk({
    direction: 'BUY',
    entryPrice: 2340.00,
    stopLoss: 2335.00, // $5 SL distance
    takeProfit1: 2350.00, // $10 TP distance (RR = 2.0)
    currentOpenTradesCount: 0,
  });

  assert.strictEqual(evalResult.isValid, true);
  assert.strictEqual(evalResult.violations.length, 0);
  assert.ok(evalResult.sizing);
  assert.strictEqual(evalResult.sizing.plannedRiskUsd, 1.00);
  assert.strictEqual(evalResult.sizing.slDistanceUsd, 5.00);
  assert.strictEqual(evalResult.sizing.positionSizeLots, 0.01); // Minimum lot
});

test('Risk Engine: Rejects trade exceeding maximum allowed SL distance', () => {
  const engine = new RiskEngine(
    {
      id: 'TEST_ACCT',
      startingCapital: 100.00,
      currentCapital: 100.00,
      currency: 'USD',
      updatedAt: Date.now(),
    },
    {
      id: 'TEST_RISK',
      riskPercentPerTrade: 1.00,
      maxDailyRiskPercent: 3.00,
      maxConcurrentTrades: 2,
      maxAllowedSlDistance: 10.00, // Max $10
      minRiskRewardRatio: 1.50,
      maxDrawdownLimitPercent: 10.00,
      updatedAt: Date.now(),
    }
  );

  const evalResult = engine.evaluateTradeRisk({
    direction: 'BUY',
    entryPrice: 2340.00,
    stopLoss: 2325.00, // $15 SL distance > $10 limit!
    takeProfit1: 2370.00,
    currentOpenTradesCount: 0,
  });

  assert.strictEqual(evalResult.isValid, false);
  assert.ok(evalResult.violations.some((v) => v.includes('exceeds maximum allowed')));
});
