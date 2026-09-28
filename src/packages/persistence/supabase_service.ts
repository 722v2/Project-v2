/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketSnapshot, Candle } from '../../types/market.ts';
import { CandidateSetup } from '../../types/setup.ts';
import { Signal, RejectionRecord } from '../../types/signal.ts';
import { Trade, TradePosition, TradeUpdate, TradeOutcome } from '../../types/trade.ts';

export interface SupabaseHealth {
  connected: boolean;
  url: string;
  latencyMs: number;
  tablesVerified: string[];
  tablesPendingMigration: string[];
  error?: string;
}

export interface AccountSettingsRecord {
  id: string;
  starting_capital: number;
  current_capital: number;
  currency: string;
  updated_at?: string;
}

export interface RiskSettingsRecord {
  id: string;
  risk_percent_per_trade: number;
  max_daily_risk_percent: number;
  max_concurrent_trades: number;
  max_allowed_sl_distance: number;
  min_risk_reward_ratio: number;
  max_drawdown_limit_percent: number;
  updated_at?: string;
}

export interface StrategySettingRecord {
  strategy_id: string;
  name: string;
  is_enabled: boolean;
  min_confidence: number;
  max_active_setups?: number;
  custom_params?: Record<string, any>;
  updated_at?: string;
}

export class SupabasePersistenceService {
  private readonly url: string;
  private readonly key: string;
  private isServerSide: boolean;

  constructor(customUrl?: string, customKey?: string) {
    // In Node.js server-side, load from process.env; NEVER expose service role key to frontend
    this.isServerSide = typeof window === 'undefined';
    this.url = (customUrl !== undefined ? customUrl : (typeof process !== 'undefined' ? (process.env.SUPABASE_URL || '') : '')).replace(/\/+$/, '');
    
    // Choose service role key strictly on server side; anon key on client side if available
    const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
    const anonKey = typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : '';
    const defaultKey = this.isServerSide ? (serviceKey || anonKey) : anonKey;
    this.key = customKey !== undefined ? customKey : (defaultKey || '');
  }

  public isConfigured(): boolean {
    return Boolean(this.url && this.key);
  }

  public getUrl(): string {
    return this.url;
  }

  public async checkHealth(): Promise<SupabaseHealth> {
    if (!this.isConfigured()) {
      return {
        connected: false,
        url: this.url || 'Not configured',
        latencyMs: 0,
        tablesVerified: [],
        tablesPendingMigration: [],
        error: 'SUPABASE_URL or API key is not configured',
      };
    }

    const start = Date.now();
    const verified: string[] = [];
    const pendingMigration: string[] = [];

    try {
      const pingRes = await fetch(`${this.url}/rest/v1/`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
        },
      });

      const latencyMs = Date.now() - start;

      if (!pingRes.ok) {
        return {
          connected: false,
          url: this.url,
          latencyMs,
          tablesVerified: [],
          tablesPendingMigration: [],
          error: `Supabase ping failed with status ${pingRes.status}`,
        };
      }

      // Check key tables
      const tablesToCheck = [
        'account_settings',
        'risk_settings',
        'strategy_settings',
        'market_snapshots',
        'signals',
        'setups',
        'trades',
        'rejected_setups',
        'duplicate_preventions',
      ];

      for (const tbl of tablesToCheck) {
        try {
          const tblRes = await fetch(`${this.url}/rest/v1/${tbl}?limit=1`, {
            headers: {
              apikey: this.key,
              Authorization: `Bearer ${this.key}`,
            },
          });
          if (tblRes.status === 200) {
            verified.push(tbl);
          } else if (tblRes.status === 404) {
            pendingMigration.push(tbl);
          }
        } catch {
          pendingMigration.push(tbl);
        }
      }

