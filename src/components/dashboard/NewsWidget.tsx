/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Newspaper, Info, ShieldCheck } from 'lucide-react';
import { NewsEvent } from '../../types/news.ts';

interface NewsWidgetProps {
  events?: NewsEvent[];
}

export const NewsWidget: React.FC<NewsWidgetProps> = ({ events = [] }) => {
  return (
    <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-4 space-y-3 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Macro Intelligence
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">XAU/USD Impact</span>
      </div>

      {events.length > 0 ? (
        <div className="space-y-2.5">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      evt.impact === 'HIGH'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {evt.impact}
                  </span>
                  <span className="text-xs font-semibold text-slate-200">{evt.eventName}</span>
                </div>
                {evt.forecastValue && (
                  <div className="text-[10px] text-slate-400 font-mono">
                    Exp: {evt.forecastValue} · Prev: {evt.previousValue || 'N/A'}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">{evt.source}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-300 block">Clear Macro Window</span>
            <p className="text-[11px] text-slate-400 leading-snug">
              No imminent high-impact economic releases scheduled for the immediate window. System operating on pure technical institutional orderflow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
