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

// Helper: Identify missing Telegram environment variables
function getMissingTelegramConfigs(): string[] {
  const missing: string[] = [];
  if (!process.env.TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!process.env.TELEGRAM_CHAT_ID) missing.push('TELEGRAM_CHAT_ID');
  if (!process.env.TELEGRAM_USER_ID) missing.push('TELEGRAM_USER_ID');
  return missing;
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
    const chatId = process.env.TELEGRAM_CHAT_ID || '';
    const userId = process.env.TELEGRAM_USER_ID || '';

    const enabled = process.env.TELEGRAM_ENABLED !== 'false';

    if (missingConfigs.length > 0) {
      return res.json({
        state: 'UNCONFIGURED',
        enabled,
        hasToken: Boolean(token),
        hasChatId: Boolean(chatId),
        hasUserId: Boolean(userId),
        missingConfigs,
        lastCheckTimestamp: Date.now(),
        lastError: `المتغيرات التالية مفقودة: ${missingConfigs.join(', ')}`,
      });
    }

    const start = Date.now();
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const latencyMs = Date.now() - start;
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      return res.json({
        state: 'CONNECTED',
        enabled,
        hasToken: true,
        hasChatId: true,
        hasUserId: true,
        missingConfigs: [],
        botName: data.result?.first_name || 'Gold AI Bot',
        botUsername: data.result?.username ? `@${data.result.username}` : undefined,
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
        hasChatId: true,
        hasUserId: true,
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
      hasChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
      hasUserId: Boolean(process.env.TELEGRAM_USER_ID),
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
  const chatId = process.env.TELEGRAM_CHAT_ID || '';

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
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!targetChatId) {
      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not configured' });
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
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

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
