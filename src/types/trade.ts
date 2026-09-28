/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegimeType } from './market.ts';
import { SetupDirection, SetupStrategy } from './setup.ts';

export type TradeStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'TP1_REACHED'
  | 'TP2_REACHED'
  | 'SL_REACHED'
  | 'BREAKEVEN'
  | 'PARTIAL_CLOSED'
  | 'MANUALLY_CLOSED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'CLOSED';

export type ReversalWatchStatus = 'NORMAL' | 'REVERSAL_WATCH' | 'EARLY_EXIT_RECOMMENDED';

export interface Trade {
  tradeId: string;
  signalId: string;
  setupId: string;
  symbol: string;
  direction: SetupDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  plannedRiskUsd: number;
  positionSizeLots: number;
  status: TradeStatus;
  openedAt?: number;
  closedAt?: number;
  createdAt: number;
}

export interface TradePosition {
  tradeId: string;
  currentMarketPrice: number;
  unrealizedPnlUsd: number;
  currentRMultiple: number;
  distanceToSl: number;
  distanceToTp1: number;
  distanceToTp2: number;
  mfePrice: number; // Maximum Favorable Excursion price
  mfeR: number; // MFE in terms of R-multiple
  maePrice: number; // Maximum Adverse Excursion price
  maeR: number; // MAE in terms of R-multiple
  tp1Hit: boolean;
  tp1Timestamp?: number;
  tp2Hit: boolean;
  tp2Timestamp?: number;
  slHit: boolean;
  slTimestamp?: number;
  isBreakeven: boolean;
  isPartialClosed: boolean;
  reversalWatchStatus: ReversalWatchStatus;
  lastEvaluatedAt: number;
}

export interface TradeUpdate {
  id: string;
  tradeId: string;
  fromState: TradeStatus;
  toState: TradeStatus;
  priceAtEvent: number;
  realizedR?: number;
  eventType:
    | 'TP1_HIT'
    | 'TP2_HIT'
    | 'SL_HIT'
    | 'BE_MOVED'
    | 'PARTIAL_CLOSE'
    | 'REVERSAL_WATCH'
    | 'EARLY_EXIT'
    | 'INVALIDATION';
  notes: string;
  timestamp: number;
}

export interface TradeOutcome {
  id: string;
  tradeId: string;
  setupId: string;
  signalId: string;
  strategy: SetupStrategy;
  direction: SetupDirection;
  entryPrice: number;
  exitPrice: number;
  exitReason: 'TP1' | 'TP2' | 'SL' | 'EARLY_EXIT' | 'INVALIDATION' | 'EXPIRY' | 'MANUAL';
  pnlUsd: number;
  realizedR: number;
  mfeR: number;
  maeR: number;
  durationMinutes: number;
  marketRegime: RegimeType;
  newsContext: Record<string, unknown>;
  riskConfiguration: Record<string, unknown>;
  strategyVersion: string;
  analysisVersion: string;
  monitoringVersion: string;
  createdAt: number;
}
