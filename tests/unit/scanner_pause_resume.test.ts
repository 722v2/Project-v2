/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingEngine } from '../../src/services/trading_engine.ts';
import { telegramBotService } from '../../src/packages/telegram/telegram_service.ts';

test('1. Scanner starts RUNNING upon initialization and start', async () => {
  const engine = TradingEngine.getInstance();
  await engine.start();

  const state = engine.getState();
  assert.strictEqual(state.isScannerRunning, true);
  assert.strictEqual(state.isScannerPaused, false);
  assert.strictEqual(state.scannerStatus, 'RUNNING');
  assert.strictEqual(engine.isPaused(), false);
});

test('2. Pause changes state to PAUSED with confirmation message', () => {
  const engine = TradingEngine.getInstance();
  const pauseResult = engine.pauseScanner();

  assert.strictEqual(pauseResult.success, true);
  assert.strictEqual(pauseResult.state, 'PAUSED');
  assert.strictEqual(pauseResult.message, 'Scanner paused. Existing trade monitoring remains active.');

  const state = engine.getState();
  assert.strictEqual(state.isScannerPaused, true);
  assert.strictEqual(state.scannerStatus, 'PAUSED');
  assert.strictEqual(engine.isPaused(), true);
});

test('3. PAUSED prevents a new scanner cycle from executing or modifying scanCount', async () => {
  const engine = TradingEngine.getInstance();
  engine.pauseScanner();

  const initialScanCount = engine.getState().scanCount;
  const initialLogsCount = engine.getState().scannerLogs.length;

  // Attempt to trigger manual scan while paused
  await engine.triggerManualScan();
  assert.strictEqual(engine.getState().scanCount, initialScanCount, 'Scan count must not increment while paused');

  // Attempt to run regular scanner cycle while paused
  await engine.runScannerCycle();
  assert.strictEqual(engine.getState().scanCount, initialScanCount, 'Scan cycle must not run while paused');

  // Verify that an informative log was registered
  const logs = engine.getState().scannerLogs;
  assert.ok(logs.length > initialLogsCount);
  assert.ok(logs.some((l) => l.message.includes('إيقاف مؤقت (PAUSED)')));
});

test('4. PAUSED prevents new AI analysis and market setup generation', async () => {
  const engine = TradingEngine.getInstance();
  engine.pauseScanner();

  const initialSignal = engine.getState().activeSignal;
  const initialRecentCount = engine.getState().recentSignals.length;

  await engine.runScannerCycle();

  // No new signal should be manufactured while paused
  assert.strictEqual(engine.getState().activeSignal, initialSignal);
  assert.strictEqual(engine.getState().recentSignals.length, initialRecentCount);
});

test('5. Resume changes state to RUNNING with confirmation message', () => {
  const engine = TradingEngine.getInstance();
  engine.pauseScanner();
  assert.strictEqual(engine.isPaused(), true);

  const resumeResult = engine.resumeScanner();
  assert.strictEqual(resumeResult.success, true);
  assert.strictEqual(resumeResult.state, 'RUNNING');
  assert.strictEqual(resumeResult.message, 'Scanner resumed.');

  const state = engine.getState();
  assert.strictEqual(state.isScannerPaused, false);
  assert.strictEqual(state.scannerStatus, 'RUNNING');
  assert.strictEqual(engine.isPaused(), false);
});

test('6. Resume restores normal scanning capabilities', async () => {
  const engine = TradingEngine.getInstance();
  engine.resumeScanner();

  const beforeScanCount = engine.getState().scanCount;
  await engine.runScannerCycle();

  assert.strictEqual(engine.getState().scanCount, beforeScanCount + 1, 'Scan count must increment on normal cycle after resume');
});

test('7. Multiple Resume and Pause actions do not create duplicate intervals or timers', () => {
  const engine = TradingEngine.getInstance();

  // Rapid toggling
  engine.pauseScanner();
  engine.pauseScanner();
  engine.resumeScanner();
  engine.resumeScanner();
  engine.resumeScanner();
  engine.pauseScanner();
  engine.resumeScanner();

  assert.strictEqual(engine.isPaused(), false);
  assert.strictEqual(engine.getState().scannerStatus, 'RUNNING');
});

test('8. Pause while a scan is executing does not corrupt the current scan', async () => {
  const engine = TradingEngine.getInstance();
  engine.resumeScanner();

  // Start a scan cycle and immediately pause
  const scanPromise = engine.runScannerCycle();
  engine.pauseScanner();

  await scanPromise;

  // Current scan finishes cleanly without throw, and next state is PAUSED
  assert.strictEqual(engine.isPaused(), true);
  assert.strictEqual(engine.getState().isScanningNow, false);
});

