/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Concurrent test request lock
let isTestRunning = false;

// 1. Health Check Endpoint (Unauthenticated & no secrets required)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'gold-ai-bot-v2',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// Helper: Identify missing Telegram environment variables (Only TELEGRAM_BOT_TOKEN is required)
function getMissingTelegramConfigs(): string[] {
  const missing: string[] = [];
  if (!process.env.TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  return missing;
}

// Global server-side state for persisted and discovered Telegram credentials
let persistedChatId = '';
let persistedUserId = '';
let discoveredChatId = '';
let discoveredUserId = '';
let persistedLoaded = false;

// Helper: Get Telegram Chat ID following strict priority
function getTelegramChatId(): string {
  return (
    process.env.TELEGRAM_CHAT_ID ||
    persistedChatId ||
    discoveredChatId ||
    ''
  );
}

// Helper: Get Telegram User ID following strict priority
function getTelegramUserId(): string {
  return (
    process.env.TELEGRAM_USER_ID ||
    persistedUserId ||
    discoveredUserId ||
    ''
  );
}

// Helper: Load persisted Telegram configuration from Supabase
async function loadPersistedTelegramChatId(): Promise<{ chatId?: string; userId?: string }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/strategy_settings?order=strategy_id.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row.custom_params) {
            if (row.custom_params.telegramChatId) {
              return {
                chatId: String(row.custom_params.telegramChatId),
                userId: row.custom_params.telegramUserId ? String(row.custom_params.telegramUserId) : undefined,
              };
            }
            if (row.custom_params._generalConfig && row.custom_params._generalConfig.telegramChatId) {
              return {
                chatId: String(row.custom_params._generalConfig.telegramChatId),
                userId: row.custom_params._generalConfig.telegramUserId ? String(row.custom_params._generalConfig.telegramUserId) : undefined,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Telegram Persistence] Failed to load persisted telegram chat ID:', err);
  }
  return {};
}

// Helper: Persist discovered Chat ID & User ID permanently into Supabase
async function persistDiscoveredTelegramChatId(chatId: string, userId?: string): Promise<boolean> {
  persistedChatId = chatId;
  discoveredChatId = chatId;
  if (userId) {
    persistedUserId = userId;
    discoveredUserId = userId;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('[Telegram Discovery] Discovered Chat ID:', chatId, 'Saved in memory (Supabase not configured).');
    return false;
  }

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/strategy_settings?strategy_id=eq.liquidity_sweep_reversal`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    let existingCustomParams: Record<string, any> = {};
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0] && rows[0].custom_params) {
        existingCustomParams = rows[0].custom_params;
      }
    }

    const updatedCustomParams = {
      ...existingCustomParams,
      telegramChatId: chatId,
      telegramUserId: userId || existingCustomParams.telegramUserId,
      _generalConfig: {
        ...(existingCustomParams._generalConfig || {}),
        telegramChatId: chatId,
        telegramUserId: userId || existingCustomParams._generalConfig?.telegramUserId,
      },
    };

    const updateRes = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/strategy_settings?strategy_id=eq.liquidity_sweep_reversal`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        custom_params: updatedCustomParams,
        updated_at: new Date().toISOString(),
      }),
    });

    if (updateRes.ok) {
      console.log('[Telegram Discovery] Successfully persisted Chat ID:', chatId, 'to Supabase.');
      return true;
    } else {
      console.warn('[Telegram Discovery] Failed to patch strategy_settings in Supabase:', updateRes.status);
    }
  } catch (err) {
    console.warn('[Telegram Discovery] Error persisting to Supabase:', err);
  }
  return false;
}

// Helper: Automatically discover Chat ID from Telegram getUpdates API
async function discoverTelegramChatId(token: string): Promise<{ chatId?: string; userId?: string; error?: string }> {
  const existingChatId = getTelegramChatId();
  if (existingChatId) {
    return { chatId: existingChatId, userId: getTelegramUserId() };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const rawDesc = data.description || `HTTP ${res.status}`;
      return { error: sanitizeTelegramError(rawDesc) };
    }

    const data = await res.json().catch(() => ({}));
    if (!data.ok || !Array.isArray(data.result)) {
      return { error: 'Invalid update payload from Telegram' };
    }

    for (const update of data.result.slice().reverse()) {
      const msg = update.message || update.edited_message || update.channel_post || update.callback_query?.message;
      if (!msg) continue;

      const chat = msg.chat;
      const from = msg.from;

      if (chat && chat.id) {
        if (from?.is_bot) continue;

        const foundChatId = String(chat.id);
        const foundUserId = from?.id ? String(from.id) : undefined;

        await persistDiscoveredTelegramChatId(foundChatId, foundUserId);

        return { chatId: foundChatId, userId: foundUserId };
      }
    }

    return {};
  } catch (err: any) {
    return { error: sanitizeTelegramError(err?.message || 'Network error during getUpdates') };
  }
}

