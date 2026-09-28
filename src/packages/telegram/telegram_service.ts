/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from '../../types/signal.ts';
import { TradeOutcome } from '../../types/trade.ts';
import { supabasePersistence } from '../persistence/supabase_service.ts';

export type SignalLifecycleState =
  | 'AWAITING_USER_DECISION'
  | 'ENTERED'
  | 'ACTIVE_TRACKING'
  | 'CANCELLED_BY_USER'
  | 'CLOSED_WIN'
  | 'CLOSED_LOSS';

export interface TelegramTrackingRecord {
  signalId: string;
  chatId: string;
  telegramMessageId?: string;
  userId?: string;
  lifecycleState: SignalLifecycleState;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  currentMarketPrice: number;
  currentPnlUsd: number;
  currentRMultiple: number;
  mfeR: number;
  mfePrice: number;
  maeR: number;
  maePrice: number;
  lastUpdatedTimestamp: number;
  outcomeSource?: 'USER_CONFIRMED' | 'AUTOMATIC';
}

export interface CallbackQueryResult {
  success: boolean;
  message: string;
  alert?: boolean;
  newState?: SignalLifecycleState;
  updatedRecord?: TelegramTrackingRecord;
}

export type TelegramConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'UNCONFIGURED' | 'CHECKING';

export interface TelegramStatusResult {
  state: TelegramConnectionState;
  enabled: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  hasUserId: boolean;
  missingConfigs: string[];
  botName?: string;
  botUsername?: string;
  lastCheckTimestamp?: number;
  lastError?: string;
  latencyMs?: number;
}

export class TelegramBotService {
  private static instance: TelegramBotService | null = null;
  private trackingMap: Map<string, TelegramTrackingRecord> = new Map();
  private processedCallbacks: Set<string> = new Set();
  private lastMessageEditTimestamp: Map<string, number> = new Map();

  private botToken: string = '';
  private authorizedUserId: string = '';
  private authorizedChatId: string = '';
  private rateLimitIntervalMs: number = 6000; // Default 10 edits/min = 6s throttle
  private enabled: boolean = false;
  private isTestRunning: boolean = false;

  private constructor() {
    this.reloadEnvCredentials();
    this.loadPersistedTracking();
  }

  public static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public reloadEnvCredentials(): void {
    if (typeof process !== 'undefined' && process.env) {
      this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
      this.authorizedUserId = process.env.TELEGRAM_USER_ID || '';
      this.authorizedChatId = process.env.TELEGRAM_CHAT_ID || '';

      if (process.env.TELEGRAM_ENABLED !== undefined) {
        this.enabled = process.env.TELEGRAM_ENABLED === 'true';
      }

      const rateNum = Number(process.env.TELEGRAM_RATE_LIMIT_PER_MINUTE);
      if (!isNaN(rateNum) && rateNum > 0) {
        this.rateLimitIntervalMs = Math.ceil(60000 / rateNum);
      }
    }
  }

  public setCredentials(token: string, userId?: string, chatId?: string): void {
    this.botToken = token;
    if (userId !== undefined) this.authorizedUserId = userId;
    if (chatId !== undefined) this.authorizedChatId = chatId;
  }

  public getMissingConfigs(): string[] {
    const missing: string[] = [];
    if (!this.botToken) missing.push('TELEGRAM_BOT_TOKEN');
    if (!this.authorizedChatId) missing.push('TELEGRAM_CHAT_ID');
    if (!this.authorizedUserId) missing.push('TELEGRAM_USER_ID');
    return missing;
  }

