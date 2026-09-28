/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountSettings, RiskSettings } from './risk.ts';

export interface AppConfig {
  symbol: string;
  timeframes: ('1M' | '5M' | '15M' | '1H')[];
  candleWindows: {
    '1M': number;
    '5M': number;
    '15M': number;
    '1H': number;
  };
  scannerIntervalSeconds: number;
  maxStalenessSeconds: number;
  minConfidenceThreshold: number;
  minQualityScore: number;
  dedup: {
    poiZoneToleranceUsd: number;
    activeWindowMinutes: number;
    structureAnchorToleranceUsd: number;
  };
  monitoring: {
    pollIntervalSeconds: number;
    breakevenTriggerR: number;
    partialCloseTp1Ratio: number;
    reversalWatchEnabled: boolean;
  };
  telegram: {
    enabled: boolean;
    rateLimitPerMinute: number;
    notifyOnTp1: boolean;
    notifyOnTp2: boolean;
    notifyOnSl: boolean;
    notifyOnInvalidation: boolean;
    notifyOnReversalWatch: boolean;
  };
  ai: {
    provider: string;
    model: string;
    timeoutMs: number;
  };
  execution: {
    autoTrading: boolean; // STRICTLY FALSE during development
    emergencyKillSwitch: boolean;
    brokerAdapter: string;
  };
  accountDefaults: AccountSettings;
  riskDefaults: RiskSettings;
}

export interface SystemVersion {
  strategyVersion: string;
  analysisVersion: string;
  riskConfigVersion: string;
  monitoringVersion: string;
  experienceVersion: string;
}
