/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppConfig, SystemVersion } from '../types/config.ts';
import {
  ENV_VARIABLE_REGISTRY,
  RECLASSIFIED_NON_SECRET_KEYS,
  TRUE_SECRET_KEYS,
  isSecretKey,
  getVariableMeta,
  getOperationalConfigs,
} from './env_classification.ts';

export {
  ENV_VARIABLE_REGISTRY,
  RECLASSIFIED_NON_SECRET_KEYS,
  TRUE_SECRET_KEYS,
  isSecretKey,
  getVariableMeta,
  getOperationalConfigs,
};

export const SYSTEM_VERSIONS: SystemVersion = {
  strategyVersion: 'v2.0.0-institutional',
  analysisVersion: 'v2.0.0-deterministic',
  riskConfigVersion: 'v2.0.0-dashboard-sync',
  monitoringVersion: 'v2.0.0-independent-5s',
  experienceVersion: 'v2.0.0-advisory-cluster',
};

// Safe helper to read environment configuration (Node / backend runtime)
const readEnvNum = (key: string, fallback: number): number => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    const parsed = Number(process.env[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const readEnvBool = (key: string, fallback: boolean): boolean => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key] === 'true' || process.env[key] === '1';
  }
  return fallback;
};

/**
 * DEFAULT_CONFIG — Authoritative application operational configuration.
 *
 * NOTE: The following operational variables are classified as NON-SECRET configurations:
 * - MAX_CONCURRENT_TRADES (2)
 * - CANDLE_WINDOW_1M (200)
 * - AI_REASONING_TIMEOUT_MS (30000)
 * - EMERGENCY_KILL_SWITCH (true) -> Operationally critical safety stop; NOT a credential/secret
 * - TELEGRAM_ENABLED (false)
 * - MONITOR_PRICE_POLL_INTERVAL_SECONDS (5)
 * - DEDUP_POI_ZONE_TOLERANCE_USD (1.00)
 * - TELEGRAM_RATE_LIMIT_PER_MINUTE (10)
 *
 * True credentials (OPENROUTER_API_KEY, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, NEWS_API_KEY)
 * are NEVER stored or hardcoded here and remain strictly confidential server-side secrets.
 */
export const DEFAULT_CONFIG: AppConfig = {
  symbol: 'XAU/USD',
  timeframes: ['1M', '5M', '15M', '1H'],
  candleWindows: {
    '1M': readEnvNum('CANDLE_WINDOW_1M', 200),
    '5M': 300,
    '15M': 200,
    '1H': 150,
  },
  scannerIntervalSeconds: 60,
  maxStalenessSeconds: 120,
  minConfidenceThreshold: 70,
  minQualityScore: 65,
  dedup: {
    poiZoneToleranceUsd: readEnvNum('DEDUP_POI_ZONE_TOLERANCE_USD', 1.00),
    activeWindowMinutes: 60,
    structureAnchorToleranceUsd: 0.30,
  },
  monitoring: {
    pollIntervalSeconds: readEnvNum('MONITOR_PRICE_POLL_INTERVAL_SECONDS', 5),
    breakevenTriggerR: 1.0,
    partialCloseTp1Ratio: 0.50,
    reversalWatchEnabled: true,
  },
  telegram: {
    enabled: readEnvBool('TELEGRAM_ENABLED', false),
    rateLimitPerMinute: readEnvNum('TELEGRAM_RATE_LIMIT_PER_MINUTE', 10),
    notifyOnTp1: true,
    notifyOnTp2: true,
    notifyOnSl: true,
    notifyOnInvalidation: true,
    notifyOnReversalWatch: true,
  },
  ai: {
    provider: 'openrouter',
    model: typeof process !== 'undefined' && process.env.AI_MODEL ? process.env.AI_MODEL : 'google/gemini-2.5-flash',
    timeoutMs: readEnvNum('AI_REASONING_TIMEOUT_MS', 30000),
  },
  execution: {
    autoTrading: false, // Strict mandate: FALSE during development
    emergencyKillSwitch: readEnvBool('EMERGENCY_KILL_SWITCH', true), // Operational safety switch (non-secret)
    brokerAdapter: 'mock',
  },
  accountDefaults: {
    id: 'DEFAULT',
    startingCapital: 100.00,
    currentCapital: 100.00,
    currency: 'USD',
    updatedAt: Date.now(),
  },
  riskDefaults: {
    id: 'DEFAULT',
    riskPercentPerTrade: 1.00, // 1% = $1.00 on $100
    maxDailyRiskPercent: 3.00, // 3% max daily loss
    maxConcurrentTrades: readEnvNum('MAX_CONCURRENT_TRADES', 2),
    maxAllowedSlDistance: 12.00, // Max $12 SL on Gold
    minRiskRewardRatio: 1.50,
    maxDrawdownLimitPercent: 10.00,
    updatedAt: Date.now(),
  },
};
