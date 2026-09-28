/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Briefcase,
  Activity,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Trade, TradePosition, TradeOutcome } from '../../types/trade.ts';

interface TradesViewProps {
  activeTrade?: Trade | null;
  activePosition?: TradePosition | null;
  completedTrades?: TradeOutcome[];
}

export const TradesView: React.FC<TradesViewProps> = ({
  activeTrade,
  activePosition,
  completedTrades = [],
}) => {
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-slate-800 flex items-center justify-between shadow-lg">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <span>مراقبة الصفقات والمراكز النشطة (Trade &amp; Position Monitoring)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            نظام فرعي مستقل لمراقبة الأسعار اللحظية كل 5 ثوانٍ، وتتبع MFE و MAE وأهداف TP1 / TP2 ونقل الوقف لنقطة الدخول
          </p>
        </div>

        <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-amber-400 font-bold">
          مراقبة كل 5 ثوانٍ
        </span>
      </div>

      {/* ACTIVE TRADE SECTION */}
      {activeTrade && activePosition ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0D121D] border border-amber-500/30 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-white font-mono">
                  صفقة نشطة #{activeTrade.tradeId.substring(0, 10)}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    activeTrade.direction === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {activeTrade.direction === 'BUY' ? 'شراء (BUY)' : 'بيع (SELL)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded font-mono ${
                    activePosition.unrealizedPnlUsd >= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  الربح اللحظي: {activePosition.unrealizedPnlUsd >= 0 ? '+' : ''}${activePosition.unrealizedPnlUsd.toFixed(2)} USD ({activePosition.currentRMultiple >= 0 ? '+' : ''}{activePosition.currentRMultiple.toFixed(2)}R)
                </span>
              </div>
            </div>

            {/* Position Key Levels */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">سعر الدخول:</span>
                <strong className="text-white text-sm tabular-nums">${activeTrade.entryPrice.toFixed(2)}</strong>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">السعر السوقي الحالي:</span>
                <strong className="text-amber-300 text-sm tabular-nums">${activePosition.currentMarketPrice.toFixed(2)}</strong>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-rose-900/40">
                <span className="text-rose-400 text-[10px] block font-sans">وقف الخسارة (SL):</span>
                <strong className="text-rose-300 text-sm tabular-nums">${activeTrade.stopLoss.toFixed(2)}</strong>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-emerald-900/40">
                <span className="text-emerald-400 text-[10px] block font-sans">الهدف الأول (TP1):</span>
                <strong className="text-emerald-300 text-sm tabular-nums">${activeTrade.takeProfit1.toFixed(2)}</strong>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-emerald-900/40">
                <span className="text-emerald-400 text-[10px] block font-sans">الهدف الثاني (TP2):</span>
                <strong className="text-emerald-300 text-sm tabular-nums">${activeTrade.takeProfit2.toFixed(2)}</strong>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">حجم المركز (Lots):</span>
                <strong className="text-white text-sm tabular-nums">{activeTrade.positionSizeLots} Lots</strong>
              </div>
            </div>

            {/* Excursions: MFE / MAE Analysis */}
            <div className="p-3.5 rounded-lg bg-[#070A10] border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 block font-sans">
                تحليل حركة السعر القصوى (MFE &amp; MAE Telemetry)
              </span>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 font-sans">أقصى حركة لصالح الصفقة (MFE):</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      +{activePosition.mfeR.toFixed(2)}R (${activePosition.mfePrice.toFixed(2)})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, (activePosition.mfeR / 2.7) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 font-sans">أقصى حركة معاكسة للصفقة (MAE):</span>
                    <span className="font-mono text-rose-400 font-bold">
                      {activePosition.maeR.toFixed(2)}R (${activePosition.maePrice.toFixed(2)})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.abs(activePosition.maeR) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                <span className="text-slate-400 font-sans">حماية المركز ونقل الوقف (Breakeven):</span>
                <span className="font-bold text-amber-400">
                  {activePosition.isBreakeven ? '✓ تم النقل لنقطة الدخول' : 'في انتظار الوصول لـ 1.0R'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center rounded-xl bg-[#0D121D] border border-slate-800 space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Activity className="w-5 h-5 text-amber-400/80" />
          </div>
          <h3 className="text-xs font-bold text-slate-200">لا توجد مراكز تداول نشطة حالياً</h3>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            عند رصد إشارة تداول معتمدة من السكانر، سيتم تشغيل المراقبة اللحظية التلقائية هنا كل 5 ثوانٍ
          </p>
        </div>
      )}

      {/* COMPLETED TRADES TABLE */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>الصفقات المكتملة حديثاً (Completed Trades)</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">{completedTrades.length} صفقات</span>
        </div>

        <div className="pt-2 overflow-x-auto">
          {completedTrades.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              لا توجد صفقات مغلقة مسجلة في الجلسة الحالية
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                  <th className="pb-2 font-medium">الوقت</th>
                  <th className="pb-2 font-medium">الاتجاه</th>
                  <th className="pb-2 font-medium">سعر الدخول</th>
                  <th className="pb-2 font-medium">سعر الخروج</th>
                  <th className="pb-2 font-medium">الربح USD</th>
                  <th className="pb-2 font-medium">مضاعف R</th>
                  <th className="pb-2 font-medium">سبب الإغلاق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {completedTrades.map((t) => (
                  <tr key={t.id || t.tradeId} className="hover:bg-slate-900/60 font-mono">
                    <td className="py-2.5 text-slate-400 text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString('ar-EG')}
                    </td>
                    <td className="py-2.5">
                      <span className={`font-bold font-sans ${t.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.direction === 'BUY' ? 'شراء' : 'بيع'}
                      </span>
                    </td>
                    <td className="py-2.5 text-white">${t.entryPrice.toFixed(2)}</td>
                    <td className="py-2.5 text-slate-200">${t.exitPrice.toFixed(2)}</td>
                    <td className={`py-2.5 font-bold ${t.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnlUsd >= 0 ? '+' : ''}${t.pnlUsd.toFixed(2)}
                    </td>
                    <td className={`py-2.5 font-bold ${t.realizedR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.realizedR >= 0 ? '+' : ''}{t.realizedR.toFixed(2)}R
                    </td>
                    <td className="py-2.5 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {t.exitReason === 'TP1' ? 'هدف 1 (TP1)' : t.exitReason === 'TP2' ? 'هدف 2 (TP2)' : t.exitReason === 'SL' ? 'وقف خسارة (SL)' : t.exitReason}
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
  );
};
