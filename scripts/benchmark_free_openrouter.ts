/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

export interface FreeBenchmarkResult {
  model: string;
  testCaseKey: string;
  testCaseName: string;
  success: boolean;
  latencyMs: number;
  httpStatus?: number;
  direction?: string;
  confidence?: number;
  isValidJson: boolean;
  evidenceAligned: boolean;
  hallucinated: boolean;
  riskCompliant: boolean;
  noTradeDiscipline: boolean;
  promptTokens?: number;
  completionTokens?: number;
  reportedCost?: string;
  rawResponseText?: string;
  error?: string;
}

export const CANDIDATE_MODELS = [
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-26b-a4b:free',
  'google/gemma-4-31b:free',
];

// Also check canonical -it suffix variants if exact ID is invalid
export const MODEL_ALIASES: Record<string, string> = {
  'google/gemma-4-26b-a4b:free': 'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b:free': 'google/gemma-4-31b-it:free',
};

const SYSTEM_PROMPT = `You are a quantitative market analyst reviewing an institutional setup for XAU/USD.
Analyze ONLY the supplied market data and technical evidence.

CRITICAL INSTRUCTIONS:
1. Do NOT invent prices, candles, RSI, MACD, or any market data not explicitly provided.
2. Return ONLY a single valid JSON object matching this EXACT schema:
{
  "direction": "BUY" | "SELL" | "NO_TRADE",
  "confidence": number (0-100),
  "explanation": "string",
  "confluenceSummary": "string",
  "marketContext": "string",
  "strategyContext": "string",
  "riskNotes": "string"
}`;

