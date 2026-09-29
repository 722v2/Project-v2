/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { BENCHMARK_TEST_CASES, BenchmarkTestCase } from '../tests/fixtures/benchmark_dataset.ts';

export interface Round2Stats {
  modelId: string;
  isAvailable: boolean;
  totalRequests: number;
  successfulRequests: number;
  rateLimitErrors: number;
  timeoutErrors: number;
  otherErrors: number;
  structuredOutputSupported: boolean;
  structuredOutputSuccessCount: number;
  fallbackJsonSuccessCount: number;
  schemaValidCount: number;
  longCount: number;
  shortCount: number;
  noTradeCount: number;
  correctDecisionCount: number;
  totalLatencyMs: number;
  latencies: number[];
  errorLogs: string[];
}

export interface Round2CaseResult {
  caseId: string;
  expectedDecision: string;
  modelId: string;
  decision: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  confidence: number;
  setupQuality: string;
  schemaValid: boolean;
  latencyMs: number;
  structuredOutputUsed: boolean;
  fallbackUsed: boolean;
  error?: string;
  rawResponse?: string;
}

const SYSTEM_PROMPT = `You are an institutional quantitative market analyst for Gold (XAUUSD).
Your task is to analyze the provided technical market snapshot and determine if a high-confluence trade setup exists.

CRITICAL RULES:
1. Analyze ONLY the supplied market data. Do NOT invent missing information.
2. Use price action and structure (such as trend, breaks of structure, sweeps, key support and resistance).
3. Consider liquidity pools, equal highs/lows, and liquidity sweeps where appropriate.
4. Consider order blocks and Fair Value Gaps (FVG) where supplied.
5. Use Fibonacci levels and volume information where supplied.
6. Use RSI, EMAs, and MACD strictly as supporting evidence. MACD is NOT a hard entry filter.
7. Allow "NO_TRADE" decisions if market conditions lack confluence, are messy, or are ambiguous. Do not force trades.
8. Respect supplied risk constraints (such as stop loss placement and take profit targets).
9. Do not reveal or assume any predefined outcomes. Your decision must be strictly independent.`;

const JSON_SCHEMA = {
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
    risk_notes: { type: 'array', items: { type: 'string' } },
    invalidations: { type: 'array', items: { type: 'string' } }
  },
  required: ['decision', 'entry', 'stop_loss', 'take_profit_1', 'take_profit_2', 'confidence', 'setup_quality', 'reasons', 'risk_notes', 'invalidations']
};

const TARGET_MODELS = [
  'inclusionai/ling-3.0-flash-fin:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free'
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function validateAndParse(rawText: string): {
  isValid: boolean;
  decision: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  confidence: number;
  setupQuality: string;
  parsedJson: any;
} {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

  let parsed: any = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {}
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      isValid: false,
      decision: 'INVALID',
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      confidence: 0,
      setupQuality: 'NONE',
      parsedJson: null
    };
  }

  const decision = String(parsed.decision || '').toUpperCase().trim();
  const entry = typeof parsed.entry === 'number' ? parsed.entry : null;
  const stopLoss = typeof parsed.stop_loss === 'number' ? parsed.stop_loss : null;
  const takeProfit1 = typeof parsed.take_profit_1 === 'number' ? parsed.take_profit_1 : null;
  const takeProfit2 = typeof parsed.take_profit_2 === 'number' ? parsed.take_profit_2 : null;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const setupQuality = String(parsed.setup_quality || 'NONE').toUpperCase().trim();

  let schemaValid = ['LONG', 'SHORT', 'NO_TRADE'].includes(decision);
  if (decision === 'NO_TRADE') {
    if (entry !== null || stopLoss !== null || takeProfit1 !== null) {
      schemaValid = false;
    }
  } else if (decision === 'LONG' || decision === 'SHORT') {
    if (entry === null || stopLoss === null || takeProfit1 === null) {
      schemaValid = false;
    }
  }

  return {
    isValid: schemaValid,
    decision,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    confidence,
    setupQuality,
    parsedJson: parsed
  };
}

