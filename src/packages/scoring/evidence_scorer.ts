/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvidenceBreakdown, RejectionClassification } from '../../types/signal.ts';

export interface ScoringInput {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  maxAllowedSlDistance: number;
  minRiskRewardRatio: number;
  // Raw Evidence Factors
  marketStructureQuality: number; // 0.0 - 1.0 (BOS displacement, structure cleanliness)
  liquiditySweepQuality: number;  // 0.0 - 1.0 (Sweep magnitude, wick rejection)
  poiCleanliness: number;         // 0.0 - 1.0 (OB/FVG displacement and freshness)
  mtfAlignmentScore: number;      // 0.0 - 1.0 (1H/15M/5M alignment)
  macdMomentumState: 'ALIGN' | 'NEUTRAL' | 'OPPOSING';
  rsiState: 'OPTIMAL' | 'ACCEPTABLE' | 'NEUTRAL' | 'EXTREME_OPPOSING';
  emaAlignmentState: 'ALIGNED' | 'NEUTRAL' | 'COUNTER';
  isDiscountOrPremium: boolean;   // Discount for BUY, Premium for SELL
  newsRiskState: 'CLEAR' | 'MODERATE' | 'HIGH_IMPACT_IMMINENT';
}

export interface ScoringResult {
  isHardInvalidated: boolean;
  hardInvalidationReasons: string[];
  rejectionClassification?: RejectionClassification;
  breakdown: EvidenceBreakdown;
  qualityScore: number;
  isActionable: boolean;
}

/**
 * Computes non-blocking evidence score, strictly distinguishing hard invalidations
 * from soft supporting factors. Solves V1 signal starvation.
 */
export function evaluateEvidenceScore(input: ScoringInput, minQualityScore = 65): ScoringResult {
  const hardInvalidationReasons: string[] = [];

  // --- 1. HARD INVALIDATION CHECKS (Fatal Physical & Risk Invariants Only) ---
  const slDistance = Math.abs(input.entryPrice - input.stopLoss);
  const tp1Distance = Math.abs(input.takeProfit1 - input.entryPrice);
  const calculatedRr = slDistance > 0 ? tp1Distance / slDistance : 0;

  if (input.direction === 'BUY' && input.stopLoss >= input.entryPrice) {
    hardInvalidationReasons.push('Physical Invalidation: BUY stop-loss is greater than or equal to entry price');
  }
  if (input.direction === 'SELL' && input.stopLoss <= input.entryPrice) {
    hardInvalidationReasons.push('Physical Invalidation: SELL stop-loss is less than or equal to entry price');
  }
  if (slDistance > input.maxAllowedSlDistance) {
    hardInvalidationReasons.push(
      `Risk Invalidation: Stop-loss distance ($${slDistance.toFixed(2)}) exceeds maximum allowed ($${input.maxAllowedSlDistance.toFixed(2)})`
    );
  }
  if (calculatedRr < input.minRiskRewardRatio) {
    hardInvalidationReasons.push(
      `Risk Invalidation: Calculated RR (${calculatedRr.toFixed(2)}) is below minimum requirement (${input.minRiskRewardRatio.toFixed(2)})`
    );
  }

  if (hardInvalidationReasons.length > 0) {
    return {
      isHardInvalidated: true,
      hardInvalidationReasons,
      rejectionClassification: 'HARD_INVALIDATION',
      breakdown: {
        marketStructure: 0,
        liquidityEvent: 0,
        poiValidity: 0,
        mtfConfluence: 0,
        riskReward: 0,
        macdMomentum: 0,
        rsiContext: 0,
        emaAlignment: 0,
        premiumDiscount: 0,
        newsContext: 0,
        totalScore: 0,
      },
      qualityScore: 0,
      isActionable: false,
    };
  }

  // --- 2. SOFT SUPPORTING EVIDENCE CALCULATION (100 Points Total) ---
  // Structure: 20 pts max
  const marketStructure = Math.round(Math.min(20, Math.max(0, input.marketStructureQuality * 20)));

  // Liquidity: 18 pts max
  const liquidityEvent = Math.round(Math.min(18, Math.max(0, input.liquiditySweepQuality * 18)));

  // POI Validity: 15 pts max
  const poiValidity = Math.round(Math.min(15, Math.max(0, input.poiCleanliness * 15)));

  // MTF Confluence: 12 pts max
  const mtfConfluence = Math.round(Math.min(12, Math.max(0, input.mtfAlignmentScore * 12)));

  // Risk/Reward Score: 10 pts max (RR 1.5 -> 6pts, RR 2.0 -> 8pts, RR >= 2.5 -> 10pts)
  const riskReward = Math.min(10, Math.round(Math.max(0, (calculatedRr / 2.5) * 10)));

  // MACD Momentum: 7 pts max (Soft factor: Neutral still awards 4 points! Never kills setup!)
  let macdMomentum = 4; // Default neutral
  if (input.macdMomentumState === 'ALIGN') macdMomentum = 7;
  else if (input.macdMomentumState === 'OPPOSING') macdMomentum = 1;

  // RSI Context: 6 pts max (Soft factor: Neutral still awards 3 points!)
  let rsiContext = 3; // Default neutral
  if (input.rsiState === 'OPTIMAL') rsiContext = 6;
  else if (input.rsiState === 'ACCEPTABLE') rsiContext = 4;
  else if (input.rsiState === 'EXTREME_OPPOSING') rsiContext = 1;

  // EMA Alignment: 5 pts max
  let emaAlignment = 3;
  if (input.emaAlignmentState === 'ALIGNED') emaAlignment = 5;
  else if (input.emaAlignmentState === 'COUNTER') emaAlignment = 1;

  // Premium / Discount Location: 4 pts max
  const premiumDiscount = input.isDiscountOrPremium ? 4 : 1;

  // News Context: 3 pts max
  let newsContext = 3;
  if (input.newsRiskState === 'MODERATE') newsContext = 2;
  else if (input.newsRiskState === 'HIGH_IMPACT_IMMINENT') newsContext = 1;

  const totalScore =
    marketStructure +
    liquidityEvent +
    poiValidity +
    mtfConfluence +
    riskReward +
    macdMomentum +
    rsiContext +
    emaAlignment +
    premiumDiscount +
    newsContext;

  const isActionable = totalScore >= minQualityScore;

  return {
    isHardInvalidated: false,
    hardInvalidationReasons: [],
    rejectionClassification: isActionable ? undefined : 'SOFT_EVIDENCE_INSUFFICIENT',
    breakdown: {
      marketStructure,
      liquidityEvent,
      poiValidity,
      mtfConfluence,
      riskReward,
      macdMomentum,
      rsiContext,
      emaAlignment,
      premiumDiscount,
      newsContext,
      totalScore,
    },
    qualityScore: totalScore,
    isActionable,
  };
}
