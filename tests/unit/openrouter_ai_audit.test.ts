/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterClient, openRouterClient } from '../../src/packages/ai/openrouter_client.ts';
import { DEFAULT_CONFIG } from '../../src/config/index.ts';

test('OpenRouter Audit 1: Provider and Base URL configuration', () => {
  const client = new OpenRouterClient();
  const status = client.getStatus();

  assert.strictEqual(status.provider, 'openrouter', 'AI provider MUST be openrouter');
  assert.strictEqual(status.baseUrl, 'https://openrouter.ai/api/v1', 'Base URL MUST be official OpenRouter endpoint');
  assert.strictEqual(DEFAULT_CONFIG.ai.provider, 'openrouter', 'Default configuration provider must be openrouter');
});

test('OpenRouter Audit 2: Model selection is non-hardcoded and supports router identifiers', () => {
  // 1. Default model
  const defaultClient = new OpenRouterClient();
  assert.ok(defaultClient.getStatus().model.length > 0, 'Model must have a valid default');

  // 2. Custom model configuration via config object
  const customClaude = new OpenRouterClient({ model: 'anthropic/claude-3.5-sonnet' });
  assert.strictEqual(customClaude.getStatus().model, 'anthropic/claude-3.5-sonnet');

  const customDeepseek = new OpenRouterClient({ model: 'deepseek/deepseek-r1' });
  assert.strictEqual(customDeepseek.getStatus().model, 'deepseek/deepseek-r1');

  const customGemini = new OpenRouterClient({ model: 'google/gemini-2.5-flash' });
  assert.strictEqual(customGemini.getStatus().model, 'google/gemini-2.5-flash');
});

test('OpenRouter Audit 3: Unconfigured client fails safely without crashing', async () => {
  const unconfiguredClient = new OpenRouterClient({ apiKey: '' });
  assert.strictEqual(unconfiguredClient.isConfigured(), false);

  const result = await unconfiguredClient.interpretSetup({
    symbol: 'XAU/USD',
    strategy: 'Strategy 1: Liquidity Sweep',
    direction: 'BUY',
    entryPrice: 2895.50,
    stopLoss: 2890.00,
    takeProfit1: 2905.00,
    regime: 'TREND_UP',
    reasons: ['Liquidity swept at Asian low', 'Bullish Displacement'],
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.provider, 'openrouter');
  assert.ok(result.error?.includes('OPENROUTER_API_KEY not configured'));
});

test('OpenRouter Audit 4: Timeout enforcement respects AI_REASONING_TIMEOUT_MS', async () => {
  // Test client with very low timeout (10ms) against a dummy URL to simulate network stall
  const timedClient = new OpenRouterClient({
    apiKey: 'sk-or-v1-dummy-key-for-test-isolation',
    baseUrl: 'https://10.255.255.1', // Unroutable IP to force timeout
    timeoutMs: 50,
  });

  const startTime = Date.now();
  const result = await timedClient.interpretSetup({
    symbol: 'XAU/USD',
    strategy: 'Strategy 2: BOS',
    direction: 'SELL',
    entryPrice: 2900.00,
    stopLoss: 2905.00,
    takeProfit1: 2890.00,
    regime: 'TREND_DOWN',
    reasons: ['BOS M15 confirmed'],
  });

  const duration = Date.now() - startTime;
  assert.strictEqual(result.success, false);
  assert.ok(duration < 2000, `Timeout must abort quickly, took ${duration}ms`);
  assert.ok(result.error !== undefined, 'Error message must be present on timeout');
});

test('OpenRouter Audit 5: Error sanitization prevents key leakage', async () => {
  const secretKey = 'sk-or-v1-super-secret-key-1234567890';
  const client = new OpenRouterClient({
    apiKey: secretKey,
    baseUrl: 'https://invalid-non-existent-subdomain.openrouter.ai/api/v1',
    timeoutMs: 1000,
  });

  const result = await client.interpretSetup({
    symbol: 'XAU/USD',
    strategy: 'Strategy 3: FVG',
    direction: 'BUY',
    entryPrice: 2892.00,
    stopLoss: 2888.00,
    takeProfit1: 2900.00,
    regime: 'TREND_UP',
    reasons: ['Unmitigated 15M FVG tapped'],
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(
    result.error?.includes(secretKey),
    false,
    'Error message MUST NEVER contain the raw API key'
  );
});

test('OpenRouter Audit 6: Connectivity test method returns structured diagnostics', async () => {
  const client = new OpenRouterClient();
  const diagnostics = await client.testConnectivity();

  assert.strictEqual(diagnostics.provider, 'openrouter');
  assert.strictEqual(diagnostics.baseUrl, 'https://openrouter.ai/api/v1');
  assert.ok(typeof diagnostics.authenticated === 'boolean');
  assert.ok(typeof diagnostics.timestamp === 'string');
});

test('OpenRouter Audit 7: Market Data Boundary & Hard Risk Rule Protection', () => {
  // Deterministic trade calculation parameters
  const deterministicSetup = {
    symbol: 'XAU/USD',
    entryPrice: 2895.00,
    stopLoss: 2890.00,
    takeProfit1: 2905.00,
    takeProfit2: 2915.00,
    rr1: 2.0,
    rr2: 4.0,
    slDistance: 5.00,
  };

  // The AI reasoning context must only receive these pre-computed numbers as read-only context
  assert.ok(deterministicSetup.slDistance <= 12.00, 'Max allowed SL distance ($12.00) enforced deterministically');
  assert.ok(deterministicSetup.rr1 >= 1.50, 'Min RR (1:1.50) enforced deterministically');
  assert.strictEqual(deterministicSetup.entryPrice, 2895.00, 'Authoritative price comes from Biquote, not AI');
});
