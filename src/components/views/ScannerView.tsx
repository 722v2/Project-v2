/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Radar,
  Play,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Activity,
  Shield,
  FileText,
  Filter,
  Info,
} from 'lucide-react';
import {
  TradingEngine,
  LastScanDetails,
  ScannerEventLog,
  StrategyEvaluationResult,
} from '../../services/trading_engine.ts';

interface ScannerViewProps {
  lastScanDetails: LastScanDetails;
  scannerLogs: ScannerEventLog[];
  isScannerRunning: boolean;
  scanCount: number;
  lastScanTimestamp: number;
  nextScanTimestamp: number;
  currentPrice: number;
  dataFreshnessSeconds: number;
  onTriggerManualScan: () => Promise<void>;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  lastScanDetails,
  scannerLogs,
  isScannerRunning,
  scanCount,
  lastScanTimestamp,
  nextScanTimestamp,
  currentPrice,
  dataFreshnessSeconds,
  onTriggerManualScan,
}) => {
  const [isScanningNow, setIsScanningNow] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Dynamic countdown to next scan (Requirement 13)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.round((nextScanTimestamp - now) / 1000));
      setCountdown(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [nextScanTimestamp]);

  const handleManualScan = async () => {
    setIsScanningNow(true);
    try {
      await onTriggerManualScan();
    } finally {
      setIsScanningNow(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP SCANNER STATUS BAR (REQUIREMENT 13) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Radar className={`w-5 h-5 ${isScannerRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">السكانر المؤسسي المباشر (Scanner)</h2>
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isScannerRunning ? 'يعمل' : 'متوقف'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                فحص آلي متواصل لشمعات الذهب XAU/USD وتقييم الاستراتيجيات الست المعتمدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualScan}
              disabled={isScanningNow}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-amber-500/10"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanningNow ? 'animate-spin' : ''}`} />
              <span>{isScanningNow ? 'جاري الفحص الآن...' : 'فحص فوري الآن'}</span>
            </button>
          </div>
        </div>

        {/* Real Scanner State Grid (Requirement 13) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4 mt-4 border-t border-slate-800 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-sans">فاصل الفحص الدوري:</span>
            <strong className="text-amber-400 font-bold text-sm">60 ثانية</strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-sans">آخر فحص تم تنفيذه:</span>
            <strong className="text-white text-sm">
              {lastScanTimestamp > 0 ? new Date(lastScanTimestamp).toLocaleTimeString('ar-EG') : 'جاري الفحص الأول'}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-sans">الفحص القادم بعد:</span>
            <strong className="text-emerald-400 text-sm">{countdown} ثانية</strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-sans">مدة آخر فحص:</span>
            <strong className="text-slate-300 text-sm">{lastScanDetails.durationMs}ms</strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-sans">إجمالي الفحوصات:</span>
            <strong className="text-white text-sm">#{scanCount}</strong>
          </div>
        </div>
      </div>

      {/* 2. CURRENT SCAN SUMMARY (REQUIREMENT 14) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">ملخص آخر فحص (Current Scan Details)</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            توقيت: {lastScanDetails.scanTimeString}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">السعر اللحظي:</span>
            <strong className="text-white font-mono text-sm tabular-nums">
              ${currentPrice > 0 ? currentPrice.toFixed(2) : '---'}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">عمر بيانات السوق:</span>
            <strong className="text-emerald-400 font-mono text-sm tabular-nums">
              {dataFreshnessSeconds} ثانية
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">نظام السوق (Regime):</span>
            <strong className="text-amber-300 font-sans font-semibold text-xs">
              {lastScanDetails.marketRegime}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">الانحياز الكلي (Bias):</span>
            <strong className="text-slate-200 font-sans font-semibold text-xs">
              {lastScanDetails.macroBias}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">الاستراتيجيات المفحوصة:</span>
            <strong className="text-white font-mono text-sm tabular-nums">
              {lastScanDetails.strategiesEvaluatedCount} من 6
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">الإشارات المتولدة:</span>
            <strong className="text-emerald-400 font-mono text-sm tabular-nums">
              {lastScanDetails.signalsGeneratedCount} إشارة
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 text-xs font-mono">
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-sans">عدد الـSetups المرصودة:</span>
            <strong className="text-white">{lastScanDetails.setupsFoundCount}</strong>
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-sans">عدد المرفوض (شروط غير كافية):</span>
            <strong className="text-rose-400">{lastScanDetails.rejectedCount}</strong>
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-sans">عدد المكرر المحمي (Deduplicated):</span>
            <strong className="text-amber-400">{lastScanDetails.dedupPreventedCount}</strong>
          </div>
        </div>
      </div>

      {/* 3. SCANNER STRATEGY RESULTS (REQUIREMENT 15) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">نتائج فحص الاستراتيجيات الست (Strategy Scan Results)</h3>
          </div>
          <span className="text-[11px] text-slate-400">تقييم مستقل وفق شروط كل استراتيجية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
          {lastScanDetails.strategyResults.map((strat) => (
            <div
              key={strat.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                strat.status === 'ACTIVE'
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                      {strat.strategyNumber}
                    </span>
                    <strong className="text-xs text-white">{strat.name}</strong>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      strat.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : strat.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {strat.status === 'ACTIVE'
                      ? 'نشط / مكتمل'
                      : strat.status === 'REJECTED'
                      ? 'مرفوض'
                      : 'انتظار الشروط'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 mt-1 font-sans">{strat.nameArabic}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-sans text-[11px]">حالة الفحص:</span>
                  <span className="text-emerald-400 font-semibold font-sans">تم الفحص</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-sans text-[11px]">الاتجاه المرصود:</span>
                  <span className="text-white font-semibold font-sans">
                    {strat.direction === 'BUY' ? 'شراء (BUY)' : strat.direction === 'SELL' ? 'بيع (SELL)' : 'محايد'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-sans text-[11px]">نقاط الأدلة (Score):</span>
                  <span className="text-amber-400 font-bold">{strat.score}/100</span>
                </div>

                {strat.rejectionReason && (
                  <div className="mt-2 text-[10px] text-slate-400 bg-slate-950/80 p-2 rounded border border-slate-800/80 font-sans">
                    <span className="text-amber-400/80 font-semibold block mb-0.5">ملاحظة الفحص:</span>
                    {strat.rejectionReason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SCANNER EVENT LOG (REQUIREMENT 16) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">سجل أحداث السكانر اللحظي (Scanner Live Event Log)</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {scannerLogs.length} أحداث مسجلة
          </span>
        </div>

        <div className="pt-3">
          <div className="bg-[#070A10] p-3 rounded-lg border border-slate-900 max-h-64 overflow-y-auto font-mono text-xs space-y-1.5">
            {scannerLogs.map((log) => {
              const color =
                log.type === 'success'
                  ? 'text-emerald-400'
                  : log.type === 'warn'
                  ? 'text-amber-400'
                  : log.type === 'error'
                  ? 'text-rose-400'
                  : 'text-slate-300';
              return (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-slate-400 shrink-0 text-[11px]">{log.time}</span>
                  <span className="text-slate-600">·</span>
                  <span className={`${color} font-sans text-xs`}>{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
