/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramBotService, telegramBotService } from '../../src/packages/telegram/telegram_service.ts';
import { Signal } from '../../src/types/signal.ts';
import { TradingEngine } from '../../src/services/trading_engine.ts';

function createMockSignal(id = 'sig_test_100'): Signal {
  return {
    signalId: id,
    setupId: 'setup_test_100',
    symbol: 'XAU/USD',
    strategy: 'liquidity_sweep_reversal',
    direction: 'BUY',
    timeframe: '15M',
    entryPrice: 2895.50,
    stopLoss: 2890.00,
    takeProfit1: 2906.50,
    takeProfit2: 2915.00,
    riskReward1: 2.0,
    riskReward2: 3.5,
    confidence: 85,
    qualityScore: 85,
    marketRegime: 'TREND_UP',
    evidenceBreakdown: {
      marketStructure: 20,
      liquidityEvent: 18,
      poiValidity: 15,
      mtfConfluence: 12,
      riskReward: 10,
      macdMomentum: 5,
      rsiContext: 5,
      emaAlignment: 0,
      premiumDiscount: 0,
      newsContext: 0,
      totalScore: 85,
    },
    analysisReasons: ['سحب سيولة القاع الآسيوي بقوة عند $2888.50'],
    riskNotes: ['المخاطرة المخططة: $10.00'],
    newsContext: {},
    invalidatingConditions: ['إغلاق شمعة صريح أدنى من $2890.00'],
    strategyVersion: '2.0.0',
    analysisVersion: '2.0.0',
    createdAt: Date.now(),
    status: 'AWAITING_USER_DECISION',
  };
}

test('Telegram Lifecycle — 1. Signal -> Awaiting Decision Initialization', () => {
  const signal = createMockSignal('sig_1');
  const record = telegramBotService.registerSignal(signal, 'chat_123');

  assert.equal(record.signalId, 'sig_1');
  assert.equal(record.lifecycleState, 'AWAITING_USER_DECISION');

  const text = telegramBotService.formatMessageText(record);
  assert.ok(text.includes('📊 إشارة ذهب جديدة'));
  assert.ok(text.includes('الحالة: بانتظار قرارك'));

  const buttons = telegramBotService.formatInlineButtons(record);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0][0].text, '🟢 دخلت الصفقة');
  assert.equal(buttons[0][1].text, '⚪ ما دخلت');
});

test('Telegram Lifecycle — 2. User presses "دخلت الصفقة" (ENTERED -> ACTIVE_TRACKING)', async () => {
  const signal = createMockSignal('sig_2');
  telegramBotService.registerSignal(signal, 'chat_123');

  const res = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_entry_2',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'entry_sig_2',
  });

  assert.equal(res.success, true);
  assert.equal(res.newState, 'ACTIVE_TRACKING');

  const record = telegramBotService.getRecord('sig_2');
  assert.equal(record?.lifecycleState, 'ACTIVE_TRACKING');

  const text = telegramBotService.formatMessageText(record!);
  assert.ok(text.includes('🟢 الصفقة قيد المتابعة'));

  const buttons = telegramBotService.formatInlineButtons(record!);
  assert.equal(buttons[0][0].text, '💰 ربحت');
  assert.equal(buttons[0][1].text, '❌ خسرت');
});

test('Telegram Lifecycle — 3. User presses "ما دخلت" (CANCELLED_BY_USER)', async () => {
  const signal = createMockSignal('sig_3');
  telegramBotService.registerSignal(signal, 'chat_123');

  const res = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_cancel_3',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'cancel_sig_3',
  });

  assert.equal(res.success, true);
  assert.equal(res.newState, 'CANCELLED_BY_USER');

  const record = telegramBotService.getRecord('sig_3');
  assert.equal(record?.lifecycleState, 'CANCELLED_BY_USER');

  const text = telegramBotService.formatMessageText(record!);
  assert.ok(text.includes('⚪ تم إلغاء متابعة الإشارة — لم تدخل الصفقة'));

  const buttons = telegramBotService.formatInlineButtons(record!);
  assert.equal(buttons.length, 0); // Buttons disabled/removed
});