// Helper: Sanitize sensitive bot token out of error responses
function sanitizeTelegramError(errorStr: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return errorStr;
  return errorStr.replaceAll(token, '***TOKEN***');
}

// 2. GET /api/telegram/status
app.get('/api/telegram/status', async (_req: Request, res: Response) => {
  try {
    const missingConfigs = getMissingTelegramConfigs();
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const enabled = process.env.TELEGRAM_ENABLED !== 'false';

    if (missingConfigs.length > 0) {
      return res.json({
        state: 'UNCONFIGURED',
        enabled,
        hasToken: Boolean(token),
        hasChatId: Boolean(getTelegramChatId()),
        hasUserId: Boolean(getTelegramUserId()),
        missingConfigs,
        lastCheckTimestamp: Date.now(),
        lastError: `المتغيرات التالية مفقودة: ${missingConfigs.join(', ')}`,
      });
    }

    // Ensure persisted credentials are loaded from Supabase on first run
    if (!persistedLoaded) {
      const loaded = await loadPersistedTelegramChatId();
      if (loaded.chatId) persistedChatId = loaded.chatId;
      if (loaded.userId) persistedUserId = loaded.userId;
      persistedLoaded = true;
    }

    let activeChatId = getTelegramChatId();
    let activeUserId = getTelegramUserId();

    // If no Chat ID exists yet, attempt automatic discovery using getUpdates
    if (!activeChatId) {
      const discoveryResult = await discoverTelegramChatId(token);
      if (discoveryResult.chatId) {
        activeChatId = discoveryResult.chatId;
        if (discoveryResult.userId) activeUserId = discoveryResult.userId;
      }
    }

    const start = Date.now();
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const latencyMs = Date.now() - start;
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      const botName = data.result?.first_name || 'Gold AI Bot';
      const botUsername = data.result?.username ? `@${data.result.username}` : undefined;

      if (!activeChatId) {
        return res.json({
          state: 'WAITING_FOR_START',
          enabled,
          hasToken: true,
          hasChatId: false,
          hasUserId: false,
          missingConfigs: [],
          botName,
          botUsername,
          lastCheckTimestamp: Date.now(),
          latencyMs,
          lastError: 'افتح البوت واضغط Start لإتمام الربط',
        });
      }

      return res.json({
        state: 'CONNECTED',
        enabled,
        hasToken: true,
        hasChatId: true,
        hasUserId: Boolean(activeUserId),
        missingConfigs: [],
        botName,
        botUsername,
        chatId: activeChatId,
        userId: activeUserId,
        lastCheckTimestamp: Date.now(),
        latencyMs,
      });
    } else {
      const rawDesc = data.description || `HTTP ${response.status}`;
      const safeDesc = sanitizeTelegramError(rawDesc);
      return res.json({
        state: 'DISCONNECTED',
        enabled,
        hasToken: true,
        hasChatId: Boolean(activeChatId),
        hasUserId: Boolean(activeUserId),
        missingConfigs: [],
        lastCheckTimestamp: Date.now(),
        latencyMs,
        lastError: `فشل الاتصال بـ Telegram Bot API (${safeDesc})`,
      });
    }
  } catch (err: any) {
    const safeMsg = sanitizeTelegramError(err?.message || 'Network request failed');
    return res.json({
      state: 'DISCONNECTED',
      enabled: process.env.TELEGRAM_ENABLED !== 'false',
      hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasChatId: Boolean(getTelegramChatId()),
      hasUserId: Boolean(getTelegramUserId()),
      missingConfigs: getMissingTelegramConfigs(),
      lastCheckTimestamp: Date.now(),
      lastError: `خطأ اتصال: ${safeMsg}`,
    });
  }
});

