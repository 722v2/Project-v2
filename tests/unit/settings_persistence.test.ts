/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsService } from '../../src/services/settings_service.ts';
import { TradingEngine } from '../../src/services/trading_engine.ts';

test('Settings Persistence: Validates mathematical constraints (numeric, >0, no NaN/Infinity)', () => {
  // Test invalid starting capital (negative / zero / NaN)
  const res1 = settingsService.validate({ startingCapital: -50 });
  assert.strictEqual(res1.isValid, false);
  assert.ok(res1.errors.startingCapital);

  const resZeroCapital = settingsService.validate({ startingCapital: 0 });
  assert.strictEqual(resZeroCapital.isValid, false);
  assert.ok(resZeroCapital.errors.startingCapital);

  // Test invalid risk percent (negative / zero / NaN / Infinity)
  const resNegativeRisk = settingsService.validate({ riskPercentPerTrade: -1.0 });
  assert.strictEqual(resNegativeRisk.isValid, false);
  assert.ok(resNegativeRisk.errors.riskPercentPerTrade);

  const resZeroRisk = settingsService.validate({ riskPercentPerTrade: 0 });
  assert.strictEqual(resZeroRisk.isValid, false);
  assert.ok(resZeroRisk.errors.riskPercentPerTrade);

  const resNanRisk = settingsService.validate({ riskPercentPerTrade: NaN });
  assert.strictEqual(resNanRisk.isValid, false);
  assert.ok(resNanRisk.errors.riskPercentPerTrade);

  const resInfRisk = settingsService.validate({ riskPercentPerTrade: Infinity });
  assert.strictEqual(resInfRisk.isValid, false);
  assert.ok(resInfRisk.errors.riskPercentPerTrade);

  // Test max daily risk lower than single trade risk
  const resDailyLower = settingsService.validate({ riskPercentPerTrade: 15.0, maxDailyRiskPercent: 10.0 });
  assert.strictEqual(resDailyLower.isValid, false);
  assert.ok(resDailyLower.errors.maxDailyRiskPercent);
});

test('Settings Persistence: Accepts user-configured risk values without artificial 10%/20% caps', () => {
  // User Requirement 7 Examples:
  // - Risk per trade = 15% -> must be accepted
  const res15 = settingsService.validate({ riskPercentPerTrade: 15.0 });
  assert.strictEqual(res15.isValid, true, 'Risk per trade = 15% must be accepted');

  // - Risk per trade = 30% -> must be accepted
  const res30 = settingsService.validate({ riskPercentPerTrade: 30.0 });
  assert.strictEqual(res30.isValid, true, 'Risk per trade = 30% must be accepted');

  // - Max daily risk = 30% -> must be accepted
  const resDaily30 = settingsService.validate({ riskPercentPerTrade: 10.0, maxDailyRiskPercent: 30.0 });
  assert.strictEqual(resDaily30.isValid, true, 'Max daily risk = 30% must be accepted');

  // - Max daily risk = 50% -> must be accepted
  const resDaily50 = settingsService.validate({ riskPercentPerTrade: 15.0, maxDailyRiskPercent: 50.0 });
  assert.strictEqual(resDaily50.isValid, true, 'Max daily risk = 50% must be accepted');
});

test('Settings Persistence: Persists high-percentage configurations (15% per trade, 30% daily) into runtime engine', async () => {
  const engine = TradingEngine.getInstance();

  const testPayload = {
    startingCapital: 1000.0,
    riskPercentPerTrade: 15.0,
    maxDailyRiskPercent: 30.0,
    maxConcurrentTrades: 2,
    maxAllowedSlDistance: 12.0,
    minRiskRewardRatio: 1.5,
    maxDrawdownLimitPercent: 25.0,
    emergencyKillSwitch: true,
    telegramEnabled: false,
    telegramRateLimitPerMinute: 10,
    candleWindow1M: 200,
    aiTimeoutMs: 30000,
    monitorPollIntervalSeconds: 5,
    dedupPoiZoneToleranceUsd: 1.0,
    strategies: [
      { id: 'liquidity_sweep_reversal', name: 'Liquidity Sweep', enabled: true, minConfidence: 70 },
    ],
  };

  const saveResult = await settingsService.saveSettings(testPayload);
  assert.strictEqual(saveResult.success, true);
  assert.ok(saveResult.message.includes('تم حفظ الإعدادات'));

  // Verify that engine config updated without any silent clamping
  const updatedConfig = engine.getConfig();
  assert.strictEqual(updatedConfig.riskDefaults.riskPercentPerTrade, 15.0);
  assert.strictEqual(updatedConfig.riskDefaults.maxDailyRiskPercent, 30.0);

  // Verify that riskEngine instance updated with the exact values
  const riskEngine = engine.getRiskEngine();
  assert.strictEqual(riskEngine.getRisk().riskPercentPerTrade, 15.0);
  assert.strictEqual(riskEngine.getRisk().maxDailyRiskPercent, 30.0);
});

test('Settings Persistence: Persists 30% per trade and 50% max daily risk without silent clamping', async () => {
  const engine = TradingEngine.getInstance();

  const testPayload = {
    startingCapital: 1000.0,
    riskPercentPerTrade: 30.0,
    maxDailyRiskPercent: 50.0,
    maxConcurrentTrades: 2,
    maxAllowedSlDistance: 12.0,
    minRiskRewardRatio: 1.5,
    maxDrawdownLimitPercent: 50.0,
    emergencyKillSwitch: true,
    telegramEnabled: false,
    telegramRateLimitPerMinute: 10,
    candleWindow1M: 200,
    aiTimeoutMs: 30000,
    monitorPollIntervalSeconds: 5,
    dedupPoiZoneToleranceUsd: 1.0,
    strategies: [
      { id: 'liquidity_sweep_reversal', name: 'Liquidity Sweep', enabled: true, minConfidence: 70 },
    ],
  };

  const saveResult = await settingsService.saveSettings(testPayload);
  assert.strictEqual(saveResult.success, true);

  // Verify exact un-clamped values
  const updatedConfig = engine.getConfig();
  assert.strictEqual(updatedConfig.riskDefaults.riskPercentPerTrade, 30.0);
  assert.strictEqual(updatedConfig.riskDefaults.maxDailyRiskPercent, 50.0);

  const riskEngine = engine.getRiskEngine();
  assert.strictEqual(riskEngine.getRisk().riskPercentPerTrade, 30.0);
  assert.strictEqual(riskEngine.getRisk().maxDailyRiskPercent, 50.0);
});
