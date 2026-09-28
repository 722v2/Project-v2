/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConfigCategory = 'OPERATIONAL_CONFIG' | 'SENSITIVE_SECRET';

export interface EnvVariableMeta {
  key: string;
  category: ConfigCategory;
  isSecret: boolean;
  currentValue: string | number | boolean;
  description: string;
  scope: 'SERVER_ONLY' | 'SERVER_AND_CLIENT';
  configurableInDashboard: boolean;
}

/**
 * Explicit registry of Environment Variables and their authoritative classifications.
 *
 * SENSITIVE_SECRETS: True authentication credentials, private API tokens, and privileged keys.
 * These MUST remain strictly confidential, server-side only, and never exposed to the client or UI.
 *
 * OPERATIONAL_CONFIG: Operational parameters, risk controls, timeouts, polling intervals, and safety switches.
 * These are NOT secrets and are safe for backend configuration and Dashboard Settings management.
 */
export const ENV_VARIABLE_REGISTRY: Record<string, EnvVariableMeta> = {
  // --- NON-SECRET OPERATIONAL CONFIGURATION (Reclassified & Confirmed) ---
  MAX_CONCURRENT_TRADES: {
    key: 'MAX_CONCURRENT_TRADES',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: 2,
    description: 'Maximum concurrent open trade positions permitted across portfolio',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  CANDLE_WINDOW_1M: {
    key: 'CANDLE_WINDOW_1M',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: 200,
    description: 'Historical 1-minute candlestick lookback depth',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  AI_REASONING_TIMEOUT_MS: {
    key: 'AI_REASONING_TIMEOUT_MS',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: 30000,
    description: 'Maximum timeout in milliseconds for AI context reasoning and analysis calls',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  EMERGENCY_KILL_SWITCH: {
    key: 'EMERGENCY_KILL_SWITCH',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: true,
    description: 'Operationally critical safety shutdown switch (NOT a credential/secret). Halts trade execution and scanner.',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  TELEGRAM_ENABLED: {
    key: 'TELEGRAM_ENABLED',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: false,
    description: 'Master toggle for dispatching alert notifications to Telegram channel',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  MONITOR_PRICE_POLL_INTERVAL_SECONDS: {
    key: 'MONITOR_PRICE_POLL_INTERVAL_SECONDS',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: 5,
    description: 'Polling frequency in seconds for active position monitoring, trailing, and milestone tracking',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  DEDUP_POI_ZONE_TOLERANCE_USD: {
    key: 'DEDUP_POI_ZONE_TOLERANCE_USD',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: 1.00,
    description: 'Setup deduplication spatial price cluster tolerance in USD for POI zones',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },
  TELEGRAM_RATE_LIMIT_PER_MINUTE: {
    key: 'TELEGRAM_RATE_LIMIT_PER_MINUTE',
    category: 'OPERATIONAL_CONFIG',
    isSecret: false,
    currentValue: 10,
    description: 'Maximum Telegram notification alerts dispatched per minute (token bucket limit)',
    scope: 'SERVER_AND_CLIENT',
    configurableInDashboard: true,
  },

  // --- TRUE AUTHENTICATION CREDENTIALS & SENSITIVE SECRETS (Server-Only / Strictly Isolated) ---
  OPENROUTER_API_KEY: {
    key: 'OPENROUTER_API_KEY',
    category: 'SENSITIVE_SECRET',
    isSecret: true,
    currentValue: '[REDACTED_SECRET]',
    description: 'OpenRouter AI API bearer token. Strictly confidential server-side credential.',
    scope: 'SERVER_ONLY',
    configurableInDashboard: false,
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    category: 'SENSITIVE_SECRET',
    isSecret: true,
    currentValue: '[REDACTED_SECRET]',
    description: 'Supabase privileged backend administrative key. Bypasses Row Level Security (RLS). NEVER expose to client.',
    scope: 'SERVER_ONLY',
    configurableInDashboard: false,
  },
  TELEGRAM_BOT_TOKEN: {
    key: 'TELEGRAM_BOT_TOKEN',
    category: 'SENSITIVE_SECRET',
    isSecret: true,
    currentValue: '[REDACTED_SECRET]',
    description: 'Telegram Bot API authentication token. Strictly server-side secret.',
    scope: 'SERVER_ONLY',
    configurableInDashboard: false,
  },
  NEWS_API_KEY: {
    key: 'NEWS_API_KEY',
    category: 'SENSITIVE_SECRET',
    isSecret: true,
    currentValue: '[REDACTED_SECRET]',
    description: 'External financial macroeconomic news service authentication key. Server-side credential.',
    scope: 'SERVER_ONLY',
    configurableInDashboard: false,
  },
  GEMINI_API_KEY: {
    key: 'GEMINI_API_KEY',
    category: 'SENSITIVE_SECRET',
    isSecret: true,
    currentValue: '[REDACTED_SECRET]',
    description: 'Google Gemini API token for server-side AI analysis proxy.',
    scope: 'SERVER_ONLY',
    configurableInDashboard: false,
  },
};

/**
 * List of the 8 variables explicitly reclassified as normal configuration values.
 */
export const RECLASSIFIED_NON_SECRET_KEYS = [
  'MAX_CONCURRENT_TRADES',
  'CANDLE_WINDOW_1M',
  'AI_REASONING_TIMEOUT_MS',
  'EMERGENCY_KILL_SWITCH',
  'TELEGRAM_ENABLED',
  'MONITOR_PRICE_POLL_INTERVAL_SECONDS',
  'DEDUP_POI_ZONE_TOLERANCE_USD',
  'TELEGRAM_RATE_LIMIT_PER_MINUTE',
] as const;

/**
 * List of true secret credentials that must remain strictly isolated.
 */
export const TRUE_SECRET_KEYS = [
  'OPENROUTER_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'NEWS_API_KEY',
  'GEMINI_API_KEY',
] as const;

/**
 * Helper to test whether a given key is classified as a sensitive secret.
 */
export function isSecretKey(key: string): boolean {
  const meta = ENV_VARIABLE_REGISTRY[key];
  if (meta) {
    return meta.isSecret;
  }
  // Any key with KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL in its name defaults to secret
  const lower = key.toLowerCase();
  return lower.includes('key') || lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('credential');
}

/**
 * Helper to retrieve variable metadata.
 */
export function getVariableMeta(key: string): EnvVariableMeta | undefined {
  return ENV_VARIABLE_REGISTRY[key];
}

/**
 * Get all operational configuration values (safe for client / UI).
 */
export function getOperationalConfigs(): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, meta] of Object.entries(ENV_VARIABLE_REGISTRY)) {
    if (!meta.isSecret) {
      result[key] = meta.currentValue;
    }
  }
  return result;
}
