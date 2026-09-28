/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  Globe,
  Clock,
  Gauge,
  Compass,
  Zap,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { MarketRegime } from '../../types/market.ts';
import { MarketDataHealth } from '../../packages/market-data/provider.ts';

interface MarketViewProps {
  currentPrice: number;
  bidPrice: number;
  askPrice: number;
  spread: number;
  priceChangePct24h?: number;
  regime: MarketRegime;
  providerHealth: MarketDataHealth;
  dataFreshnessSeconds: number;
}

export const MarketView: React.FC<MarketViewProps> = ({
  currentPrice,
  bidPrice,
  askPrice,
  spread,
  priceChangePct24h,
  regime,
  providerHealth,
  dataFreshnessSeconds,
}) => {
  const currentUtcHour = new Date().getUTCHours();

  const sessions = [
    { name: 'سيدني (Sydney)', utcHours: '22:00 - 07:00 UTC', active: currentUtcHour >= 22 || currentUtcHour < 7 },
    { name: 'طوكيو (Tokyo / Asian)', utcHours: '00:00 - 09:00 UTC', active: currentUtcHour >= 0 && currentUtcHour < 9 },
    { name: 'لندن (London Session)', utcHours: '08:00 - 16:30 UTC', active: currentUtcHour >= 8 && currentUtcHour < 16 },
    { name: 'نيويورك (New York Session)', utcHours: '13:00 - 22:00 UTC', active: currentUtcHour >= 13 && currentUtcHour < 22 },
  ];

  const rangeHigh = regime.rangeHigh ?? (currentPrice > 0 ? currentPrice + 12 : 0);
  const rangeLow = regime.rangeLow ?? (currentPrice > 0 ? currentPrice - 12 : 0);
  const rangeMid = (rangeHigh + rangeLow) / 2;
  const rangeSpan = Math.max(1, rangeHigh - rangeLow);
  const currentRelativePercent = Math.min(100, Math.max(0, ((currentPrice - rangeLow) / rangeSpan) * 100));

  return (
    <div className="space-y-4">
      {/* 1. TOP OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block">سعر الذهب الحالي (XAU/USD)</span>
          <strong className="text-xl font-bold font-mono text-white tabular-nums block mt-1">
            ${currentPrice.toFixed(2)}
          </strong>
          <span className="text-[11px] text-slate-400 font-mono">
            Bid: {bidPrice.toFixed(2)} · Ask: {askPrice.toFixed(2)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block">تغير الـ 24 ساعة</span>
          <strong
            className={`text-xl font-bold font-mono tabular-nums block mt-1 ${
              (priceChangePct24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {(priceChangePct24h ?? 0) >= 0 ? '+' : ''}{(priceChangePct24h ?? 0).toFixed(2)}%
          </strong>
          <span className="text-[11px] text-slate-400 font-mono">
            فرق السعر: ${((currentPrice * (priceChangePct24h ?? 0)) / 100).toFixed(2)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block">السبريد المباشر (Spread)</span>
          <strong className="text-xl font-bold font-mono text-amber-400 tabular-nums block mt-1">
            {spread.toFixed(2)} USD
          </strong>
          <span className="text-[11px] text-emerald-400 font-sans">
            سبريد ممتاز للتداول المؤسسي
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block">نظام وهيكل السوق (Regime)</span>
          <strong className="text-sm font-bold text-white block mt-1 font-sans">
            {regime.regime === 'TREND_UP'
              ? 'اتجاه صاعد (Bullish)'
              : regime.regime === 'TREND_DOWN'
              ? 'اتجاه هابط (Bearish)'
              : 'تذبذب عرضي (Range)'}
          </strong>
          <span className="text-[11px] text-slate-400">ثقة التقييم: {regime.confidence}%</span>
        </div>
      </div>

      {/* 2. DEALING RANGE & PREMIUM / DISCOUNT */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">نطاق التداول والسيولة (Dealing Range &amp; Premium/Discount)</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">فريم 15M / 1H</span>
        </div>

        <div className="pt-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[11px] block font-sans">أدنى النطاق (Discount Low):</span>
              <strong className="text-emerald-400 text-sm">${rangeLow.toFixed(2)}</strong>
            </div>
            <div className="text-center">
              <span className="text-slate-400 text-[11px] block font-sans">نقطة التوازن (Equilibrium):</span>
              <strong className="text-slate-200 text-sm">${rangeMid.toFixed(2)}</strong>
            </div>
            <div className="text-left">
              <span className="text-slate-400 text-[11px] block font-sans">أعلى النطاق (Premium High):</span>
              <strong className="text-rose-400 text-sm">${rangeHigh.toFixed(2)}</strong>
            </div>
          </div>

          {/* Visual Range Slider Meter */}
          <div className="relative w-full h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 p-0.5">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow-md transition-all"
              style={{ right: `${currentRelativePercent}%` }}
              title={`موقع السعر الحالي: ${currentRelativePercent.toFixed(1)}%`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold font-sans">منطقة الخصم والشراء (Discount &lt; 50%)</span>
            <span className="text-rose-400 font-semibold font-sans">منطقة الغلاء والبيع (Premium &gt; 50%)</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
            <span className="text-amber-400 font-bold block mb-1">ملاحظات هيكل السوق الحالية:</span>
            {regime.contextNotes || 'حركة السعر داخل النطاق التوازني، في انتظار اكتمال تشكل قمم وقيعان رئيسية.'}
          </div>
        </div>
      </div>

      {/* 3. GLOBAL TRADING SESSIONS */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">جلسات التداول العالمية للذهب (Global Trading Sessions)</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">توقيت عالمي UTC: {currentUtcHour}:00</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
          {sessions.map((sess) => (
            <div
              key={sess.name}
              className={`p-3 rounded-lg border ${
                sess.active
                  ? 'bg-amber-400/10 border-amber-400/30'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{sess.name}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    sess.active
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {sess.active ? 'نشطة الآن' : 'مغلقة'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 block mt-2">{sess.utcHours}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
