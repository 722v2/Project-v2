/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  LineChart,
  Radar,
  Radio,
  Briefcase,
  ShieldAlert,
  History,
  Server,
  Settings,
  Menu,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MarketDataHealth } from '../../packages/market-data/provider.ts';

export type NavTab =
  | 'dashboard'
  | 'market'
  | 'chart'
  | 'scanner'
  | 'signals'
  | 'trades'
  | 'risk'
  | 'history'
  | 'system'
  | 'settings';

export interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'market', label: 'السوق', icon: TrendingUp },
  { id: 'chart', label: 'الشارت', icon: LineChart },
  { id: 'scanner', label: 'السكانر', icon: Radar },
  { id: 'signals', label: 'الإشارات', icon: Radio },
  { id: 'trades', label: 'الصفقات', icon: Briefcase },
  { id: 'risk', label: 'المخاطر', icon: ShieldAlert },
  { id: 'history', label: 'السجل', icon: History },
  { id: 'system', label: 'النظام', icon: Server },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

interface TopBarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  price: number;
  bidPrice?: number;
  askPrice?: number;
  spread?: number;
  priceChangePct24h?: number;
  lastUpdatedSecondsAgo: number;
  providerHealth: MarketDataHealth;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onTabChange,
  price,
  bidPrice,
  askPrice,
  spread,
  priceChangePct24h,
  lastUpdatedSecondsAgo,
  providerHealth,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isConnected = providerHealth.status === 'CONNECTED';
  const isStale = providerHealth.status === 'STALE';

  const handleSelectTab = (tab: NavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#090D14]/95 backdrop-blur-md border-b border-slate-800/80">
      {/* 1. TOP LIVE MARKET METRICS STRIP (REQUIREMENT 4) */}
      <div className="w-full bg-[#05070B] border-b border-slate-900/80 px-4 sm:px-6 py-1.5 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          {/* Market Status & Symbol */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-amber-400 font-sans tracking-tight text-xs flex items-center gap-1.5">
              <span>الذهب — XAU/USD</span>
            </span>

            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : isStale ? 'bg-amber-500' : 'bg-rose-500'
                }`}
              />
              <span
                className={`text-[11px] font-bold ${
                  isConnected ? 'text-emerald-400' : isStale ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {isConnected ? 'متصل' : isStale ? 'غير محدث' : 'غير متصل'}
              </span>
            </div>

            {providerHealth.latencyMs > 0 && (
              <span className="hidden sm:inline text-[11px] text-slate-400">
                زمن الاستجابة: <strong className="text-slate-300 font-semibold">{providerHealth.latencyMs}ms</strong>
              </span>
            )}
          </div>

          {/* Pricing Telemetry */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">السعر:</span>
              {price > 0 ? (
                <span className="font-bold text-white tabular-nums text-xs">
                  ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-amber-400 animate-pulse text-[11px]">جاري الاتصال...</span>
              )}
            </div>

            {bidPrice !== undefined && askPrice !== undefined && (
              <div className="hidden md:flex items-center gap-2">
                <span>
                  Bid: <strong className="text-slate-200 tabular-nums">{bidPrice.toFixed(2)}</strong>
                </span>
                <span>
                  Ask: <strong className="text-slate-200 tabular-nums">{askPrice.toFixed(2)}</strong>
                </span>
              </div>
            )}

            {spread !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400">Spread:</span>
                <span className="text-slate-200 font-semibold tabular-nums">{spread.toFixed(2)}</span>
              </div>
            )}

            {priceChangePct24h !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400">تغير 24س:</span>
                <span
                  className={`font-bold tabular-nums ${
                    priceChangePct24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {priceChangePct24h >= 0 ? '+' : ''}
                  {priceChangePct24h.toFixed(2)}%
                </span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <span className="text-slate-400">آخر تحديث:</span>
              <span className="text-slate-300 tabular-nums">
                {lastUpdatedSecondsAgo < 60 ? `${lastUpdatedSecondsAgo}ث` : `${Math.floor(lastUpdatedSecondsAgo / 60)}د`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRIMARY NAVIGATION BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20">
            <span className="font-mono font-black text-slate-950 text-xs">Au</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm tracking-tight text-white">بوت الذهب الذكي</span>
            <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
              V2
            </span>
          </div>
        </div>

        {/* Desktop Navigation Tabs (All 10 Items) */}
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Medium Screen compact scrollable tabs */}
        <nav className="hidden md:flex lg:hidden items-center gap-1 overflow-x-auto max-w-[500px] py-1">
          {NAV_ITEMS.slice(0, 6).map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-400/15 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="px-2 py-1 text-xs font-semibold rounded-md bg-slate-900 text-slate-300 border border-slate-800"
          >
            المزيد...
          </button>
        </nav>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="القائمة الرئيسية"
            className="p-1.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 3. MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden w-full bg-[#0D121D] border-b border-slate-800 px-4 py-3 space-y-1">
          <div className="grid grid-cols-2 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 text-amber-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