  public async checkConnectionStatus(): Promise<TelegramStatusResult> {
    const missingConfigs = this.getMissingConfigs();
    const hasToken = Boolean(this.botToken);
    const hasChatId = Boolean(this.authorizedChatId);
    const hasUserId = Boolean(this.authorizedUserId);

    if (missingConfigs.length > 0) {
      return {
        state: 'UNCONFIGURED',
        enabled: this.enabled,
        hasToken,
        hasChatId,
        hasUserId,
        missingConfigs,
        lastCheckTimestamp: Date.now(),
        lastError: `الإعدادات التالية مفقودة: ${missingConfigs.join(', ')}`,
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const latencyMs = Date.now() - start;
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        return {
          state: 'CONNECTED',
          enabled: this.enabled,
          hasToken,
          hasChatId,
          hasUserId,
          missingConfigs: [],
          botName: data.result?.first_name || 'Gold AI Bot',
          botUsername: data.result?.username ? `@${data.result.username}` : undefined,
          lastCheckTimestamp: Date.now(),
          latencyMs,
        };
      } else {
        const safeDesc = (data.description || `HTTP ${res.status}`).replace(this.botToken, '***TOKEN***');
        return {
          state: 'DISCONNECTED',
          enabled: this.enabled,
          hasToken,
          hasChatId,
          hasUserId,
          missingConfigs: [],
          lastCheckTimestamp: Date.now(),
          latencyMs,
          lastError: `فشل الاتصال بـ Telegram Bot API (${safeDesc})`,
        };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const safeMsg = (err.message || 'خطأ في الشبكة').replace(this.botToken, '***TOKEN***');
      return {
        state: 'DISCONNECTED',
        enabled: this.enabled,
        hasToken,
        hasChatId,
        hasUserId,
        missingConfigs: [],
        lastCheckTimestamp: Date.now(),
        latencyMs,
        lastError: `خطأ اتصال: ${safeMsg}`,
      };
    }
  }

  public async sendTestMessage(): Promise<{
    success: boolean;
    message: string;
    error?: string;
    missingConfigs?: string[];
  }> {
    // Prevent duplicate concurrent requests
    if (this.isTestRunning) {
      return {
        success: false,
        message: 'جاري تشغيل اختبار بالفعل، يرجى الانتظار...',
        error: 'Duplicate test request',
      };
    }

    if (!this.enabled) {
      return {
        success: false,
        message: 'Telegram غير مفعّل',
        error: 'Telegram غير مفعّل',
      };
    }

    const missingConfigs = this.getMissingConfigs();
    if (missingConfigs.length > 0) {
      return {
        success: false,
        message: `تعذر الإرسال: المتغيرات التالية مفقودة (${missingConfigs.join(', ')})`,
        error: 'Missing Telegram credentials',
        missingConfigs,
      };
    }

    this.isTestRunning = true;
    try {
      const nowFormatted = new Date().toLocaleString('ar-SA', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });

      const text = [
        '🧪 GOLD AI BOT V2',
        'اختبار اتصال Telegram',
        '',
        'الحالة: الاتصال يعمل بنجاح 🟢',
        `الوقت: ${nowFormatted}`,
      ].join('\n');

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.authorizedChatId,
          text,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const safeError = (errText || `HTTP ${res.status}`).replace(this.botToken, '***TOKEN***');
        return {
          success: false,
          message: '🔴 فشل إرسال رسالة الاختبار',
          error: `خطأ Telegram API: ${safeError}`,
        };
      }

      return {
        success: true,
        message: '🟢 تم إرسال رسالة الاختبار بنجاح',
      };
    } catch (err: any) {
      const safeError = (err.message || 'خطأ غير معروف').replace(this.botToken, '***TOKEN***');
      return {
        success: false,
        message: '🔴 فشل إرسال رسالة الاختبار',
        error: safeError,
      };
    } finally {
      this.isTestRunning = false;
    }
  }

  // --- STATE MACHINE VALIDATION ---

  public static isValidTransition(from: SignalLifecycleState, to: SignalLifecycleState): boolean {
    if (from === to) return true; // Idempotent same-state call

    switch (from) {
      case 'AWAITING_USER_DECISION':
        return to === 'ENTERED' || to === 'ACTIVE_TRACKING' || to === 'CANCELLED_BY_USER';

      case 'ENTERED':
        return to === 'ACTIVE_TRACKING' || to === 'CANCELLED_BY_USER';

      case 'ACTIVE_TRACKING':
        return to === 'CLOSED_WIN' || to === 'CLOSED_LOSS' || to === 'CANCELLED_BY_USER';

      case 'CANCELLED_BY_USER':
        // Terminal user rejection state: cannot transition to active or outcomes
        return false;

      case 'CLOSED_WIN':
        // Terminal outcome: cannot transition to loss or active
        return false;

      case 'CLOSED_LOSS':
        // Terminal outcome: cannot transition to win or active
        return false;

      default:
        return false;
    }
  }

  // --- AUTHORIZATION CHECK ---

  public isAuthorized(userId?: string, chatId?: string): boolean {
    // If no credentials are required in env, allow operation
    if (!this.authorizedUserId && !this.authorizedChatId) {
      return true;
    }

    if (this.authorizedUserId && userId && String(userId) !== String(this.authorizedUserId)) {
      return false;
    }

    if (this.authorizedChatId && chatId && String(chatId) !== String(this.authorizedChatId)) {
      return false;
    }

    return true;
  }

  // --- SIGNAL REGISTER & INITIAL DISPATCH ---

  public registerSignal(signal: Signal, chatId?: string, telegramMessageId?: string): TelegramTrackingRecord {
    const existing = this.trackingMap.get(signal.signalId);
    if (existing) {
      return existing;
    }

    const targetChat = chatId || this.authorizedChatId || 'default_chat';

    const record: TelegramTrackingRecord = {
      signalId: signal.signalId,
      chatId: targetChat,
      telegramMessageId,
      lifecycleState: 'AWAITING_USER_DECISION',
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit1: signal.takeProfit1,
      takeProfit2: signal.takeProfit2,
      currentMarketPrice: signal.entryPrice,
      currentPnlUsd: 0,
      currentRMultiple: 0,
      mfeR: 0,
      mfePrice: signal.entryPrice,
      maeR: 0,
      maePrice: signal.entryPrice,
      lastUpdatedTimestamp: Date.now(),
    };

    this.trackingMap.set(signal.signalId, record);
    this.persistTrackingRecord(record);
    return record;
  }

  // --- ARABIC MESSAGE GENERATOR ---

  public formatMessageText(record: TelegramTrackingRecord): string {
    const isBuy = record.direction === 'BUY';
    const dirEmoji = isBuy ? '🟢' : '🔴';
    const pnlSign = record.currentPnlUsd >= 0 ? '+' : '';
    const rSign = record.currentRMultiple >= 0 ? '+' : '';

    switch (record.lifecycleState) {
      case 'AWAITING_USER_DECISION':
        return [
          '📊 إشارة ذهب جديدة',
          '',
          `${dirEmoji} الاتجاه: ${record.direction}`,
          `💵 الدخول: $${record.entryPrice.toFixed(2)}`,
          `🛑 وقف الخسارة: $${record.stopLoss.toFixed(2)}`,
          `🎯 TP1: $${record.takeProfit1.toFixed(2)}`,
          `🎯 TP2: $${record.takeProfit2.toFixed(2)}`,
          '',
          'الحالة: بانتظار قرارك',
        ].join('\n');

      case 'ENTERED':
      case 'ACTIVE_TRACKING':
        return [
          '🟢 الصفقة قيد المتابعة',
          '',
          `${dirEmoji} الاتجاه: ${record.direction}`,
          `سعر الدخول: $${record.entryPrice.toFixed(2)}`,
          `السعر الحالي: $${record.currentMarketPrice.toFixed(2)}`,
          `SL: $${record.stopLoss.toFixed(2)}`,
          `TP1: $${record.takeProfit1.toFixed(2)}`,
          `TP2: $${record.takeProfit2.toFixed(2)}`,
          `P&L: ${pnlSign}$${record.currentPnlUsd.toFixed(2)}`,
          `R-Multiple: ${rSign}${record.currentRMultiple.toFixed(2)}R`,
          `MFE: +${record.mfeR.toFixed(2)}R ($${record.mfePrice.toFixed(2)})`,
          `MAE: ${record.maeR.toFixed(2)}R ($${record.maePrice.toFixed(2)})`,
          'حالة الصفقة: 🟢 الصفقة قيد المتابعة',
        ].join('\n');

      case 'CANCELLED_BY_USER':
        return [
          '⚪ تم إلغاء متابعة الإشارة — لم تدخل الصفقة',
          '',
          `${dirEmoji} الاتجاه: ${record.direction}`,
          `سعر الدخول: $${record.entryPrice.toFixed(2)}`,
          `وقف الخسارة: $${record.stopLoss.toFixed(2)}`,
          `TP1: $${record.takeProfit1.toFixed(2)}`,
          `ملاحظة: لم يتم إنشاء أي صفقة أو تقييم خسارة/ربح مالية.`,
        ].join('\n');

      case 'CLOSED_WIN':
        return [
          '💰 الصفقة أغلقت — ربح',
          '',
          `${dirEmoji} الاتجاه: ${record.direction}`,
          `سعر الدخول: $${record.entryPrice.toFixed(2)}`,
          `سعر الخروج: $${record.currentMarketPrice.toFixed(2)}`,
          `الأرباح المحققة: ${pnlSign}$${record.currentPnlUsd.toFixed(2)}`,
          `العائد المحقق: ${rSign}${record.currentRMultiple.toFixed(2)}R`,
          'مصدر النتيجة: USER_CONFIRMED',
        ].join('\n');

      case 'CLOSED_LOSS':
        return [
          '❌ الصفقة أغلقت — خسارة',
          '',
          `${dirEmoji} الاتجاه: ${record.direction}`,
          `سعر الدخول: $${record.entryPrice.toFixed(2)}`,
          `سعر الخروج: $${record.currentMarketPrice.toFixed(2)}`,
          `الخسارة المحققة: $${record.currentPnlUsd.toFixed(2)}`,
          `العائد المحقق: ${record.currentRMultiple.toFixed(2)}R`,
          'مصدر النتيجة: USER_CONFIRMED',
        ].join('\n');

      default:
        return 'إشارة تداول الذهب';
    }
  }

  // --- BUTTONS BUILDER ---

  public formatInlineButtons(record: TelegramTrackingRecord): Array<Array<{ text: string; callback_data: string }>> {
    switch (record.lifecycleState) {
      case 'AWAITING_USER_DECISION':
        return [
          [
            { text: '🟢 دخلت الصفقة', callback_data: `entry_${record.signalId}` },
            { text: '⚪ ما دخلت', callback_data: `cancel_${record.signalId}` },
          ],
        ];

      case 'ENTERED':
      case 'ACTIVE_TRACKING':
        return [
          [
            { text: '💰 ربحت', callback_data: `win_${record.signalId}` },
            { text: '❌ خسرت', callback_data: `loss_${record.signalId}` },
          ],
          [
            { text: '↩️ إلغاء المتابعة', callback_data: `cancel_${record.signalId}` },
          ],
        ];

      case 'CANCELLED_BY_USER':
      case 'CLOSED_WIN':
      case 'CLOSED_LOSS':
      default:
        return []; // Remove all buttons when terminal
    }
  }

  // --- CALLBACK QUERY PROCESSOR ---

  public async handleCallbackQuery(payload: {
    callbackQueryId: string;
    userId: string;
    chatId: string;
    callbackData: string;
  }): Promise<CallbackQueryResult> {
    const { callbackQueryId, userId, chatId, callbackData } = payload;

    // 1. Authorization check
    if (!this.isAuthorized(userId, chatId)) {
      return {
        success: false,
        message: 'غير مصرح لك بهذا الإجراء',
        alert: true,
      };
    }

    // 2. Parse action and signalId
    const parts = callbackData.split('_');
    const action = parts[0]; // 'entry', 'cancel', 'win', 'loss'
    const signalId = parts.slice(1).join('_');

    const record = this.trackingMap.get(signalId);
    if (!record) {
      return {
        success: false,
        message: 'عذراً، الإشارة غير موجودة أو منتهية الصلاحية',
        alert: true,
      };
    }

    // 3. Idempotency Check
    const callbackKey = `${callbackQueryId}_${callbackData}`;
    if (this.processedCallbacks.has(callbackKey)) {
      return {
        success: true,
        message: 'تم استقبال قرارك سابقاً',
        newState: record.lifecycleState,
        updatedRecord: record,
      };
    }
    this.processedCallbacks.add(callbackKey);

    // 4. Map Action to Target Lifecycle State
    let targetState: SignalLifecycleState;
    if (action === 'entry') {
      targetState = 'ACTIVE_TRACKING';
    } else if (action === 'cancel') {
      targetState = 'CANCELLED_BY_USER';
    } else if (action === 'win') {
      targetState = 'CLOSED_WIN';
    } else if (action === 'loss') {
      targetState = 'CLOSED_LOSS';
    } else {
      return {
        success: false,
        message: 'إجراء غير معروف',
        alert: true,
      };
    }

    // 5. State Transition Check
    if (!TelegramBotService.isValidTransition(record.lifecycleState, targetState)) {
      return {
        success: false,
        message: `لا يمكن الانتقال من ${record.lifecycleState} إلى ${targetState}`,
        alert: true,
        newState: record.lifecycleState,
        updatedRecord: record,
      };
    }

    // 6. Execute Transition Logic
    record.lifecycleState = targetState;
    record.lastUpdatedTimestamp = Date.now();
    record.outcomeSource = 'USER_CONFIRMED';

    let answerMsg = '';

    if (targetState === 'ACTIVE_TRACKING') {
      answerMsg = 'تم تأكيد دخول الصفقة — جاري المتابعة';
      try {
        const { TradingEngine } = await import('../../services/trading_engine.ts');
        TradingEngine.getInstance().confirmUserEntry(signalId);
      } catch {}
    } else if (targetState === 'CANCELLED_BY_USER') {
      answerMsg = 'تم إلغاء متابعة الإشارة (لم تدخل الصفقة)';
      try {
        const { TradingEngine } = await import('../../services/trading_engine.ts');
        TradingEngine.getInstance().cancelUserTracking(signalId);
      } catch {}
    } else if (targetState === 'CLOSED_WIN') {
      answerMsg = 'تم تسجيل إغلاق الصفقة بنجاح على ربح';
      this.recordManualTradeOutcome(record, 'CLOSED_WIN');
      try {
        const { TradingEngine } = await import('../../services/trading_engine.ts');
        TradingEngine.getInstance().confirmUserTradeWin(signalId);
      } catch {}
    } else if (targetState === 'CLOSED_LOSS') {
      answerMsg = 'تم تسجيل إغلاق الصفقة على خسارة';
      this.recordManualTradeOutcome(record, 'CLOSED_LOSS');
      try {
        const { TradingEngine } = await import('../../services/trading_engine.ts');
        TradingEngine.getInstance().confirmUserTradeLoss(signalId);
      } catch {}
    }

    this.trackingMap.set(signalId, record);
    this.persistTrackingRecord(record);

    // 7. Dispatch HTTP message update to Telegram API if token is configured
    await this.dispatchTelegramEditMessage(record);

    return {
      success: true,
      message: answerMsg,
      alert: false,
      newState: record.lifecycleState,
      updatedRecord: record,
    };
  }

  // --- LIVE MARKET PRICE UPDATE MONITORING ---

  public updateMarketPrice(signalId: string, currentPrice: number): void {
    const record = this.trackingMap.get(signalId);
    if (!record || record.lifecycleState !== 'ACTIVE_TRACKING') {
      return;
    }

    record.currentMarketPrice = currentPrice;
    const isBuy = record.direction === 'BUY';
    const entry = record.entryPrice;
    const slDist = Math.max(0.1, Math.abs(entry - record.stopLoss));

    // Calculate P&L and R-Multiple based on $10 per 1.00 USD movement per lot (or fixed risk scale)
    const priceDiff = isBuy ? currentPrice - entry : entry - currentPrice;
    record.currentRMultiple = Number((priceDiff / slDist).toFixed(2));
    record.currentPnlUsd = Number((priceDiff * 10).toFixed(2)); // Standard 0.10 lot gold pip value scale

    if (record.currentRMultiple > record.mfeR) {
      record.mfeR = record.currentRMultiple;
      record.mfePrice = currentPrice;
    }

    if (record.currentRMultiple < record.maeR) {
      record.maeR = record.currentRMultiple;
      record.maePrice = currentPrice;
    }

    record.lastUpdatedTimestamp = Date.now();
    this.trackingMap.set(signalId, record);

    // Throttle Telegram message update
    const lastEdit = this.lastMessageEditTimestamp.get(signalId) || 0;
    if (Date.now() - lastEdit >= this.rateLimitIntervalMs) {
      this.lastMessageEditTimestamp.set(signalId, Date.now());
      this.dispatchTelegramEditMessage(record).catch(() => {});
    }
  }

  // --- TELEGRAM HTTP DISPATCHERS ---

  public async dispatchTelegramMessage(record: TelegramTrackingRecord): Promise<{ messageId?: string; error?: string }> {
    if (!this.enabled) {
      return { error: 'Telegram is disabled' };
    }

    if (!this.botToken || !record.chatId) {
      return { error: 'Telegram bot token or chatId not configured' };
    }

    try {
      const text = this.formatMessageText(record);
      const replyMarkup = { inline_keyboard: this.formatInlineButtons(record) };

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: record.chatId,
          text,
          reply_markup: replyMarkup,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { error: `Telegram API error HTTP ${res.status}: ${errText}` };
      }

      const data = await res.json();
      const messageId = String(data.result?.message_id || '');
      if (messageId) {
        record.telegramMessageId = messageId;
        this.trackingMap.set(record.signalId, record);
        this.persistTrackingRecord(record);
      }
      return { messageId };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  public async dispatchTelegramEditMessage(record: TelegramTrackingRecord): Promise<boolean> {
    if (!this.botToken || !record.chatId || !record.telegramMessageId) {
      return false;
    }

    try {
      const text = this.formatMessageText(record);
      const replyMarkup = { inline_keyboard: this.formatInlineButtons(record) };

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: record.chatId,
          message_id: record.telegramMessageId,
          text,
          reply_markup: replyMarkup,
        }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  // --- MANUAL OUTCOME RECORDING ---

  private recordManualTradeOutcome(record: TelegramTrackingRecord, outcomeType: 'CLOSED_WIN' | 'CLOSED_LOSS'): void {
    const isWin = outcomeType === 'CLOSED_WIN';
    const exitPrice = record.currentMarketPrice || (isWin ? record.takeProfit1 : record.stopLoss);
    const pnlUsd = isWin ? Math.abs(record.currentPnlUsd || 30) : -Math.abs(record.currentPnlUsd || 30);
    const realizedR = isWin ? Math.max(1.5, record.currentRMultiple || 1.5) : -1.0;

    const outcome: TradeOutcome = {
      id: `m_out_${Date.now()}`,
      tradeId: `m_trade_${record.signalId}`,
      setupId: `m_setup_${record.signalId}`,
      signalId: record.signalId,
      strategy: 'liquidity_sweep_reversal',
      direction: record.direction,
      entryPrice: record.entryPrice,
      exitPrice,
      exitReason: isWin ? 'USER_CONFIRMED_WIN' : 'USER_CONFIRMED_LOSS',
      pnlUsd,
      realizedR,
      mfeR: record.mfeR,
      maeR: record.maeR,
      durationMinutes: Math.max(1, Math.round((Date.now() - record.lastUpdatedTimestamp) / 60000)),
      marketRegime: 'TREND_UP',
      newsContext: {},
      riskConfiguration: { source: 'USER_CONFIRMED' },
      strategyVersion: '2.0.0',
      analysisVersion: '2.0.0',
      monitoringVersion: '2.0.0',
      createdAt: Date.now(),
      outcomeSource: 'USER_CONFIRMED',
    };

    supabasePersistence.persistTradeOutcome(outcome).catch(() => {});
  }

  // --- PERSISTENCE HELPERS ---

  private persistTrackingRecord(record: TelegramTrackingRecord): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_telegram_tracking') || '{}';
        const map = JSON.parse(raw);
        map[record.signalId] = record;
        localStorage.setItem('gold_bot_telegram_tracking', JSON.stringify(map));
      } catch {}
    }

    // Persist status to Supabase signals table
    supabasePersistence.postRow('signal_updates', {
      signal_id: record.signalId,
      update_type: 'TELEGRAM_LIFECYCLE',
      details: record,
    }).catch(() => {});
  }

  private loadPersistedTracking(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('gold_bot_telegram_tracking');
        if (raw) {
          const map = JSON.parse(raw);
          for (const key of Object.keys(map)) {
            this.trackingMap.set(key, map[key]);
          }
        }
      } catch {}
    }
  }

  public getRecord(signalId: string): TelegramTrackingRecord | undefined {
    return this.trackingMap.get(signalId);
  }

  public getAllRecords(): TelegramTrackingRecord[] {
    return Array.from(this.trackingMap.values());
  }
}

export const telegramBotService = TelegramBotService.getInstance();