// 3. POST /api/telegram/test
app.post('/api/telegram/test', async (_req: Request, res: Response) => {
  if (isTestRunning) {
    return res.status(429).json({
      success: false,
      message: 'جاري تشغيل اختبار بالفعل، يرجى الانتظار...',
      error: 'Duplicate test request',
    });
  }

  const missingConfigs = getMissingTelegramConfigs();
  if (missingConfigs.length > 0) {
    return res.status(400).json({
      success: false,
      message: `تعذر الإرسال: المتغيرات التالية مفقودة (${missingConfigs.join(', ')})`,
      error: 'Missing Telegram credentials',
      missingConfigs,
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '';

  if (!persistedLoaded) {
    const loaded = await loadPersistedTelegramChatId();
    if (loaded.chatId) persistedChatId = loaded.chatId;
    if (loaded.userId) persistedUserId = loaded.userId;
    persistedLoaded = true;
  }

  let chatId = getTelegramChatId();
  if (!chatId) {
    const discovered = await discoverTelegramChatId(token);
    if (discovered.chatId) {
      chatId = discovered.chatId;
    }
  }

  if (!chatId) {
    return res.status(400).json({
      success: false,
      message: 'افتح البوت واضغط Start لإتمام الربط',
      error: 'Telegram Chat ID not found. Send /start to the bot first.',
    });
  }

  isTestRunning = true;
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

    const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!telegramRes.ok) {
      const errText = await telegramRes.text().catch(() => '');
      const safeError = sanitizeTelegramError(errText || `HTTP ${telegramRes.status}`);
      return res.status(400).json({
        success: false,
        message: '🔴 فشل إرسال رسالة الاختبار',
        error: `خطأ Telegram API: ${safeError}`,
      });
    }

    return res.json({
      success: true,
      message: '🟢 تم إرسال رسالة الاختبار بنجاح',
    });
  } catch (err: any) {
    const safeError = sanitizeTelegramError(err?.message || 'Unknown error');
    return res.status(500).json({
      success: false,
      message: '🔴 فشل إرسال رسالة الاختبار',
      error: safeError,
    });
  } finally {
    isTestRunning = false;
  }
});

// 4. POST /api/telegram/sendMessage
app.post('/api/telegram/sendMessage', async (req: Request, res: Response) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured on server' });
  }

  try {
    const { chatId, text, replyMarkup } = req.body;
    const targetChatId = chatId || getTelegramChatId();

    if (!targetChatId) {
      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not configured and not discovered' });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        reply_markup: replyMarkup,
      }),
    });

    const data = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok) {
      const safeDesc = sanitizeTelegramError(data.description || `HTTP ${tgRes.status}`);
      return res.status(tgRes.status).json({ error: safeDesc });
    }

    return res.json(data);
  } catch (err: any) {
    const safeErr = sanitizeTelegramError(err?.message || 'Failed to dispatch Telegram message');
    return res.status(500).json({ error: safeErr });
  }
});

// 5. POST /api/telegram/editMessageText
app.post('/api/telegram/editMessageText', async (req: Request, res: Response) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured on server' });
  }

  try {
    const { chatId, messageId, text, replyMarkup } = req.body;
    const targetChatId = chatId || getTelegramChatId();

    if (!targetChatId || !messageId) {
      return res.status(400).json({ error: 'chatId or messageId missing' });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        message_id: messageId,
        text,
        reply_markup: replyMarkup,
      }),
    });

    const data = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok) {
      const safeDesc = sanitizeTelegramError(data.description || `HTTP ${tgRes.status}`);
      return res.status(tgRes.status).json({ error: safeDesc });
    }

    return res.json(data);
  } catch (err: any) {
    const safeErr = sanitizeTelegramError(err?.message || 'Failed to edit Telegram message');
    return res.status(500).json({ error: safeErr });
  }
});

// Proxy biquote market data endpoint
app.use('/api/biquote', async (req: Request, res: Response) => {
  try {
    const targetUrl = `https://biquote.io/api${req.url}`;
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    const data = await proxyRes.text();
    res.status(proxyRes.status).send(data);
  } catch {
    res.status(502).json({ error: 'Market data proxy error' });
  }
});

// Serve frontend static assets or mount Vite dev middleware
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || process.env.SERVE_STATIC) {
  app.use(express.static(distDir));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(distDir, 'index.html'));
  });
} else {
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: rootDir,
    });
    app.use(vite.middlewares);
  } catch {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }
}

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gold AI Bot V2 server running on http://0.0.0.0:${PORT}`);
  });
}
