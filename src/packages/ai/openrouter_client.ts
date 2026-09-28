/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpenRouterConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface AIReasoningResult {
  success: boolean;
  explanation?: string;
  confluenceSummary?: string;
  riskAdvisory?: string;
  error?: string;
  provider: string;
}

export class OpenRouterClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config?: OpenRouterConfig) {
    this.baseUrl = (config?.baseUrl || (typeof process !== 'undefined' ? process.env.OPENROUTER_BASE_URL : '') || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    this.apiKey = config?.apiKey || (typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY : '') || '';
    this.model = config?.model || (typeof process !== 'undefined' ? process.env.AI_MODEL : '') || 'google/gemini-2.5-flash';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  public getStatus(): { configured: boolean; provider: string; model: string; baseUrl: string } {
    return {
      configured: this.isConfigured(),
      provider: 'openrouter',
      model: this.model,
      baseUrl: this.baseUrl,
    };
  }

  /**
   * Interprets deterministic technical structure.
   * AI MUST NOT invent market prices or bypass deterministic validation.
   */
  public async interpretSetup(context: {
    symbol: string;
    strategy: string;
    direction: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    regime: string;
    reasons: string[];
  }): Promise<AIReasoningResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'openrouter',
        error: 'OPENROUTER_API_KEY not configured. Deterministic analysis remains authoritative.',
      };
    }

    try {
      const prompt = `You are a quantitative market analyst reviewing an institutional setup for ${context.symbol}.
Strategy: ${context.strategy}
Direction: ${context.direction}
Entry: $${context.entryPrice}
Stop Loss: $${context.stopLoss}
Take Profit: $${context.takeProfit1}
Market Regime: ${context.regime}
Deterministic Reasons: ${context.reasons.join(', ')}

Provide a concise 2-sentence summary of the institutional confluence and risk profile. Do not invent any prices.`;

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
          max_tokens: 150,
        }),
      });

      if (!res.ok) {
        return {
          success: false,
          provider: 'openrouter',
          error: `OpenRouter returned HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        explanation: text,
        provider: 'openrouter',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'openrouter',
        error: err.message,
      };
    }
  }
}

export const openRouterClient = new OpenRouterClient();
