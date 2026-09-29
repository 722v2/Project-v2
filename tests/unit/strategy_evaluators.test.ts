/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateS1_LiquiditySweep,
  evaluateS2_BOSContinuation,
  evaluateS3_FVGRetracement,
  evaluateS4_OrderBlockReaction,
  evaluateS5_LiquidityObFvgConfluence,
  evaluateS6_EqhEqlReversal,
} from '../../src/packages/strategies/strategy_evaluators.ts';
import { Candle } from '../../src/types/market.ts';

function generateMockCandles(): Candle[] {
  const candles: Candle[] = [];
  let basePrice = 2700.0;
  const now = Date.now();

  for (let i = 0; i < 30; i++) {
    const open = basePrice;
    const high = open + 2.0;
    const low = open - 2.0;
    const close = open + (i % 2 === 0 ? 0.5 : -0.5);
    candles.push({
      symbol: 'XAUUSD',
      timeframe: '5M',
      openTime: now - (30 - i) * 300000,
      closeTime: now - (29 - i) * 300000,
      open,
      high,
      low,
      close,
      volume: 100,
      isClosed: true,
    });
    basePrice = close;
  }
  return candles;
}

test('S1 Liquidity Sweep evaluation runs deterministically', () => {
  const candles = generateMockCandles();
  const res = evaluateS1_LiquiditySweep(candles, 'TREND_UP');
  assert.equal(res.strategyId, 'liquidity_sweep_reversal');
  assert.equal(res.strategyNumber, 'S1');
});

test('S2 BOS Continuation evaluation runs deterministically', () => {
  const candles = generateMockCandles();
  const res = evaluateS2_BOSContinuation(candles, 'TREND_UP');
  assert.equal(res.strategyId, 'bos_pullback_continuation');
  assert.equal(res.strategyNumber, 'S2');
});

test('S3 FVG Retracement evaluation runs deterministically', () => {
  const candles = generateMockCandles();
  const res = evaluateS3_FVGRetracement(candles, 'TREND_UP');
  assert.equal(res.strategyId, 'fvg_retracement');
  assert.equal(res.strategyNumber, 'S3');
});

test('S4 Order Block Reaction evaluation runs deterministically', () => {
  const candles = generateMockCandles();
  const res = evaluateS4_OrderBlockReaction(candles, 'TREND_UP');
  assert.equal(res.strategyId, 'order_block_reaction');
  assert.equal(res.strategyNumber, 'S4');
});

test('S5 Confluence evaluation combines underlying strategy evidence', () => {
  const candles = generateMockCandles();
  const s1 = evaluateS1_LiquiditySweep(candles, 'TREND_UP');
  const s3 = evaluateS3_FVGRetracement(candles, 'TREND_UP');
  const s4 = evaluateS4_OrderBlockReaction(candles, 'TREND_UP');
  const s5 = evaluateS5_LiquidityObFvgConfluence(candles, 'TREND_UP', s1, s3, s4);
  assert.equal(s5.strategyId, 'liquidity_ob_fvg_confluence');
  assert.equal(s5.strategyNumber, 'S5');
});

test('S6 EQH/EQL Reversal evaluation runs deterministically', () => {
  const candles = generateMockCandles();
  const res = evaluateS6_EqhEqlReversal(candles, 'RANGE');
  assert.equal(res.strategyId, 'range_eqh_eql_reversal');
  assert.equal(res.strategyNumber, 'S6');
});
