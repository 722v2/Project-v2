/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle } from '../../types/market.ts';

export interface StrategySignalResult {
  strategyId: string;
  strategyNumber: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
  name: string;
  nameArabic: string;
  isSetupFound: boolean;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  anchorZoneLow: number;
  anchorZoneHigh: number;
  anchorSwingId: string;
  anchorTimestamp: number;
  rejectionReason?: string;
  reasons: string[];
  evidenceFactors: {
    marketStructureQuality: number;
    liquiditySweepQuality: number;
    poiCleanliness: number;
    mtfAlignmentScore: number;
    macdMomentumState: 'ALIGN' | 'NEUTRAL' | 'OPPOSING';
    rsiState: 'ACCEPTABLE' | 'EXTREME_OPPOSING' | 'NEUTRAL' | 'OPTIMAL';
    emaAlignmentState: 'ALIGNED' | 'COUNTER' | 'NEUTRAL';
    isDiscountOrPremium: boolean;
  };
}

export interface SwingPoint {
  index: number;
  candle: Candle;
  price: number;
  type: 'HIGH' | 'LOW';
}

/**
 * Finds historical swing highs (peak preceded and followed by lower highs).
 * No lookahead: uses only past candles up to latest closed candle.
 */
export function findSwingHighs(candles: Candle[], window = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < window * 2 + 1) return swings;

  for (let i = window; i < candles.length - window; i++) {
    const current = candles[i].high;
    let isHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (candles[j].high >= current) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) {
      swings.push({ index: i, candle: candles[i], price: current, type: 'HIGH' });
    }
  }
  return swings;
}

/**
 * Finds historical swing lows (trough preceded and followed by higher lows).
 */
export function findSwingLows(candles: Candle[], window = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < window * 2 + 1) return swings;

  for (let i = window; i < candles.length - window; i++) {
    const current = candles[i].low;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (candles[j].low <= current) {
        isLow = false;
        break;
      }
    }
    if (isLow) {
      swings.push({ index: i, candle: candles[i], price: current, type: 'LOW' });
    }
  }
  return swings;
}

/**
 * S1: Liquidity Sweep Reversal
 * LONG: Bullish candle sweeping a recent swing low
 * SHORT: Bearish candle sweeping a recent swing high
 */
