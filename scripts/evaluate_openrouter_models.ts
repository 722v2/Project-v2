/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { BENCHMARK_TEST_CASES, BenchmarkTestCase } from '../tests/fixtures/benchmark_dataset.ts';

export interface ModelEvalStats {
  modelId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  validJsonCount: number;
  schemaValidCount: number;
  groundTruthMatches: number;
  longCount: number;
  shortCount: number;
  noTradeCount: number;
  noTradeCaseCorrectCount: number; // For cases expected to be NO_TRADE
  noTradeCaseTotal: number;
  riskRuleViolations: number;
  totalLatencyMs: number;
  latencies: number[];
  promptTokensTotal: number;
  completionTokensTotal: number;
  repeatabilityMatch: boolean | null;
  errorLogs: string[];
}

export interface CaseRunResult {
  caseId: string;
  caseName: string;
  category: string;
  expectedDecision: 'LONG' | 'SHORT' | 'NO_TRADE';
  modelId: string;
  httpStatus: number;
  latencyMs: number;
  rawResponse: string;
  parsedJson: any | null;
  isValidJson: boolean;
  isSchemaValid: boolean;
  decision: 'LONG' | 'SHORT' | 'NO_TRADE' | 'INVALID';
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  confidence: number;
  setupQuality: string;
  reasons: string[];
  riskNotes: string[];
  invalidations: string[];
  promptTokens?: number;
  completionTokens?: number;
  matchesGroundTruth: boolean;
  riskViolationDetails?: string;
  errorMessage?: string;
}

const SYSTEM_PROMPT = `You are an institutional quantitative market analyst for Gold (XAUUSD).
Your task is to analyze technical market snapshots objectively and determine whether a high-confluence trade setup exists.

CRITICAL RULES:
1. Analyze ONLY the supplied market data. Do NOT invent prices, indicators, news, or levels.
2. If the setup lacks confluence, is messy, or is ambiguous, choose "NO_TRADE".
3. MACD is a momentum/confluence indicator only; do NOT reject an otherwise valid setup solely because MACD is not aligned.
4. Respond ONLY with a valid JSON object matching the EXACT schema provided below. Do NOT include markdown code blocks (\`\`\`json), commentary, or text outside the JSON.

REQUIRED JSON SCHEMA:
{
  "decision": "LONG | SHORT | NO_TRADE",
  "entry": number | null,
  "stop_loss": number | null,
  "take_profit_1": number | null,
  "take_profit_2": number | null,
  "confidence": number,
  "setup_quality": "HIGH | MEDIUM | LOW | NONE",
  "reasons": string[],
  "risk_notes": string[],
  "invalidations": string[]
}

FOR NO_TRADE:
If decision is "NO_TRADE", entry, stop_loss, take_profit_1, and take_profit_2 MUST all be null. Do not force prices.`;

/**
 * Sleep helper for retries
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dynamically query OpenRouter API for active free models ($0 prompt & $0 completion)
 */
async function fetchOpenRouterFreeModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      console.warn(`[OpenRouter Catalog] API returned HTTP ${res.status}. Using verified fallback list.`);
      return getFallbackFreeModels();
    }
    const data = await res.json();
    if (!Array.isArray(data?.data)) return getFallbackFreeModels();

    // Filter free models ($0 prompt & $0 completion)
    const freeModels = data.data.filter((m: any) => {
      const isFree = m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0';
      const isTextModel = m.id && !m.id.includes('audio') && !m.id.includes('lyria') && !m.id.includes('clip') && !m.id.includes('safety');
      const notFreeRouter = m.id !== 'openrouter/free'; // Rule 3: Do NOT benchmark openrouter/free
      return isFree && isTextModel && notFreeRouter;
    });

    const modelIds = freeModels.map((m: any) => m.id);
    console.log(`[OpenRouter Catalog] Found ${modelIds.length} live $0 free text models.`);

    // Prioritize models suitable for financial reasoning/structured output
    const priorityList = [
      'inclusionai/ling-3.0-flash-fin:free',
      'qwen/qwen3.8-27b:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'nvidia/nemotron-3.5-lightning:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    ];

    const selected: string[] = [];
    for (const p of priorityList) {
      if (modelIds.includes(p)) {
        selected.push(p);
      }
    }

    // Add other free models if fewer than 6 selected
    for (const id of modelIds) {
      if (selected.length >= 7) break;
      if (!selected.includes(id)) {
        selected.push(id);
      }
    }

    return selected.length > 0 ? selected : getFallbackFreeModels();
  } catch (err) {
    console.warn('[OpenRouter Catalog] Error fetching catalog:', err);
    return getFallbackFreeModels();
  }
}

