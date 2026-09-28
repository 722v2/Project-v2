/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ArrowUpRight, ArrowDownRight, Check, ShieldCheck, Activity, Target } from 'lucide-react';
import { Signal } from '../../types/signal.ts';

interface SignalDetailModalProps {
  signal: Signal | null;
  onClose: () => void;
}

export const SignalDetailModal: React.FC<SignalDetailModalProps> = ({ signal, onClose }) => {
  if (!signal) return null;

  const isBuy = signal.direction === 'BUY';
  const strategyName = signal.strategy.replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0D121D] border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-5">
        {/* HEADER */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
                isBuy
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isBuy ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" /> : <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {isBuy ? 'شراء (BUY)' : 'بيع (SELL)'} {signal.symbol}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono font-medium">
                  فريم {signal.timeframe}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {signal.status === 'ACTIVE' ? 'نشطة' : 'مؤرشفة'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{strategyName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SETUP IDENTITY METADATA */}
        <div className="p-3 rounded-lg bg-[#070A10] border border-slate-800 text-xs font-mono space-y-1">
          <div className="text-slate-400 text-[11px] font-sans font-semibold">بصمة الإعداد الفريدة (Setup Identity Fingerprint):</div>
          <div className="text-amber-400 text-[11px] truncate">{signal.setupId}</div>
          <div className="text-slate-400 text-[10px]">
            معرف الإشارة: {signal.signalId} · التوقيت: {new Date(signal.createdAt).toLocaleTimeString('ar-EG')}
          </div>
        </div>

        {/* TARGETS & GEOMETRY */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">مستويات الدخول والأهداف ونسبة العائد (R:R)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">سعر الدخول:</span>
              <strong className="text-base text-white tabular-nums">${signal.entryPrice.toFixed(2)}</strong>
            </div>
            <div className="p-3 rounded-lg bg-[#070A10] border border-rose-900/30">
              <span className="text-[10px] text-rose-400 block font-sans">وقف الخسارة (SL):</span>
              <strong className="text-base text-rose-400 tabular-nums">${signal.stopLoss.toFixed(2)}</strong>
            </div>
            <div className="p-3 rounded-lg bg-[#070A10] border border-emerald-900/30">
              <span className="text-[10px] text-emerald-400 block font-sans">الهدف الأول (TP1 - 1:{signal.riskReward1}):</span>
              <strong className="text-base text-emerald-400 tabular-nums">${signal.takeProfit1.toFixed(2)}</strong>
            </div>
            <div className="p-3 rounded-lg bg-[#070A10] border border-emerald-900/30">
              <span className="text-[10px] text-emerald-400 block font-sans">الهدف الثاني (TP2 - 1:{signal.riskReward2}):</span>
              <strong className="text-base text-emerald-300 tabular-nums">${signal.takeProfit2.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* EVIDENCE BREAKDOWN */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300">تفاصيل الأدلة التراكمية (Evidence Breakdown)</h3>
            <span className="text-xs font-mono font-bold text-amber-400">إجمالي النقاط: {signal.qualityScore}/100</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-slate-400 text-[11px] block font-sans">هيكل السوق:</span>
              <span className="text-slate-200 font-semibold">{signal.evidenceBreakdown.marketStructure} / 20 نقطة</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-slate-400 text-[11px] block font-sans">سحب السيولة:</span>
              <span className="text-slate-200 font-semibold">{signal.evidenceBreakdown.liquidityEvent} / 18 نقطة</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-slate-400 text-[11px] block font-sans">منطقة الاهتمام POI:</span>
              <span className="text-slate-200 font-semibold">{signal.evidenceBreakdown.poiValidity ?? 15} / 15 نقطة</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-slate-400 text-[11px] block font-sans">توافق الفريمات MTF:</span>
              <span className="text-slate-200 font-semibold">{signal.evidenceBreakdown.mtfConfluence ?? 12} / 12 نقطة</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-slate-400 text-[11px] block font-sans">نسبة العائد للمخاطرة:</span>
              <span className="text-slate-200 font-semibold">{signal.evidenceBreakdown.riskReward ?? 10} / 10 نقاط</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A10] border border-slate-800">
              <span className="text-slate-400 text-[11px] block font-sans">Discount / Premium:</span>
              <span className="text-slate-200 font-semibold">{signal.evidenceBreakdown.premiumDiscount ?? 4} / 4 نقاط</span>
            </div>
          </div>
        </div>

        {/* ANALYSIS REASONS */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">أسباب التحليل الفني والشرطي:</h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {signal.analysisReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 bg-[#070A10] p-2 rounded border border-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* INVALIDATING CONDITIONS */}
        {signal.invalidatingConditions && signal.invalidatingConditions.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-rose-400">شروط إلغاء الإعداد (Invalidating Conditions):</h3>
            <ul className="space-y-1 text-xs text-rose-300 font-mono">
              {signal.invalidatingConditions.map((cond, i) => (
                <li key={i} className="bg-rose-950/20 p-2 rounded border border-rose-900/30">
                  ✕ {cond}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