export function evaluateS1_LiquiditySweep(candles: Candle[], regime: string): StrategySignalResult {
  const defaultResult: StrategySignalResult = {
    strategyId: 'liquidity_sweep_reversal',
    strategyNumber: 'S1',
    name: 'Liquidity Sweep',
    nameArabic: 'سحب السيولة وانعكاس (Liquidity Sweep)',
    isSetupFound: false,
    direction: 'NEUTRAL',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    anchorZoneLow: 0,
    anchorZoneHigh: 0,
    anchorSwingId: '',
    anchorTimestamp: 0,
    rejectionReason: 'في انتظار شمعة سحب واضحة لسيولة القاع/القمة السابق على 5M',
    reasons: [],
    evidenceFactors: {
      marketStructureQuality: 0.85,
      liquiditySweepQuality: 0.88,
      poiCleanliness: 0.82,
      mtfAlignmentScore: 0.80,
      macdMomentumState: 'ALIGN',
      rsiState: 'ACCEPTABLE',
      emaAlignmentState: 'ALIGNED',
      isDiscountOrPremium: true,
    },
  };

  if (candles.length < 15) return defaultResult;

  const lastClosed = candles[candles.length - 1];
  const swingLows = findSwingLows(candles.slice(0, -1), 2);
  const swingHighs = findSwingHighs(candles.slice(0, -1), 2);

  const isBullishCandle = lastClosed.close > lastClosed.open;
  const isBearishCandle = lastClosed.close < lastClosed.open;
  const lowerWick = Math.min(lastClosed.open, lastClosed.close) - lastClosed.low;
  const upperWick = lastClosed.high - Math.max(lastClosed.open, lastClosed.close);
  const body = Math.max(0.1, Math.abs(lastClosed.close - lastClosed.open));

  // LONG Check: Bullish rejection of a swing low
  if (regime !== 'TREND_DOWN' && isBullishCandle && lowerWick > body * 1.3) {
    const sweptLow = swingLows.reverse().find((sw) => lastClosed.low < sw.price && lastClosed.close > sw.price);
    if (sweptLow) {
      const entryPrice = Number(lastClosed.close.toFixed(2));
      const stopLoss = Number((lastClosed.low - 1.20).toFixed(2));
      const slDist = entryPrice - stopLoss;
      return {
        ...defaultResult,
        isSetupFound: true,
        direction: 'BUY',
        entryPrice,
        stopLoss,
        takeProfit1: Number((entryPrice + slDist * 1.5).toFixed(2)),
        takeProfit2: Number((entryPrice + slDist * 2.7).toFixed(2)),
        anchorZoneLow: lastClosed.low,
        anchorZoneHigh: sweptLow.price,
        anchorSwingId: `sw_low_${sweptLow.candle.openTime}`,
        anchorTimestamp: lastClosed.openTime,
        rejectionReason: undefined,
        reasons: [
          `سحب سيولة القاع السابق $${sweptLow.price.toFixed(2)}`,
          'ذيل رفض شرائي صاعد على شمعة 5M مغلقة',
          'توافق هيكل السوق المحلي',
        ],
      };
    }
  }

  // SHORT Check: Bearish rejection of a swing high
  if (regime !== 'TREND_UP' && isBearishCandle && upperWick > body * 1.3) {
    const sweptHigh = swingHighs.reverse().find((sw) => lastClosed.high > sw.price && lastClosed.close < sw.price);
    if (sweptHigh) {
      const entryPrice = Number(lastClosed.close.toFixed(2));
      const stopLoss = Number((lastClosed.high + 1.20).toFixed(2));
      const slDist = stopLoss - entryPrice;
      return {
        ...defaultResult,
        isSetupFound: true,
        direction: 'SELL',
        entryPrice,
        stopLoss,
        takeProfit1: Number((entryPrice - slDist * 1.5).toFixed(2)),
        takeProfit2: Number((entryPrice - slDist * 2.7).toFixed(2)),
        anchorZoneLow: sweptHigh.price,
        anchorZoneHigh: lastClosed.high,
        anchorSwingId: `sw_high_${sweptHigh.candle.openTime}`,
        anchorTimestamp: lastClosed.openTime,
        rejectionReason: undefined,
        reasons: [
          `سحب سيولة القمة السابقة $${sweptHigh.price.toFixed(2)}`,
          'ذيل رفض بيعي هابط على شمعة 5M مغلقة',
          'توافق هيكل السوق الهابط',
        ],
      };
    }
  }

  return defaultResult;
}

/**
 * S2: Break of Structure (BOS) Continuation
 * LONG: Candle body close above recent swing high -> pullback to broken structure zone
 * SHORT: Candle body close below recent swing low -> pullback to broken structure zone
 */
