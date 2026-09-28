/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingEngine } from '../../src/services/trading_engine.ts';
import { DEFAULT_CONFIG } from '../../src/config/index.ts';
import { openRouterClient } from '../../src/packages/ai/openrouter_client.ts';

test('AI Consistency: Default config and Trading Engine specify OpenRouter', () => {
  assert.strictEqual(DEFAULT_CONFIG.ai.provider, 'openrouter');

  const engine = TradingEngine.getInstance();
  const config = engine.getConfig();

  assert.strictEqual(config.ai.provider, 'openrouter', 'Trading engine AI provider must be openrouter');
  assert.ok(config.ai.model && config.ai.model.length > 0, 'Trading engine AI model must be defined');
});

test('AI Consistency: OpenRouter client status aligns with system configuration', () => {
  const status = openRouterClient.getStatus();

  assert.strictEqual(status.provider, 'openrouter');
  assert.strictEqual(status.baseUrl, 'https://openrouter.ai/api/v1');
  assert.ok(status.model.length > 0);
  assert.strictEqual(status.timeoutMs, 30000);
});
