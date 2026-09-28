/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { DEFAULT_CONFIG } from '../../config/index.ts';

interface RiskSummaryWidgetProps {
  onNavigateSettings?: () => void;
}

export const RiskSummaryWidget: React.FC<RiskSummaryWidgetProps> = ({ onNavigateSettings }) => {
  const { accountDefaults, riskDefaults } = DEFAULT_CONFIG;
  const plannedRiskDollar = (accountDefaults.currentCapital * (riskDefaults.riskPercentPerTrade / 100)).toFixed(2);

  return (
    <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-4 space-y-3 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Risk &amp; Capital
          </h3>
        </div>
        {onNavigateSettings && (
          <button
            onClick={onNavigateSettings}
            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer font-medium"
          >
            <span>Edit</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block">Capital</span>
          <span className="font-mono font-bold text-sm text-white tabular-nums">
            ${accountDefaults.currentCapital.toFixed(2)}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block">Risk / Trade</span>
          <span className="font-mono font-bold text-sm text-amber-400 tabular-nums">
            {riskDefaults.riskPercentPerTrade.toFixed(1)}% (${plannedRiskDollar})
          </span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block">Daily Limit</span>
          <span className="font-mono font-bold text-sm text-slate-200 tabular-nums">
            {riskDefaults.maxDailyRiskPercent.toFixed(1)}% Max
          </span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block">Active Trades</span>
          <span className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
            1 / {riskDefaults.maxConcurrentTrades}
          </span>
        </div>
      </div>
    </div>
  );
};
