/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpenRouterConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface AIReasoningResult {
  success: boolean;
  explanation?: string;
  confluenceSummary?: string;
  riskAdvisory?: string;
  marketContext?: string;
  strategyContext?: string;
  riskNotes?: string;
  newsContext?: string;
  error?: string;
  provider: string;
  modelUsed?: string;
  latencyMs?: number;
}

export interface AIConnectivityTestResult {
  success: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  authenticated: boolean;
  httpStatus?: number;
  latencyMs?: number;
  modelsCount?: number;
  error?: string;
  timestamp: string;
}

export class OpenRouterClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: OpenRouterConfig) {
    this.baseUrl = (
      config?.baseUrl ||
      (typeof process !== 'undefined' ? process.env.OPENROUTER_BASE_URL : '') ||
      'https://openrouter.ai/api/v1'
    ).replace(/\/+$/, '');
    this.apiKey =
      config?.apiKey ||
      (typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY : '') ||
      '';
    this.model =
      config?.model ||
      (typeof process !== 'undefined' ? process.env.AI_MODEL : '') ||
      'google/gemini-2.5-flash';
    this.timeoutMs =
      config?.timeoutMs ||
      (typeof process !== 'undefined' && process.env.AI_REASONING_TIMEOUT_MS
        ? Number(process.env.AI_REASONING_TIMEOUT_MS)
        : 30000);
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  public getStatus(): {
    configured: boolean;
    provider: string;
    model: string;
    baseUrl: string;
    timeoutMs: number;
  } {
    return {
      configured: this.isConfigured(),
      provider: 'openrouter',
      model: this.model,
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
    };
  }

  /**
   * Safe error sanitization to ensure credentials/bearer tokens are never leaked into logs or error strings.
   */
  private sanitizeError(err: any): string {
    const rawMsg = err?.message || String(err);
    if (!this.apiKey) return rawMsg;
    return rawMsg.replace(new RegExp(this.apiKey, 'g'), '[REDACTED_API_KEY]');
  }

  /**
   * Real API Connectivity check against OpenRouter.
   * Performs a lightweight probe against /models or minimal chat completion endpoint.
   */
  public async testConnectivity(): Promise<AIConnectivityTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'openrouter',
        baseUrl: this.baseUrl,
        model: this.model,
        authenticated: false,
        error: 'OPENROUTER_API_KEY not configured in server environment',
        timestamp,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 10000));

      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://gold-ai-bot.v2',
          'X-Title': 'Gold AI Bot V2 Connectivity Audit',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          success: false,
          provider: 'openrouter',
          baseUrl: this.baseUrl,
          model: this.model,
          authenticated: res.status !== 401 && res.status !== 403,
          httpStatus: res.status,
          latencyMs,
          error: `OpenRouter returned HTTP ${res.status}: ${res.statusText}`,
          timestamp,
        };
      }

      const data = await res.json();
      const modelsCount = Array.isArray(data?.data) ? data.data.length : 0;

      return {
        success: true,
        provider: 'openrouter',
        baseUrl: this.baseUrl,
        model: this.model,
        authenticated: true,
        httpStatus: res.status,
        latencyMs,
        modelsCount,
        timestamp,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        provider: 'openrouter',
        baseUrl: this.baseUrl,
        model: this.model,
        authenticated: false,
        latencyMs,
        error: this.sanitizeError(err),
        timestamp,
      };
    }
  }

  /**
   * Interprets deterministic technical structure.
   * AI MUST NOT invent market prices or bypass deterministic validation.
   * Deterministic calculations (entry, stop loss, take profit, risk sizing) remain 100% authoritative.
   */
  public async interpretSetup(context: {
    symbol: string;
    strategy: string;
    direction: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    regime: string;
    qualityScore?: number;
    reasons: string[];
    newsContext?: string;
  }): Promise<AIReasoningResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'openrouter',
        modelUsed: this.model,
        error: 'OPENROUTER_API_KEY not configured. Deterministic analysis remains authoritative.',
      };
    }

    try {
      const prompt = `You are an institutional quantitative market analyst reviewing a pre-validated setup for ${context.symbol}.
Strategy: ${context.strategy}
Direction: ${context.direction}
Pre-calculated Entry: $${context.entryPrice}
Pre-calculated Stop Loss: $${context.stopLoss}
Pre-calculated TP1: $${context.takeProfit1}
${context.takeProfit2 ? `Pre-calculated TP2: $${context.takeProfit2}` : ''}
Market Regime: ${context.regime}
Quality Score: ${context.qualityScore ?? 75}/100
Deterministic Reasons: ${context.reasons.join('; ')}
${context.newsContext ? `News Context: ${context.newsContext}` : ''}

CRITICAL RULES:
1. Do NOT invent prices, candles, or indicators.
2. Provide a structured 2-sentence institutional synthesis covering: (a) confluence summary, (b) key risk advisory.`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://gold-ai-bot.v2',
          'X-Title': 'Gold AI Bot V2',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 180,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          success: false,
          provider: 'openrouter',
          modelUsed: this.model,
          latencyMs,
          error: `OpenRouter returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        explanation: text,
        confluenceSummary: text,
        marketContext: context.regime,
        strategyContext: context.strategy,
        newsContext: context.newsContext,
        provider: 'openrouter',
        modelUsed: this.model,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');

      return {
        success: false,
        provider: 'openrouter',
        modelUsed: this.model,
        latencyMs,
        error: isTimeout
          ? `AI reasoning timed out after ${this.timeoutMs}ms (AI_REASONING_TIMEOUT_MS enforced)`
          : this.sanitizeError(err),
      };
    }
  }
}

export const openRouterClient = new OpenRouterClient();
