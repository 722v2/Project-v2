/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight, Radio } from 'lucide-react';
import { Signal } from '../../types/signal.ts';

interface RecentSignalsListProps {
  signals: Signal[];
  onSelectSignal: (signal: Signal) => void;
  onViewAll?: () => void;
}

export const RecentSignalsList: React.FC<RecentSignalsListProps> = ({
  signals,
  onSelectSignal,
  onViewAll,
}) => {
  return (
    <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-4 space-y-3 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Recent Signals
          </h3>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer font-medium"
          >
            <span>View All</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {signals.slice(0, 4).map((sig) => {
          const isBuy = sig.direction === 'BUY';
          const timeStr = new Date(sig.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <button
              key={sig.signalId}
              onClick={() => onSelectSignal(sig)}
              className="w-full p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 flex items-center justify-between transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold ${
                    isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {isBuy ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      {sig.direction} {sig.symbol}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-medium">{sig.timeframe}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block max-w-[200px] capitalize">
                    {sig.strategy.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-slate-200">
                    ${sig.entryPrice.toFixed(2)}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{timeStr}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
