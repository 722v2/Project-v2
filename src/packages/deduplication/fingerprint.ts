/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CandidateSetup, DuplicatePreventionRecord, SetupIdentity, SetupStrategy } from '../../types/setup.ts';

/**
 * Creates a normalized deterministic bucket for price zones.
 * For example with tolerance $0.50, any price in [2340.00, 2340.49] maps to 2340.00.
 */
export function bucketPriceZone(price: number, toleranceUsd = 0.50): number {
  return Math.floor(price / toleranceUsd) * toleranceUsd;
}

/**
 * Generates an immutable, deterministic SHA-like setup identity fingerprint.
 * Prevents multiple alerts from being dispatched for the same spatial structural opportunity.
 */
export function generateSetupFingerprint(params: {
  strategy: SetupStrategy;
  direction: 'BUY' | 'SELL';
  timeframe: string;
  anchorSwingId: string;
  poiZonePrice: number;
  toleranceUsd?: number;
}): string {
  const bucketedPoi = bucketPriceZone(params.poiZonePrice, params.toleranceUsd ?? 0.50);
  const rawKey = `${params.strategy}:${params.direction}:${params.timeframe}:${params.anchorSwingId}:${bucketedPoi.toFixed(2)}`;
  
  // High performance deterministic hash
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    const char = rawKey.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return `setup_${params.strategy.slice(0, 4)}_${params.direction.toLowerCase()}_${params.timeframe}_${hexHash}`;
}

/**
 * Evaluates whether a newly detected candidate setup is a duplicate of an existing active setup.
 */
export function evaluateDeduplication(
  candidate: CandidateSetup,
  activeSetups: CandidateSetup[],
  poiToleranceUsd = 0.50,
  activeWindowMs = 60 * 60 * 1000
): { isDuplicate: boolean; preventionRecord?: DuplicatePreventionRecord } {
  const now = candidate.lastUpdatedAt || Date.now();

  for (const existing of activeSetups) {
    // 1. Check exact Setup ID collision
    const isSameId = existing.identity.setupId === candidate.identity.setupId;

    // 2. Check spatial POI overlap on same strategy and direction
    const isSameStrategyAndDir =
      existing.identity.strategy === candidate.identity.strategy &&
      existing.identity.direction === candidate.identity.direction;

    const isWithinTimeWindow = now - existing.firstDetectedAt <= activeWindowMs;

    const existingMidPoi = (existing.identity.poiZoneLow + existing.identity.poiZoneHigh) / 2;
    const candidateMidPoi = (candidate.identity.poiZoneLow + candidate.identity.poiZoneHigh) / 2;
    const isPoiOverlap = Math.abs(existingMidPoi - candidateMidPoi) <= poiToleranceUsd;

    if ((isSameId || (isSameStrategyAndDir && isPoiOverlap)) && isWithinTimeWindow) {
      return {
        isDuplicate: true,
        preventionRecord: {
          id: `prev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          attemptedSetupId: candidate.identity.setupId,
          existingSetupId: existing.identity.setupId,
          strategy: candidate.identity.strategy,
          direction: candidate.identity.direction,
          candidatePrice: candidate.entryPrice,
          existingPoiZone: [existing.identity.poiZoneLow, existing.identity.poiZoneHigh],
          reason: isSameId
            ? `Exact deterministic setup identity collision (${candidate.identity.setupId})`
            : `Spatial POI overlap within $${poiToleranceUsd.toFixed(2)} on existing active setup (${existing.identity.setupId})`,
          timestamp: now,
        },
      };
    }
  }

  return { isDuplicate: false };
}
