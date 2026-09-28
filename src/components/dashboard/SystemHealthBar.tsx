/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Database, Radio, ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { MarketDataHealth } from '../../packages/market-data/provider.ts';

interface SystemHealthBarProps {
  health?: MarketDataHealth;
  dataFreshnessSeconds?: number;
  lastScanTimestamp?: number;
}

export const SystemHealthBar: React.FC<SystemHealthBarProps> = ({
  health,
  dataFreshnessSeconds = 0,
  lastScanTimestamp = 0,
}) => {
  const isConnected = health?.status === 'CONNECTED';
  const isStale = health?.status === 'STALE';
  const isDisconnected = !health || health.status === 'DISCONNECTED';

  const scanAgoSec = lastScanTimestamp > 0 ? Math.max(0, Math.round((Date.now() - lastScanTimestamp) / 1000)) : 0;

  return (
    <div className="rounded-xl bg-[#0B0F17] border border-slate-800/80 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-3">
      {/* LEFT: PROVIDER HEALTH STATUS */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          ) : isStale ? (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          )}
          <span className="font-semibold text-slate-200">
            MARKET DATA:{' '}
            <strong
              className={`font-mono ${
                isConnected ? 'text-emerald-400' : isStale ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {health?.status || 'INITIALIZING'}
            </strong>
          </span>
        </div>

        {isConnected && health && (
          <>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
              <span>Feed: Biquote ({health.latencyMs}ms)</span>
              {health.bidPrice !== undefined && (
                <span>· Bid: ${health.bidPrice.toFixed(2)}</span>
              )}
              {health.askPrice !== undefined && (
                <span>· Ask: ${health.askPrice.toFixed(2)}</span>
              )}
              {health.spread !== undefined && (
                <span>· Spread: ${health.spread.toFixed(2)}</span>
              )}
              <span className="text-slate-500">· Updated {dataFreshnessSeconds}s ago</span>
            </div>
          </>
        )}

        {isStale && (
          <>
            <span className="text-slate-700">|</span>
            <span className="font-mono text-amber-400 text-[10px]">
              DATA STALE: Last update {dataFreshnessSeconds}s ago (&gt;120s limit)
            </span>
          </>
        )}

        {isDisconnected && (
          <>
            <span className="text-slate-700">|</span>
            <span className="font-mono text-rose-400 text-[10px]">
              DISCONNECTED: {health?.error || 'Awaiting connection to Biquote feed'}
            </span>
          </>
        )}
      </div>

      {/* RIGHT: SYSTEM SUBSYSTEMS */}
      <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3 text-slate-400" />
          <span>Supabase: Online</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-amber-400" />
          <span>Scanner: 60s loop · Last: {scanAgoSec}s ago</span>
        </div>
      </div>
    </div>
  );
};
