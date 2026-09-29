/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BenchmarkTestCase {
  id: string;
  name: string;
  category: 'bullish' | 'bearish' | 'no_trade' | 'conflicting' | 'liquidity_sweep' | 'reversal' | 'messy';
  expectedDecision: 'LONG' | 'SHORT' | 'NO_TRADE';
  marketSnapshot: {
    symbol: string;
    timeframe: string;
    currentPrice: number;
    bid: number;
    ask: number;
    spread: number;
    htfTrend: 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'CHOPPY';
    ltfStructure: string;
    priceActionKeyLevels: {
      recentHigh: number;
      recentLow: number;
      keySupport: number;
      keyResistance: number;
      fairValueGap?: { low: number; high: number; type: 'BULLISH' | 'BEARISH' };
      orderBlock?: { low: number; high: number; type: 'BULLISH' | 'BEARISH' };
      equalHighsLows?: { price: number; type: 'EQH' | 'EQL' };
      fibonacciRetracement?: { level50: number; level618: number };
    };
    indicators: {
      rsi14: number;
      ema20: number;
      ema50: number;
      ema200: number;
      macd: { line: number; signal: number; histogram: number; trend: 'BULLISH' | 'BEARISH' | 'FLAT' };
      volume24hRatio: number;
    };
    contextNotes: string;
  };
}