export async function runRound2(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  console.log('================================================================');
  console.log('GOLD AI BOT V2 — MODEL BENCHMARK ROUND 2 EVALUATION');
  console.log('================================================================');

  // Verify dynamic availability
  let availableModels: string[] = [];
  try {
    const catalogRes = await fetch('https://openrouter.ai/api/v1/models');
    if (catalogRes.ok) {
      const catalog = await catalogRes.json();
      if (Array.isArray(catalog?.data)) {
        const catalogIds = catalog.data.map((m: any) => m.id);
        availableModels = catalogIds;
      }
    }
  } catch (err) {
    console.warn('Error fetching dynamic availability catalog:', err);
  }

  const casesToTest = BENCHMARK_TEST_CASES.filter((tc) =>
    ['case_001_bullish_sweep', 'case_002_bearish_bos', 'case_003_no_trade_low_confluence', 'case_004_conflicting_signals', 'case_008_repeat_bullish_sweep'].includes(tc.id)
  );

  const statsMap = new Map<string, Round2Stats>();
  const allResults: Round2CaseResult[] = [];

  for (const modelId of TARGET_MODELS) {
    const isAvail = availableModels.length > 0 ? availableModels.includes(modelId) : true;
    statsMap.set(modelId, {
      modelId,
      isAvailable: isAvail,
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitErrors: 0,
      timeoutErrors: 0,
      otherErrors: 0,
      structuredOutputSupported: false,
      structuredOutputSuccessCount: 0,
      fallbackJsonSuccessCount: 0,
      schemaValidCount: 0,
      longCount: 0,
      shortCount: 0,
      noTradeCount: 0,
      correctDecisionCount: 0,
      totalLatencyMs: 0,
      latencies: [],
      errorLogs: []
    });
  }

  for (const modelId of TARGET_MODELS) {
    const stats = statsMap.get(modelId)!;
    console.log(`\n>>> Evaluating Model: ${modelId} (Available: ${stats.isAvailable})`);

    if (!stats.isAvailable) {
      console.log(`  Skipping evaluation: model is reported as currently unavailable in catalog.`);
      continue;
    }

    for (const testCase of casesToTest) {
      stats.totalRequests++;
      const userPrompt = `Analyze the following technical market snapshot:\n${JSON.stringify(testCase.marketSnapshot, null, 2)}`;
      
      const startTime = Date.now();
      let rawText = '';
      let errorStr = '';
      let structuredOutputUsed = false;
      let fallbackUsed = false;
      let httpStatus = 0;

      if (!apiKey) {
        errorStr = 'OPENROUTER_API_KEY not configured in environment';
        stats.otherErrors++;
        stats.errorLogs.push(errorStr);
      } else {
        // Attempt Native Structured Output
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000); // 12s timeout

          const payload = {
            model: modelId,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 350,
            response_format: {
              type: 'json_object',
              schema: JSON_SCHEMA
            }
          };

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://gold-ai-bot.v2',
              'X-Title': 'Gold AI Bot V2 Round 2'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timer);
          httpStatus = res.status;

          if (res.status === 400 || res.status === 422) {
            // Native Structured Output not supported by this provider/model. Execute controlled fallback.
            throw new Error('NATIVE_STRUCTURED_OUTPUT_NOT_SUPPORTED');
          }

          if (res.status === 429) {
            console.log(`  [429 Rate Limit] Retrying once for rate limit...`);
            await sleep(2000);
            // Single quick retry
            const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gold-ai-bot.v2',
                'X-Title': 'Gold AI Bot V2 Round 2'
              },
              body: JSON.stringify(payload)
            });
            httpStatus = retryRes.status;
            if (!retryRes.ok) {
              const body = await retryRes.text().catch(() => '');
              throw new Error(`HTTP ${retryRes.status}: ${body.slice(0, 150)}`);
            }
            const data = await retryRes.json();
            rawText = data.choices?.[0]?.message?.content || '';
            structuredOutputUsed = true;
            stats.structuredOutputSupported = true;
          } else if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${body.slice(0, 150)}`);
          } else {
            const data = await res.json();
            rawText = data.choices?.[0]?.message?.content || '';
            structuredOutputUsed = true;
            stats.structuredOutputSupported = true;
            stats.structuredOutputSuccessCount++;
          }
        } catch (err: any) {
          const isNoSchemaSupport = err.message?.includes('NATIVE_STRUCTURED_OUTPUT_NOT_SUPPORTED') || httpStatus === 400;

          if (isNoSchemaSupport) {
            // Execute fallback prompt instructing strict valid JSON output
            fallbackUsed = true;
            try {
              const fallbackController = new AbortController();
              const fallbackTimer = setTimeout(() => fallbackController.abort(), 12000);

              const fallbackPayload = {
                model: modelId,
                messages: [
                  { role: 'system', content: `${SYSTEM_PROMPT}\n\nCRITICAL CONSTRAINT: Respond ONLY with a valid raw JSON object matching the required schema. Return ONLY valid JSON. No markdown explanation. No text outside the JSON.` },
                  { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 350
              };

              const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                  'HTTP-Referer': 'https://gold-ai-bot.v2',
                  'X-Title': 'Gold AI Bot V2 Round 2 Fallback'
                },
                body: JSON.stringify(fallbackPayload),
                signal: fallbackController.signal
              });

              clearTimeout(fallbackTimer);
              httpStatus = fallbackRes.status;

              if (fallbackRes.status === 429) {
                stats.rateLimitErrors++;
                errorStr = 'HTTP 429: Rate limited';
              } else if (!fallbackRes.ok) {
                const body = await fallbackRes.text().catch(() => '');
                errorStr = `HTTP ${fallbackRes.status}: ${body.slice(0, 150)}`;
                stats.otherErrors++;
              } else {
                const fallbackData = await fallbackRes.json();
                // Robust extraction
                rawText = fallbackData.choices?.[0]?.message?.content || '';
                if (!rawText) {
                  rawText = fallbackData.choices?.[0]?.message?.reasoning || '';
                }
                if (!rawText && Array.isArray(fallbackData.choices?.[0]?.message?.reasoning_details)) {
                  rawText = fallbackData.choices[0].message.reasoning_details.map((d: any) => d.text || '').join('');
                }
                stats.fallbackJsonSuccessCount++;
              }
            } catch (fallbackErr: any) {
              const isAbort = fallbackErr.name === 'AbortError';
              errorStr = isAbort ? 'Timeout error' : fallbackErr.message || 'Fallback network exception';
              if (isAbort) stats.timeoutErrors++;
              else stats.otherErrors++;
            }
          } else {
            const isAbort = err.name === 'AbortError';
            errorStr = isAbort ? 'Timeout error' : err.message || 'Network exception';
            if (isAbort) stats.timeoutErrors++;
            else if (httpStatus === 429) stats.rateLimitErrors++;
            else stats.otherErrors++;
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      stats.totalLatencyMs += latencyMs;
      stats.latencies.push(latencyMs);

      // Parse & Validate
      const parsedVal = validateAndParse(rawText);

      if (parsedVal.isValid) {
        stats.schemaValidCount++;
      }
      if (parsedVal.decision === 'LONG') stats.longCount++;
      if (parsedVal.decision === 'SHORT') stats.shortCount++;
      if (parsedVal.decision === 'NO_TRADE') stats.noTradeCount++;

      if (parsedVal.decision === testCase.expectedDecision) {
        stats.correctDecisionCount++;
      }

      if (errorStr) {
        stats.errorLogs.push(`[${testCase.id}] ${errorStr}`);
      } else {
        stats.successfulRequests++;
      }

      allResults.push({
        caseId: testCase.id,
        expectedDecision: testCase.expectedDecision,
        modelId,
        decision: parsedVal.decision,
        entry: parsedVal.entry,
        stopLoss: parsedVal.stopLoss,
        takeProfit1: parsedVal.takeProfit1,
        takeProfit2: parsedVal.takeProfit2,
        confidence: parsedVal.confidence,
        setupQuality: parsedVal.setupQuality,
        schemaValid: parsedVal.isValid,
        latencyMs,
        structuredOutputUsed,
        fallbackUsed,
        error: errorStr || undefined,
        rawResponse: rawText || undefined
      });

      console.log(`  - [${testCase.id}] Decision: ${parsedVal.decision} | Expected: ${testCase.expectedDecision} | Schema Valid: ${parsedVal.isValid} | Latency: ${latencyMs}ms`);
    }
  }

  // Create Results JSON
  const resultsJsonPath = path.resolve(process.cwd(), 'model_benchmark_round2_results.json');
  const resultsData = {
    benchmarkDate: new Date().toISOString(),
    totalModelsTested: TARGET_MODELS.length,
    totalTestCases: casesToTest.length,
    totalRequests: TARGET_MODELS.length * casesToTest.length,
    stats: Array.from(statsMap.values()).map((s) => ({
      ...s,
      avgLatencyMs: Math.round(s.latencies.reduce((a, b) => a + b, 0) / (s.latencies.length || 1)),
      medianLatencyMs: [...s.latencies].sort((a, b) => a - b)[Math.floor(s.latencies.length / 2)] || 0,
      accuracyPct: Math.round((s.correctDecisionCount / (s.totalRequests || 1)) * 100),
      schemaValidPct: Math.round((s.schemaValidCount / (s.totalRequests || 1)) * 100)
    })),
    detailedRuns: allResults
  };

  fs.writeFileSync(resultsJsonPath, JSON.stringify(resultsData, null, 2), 'utf-8');
  console.log(`\n✓ Saved Round 2 Results JSON to: ${resultsJsonPath}`);

  // Create Report Markdown
  const reportPath = path.resolve(process.cwd(), 'model_benchmark_round2_report.md');
  const markdownReport = generateRound2Report(resultsData);
  fs.writeFileSync(reportPath, markdownReport, 'utf-8');
  console.log(`✓ Saved Round 2 Report Markdown to: ${reportPath}`);
}

function generateRound2Report(results: any): string {
  const lines: string[] = [];

  lines.push('# GOLD AI BOT V2 — OPENROUTER MODEL EVALUATION ROUND 2 REPORT');
  lines.push('');
  lines.push(`**Date**: ${results.benchmarkDate}`);
  lines.push(`**OpenRouter Endpoint**: \`https://openrouter.ai/api/v1/chat/completions\``);
  lines.push(`**Total Requests Executed**: ${results.totalRequests}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 1. Model Availability');
  lines.push('');
  for (const s of results.stats) {
    lines.push(`- \`${s.modelId}\`: **${s.isAvailable ? 'Available' : 'Not Available (Omitted)'}**`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 2. API Reliability & Structured Output Performance');
  lines.push('');
  lines.push('| Model ID | Success / Total | 429 Errors | Timeout Errors | Native Structured Output Supported | Native Success | Fallback JSON Success | Schema Validity % | Avg Latency |');
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const s of results.stats) {
    lines.push(`| \`${s.modelId}\` | ${s.successfulRequests}/${s.totalRequests} | ${s.rateLimitErrors} | ${s.timeoutErrors} | ${s.structuredOutputSupported ? 'Yes' : 'No'} | ${s.structuredOutputSuccessCount} | ${s.fallbackJsonSuccessCount} | ${s.schemaValidPct}% | ${s.avgLatencyMs}ms |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 3. Trading Outputs');
  lines.push('');
  lines.push('| Case | Model | Expected | Model Decision | Entry | SL | TP1 | TP2 | Confidence | Setup Quality | Schema Valid | Latency | Error |');
  lines.push('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |');

  for (const run of results.detailedRuns) {
    const entryStr = run.entry !== null ? `$${run.entry}` : 'null';
    const slStr = run.stopLoss !== null ? `$${run.stopLoss}` : 'null';
    const tpStr = run.takeProfit1 !== null ? `$${run.takeProfit1}` : 'null';
    const tp2Str = run.takeProfit2 !== null ? `$${run.takeProfit2}` : 'null';
    lines.push(`| \`${run.caseId}\` | \`${run.modelId}\` | ${run.expectedDecision} | **${run.decision}** | ${entryStr} | ${slStr} | ${tpStr} | ${tp2Str} | ${run.confidence} | ${run.setupQuality} | ${run.schemaValid ? 'Yes' : 'No'} | ${run.latencyMs}ms | ${run.error || 'None'} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 4. Behavioral Observations');
  lines.push('');
  for (const s of results.stats) {
    lines.push(`### Model: \`${s.modelId}\``);
    lines.push(`- **Response Integrity**: ${s.successfulRequests}/${s.totalRequests} API calls executed successfully.`);
    lines.push(`- **Structured Output Compliance**: Native JSON support was **${s.structuredOutputSupported ? 'successfully handled' : 'not supported (fallback JSON invoked)'}**; resulting in **${s.schemaValidPct}%** final valid schema compliance.`);
    lines.push(`- **Trade Frequency & Decisions**: generated ${s.longCount} LONG, ${s.shortCount} SHORT, and ${s.noTradeCount} NO_TRADE decisions.`);
    lines.push(`- **Accuracy & Support**: reached **${s.accuracyPct}%** alignment with the expected quantitative ground truth decisions.`);
    lines.push('');
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 5. Production Governance Confirmation');
  lines.push('');
  lines.push('- **NO WINNER DECLARED**: No candidate model has been selected as the official model.');
  lines.push('- **NO AUTOMATIC DEPLOYMENT**: Production configs and trading logics remain completely untouched.');
  lines.push('');

  return lines.join('\n');
}

// Execute if run directly via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runRound2().catch((err) => {
    console.error('Fatal Round 2 error:', err);
    process.exit(1);
  });
}
