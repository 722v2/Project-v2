/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabasePersistence } from '../packages/persistence/supabase_service.ts';
import { TradingEngine } from './trading_engine.ts';
import { AppConfig } from '../types/config.ts';

export interface SettingsSaveResult {
  success: boolean;
  message: string;
  persistedToDatabase: boolean;
  errors?: Record<string, string>;
}

export interface SettingsPayload {
  startingCapital: number;
  riskPercentPerTrade: number;
  maxDailyRiskPercent: number;
  maxConcurrentTrades: number;
  maxAllowedSlDistance: number;
  minRiskRewardRatio: number;
  maxDrawdownLimitPercent: number;
  emergencyKillSwitch: boolean;
  telegramEnabled: boolean;
  telegramRateLimitPerMinute: number;
  candleWindow1M: number;
  aiTimeoutMs: number;
  monitorPollIntervalSeconds: number;
  dedupPoiZoneToleranceUsd: number;
  strategies: Array<{
    id: string;
    name: string;
    enabled: boolean;
    minConfidence: number;
  }>;
}

export class SettingsService {
  private static instance: SettingsService | null = null;

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Validates values against quantitative risk bounds.
   */
  public validate(payload: Partial<SettingsPayload>): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (payload.startingCapital !== undefined) {
      if (isNaN(payload.startingCapital) || payload.startingCapital <= 0) {
        errors.startingCapital = 'رأس المال يجب أن يكون رقماً أكبر من صفر (مثال: 100.00$)';
      } else if (payload.startingCapital > 10000000) {
        errors.startingCapital = 'الحد الأقصى لرأس المال هو 10,000,000$';
      }
    }

    if (payload.riskPercentPerTrade !== undefined) {
      const val = Number(payload.riskPercentPerTrade);
      if (isNaN(val) || !isFinite(val) || val <= 0) {
        errors.riskPercentPerTrade = 'نسبة المخاطرة لكل صفقة يجب أن تكون رقماً موجباً أكبر من الصفر (مثال: 1% أو 15% أو 30%)';
      }
    }

    if (payload.maxDailyRiskPercent !== undefined) {
      const val = Number(payload.maxDailyRiskPercent);
      if (isNaN(val) || !isFinite(val) || val <= 0) {
        errors.maxDailyRiskPercent = 'الحد الأقصى للمخاطرة اليومية يجب أن يكون رقماً موجباً أكبر من الصفر (مثال: 3% أو 30% أو 50%)';
      } else if (payload.riskPercentPerTrade !== undefined && val < Number(payload.riskPercentPerTrade)) {
        errors.maxDailyRiskPercent = 'الحد الأقصى للمخاطرة اليومية لا يمكن أن يكون أقل من مخاطرة الصفقة الواحدة';
      }
    }

    if (payload.maxConcurrentTrades !== undefined) {
      if (isNaN(payload.maxConcurrentTrades) || payload.maxConcurrentTrades < 1 || payload.maxConcurrentTrades > 10) {
        errors.maxConcurrentTrades = 'الحد الأقصى للصفقات المتزامنة يجب أن يكون بين 1 و 10';
      }
    }

    if (payload.maxAllowedSlDistance !== undefined) {
      if (isNaN(payload.maxAllowedSlDistance) || payload.maxAllowedSlDistance < 1.0 || payload.maxAllowedSlDistance > 50.0) {
        errors.maxAllowedSlDistance = 'أقصى مسافة لوقف الخسارة يجب أن تكون بين 1.0$ و 50.0$';
      }
    }

    if (payload.minRiskRewardRatio !== undefined) {
      if (isNaN(payload.minRiskRewardRatio) || payload.minRiskRewardRatio < 1.0 || payload.minRiskRewardRatio > 10.0) {
        errors.minRiskRewardRatio = 'الحد الأدنى لنسبة العائد للمخاطرة يجب أن يكون بين 1.0 و 10.0 (مثال: 1.5)';
      }
    }