function getFallbackFreeModels(): string[] {
  return [
    'inclusionai/ling-3.0-flash-fin:free',
    'qwen/qwen3.8-27b:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
  ];
}

/**
 * Validate response JSON against schema & risk rules
 */
function validateAndParseOutput(rawText: string): {
  parsedJson: any | null;
  isValidJson: boolean;
  isSchemaValid: boolean;
  decision: 'LONG' | 'SHORT' | 'NO_TRADE' | 'INVALID';
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  confidence: number;
  setupQuality: string;
  reasons: string[];
  riskNotes: string[];
  invalidations: string[];
  riskViolationDetails?: string;
} {
  let cleaned = rawText.trim();
  // Strip markdown wrap if model added it despite instructions
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

  let parsed: any = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Attempt extract JSON substring
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {}
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      parsedJson: null,
      isValidJson: false,
      isSchemaValid: false,
      decision: 'INVALID',
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      confidence: 0,
      setupQuality: 'NONE',
      reasons: [],
      riskNotes: [],
      invalidations: [],
      riskViolationDetails: 'Failed to parse JSON',
    };
  }

  const decisionRaw = String(parsed.decision || '').toUpperCase().trim();
  const validDecision = ['LONG', 'SHORT', 'NO_TRADE'].includes(decisionRaw)
    ? (decisionRaw as 'LONG' | 'SHORT' | 'NO_TRADE')
    : 'INVALID';

  const entry = typeof parsed.entry === 'number' ? parsed.entry : null;
  const stopLoss = typeof parsed.stop_loss === 'number' ? parsed.stop_loss : null;
  const takeProfit1 = typeof parsed.take_profit_1 === 'number' ? parsed.take_profit_1 : null;
  const takeProfit2 = typeof parsed.take_profit_2 === 'number' ? parsed.take_profit_2 : null;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const setupQuality = String(parsed.setup_quality || 'NONE').toUpperCase();
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [];
  const riskNotes = Array.isArray(parsed.risk_notes) ? parsed.risk_notes.map(String) : [];
  const invalidations = Array.isArray(parsed.invalidations) ? parsed.invalidations.map(String) : [];

  let isSchemaValid = validDecision !== 'INVALID';

  // Check schema & risk violations
  let riskViolationDetails = '';
  if (validDecision === 'NO_TRADE') {
    if (entry !== null || stopLoss !== null || takeProfit1 !== null) {
      riskViolationDetails = 'NO_TRADE decision specified non-null price levels';
      isSchemaValid = false;
    }
  } else if (validDecision === 'LONG' || validDecision === 'SHORT') {
    if (entry === null || stopLoss === null || takeProfit1 === null) {
      riskViolationDetails = `${validDecision} decision missing entry, SL, or TP1`;
      isSchemaValid = false;
    } else {
      // Check price level sanity for Gold
      if (entry <= 0 || stopLoss <= 0 || takeProfit1 <= 0) {
        riskViolationDetails = 'Invalid non-positive price level in trade setup';
      } else if (validDecision === 'LONG') {
        if (stopLoss >= entry) riskViolationDetails = 'LONG Stop Loss must be below Entry price';
        if (takeProfit1 <= entry) riskViolationDetails = 'LONG Take Profit must be above Entry price';
      } else if (validDecision === 'SHORT') {
        if (stopLoss <= entry) riskViolationDetails = 'SHORT Stop Loss must be above Entry price';
        if (takeProfit1 >= entry) riskViolationDetails = 'SHORT Take Profit must be below Entry price';
      }
    }
  }

  return {
    parsedJson: parsed,
    isValidJson: true,
    isSchemaValid: isSchemaValid && !riskViolationDetails,
    decision: validDecision,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    confidence,
    setupQuality,
    reasons,
    riskNotes,
    invalidations,
    riskViolationDetails: riskViolationDetails || undefined,
  };
}

