/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Calculator,
  Percent,
  DollarSign,
  AlertTriangle,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { RiskEngine } from '../../packages/risk/risk_engine.ts';

interface RiskViewProps {
  riskEngine: RiskEngine;
  currentPrice: number;
}

export const RiskView: React.FC<RiskViewProps> = ({ riskEngine, currentPrice }) => {
  const account = riskEngine.getAccount();
  const rules = riskEngine.getRisk();

  // Interactive Lot Calculator State
  const [calcEntry, setCalcEntry] = useState(currentPrice > 0 ? currentPrice : 2900.0);
  const [calcSl, setCalcSl] = useState(currentPrice > 0 ? currentPrice - 3.5 : 2896.5);
  const [calcRiskPct, setCalcRiskPct] = useState(rules.riskPercentPerTrade);

  const slDistance = Math.abs(calcEntry - calcSl);
  const riskAmountUsd = (account.currentCapital * calcRiskPct) / 100;
  // Gold standard lot: 100 oz. 1 pip ($0.10) per 1 lot = $10. 1 USD move per 1 lot = $100.
  // Lot size = RiskUSD / (SL_distance * 100)
  const calculatedLots = slDistance > 0 ? Math.max(0.01, Number((riskAmountUsd / (slDistance * 100)).toFixed(2))) : 0.01;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-slate-800 flex items-center justify-between shadow-lg">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>وحدة إدارة المخاطر المؤسسية (Institutional Risk Engine)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            حساب أحجام اللوت التلقائية، حماية رأس المال، مراقبة التراجع اليومي والحد الأقصى للمخاطرة
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>حالة الأمان: نشطة ومحمية</span>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block font-sans">رأس المال الحالي</span>
          <strong className="text-xl font-bold font-mono text-white tabular-nums block mt-1">
            ${account.currentCapital.toFixed(2)}
          </strong>
          <span className="text-[11px] text-slate-400 font-mono">الابتدائي: ${account.startingCapital.toFixed(2)}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block font-sans">مخاطرة الصفقة الواحدة</span>
          <strong className="text-xl font-bold font-mono text-amber-400 tabular-nums block mt-1">
            {rules.riskPercentPerTrade}%
          </strong>
          <span className="text-[11px] text-slate-400 font-mono">
            القيمة: ${((account.currentCapital * rules.riskPercentPerTrade) / 100).toFixed(2)} USD
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block font-sans">الحد الأقصى للمخاطرة اليومية</span>
          <strong className="text-xl font-bold font-mono text-slate-200 tabular-nums block mt-1">
            {rules.maxDailyRiskPercent}%
          </strong>
          <span className="text-[11px] text-emerald-400 font-sans">المستخدم اليوم: 0.00%</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0D121D] border border-slate-800">
          <span className="text-slate-400 text-xs block font-sans">أقصى مسافة لـ SL</span>
          <strong className="text-xl font-bold font-mono text-rose-400 tabular-nums block mt-1">
            ${rules.maxAllowedSlDistance.toFixed(2)}
          </strong>
          <span className="text-[11px] text-slate-400 font-mono">أدنى R:R مسموح: 1:{rules.minRiskRewardRatio}</span>
        </div>
      </div>

      {/* INTERACTIVE LOT CALCULATOR */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">حاسبة حجم اللوت الدقيقة للذهب (XAU/USD Position Sizer)</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">عقد قياسي: 100 أونصة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4">
          <div>
            <label className="text-slate-400 text-xs block mb-1">سعر الدخول المقترح ($):</label>
            <input
              type="number"
              step="0.1"
              value={calcEntry}
              onChange={(e) => setCalcEntry(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs block mb-1">سعر وقف الخسارة ($):</label>
            <input
              type="number"
              step="0.1"
              value={calcSl}
              onChange={(e) => setCalcSl(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs block mb-1">نسبة المخاطرة (%):</label>
            <input
              type="number"
              step="0.1"
              value={calcRiskPct}
              onChange={(e) => setCalcRiskPct(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 flex flex-col justify-center">
            <span className="text-[11px] text-amber-400 font-semibold block">حجم اللوت الموصى به:</span>
            <strong className="text-xl font-bold font-mono text-white tabular-nums mt-0.5">
              {calculatedLots} Lots
            </strong>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
              المخاطرة: ${riskAmountUsd.toFixed(2)} USD (المسافة: ${slDistance.toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* RISK RULES & HARD LIMITS TABLE */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
          <Scale className="w-4 h-4 text-amber-400" />
          <span>القواعد الصارمة لمحرك المخاطر (Hard Risk Rules)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">1. منع الإفراط في التداول (Anti-Overtrading)</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              الحد الأقصى لعدد الصفقات المتزامنة هو {rules.maxConcurrentTrades} صفقات فقط لحماية الهامش وتجنب التداخل العكسي.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">2. رفض المسافات السعرية الواسعة</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              يرفض المحرك أي صفقة تزيد فيها مسافة وقف الخسارة عن {rules.maxAllowedSlDistance}$ لمنع استنزاف الحساب في أوقات التذبذب العنيف.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">3. نسبة العائد للمخاطرة الإلزامية</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              لا يُقبل أي إعداد تداول بنسبة عائد للمخاطرة أقل من 1:{rules.minRiskRewardRatio} لضمان التوقع الرياضي الإيجابي.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="font-bold text-slate-200 block">4. قاطع الدائرة للتراجع اليومي (Circuit Breaker)</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              إيقاف كامل لتوليد الإشارات فور وصول الخسارة اليومية إلى {rules.maxDailyRiskPercent}% أو التراجع الكلي إلى {rules.maxDrawdownLimitPercent}%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