      return {
        connected: true,
        url: this.url,
        latencyMs,
        tablesVerified: verified,
        tablesPendingMigration: pendingMigration,
      };
    } catch (err: any) {
      return {
        connected: false,
        url: this.url,
        latencyMs: Date.now() - start,
        tablesVerified: [],
        tablesPendingMigration: [],
        error: err.message,
      };
    }
  }

  private async postRow(table: string, payload: Record<string, any>): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
      return res.status === 201 || res.status === 200;
    } catch {
      return false;
    }
  }

  private async upsertRow(table: string, payload: Record<string, any>, onConflictField = 'id'): Promise<{ success: boolean; error?: string; status?: number }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase URL or API Key is not configured' };
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/${table}?on_conflict=${onConflictField}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 200 || res.status === 201 || res.status === 204) {
        return { success: true, status: res.status };
      }

      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Supabase responded with status ${res.status}: ${errText}`,
        status: res.status,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  // --- SETTINGS PERSISTENCE (REQUIREMENT 17) ---

  public async persistAccountSettings(settings: {
    starting_capital: number;
    current_capital: number;
    currency?: string;
  }): Promise<{ success: boolean; error?: string; persistedToDatabase: boolean }> {
    const payload: AccountSettingsRecord = {
      id: 'DEFAULT',
      starting_capital: Number(settings.starting_capital),
      current_capital: Number(settings.current_capital),
      currency: settings.currency || 'USD',
      updated_at: new Date().toISOString(),
    };

    // 1. Always update local storage replica for instantaneous and offline persistence
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('gold_bot_account_settings', JSON.stringify(payload));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    // 2. If Supabase configured, commit write to database
    if (this.isConfigured()) {
      const res = await this.upsertRow('account_settings', payload, 'id');
      if (res.success) {
        return { success: true, persistedToDatabase: true };
      }
      return {
        success: true, // Saved locally, but DB reported an issue
        persistedToDatabase: false,
        error: res.error,
      };
    }

    return {
      success: true,
      persistedToDatabase: false,
      error: 'Supabase credentials not configured; saved to local persistent storage.',
    };
  }

  public async persistRiskSettings(settings: {
    risk_percent_per_trade: number;
    max_daily_risk_percent: number;
    max_concurrent_trades: number;
    max_allowed_sl_distance: number;
    min_risk_reward_ratio: number;
    max_drawdown_limit_percent: number;
  }): Promise<{ success: boolean; error?: string; persistedToDatabase: boolean }> {
    const payload: RiskSettingsRecord = {
      id: 'DEFAULT',
      risk_percent_per_trade: Number(settings.risk_percent_per_trade),
      max_daily_risk_percent: Number(settings.max_daily_risk_percent),
      max_concurrent_trades: Number(settings.max_concurrent_trades),
      max_allowed_sl_distance: Number(settings.max_allowed_sl_distance),
      min_risk_reward_ratio: Number(settings.min_risk_reward_ratio),
      max_drawdown_limit_percent: Number(settings.max_drawdown_limit_percent),
      updated_at: new Date().toISOString(),
    };

    // 1. Update local storage replica
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('gold_bot_risk_settings', JSON.stringify(payload));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    // 2. If Supabase configured, commit to database
    if (this.isConfigured()) {
      const res = await this.upsertRow('risk_settings', payload, 'id');
      if (res.success) {
        return { success: true, persistedToDatabase: true };
      }
      return {
        success: true,
        persistedToDatabase: false,
        error: res.error,
      };
    }

    return {
      success: true,
      persistedToDatabase: false,
      error: 'Supabase credentials not configured; saved to local persistent storage.',
    };
  }

  public async persistStrategySettings(strategies: Array<{
    strategy_id: string;
    name: string;
    is_enabled: boolean;
    min_confidence: number;
    custom_params?: Record<string, any>;
  }>): Promise<{ success: boolean; error?: string; persistedToDatabase: boolean }> {
    // 1. Update local storage replica
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('gold_bot_strategy_settings', JSON.stringify(strategies));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }

    // 2. If Supabase configured, commit each strategy
    if (this.isConfigured()) {
      let allSuccess = true;
      let lastErr = '';
      for (const s of strategies) {
        const payload: StrategySettingRecord = {
          strategy_id: s.strategy_id,
          name: s.name,
          is_enabled: s.is_enabled,
          min_confidence: s.min_confidence,
          custom_params: s.custom_params || {},
          updated_at: new Date().toISOString(),
        };
        const res = await this.upsertRow('strategy_settings', payload, 'strategy_id');
        if (!res.success) {
          allSuccess = false;
          lastErr = res.error || '';
        }
      }
      return {
        success: true,
        persistedToDatabase: allSuccess,
        error: allSuccess ? undefined : lastErr,
      };
    }

    return {
      success: true,
      persistedToDatabase: false,
      error: 'Supabase credentials not configured; saved to local persistent storage.',
    };
  }

  public async persistGeneralConfig(config: Record<string, any>): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('gold_bot_general_config', JSON.stringify(config));
      } catch (e) {
        console.warn('LocalStorage general config save error:', e);
      }
    }
  }

  public async loadPersistedSettings(): Promise<{
    account?: AccountSettingsRecord;
    risk?: RiskSettingsRecord;
    strategies?: StrategySettingRecord[];
    generalConfig?: Record<string, any>;
  }> {
    const result: {
      account?: AccountSettingsRecord;
      risk?: RiskSettingsRecord;
      strategies?: StrategySettingRecord[];
      generalConfig?: Record<string, any>;
    } = {};

    // 1. Try to load from Supabase if configured (Persistent Source of Truth)
    if (this.isConfigured()) {
      try {
        const [accRes, riskRes, stratRes] = await Promise.allSettled([
          fetch(`${this.url}/rest/v1/account_settings?id=eq.DEFAULT&limit=1`, {
            headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
          }),
          fetch(`${this.url}/rest/v1/risk_settings?id=eq.DEFAULT&limit=1`, {
            headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
          }),
          fetch(`${this.url}/rest/v1/strategy_settings?order=strategy_id.asc`, {
            headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
          }),
        ]);

        if (accRes.status === 'fulfilled' && accRes.value.ok) {
          const data = await accRes.value.json();
          if (Array.isArray(data) && data[0]) {
            result.account = data[0];
            // Cache to local storage replica
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('gold_bot_account_settings', JSON.stringify(data[0]));
              } catch {}
            }
          }
        }

        if (riskRes.status === 'fulfilled' && riskRes.value.ok) {
          const data = await riskRes.value.json();
          if (Array.isArray(data) && data[0]) {
            result.risk = data[0];
            // Cache to local storage replica
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('gold_bot_risk_settings', JSON.stringify(data[0]));
              } catch {}
            }
          }
        }

        if (stratRes.status === 'fulfilled' && stratRes.value.ok) {
          const data = await stratRes.value.json();
          if (Array.isArray(data) && data.length > 0) {
            result.strategies = data;
            // Extract any generalConfig embedded in custom_params
            for (const item of data) {
              if (item.custom_params && item.custom_params._generalConfig) {
                result.generalConfig = item.custom_params._generalConfig;
                break;
              }
            }
            // Cache to local storage replica
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('gold_bot_strategy_settings', JSON.stringify(data));
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch settings from Supabase, falling back to local cache:', err);
      }
    }

    // 2. Fall back to local storage cache if not loaded from Supabase
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (!result.account) {
          const localAcc = localStorage.getItem('gold_bot_account_settings');
          if (localAcc) result.account = JSON.parse(localAcc);
        }
        if (!result.risk) {
          const localRisk = localStorage.getItem('gold_bot_risk_settings');
          if (localRisk) result.risk = JSON.parse(localRisk);
        }
        if (!result.strategies) {
          const localStrat = localStorage.getItem('gold_bot_strategy_settings');
          if (localStrat) result.strategies = JSON.parse(localStrat);
        }
        if (!result.generalConfig) {
          const localGen = localStorage.getItem('gold_bot_general_config');
          if (localGen) result.generalConfig = JSON.parse(localGen);
        }
      } catch (e) {
        console.warn('LocalStorage load error:', e);
      }
    }

    return result;
  }

  // --- MARKET, SIGNALS, TRADES PERSISTENCE ---

  public async persistMarketSnapshot(s: MarketSnapshot): Promise<boolean> {
    return this.postRow('market_snapshots', {
      symbol: s.symbol,
      timestamp: new Date(s.timestamp).toISOString(),
      bid_price: s.bidPrice,
      ask_price: s.askPrice,
      mid_price: s.midPrice,
      spread: s.spread,
      provider: s.provider,
      is_stale: s.isStale,
      latency_ms: s.latencyMs,
    });
  }

  public async persistSignal(sig: Signal): Promise<boolean> {
    // Also save in local storage cache
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_cached_signals') || '[]';
        const list = JSON.parse(raw);
        localStorage.setItem('gold_bot_cached_signals', JSON.stringify([sig, ...list.slice(0, 49)]));
      } catch {}
    }

    return this.postRow('signals', {
      signal_id: sig.signalId,
      setup_id: sig.setupId,
      symbol: sig.symbol,
      strategy: sig.strategy,
      direction: sig.direction,
      timeframe: sig.timeframe,
      entry_price: sig.entryPrice,
      stop_loss: sig.stopLoss,
      take_profit_1: sig.takeProfit1,
      take_profit_2: sig.takeProfit2,
      risk_reward_1: sig.riskReward1,
      risk_reward_2: sig.riskReward2,
      confidence: sig.confidence,
      quality_score: sig.qualityScore,
      market_regime: sig.marketRegime,
      evidence_breakdown: sig.evidenceBreakdown,
      analysis_reasons: sig.analysisReasons,
      risk_notes: sig.riskNotes,
      news_context: sig.newsContext,
      invalidating_conditions: sig.invalidatingConditions,
      strategy_version: sig.strategyVersion,
      analysis_version: sig.analysisVersion,
      status: sig.status,
    });
  }

  public async persistRejectedSetup(r: RejectionRecord): Promise<boolean> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_cached_rejected') || '[]';
        const list = JSON.parse(raw);
        localStorage.setItem('gold_bot_cached_rejected', JSON.stringify([r, ...list.slice(0, 49)]));
      } catch {}
    }

    return this.postRow('rejected_setups', {
      strategy: r.strategy,
      direction: r.direction,
      market_regime: r.marketRegime,
      candidate_entry: r.candidateEntry,
      candidate_sl: r.candidateSl,
      quality_score: r.qualityScore,
      evidence_breakdown: r.evidenceBreakdown,
      rejection_classification: r.classification,
      rejection_reasons: r.rejectionReasons,
      risk_evaluation: r.riskEvaluation,
      news_context: r.newsContext,
    });
  }

  public async persistDuplicatePrevention(payload: {
    attempted_setup_id: string;
    existing_setup_id: string;
    strategy: string;
    direction: string;
    new_candidate_price: number;
    existing_poi_zone_low: number;
    existing_poi_zone_high: number;
    dedup_reason: string;
  }): Promise<boolean> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_cached_dedup') || '[]';
        const list = JSON.parse(raw);
        localStorage.setItem('gold_bot_cached_dedup', JSON.stringify([payload, ...list.slice(0, 49)]));
      } catch {}
    }

    return this.postRow('duplicate_preventions', payload);
  }

  public async persistTradeOutcome(out: TradeOutcome): Promise<boolean> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_cached_trades') || '[]';
        const list = JSON.parse(raw);
        localStorage.setItem('gold_bot_cached_trades', JSON.stringify([out, ...list.slice(0, 49)]));
      } catch {}
    }

    return this.postRow('trade_outcomes', {
      trade_id: out.tradeId,
      setup_id: out.setupId,
      signal_id: out.signalId,
      strategy: out.strategy,
      direction: out.direction,
      entry_price: out.entryPrice,
      exit_price: out.exitPrice,
      exit_reason: out.exitReason,
      pnl_usd: out.pnlUsd,
      realized_r: out.realizedR,
      mfe_r: out.mfeR,
      mae_r: out.maeR,
      duration_minutes: out.durationMinutes,
      market_regime: out.marketRegime,
      news_context: out.newsContext,
      risk_configuration: out.riskConfiguration,
      strategy_version: out.strategyVersion,
      analysis_version: out.analysisVersion,
      monitoring_version: out.monitoringVersion,
    });
  }

  public async fetchHistoricalSignals(limit = 30): Promise<Signal[]> {
    if (this.isConfigured()) {
      try {
        const res = await fetch(`${this.url}/rest/v1/signals?order=created_at.desc&limit=${limit}`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            return rows.map((r: any) => ({
              signalId: r.signal_id || r.id,
              setupId: r.setup_id,
              symbol: r.symbol,
              strategy: r.strategy,
              direction: r.direction,
              timeframe: r.timeframe,
              entryPrice: Number(r.entry_price),
              stopLoss: Number(r.stop_loss),
              takeProfit1: Number(r.take_profit_1),
              takeProfit2: Number(r.take_profit_2),
              riskReward1: Number(r.risk_reward_1),
              riskReward2: Number(r.risk_reward_2),
              confidence: Number(r.confidence),
              qualityScore: Number(r.quality_score),
              marketRegime: r.market_regime,
              evidenceBreakdown: r.evidence_breakdown || {},
              analysisReasons: r.analysis_reasons || [],
              riskNotes: r.risk_notes || [],
              newsContext: r.news_context || {},
              invalidatingConditions: r.invalidating_conditions || [],
              strategyVersion: r.strategy_version,
              analysisVersion: r.analysis_version,
              createdAt: new Date(r.created_at).getTime(),
              status: r.status || 'ACTIVE',
            }));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch signals from Supabase:', e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_cached_signals');
        if (raw) return JSON.parse(raw);
      } catch {}
    }

    return [];
  }

  public async fetchHistoricalTrades(limit = 30): Promise<TradeOutcome[]> {
    if (this.isConfigured()) {
      try {
        const res = await fetch(`${this.url}/rest/v1/trade_outcomes?order=created_at.desc&limit=${limit}`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            return rows.map((r: any) => ({
              id: r.id,
              tradeId: r.trade_id,
              setupId: r.setup_id,
              signalId: r.signal_id,
              strategy: r.strategy,
              direction: r.direction,
              entryPrice: Number(r.entry_price),
              exitPrice: Number(r.exit_price),
              exitReason: r.exit_reason,
              pnlUsd: Number(r.pnl_usd),
              realizedR: Number(r.realized_r),
              mfeR: Number(r.mfe_r),
              maeR: Number(r.mae_r),
              durationMinutes: Number(r.duration_minutes),
              marketRegime: r.market_regime,
              newsContext: r.news_context || {},
              riskConfiguration: r.risk_configuration || {},
              strategyVersion: r.strategy_version,
              analysisVersion: r.analysis_version,
              monitoringVersion: r.monitoring_version,
              createdAt: new Date(r.created_at).getTime(),
            }));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch trades from Supabase:', e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_cached_trades');
        if (raw) return JSON.parse(raw);
      } catch {}
    }

    return [];
  }
}

export const supabasePersistence = new SupabasePersistenceService();
