/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Candle, Timeframe } from '../../types/market.ts';
import { Loader2 } from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  poiZoneLow?: number;
  poiZoneHigh?: number;
  direction?: 'BUY' | 'SELL';
  currentPrice: number;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  timeframe,
  onTimeframeChange,
  entryPrice,
  stopLoss,
  takeProfit1,
  takeProfit2,
  poiZoneLow,
  poiZoneHigh,
  direction = 'BUY',
  currentPrice,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Compute coordinate domain bounds
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!candles || candles.length === 0) {
      if (currentPrice > 0) {
        return { minPrice: currentPrice - 5, maxPrice: currentPrice + 5, priceRange: 10 };
      }
      return { minPrice: 0, maxPrice: 1, priceRange: 1 };
    }

    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    if (currentPrice > 0) {
      min = Math.min(min, currentPrice);
      max = Math.max(max, currentPrice);
    }

    if (stopLoss) min = Math.min(min, stopLoss);
    if (takeProfit2) max = Math.max(max, takeProfit2);
    if (entryPrice) {
      min = Math.min(min, entryPrice);
      max = Math.max(max, entryPrice);
    }
    if (poiZoneLow) min = Math.min(min, poiZoneLow);
    if (poiZoneHigh) max = Math.max(max, poiZoneHigh);

    const span = Math.max(1, max - min);
    const paddedMin = min - span * 0.05;
    const paddedMax = max + span * 0.05;

    return {
      minPrice: paddedMin,
      maxPrice: paddedMax,
      priceRange: paddedMax - paddedMin,
    };
  }, [candles, stopLoss, takeProfit2, entryPrice, poiZoneLow, poiZoneHigh, currentPrice]);

  const height = 360;
  const paddingPriceScale = 68; // Space for price scale (left side in RTL or right side in coordinate space)
  const paddingOpposite = 14;
  const paddingTop = 20;
  const paddingBottom = 28;
  const chartHeight = height - paddingTop - paddingBottom;

  const getY = (price: number) => {
    return paddingTop + (1 - (price - minPrice) / priceRange) * chartHeight;
  };

  const candleCount = candles.length;
  const hoveredCandle = hoverIndex !== null && candles[hoverIndex] ? candles[hoverIndex] : candles[candles.length - 1];

  const priceTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = priceRange / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(Number((minPrice + step * i).toFixed(2)));
    }
    return ticks;
  }, [minPrice, priceRange]);

  return (
    <div className="rounded-xl bg-[#0B0F19] border border-slate-800 overflow-hidden shadow-lg select-none">
      {/* HEADER: Timeframes & OHLC Values */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 bg-[#090D15]">
        {/* Timeframe Controls (Requirement 5) */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {(['1M', '5M', '15M', '1H'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                timeframe === tf
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* OHLC Readings in Arabic */}
        {hoveredCandle ? (
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400 overflow-x-auto">
            <span>
              افتتاح: <strong className="text-slate-200 font-semibold">{hoveredCandle.open.toFixed(2)}</strong>
            </span>
            <span>
              أعلى: <strong className="text-slate-200 font-semibold">{hoveredCandle.high.toFixed(2)}</strong>
            </span>
            <span>
              أدنى: <strong className="text-slate-200 font-semibold">{hoveredCandle.low.toFixed(2)}</strong>
            </span>
            <span>
              إغلاق:{' '}
              <strong
                className={`font-semibold ${
                  hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {hoveredCandle.close.toFixed(2)}
              </strong>
            </span>
          </div>
        ) : (
          <div className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>جاري قراءة الشموع المباشرة...</span>
          </div>
        )}
      </div>

      {/* SVG CANDLESTICK CANVAS */}
      <div className="relative w-full h-[360px]">
        {candles.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <span className="font-mono">جاري استقبال شموع Biquote المباشرة...</span>
            <span className="text-[11px] text-slate-500 font-mono">XAU/USD · تغذية حقيقية فقط</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 840 ${height}`}
            preserveAspectRatio="none"
            className="w-full h-full cursor-crosshair"
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * 840;
              const usableWidth = 840 - paddingOpposite - paddingPriceScale;
              const candleWidth = usableWidth / candleCount;
              const idx = Math.floor((relX - paddingOpposite) / candleWidth);
              if (idx >= 0 && idx < candleCount) {
                setHoverIndex(idx);
              }
            }}
          >
            <defs>
              <linearGradient id="poiGradAr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* Price Grid Lines & Labels */}
            {priceTicks.map((p) => {
              const y = getY(p);
              return (
                <g key={p}>
                  <line
                    x1={paddingOpposite}
                    y1={y}
                    x2={840 - paddingPriceScale}
                    y2={y}
                    stroke="#1E293B"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={840 - paddingPriceScale + 6}
                    y={y + 3.5}
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {p.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* POI Zone Overlay */}
            {poiZoneLow && poiZoneHigh && (
              <g>
                <rect
                  x={paddingOpposite}
                  y={getY(poiZoneHigh)}
                  width={840 - paddingOpposite - paddingPriceScale}
                  height={Math.max(3, getY(poiZoneLow) - getY(poiZoneHigh))}
                  fill="url(#poiGradAr)"
                  stroke="#D97706"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingOpposite + 8}
                  y={getY(poiZoneHigh) - 4}
                  fill="#FBBF24"
                  fontSize="9.5"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  منطقة الاهتمام POI ({poiZoneLow.toFixed(2)} - {poiZoneHigh.toFixed(2)})
                </text>
              </g>
            )}

            {/* Take Profit 2 Target Line */}
            {takeProfit2 && (
              <g>
                <line
                  x1={paddingOpposite}
                  y1={getY(takeProfit2)}
                  x2={840 - paddingPriceScale}
                  y2={getY(takeProfit2)}
                  stroke="#10B981"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <rect
                  x={840 - paddingPriceScale + 4}
                  y={getY(takeProfit2) - 8}
                  width={48}
                  height={16}
                  rx="2"
                  fill="#064E3B"
                />
                <text
                  x={840 - paddingPriceScale + 8}
                  y={getY(takeProfit2) + 3.5}
                  fill="#34D399"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  TP2
                </text>
              </g>
            )}

            {/* Take Profit 1 Target Line */}
            {takeProfit1 && (
              <g>
                <line
                  x1={paddingOpposite}
                  y1={getY(takeProfit1)}
                  x2={840 - paddingPriceScale}
                  y2={getY(takeProfit1)}
                  stroke="#10B981"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <rect
                  x={840 - paddingPriceScale + 4}
                  y={getY(takeProfit1) - 8}
                  width={48}
                  height={16}
                  rx="2"
                  fill="#065F46"
                />
                <text
                  x={840 - paddingPriceScale + 8}
                  y={getY(takeProfit1) + 3.5}
                  fill="#34D399"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  TP1
                </text>
              </g>
            )}

            {/* Entry Level Line */}
            {entryPrice && (
              <g>
                <line
                  x1={paddingOpposite}
                  y1={getY(entryPrice)}
                  x2={840 - paddingPriceScale}
                  y2={getY(entryPrice)}
                  stroke="#F59E0B"
                  strokeWidth="1.4"
                  strokeDasharray="5 3"
                />
                <rect
                  x={840 - paddingPriceScale + 4}
                  y={getY(entryPrice) - 8}
                  width={48}
                  height={16}
                  rx="2"
                  fill="#78350F"
                />
                <text
                  x={840 - paddingPriceScale + 8}
                  y={getY(entryPrice) + 3.5}
                  fill="#FDE68A"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  دخول
                </text>
              </g>
            )}

            {/* Stop Loss Line */}
            {stopLoss && (
              <g>
                <line
                  x1={paddingOpposite}
                  y1={getY(stopLoss)}
                  x2={840 - paddingPriceScale}
                  y2={getY(stopLoss)}
                  stroke="#EF4444"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <rect
                  x={840 - paddingPriceScale + 4}
                  y={getY(stopLoss) - 8}
                  width={48}
                  height={16}
                  rx="2"
                  fill="#7F1D1D"
                />
                <text
                  x={840 - paddingPriceScale + 8}
                  y={getY(stopLoss) + 3.5}
                  fill="#FCA5A5"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  SL
                </text>
              </g>
            )}

            {/* Candlesticks */}
            {candles.map((c, i) => {
              const usableWidth = 840 - paddingOpposite - paddingPriceScale;
              const candleStep = usableWidth / candleCount;
              const cx = paddingOpposite + i * candleStep + candleStep / 2;
              const candleWidth = Math.max(3, candleStep * 0.72);

              const isUp = c.close >= c.open;
              const bodyTop = getY(Math.max(c.open, c.close));
              const bodyBottom = getY(Math.min(c.open, c.close));
              const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);

              const wickTop = getY(c.high);
              const wickBottom = getY(c.low);
              const color = isUp ? '#10B981' : '#F43F5E';

              return (
                <g key={c.openTime} opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.6}>
                  <line
                    x1={cx}
                    y1={wickTop}
                    x2={cx}
                    y2={wickBottom}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  <rect
                    x={cx - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}

            {/* Live Current Price Line & Badge */}
            {currentPrice > 0 && (
              <g>
                <line
                  x1={paddingOpposite}
                  y1={getY(currentPrice)}
                  x2={840 - paddingPriceScale}
                  y2={getY(currentPrice)}
                  stroke="#38BDF8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <rect
                  x={840 - paddingPriceScale + 2}
                  y={getY(currentPrice) - 9}
                  width={56}
                  height={18}
                  rx="3"
                  fill="#0369A1"
                />
                <text
                  x={840 - paddingPriceScale + 5}
                  y={getY(currentPrice) + 4}
                  fill="#E0F2FE"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {currentPrice.toFixed(2)}
                </text>
              </g>
            )}

            {/* Hover Crosshair */}
            {hoverIndex !== null && (
              <g>
                <line
                  x1={
                    paddingOpposite +
                    hoverIndex * ((840 - paddingOpposite - paddingPriceScale) / candleCount) +
                    ((840 - paddingOpposite - paddingPriceScale) / candleCount) / 2
                  }
                  y1={paddingTop}
                  x2={
                    paddingOpposite +
                    hoverIndex * ((840 - paddingOpposite - paddingPriceScale) / candleCount) +
                    ((840 - paddingOpposite - paddingPriceScale) / candleCount) / 2
                  }
                  y2={height - paddingBottom}
                  stroke="#94A3B8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* FOOTER LEGEND */}
      <div className="px-4 py-2 border-t border-slate-800 bg-[#090D15] flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span>شمعة صاعدة (Bullish)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span>شمعة هابطة (Bearish)</span>
          </div>
          {entryPrice && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              <span>سعر الدخول ({entryPrice.toFixed(2)})</span>
            </div>
          )}
          {takeProfit1 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
              <span>الأهداف (TP1 / TP2)</span>
            </div>
          )}
          {stopLoss && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
              <span>وقف الخسارة SL ({stopLoss.toFixed(2)})</span>
            </div>
          )}
        </div>

        <div className="font-mono text-[11px] text-slate-400">
          المصدر: Biquote Live Market Feed
        </div>
      </div>
    </div>
  );
};