export const TEST_CASES = {
  A_VALID_BUY: {
    name: 'Test Case A — Valid BUY Setup',
    payload: `Symbol: XAU/USD
Current Price: $2895.50
Structure: 15M Bullish BOS confirmed at $2892.00, 1H Trend UP.
Liquidity: Asian Low swept at $2888.50.
POI: Active 15M Bullish FVG between $2890.00 - $2893.00.
Deterministic Strategy: Strategy 1 (Liquidity Sweep + Reversal).
Pre-calculated Entry: $2895.50
Pre-calculated Stop Loss: $2890.00 ($5.50 SL distance <= $12.00 max limit).
Pre-calculated Take Profit 1: $2906.50 (1:2.0 RR >= 1:1.50 min limit).
Quality Score: 85/100.
RSI(14): 42 (Oversold recovery). MACD: Bullish crossover on 5M.`,
    expectedDirection: 'BUY',
    allowNoTrade: false,
    mustCheckHallucination: false,
    hardInvalidated: false,
  },

  B_VALID_SELL: {
    name: 'Test Case B — Valid SELL Setup',
    payload: `Symbol: XAU/USD
Current Price: $2910.00
Structure: 15M Bearish BOS confirmed at $2915.00, 1H Trend DOWN.
Liquidity: London High swept at $2922.00.
POI: Active 5M Bearish Order Block at $2912.00 - $2918.00.
Deterministic Strategy: Strategy 4 (Order Block Reaction).
Pre-calculated Entry: $2910.00
Pre-calculated Stop Loss: $2916.00 ($6.00 SL distance <= $12.00 max limit).
Pre-calculated Take Profit 1: $2898.00 (1:2.0 RR >= 1:1.50 min limit).
Quality Score: 82/100.
RSI(14): 68 (Overbought rejection). MACD: Bearish histogram expansion.`,
    expectedDirection: 'SELL',
    allowNoTrade: false,
    mustCheckHallucination: false,
    hardInvalidated: false,
  },

  C_NO_VALID_SETUP: {
    name: 'Test Case C — No Valid Setup',
    payload: `Symbol: XAU/USD
Current Price: $2900.00
Structure: Ranging / Unclear in mid-range Equilibrium. No BOS or CHOCH detected on 15M/1H.
Liquidity: No recent sweeps of liquidity pools.
POI: None.
Deterministic Strategy: None active.
Quality Score: 45/100 (Below min threshold 65).
RSI(14): 50.0 (Flat neutral). MACD: Zero line chop. Volume: Anemic.`,
    expectedDirection: 'NO_TRADE',
    allowNoTrade: true,
    mustCheckHallucination: false,
    hardInvalidated: false,
  },

  D_CONFLICTING_EVIDENCE: {
    name: 'Test Case D — Conflicting Evidence',
    payload: `Symbol: XAU/USD
Current Price: $2902.00
Structure: 1H Bullish Trend vs 5M Bearish Breakdown.
Liquidity: Unconfirmed sweeps on both sides.
POI: Overlapping inverse FVG with bullish OB.
Deterministic Strategy: Strategy 5 (Confluence).
Quality Score: 58/100 (Low confidence).
RSI(14): 51. MACD: Divergence between 5M and 15M timeframes.`,
    expectedDirection: 'NO_TRADE',
    allowNoTrade: true,
    mustCheckHallucination: false,
    hardInvalidated: false,
  },

  E_HALLUCINATION_TEST: {
    name: 'Test Case E — Data Integrity / Hallucination Test',
    payload: `Symbol: XAU/USD
Current Price: $2898.00
Structure: 15M Bullish Structure.
[NOTE: RSI, MACD, Volume, and News Data have been OMITTED from this dataset]
Deterministic Strategy: Strategy 2 (BOS Pullback).
Pre-calculated Entry: $2898.00
Pre-calculated Stop Loss: $2893.00
Pre-calculated Take Profit 1: $2908.00`,
    expectedDirection: 'BUY',
    allowNoTrade: true,
    mustCheckHallucination: true,
    hardInvalidated: false,
  },

  F_HARD_RISK_CONSTRAINT: {
    name: 'Test Case F — Hard Risk Constraint',
    payload: `Symbol: XAU/USD
Current Price: $2895.00
DETERMINISTIC INVALIDATION REASON: SL Distance is $25.00 ($2895 entry - $2870 SL), exceeding maximum allowed limit of $12.00.
Risk Engine Status: HARD REJECTED / INVALIDATED.
RR Ratio: 0.80 (Below minimum required 1.50).`,
    expectedDirection: 'NO_TRADE',
    allowNoTrade: true,
    mustCheckHallucination: false,
    hardInvalidated: true,
  },
};