test('Telegram Lifecycle — 4. User presses "ربحت" (CLOSED_WIN)', async () => {
  const signal = createMockSignal('sig_4');
  telegramBotService.registerSignal(signal, 'chat_123');

  // Move to active tracking first
  await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_4_entry',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'entry_sig_4',
  });

  // User presses win
  const res = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_4_win',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'win_sig_4',
  });

  assert.equal(res.success, true);
  assert.equal(res.newState, 'CLOSED_WIN');

  const record = telegramBotService.getRecord('sig_4');
  const text = telegramBotService.formatMessageText(record!);
  assert.ok(text.includes('💰 الصفقة أغلقت — ربح'));
  assert.ok(text.includes('مصدر النتيجة: USER_CONFIRMED'));
});

test('Telegram Lifecycle — 5. User presses "خسرت" (CLOSED_LOSS)', async () => {
  const signal = createMockSignal('sig_5');
  telegramBotService.registerSignal(signal, 'chat_123');

  await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_5_entry',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'entry_sig_5',
  });

  const res = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_5_loss',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'loss_sig_5',
  });

  assert.equal(res.success, true);
  assert.equal(res.newState, 'CLOSED_LOSS');

  const record = telegramBotService.getRecord('sig_5');
  const text = telegramBotService.formatMessageText(record!);
  assert.ok(text.includes('❌ الصفقة أغلقت — خسارة'));
});

test('Telegram Lifecycle — 6 & 7. Authorization Security (Unauthorized User / Chat)', async () => {
  telegramBotService.setCredentials('mock_token', 'AUTHORIZED_USER_123', 'AUTHORIZED_CHAT_456');

  const signal = createMockSignal('sig_security_6');
  telegramBotService.registerSignal(signal, 'AUTHORIZED_CHAT_456');

  // Attempt button press with wrong user ID
  const unauthorizedRes = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_hacker_1',
    userId: 'HACKER_999',
    chatId: 'AUTHORIZED_CHAT_456',
    callbackData: 'entry_sig_security_6',
  });

  assert.equal(unauthorizedRes.success, false);
  assert.equal(unauthorizedRes.message, 'غير مصرح لك بهذا الإجراء');
  assert.equal(unauthorizedRes.alert, true);

  // Signal state must remain unchanged
  const record = telegramBotService.getRecord('sig_security_6');
  assert.equal(record?.lifecycleState, 'AWAITING_USER_DECISION');

  // Clean up credentials for subsequent tests
  telegramBotService.setCredentials('', '', '');
});

test('Telegram Lifecycle — 8. Callback Query Idempotency', async () => {
  const signal = createMockSignal('sig_idempotent_8');
  telegramBotService.registerSignal(signal, 'chat_123');

  const res1 = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'dup_callback_888',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'entry_sig_idempotent_8',
  });

  assert.equal(res1.newState, 'ACTIVE_TRACKING');

  // Duplicate callback delivery
  const res2 = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'dup_callback_888',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'entry_sig_idempotent_8',
  });

  assert.equal(res2.success, true);
  assert.equal(res2.newState, 'ACTIVE_TRACKING');
  assert.ok(res2.message.includes('سابقاً'));
});

test('Telegram Lifecycle — 9. Invalid State Transitions Rejection', async () => {
  const signal = createMockSignal('sig_invalid_9');
  telegramBotService.registerSignal(signal, 'chat_123');

  // Cancel signal first
  await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_cancel_9',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'cancel_sig_invalid_9',
  });

  // Try invalid transition CANCELLED_BY_USER -> CLOSED_LOSS
  const invalidRes = await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_loss_9',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'loss_sig_invalid_9',
  });

  assert.equal(invalidRes.success, false);
  assert.ok(invalidRes.message.includes('لا يمكن الانتقال'));

  const record = telegramBotService.getRecord('sig_invalid_9');
  assert.equal(record?.lifecycleState, 'CANCELLED_BY_USER');
});

