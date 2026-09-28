/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabasePersistenceService } from '../../src/packages/persistence/supabase_service.ts';

test('Supabase Persistence: Health check verifies endpoint connectivity without fatal crash', async () => {
  const service = new SupabasePersistenceService();
  const health = await service.checkHealth();

  assert.ok(typeof health.connected === 'boolean');
  assert.ok(typeof health.latencyMs === 'number');

  if (service.isConfigured()) {
    assert.strictEqual(health.connected, true, 'Configured Supabase instance must be reachable');
  }
});

test('Supabase Persistence: Handles unconfigured state gracefully', async () => {
  const emptyService = new SupabasePersistenceService('', '');
  const health = await emptyService.checkHealth();

  assert.strictEqual(health.connected, false);
  assert.ok(health.error?.includes('not configured'));
});
