/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { settingsService } from '../../src/services/settings_service.ts';
import { TradingEngine } from '../../src/services/trading_engine.ts';
import { supabasePersistence } from '../../src/packages/persistence/supabase_service.ts';
import { auditMigrationSql, runSupabaseMigrationAudit } from '../../scripts/migrate_supabase.ts';

test('Deploy Safety: Non-default settings (Capital=500, Risk=25%, DailyRisk=50%) survive restart, rebuild, and deployment simulation', async () => {
  const engine = TradingEngine.getInstance();

  // Step 1: Set a clearly non-default configuration
  const customSettingsPayload = {
    startingCapital: 500.0,
    riskPercentPerTrade: 25.0,
    maxDailyRiskPercent: 50.0,
    maxConcurrentTrades: 4,
    maxAllowedSlDistance: 15.0,
    minRiskRewardRatio: 2.0,
    maxDrawdownLimitPercent: 35.0,
    minConfidenceThreshold: 80,
    minQualityScore: 75,
    emergencyKillSwitch: false,
    telegramEnabled: true,
    telegramRateLimitPerMinute: 15,
    candleWindow1M: 250,
    aiTimeoutMs: 45000,
    monitorPollIntervalSeconds: 3,
    dedupPoiZoneToleranceUsd: 1.5,
    strategies: [
      { id: 'liquidity_sweep_reversal', name: 'Strategy 1: Liquidity Sweep + Reversal', enabled: true, minConfidence: 80 },
      { id: 'bos_pullback_continuation', name: 'Strategy 2: BOS + Pullback / Continuation', enabled: false, minConfidence: 75 },
      { id: 'fvg_retracement', name: 'Strategy 3: FVG Retracement', enabled: true, minConfidence: 78 },
      { id: 'order_block_reaction', name: 'Strategy 4: Order Block Reaction', enabled: true, minConfidence: 82 },
      { id: 'liquidity_ob_fvg_confluence', name: 'Strategy 5: Confluence & Momentum', enabled: true, minConfidence: 85 },
      { id: 'range_eqh_eql_reversal', name: 'Strategy 6: Range EQH/EQL Reversal', enabled: false, minConfidence: 70 },
    ],
  };

  // Step 2: Save it through the authoritative Settings Service flow
  const saveResult = await settingsService.saveSettings(customSettingsPayload);
  assert.strictEqual(saveResult.success, true, 'Settings save must succeed');

  // Step 3: Read values directly from persistence service
  const persistedDirect = await supabasePersistence.loadPersistedSettings();
  if (persistedDirect.account) {
    assert.strictEqual(Number(persistedDirect.account.starting_capital), 500.0);
  }
  if (persistedDirect.risk) {
    assert.strictEqual(Number(persistedDirect.risk.risk_percent_per_trade), 25.0);
    assert.strictEqual(Number(persistedDirect.risk.max_daily_risk_percent), 50.0);
  }

  // Step 4: Simulate application restart / startup routine (re-invoking loadAndApplySettings)
  await settingsService.loadAndApplySettings();

  // Step 5: Read configuration from runtime engine after startup routine
  const configAfterRestart = engine.getConfig();
  const riskAfterRestart = engine.getRiskEngine().getRisk();
  const accountAfterRestart = engine.getRiskEngine().getAccount();

  assert.strictEqual(accountAfterRestart.currentCapital, 500.0, 'Capital must remain 500 across restart');
  assert.strictEqual(riskAfterRestart.riskPercentPerTrade, 25.0, 'Risk % must remain 25% across restart');
  assert.strictEqual(riskAfterRestart.maxDailyRiskPercent, 50.0, 'Daily risk % must remain 50% across restart');
  assert.strictEqual(riskAfterRestart.maxConcurrentTrades, 4);
  assert.strictEqual(riskAfterRestart.minRiskRewardRatio, 2.0);

  // Step 6: Simulate a deployment cycle (Migration audit execution and schema validation)
  const migrationSqlPath = path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql');
  const auditResult = auditMigrationSql(migrationSqlPath);
  assert.strictEqual(auditResult.isIdempotent, true, 'Migration must be safe and idempotent');
  assert.strictEqual(auditResult.destructiveOperationsFound.length, 0, 'No DROP or TRUNCATE allowed');

  const migrationAuditResult = await runSupabaseMigrationAudit();
  assert.strictEqual(migrationAuditResult.audit.isIdempotent, true);

  // Step 7: Simulate fresh startup routine following deployment
  await settingsService.loadAndApplySettings();

  // Step 8: Verify values remain 500, 25%, 50% and were NOT overwritten by deployment or seed scripts
  const finalConfig = engine.getConfig();
  const finalRisk = engine.getRiskEngine().getRisk();
  const finalAccount = engine.getRiskEngine().getAccount();

  assert.strictEqual(finalAccount.currentCapital, 500.0, 'Capital MUST remain 500.0 after deployment');
  assert.strictEqual(finalRisk.riskPercentPerTrade, 25.0, 'Risk % MUST remain 25.0% after deployment');
  assert.strictEqual(finalRisk.maxDailyRiskPercent, 50.0, 'Daily Risk % MUST remain 50.0% after deployment');
  assert.strictEqual(finalRisk.maxConcurrentTrades, 4, 'Max concurrent trades MUST remain 4 after deployment');
});
