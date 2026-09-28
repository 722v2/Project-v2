/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AccountSettings {
  id: string;
  startingCapital: number;
  currentCapital: number;
  currency: string;
  updatedAt: number;
}

export interface RiskSettings {
  id: string;
  riskPercentPerTrade: number;
  maxDailyRiskPercent: number;
  maxConcurrentTrades: number;
  maxAllowedSlDistance: number;
  minRiskRewardRatio: number;
  maxDrawdownLimitPercent: number;
  updatedAt: number;
}

export interface SizingCalculation {
  capital: number;
  riskPercent: number;
  plannedRiskUsd: number;
  entryPrice: number;
  stopLoss: number;
  slDistanceUsd: number;
  positionSizeLots: number;
  pointValueUsd: number;
  estimatedMaxLossUsd: number;
}

export interface RiskValidationResult {
  isValid: boolean;
  violations: string[];
  sizing?: SizingCalculation;
}
