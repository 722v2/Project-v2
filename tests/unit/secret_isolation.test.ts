/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ENV_VARIABLE_REGISTRY,
  RECLASSIFIED_NON_SECRET_KEYS,
  TRUE_SECRET_KEYS,
  isSecretKey,
  DEFAULT_CONFIG,
} from '../../src/config/index.ts';

test('Secret Isolation: Client source code never hardcodes sensitive keys', () => {
  const sensitivePatterns = [
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][a-zA-Z0-9_\-\.]+['"]/,
    /OPENROUTER_API_KEY\s*=\s*['"][a-zA-Z0-9_\-\.]+['"]/,
    /TELEGRAM_BOT_TOKEN\s*=\s*['"][a-zA-Z0-9_\-\.]+['"]/,
    /NEWS_API_KEY\s*=\s*['"][a-zA-Z0-9_\-\.]+['"]/,
  ];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
          scanDir(fullPath);
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of sensitivePatterns) {
          assert.strictEqual(
            pattern.test(content),
            false,
            `Secret pattern detected in source file: ${fullPath}`
          );
        }
      }
    }
  }

  scanDir(path.resolve('./src'));
});

test('Secret Isolation: Client config defaults do not leak service-role keys', async () => {
  const config = await import('../../src/config/index.ts');
  assert.strictEqual(
    (config as any).DEFAULT_CONFIG.SUPABASE_SERVICE_ROLE_KEY,
    undefined,
    'Client config must not contain SUPABASE_SERVICE_ROLE_KEY'
  );
  assert.strictEqual(
    (config as any).DEFAULT_CONFIG.OPENROUTER_API_KEY,
    undefined,
    'Client config must not contain OPENROUTER_API_KEY'
  );
  assert.strictEqual(
    (config as any).DEFAULT_CONFIG.TELEGRAM_BOT_TOKEN,
    undefined,
    'Client config must not contain TELEGRAM_BOT_TOKEN'
  );
});

test('Variable Classification: 8 specified variables are correctly classified as non-secrets', () => {
  const expectedValues: Record<string, any> = {
    MAX_CONCURRENT_TRADES: 2,
    CANDLE_WINDOW_1M: 200,
    AI_REASONING_TIMEOUT_MS: 30000,
    EMERGENCY_KILL_SWITCH: true,
    TELEGRAM_ENABLED: false,
    MONITOR_PRICE_POLL_INTERVAL_SECONDS: 5,
    DEDUP_POI_ZONE_TOLERANCE_USD: 1.00,
    TELEGRAM_RATE_LIMIT_PER_MINUTE: 10,
  };

  for (const key of RECLASSIFIED_NON_SECRET_KEYS) {
    const meta = ENV_VARIABLE_REGISTRY[key];
    assert.ok(meta, `Variable ${key} must exist in registry`);
    assert.strictEqual(
      meta.isSecret,
      false,
      `Variable ${key} must NOT be classified as secret`
    );
    assert.strictEqual(
      meta.category,
      'OPERATIONAL_CONFIG',
      `Variable ${key} must have category OPERATIONAL_CONFIG`
    );
    assert.strictEqual(
      isSecretKey(key),
      false,
      `isSecretKey(${key}) must return false`
    );
    assert.strictEqual(
      meta.currentValue,
      expectedValues[key],
      `Variable ${key} current value must match expected ${expectedValues[key]}`
    );
  }
});

test('Variable Classification: True secrets remain strictly classified as secrets', () => {
  for (const key of TRUE_SECRET_KEYS) {
    const meta = ENV_VARIABLE_REGISTRY[key];
    assert.ok(meta, `Secret key ${key} must exist in registry`);
    assert.strictEqual(
      meta.isSecret,
      true,
      `Secret key ${key} MUST be classified as secret`
    );
    assert.strictEqual(
      meta.category,
      'SENSITIVE_SECRET',
      `Secret key ${key} must have category SENSITIVE_SECRET`
    );
    assert.strictEqual(
      isSecretKey(key),
      true,
      `isSecretKey(${key}) must return true`
    );
    assert.strictEqual(
      meta.configurableInDashboard,
      false,
      `Secret key ${key} must NEVER be configurable in Dashboard Settings`
    );
  }
});

test('Operational Safety: EMERGENCY_KILL_SWITCH is a safety control, not a credential', () => {
  const meta = ENV_VARIABLE_REGISTRY.EMERGENCY_KILL_SWITCH;
  assert.ok(meta, 'EMERGENCY_KILL_SWITCH must exist');
  assert.strictEqual(meta.isSecret, false, 'EMERGENCY_KILL_SWITCH is NOT a secret');
  assert.strictEqual(meta.currentValue, true, 'EMERGENCY_KILL_SWITCH current value is true');
  assert.strictEqual(DEFAULT_CONFIG.execution.emergencyKillSwitch, true);
  assert.strictEqual(meta.configurableInDashboard, true, 'Safety controls must be visible in Dashboard');
});
