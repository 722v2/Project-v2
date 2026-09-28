/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, TrendingDown, Repeat, ArrowRightLeft, HelpCircle } from 'lucide-react';
import { MarketRegime } from '../../types/market.ts';

interface MarketRegimeCardProps {
  regime: MarketRegime;
}

export const MarketRegimeCard: React.FC<MarketRegimeCardProps> = ({ regime }) => {
  const getRegimeConfig = (type: MarketRegime['regime']) => {
    switch (type) {
      case 'TREND_UP':
        return {
          label: 'TREND UP',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          icon: TrendingUp,
        };
      case 'TREND_DOWN':
        return {
          label: 'TREND DOWN',
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/20',
          icon: TrendingDown,
        };
      case 'RANGE':
        return {
          label: 'RANGE',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/20',
          icon: Repeat,
        };
      case 'TRANSITION':
        return {
          label: 'TRANSITION',
          color: 'text-purple-400',
          bg: 'bg-purple-500/10 border-purple-500/20',
          icon: ArrowRightLeft,
        };
      default:
        return {
          label: 'UNCLEAR',
          color: 'text-slate-400',
          bg: 'bg-slate-800/40 border-slate-700/40',
          icon: HelpCircle,
        };
    }
  };

  const config = getRegimeConfig(regime.regime);
  const Icon = config.icon;

  return (
    <div className="rounded-xl bg-[#0D121D] border border-slate-800/80 p-3.5 flex items-center justify-between gap-3 shadow-md shadow-black/10">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Market Regime
            </span>
            <span className={`text-xs font-mono font-bold tracking-tight ${config.color}`}>
              {config.label}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              ({regime.confidence}% conf)
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium mt-0.5 line-clamp-1">
            {regime.contextNotes}
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-400 border-l border-slate-800/80 pl-3">
        {regime.adxValue && (
          <div>
            ADX: <strong className="text-slate-200">{regime.adxValue}</strong>
          </div>
        )}
        {regime.rangeHigh && regime.rangeLow && (
          <div className="text-[10px] text-slate-500">
            [{regime.rangeLow.toFixed(0)} - {regime.rangeHigh.toFixed(0)}]
          </div>
        )}
      </div>
    </div>
  );
};