/**
 * Main Benchmark Runner
 */
export async function runModelBenchmark(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  console.log('================================================================');
  console.log('GOLD AI BOT V2 — OPENROUTER MODEL EVALUATION BENCHMARK');
  console.log('================================================================');
  console.log(`API Key Provided: ${apiKey ? 'YES (Length: ' + apiKey.length + ')' : 'NO'}`);

  const candidateModels = await fetchOpenRouterFreeModels(apiKey);
  console.log(`Selected ${candidateModels.length} candidate free models for benchmarking:`);
  candidateModels.forEach((m, idx) => console.log(`  ${idx + 1}. ${m}`));

  console.log(`\nTest Cases Count: ${BENCHMARK_TEST_CASES.length}`);
  console.log('----------------------------------------------------------------');

  const allRunResults: CaseRunResult[] = [];
  const modelStatsMap = new Map<string, ModelEvalStats>();

  for (const modelId of candidateModels) {
    modelStatsMap.set(modelId, {
      modelId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      validJsonCount: 0,
      schemaValidCount: 0,
      groundTruthMatches: 0,
      longCount: 0,
      shortCount: 0,
      noTradeCount: 0,
      noTradeCaseCorrectCount: 0,
      noTradeCaseTotal: 0,
      riskRuleViolations: 0,
      totalLatencyMs: 0,
      latencies: [],
      promptTokensTotal: 0,
      completionTokensTotal: 0,
      repeatabilityMatch: null,
      errorLogs: [],
    });
  }

  // Track outputs for case_001 and case_008 for repeatability comparison
  const repeatabilityOutputs = new Map<string, Map<string, string>>();

  for (const modelId of candidateModels) {
    const stats = modelStatsMap.get(modelId)!;
    console.log(`\n>>> Evaluating Model: ${modelId}`);

    for (const testCase of BENCHMARK_TEST_CASES) {
      stats.totalRequests++;
      if (testCase.expectedDecision === 'NO_TRADE') {
        stats.noTradeCaseTotal++;
      }

      const userPrompt = `Analyze the following XAUUSD market snapshot:\n${JSON.stringify(testCase.marketSnapshot, null, 2)}`;

      const startTime = Date.now();
      let httpStatus = 0;
      let rawText = '';
      let errorMessage = '';
      let promptTokens = 0;
      let completionTokens = 0;

      if (!apiKey) {
        errorMessage = 'OPENROUTER_API_KEY not configured in environment';
        stats.failedRequests++;
        stats.errorLogs.push(errorMessage);
      } else {
        // Implement robust retry logic with exponential backoff on HTTP 429
        let attempts = 0;
        const maxAttempts = 3;
        let delayMs = 1500;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000); // 12s timeout per attempt

            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gold-ai-bot.v2',
                'X-Title': 'Gold AI Bot V2 Benchmark Harness',
              },
              body: JSON.stringify({
                model: modelId, // Rule 3: Fixed exact model ID, never openrouter/free
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 350,
              }),
              signal: controller.signal,
            });

            clearTimeout(timer);
            httpStatus = res.status;

            if (res.status === 429) {
              if (attempts < maxAttempts) {
                console.log(`  [429 Rate Limit] Model ${modelId} rate limited upstream. Retrying in ${delayMs}ms (Attempt ${attempts}/${maxAttempts})...`);
                await sleep(delayMs);
                delayMs *= 2;
                continue;
              }
            }

            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              errorMessage = `HTTP ${res.status}: ${errBody.slice(0, 150)}`;
            } else {
              const data = await res.json();
              // Robust Content Extraction supporting standard and reasoning-trace formats
              rawText = data.choices?.[0]?.message?.content || '';
              if (!rawText) {
                rawText = data.choices?.[0]?.message?.reasoning || '';
              }
              if (!rawText && Array.isArray(data.choices?.[0]?.message?.reasoning_details)) {
                rawText = data.choices[0].message.reasoning_details.map((d: any) => d.text || '').join('');
              }

              promptTokens = data.usage?.prompt_tokens || 0;
              completionTokens = data.usage?.completion_tokens || 0;
              stats.promptTokensTotal += promptTokens;
              stats.completionTokensTotal += completionTokens;
              errorMessage = ''; // Clear error on success
            }
            break; // Break loop on non-429 result
          } catch (err: any) {
            errorMessage = err?.message || 'Network exception';
            if (attempts < maxAttempts) {
              await sleep(delayMs);
              delayMs *= 1.5;
            }
          }
        }

        if (errorMessage) {
          stats.failedRequests++;
          stats.errorLogs.push(errorMessage);
        } else {
          stats.successfulRequests++;
        }
      }

      const latencyMs = Date.now() - startTime;
      stats.totalLatencyMs += latencyMs;
      stats.latencies.push(latencyMs);

      // Parse & Validate Response
      const val = validateAndParseOutput(rawText);

      if (val.isValidJson) stats.validJsonCount++;
      if (val.isSchemaValid) stats.schemaValidCount++;
      if (val.riskViolationDetails) stats.riskRuleViolations++;

      if (val.decision === 'LONG') stats.longCount++;
      if (val.decision === 'SHORT') stats.shortCount++;
      if (val.decision === 'NO_TRADE') stats.noTradeCount++;

      const matchesGroundTruth = val.decision === testCase.expectedDecision;
      if (matchesGroundTruth) {
        stats.groundTruthMatches++;
      }

      if (testCase.expectedDecision === 'NO_TRADE' && val.decision === 'NO_TRADE') {
        stats.noTradeCaseCorrectCount++;
      }

      // Track case_001 vs case_008 repeatability
      if (testCase.id === 'case_001_bullish_sweep' || testCase.id === 'case_008_repeat_bullish_sweep') {
        if (!repeatabilityOutputs.has(modelId)) {
          repeatabilityOutputs.set(modelId, new Map());
        }
        repeatabilityOutputs.get(modelId)!.set(testCase.id, val.decision);
      }

      allRunResults.push({
        caseId: testCase.id,
        caseName: testCase.name,
        category: testCase.category,
        expectedDecision: testCase.expectedDecision,
        modelId,
        httpStatus,
        latencyMs,
        rawResponse: rawText || (errorMessage ? `[ERROR] ${errorMessage}` : '[EMPTY]'),
        parsedJson: val.parsedJson,
        isValidJson: val.isValidJson,
        isSchemaValid: val.isSchemaValid,
        decision: val.decision,
        entry: val.entry,
        stopLoss: val.stopLoss,
        takeProfit1: val.takeProfit1,
        takeProfit2: val.takeProfit2,
        confidence: val.confidence,
        setupQuality: val.setupQuality,
        reasons: val.reasons,
        riskNotes: val.riskNotes,
        invalidations: val.invalidations,
        promptTokens,
        completionTokens,
        matchesGroundTruth,
        riskViolationDetails: val.riskViolationDetails,
        errorMessage: errorMessage || undefined,
      });

      console.log(
        `  - [${testCase.id}] Decision: ${val.decision} | Expected: ${testCase.expectedDecision} | Valid JSON: ${val.isValidJson} | Latency: ${latencyMs}ms`
      );
    }

    // Compute repeatability score
    const repMap = repeatabilityOutputs.get(modelId);
    if (repMap && repMap.has('case_001_bullish_sweep') && repMap.has('case_008_repeat_bullish_sweep')) {
      const dec1 = repMap.get('case_001_bullish_sweep');
      const dec8 = repMap.get('case_008_repeat_bullish_sweep');
      stats.repeatabilityMatch = dec1 === dec8 && dec1 !== 'INVALID';
    }
  }

  // Build Results JSON
  const resultsJsonPath = path.resolve(process.cwd(), 'model_benchmark_results.json');
  const resultsData = {
    benchmarkDate: new Date().toISOString(),
    totalModelsTested: candidateModels.length,
    totalTestCases: BENCHMARK_TEST_CASES.length,
    totalApiRequests: candidateModels.length * BENCHMARK_TEST_CASES.length,
    candidateModels,
    statsPerModel: Array.from(modelStatsMap.values()).map((s) => {
      const avgLatency = Math.round(s.latencies.reduce((a, b) => a + b, 0) / (s.latencies.length || 1));
      const sortedLat = [...s.latencies].sort((a, b) => a - b);
      const medianLatency = sortedLat[Math.floor(sortedLat.length / 2)] || 0;
      return {
        ...s,
        avgLatencyMs: avgLatency,
        medianLatencyMs: medianLatency,
        validJsonPct: Math.round((s.validJsonCount / (s.totalRequests || 1)) * 100),
        schemaValidPct: Math.round((s.schemaValidCount / (s.totalRequests || 1)) * 100),
        groundTruthMatchPct: Math.round((s.groundTruthMatches / (s.totalRequests || 1)) * 100),
        noTradeDisciplinePct: Math.round((s.noTradeCaseCorrectCount / (s.noTradeCaseTotal || 1)) * 100),
      };
    }),
    detailedRuns: allRunResults,
  };

  fs.writeFileSync(resultsJsonPath, JSON.stringify(resultsData, null, 2), 'utf-8');
  console.log(`\n✓ Saved machine-readable results to: ${resultsJsonPath}`);

  // Build Markdown Report
  const reportPath = path.resolve(process.cwd(), 'model_benchmark_report.md');
  const markdownReport = generateMarkdownReport(resultsData);
  fs.writeFileSync(reportPath, markdownReport, 'utf-8');
  console.log(`✓ Saved human-readable report to: ${reportPath}`);

  console.log('\n================================================================');
  console.log('BENCHMARK EVALUATION COMPLETE — NO PRODUCTION MODEL SELECTED');
  console.log('================================================================\n');
}

