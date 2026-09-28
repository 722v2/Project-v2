/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegimeType, Timeframe } from './market.ts';
import { SetupDirection, SetupStrategy } from './setup.ts';

export interface EvidenceBreakdown {
  marketStructure: number; // Max 20
  liquidityEvent: number; // Max 18
  poiValidity: number; // Max 15
  mtfConfluence: number; // Max 12
  riskReward: number; // Max 10
  macdMomentum: number; // Max 7
  rsiContext: number; // Max 6
  emaAlignment: number; // Max 5
  premiumDiscount: number; // Max 4
  newsContext: number; // Max 3
  totalScore: number; // Max 100
}

export interface Signal {
  signalId: string;
  setupId: string;
  symbol: string;
  strategy: SetupStrategy;
  direction: SetupDirection;
  timeframe: Timeframe;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward1: number;
  riskReward2: number;
  confidence: number;
  qualityScore: number;
  marketRegime: RegimeType;
  evidenceBreakdown: EvidenceBreakdown;
  analysisReasons: string[];
  riskNotes: string[];
  newsContext: Record<string, unknown>;
  invalidatingConditions: string[];
  strategyVersion: string;
  analysisVersion: string;
  createdAt: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

export type RejectionClassification =
  | 'HARD_INVALIDATION'
  | 'SOFT_EVIDENCE_INSUFFICIENT'
  | 'RISK_VIOLATION'
  | 'DATA_INTEGRITY_FAIL';

export interface RejectionRecord {
  id: string;
  timestamp: number;
  strategy: SetupStrategy;
  direction: SetupDirection;
  marketRegime: RegimeType;
  candidateEntry?: number;
  candidateSl?: number;
  qualityScore: number;
  evidenceBreakdown: EvidenceBreakdown;
  classification: RejectionClassification;
  rejectionReasons: string[];
  riskEvaluation?: Record<string, unknown>;
  newsContext?: Record<string, unknown>;
  setupIdentityHint?: string;
}
