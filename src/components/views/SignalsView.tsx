/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Radio, ArrowUpRight, ArrowDownRight, ChevronLeft, Filter, Target } from 'lucide-react';
import { Signal } from '../../types/signal.ts';

interface SignalsViewProps {
  signals: Signal[];
  onSelectSignal: (signal: Signal) => void;
}

export const SignalsView: React.FC<SignalsViewProps> = ({ signals, onSelectSignal }) => {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  const [search, setSearch] = useState('');

  const filteredSignals = signals.filter((s) => {
    if (filter === 'ACTIVE' && s.status !== 'ACTIVE') return false;
    if (filter === 'ARCHIVED' && s.status !== 'ARCHIVED') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchStrat = s.strategy.toLowerCase().includes(q);
      const matchSymbol = s.symbol.toLowerCase().includes(q);
      const matchDir = s.direction.toLowerCase().includes(q);
      return matchStrat || matchSymbol || matchDir;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* HEADER & FILTERS */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400" />
            <span>دليل إشارات التداول (Signals Directory)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            الإعدادات المؤسسية المتوافقة التي تم رصدها واعتمادها عبر الاستراتيجيات الست المعتمدة
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاستراتيجية..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          {/* Segmented Filter Control */}
          <div className="flex items-center gap-1 bg-[#070A10] p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'ALL', label: 'الكل' },
                { id: 'ACTIVE', label: 'النشطة' },
                { id: 'ARCHIVED', label: 'المؤرشفة' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  filter === item.id
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SIGNALS LIST */}
      <div className="space-y-3">
        {filteredSignals.length > 0 ? (
          filteredSignals.map((sig) => {
            const isBuy = sig.direction === 'BUY';
            const strategyName = sig.strategy.replace(/_/g, ' ');

            return (
              <div
                key={sig.signalId}
                onClick={() => onSelectSignal(sig)}
                className="p-4 rounded-xl bg-[#0D121D] hover:bg-[#111726] border border-slate-800 transition-all cursor-pointer shadow-md space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                        isBuy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {isBuy ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-tight">
                          {isBuy ? 'شراء BUY' : 'بيع SELL'} {sig.symbol}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 font-medium">
                          {sig.timeframe}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                            sig.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {sig.status === 'ACTIVE' ? 'نشط' : 'أرشيف'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 capitalize">{strategyName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left font-mono">
                      <span className="text-xs font-bold text-amber-400 block tabular-nums">{sig.confidence}% ثقة</span>
                      <span className="text-[11px] text-slate-400 block tabular-nums">
                        {new Date(sig.createdAt).toLocaleTimeString('ar-EG')}
                      </span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">سعر الدخول:</span>
                    <strong className="font-semibold text-slate-200 tabular-nums">${sig.entryPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">وقف الخسارة (SL):</span>
                    <strong className="font-semibold text-rose-400 tabular-nums">${sig.stopLoss.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">الهدف الأول (TP1 - 1:{sig.riskReward1}):</span>
                    <strong className="font-semibold text-emerald-400 tabular-nums">${sig.takeProfit1.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">الهدف الثاني (TP2 - 1:{sig.riskReward2}):</span>
                    <strong className="font-semibold text-emerald-300 tabular-nums">${sig.takeProfit2.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center rounded-xl bg-[#0D121D] border border-slate-800 text-slate-400 text-xs space-y-1">
            <p className="font-bold text-slate-300">لا توجد إشارات مطابقة للتصفية الحالية</p>
            <p className="text-[11px] text-slate-400">يقوم السكانر بفحص السوق كل 60 ثانية لتسجيل أي إشارات جديدة</p>
          </div>
        )}
      </div>
    </div>
  );
};