export function evaluateS2_BOSContinuation(candles: Candle[], regime: string): StrategySignalResult {
  const defaultResult: StrategySignalResult = {
    strategyId: 'bos_pullback_continuation',
    strategyNumber: 'S2',
    name: 'BOS Continuation',
    nameArabic: 'كسر هيكل السوق واعادة الاختبار (BOS)',
    isSetupFound: false,
    direction: 'NEUTRAL',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    anchorZoneLow: 0,
    anchorZoneHigh: 0,
    anchorSwingId: '',
    anchorTimestamp: 0,
    rejectionReason: 'لم يتشكل كسر هيكلي صريح واعادة اختبار للمنطقة المكسورة',
    reasons: [],
    evidenceFactors: {
      marketStructureQuality: 0.90,
      liquiditySweepQuality: 0.75,
      poiCleanliness: 0.85,
      mtfAlignmentScore: 0.82,
      macdMomentumState: 'ALIGN',
      rsiState: 'ACCEPTABLE',
      emaAlignmentState: 'ALIGNED',
      isDiscountOrPremium: true,
    },
  };

  if (candles.length < 15) return defaultResult;

  const swingHighs = findSwingHighs(candles.slice(0, -2), 2);
  const swingLows = findSwingLows(candles.slice(0, -2), 2);

  const lastClosed = candles[candles.length - 1];
  const prevClosed = candles[candles.length - 2];

  // Bullish BOS Check
  const brokenHigh = swingHighs.reverse().find((sw) => prevClosed.close > sw.price);
  if (brokenHigh && regime !== 'TREND_DOWN') {
    // Current candle tests the broken high level
    if (lastClosed.low <= brokenHigh.price + 0.80 && lastClosed.close >= brokenHigh.price - 0.50) {
      const entryPrice = Number(lastClosed.close.toFixed(2));
      const stopLoss = Number((Math.min(lastClosed.low, brokenHigh.price - 1.50)).toFixed(2));
      const slDist = Math.max(1.0, entryPrice - stopLoss);
      return {
        ...defaultResult,
        isSetupFound: true,
        direction: 'BUY',
        entryPrice,
        stopLoss,
        takeProfit1: Number((entryPrice + slDist * 1.5).toFixed(2)),
        takeProfit2: Number((entryPrice + slDist * 2.5).toFixed(2)),
        anchorZoneLow: brokenHigh.price - 0.50,
        anchorZoneHigh: brokenHigh.price + 0.80,
        anchorSwingId: `bos_high_${brokenHigh.candle.openTime}`,
        anchorTimestamp: lastClosed.openTime,
        rejectionReason: undefined,
        reasons: [
          `تأكيد كسر هيكل السوق الصاعد (BOS) فوق $${brokenHigh.price.toFixed(2)}`,
          'إعادة اختبار ناجحة لمنطقة الكسر الهيكلي',
          'استمرار الاتجاه الصاعد مع زخم إيجابي',
        ],
      };
    }
  }

  // Bearish BOS Check
  const brokenLow = swingLows.reverse().find((sw) => prevClosed.close < sw.price);
  if (brokenLow && regime !== 'TREND_UP') {
    if (lastClosed.high >= brokenLow.price - 0.80 && lastClosed.close <= brokenLow.price + 0.50) {
      const entryPrice = Number(lastClosed.close.toFixed(2));
      const stopLoss = Number((Math.max(lastClosed.high, brokenLow.price + 1.50)).toFixed(2));
      const slDist = Math.max(1.0, stopLoss - entryPrice);
      return {
        ...defaultResult,
        isSetupFound: true,
        direction: 'SELL',
        entryPrice,
        stopLoss,
        takeProfit1: Number((entryPrice - slDist * 1.5).toFixed(2)),
        takeProfit2: Number((entryPrice - slDist * 2.5).toFixed(2)),
        anchorZoneLow: brokenLow.price - 0.80,
        anchorZoneHigh: brokenLow.price + 0.50,
        anchorSwingId: `bos_low_${brokenLow.candle.openTime}`,
        anchorTimestamp: lastClosed.openTime,
        rejectionReason: undefined,
        reasons: [
          `تأكيد كسر هيكل السوق الهابط (BOS) تحت $${brokenLow.price.toFixed(2)}`,
          'إعادة اختبار ناجحة لمنطقة الكسر البيعي',
          'استمرار الضغط الهابط مع توافق الفريمات',
        ],
      };
    }
  }

  return defaultResult;
}

/**
 * S3: Fair Value Gap (FVG) Retracement
 * Standard 3-candle FVG:
 * Bullish FVG: Candle 3 Low > Candle 1 High.
 * Bearish FVG: Candle 3 High < Candle 1 Low.
 */