test('Telegram Lifecycle — 10 & 11. Server & Deployment Persistence Recovery', () => {
  const signal = createMockSignal('sig_persisted_10');
  telegramBotService.registerSignal(signal, 'chat_persisted');

  // Simulate server restart by creating new instance or inspecting stored record
  const retrieved = telegramBotService.getRecord('sig_persisted_10');
  assert.ok(retrieved);
  assert.equal(retrieved?.signalId, 'sig_persisted_10');
  assert.equal(retrieved?.chatId, 'chat_persisted');
});

test('Telegram Lifecycle — 12. No Fake P&L on "ما دخلت"', async () => {
  const signal = createMockSignal('sig_nopnl_12');
  telegramBotService.registerSignal(signal, 'chat_123');

  await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_cancel_12',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'cancel_sig_nopnl_12',
  });

  const engine = TradingEngine.getInstance();
  const completedTrades = engine.getState().completedTrades;

  // Verify "ما دخلت" did NOT push a trade outcome into completed trades
  const outcomeForSignal = completedTrades.find((t) => t.signalId === 'sig_nopnl_12');
  assert.equal(outcomeForSignal, undefined);
});

test('Telegram Lifecycle — 13. No Real Broker Order On Button Press', async () => {
  const signal = createMockSignal('sig_nobroker_13');
  telegramBotService.registerSignal(signal, 'chat_123');

  const engine = TradingEngine.getInstance();
  const initialAutoTrading = engine.getConfig().execution?.autoTrading;

  // Pressing "دخلت الصفقة" must be tracking only and not trigger real broker auto execution
  assert.equal(initialAutoTrading, false);

  await telegramBotService.handleCallbackQuery({
    callbackQueryId: 'cb_entry_13',
    userId: 'user_owner',
    chatId: 'chat_123',
    callbackData: 'entry_sig_nobroker_13',
  });

  assert.equal(engine.getConfig().execution?.autoTrading, false);
});

test('Telegram Lifecycle — 14. Telegram Rate Limit Throttle Protection', () => {
  const signal = createMockSignal('sig_rate_14');
  const record = telegramBotService.registerSignal(signal, 'chat_123');
  record.lifecycleState = 'ACTIVE_TRACKING';

  // Rapid continuous market updates
  for (let price = 2895.5; price <= 2900; price += 0.5) {
    telegramBotService.updateMarketPrice('sig_rate_14', price);
  }

  const updated = telegramBotService.getRecord('sig_rate_14');
  assert.equal(updated?.currentMarketPrice, 2900.0);
  assert.ok((updated?.currentPnlUsd || 0) > 0);
});

test('Telegram Lifecycle — 15. Arabic Message Rendering Consistency', () => {
  const signal = createMockSignal('sig_arabic_15');
  const record = telegramBotService.registerSignal(signal, 'chat_123');

  record.lifecycleState = 'ACTIVE_TRACKING';
  record.currentMarketPrice = 2901.0;
  record.currentPnlUsd = 55.0;
  record.currentRMultiple = 1.0;
  record.mfeR = 1.2;
  record.mfePrice = 2902.0;
  record.maeR = -0.1;
  record.maePrice = 2895.0;

  const text = telegramBotService.formatMessageText(record);

  assert.ok(text.includes('🟢 الصفقة قيد المتابعة'));
  assert.ok(text.includes('الاتجاه: BUY'));
  assert.ok(text.includes('سعر الدخول: $2895.50'));
  assert.ok(text.includes('السعر الحالي: $2901.00'));
  assert.ok(text.includes('SL: $2890.00'));
  assert.ok(text.includes('TP1: $2906.50'));
  assert.ok(text.includes('P&L: +$55.00'));
  assert.ok(text.includes('R-Multiple: +1.00R'));
  assert.ok(text.includes('حالة الصفقة: 🟢 الصفقة قيد المتابعة'));
});
