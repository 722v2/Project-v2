/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { BENCHMARK_TEST_CASES } from '../tests/fixtures/benchmark_dataset.ts';

const NEW_POLICY = `
CONFLICT-RESOLUTION DECISION POLICY (APPLY THESE RULES BEFORE SELECTING LONG/SHORT):
1. NO_TRADE is a valid and preferred decision when the evidence is materially conflicting.
2. A higher-timeframe trend by itself is NOT sufficient to open a trade.
3. If HTF direction conflicts with LTF structure, liquidity behavior, price action, or other major context, do NOT automatically follow the HTF trend.
4. If there is a clear warning of: bull trap, bear trap, conflicting structure, failed confirmation, unclear liquidity reaction, or contradictory timeframe signals, require additional confirmation before entering.
5. If the required confirmation is absent, return: NO_TRADE.
6. Never force a trade merely because one timeframe has a directional bias.
7. A trade requires CONFLUENCE, not simply directional bias.
8. MACD remains ONLY a supporting confluence factor. It must never override conflicting structure.
9. If the evidence for a trade is approximately balanced or materially contradictory, choose NO_TRADE.
10. Preserve the existing Gold AI Bot V2 risk rules.
`;

const SYSTEM_PROMPT = `You are an institutional quantitative market analyst for Gold (XAUUSD). Your task is to analyze the technical market snapshot and determine if a high-confluence trade setup exists based on market structure, BOS/CHOCH, liquidity, liquidity sweeps, order blocks, FVG, premium/discount, Fibonacci, price action, volume information, EMA/RSI/MACD as supporting confluence. ${NEW_POLICY} Do not invent market data. Respect the risk constraints contained in the supplied fixture. You must return your analysis by calling the submit_trade_analysis tool.`;

const TOOL_DEFINITION = {
  type: 'function',
  function: {
    name: 'submit_trade_analysis',
    description: 'Return the final structured XAUUSD analysis.',
    parameters: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          enum: ['LONG', 'SHORT', 'NO_TRADE']
        },
        entry: {
          type: ['number', 'null']
        },
        stop_loss: {
          type: ['number', 'null']
        },
        take_profit_1: {
          type: ['number', 'null']
        },
        take_profit_2: {
          type: ['number', 'null']
        },
        confidence: {
          type: 'number'
        },
        setup_quality: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW', 'NONE']
        },
        reasons: {
          type: 'array',
          items: { type: 'string' }
        },
        risk_notes: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: [
        'decision',
        'entry',
        'stop_loss',
        'take_profit_1',
        'take_profit_2',
        'confidence',
        'setup_quality',
        'reasons',
        'risk_notes'
      ]
    }
  }
};

const CASES_TO_RUN = ['case_004_conflicting_signals', 'case_001_bullish_sweep', 'case_002_bearish_bos', 'case_003_no_trade_low_confluence', 'case_007_messy_ambiguous', 'case_008_repeat_bullish_sweep'];
const PREVIOUS_DECISIONS: any = { 'case_004_conflicting_signals': 'SHORT', 'case_001_bullish_sweep': 'LONG', 'case_002_bearish_bos': 'SHORT', 'case_003_no_trade_low_confluence': 'NO_TRADE', 'case_007_messy_ambiguous': 'NO_TRADE', 'case_008_repeat_bullish_sweep': 'LONG' };

async function runBenchmark() {
  const apiKey = process.env.NOVITA_API_KEY || '';
  const results: any[] = [];
  const selectedCases = BENCHMARK_TEST_CASES.filter((tc) => CASES_TO_RUN.includes(tc.id));
  selectedCases.sort((a, b) => CASES_TO_RUN.indexOf(a.id) - CASES_TO_RUN.indexOf(b.id));

  for (const testCase of selectedCases) {
    const startTime = Date.now();
    const payload = {
      model: 'deepseek/deepseek-v4-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Analyze the following technical market snapshot:\n' + JSON.stringify(testCase.marketSnapshot, null, 2) }
      ],
      temperature: 0.2,
      max_tokens: 2500,
      stream: false,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'function', function: { name: 'submit_trade_analysis' } }
    };

    let status = 0, data: any = {}, latency = 0, errorMsg: string | null = null;
    try {
      const res = await fetch('https://api.novita.ai/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
      });
      status = res.status;
      latency = Date.now() - startTime;
      data = await res.json().catch(() => ({}));
      if (!res.ok) errorMsg = data?.error?.message || `HTTP ${res.status}`;
    } catch (err: any) { latency = Date.now() - startTime; errorMsg = err.message; }

    const choice = data.choices?.[0];
    const message = choice?.message;
    const toolCall = message?.tool_calls?.[0];
    let parsedArgs: any = null;
    if (toolCall?.function?.arguments) {
      try { parsedArgs = JSON.parse(toolCall.function.arguments); } catch (e) { errorMsg = 'Parse error'; }
    }

    results.push({
      caseId: testCase.id,
      expectedDecision: testCase.expectedDecision,
      previousDecision: PREVIOUS_DECISIONS[testCase.id],
      newDecision: parsedArgs?.decision || 'INVALID',
      decisionChanged: (parsedArgs?.decision || 'INVALID') !== PREVIOUS_DECISIONS[testCase.id],
      status,
      latencyMs: latency,
      finishReason: choice?.finish_reason || 'failed',
      toolCallReturned: !!toolCall,
      parsedArguments: parsedArgs,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
      error: errorMsg
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  fs.writeFileSync(path.resolve(process.cwd(), 'model_benchmark_deepseek_v4_flash_conflict_policy_results.json'), JSON.stringify(results, null, 2), 'utf-8');
  fs.writeFileSync(path.resolve(process.cwd(), 'model_benchmark_deepseek_v4_flash_conflict_policy_report.md'), generateReport(results), 'utf-8');
}

function generateReport(results: any[]): string {
  const md = ['# Conflict-Resolution Decision Policy Validation Report', '', '| Case ID | Prev | New | Changed | Correct |', '| :--- | :---: | :---: | :---: | :---: |'];
  for (const r of results) md.push(`| ` + `` + r.caseId + `` + ` | ` + r.previousDecision + ` | ` + r.newDecision + ` | ` + (r.decisionChanged ? 'Yes' : 'No') + ` | ` + (r.newDecision === r.expectedDecision ? 'Yes' : 'No') + ` |`);
  return md.join('\n');
}

runBenchmark().catch(console.error);
