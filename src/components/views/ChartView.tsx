/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LineChart, BarChart2, Layers, Info } from 'lucide-react';
import { Candle, Timeframe } from '../../types/market.ts';
import { Signal } from '../../types/signal.ts';
import { TradingChart } from '../chart/TradingChart.tsx';

interface ChartViewProps {
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activeSignal: Signal | null;
  currentPrice: number;
}

export const ChartView: React.FC<ChartViewProps> = ({
  candles,
  timeframe,
  onTimeframeChange,
  activeSignal,
  currentPrice,
}) => {
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <LineChart className="w-4 h-4 text-amber-400" />
            <span>شارت الذهب التفاعلي المباشر (XAU/USD Live Candlestick Chart)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            عرض مباشر لبيانات الشموع المكتملة والشمعة اللحظية المتشكلة من مزود Biquote الحقيقي
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">السعر اللحظي:</span>
          <strong className="text-white text-sm bg-slate-900 px-2.5 py-1 rounded border border-slate-800 tabular-nums">
            ${currentPrice > 0 ? currentPrice.toFixed(2) : '---'}
          </strong>
        </div>
      </div>

      {/* FULL CANDLESTICK CHART */}
      <TradingChart
        candles={candles}
        timeframe={timeframe}
        onTimeframeChange={onTimeframeChange}
        entryPrice={activeSignal?.entryPrice}
        stopLoss={activeSignal?.stopLoss}
        takeProfit1={activeSignal?.takeProfit1}
        takeProfit2={activeSignal?.takeProfit2}
        direction={activeSignal?.direction}
        currentPrice={currentPrice}
      />

      {/* CHART TECHNICAL CONTEXT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-[11px] block font-semibold mb-1">الفريمات الزمنية المعتمدة</span>
          <p className="text-slate-300 leading-relaxed">
            1M (تأكيد الدخول اللحظي) · 5M (تأكيد الهيكل ورفض السيولة) · 15M (الاتجاه التكتيكي) · 1H (الهيكل الكلي).
          </p>
        </div>

        <div className="p-3 rounded-lg bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-[11px] block font-semibold mb-1">مستويات الأهداف ووقف الخسارة</span>
          <p className="text-slate-300 leading-relaxed">
            يتم إسقاط مستويات الدخول، والهدف الأول TP1 والهدف الثاني TP2، ووقف الخسارة SL بدقة تلقائياً عند وجود إشارة نشطة.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-[11px] block font-semibold mb-1">تحديث الشموع اللحظية</span>
          <p className="text-slate-300 leading-relaxed">
            يتم تحديث الشمعة الحالية المتشكلة في الزمن الفعلي بناءً على أسعار Bid و Ask المباشرة الواردة من Biquote.
          </p>
        </div>
      </div>
    </div>
  );
};