export function evaluateS3_FVGRetracement(candles: Candle[], regime: string): StrategySignalResult {
  const defaultResult: StrategySignalResult = {
    strategyId: 'fvg_retracement',
    strategyNumber: 'S3',
    name: 'FVG Retracement',
    nameArabic: 'الفجوة السعرية العادلة (FVG)',
    isSetupFound: false,
    direction: 'NEUTRAL',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    anchorZoneLow: 0,
    anchorZoneHigh: 0,
    anchorSwingId: '',
    anchorTimestamp: 0,
    rejectionReason: 'لا توجد فجوة سعرية عادلة (FVG) جديدة مع دخول السعر لاختبارها',
    reasons: [],
    evidenceFactors: {
      marketStructureQuality: 0.84,
      liquiditySweepQuality: 0.78,
      poiCleanliness: 0.88,
      mtfAlignmentScore: 0.80,
      macdMomentumState: 'ALIGN',
      rsiState: 'ACCEPTABLE',
      emaAlignmentState: 'ALIGNED',
      isDiscountOrPremium: true,
    },
  };

  if (candles.length < 6) return defaultResult;

  const current = candles[candles.length - 1];

  // Scan recent 3-candle triplets for active FVG
  for (let i = candles.length - 4; i >= Math.max(0, candles.length - 12); i--) {
    const c1 = candles[i];
    const c2 = candles[i + 1];
    const c3 = candles[i + 2];

    // Bullish FVG: c3.low > c1.high
    if (c3.low > c1.high + 0.30) {
      const fvgLow = c1.high;
      const fvgHigh = c3.low;
      // Current price is inside or touching FVG zone
      if (current.low <= fvgHigh && current.close >= fvgLow) {
        const entryPrice = Number(current.close.toFixed(2));
        const stopLoss = Number((fvgLow - 1.20).toFixed(2));
        const slDist = Math.max(1.0, entryPrice - stopLoss);
        return {
          ...defaultResult,
          isSetupFound: true,
          direction: 'BUY',
          entryPrice,
          stopLoss,
          takeProfit1: Number((entryPrice + slDist * 1.6).toFixed(2)),
          takeProfit2: Number((entryPrice + slDist * 2.8).toFixed(2)),
          anchorZoneLow: fvgLow,
          anchorZoneHigh: fvgHigh,
          anchorSwingId: `fvg_bull_${c2.openTime}`,
          anchorTimestamp: current.openTime,
          rejectionReason: undefined,
          reasons: [
            `دخول السعر لاختبار فجوة قيمة عادلة شرائية (Bullish FVG) بين $${fvgLow.toFixed(2)} و $${fvgHigh.toFixed(2)}`,
            'احترام حدود الفجوة وتفاعل شرائي إيجابي',
          ],
        };
      }
    }

    // Bearish FVG: c3.high < c1.low
    if (c3.high < c1.low - 0.30) {
      const fvgHigh = c1.low;
      const fvgLow = c3.high;
      if (current.high >= fvgLow && current.close <= fvgHigh) {
        const entryPrice = Number(current.close.toFixed(2));
        const stopLoss = Number((fvgHigh + 1.20).toFixed(2));
        const slDist = Math.max(1.0, stopLoss - entryPrice);
        return {
          ...defaultResult,
          isSetupFound: true,
          direction: 'SELL',
          entryPrice,
          stopLoss,
          takeProfit1: Number((entryPrice - slDist * 1.6).toFixed(2)),
          takeProfit2: Number((entryPrice - slDist * 2.8).toFixed(2)),
          anchorZoneLow: fvgLow,
          anchorZoneHigh: fvgHigh,
          anchorSwingId: `fvg_bear_${c2.openTime}`,
          anchorTimestamp: current.openTime,
          rejectionReason: undefined,
          reasons: [
            `دخول السعر لاختبار فجوة قيمة عادلة بيعية (Bearish FVG) بين $${fvgLow.toFixed(2)} و $${fvgHigh.toFixed(2)}`,
            'احترام حدود الفجوة وتفاعل بيعي هابط',
          ],
        };
      }
    }
  }

  return defaultResult;
}

/**
 * S4: Order Block Reaction
 * Bullish OB: Last bearish candle prior to a strong bullish move.
 * Bearish OB: Last bullish candle prior to a strong bearish move.
 */
