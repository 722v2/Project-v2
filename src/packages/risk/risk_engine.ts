/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountSettings, RiskSettings, RiskValidationResult, SizingCalculation } from '../../types/risk.ts';

/**
 * Institutional risk and position sizing engine for XAU/USD.
 * Standard lot for Gold (XAU/USD) = 100 troy ounces.
 * $1 movement in Gold price = $100 per 1.00 standard lot ($1.00 per 0.01 micro lot).
 */
export class RiskEngine {
  private account: AccountSettings;
  private risk: RiskSettings;

  constructor(account: AccountSettings, risk: RiskSettings) {
    this.account = account;
    this.risk = risk;
  }

  public updateSettings(account?: Partial<AccountSettings>, risk?: Partial<RiskSettings>) {
    if (account) this.account = { ...this.account, ...account, updatedAt: Date.now() };
    if (risk) this.risk = { ...this.risk, ...risk, updatedAt: Date.now() };
  }

  public getAccount(): AccountSettings {
    return { ...this.account };
  }

  public getRisk(): RiskSettings {
    return { ...this.risk };
  }

  /**
   * Evaluates candidate trade risk parameters and calculates strict position sizing.
   */
  public evaluateTradeRisk(params: {
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    currentOpenTradesCount?: number;
  }): RiskValidationResult {
    const violations: string[] = [];
    const openTrades = params.currentOpenTradesCount ?? 0;

    // 1. Max concurrent trades
    if (openTrades >= this.risk.maxConcurrentTrades) {
      violations.push(
        `Max concurrent trades limit reached (${openTrades}/${this.risk.maxConcurrentTrades})`
      );
    }

    // 2. SL Distance
    const slDistance = Math.abs(params.entryPrice - params.stopLoss);
    if (slDistance <= 0.01) {
      violations.push('Stop loss is too close or equal to entry price');
    }
    if (slDistance > this.risk.maxAllowedSlDistance) {
      violations.push(
        `SL distance ($${slDistance.toFixed(2)}) exceeds maximum allowed ($${this.risk.maxAllowedSlDistance.toFixed(2)})`
      );
    }

    // 3. Risk-Reward Ratio
    const tpDistance = Math.abs(params.takeProfit1 - params.entryPrice);
    const calculatedRr = slDistance > 0 ? tpDistance / slDistance : 0;
    if (calculatedRr < this.risk.minRiskRewardRatio) {
      violations.push(
        `Risk/Reward ratio (${calculatedRr.toFixed(2)}) is below minimum required (${this.risk.minRiskRewardRatio.toFixed(2)})`
      );
    }

    // 4. Directional validity
    if (params.direction === 'BUY' && params.stopLoss >= params.entryPrice) {
      violations.push('Invalid BUY geometry: Stop loss is above or at entry price');
    }
    if (params.direction === 'SELL' && params.stopLoss <= params.entryPrice) {
      violations.push('Invalid SELL geometry: Stop loss is below or at entry price');
    }

    // Calculate dollar risk amount: e.g. 1% of $100 = $1.00
    const plannedRiskUsd = Number(((this.account.currentCapital * this.risk.riskPercentPerTrade) / 100).toFixed(2));

    // For Gold: 1 lot = 100 oz. Dollar loss for slDistance = lots * 100 * slDistance
    // Lots = plannedRiskUsd / (100 * slDistance)
    // Minimum lot step is typically 0.01
    const rawLots = plannedRiskUsd / (100 * slDistance);
    const positionSizeLots = Math.max(0.01, Number(rawLots.toFixed(2)));
    const estimatedMaxLossUsd = Number((positionSizeLots * 100 * slDistance).toFixed(2));

    const sizing: SizingCalculation = {
      capital: this.account.currentCapital,
      riskPercent: this.risk.riskPercentPerTrade,
      plannedRiskUsd,
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss,
      slDistanceUsd: Number(slDistance.toFixed(2)),
      positionSizeLots,
      pointValueUsd: 100 * positionSizeLots,
      estimatedMaxLossUsd,
    };

    return {
      isValid: violations.length === 0,
      violations,
      sizing,
    };
  }
}
