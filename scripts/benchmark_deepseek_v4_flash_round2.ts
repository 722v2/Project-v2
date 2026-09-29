/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { BENCHMARK_TEST_CASES } from '../tests/fixtures/benchmark_dataset.ts';

const SYSTEM_PROMPT = `You are an institutional quantitative market analyst for Gold (XAUUSD). Your task is to analyze the technical market snapshot and determine if a high-confluence trade setup exists based on market structure, BOS/CHOCH, liquidity, liquidity sweeps, order blocks, FVG, premium/discount, Fibonacci, price action, volume information, EMA/RSI/MACD as supporting confluence. MACD must NOT be treated as a hard entry filter. You must be allowed to return NO_TRADE. Do not invent market data. Respect the risk constraints contained in the supplied fixture. You must return your analysis by calling the submit_trade_analysis tool.`;

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

async function runBenchmark() {
  const apiKey = process.env.NOVITA_API_KEY || '';
  if (!apiKey) {
    console.error('NOVITA_API_KEY environment variable is not defined!');
    process.exit(1);
  }

  const results: any[] = [];
  const testCases = BENCHMARK_TEST_CASES;

  console.log(`Starting DeepSeek-V4-Flash 20-Case Benchmark... Running ${testCases.length} available cases.`);

  for (const testCase of testCases) {
    console.log(`Running case: ${testCase.id}...`);
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
      tool_choice: {
        type: 'function',
        function: { name: 'submit_trade_analysis' }
      }
    };

    let status = 0;
    let data: any = {};
    let latency = 0;
    let errorMsg: string | null = null;

    try {
      const res = await fetch('https://api.novita.ai/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      status = res.status;
      latency = Date.now() - startTime;
      data = await res.json().catch(() => ({}));

      if (!res.ok) {
        errorMsg = data?.error?.message || `HTTP ${res.status}`;
      }
    } catch (err: any) {
      latency = Date.now() - startTime;
      errorMsg = err.message || 'Network exception';
    }

    const choice = data.choices?.[0];
    const message = choice?.message;
    const toolCall = message?.tool_calls?.[0];
    
    let parsedArgs: any = null;
    if (toolCall?.function?.arguments) {
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        errorMsg = 'Failed to parse tool call arguments';
      }
    }

    results.push({
      caseId: testCase.id,
      expectedDecision: testCase.expectedDecision,
      status,
      latencyMs: latency,
      modelId: 'deepseek/deepseek-v4-flash',
      finishReason: choice?.finish_reason || 'failed',
      toolCallReturned: !!toolCall,
      toolName: toolCall?.function?.name || null,
      parsedArguments: parsedArgs,
      decision: parsedArgs?.decision || 'INVALID',
      entry: parsedArgs?.entry ?? null,
      stopLoss: parsedArgs?.stop_loss ?? null,
      takeProfit1: parsedArgs?.take_profit_1 ?? null,
      takeProfit2: parsedArgs?.take_profit_2 ?? null,
      confidence: parsedArgs?.confidence ?? 0,
      setupQuality: parsedArgs?.setup_quality || 'NONE',
      reasons: parsedArgs?.reasons || [],
      riskNotes: parsedArgs?.risk_notes || [],
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
      error: errorMsg
    });

    console.log(`Finished ${testCase.id}. HTTP: ${status}. Latency: ${latency}ms.`);
    // Brief sleep to avoid hammer
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Calculate Metrics
  const totalCases = results.length;
  const successfulToolCalls = results.filter((r) => r.status === 200 && r.toolCallReturned && r.parsedArguments).length;
  const httpSuccessCount = results.filter((r) => r.status === 200).length;
  const malformedCount = results.filter((r) => r.status === 200 && (!r.toolCallReturned || !r.parsedArguments)).length;
  
  const latencies = results.map((r) => r.latencyMs);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / totalCases);
  const medianLatency = [...latencies].sort((a, b) => a - b)[Math.floor(totalCases / 2)] || 0;

  const totalPromptTokens = results.reduce((sum, r) => sum + r.promptTokens, 0);
  const totalCompletionTokens = results.reduce((sum, r) => sum + r.completionTokens, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

  const longCount = results.filter((r) => r.decision === 'LONG').length;
  const shortCount = results.filter((r) => r.decision === 'SHORT').length;
  const noTradeCount = results.filter((r) => r.decision === 'NO_TRADE').length;
  
  const rateLimitCount = results.filter((r) => r.status === 429).length;
  const otherFailCount = results.filter((r) => r.status !== 200 && r.status !== 429).length;

  let correctDirection = 0;
  let incorrectDirection = 0;
  let noTradeCorrectness = 0;
  results.filter(r => r.status === 200).forEach((r) => {
    if (r.decision === r.expectedDecision) {
      if (r.expectedDecision === 'NO_TRADE') noTradeCorrectness++;
      else correctDirection++;
    } else if (r.decision !== 'INVALID') {
      incorrectDirection++;
    }
  });

  const summary = {
    benchmarkDate: new Date().toISOString(),
    totalRequestsRun: totalCases,
    successfulStructuredToolCalls: successfulToolCalls,
    toolCallSuccessRatePct: Math.round((successfulToolCalls / totalCases) * 100),
    httpSuccessRatePct: Math.round((httpSuccessCount / totalCases) * 100),
    avgLatencyMs: avgLatency,
    medianLatencyMs: medianLatency,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    avgTokensPerRequest: Math.round(totalTokens / totalCases),
    longCount,
    shortCount,
    noTradeCount,
    malformedCount,
    rateLimitFailures: rateLimitCount,
    otherFailures: otherFailCount,
    metrics: {
      correctDirectionCount: correctDirection,
      incorrectDirectionCount: incorrectDirection,
      noTradeCorrectnessCount: noTradeCorrectness
    }
  };

  const resultsOut = { summary, detailedRuns: results };

  fs.writeFileSync(path.resolve(process.cwd(), 'model_benchmark_deepseek_v4_flash_round2_results.json'), JSON.stringify(resultsOut, null, 2), 'utf-8');
  fs.writeFileSync(path.resolve(process.cwd(), 'model_benchmark_deepseek_v4_flash_round2_report.md'), generateReport(resultsOut), 'utf-8');
}

function generateReport(data: any): string {
  // Report generation logic (similar to previous)
  const sum = data.summary;
  const runs = data.detailedRuns;
  const md = [`# DeepSeek-V4-Flash Benchmark Evaluation Report — Round 2 (${sum.totalRequestsRun} Cases)`];
  md.push(`**Date**: ${sum.benchmarkDate}`, '', '## 1. Executive Summary', `* Tool-Call Success Rate: ${sum.toolCallSuccessRatePct}%`, `* HTTP Success: ${sum.httpSuccessRatePct}%`, `* Avg Latency: ${sum.avgLatencyMs}ms`, '');
  
  md.push('## 2. Case Results', '| Case ID | Expected | Decision | Valid Tool | Latency |');
  for (const r of runs) md.push(`| \`${r.caseId}\` | ${r.expectedDecision} | **${r.decision}** | ${r.toolCallReturned ? 'Yes' : 'No'} | ${r.latencyMs}ms |`);
  
  return md.join('\n');
}

runBenchmark().catch(console.error);