    if (payload.maxDrawdownLimitPercent !== undefined) {
      if (isNaN(payload.maxDrawdownLimitPercent) || payload.maxDrawdownLimitPercent < 1.0 || payload.maxDrawdownLimitPercent > 50.0) {
        errors.maxDrawdownLimitPercent = 'حد التراجع الأقصى Drawdown يجب أن يكون بين 1.0% و 50.0%';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Persists settings to Supabase, updates local persistent storage,
   * and synchronizes runtime engine state.
   */
  public async saveSettings(payload: SettingsPayload): Promise<SettingsSaveResult> {
    // 1. Validation phase
    const validation = this.validate(payload);
    if (!validation.isValid) {
      return {
        success: false,
        message: '✕ فشل حفظ الإعدادات: يرجى تصحيح القيم المدخلة',
        persistedToDatabase: false,
        errors: validation.errors,
      };
    }

    try {
      // 2. Persist to Supabase Account & Risk Settings tables
      const [accRes, riskRes, stratRes] = await Promise.all([
        supabasePersistence.persistAccountSettings({
          starting_capital: payload.startingCapital,
          current_capital: payload.startingCapital,
          currency: 'USD',
        }),
        supabasePersistence.persistRiskSettings({
          risk_percent_per_trade: payload.riskPercentPerTrade,
          max_daily_risk_percent: payload.maxDailyRiskPercent,
          max_concurrent_trades: payload.maxConcurrentTrades,
          max_allowed_sl_distance: payload.maxAllowedSlDistance,
          min_risk_reward_ratio: payload.minRiskRewardRatio,
          max_drawdown_limit_percent: payload.maxDrawdownLimitPercent,
        }),
        supabasePersistence.persistStrategySettings(
          payload.strategies.map((s) => ({
            strategy_id: s.id,
            name: s.name,
            is_enabled: s.enabled,
            min_confidence: s.minConfidence,
          }))
        ),
      ]);

      // 3. Update runtime engine configuration & Risk Engine
      const engine = TradingEngine.getInstance();
      const now = Date.now();
      engine.updateConfig({
        accountDefaults: {
          id: 'DEFAULT',
          startingCapital: payload.startingCapital,
          currentCapital: payload.startingCapital,
          currency: 'USD',
          updatedAt: now,
        },
        riskDefaults: {
          id: 'DEFAULT',
          riskPercentPerTrade: payload.riskPercentPerTrade,
          maxDailyRiskPercent: payload.maxDailyRiskPercent,
          maxConcurrentTrades: payload.maxConcurrentTrades,
          maxAllowedSlDistance: payload.maxAllowedSlDistance,
          minRiskRewardRatio: payload.minRiskRewardRatio,
          maxDrawdownLimitPercent: payload.maxDrawdownLimitPercent,
          updatedAt: now,
        },
        execution: {
          ...engine.getConfig().execution,
          emergencyKillSwitch: payload.emergencyKillSwitch,
        },
        telegram: {
          ...engine.getConfig().telegram,
          enabled: payload.telegramEnabled,
          rateLimitPerMinute: payload.telegramRateLimitPerMinute,
        },
        candleWindows: {
          ...engine.getConfig().candleWindows,
          '1M': payload.candleWindow1M,
        },
        ai: {
          ...engine.getConfig().ai,
          timeoutMs: payload.aiTimeoutMs,
        },
        monitoring: {
          ...engine.getConfig().monitoring,
          pollIntervalSeconds: payload.monitorPollIntervalSeconds,
        },
        dedup: {
          ...engine.getConfig().dedup,
          poiZoneToleranceUsd: payload.dedupPoiZoneToleranceUsd,
        },
      });

      const dbConfirmed = accRes.persistedToDatabase && riskRes.persistedToDatabase;

      if (dbConfirmed) {
        return {
          success: true,
          message: '✓ تم حفظ الإعدادات بنجاح وتأكيد الحفظ في قاعدة بيانات Supabase وتحديث المحرك الفوري',
          persistedToDatabase: true,
        };
      } else {
        return {
          success: true,
          message: '✓ تم حفظ الإعدادات بنجاح في وحدة التخزين الدائمة وتحديث محرك التداول المباشر',
          persistedToDatabase: false,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `✕ فشل حفظ الإعدادات: ${err.message || 'خطأ غير متوقع'}`,
        persistedToDatabase: false,
      };
    }
  }

  /**
   * Loads initial settings from persistent storage and applies them to the engine.
   */
  public async loadAndApplySettings(): Promise<void> {
    try {
      const persisted = await supabasePersistence.loadPersistedSettings();
      const engine = TradingEngine.getInstance();
      const current = engine.getConfig();

      const partial: Partial<AppConfig> = {};

      if (persisted.account) {
        partial.accountDefaults = {
          ...current.accountDefaults,
          startingCapital: persisted.account.starting_capital,
          currentCapital: persisted.account.current_capital,
          currency: persisted.account.currency || 'USD',
        };
      }

      if (persisted.risk) {
        partial.riskDefaults = {
          ...current.riskDefaults,
          riskPercentPerTrade: Number(persisted.risk.risk_percent_per_trade),
          maxDailyRiskPercent: Number(persisted.risk.max_daily_risk_percent),
          maxConcurrentTrades: Number(persisted.risk.max_concurrent_trades),
          maxAllowedSlDistance: Number(persisted.risk.max_allowed_sl_distance),
          minRiskRewardRatio: Number(persisted.risk.min_risk_reward_ratio),
          maxDrawdownLimitPercent: Number(persisted.risk.max_drawdown_limit_percent),
        };
      }

      if (Object.keys(partial).length > 0) {
        engine.updateConfig(partial);
      }
    } catch (err) {
      console.warn('Error loading persisted settings into engine:', err);
    }
  }
}

export const settingsService = SettingsService.getInstance();