export const BENCHMARK_TEST_CASES: BenchmarkTestCase[] = [
  {
    id: 'case_001_bullish_sweep',
    name: 'Clear Bullish Liquidity Sweep & Reversal',
    category: 'bullish',
    expectedDecision: 'LONG',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2646.50,
      bid: 2646.35,
      ask: 2646.65,
      spread: 0.30,
      htfTrend: 'TREND_UP',
      ltfStructure: 'Sweep of Equal Lows followed by Bullish CHOCH on 5M',
      priceActionKeyLevels: {
        recentHigh: 2658.00,
        recentLow: 2639.50,
        keySupport: 2640.00,
        keyResistance: 2660.00,
        fairValueGap: { low: 2643.00, high: 2645.20, type: 'BULLISH' },
        orderBlock: { low: 2641.00, high: 2643.50, type: 'BULLISH' },
        equalHighsLows: { price: 2640.00, type: 'EQL' },
        fibonacciRetracement: { level50: 2645.00, level618: 2642.50 },
      },
      indicators: {
        rsi14: 42.5,
        ema20: 2645.80,
        ema50: 2644.20,
        ema200: 2638.10,
        macd: { line: 0.85, signal: 0.40, histogram: 0.45, trend: 'BULLISH' },
        volume24hRatio: 1.45,
      },
      contextNotes: 'Price wicked $0.50 below major $2640 EQL liquidity pool, immediately rejected with heavy buy volume, leaving a clean 15M Bullish FVG and holding above 200 EMA.',
    },
  },
  {
    id: 'case_002_bearish_bos',
    name: 'Clear Bearish BOS & Order Block Retest',
    category: 'bearish',
    expectedDecision: 'SHORT',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2666.20,
      bid: 2666.05,
      ask: 2666.35,
      spread: 0.30,
      htfTrend: 'TREND_DOWN',
      ltfStructure: 'Bearish BOS breaking 15M structure at $2662.00, pulling back into Premium OB',
      priceActionKeyLevels: {
        recentHigh: 2672.50,
        recentLow: 2655.00,
        keySupport: 2650.00,
        keyResistance: 2670.00,
        fairValueGap: { low: 2665.50, high: 2668.00, type: 'BEARISH' },
        orderBlock: { low: 2667.00, high: 2671.00, type: 'BEARISH' },
        equalHighsLows: { price: 2672.00, type: 'EQH' },
        fibonacciRetracement: { level50: 2663.75, level618: 2665.80 },
      },
      indicators: {
        rsi14: 58.0,
        ema20: 2664.50,
        ema50: 2667.10,
        ema200: 2675.40,
        macd: { line: -1.20, signal: -0.80, histogram: -0.40, trend: 'BEARISH' },
        volume24hRatio: 1.30,
      },
      contextNotes: '1H and 15M market structure are strictly Bearish. Price pulled back to 61.8% Fib premium zone in alignment with a fresh Bearish OB and FVG.',
    },
  },
  {
    id: 'case_003_no_trade_low_confluence',
    name: 'No Trade — Low Confluence Mid-Range Chop',
    category: 'no_trade',
    expectedDecision: 'NO_TRADE',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2652.10,
      bid: 2651.90,
      ask: 2652.30,
      spread: 0.40,
      htfTrend: 'RANGE',
      ltfStructure: 'Sideways consolidation inside 2650-2655 bracket without break or sweep',
      priceActionKeyLevels: {
        recentHigh: 2655.00,
        recentLow: 2649.80,
        keySupport: 2645.00,
        keyResistance: 2660.00,
      },
      indicators: {
        rsi14: 50.2,
        ema20: 2652.00,
        ema50: 2652.15,
        ema200: 2651.90,
        macd: { line: 0.05, signal: 0.03, histogram: 0.02, trend: 'FLAT' },
        volume24hRatio: 0.65,
      },
      contextNotes: 'Low volume chop right in the middle of a tight $5 range. No structure break, no FVG, no OB reaction. Risk-reward is poor.',
    },
  },
  {
    id: 'case_004_conflicting_signals',
    name: 'Conflicting Signals — HTF Bearish vs LTF Oversold Bounce',
    category: 'conflicting',
    expectedDecision: 'NO_TRADE',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2638.40,
      bid: 2638.20,
      ask: 2638.60,
      spread: 0.40,
      htfTrend: 'TREND_DOWN',
      ltfStructure: 'Minor 5M bounce off local intraday level while 1H/4H order flow is aggressively DOWN',
      priceActionKeyLevels: {
        recentHigh: 2658.00,
        recentLow: 2635.00,
        keySupport: 2630.00,
        keyResistance: 2650.00,
        fairValueGap: { low: 2642.00, high: 2646.00, type: 'BEARISH' },
      },
      indicators: {
        rsi14: 28.5, // Oversold LTF
        ema20: 2643.00,
        ema50: 2649.50,
        ema200: 2662.00,
        macd: { line: -2.80, signal: -2.10, histogram: -0.70, trend: 'BEARISH' },
        volume24hRatio: 1.10,
      },
      contextNotes: 'RSI is oversold giving a naive buy signal, but HTF trend is strongly bearish and price is below all major EMAs into a bearish FVG overhead. High risk of bull trap.',
    },
  },
  {
    id: 'case_005_liquidity_sweep_vs_break',
    name: 'Liquidity Sweep vs True Breakdown',
    category: 'liquidity_sweep',
    expectedDecision: 'LONG',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2638.80,
      bid: 2638.65,
      ask: 2638.95,
      spread: 0.30,
      htfTrend: 'RANGE',
      ltfStructure: 'Sharp wick $2.00 below previous daily low ($2635.00) with rapid rejection and close back inside range',
      priceActionKeyLevels: {
        recentHigh: 2652.00,
        recentLow: 2633.00, // Wick low
        keySupport: 2635.00,
        keyResistance: 2655.00,
        fairValueGap: { low: 2636.50, high: 2638.50, type: 'BULLISH' },
        equalHighsLows: { price: 2635.00, type: 'EQL' },
      },
      indicators: {
        rsi14: 48.0,
        ema20: 2637.50,
        ema50: 2640.00,
        ema200: 2642.10,
        macd: { line: -0.10, signal: -0.30, histogram: +0.20, trend: 'BULLISH' },
        volume24hRatio: 2.10, // Surge in volume on wick recovery
      },
      contextNotes: 'Classic Liquidity Sweep of Asian/Daily Lows. Candle closed strongly above $2635 support with 2.1x normal volume. Not a genuine breakdown.',
    },
  },
  {
    id: 'case_006_reversal_setup',
    name: 'Major Daily Support Bullish Reversal & CHOCH',
    category: 'reversal',
    expectedDecision: 'LONG',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2618.50,
      bid: 2618.35,
      ask: 2618.65,
      spread: 0.30,
      htfTrend: 'CHOPPY',
      ltfStructure: '1D Key Demand Zone ($2610-$2615) hit; 15M formed Bullish CHOCH breaking $2616 resistance',
      priceActionKeyLevels: {
        recentHigh: 2625.00,
        recentLow: 2610.20,
        keySupport: 2610.00,
        keyResistance: 2630.00,
        orderBlock: { low: 2611.00, high: 2614.50, type: 'BULLISH' },
        fairValueGap: { low: 2615.00, high: 2617.80, type: 'BULLISH' },
      },
      indicators: {
        rsi14: 52.0,
        ema20: 2616.20,
        ema50: 2618.00,
        ema200: 2635.00,
        macd: { line: 0.45, signal: 0.10, histogram: 0.35, trend: 'BULLISH' },
        volume24hRatio: 1.60,
      },
      contextNotes: 'Price reached major 1D Support at $2610 after 3-day drop. 15M structure confirmed CHOCH with bullish MACD histogram cross and FVG creation.',
    },
  },
  {
    id: 'case_007_messy_ambiguous',
    name: 'Messy High-Volatility News Event Spike',
    category: 'messy',
    expectedDecision: 'NO_TRADE',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2658.00,
      bid: 2657.10,
      ask: 2658.90,
      spread: 1.80, // High news spread
      htfTrend: 'CHOPPY',
      ltfStructure: 'Wild $20 whip up and down within 2 minutes due to high-impact CPI release',
      priceActionKeyLevels: {
        recentHigh: 2675.00,
        recentLow: 2642.00,
        keySupport: 2640.00,
        keyResistance: 2680.00,
      },
      indicators: {
        rsi14: 51.5,
        ema20: 2655.00,
        ema50: 2656.00,
        ema200: 2654.00,
        macd: { line: 0.00, signal: 0.10, histogram: -0.10, trend: 'FLAT' },
        volume24hRatio: 4.80,
      },
      contextNotes: 'Extreme spread ($1.80) and 2-way wicks spanning $33 in 5 minutes following high-impact news. Technical levels are unreliable; highly volatile hazard.',
    },
  },
  {
    id: 'case_008_repeat_bullish_sweep',
    name: 'Repeatability Test Case — Bullish Sweep Re-Run',
    category: 'bullish',
    expectedDecision: 'LONG',
    marketSnapshot: {
      symbol: 'XAU/USD',
      timeframe: '15M',
      currentPrice: 2646.50,
      bid: 2646.35,
      ask: 2646.65,
      spread: 0.30,
      htfTrend: 'TREND_UP',
      ltfStructure: 'Sweep of Equal Lows followed by Bullish CHOCH on 5M',
      priceActionKeyLevels: {
        recentHigh: 2658.00,
        recentLow: 2639.50,
        keySupport: 2640.00,
        keyResistance: 2660.00,
        fairValueGap: { low: 2643.00, high: 2645.20, type: 'BULLISH' },
        orderBlock: { low: 2641.00, high: 2643.50, type: 'BULLISH' },
        equalHighsLows: { price: 2640.00, type: 'EQL' },
        fibonacciRetracement: { level50: 2645.00, level618: 2642.50 },
      },
      indicators: {
        rsi14: 42.5,
        ema20: 2645.80,
        ema50: 2644.20,
        ema200: 2638.10,
        macd: { line: 0.85, signal: 0.40, histogram: 0.45, trend: 'BULLISH' },
        volume24hRatio: 1.45,
      },
      contextNotes: 'Price wicked $0.50 below major $2640 EQL liquidity pool, immediately rejected with heavy buy volume, leaving a clean 15M Bullish FVG and holding above 200 EMA.',
    },
  },
];
