/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramBotService, telegramBotService } from '../../src/packages/telegram/telegram_service.ts';
import { settingsService } from '../../src/services/settings_service.ts';
import { TradingEngine } from '../../src/services/trading_engine.ts';
import { app } from '../../server/index.ts';

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

test('Server API — 1. GET /api/health returns status ok without secrets', async () => {
  const server = app.listen(0);
  const address = server.address() as { port: number };
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'gold-ai-bot-v2');
    assert.ok(data.timestamp > 0);
  } finally {
    server.close();
  }
});

test('Server API — 2. GET /api/telegram/status detects missing credentials safely', async () => {
  const origToken = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/telegram/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.state, 'UNCONFIGURED');
    assert.ok(data.missingConfigs.includes('TELEGRAM_BOT_TOKEN'));
    // Ensure token is not returned
    assert.equal(data.botToken, undefined);
  } finally {
    server.close();
    if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken;
  }
});

test('Server API — 3. GET /api/telegram/status performs getMe and sanitizes errors', async () => {
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = 'SECRET_TOKEN_9999';
  process.env.TELEGRAM_CHAT_ID = 'CHAT_123';
  process.env.TELEGRAM_USER_ID = 'USER_123';

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const port = address.port;

  try {
    // Mock Telegram getMe call inside node fetch
    const nodeFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, opts?: any) => {
      if (String(url).includes('api.telegram.org/botSECRET_TOKEN_9999/getMe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: { first_name: 'Gold Bot Server', username: 'GoldBotServer' },
          }),
        } as any;
      }
      return nodeFetch(url, opts);
    }) as typeof fetch;

    const res = await nodeFetch(`http://127.0.0.1:${port}/api/telegram/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.state, 'CONNECTED');
    assert.equal(data.botName, 'Gold Bot Server');
    assert.equal(data.botUsername, '@GoldBotServer');
    assert.equal(data.botToken, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});

test('Server API — 4. POST /api/telegram/test sends Arabic test message and sanitizes token on error', async () => {
  const originalFetch = globalThis.fetch;
  const sensitiveToken = 'SECRET_BOT_TOKEN_SENSITIVE';
  process.env.TELEGRAM_BOT_TOKEN = sensitiveToken;
  process.env.TELEGRAM_CHAT_ID = 'CHAT_456';
  process.env.TELEGRAM_USER_ID = 'USER_456';
  process.env.TELEGRAM_ENABLED = 'true';

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const port = address.port;

  try {
    const nodeFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, opts?: any) => {
      if (String(url).includes('api.telegram.org/bot')) {
        return {
          ok: false,
          status: 401,
          text: async () => `Unauthorized request with token ${sensitiveToken}`,
        } as any;
      }
      return nodeFetch(url, opts);
    }) as typeof fetch;

    const res = await nodeFetch(`http://127.0.0.1:${port}/api/telegram/test`, { method: 'POST' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.message.includes('فشل'));
    // Verify token was sanitized
    assert.equal(data.error?.includes(sensitiveToken), false);
    assert.ok(data.error?.includes('***TOKEN***'));
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});

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
  await settingsService.saveSettings(createDummySettingsPayload(true));
  assert.equal(telegramBotService.isEnabled(), true);

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

test('Frontend Telegram Service — 5. Uses backend API endpoints rather than private process.env variables', async () => {
  const originalFetch = globalThis.fetch;

  try {
    telegramBotService.setEnabled(true);
    let calledBackendApi = false;

    globalThis.fetch = (async (url: string | URL) => {
      if (String(url) === '/api/telegram/status') {
        calledBackendApi = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            state: 'CONNECTED',
            botName: 'Gold Bot API',
            botUsername: '@GoldBotAPI',
            latencyMs: 85,
            lastCheckTimestamp: Date.now(),
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    }) as typeof fetch;

    const status = await telegramBotService.checkConnectionStatus();
    assert.equal(calledBackendApi, true);
    assert.equal(status.state, 'CONNECTED');
    assert.equal(status.botName, 'Gold Bot API');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