function generateMarkdownReport(results: any): string {
  const lines: string[] = [];

  lines.push('# GOLD AI BOT V2 — OPENROUTER MODEL EVALUATION BENCHMARK REPORT');
  lines.push('');
  lines.push(`**Date**: ${results.benchmarkDate}`);
  lines.push(`**OpenRouter Endpoint**: \`https://openrouter.ai/api/v1/chat/completions\``);
  lines.push(`**Total Candidate Models Tested**: ${results.totalModelsTested}`);
  lines.push(`**Test Cases Per Model**: ${results.totalTestCases}`);
  lines.push(`**Total API Requests Executed**: ${results.totalApiRequests}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 1. Candidate Models Tested');
  lines.push('');
  results.candidateModels.forEach((m: string, i: number) => {
    lines.push(`${i + 1}. \`${m}\``);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 2. Aggregated Performance Metrics Per Model');
  lines.push('');
  lines.push('| Model ID | Success / Total | Valid JSON % | Schema Valid % | Avg Latency | Median Latency | Ground Truth Match % | No-Trade Discipline | Consistency | Tokens (P/C) |');
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  for (const s of results.statsPerModel) {
    const consistencyStr = s.repeatabilityMatch === true ? 'Pass' : s.repeatabilityMatch === false ? 'Fail' : 'N/A';
    lines.push(
      `| \`${s.modelId}\` | ${s.successfulRequests}/${s.totalRequests} | ${s.validJsonPct}% | ${s.schemaValidPct}% | ${s.avgLatencyMs}ms | ${s.medianLatencyMs}ms | ${s.groundTruthMatchPct}% | ${s.noTradeDisciplinePct}% | ${consistencyStr} | ${s.promptTokensTotal}/${s.completionTokensTotal} |`
    );
  }

  lines.push('');
  lines.push('### Decision Distribution Breakdown');
  lines.push('');
  lines.push('| Model ID | LONG Decisions | SHORT Decisions | NO_TRADE Decisions | Risk Rule Violations |');
  lines.push('| :--- | :---: | :---: | :---: | :---: |');

  for (const s of results.statsPerModel) {
    lines.push(
      `| \`${s.modelId}\` | ${s.longCount} | ${s.shortCount} | ${s.noTradeCount} | ${s.riskRuleViolations} |`
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 3. Case-by-Case Detailed Results');
  lines.push('');
  lines.push('| Case ID | Model ID | Expected | Model Decision | Entry | SL | TP1 | Valid JSON | Latency | Ground Truth Match | Notes / Violations |');
  lines.push('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |');

  for (const run of results.detailedRuns) {
    const entryStr = run.entry !== null ? `$${run.entry}` : 'null';
    const slStr = run.stopLoss !== null ? `$${run.stopLoss}` : 'null';
    const tpStr = run.takeProfit1 !== null ? `$${run.takeProfit1}` : 'null';
    const matchStr = run.matchesGroundTruth ? 'Match' : 'Mismatch';
    const note = run.errorMessage ? `Error: ${run.errorMessage}` : run.riskViolationDetails ? `Violation: ${run.riskViolationDetails}` : 'OK';

    lines.push(
      `| \`${run.caseId}\` | \`${run.modelId}\` | ${run.expectedDecision} | **${run.decision}** | ${entryStr} | ${slStr} | ${tpStr} | ${run.isValidJson ? 'Yes' : 'No'} | ${run.latencyMs}ms | ${matchStr} | ${note} |`
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 4. Objective Observations (MODEL EVALUATION SUMMARY)');
  lines.push('');
  lines.push('The following objective observations summarize model behavior across all test cases:');
  lines.push('');

  for (const s of results.statsPerModel) {
    lines.push(`### Model: \`${s.modelId}\``);
    lines.push(`- **Response Rate & Reliability**: ${s.successfulRequests}/${s.totalRequests} API calls completed successfully (${s.failedRequests} errors).`);
    lines.push(`- **Structured Output Compliance**: ${s.validJsonPct}% valid JSON syntax, ${s.schemaValidPct}% strict schema adherence.`);
    lines.push(`- **Decision Frequency**: ${s.longCount} LONG, ${s.shortCount} SHORT, ${s.noTradeCount} NO_TRADE.`);
    lines.push(`- **No-Trade Discipline**: ${s.noTradeDisciplinePct}% accuracy on cases requiring NO_TRADE (avoiding invented signals).`);
    lines.push(`- **Ground Truth Alignment**: ${s.groundTruthMatchPct}% overall decision agreement with expected benchmark labels.`);
    lines.push(`- **Latency & Sizing**: Average latency ${s.avgLatencyMs}ms (median ${s.medianLatencyMs}ms). Token usage: ${s.promptTokensTotal} prompt tokens, ${s.completionTokensTotal} completion tokens.`);
    lines.push(`- **Consistency Check**: Repeatability test on identical snapshots resulted in ${s.repeatabilityMatch ? 'identical decision' : 'different decision'}.`);
    if (s.errorLogs.length > 0) {
      lines.push(`- **Noted Errors**: ${s.errorLogs[0]}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## 5. Production Governance Confirmation');
  lines.push('');
  lines.push('- **NO WINNER DECLARED**: No candidate model was declared as "the winner" or "the best model".');
  lines.push('- **NO AUTOMATIC DEPLOYMENT**: Production trading engine and Render configuration remain completely untouched.');
  lines.push('- **REPRODUCIBILITY**: All candidate model IDs were explicitly passed to OpenRouter (no \`openrouter/free\` alias used).');
  lines.push('');

  return lines.join('\n');
}

// Execute if run directly via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runModelBenchmark().catch((err) => {
    console.error('Fatal benchmark error:', err);
    process.exit(1);
  });
}
