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
      (typeof process !== 'undefined' ? (process.env.NOVITA_BASE_URL || process.env.OPENROUTER_BASE_URL) : '') ||
      'https://api.novita.ai/openai/v1'
    ).replace(/\/+$/, '');
    this.apiKey =
      config?.apiKey ??
      (typeof process !== 'undefined'
        ? (process.env.NOVITA_API_KEY || process.env.OPENROUTER_API_KEY || '')
        : '');
    this.model =
      config?.model ||
      (typeof process !== 'undefined' ? process.env.AI_MODEL : '') ||
      'deepseek/deepseek-v4-flash';
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
      provider: 'Novita AI',
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

  public static readonly CONFLICT_RESOLUTION_POLICY = `
CONFLICT-RESOLUTION POLICY:
- NO_TRADE is valid and preferred when evidence is materially conflicting.
- A higher-timeframe trend by itself is NOT sufficient for entry.
- If HTF direction conflicts with LTF structure, liquidity behavior, price action, or other major context, do not automatically follow the HTF trend.
- If there is a warning of bull trap, bear trap, conflicting structure, failed confirmation, unclear liquidity reaction, or contradictory timeframe signals, require additional confirmation; otherwise, return NO_TRADE.
- Never force a trade merely because one timeframe has a directional bias.
- A trade requires meaningful confluence.
- MACD remains ONLY a supporting confluence factor and must never override conflicting structural evidence.
- If the evidence is balanced or contradictory, choose NO_TRADE.`;

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const prompt = `Review this setup for ${context.symbol}. Reasons: ${context.reasons.join('; ')}. Rules: ${OpenRouterClient.CONFLICT_RESOLUTION_POLICY}`;
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 180,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        success: true,
        explanation: data.choices?.[0]?.message?.content || '',
        provider: 'openrouter',
        modelUsed: this.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');
      return {
        success: false,
        provider: 'openrouter',
        modelUsed: this.model,
        latencyMs: Date.now() - startTime,
        error: isTimeout
          ? `AI reasoning timed out after ${this.timeoutMs}ms (AI_REASONING_TIMEOUT_MS enforced)`
          : this.sanitizeError(err),
      };
    }
  }

  private readonly toolSchema = {
    type: 'function',
    function: {
      name: 'submit_trade_analysis',
      description: 'Return the final structured XAUUSD analysis.',
      parameters: {
        type: 'object',
        properties: {
          decision: { type: 'string', enum: ['LONG', 'SHORT', 'NO_TRADE'] },
          entry: { type: ['number', 'null'] },
          stop_loss: { type: ['number', 'null'] },
          take_profit_1: { type: ['number', 'null'] },
          take_profit_2: { type: ['number', 'null'] },
          confidence: { type: 'number' },
          setup_quality: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW', 'NONE'] },
          reasons: { type: 'array', items: { type: 'string' } },
          risk_notes: { type: 'array', items: { type: 'string' } }
        },
        required: ['decision', 'entry', 'stop_loss', 'take_profit_1', 'take_profit_2', 'confidence', 'setup_quality', 'reasons', 'risk_notes']
      }
    }
  };

  public async analyzeSetupWithTools(snapshot: any): Promise<any> {
    const prompt = `Analyze this technical market snapshot: ${JSON.stringify(snapshot)}
    CRITICAL RULES:
    ${OpenRouterClient.CONFLICT_RESOLUTION_POLICY}
    `;

    const payload = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2500,
      tools: [this.toolSchema],
      tool_choice: { type: 'function', function: { name: 'submit_trade_analysis' } }
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call returned');

    return JSON.parse(toolCall.function.arguments);
  }

}

export const openRouterClient = new OpenRouterClient();
