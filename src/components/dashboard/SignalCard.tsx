/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Check, ChevronRight, Eye } from 'lucide-react';
import { Signal } from '../../types/signal.ts';

interface SignalCardProps {
  signal?: Signal | null;
  onOpenDetails?: (signal: Signal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onOpenDetails }) => {
  // Calm "Market Watch" state if no active signal
  if (!signal) {
    return (
      <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-5 shadow-lg shadow-black/10">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Market Watch
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Monitoring XAU/USD</span>
        </div>
        <div className="py-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Eye className="w-5 h-5 text-amber-400/80" />
          </div>
          <h4 className="text-sm font-medium text-slate-200">No Confirmed Setup Yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            The background engine is scanning market structure, liquidity sweeps, and POI zones across 1M, 5M, 15M, and 1H. Preserving capital until institutional edge is confirmed.
          </p>
        </div>
      </div>
    );
  }

  const isBuy = signal.direction === 'BUY';
  const strategyName = signal.strategy.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-5 shadow-xl shadow-black/20 space-y-4">
      {/* HEADER: DIRECTION & STRATEGY */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-lg text-xs font-black font-mono tracking-wider flex items-center gap-1.5 shadow-sm ${
              isBuy
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                : 'bg-rose-500 text-white shadow-rose-500/20'
            }`}
          >
            {isBuy ? <ArrowUpRight className="w-4 h-4 stroke-[3]" /> : <ArrowDownRight className="w-4 h-4 stroke-[3]" />}
            <span>{signal.direction}</span>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white tracking-tight capitalize">
              {strategyName}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {signal.timeframe} Setup · ID: {signal.setupId.slice(0, 18)}...
            </span>
          </div>
        </div>

        {/* Confidence & Quality */}
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[10px] text-slate-400">Confidence</span>
            <span className="text-xs font-mono font-bold text-amber-400">{signal.confidence}%</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Quality: {signal.qualityScore}/100</span>
        </div>
      </div>

      {/* PRICE TARGETS MATRIX */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-medium block">Entry Price</span>
          <span className="font-mono font-bold text-sm text-white tabular-nums">
            ${signal.entryPrice.toFixed(2)}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-rose-900/30">
          <span className="text-[10px] text-rose-400/80 font-medium block">Stop Loss</span>
          <span className="font-mono font-bold text-sm text-rose-400 tabular-nums">
            ${signal.stopLoss.toFixed(2)}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-900/30">
          <span className="text-[10px] text-emerald-400/80 font-medium block">TP1 (1:{signal.riskReward1})</span>
          <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
            ${signal.takeProfit1.toFixed(2)}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-900/30">
          <span className="text-[10px] text-emerald-400/80 font-medium block">TP2 (1:{signal.riskReward2})</span>
          <span className="font-mono font-bold text-sm text-emerald-300 tabular-nums">
            ${signal.takeProfit2.toFixed(2)}
          </span>
        </div>
      </div>

      {/* CONCISE SETUP REASONS */}
      <div className="space-y-2 pt-1">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
          Why this setup?
        </span>
        <div className="space-y-1.5">
          {signal.analysisReasons.slice(0, 3).map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{reason}</span>
            </div>
          ))}
        </div>
        {/* Soft Evidence Summary */}
        <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400 font-mono flex-wrap">
          <span>MACD: <strong className="text-slate-200">Neutral (4 pts)</strong></span>
          <span className="text-slate-600">·</span>
          <span>RSI: <strong className="text-emerald-400">Supportive</strong></span>
          <span className="text-slate-600">·</span>
          <span>News: <strong className="text-slate-200">Clean Window</strong></span>
        </div>
      </div>

      {/* FOOTER ACTION */}
      {onOpenDetails && (
        <button
          onClick={() => onOpenDetails(signal)}
          className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5 border border-slate-800 transition-colors cursor-pointer"
        >
          <span>View Full Setup Identity &amp; Evidence Breakdown</span>
          <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
        </button>
      )}
    </div>
  );
};
