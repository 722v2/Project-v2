/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { auditMigrationSql, V2_EXPECTED_TABLES } from '../../scripts/migrate_supabase.ts';

test('Supabase Migration Audit: Schema file exists and contains all 22 required V2 entities', () => {
  const sqlPath = path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql');
  const audit = auditMigrationSql(sqlPath);

  assert.strictEqual(audit.totalTablesExpected, 22);
  assert.strictEqual(audit.tablesFoundInSql.length, 22);

  // Verify all expected table names are present in the SQL
  for (const expected of V2_EXPECTED_TABLES) {
    assert.ok(
      audit.tablesFoundInSql.includes(expected),
      `Expected table ${expected} must be defined in 001_initial_schema.sql`
    );
  }
});

test('Supabase Migration Audit: Primary keys, Foreign keys, and Indexes are correctly defined', () => {
  const sqlPath = path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql');
  const audit = auditMigrationSql(sqlPath);

  // Each table must have a primary key
  assert.ok(audit.primaryKeysCount >= 22, `Expected at least 22 primary keys, got ${audit.primaryKeysCount}`);

  // Relational integrity: Foreign keys linking setups, signals, trades, etc.
  assert.ok(audit.foreignKeysCount >= 10, `Expected at least 10 foreign key constraints, got ${audit.foreignKeysCount}`);

  // Query performance: B-Tree indexes for lookup
  assert.ok(audit.indexesCount >= 12, `Expected at least 12 index definitions, got ${audit.indexesCount}`);
});

test('Supabase Migration Audit: Schema is strictly idempotent and contains zero destructive commands', () => {
  const sqlPath = path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql');
  const audit = auditMigrationSql(sqlPath);

  assert.strictEqual(audit.isIdempotent, true, 'Migration must be safe and idempotent');
  assert.strictEqual(audit.destructiveOperationsFound.length, 0, 'Must NOT contain DROP TABLE, DROP DATABASE, or TRUNCATE');
});

test('Supabase Migration Audit: Required default seed records exist without mock operational data', () => {
  const sqlPath = path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql');
  const audit = auditMigrationSql(sqlPath);

  assert.ok(audit.seedsPresent.includes('strategy_settings'), 'Default 6 strategies must be seeded');
  assert.ok(audit.seedsPresent.includes('account_settings'), 'Default account settings must be seeded');
  assert.ok(audit.seedsPresent.includes('risk_settings'), 'Default risk settings must be seeded');

  // Verify NO mock signals, trades, market data or learning data are seeded
  assert.ok(!audit.seedsPresent.includes('signals'), 'Signals must NOT have fake seed data');
  assert.ok(!audit.seedsPresent.includes('trades'), 'Trades must NOT have fake seed data');
  assert.ok(!audit.seedsPresent.includes('market_snapshots'), 'Market snapshots must NOT have fake seed data');
});