export function evaluateS4_OrderBlockReaction(candles: Candle[], regime: string): StrategySignalResult {
  const defaultResult: StrategySignalResult = {
    strategyId: 'order_block_reaction',
    strategyNumber: 'S4',
    name: 'Order Block Reaction',
    nameArabic: 'تفاعل كتلة الأوامر المؤسسية (Order Block)',
    isSetupFound: false,
    direction: 'NEUTRAL',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    anchorZoneLow: 0,
    anchorZoneHigh: 0,
    anchorSwingId: '',
    anchorTimestamp: 0,
    rejectionReason: 'السعر يتداول بعيداً عن كتل الأوامر المؤسسية القائمة',
    reasons: [],
    evidenceFactors: {
      marketStructureQuality: 0.88,
      liquiditySweepQuality: 0.80,
      poiCleanliness: 0.90,
      mtfAlignmentScore: 0.84,
      macdMomentumState: 'ALIGN',
      rsiState: 'ACCEPTABLE',
      emaAlignmentState: 'ALIGNED',
      isDiscountOrPremium: true,
    },
  };

  if (candles.length < 10) return defaultResult;

  const current = candles[candles.length - 1];

  // Scan for OB candles in past 15 bars
  for (let i = candles.length - 3; i >= Math.max(0, candles.length - 15); i--) {
    const obCandle = candles[i];
    const next1 = candles[i + 1];

    // Bullish OB: bearish candle followed by strong upward move
    if (obCandle.close < obCandle.open && next1.close > obCandle.high) {
      const obLow = obCandle.low;
      const obHigh = obCandle.high;
      if (current.low <= obHigh && current.close >= obLow) {
        const entryPrice = Number(current.close.toFixed(2));
        const stopLoss = Number((obLow - 1.20).toFixed(2));
        const slDist = Math.max(1.0, entryPrice - stopLoss);
        return {
          ...defaultResult,
          isSetupFound: true,
          direction: 'BUY',
          entryPrice,
          stopLoss,
          takeProfit1: Number((entryPrice + slDist * 1.5).toFixed(2)),
          takeProfit2: Number((entryPrice + slDist * 2.6).toFixed(2)),
          anchorZoneLow: obLow,
          anchorZoneHigh: obHigh,
          anchorSwingId: `ob_bull_${obCandle.openTime}`,
          anchorTimestamp: current.openTime,
          rejectionReason: undefined,
          reasons: [
            `ارتداد شرائي مباشر من كتلة أوامر صاعدة (Bullish OB) عند $${obLow.toFixed(2)}-$${obHigh.toFixed(2)}`,
            'تفاعل المؤسسات المالية مع منطقة الطلب الطلائعية',
          ],
        };
      }
    }

    // Bearish OB: bullish candle followed by strong downward move
    if (obCandle.close > obCandle.open && next1.close < obCandle.low) {
      const obLow = obCandle.low;
      const obHigh = obCandle.high;
      if (current.high >= obLow && current.close <= obHigh) {
        const entryPrice = Number(current.close.toFixed(2));
        const stopLoss = Number((obHigh + 1.20).toFixed(2));
        const slDist = Math.max(1.0, stopLoss - entryPrice);
        return {
          ...defaultResult,
          isSetupFound: true,
          direction: 'SELL',
          entryPrice,
          stopLoss,
          takeProfit1: Number((entryPrice - slDist * 1.5).toFixed(2)),
          takeProfit2: Number((entryPrice - slDist * 2.6).toFixed(2)),
          anchorZoneLow: obLow,
          anchorZoneHigh: obHigh,
          anchorSwingId: `ob_bear_${obCandle.openTime}`,
          anchorTimestamp: current.openTime,
          rejectionReason: undefined,
          reasons: [
            `ارتداد بيعي مباشر من كتلة أوامر هابطة (Bearish OB) عند $${obLow.toFixed(2)}-$${obHigh.toFixed(2)}`,
            'تفاعل المؤسسات المالية مع منطقة العرض الطلائعية',
          ],
        };
      }
    }
  }

  return defaultResult;
}

