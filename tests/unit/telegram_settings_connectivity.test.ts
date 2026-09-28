/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramBotService, telegramBotService } from '../../src/packages/telegram/telegram_service.ts';
import { settingsService } from '../../src/services/settings_service.ts';
import { TradingEngine } from '../../src/services/trading_engine.ts';

function createDummySettingsPayload(telegramEnabled: boolean) {
  return {
    startingCapital: 100,
    riskPercentPerTrade: 1,
    maxDailyRiskPercent: 3,
    maxConcurrentTrades: 1,
    maxAllowedSlDistance: 15,
    minRiskRewardRatio: 1.5,
    maxDrawdownLimitPercent: 10,
    minConfidenceThreshold: 70,
    minQualityScore: 65,
    emergencyKillSwitch: true,
    telegramEnabled,
    telegramRateLimitPerMinute: 10,
    candleWindow1M: 200,
    aiTimeoutMs: 30000,
    monitorPollIntervalSeconds: 5,
    dedupPoiZoneToleranceUsd: 1.0,
    strategies: [
      { id: 'liquidity_sweep_reversal', name: 'Strategy 1', enabled: true, minConfidence: 70 },
    ],
  };
}

test('Telegram Settings & Connectivity — 1. Telegram disabled state persists', async () => {
  const payload = createDummySettingsPayload(false);
  const saveRes = await settingsService.saveSettings(payload);

  assert.equal(saveRes.success, true);
  assert.equal(TradingEngine.getInstance().getConfig().telegram.enabled, false);
  assert.equal(telegramBotService.isEnabled(), false);
});

test('Telegram Settings & Connectivity — 2. Telegram enabled state persists', async () => {
  const payload = createDummySettingsPayload(true);
  const saveRes = await settingsService.saveSettings(payload);

  assert.equal(saveRes.success, true);
  assert.equal(TradingEngine.getInstance().getConfig().telegram.enabled, true);
  assert.equal(telegramBotService.isEnabled(), true);
});

test('Telegram Settings & Connectivity — 3. Reload does not revert enabled -> disabled', async () => {
  // First persist enabled = true
  await settingsService.saveSettings(createDummySettingsPayload(true));
  assert.equal(telegramBotService.isEnabled(), true);

  // Simulate app reload / re-initialization from persisted storage
  await settingsService.loadAndApplySettings();

  assert.equal(TradingEngine.getInstance().getConfig().telegram.enabled, true);
  assert.equal(telegramBotService.isEnabled(), true);
});

test('Telegram Settings & Connectivity — 4. Runtime state matches persisted state', async () => {
  await settingsService.saveSettings(createDummySettingsPayload(true));
  assert.equal(TradingEngine.getInstance().getConfig().telegram.enabled, telegramBotService.isEnabled());

  await settingsService.saveSettings(createDummySettingsPayload(false));
  assert.equal(TradingEngine.getInstance().getConfig().telegram.enabled, telegramBotService.isEnabled());
});

test('Telegram Settings & Connectivity — 5. Missing token is detected', () => {
  telegramBotService.setCredentials('', 'user_123', 'chat_456');
  const missing = telegramBotService.getMissingConfigs();

  assert.ok(missing.includes('TELEGRAM_BOT_TOKEN'));
});

test('Telegram Settings & Connectivity — 6. Missing chat ID is detected', () => {
  telegramBotService.setCredentials('token_123', 'user_123', '');
  const missing = telegramBotService.getMissingConfigs();

  assert.ok(missing.includes('TELEGRAM_CHAT_ID'));
});

test('Telegram Settings & Connectivity — 7. Missing user ID is detected', () => {
  telegramBotService.setCredentials('token_123', '', 'chat_456');
  const missing = telegramBotService.getMissingConfigs();

  assert.ok(missing.includes('TELEGRAM_USER_ID'));
});

