/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timeframe } from './market.ts';

export type SetupStrategy =
  | 'liquidity_sweep_reversal'
  | 'bos_pullback_continuation'
  | 'fvg_retracement'
  | 'order_block_reaction'
  | 'liquidity_ob_fvg_confluence'
  | 'range_eqh_eql_reversal';

export type SetupDirection = 'BUY' | 'SELL';

export type SetupLifecycleState =
  | 'DETECTED'
  | 'WATCHING'
  | 'CONFIRMED'
  | 'SIGNAL_SENT'
  | 'ACTIVE'
  | 'MONITORING'
  | 'TP1_REACHED'
  | 'TP2_REACHED'
  | 'SL_REACHED'
  | 'BREAKEVEN'
  | 'PARTIAL_CLOSED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'CLOSED';

export interface SetupIdentity {
  setupId: string; // Deterministic SHA-256 fingerprint
  strategy: SetupStrategy;
  direction: SetupDirection;
  timeframe: Timeframe;
  poiZoneLow: number;
  poiZoneHigh: number;
  anchorSwingId: string;
  anchorTimestamp: number;
}

export interface CandidateSetup {
  identity: SetupIdentity;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward1: number;
  riskReward2: number;
  qualityScore: number;
  confidence: number;
  lifecycleState: SetupLifecycleState;
  firstDetectedAt: number;
  lastUpdatedAt: number;
  structureNotes: string[];
  invalidationCriteria: string[];
}

export interface SetupEvent {
  id: string;
  setupId: string;
  fromState: SetupLifecycleState;
  toState: SetupLifecycleState;
  triggerPrice: number;
  triggerReason: string;
  timestamp: number;
}

export interface DuplicatePreventionRecord {
  id: string;
  attemptedSetupId: string;
  existingSetupId: string;
  strategy: SetupStrategy;
  direction: SetupDirection;
  candidatePrice: number;
  existingPoiZone: [number, number];
  reason: string;
  timestamp: number;
}
