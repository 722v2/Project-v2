/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEvidenceScore } from '../../src/packages/scoring/evidence_scorer.ts';

test('Evidence Scoring: Soft neutral factors (MACD/RSI neutral) DO NOT starve/kill a valid setup', () => {
  const result = evaluateEvidenceScore({
    direction: 'BUY',
    entryPrice: 2340.00,
    stopLoss: 2335.00, // $5 SL
    takeProfit1: 2350.00, // $10 TP1 (RR = 2.0)
    takeProfit2: 2360.00,
    maxAllowedSlDistance: 12.00,
    minRiskRewardRatio: 1.50,
    marketStructureQuality: 0.90, // Strong structure
    liquiditySweepQuality: 0.85,  // Strong sweep
    poiCleanliness: 0.80,         // Strong OB/FVG
    mtfAlignmentScore: 0.75,
    macdMomentumState: 'NEUTRAL', // Neutral MACD (Previously starved V1!)
    rsiState: 'NEUTRAL',          // Neutral RSI (Previously starved V1!)
    emaAlignmentState: 'ALIGNED',
    isDiscountOrPremium: true,
    newsRiskState: 'CLEAR',
  });

  assert.strictEqual(result.isHardInvalidated, false);
  assert.strictEqual(result.isActionable, true);
  // Score should be well above threshold of 65
  assert.ok(result.qualityScore >= 70, `Score was ${result.qualityScore}`);
});

test('Evidence Scoring: Hard invalidations (Inverted SL, excess SL distance) cleanly reject setup', () => {
  const result = evaluateEvidenceScore({
    direction: 'BUY',
    entryPrice: 2340.00,
    stopLoss: 2345.00, // Invalid: BUY stop loss is ABOVE entry!
    takeProfit1: 2355.00,
    takeProfit2: 2365.00,
    maxAllowedSlDistance: 12.00,
    minRiskRewardRatio: 1.50,
    marketStructureQuality: 1.0,
    liquiditySweepQuality: 1.0,
    poiCleanliness: 1.0,
    mtfAlignmentScore: 1.0,
    macdMomentumState: 'ALIGN',
    rsiState: 'OPTIMAL',
    emaAlignmentState: 'ALIGNED',
    isDiscountOrPremium: true,
    newsRiskState: 'CLEAR',
  });

  assert.strictEqual(result.isHardInvalidated, true);
  assert.strictEqual(result.isActionable, false);
  assert.strictEqual(result.rejectionClassification, 'HARD_INVALIDATION');
});