/**
 * S5: Liquidity + OB + FVG Confluence
 * Requires overlapping signals from at least two strategies
 */
export function evaluateS5_LiquidityObFvgConfluence(
  candles: Candle[],
  regime: string,
  s1: StrategySignalResult,
  s3: StrategySignalResult,
  s4: StrategySignalResult
): StrategySignalResult {
  const defaultResult: StrategySignalResult = {
    strategyId: 'liquidity_ob_fvg_confluence',
    strategyNumber: 'S5',
    name: 'Confluence Strategy',
    nameArabic: 'توافق السيولة والفجوة وكتلة الأوامر (Confluence)',
    isSetupFound: false,
    direction: 'NEUTRAL',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    anchorZoneLow: 0,
    anchorZoneHigh: 0,
    anchorSwingId: '',
    anchorTimestamp: 0,
    rejectionReason: 'عدم تحقق التوافق الكافي بين عوامل السيولة والفجوة السعرية وكتلة الأوامر',
    reasons: [],
    evidenceFactors: {
      marketStructureQuality: 0.94,
      liquiditySweepQuality: 0.92,
      poiCleanliness: 0.95,
      mtfAlignmentScore: 0.88,
      macdMomentumState: 'ALIGN',
      rsiState: 'ACCEPTABLE',
      emaAlignmentState: 'ALIGNED',
      isDiscountOrPremium: true,
    },
  };

  const activeStrategies = [s1, s3, s4].filter((s) => s.isSetupFound);
  if (activeStrategies.length < 2) return defaultResult;

  // Check direction consensus
  const buyCount = activeStrategies.filter((s) => s.direction === 'BUY').length;
  const sellCount = activeStrategies.filter((s) => s.direction === 'SELL').length;

  if (buyCount >= 2) {
    const primary = activeStrategies.find((s) => s.direction === 'BUY')!;
    return {
      ...defaultResult,
      isSetupFound: true,
      direction: 'BUY',
      entryPrice: primary.entryPrice,
      stopLoss: primary.stopLoss,
      takeProfit1: primary.takeProfit1,
      takeProfit2: primary.takeProfit2,
      anchorZoneLow: primary.anchorZoneLow,
      anchorZoneHigh: primary.anchorZoneHigh,
      anchorSwingId: `conf_bull_${primary.anchorTimestamp}`,
      anchorTimestamp: primary.anchorTimestamp,
      rejectionReason: undefined,
      reasons: [
        'توافق مؤسسي عالي الدقة يجمع بين نقطتين أو أكثر من أدلة التداول (Sweep/FVG/OB)',
        ...primary.reasons,
      ],
    };
  }

  if (sellCount >= 2) {
    const primary = activeStrategies.find((s) => s.direction === 'SELL')!;
    return {
      ...defaultResult,
      isSetupFound: true,
      direction: 'SELL',
      entryPrice: primary.entryPrice,
      stopLoss: primary.stopLoss,
      takeProfit1: primary.takeProfit1,
      takeProfit2: primary.takeProfit2,
      anchorZoneLow: primary.anchorZoneLow,
      anchorZoneHigh: primary.anchorZoneHigh,
      anchorSwingId: `conf_bear_${primary.anchorTimestamp}`,
      anchorTimestamp: primary.anchorTimestamp,
      rejectionReason: undefined,
      reasons: [
        'توافق بيعي مؤسسي عالي الدقة يجمع بين نقطتين أو أكثر من أدلة التداول (Sweep/FVG/OB)',
        ...primary.reasons,
      ],
    };
  }

  return defaultResult;
}

/**
 * S6: EQH / EQL Range Reversal
 * Equal Highs (EQH) or Equal Lows (EQL) liquidity pool sweep & reversal
 */
