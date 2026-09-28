/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { History, TrendingUp, Filter, CheckCircle2, XCircle, Radio, Shield, CopySlash } from 'lucide-react';
import { TradeOutcome } from '../../types/trade.ts';
import { Signal, RejectionRecord } from '../../types/signal.ts';

interface HistoryViewProps {
  completedTrades?: TradeOutcome[];
  signals?: Signal[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ completedTrades = [], signals = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'TRADES' | 'SIGNALS' | 'REJECTED'>('TRADES');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const filteredTrades = completedTrades.filter((t) => {
    if (resultFilter === 'WIN' && t.realizedR <= 0) return false;
    if (resultFilter === 'LOSS' && t.realizedR > 0) return false;
    return true;
  });

  const totalTrades = completedTrades.length;
  const wins = completedTrades.filter((t) => t.realizedR > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPnl = completedTrades.reduce((acc, t) => acc + t.pnlUsd, 0);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-slate-800 shadow-lg flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span>سجل العمليات والصفقات التاريخية (Audit &amp; Trade History)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            سجلات دائمة وغير قابلة للتعديل للصفقات المغلقة والإشارات ونتائج فحص الأدلة التراكمية
          </p>
        </div>

        {/* SUB-TABS */}
        <div className="flex items-center gap-1 bg-[#070A10] p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveSubTab('TRADES')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeSubTab === 'TRADES' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            الصفقات المغلقة ({completedTrades.length})
          </button>
          <button
            onClick={() => setActiveSubTab('SIGNALS')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeSubTab === 'SIGNALS' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            سجل الإشارات ({signals.length})
          </button>
        </div>
      </div>

      {/* METRICS ROW (When on trades) */}
      {activeSubTab === 'TRADES' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
            <span className="text-slate-400 text-xs block font-sans">نسبة الصفقات الرابحة (Win Rate)</span>
            <strong className="text-xl font-bold font-mono text-emerald-400 tabular-nums block mt-1">
              {winRate}%
            </strong>
            <span className="text-[11px] text-slate-400 font-mono">{wins} رابحة من إجمالي {totalTrades}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
            <span className="text-slate-400 text-xs block font-sans">صافي الربح المحقق (Net P&amp;L)</span>
            <strong
              className={`text-xl font-bold font-mono tabular-nums block mt-1 ${
                totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USD
            </strong>
            <span className="text-[11px] text-slate-400 font-mono">العملة: USD</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
            <span className="text-slate-400 text-xs block font-sans">إجمالي العينات المسجلة</span>
            <strong className="text-xl font-bold font-mono text-white tabular-nums block mt-1">
              {totalTrades}
            </strong>
            <span className="text-[11px] text-slate-400 font-sans">قاعدة بيانات Supabase</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
            <span className="text-slate-400 text-xs block font-sans">تصفية النتائج</span>
            <div className="flex items-center gap-1 mt-1.5">
              {(['ALL', 'WIN', 'LOSS'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setResultFilter(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    resultFilter === r
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'ALL' ? 'الكل' : r === 'WIN' ? 'رابحة' : 'خاسرة'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT LIST */}
      {activeSubTab === 'TRADES' ? (
        <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
          <div className="overflow-x-auto">
            {filteredTrades.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                لا توجد صفقات مطابقة في السجل حتى الآن.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="pb-2 font-medium">الوقت</th>
                    <th className="pb-2 font-medium">الاستراتيجية</th>
                    <th className="pb-2 font-medium">الاتجاه</th>
                    <th className="pb-2 font-medium">سعر الدخول</th>
                    <th className="pb-2 font-medium">سعر الخروج</th>
                    <th className="pb-2 font-medium">الربح USD</th>
                    <th className="pb-2 font-medium">مضاعف R</th>
                    <th className="pb-2 font-medium">سبب الإغلاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {filteredTrades.map((t) => (
                    <tr key={t.id || t.tradeId} className="hover:bg-slate-900/60">
                      <td className="py-2.5 text-slate-400 text-[11px]">
                        {new Date(t.createdAt).toLocaleTimeString('ar-EG')}
                      </td>
                      <td className="py-2.5 font-sans font-semibold text-slate-200">
                        {t.strategy.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 font-sans">
                        <span className={`font-bold ${t.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
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
      ) : (
        <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
          <div className="overflow-x-auto">
            {signals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                لا توجد إشارات تاريخية مسجلة حتى الآن.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="pb-2 font-medium">الوقت</th>
                    <th className="pb-2 font-medium">الاستراتيجية</th>
                    <th className="pb-2 font-medium">الاتجاه</th>
                    <th className="pb-2 font-medium">سعر الدخول</th>
                    <th className="pb-2 font-medium">وقف الخسارة SL</th>
                    <th className="pb-2 font-medium">الهدف الأول TP1</th>
                    <th className="pb-2 font-medium">الجودة</th>
                    <th className="pb-2 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {signals.map((s) => (
                    <tr key={s.signalId} className="hover:bg-slate-900/60">
                      <td className="py-2.5 text-slate-400 text-[11px]">
                        {new Date(s.createdAt).toLocaleTimeString('ar-EG')}
                      </td>
                      <td className="py-2.5 font-sans font-semibold text-slate-200">
                        {s.strategy.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 font-sans">
                        <span className={`font-bold ${s.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s.direction === 'BUY' ? 'شراء' : 'بيع'}
                        </span>
                      </td>
                      <td className="py-2.5 text-white">${s.entryPrice.toFixed(2)}</td>
                      <td className="py-2.5 text-rose-400">${s.stopLoss.toFixed(2)}</td>
                      <td className="py-2.5 text-emerald-400">${s.takeProfit1.toFixed(2)}</td>
                      <td className="py-2.5 text-amber-400 font-bold">{s.qualityScore}/100</td>
                      <td className="py-2.5 font-sans">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          {s.status === 'ACTIVE' ? 'نشط' : 'مؤرشف'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