async function executeSingleCall(
  model: string,
  testCaseKey: string,
  testCase: typeof TEST_CASES.A_VALID_BUY,
  apiKey: string,
  baseUrl: string
): Promise<FreeBenchmarkResult> {
  const startTime = Date.now();
  const result: FreeBenchmarkResult = {
    model,
    testCaseKey,
    testCaseName: testCase.name,
    success: false,
    latencyMs: 0,
    isValidJson: false,
    evidenceAligned: false,
    hallucinated: false,
    riskCompliant: true,
    noTradeDiscipline: true,
    reportedCost: '$0.00',
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://gold-ai-bot.v2',
        'X-Title': 'Gold AI Bot V2 Free Model Benchmark',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: testCase.payload },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    result.latencyMs = Date.now() - startTime;
    result.httpStatus = res.status;

    if (!res.ok) {
      const errorText = await res.text();
      let msg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const parsedErr = JSON.parse(errorText);
        if (parsedErr?.error?.message) {
          msg = `HTTP ${res.status}: ${parsedErr.error.message}`;
        }
      } catch {}
      result.error = msg;
      return result;
    }

    const data = await res.json();
    result.promptTokens = data.usage?.prompt_tokens ?? 0;
    result.completionTokens = data.usage?.completion_tokens ?? 0;

    const content = data.choices?.[0]?.message?.content || '';
    result.rawResponseText = content;

    let parsed: any = null;
    try {
      const cleanJson = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      parsed = JSON.parse(cleanJson);
      result.isValidJson = Boolean(
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.direction === 'string' &&
        ['BUY', 'SELL', 'NO_TRADE'].includes(parsed.direction) &&
        typeof parsed.confidence === 'number'
      );
    } catch {
      result.isValidJson = false;
    }

    if (!result.isValidJson || !parsed) {
      result.error = 'Failed to parse required JSON schema';
      return result;
    }

    result.direction = parsed.direction;
    result.confidence = parsed.confidence;
    result.success = true;

    if (testCase.hardInvalidated) {
      if (parsed.direction !== 'NO_TRADE' && parsed.confidence > 50) {
        result.riskCompliant = false;
        result.evidenceAligned = false;
      } else {
        result.riskCompliant = true;
        result.evidenceAligned = true;
      }
    } else if (testCase.allowNoTrade) {
      if (parsed.direction === 'NO_TRADE' || parsed.direction === testCase.expectedDirection) {
        result.noTradeDiscipline = true;
        result.evidenceAligned = true;
      } else {
        result.noTradeDiscipline = false;
        result.evidenceAligned = false;
      }
    } else {
      if (parsed.direction === testCase.expectedDirection) {
        result.evidenceAligned = true;
      } else {
        result.evidenceAligned = false;
      }
    }

    if (testCase.mustCheckHallucination) {
      const fullText = (
        (parsed.explanation || '') +
        (parsed.confluenceSummary || '') +
        (parsed.marketContext || '') +
        (parsed.strategyContext || '') +
        (parsed.riskNotes || '')
      ).toLowerCase();

      const rsiMention = /rsi\s*\(?14\)?\s*[:=]?\s*\d+/i.test(fullText) || /rsi\s*is\s*\d+/i.test(fullText);
      const macdMention = /macd\s*is\s*[-+]?\d+/i.test(fullText) || /macd\s*value/i.test(fullText);

      if (rsiMention || macdMention) {
        result.hallucinated = true;
      }
    }

  } catch (err: any) {
    result.latencyMs = Date.now() - startTime;
    result.error = err.message || String(err);
  }

  return result;
}

export async function runFreeBenchmark() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

  const allResults: Record<string, FreeBenchmarkResult[]> = {};

  for (const requestedModel of CANDIDATE_MODELS) {
    allResults[requestedModel] = [];

    for (const [key, testCase] of Object.entries(TEST_CASES)) {
      let res = await executeSingleCall(requestedModel, key, testCase, apiKey, baseUrl);

      // If rate limited or transient error, retry up to 2 times with backoff
      if (!res.success && res.httpStatus === 429) {
        await new Promise((r) => setTimeout(r, 2000));
        res = await executeSingleCall(requestedModel, key, testCase, apiKey, baseUrl);
      }

      // If exact model ID gave 400 Bad Request, try candidate alias if available
      if (!res.success && res.httpStatus === 400 && MODEL_ALIASES[requestedModel]) {
        const aliasModel = MODEL_ALIASES[requestedModel];
        let aliasRes = await executeSingleCall(aliasModel, key, testCase, apiKey, baseUrl);
        if (!aliasRes.success && aliasRes.httpStatus === 429) {
          await new Promise((r) => setTimeout(r, 2000));
          aliasRes = await executeSingleCall(aliasModel, key, testCase, apiKey, baseUrl);
        }
        aliasRes.model = requestedModel; // maintain requested model key in reporting
        aliasRes.error = `Exact ID ${requestedModel} gave HTTP 400 (Invalid ID). Alias ${aliasModel} returned: ${aliasRes.error || 'SUCCESS'}`;
        res = aliasRes;
      }

      allResults[requestedModel].push(res);
    }
  }

  return allResults;
}

if (import.meta.url.endsWith(process.argv[1])) {
  runFreeBenchmark().then((results) => {
    console.log(JSON.stringify(results, null, 2));
  });
}