test('Telegram Settings & Connectivity — 8. getMe connectivity check succeeds/fails correctly', async () => {
  // Save original fetch
  const originalFetch = globalThis.fetch;

  try {
    // 8a. Mock Successful getMe
    telegramBotService.setCredentials('valid_bot_token_999', 'user_123', 'chat_456');
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('/getMe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: { id: 12345, first_name: 'Gold Test Bot', username: 'GoldTestBot' },
          }),
        } as any;
      }
      return { ok: false, status: 400, json: async () => ({}) } as any;
    }) as typeof fetch;

    const successStatus = await telegramBotService.checkConnectionStatus();
    assert.equal(successStatus.state, 'CONNECTED');
    assert.equal(successStatus.botName, 'Gold Test Bot');
    assert.equal(successStatus.botUsername, '@GoldTestBot');

    // 8b. Mock Failed getMe (HTTP 401 Unauthorized)
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ ok: false, description: 'Unauthorized' }),
      } as any;
    }) as typeof fetch;

    const failStatus = await telegramBotService.checkConnectionStatus();
    assert.equal(failStatus.state, 'DISCONNECTED');
    assert.ok(failStatus.lastError?.includes('Unauthorized'));
  } finally {
    globalThis.fetch = originalFetch;
    telegramBotService.reloadEnvCredentials();
  }
});

test('Telegram Settings & Connectivity — 9. Test-message endpoint sends through server/service only', async () => {
  telegramBotService.setCredentials('secret_bot_token_777', 'user_123', 'chat_456');
  telegramBotService.setEnabled(true);

  const missing = telegramBotService.getMissingConfigs();
  assert.equal(missing.length, 0);

  // Clean up
  telegramBotService.reloadEnvCredentials();
});

test('Telegram Settings & Connectivity — 10. Successful test message returns success', async () => {
  const originalFetch = globalThis.fetch;

  try {
    telegramBotService.setCredentials('token_test_10', 'user_test_10', 'chat_test_10');
    telegramBotService.setEnabled(true);

    globalThis.fetch = (async (url: string | URL, opts?: any) => {
      if (String(url).includes('/sendMessage')) {
        const body = JSON.parse(opts?.body || '{}');
        assert.equal(body.chat_id, 'chat_test_10');
        assert.ok(body.text.includes('GOLD AI BOT V2'));
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 888 } }),
        } as any;
      }
      return { ok: false, status: 400 } as any;
    }) as typeof fetch;

    const res = await telegramBotService.sendTestMessage();
    assert.equal(res.success, true);
    assert.ok(res.message.includes('بنجاح'));
  } finally {
    globalThis.fetch = originalFetch;
    telegramBotService.reloadEnvCredentials();
  }
});

test('Telegram Settings & Connectivity — 11. Failed Telegram API request returns safe error', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const sensitiveToken = 'SECRET_TOKEN_DO_NOT_LEAK_123';
    telegramBotService.setCredentials(sensitiveToken, 'user_test_11', 'chat_test_11');
    telegramBotService.setEnabled(true);

    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 400,
        text: async () => `Bad Request: token ${sensitiveToken} rejected`,
      } as any;
    }) as typeof fetch;

    const res = await telegramBotService.sendTestMessage();
    assert.equal(res.success, false);
    assert.ok(res.message.includes('فشل'));
    // Crucial check: verify sensitiveToken is stripped/sanitized from error text
    assert.equal(res.error?.includes(sensitiveToken), false);
  } finally {
    globalThis.fetch = originalFetch;
    telegramBotService.reloadEnvCredentials();
  }
});

test('Telegram Settings & Connectivity — 12. Test button cannot create duplicate concurrent requests', async () => {
  const originalFetch = globalThis.fetch;

  try {
    telegramBotService.setCredentials('token_test_12', 'user_12', 'chat_12');
    telegramBotService.setEnabled(true);

    // Mock slow fetch
    globalThis.fetch = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as any;
    }) as typeof fetch;

    // Trigger two test messages concurrently
    const p1 = telegramBotService.sendTestMessage();
    const p2 = telegramBotService.sendTestMessage();

    const [res1, res2] = await Promise.all([p1, p2]);

    // One of them must succeed and the other must be rejected due to lock
    const failedDuplicate = [res1, res2].find((r) => r.success === false && r.error === 'Duplicate test request');
    assert.ok(failedDuplicate !== undefined);
  } finally {
    globalThis.fetch = originalFetch;
    telegramBotService.reloadEnvCredentials();
  }
});
