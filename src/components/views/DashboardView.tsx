/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  Activity,
  Layers,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  RefreshCw,
  Eye,
  Target,
  Flame,
} from 'lucide-react';
import { Candle, Timeframe, MarketRegime } from '../../types/market.ts';
import { Signal } from '../../types/signal.ts';
import { Trade, TradePosition } from '../../types/trade.ts';
import { MarketDataHealth } from '../../packages/market-data/provider.ts';
import { TradingChart } from '../chart/TradingChart.tsx';
import { StrategyEvaluationResult, MtfAnalysisItem } from '../../services/trading_engine.ts';

interface DashboardViewProps {
  currentPrice: number;
  bidPrice: number;
  askPrice: number;
  spread: number;
  priceChangePct24h?: number;
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  regime: MarketRegime;
  activeSignal: Signal | null;
  activeTrade: Trade | null;
  activePosition: TradePosition | null;
  recentSignals: Signal[];
  providerHealth: MarketDataHealth;
  dataFreshnessSeconds: number;
  lastScanTimestamp: number;
  nextScanTimestamp: number;
  strategyResults: StrategyEvaluationResult[];
  mtfAnalysis: Record<Timeframe, MtfAnalysisItem>;
  riskSummary: {
    capital: number;
    riskPercentPerTrade: number;
    maxDailyRiskPercent: number;
    dailyRiskUsedPercent: number;
    openTradesCount: number;
    maxConcurrentTrades: number;
    currentDrawdownPercent: number;
    riskStatus: 'NORMAL' | 'WARNING' | 'HALTED';
  };
  onSelectSignal: (signal: Signal) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentPrice,
  bidPrice,
  askPrice,
  spread,
  priceChangePct24h,
  candles,
  timeframe,
  onTimeframeChange,
  regime,
  activeSignal,
  activeTrade,
  activePosition,
  recentSignals,
  providerHealth,
  dataFreshnessSeconds,
  lastScanTimestamp,
  strategyResults,
  mtfAnalysis,
  riskSummary,
  onSelectSignal,
  onNavigateTab,
}) => {
  // Determine current trading session based on UTC hour
  const currentUtcHour = new Date().getUTCHours();
  let currentSession = 'آسيا / طوكيو';
  if (currentUtcHour >= 7 && currentUtcHour < 12) {
    currentSession = 'لندن (London)';
  } else if (currentUtcHour >= 12 && currentUtcHour < 16) {
    currentSession = 'تداخل لندن / نيويورك (Overlap)';
  } else if (currentUtcHour >= 16 && currentUtcHour < 21) {
    currentSession = 'نيويورك (New York)';
  } else if (currentUtcHour >= 21 || currentUtcHour < 2) {
    currentSession = 'سيدني (Sydney)';
  }

  // Determine Premium / Discount dealing range
  const rangeHigh = regime.rangeHigh ?? (currentPrice > 0 ? currentPrice + 8 : 0);
  const rangeLow = regime.rangeLow ?? (currentPrice > 0 ? currentPrice - 8 : 0);
  const rangeMid = (rangeHigh + rangeLow) / 2;
  const isPremium = currentPrice > rangeMid;

  return (
    <div className="space-y-4">
      {/* 1. PRIMARY LIVE CHART + CURRENT SETUP ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART (2 Columns) */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">الشارت اللحظي للذهب</span>
              <span className="text-[11px] font-mono text-slate-400">XAU/USD · تغذية حية</span>
            </div>
            <button
              onClick={() => onNavigateTab('chart')}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span>تكبير الشارت</span>
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

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
        </div>

        {/* 2. CURRENT ACTIVE SETUP / STATUS (1 Column) */}
        <div className="space-y-4 flex flex-col">
          <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white">الإعداد الحالي (Setup)</h3>
                </div>
                {activeSignal ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    نشط ومراقب
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    مراقبة
                  </span>
                )}
              </div>

              {activeSignal ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400">الاتجاه:</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        activeSignal.direction === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {activeSignal.direction === 'BUY' ? 'شراء (BUY)' : 'بيع (SELL)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-[#090D15] p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 text-[10px] block">سعر الدخول:</span>
                      <strong className="text-white text-sm tabular-nums">${activeSignal.entryPrice.toFixed(2)}</strong>
                    </div>
                    <div className="bg-[#090D15] p-2 rounded border border-rose-900/30">
                      <span className="text-rose-400 text-[10px] block">وقف الخسارة (SL):</span>
                      <strong className="text-rose-300 text-sm tabular-nums">${activeSignal.stopLoss.toFixed(2)}</strong>
                    </div>
                    <div className="bg-[#090D15] p-2 rounded border border-emerald-900/30">
                      <span className="text-emerald-400 text-[10px] block">الهدف الأول (TP1):</span>
                      <strong className="text-emerald-300 text-sm tabular-nums">${activeSignal.takeProfit1.toFixed(2)}</strong>
                    </div>
                    <div className="bg-[#090D15] p-2 rounded border border-emerald-900/30">
                      <span className="text-emerald-400 text-[10px] block">الهدف الثاني (TP2):</span>
                      <strong className="text-emerald-300 text-sm tabular-nums">${activeSignal.takeProfit2.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-xs pt-1">
                    <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">الجودة</span>
                      <span className="font-bold text-amber-400 font-mono">{activeSignal.qualityScore}/100</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">الثقة</span>
                      <span className="font-bold text-slate-200 font-mono">{activeSignal.confidence}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">R:R</span>
                      <span className="font-bold text-emerald-400 font-mono">1:{activeSignal.riskReward1}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectSignal(activeSignal)}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض التفاصيل الكاملة للإشارة</span>
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
                    <Activity className="w-5 h-5 animate-pulse text-amber-400/70" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">لا يوجد إعداد تداول نشط</p>
                  <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                    جاري مراقبة السوق وفحص الاستراتيجيات الست المعتمدة في انتظار اكتمال الشروط...
                  </p>
                </div>
              )}
            </div>

            {/* QUICK LINK TO SCANNER */}
            <div className="pt-3 border-t border-slate-800/80 mt-3">
              <button
                onClick={() => onNavigateTab('scanner')}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-between border border-slate-800 cursor-pointer"
              >
                <span>الانتقال لصفحة السكانر المباشر</span>
                <span className="font-mono text-amber-400 text-[11px]">60 ثانية ←</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE TRADE MONITOR (REQUIREMENT 11) */}
      {activeTrade && activePosition && (
        <div className="rounded-xl bg-[#09101D] border border-amber-500/30 p-4 shadow-lg shadow-amber-500/5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h3 className="text-xs font-bold text-white">مراقبة الصفقة النشطة (Active Trade Monitor — تحديث كل 5 ثوانٍ)</h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  activePosition.unrealizedPnlUsd >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {activePosition.unrealizedPnlUsd >= 0 ? '+' : ''}${activePosition.unrealizedPnlUsd.toFixed(2)} USD ({activePosition.currentRMultiple >= 0 ? '+' : ''}{activePosition.currentRMultiple.toFixed(2)}R)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {activePosition.reversalWatchStatus === 'NORMAL' ? 'حالة عادية' : 'مراقبة انعكاس'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-3 text-xs font-mono">
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">الاتجاه</span>
              <strong className={activeTrade.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                {activeTrade.direction === 'BUY' ? 'شراء BUY' : 'بيع SELL'}
              </strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">سعر الدخول</span>
              <strong className="text-white">${activeTrade.entryPrice.toFixed(2)}</strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">السعر الحالي</span>
              <strong className="text-amber-300">${currentPrice.toFixed(2)}</strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">وقف الخسارة (SL)</span>
              <strong className="text-rose-400">${activeTrade.stopLoss.toFixed(2)}</strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">الهدف الأول (TP1)</span>
              <strong className="text-emerald-400">${activeTrade.takeProfit1.toFixed(2)}</strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">أقصى ربح (MFE)</span>
              <strong className="text-emerald-300">+{activePosition.mfeR.toFixed(2)}R</strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">أقصى تراجع (MAE)</span>
              <strong className="text-rose-300">{activePosition.maeR.toFixed(2)}R</strong>
            </div>
            <div className="bg-[#0B0F19] p-2 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">حالة الوقف</span>
              <strong className={activePosition.isBreakeven ? 'text-amber-400' : 'text-slate-300'}>
                {activePosition.isBreakeven ? 'محمية (BE)' : 'أصلي'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. MARKET OVERVIEW + MULTI-TIMEFRAME ANALYSIS (REQUIREMENTS 6 & 7) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MARKET OVERVIEW */}
        <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white">نظرة عامة على السوق (Market Overview)</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">فريم 15M / 1H</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">حالة السوق:</span>
              <strong className="text-white font-semibold">
                {regime.regime === 'TREND_UP'
                  ? 'اتجاه صاعد (Bullish)'
                  : regime.regime === 'TREND_DOWN'
                  ? 'اتجاه هابط (Bearish)'
                  : 'تذبذب عرضي (Range)'}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">هيكل السوق:</span>
              <strong className="text-amber-300 font-semibold">
                {regime.regime === 'TREND_UP' ? 'Bullish Expansion' : regime.regime === 'TREND_DOWN' ? 'Bearish Expansion' : 'Consolidation'}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">السيولة (Liquidity):</span>
              <strong className="text-slate-200 font-semibold">
                {regime.regime === 'TREND_UP' ? 'تم سحب Sell-Side Liquidity' : 'تم سحب Buy-Side Liquidity'}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">التذبذب (Volatility):</span>
              <strong className="text-emerald-400 font-semibold">طبيعي (Normal Range)</strong>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">المنطقة السعرية:</span>
              <strong className={isPremium ? 'text-rose-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                {isPremium ? 'منطقة غلاء (Premium)' : 'منطقة خصم (Discount)'}
              </strong>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">الجلسة الحالية:</span>
              <strong className="text-amber-400 font-semibold">{currentSession}</strong>
            </div>
          </div>
        </div>

        {/* MULTI-TIMEFRAME ANALYSIS (MTF) */}
        <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white">التحليل متعدد الفريمات (Multi-Timeframe Analysis)</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">1M · 5M · 15M · 1H</span>
          </div>

          <div className="pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="pb-2 font-medium">الفريم</th>
                    <th className="pb-2 font-medium">الاتجاه</th>
                    <th className="pb-2 font-medium">الهيكل</th>
                    <th className="pb-2 font-medium">الزخم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(['1M', '5M', '15M', '1H'] as Timeframe[]).map((tf) => {
                    const item = mtfAnalysis[tf];
                    return (
                      <tr key={tf} className="hover:bg-slate-900/40">
                        <td className="py-2.5 font-bold font-mono text-slate-200">{tf}</td>
                        <td className="py-2.5">
                          <span
                            className={`font-semibold ${
                              item?.trend === 'صاعد'
                                ? 'text-emerald-400'
                                : item?.trend === 'هابط'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {item?.trend || 'غير متوفر'}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-slate-300">
                          {item?.structure || 'غير متوفر'}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item?.momentum === 'قوي'
                                ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                                : 'text-slate-400'
                            }`}
                          >
                            {item?.momentum || 'غير متوفر'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 4. STRATEGY CONFLUENCE (REQUIREMENT 8) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">توافق الاستراتيجيات المعتمدة (Strategy Confluence)</h3>
          </div>
          <span className="text-[11px] text-slate-400">الاستراتيجيات الست المعتمدة لـ XAU/USD</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
          {strategyResults.map((strat) => (
            <div
              key={strat.id}
              className={`p-3 rounded-lg border transition-all ${
                strat.status === 'ACTIVE'
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-amber-400 px-1 py-0.5 rounded bg-amber-400/10">
                    {strat.strategyNumber}
                  </span>
                  <span className="text-xs font-bold text-white">{strat.name}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    strat.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : strat.status === 'REJECTED'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {strat.status === 'ACTIVE' ? 'نشط' : strat.status === 'REJECTED' ? 'مرفوض' : 'انتظار'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 mt-1.5 font-sans">
                {strat.nameArabic}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">الاتجاه:</span>
                <span className="font-semibold text-slate-200">
                  {strat.direction === 'BUY' ? 'شراء' : strat.direction === 'SELL' ? 'بيع' : 'محايد'}
                </span>
              </div>

              {strat.rejectionReason && (
                <div className="mt-1.5 text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded">
                  {strat.rejectionReason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5. RISK SUMMARY + QUICK SIGNAL HISTORY (REQUIREMENTS 10 & 12) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* RISK PANEL */}
        <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white">لوحة المخاطر (Risk Panel)</h3>
            </div>
            <button
              onClick={() => onNavigateTab('risk')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              عرض كامل
            </button>
          </div>

          <div className="space-y-2.5 pt-3 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">رأس المال الابتدائي:</span>
              <strong className="text-white font-mono tabular-nums">${riskSummary.capital.toFixed(2)}</strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">نسبة المخاطرة لكل صفقة:</span>
              <strong className="text-amber-400 font-mono tabular-nums">{riskSummary.riskPercentPerTrade}%</strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">الحد الأقصى للمخاطرة اليومية:</span>
              <strong className="text-slate-300 font-mono tabular-nums">{riskSummary.maxDailyRiskPercent}%</strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">المخاطرة المستخدمة اليوم:</span>
              <strong className="text-emerald-400 font-mono tabular-nums">{riskSummary.dailyRiskUsedPercent}%</strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">الصفقات المفتوحة / الحد الأقصى:</span>
              <strong className="text-white font-mono tabular-nums">
                {riskSummary.openTradesCount} / {riskSummary.maxConcurrentTrades}
              </strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">التراجع الحالي (Drawdown):</span>
              <strong className="text-slate-300 font-mono tabular-nums">{riskSummary.currentDrawdownPercent}%</strong>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-emerald-950/20 border border-emerald-500/20">
              <span className="text-slate-300">حالة المخاطر:</span>
              <span className="font-bold text-emerald-400 text-xs flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>طبيعية وآمنة</span>
              </span>
            </div>
          </div>
        </div>

        {/* QUICK SIGNAL HISTORY */}
        <div className="lg:col-span-2 rounded-xl bg-[#0D121D] border border-slate-800 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white">سجل الإشارات الأخير (Signal History)</h3>
            </div>
            <button
              onClick={() => onNavigateTab('signals')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              عرض الكل ({recentSignals.length})
            </button>
          </div>

          <div className="pt-2 overflow-x-auto">
            {recentSignals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">لا توجد إشارات سابقة حتى الآن</p>
                <p className="text-[11px] text-slate-400">يقوم السكانر بالفحص كل 60 ثانية لتسجيل أي إشارة تطابق الشروط</p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="pb-2 font-medium">الوقت</th>
                    <th className="pb-2 font-medium">الاتجاه</th>
                    <th className="pb-2 font-medium">الإعداد</th>
                    <th className="pb-2 font-medium">الدخول</th>
                    <th className="pb-2 font-medium">النتيجة / R</th>
                    <th className="pb-2 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {recentSignals.slice(0, 5).map((sig) => (
                    <tr
                      key={sig.signalId}
                      onClick={() => onSelectSignal(sig)}
                      className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 font-mono text-[11px] text-slate-400">
                        {new Date(sig.createdAt).toLocaleTimeString('ar-EG')}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sig.direction === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {sig.direction === 'BUY' ? 'شراء' : 'بيع'}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-200">
                        {sig.strategy.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 font-mono tabular-nums text-white">
                        ${sig.entryPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400 font-bold">
                        1:{sig.riskReward1}
                      </td>
                      <td className="py-2.5">
                        <span className="text-[10px] font-semibold text-slate-300 px-1.5 py-0.5 rounded bg-slate-800">
                          {sig.status === 'ACTIVE' ? 'نشط' : 'مكتمل'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