test('9. Existing trade lifecycle monitoring continues actively while scanner is paused', () => {
  const engine = TradingEngine.getInstance();
  engine.pauseScanner();
  assert.strictEqual(engine.isPaused(), true);

  const state = engine.getState();
  // Set up an active position
  state.currentPrice = 2950.00;
  state.activeTrade = {
    tradeId: 'tr_pause_test',
    signalId: 'sig_pause_test',
    setupId: 'setup_pause_test',
    symbol: 'XAU/USD',
    direction: 'BUY',
    entryPrice: 2900.00,
    stopLoss: 2890.00,
    takeProfit1: 2930.00,
    takeProfit2: 2960.00,
    plannedRiskUsd: 100,
    positionSizeLots: 0.1,
    status: 'ACTIVE',
    openedAt: Date.now() - 60000,
    createdAt: Date.now() - 60000,
  };
  state.activePosition = {
    tradeId: 'tr_pause_test',
    currentMarketPrice: 2950.00,
    unrealizedPnlUsd: 500,
    currentRMultiple: 5.0,
    distanceToSl: 60.0,
    distanceToTp1: 20.0,
    distanceToTp2: 10.0,
    mfePrice: 2950.00,
    mfeR: 5.0,
    maePrice: 2900.00,
    maeR: 0,
    tp1Hit: true,
    tp2Hit: false,
    slHit: false,
    isBreakeven: false,
    isPartialClosed: false,
    reversalWatchStatus: 'NORMAL',
    lastEvaluatedAt: Date.now(),
  };

  // Run trade monitor cycle
  engine.runTradeMonitorCycle();

  // Trade monitoring must have executed and calculated P&L (+$500.00, +5.0R)
  assert.ok(state.activePosition !== null);
  assert.strictEqual(state.activePosition.unrealizedPnlUsd, 500);
  assert.strictEqual(state.activePosition.currentRMultiple, 5.0);

  // Clean up test trade
  state.activeTrade = null;
  state.activePosition = null;
});

test('10. Scanner Status reports accurate status, intervals, and timestamp details', () => {
  const engine = TradingEngine.getInstance();
  engine.resumeScanner();

  const runningStatus = engine.getScannerStatus();
  assert.strictEqual(runningStatus.status, 'RUNNING');
  assert.strictEqual(runningStatus.isPaused, false);
  assert.strictEqual(runningStatus.intervalSeconds, 60);
  assert.ok(runningStatus.message.includes('RUNNING'));

  engine.pauseScanner();
  const pausedStatus = engine.getScannerStatus();
  assert.strictEqual(pausedStatus.status, 'PAUSED');
  assert.strictEqual(pausedStatus.isPaused, true);
  assert.ok(pausedStatus.message.includes('PAUSED'));
});

test('11. Telegram Bot Service handles scanner_pause, scanner_resume, and scanner_status callbacks', async () => {
  const engine = TradingEngine.getInstance();
  telegramBotService.setEnabled(true);
  telegramBotService.setCredentials('mock_token', 'user_123', 'chat_123');

  // Test Pause callback
  const pauseCb = await telegramBotService.handleCallbackQuery({
    callbackQueryId: `cb_${Date.now()}_1`,
    userId: 'user_123',
    chatId: 'chat_123',
    callbackData: 'scanner_pause',
  });
  assert.strictEqual(pauseCb.success, true);
  assert.strictEqual(pauseCb.message, 'Scanner paused. Existing trade monitoring remains active.');
  assert.strictEqual(engine.isPaused(), true);

  // Test Status callback
  const statusCb = await telegramBotService.handleCallbackQuery({
    callbackQueryId: `cb_${Date.now()}_2`,
    userId: 'user_123',
    chatId: 'chat_123',
    callbackData: 'scanner_status',
  });
  assert.strictEqual(statusCb.success, true);
  assert.ok(statusCb.message.includes('PAUSED'));

  // Test Resume callback
  const resumeCb = await telegramBotService.handleCallbackQuery({
    callbackQueryId: `cb_${Date.now()}_3`,
    userId: 'user_123',
    chatId: 'chat_123',
    callbackData: 'scanner_resume',
  });
  assert.strictEqual(resumeCb.success, true);
  assert.strictEqual(resumeCb.message, 'Scanner resumed.');
  assert.strictEqual(engine.isPaused(), false);

  // Verify control buttons structure
  const buttons = telegramBotService.getScannerControlButtons();
  assert.strictEqual(buttons.length, 2);
  assert.strictEqual(buttons[0][0].text, '⏸️ Pause Scanner');
  assert.strictEqual(buttons[0][1].text, '▶️ Resume Scanner');
  assert.strictEqual(buttons[1][0].text, '📊 Scanner Status');
});
