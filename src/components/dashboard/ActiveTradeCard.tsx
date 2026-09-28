/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, ShieldAlert, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Trade, TradePosition } from '../../types/trade.ts';

interface ActiveTradeCardProps {
  trade: Trade;
  position: TradePosition;
}

export const ActiveTradeCard: React.FC<ActiveTradeCardProps> = ({ trade, position }) => {
  const isBuy = trade.direction === 'BUY';
  const isPnlPositive = position.unrealizedPnlUsd >= 0;

  // Trade Age calculation
  const durationMinutes = trade.openedAt
    ? Math.max(1, Math.round((Date.now() - trade.openedAt) / 60000))
    : 1;

  return (
    <div className="rounded-2xl bg-[#0D121D] border border-amber-500/30 p-5 shadow-xl shadow-amber-500/5 space-y-4">
      {/* HEADER: ACTIVE STATUS & DIRECTION */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Active Trade Monitor (5s)
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trade.direction} {trade.symbol}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Age: {durationMinutes}m</span>
        </div>
      </div>

      {/* PRIMARY REAL-TIME METRICS: P&L, R-MULTIPLE, CURRENT PRICE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-medium block">Unrealized P&amp;L</span>
          <span
            className={`font-mono font-bold text-lg tabular-nums ${
              isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPnlPositive ? '+' : ''}${position.unrealizedPnlUsd.toFixed(2)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-medium block">Realized / Excursion R</span>
          <span className="font-mono font-bold text-lg text-amber-400 tabular-nums">
            +{position.currentRMultiple.toFixed(2)} R
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-medium block">Entry Fill Price</span>
          <span className="font-mono font-semibold text-sm text-slate-200 tabular-nums">
            ${trade.entryPrice.toFixed(2)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-medium block">Current Mark Price</span>
          <span className="font-mono font-semibold text-sm text-cyan-300 tabular-nums">
            ${position.currentMarketPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* MILESTONE TARGETS & EXCURSION STATUS */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Target Milestones
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            MFE: <strong className="text-emerald-400">+{position.mfeR.toFixed(2)}R</strong> (${position.mfePrice.toFixed(2)}) · MAE: <strong className="text-rose-400">{position.maeR.toFixed(2)}R</strong>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* TP1 Status */}
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">TP1 (${trade.takeProfit1.toFixed(2)})</span>
              {position.tp1Hit ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="text-slate-500 text-[10px]">Pending</span>
              )}
            </div>
            <span className="font-mono font-semibold text-emerald-400 text-xs">
              {position.tp1Hit ? 'Reached (50% Secured)' : `$${position.distanceToTp1.toFixed(2)} away`}
            </span>
          </div>

          {/* TP2 Status */}
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">TP2 (${trade.takeProfit2.toFixed(2)})</span>
              {position.tp2Hit ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="text-amber-400/80 text-[10px]">Active Runner</span>
              )}
            </div>
            <span className="font-mono font-semibold text-slate-300 text-xs">
              {position.tp2Hit ? 'Hit' : `$${position.distanceToTp2.toFixed(2)} away`}
            </span>
          </div>

          {/* Stop Loss Status */}
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400">Stop Loss</span>
              <span className="text-[10px] font-mono text-emerald-400">
                {position.isBreakeven ? 'Breakeven' : 'Active'}
              </span>
            </div>
            <span className="font-mono font-semibold text-slate-300 text-xs">
              ${trade.stopLoss.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* REVERSAL WATCH ADVISORY (Only if relevant) */}
      {position.reversalWatchStatus !== 'NORMAL' ? (
        <div
          className={`p-3 rounded-xl border flex items-start gap-3 ${
            position.reversalWatchStatus === 'EARLY_EXIT_RECOMMENDED'
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <ShieldAlert
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              position.reversalWatchStatus === 'EARLY_EXIT_RECOMMENDED' ? 'text-rose-400' : 'text-amber-400'
            }`}
          />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              {position.reversalWatchStatus === 'EARLY_EXIT_RECOMMENDED'
                ? 'Level 3: Early Exit Warning (Opposing Setup Detected)'
                : 'Level 2: Reversal Watch (Structure Weakening)'}
            </h5>
            <p className="text-xs text-slate-300">
              {position.reversalWatchStatus === 'EARLY_EXIT_RECOMMENDED'
                ? 'High-conviction opposing setup triggered on 5M. Manual exit decision recommended. Live orders disabled.'
                : 'Setup timeframe experiencing minor deceleration. Position remains active under strict trade plan.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Structure Intact · Reversal Risk: Low</span>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">AUTO_TRADING = OFF</span>
        </div>
      )}
    </div>
  );
};
