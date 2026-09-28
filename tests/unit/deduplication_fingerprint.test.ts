/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketPriceZone,
  evaluateDeduplication,
  generateSetupFingerprint,
} from '../../src/packages/deduplication/fingerprint.ts';
import { CandidateSetup } from '../../src/types/setup.ts';

test('Deduplication Fingerprint: Bucketing normalizes prices within tolerance', () => {
  const b1 = bucketPriceZone(2340.10, 0.50);
  const b2 = bucketPriceZone(2340.45, 0.50);
  const b3 = bucketPriceZone(2340.60, 0.50);

  assert.strictEqual(b1, 2340.00);
  assert.strictEqual(b2, 2340.00);
  assert.strictEqual(b3, 2340.50);
});

test('Deduplication: Prevents multiple alerts for the same spatial POI setup', () => {
  const setupId = generateSetupFingerprint({
    strategy: 'order_block_reaction',
    direction: 'BUY',
    timeframe: '5M',
    anchorSwingId: 'sw_low_991',
    poiZonePrice: 2342.20,
    toleranceUsd: 0.50,
  });

  const existingSetup: CandidateSetup = {
    identity: {
      setupId,
      strategy: 'order_block_reaction',
      direction: 'BUY',
      timeframe: '5M',
      poiZoneLow: 2342.00,
      poiZoneHigh: 2342.50,
      anchorSwingId: 'sw_low_991',
      anchorTimestamp: 1700000000000,
    },
    entryPrice: 2342.25,
    stopLoss: 2338.00,
    takeProfit1: 2348.00,
    takeProfit2: 2352.00,
    riskReward1: 1.35,
    riskReward2: 2.29,
    qualityScore: 78,
    confidence: 82,
    lifecycleState: 'ACTIVE',
    firstDetectedAt: 1700000000000,
    lastUpdatedAt: 1700000000000,
    structureNotes: ['5M Bullish OB confluence'],
    invalidationCriteria: ['Close below 2337.50'],
  };

  // Candidate setup 3 minutes later at slightly different price (2342.35) in same zone
  const candidateSetup: CandidateSetup = {
    ...existingSetup,
    entryPrice: 2342.35,
    lastUpdatedAt: 1700000180000,
  };

  const evalResult = evaluateDeduplication(candidateSetup, [existingSetup], 0.50, 60 * 60 * 1000);

  assert.strictEqual(evalResult.isDuplicate, true);
  assert.ok(evalResult.preventionRecord);
  assert.strictEqual(evalResult.preventionRecord.existingSetupId, setupId);
});