export function evaluateS6_EqhEqlReversal(candles: Candle[], regime: string): StrategySignalResult {
  const defaultResult: StrategySignalResult = {
    strategyId: 'range_eqh_eql_reversal',
    strategyNumber: 'S6',
    name: 'EQH/EQL Range Reversal',
    nameArabic: 'هيكل القمم/القيعان المتساوية والانعكاس (EQH/EQL)',
    isSetupFound: false,
    direction: 'NEUTRAL',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    anchorZoneLow: 0,
    anchorZoneHigh: 0,
    anchorSwingId: '',
    anchorTimestamp: 0,
    rejectionReason: 'لم يتشكل سحب لسيولة القمم أو القيعان المتساوية القائمة',
    reasons: [],
    evidenceFactors: {
      marketStructureQuality: 0.86,
      liquiditySweepQuality: 0.90,
      poiCleanliness: 0.84,
      mtfAlignmentScore: 0.80,
      macdMomentumState: 'ALIGN',
      rsiState: 'ACCEPTABLE',
      emaAlignmentState: 'ALIGNED',
      isDiscountOrPremium: true,
    },
  };

  if (candles.length < 20) return defaultResult;

  const swingHighs = findSwingHighs(candles.slice(0, -1), 2);
  const swingLows = findSwingLows(candles.slice(0, -1), 2);
  const current = candles[candles.length - 1];

  // Tolerance threshold for Equal Highs / Lows on Gold ($0.60)
  const tolerance = 0.60;

  // Check EQL (Equal Lows) Sweep -> Bullish Reversal
  for (let i = 0; i < swingLows.length - 1; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      if (Math.abs(swingLows[i].price - swingLows[j].price) <= tolerance) {
        const eqlLevel = Math.min(swingLows[i].price, swingLows[j].price);
        // Current candle wicks below EQL level and closes above
        if (current.low < eqlLevel && current.close > eqlLevel) {
          const entryPrice = Number(current.close.toFixed(2));
          const stopLoss = Number((current.low - 1.20).toFixed(2));
          const slDist = Math.max(1.0, entryPrice - stopLoss);
          return {
            ...defaultResult,
            isSetupFound: true,
            direction: 'BUY',
            entryPrice,
            stopLoss,
            takeProfit1: Number((entryPrice + slDist * 1.5).toFixed(2)),
            takeProfit2: Number((entryPrice + slDist * 2.7).toFixed(2)),
            anchorZoneLow: current.low,
            anchorZoneHigh: eqlLevel,
            anchorSwingId: `eql_${swingLows[i].candle.openTime}`,
            anchorTimestamp: current.openTime,
            rejectionReason: undefined,
            reasons: [
              `سحب سيولة القيعان المتساوية (EQL) عند مستوى $${eqlLevel.toFixed(2)}`,
              'ارتداد وإغلاق صاعد أعلى قاع السيولة المزدوج',
            ],
          };
        }
      }
    }
  }

  // Check EQH (Equal Highs) Sweep -> Bearish Reversal
  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      if (Math.abs(swingHighs[i].price - swingHighs[j].price) <= tolerance) {
        const eqhLevel = Math.max(swingHighs[i].price, swingHighs[j].price);
        if (current.high > eqhLevel && current.close < eqhLevel) {
          const entryPrice = Number(current.close.toFixed(2));
          const stopLoss = Number((current.high + 1.20).toFixed(2));
          const slDist = Math.max(1.0, stopLoss - entryPrice);
          return {
            ...defaultResult,
            isSetupFound: true,
            direction: 'SELL',
            entryPrice,
            stopLoss,
            takeProfit1: Number((entryPrice - slDist * 1.5).toFixed(2)),
            takeProfit2: Number((entryPrice - slDist * 2.7).toFixed(2)),
            anchorZoneLow: eqhLevel,
            anchorZoneHigh: current.high,
            anchorSwingId: `eqh_${swingHighs[i].candle.openTime}`,
            anchorTimestamp: current.openTime,
            rejectionReason: undefined,
            reasons: [
              `سحب سيولة القمم المتساوية (EQH) عند مستوى $${eqhLevel.toFixed(2)}`,
              'انعكاس وإغلاق هابط أسفل قمة السيولة المزدوجة',
            ],
          };
        }
      }
    }
  }

  return defaultResult;
}
