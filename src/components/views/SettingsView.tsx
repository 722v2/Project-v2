/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Layers,
  Activity,
  Bot,
  Bell,
  Power,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  Info,
} from 'lucide-react';
import { TradingEngine } from '../../services/trading_engine.ts';
import { settingsService, SettingsSaveResult } from '../../services/settings_service.ts';

interface SettingsViewProps {
  onSettingsSaved?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsSaved }) => {
  const engine = TradingEngine.getInstance();
  const currentConfig = engine.getConfig();

  // Section 1: Market Data
  const [provider] = useState('biquote');
  const [symbol] = useState('XAUUSD');
  const [candleWindow1M, setCandleWindow1M] = useState(currentConfig.candleWindows['1M'] || 200);
  const [candleWindow5M] = useState(currentConfig.candleWindows['5M'] || 300);
  const [candleWindow15M] = useState(currentConfig.candleWindows['15M'] || 200);
  const [candleWindow1H] = useState(currentConfig.candleWindows['1H'] || 150);
  const [maxStaleness, setMaxStaleness] = useState(currentConfig.maxStalenessSeconds || 120);

  // Section 2: Risk Management
  const [capital, setCapital] = useState(currentConfig.accountDefaults.currentCapital);
  const [riskPct, setRiskPct] = useState(currentConfig.riskDefaults.riskPercentPerTrade);
  const [maxDailyRisk, setMaxDailyRisk] = useState(currentConfig.riskDefaults.maxDailyRiskPercent);
  const [maxConcurrent, setMaxConcurrent] = useState(currentConfig.riskDefaults.maxConcurrentTrades);
  const [maxSlDist, setMaxSlDist] = useState(currentConfig.riskDefaults.maxAllowedSlDistance);
  const [minRr, setMinRr] = useState(currentConfig.riskDefaults.minRiskRewardRatio);
  const [maxDrawdown, setMaxDrawdown] = useState(currentConfig.riskDefaults.maxDrawdownLimitPercent);

  // Section 3: Strategies (6 Approved Strategies)
  const [strategies, setStrategies] = useState([
    { id: 'liquidity_sweep_reversal', name: 'Strategy 1: Liquidity Sweep + Reversal', nameAr: 'سحب السيولة وانعكاس (Liquidity Sweep)', enabled: true, minConf: 70 },
    { id: 'bos_pullback_continuation', name: 'Strategy 2: BOS + Pullback / Continuation', nameAr: 'كسر هيكل السوق واستمرار (BOS)', enabled: true, minConf: 70 },
    { id: 'fvg_retracement', name: 'Strategy 3: FVG Retracement', nameAr: 'منطقة القيمة العادلة (FVG)', enabled: true, minConf: 70 },
    { id: 'order_block_reaction', name: 'Strategy 4: Order Block Reaction', nameAr: 'كتلة الأوامر (Order Block)', enabled: true, minConf: 70 },
    { id: 'liquidity_ob_fvg_confluence', name: 'Strategy 5: Confluence & Momentum', nameAr: 'توافق السيولة والزخم (Confluence)', enabled: true, minConf: 72 },
    { id: 'range_eqh_eql_reversal', name: 'Strategy 6: Range EQH/EQL Reversal', nameAr: 'هيكل النطاق والقمم المتساوية', enabled: true, minConf: 70 },
  ]);

  // Section 4: Monitoring
  const [monitorInterval, setMonitorInterval] = useState(currentConfig.monitoring.pollIntervalSeconds || 5);
  const [breakevenTriggerR, setBreakevenTriggerR] = useState(currentConfig.monitoring.breakevenTriggerR || 1.0);
  const [tp1Ratio, setTp1Ratio] = useState(currentConfig.monitoring.partialCloseTp1Ratio || 0.5);
  const [trailingStop, setTrailingStop] = useState(false);
  const [reversalWatch, setReversalWatch] = useState(currentConfig.monitoring.reversalWatchEnabled ?? true);
  const [dedupTolerance, setDedupTolerance] = useState(currentConfig.dedup.poiZoneToleranceUsd || 1.0);

  // Section 5: AI Reasoning
  const [aiProvider] = useState('gemini');
  const [aiModel] = useState('gemini-2.5-flash');
  const [aiTimeoutMs, setAiTimeoutMs] = useState(currentConfig.ai.timeoutMs || 30000);

  // Section 6: Telegram Notifications
  const [telegramEnabled, setTelegramEnabled] = useState(currentConfig.telegram.enabled || false);
  const [telegramRateLimit, setTelegramRateLimit] = useState(currentConfig.telegram.rateLimitPerMinute || 10);
  const [notifyTp1, setNotifyTp1] = useState(currentConfig.telegram.notifyOnTp1 ?? true);
  const [notifyTp2, setNotifyTp2] = useState(currentConfig.telegram.notifyOnTp2 ?? true);
  const [notifySl, setNotifySl] = useState(currentConfig.telegram.notifyOnSl ?? true);
  const [notifyInvalidation, setNotifyInvalidation] = useState(currentConfig.telegram.notifyOnInvalidation ?? true);
  const [notifyReversal, setNotifyReversal] = useState(currentConfig.telegram.notifyOnReversalWatch ?? true);
  const [notifyEarlyExit, setNotifyEarlyExit] = useState(true);

  // Section 7: Execution Governance & Safety
  const [emergencyKillSwitch, setEmergencyKillSwitch] = useState(
    currentConfig.execution.emergencyKillSwitch ?? true
  );

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SettingsSaveResult | null>(null);

  const toggleStrategy = (id: string) => {
    setStrategies(strategies.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const updateStrategyConf = (id: string, val: number) => {
    setStrategies(strategies.map((s) => (s.id === id ? { ...s, minConf: val } : s)));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedback(null);

    const payload = {
      startingCapital: Number(capital),
      riskPercentPerTrade: Number(riskPct),
      maxDailyRiskPercent: Number(maxDailyRisk),
      maxConcurrentTrades: Number(maxConcurrent),
      maxAllowedSlDistance: Number(maxSlDist),
      minRiskRewardRatio: Number(minRr),
      maxDrawdownLimitPercent: Number(maxDrawdown),
      emergencyKillSwitch,
      telegramEnabled,
      telegramRateLimitPerMinute: Number(telegramRateLimit),
      candleWindow1M: Number(candleWindow1M),
      aiTimeoutMs: Number(aiTimeoutMs),
      monitorPollIntervalSeconds: Number(monitorInterval),
      dedupPoiZoneToleranceUsd: Number(dedupTolerance),
      strategies: strategies.map((s) => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled,
        minConfidence: s.minConf,
      })),
    };

    try {
      const res = await settingsService.saveSettings(payload);
      setFeedback(res);
      if (res.success && onSettingsSaved) {
        onSettingsSaved();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* HEADER & GLOBAL SAVE BUTTON */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-slate-800 flex items-center justify-between flex-wrap gap-4 shadow-lg sticky top-14 z-30 backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400" />
            <span>إعدادات النظام والتحكم المؤسسي (System Settings &amp; Governance)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            إدارة المخاطر، معايير الاستراتيجيات، المراقبة، وتأكيد الحفظ الدائم في قاعدة البيانات
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-amber-500/10"
        >
          <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
          <span>{isSaving ? 'جاري التحقق والحفظ...' : 'حفظ التغييرات'}</span>
        </button>
      </div>

      {/* FEEDBACK BANNER (REQUIREMENT 17) */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            feedback.success
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <strong className="text-xs font-bold block">{feedback.message}</strong>
            {feedback.errors && (
              <ul className="text-xs text-rose-300 space-y-1 list-disc list-inside mt-1 font-sans">
                {Object.values(feedback.errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* SECTION 1: MARKET DATA (REQUIREMENT 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <Activity className="w-4 h-4 text-amber-400" />
          <span>1. بيانات السوق (Market Data Configuration)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">مزود البيانات (Provider):</label>
            <input
              type="text"
              disabled
              value="Biquote Live (Authoritative)"
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">الرمز المالي (Symbol):</label>
            <input
              type="text"
              disabled
              value="XAUUSD (الذهب مقابل الدولار)"
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">نافذة شموع فريم 1M (Candle Window):</label>
            <input
              type="number"
              value={candleWindow1M}
              onChange={(e) => setCandleWindow1M(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">الحد الأقصى لقدم البيانات (Staleness Limit):</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={maxStaleness}
                onChange={(e) => setMaxStaleness(Number(e.target.value))}
                className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
              />
              <span className="text-slate-400 font-mono text-xs shrink-0">ثانية</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: RISK MANAGEMENT (REQUIREMENT 17 & 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <Shield className="w-4 h-4 text-amber-400" />
          <span>2. إدارة المخاطر ورأس المال (Risk Management) — تدقيق الحفظ في Supabase</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">رأس المال الابتدائي (Starting Capital $):</label>
            <input
              type="number"
              step="10"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">نسبة المخاطرة لكل صفقة (Risk %):</label>
            <input
              type="number"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-amber-400 font-bold font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">الحد الأقصى للمخاطرة اليومية (%):</label>
            <input
              type="number"
              step="0.5"
              value={maxDailyRisk}
              onChange={(e) => setMaxDailyRisk(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">الحد الأقصى للصفقات المتزامنة:</label>
            <input
              type="number"
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">الحد الأقصى لمسافة SL ($):</label>
            <input
              type="number"
              step="0.5"
              value={maxSlDist}
              onChange={(e) => setMaxSlDist(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">الحد الأدنى لـ R:R (Minimum RR):</label>
            <input
              type="number"
              step="0.1"
              value={minRr}
              onChange={(e) => setMinRr(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">أقصى تراجع مسموح (Max Drawdown %):</label>
            <input
              type="number"
              step="1"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(Number(e.target.value))}
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: STRATEGIES (REQUIREMENT 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>3. معايير الاستراتيجيات المعتمدة (Strategy Configurations)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {strategies.map((s) => (
            <div
              key={s.id}
              className={`p-3 rounded-lg border flex items-center justify-between ${
                s.enabled ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="space-y-0.5">
                <span className="font-bold text-white block">{s.name}</span>
                <span className="text-[11px] text-slate-400 font-sans">{s.nameAr}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center font-mono">
                  <span className="text-[10px] text-slate-500 block font-sans">أدنى ثقة:</span>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={s.minConf}
                    onChange={(e) => updateStrategyConf(s.id, Number(e.target.value))}
                    className="w-14 bg-[#070A10] border border-slate-800 rounded px-1.5 py-0.5 text-center text-amber-400 font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => toggleStrategy(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    s.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {s.enabled ? 'مفعلة' : 'معطلة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: MONITORING & TRADE TRACKING (REQUIREMENT 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <Activity className="w-4 h-4 text-amber-400" />
          <span>4. المراقبة والصفقات (Monitoring &amp; Position Tracking)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">فاصل فحص المراقبة (Monitor Interval):</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={monitorInterval}
                onChange={(e) => setMonitorInterval(Number(e.target.value))}
                className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
              />
              <span className="text-slate-400 font-mono text-xs shrink-0">ثوانٍ</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">نقل الوقف للدخول (Breakeven Trigger):</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                value={breakevenTriggerR}
                onChange={(e) => setBreakevenTriggerR(Number(e.target.value))}
                className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
              />
              <span className="text-slate-400 font-mono text-xs shrink-0">R</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">نسبة الإغلاق الجزئي TP1:</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                value={tp1Ratio}
                onChange={(e) => setTp1Ratio(Number(e.target.value))}
                className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
              />
              <span className="text-slate-400 font-mono text-xs shrink-0">%</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">سماحية تكرار POI (Dedup Tolerance):</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                value={dedupTolerance}
                onChange={(e) => setDedupTolerance(Number(e.target.value))}
                className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
              />
              <span className="text-slate-400 font-mono text-xs shrink-0">USD</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 pt-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={reversalWatch}
              onChange={(e) => setReversalWatch(e.target.checked)}
              className="accent-amber-400 rounded w-4 h-4 cursor-pointer"
            />
            <span>تفعيل مراقبة الانعكاس المبكر (Reversal Watch)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={trailingStop}
              onChange={(e) => setTrailingStop(e.target.checked)}
              className="accent-amber-400 rounded w-4 h-4 cursor-pointer"
            />
            <span>تفعيل وقف الخسارة المتحرك (Trailing Stop)</span>
          </label>
        </div>
      </div>

      {/* SECTION 5: AI REASONING (REQUIREMENT 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <Bot className="w-4 h-4 text-amber-400" />
          <span>5. الذكاء الاصطناعي (AI Reasoning Parameters)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">المزود (Provider):</label>
            <input
              type="text"
              disabled
              value="Gemini API"
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">النموذج (Model):</label>
            <input
              type="text"
              disabled
              value="gemini-2.5-flash"
              className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">مهلة الاستجابة (Timeout MS):</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={aiTimeoutMs}
                onChange={(e) => setAiTimeoutMs(Number(e.target.value))}
                className="w-full bg-[#070A10] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
              />
              <span className="text-slate-400 font-mono text-xs shrink-0">ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: TELEGRAM NOTIFICATIONS (REQUIREMENT 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
          <Bell className="w-4 h-4 text-amber-400" />
          <span>6. الإشعارات وقنوات التنبيه (Telegram Notifications)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div>
              <span className="text-slate-200 font-bold block">إشعارات تليجرام (Telegram Bot):</span>
              <span className="text-[11px] text-slate-400">إرسال التنبيهات المباشرة فور اكتمال الإشارة</span>
            </div>
            <button
              type="button"
              onClick={() => setTelegramEnabled(!telegramEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                telegramEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {telegramEnabled ? 'مفعل' : 'معطل'}
            </button>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-semibold">حد الرسائل في الدقيقة (Rate Limit):</span>
            <input
              type="number"
              value={telegramRateLimit}
              onChange={(e) => setTelegramRateLimit(Number(e.target.value))}
              className="w-20 bg-[#070A10] border border-slate-800 rounded px-2 py-1 text-center text-white font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyTp1} onChange={(e) => setNotifyTp1(e.target.checked)} className="accent-amber-400 rounded" />
            <span>إشعار تحقيق TP1</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyTp2} onChange={(e) => setNotifyTp2(e.target.checked)} className="accent-amber-400 rounded" />
            <span>إشعار تحقيق TP2</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifySl} onChange={(e) => setNotifySl(e.target.checked)} className="accent-amber-400 rounded" />
            <span>إشعار ضرب الوقف SL</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyInvalidation} onChange={(e) => setNotifyInvalidation(e.target.checked)} className="accent-amber-400 rounded" />
            <span>إشعار إلغاء الإعداد</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyReversal} onChange={(e) => setNotifyReversal(e.target.checked)} className="accent-amber-400 rounded" />
            <span>إشعار مراقبة الانعكاس</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyEarlyExit} onChange={(e) => setNotifyEarlyExit(e.target.checked)} className="accent-amber-400 rounded" />
            <span>إشعار الخروج المبكر</span>
          </label>
        </div>
      </div>

      {/* SECTION 7: AUTOMATED TRADING & SAFETY (REQUIREMENT 18) */}
      <div className="rounded-xl bg-[#0D121D] border border-rose-900/40 p-4 space-y-3">
        <h3 className="text-xs font-bold text-rose-300 flex items-center gap-2 pb-2 border-b border-rose-900/30">
          <Power className="w-4 h-4 text-rose-400" />
          <span>7. التداول الآلي وقاطع الأمان المؤسسي (Execution Governance &amp; Safety)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-bold block">التداول الآلي (Auto-Trading):</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans">
                معطل
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              التنفيذ الفعلي لدى الوسطاء معطل وفقاً لسياسة الأمان المؤسسي. المنصة تعمل في وضع المراقبة، التحليل، وتوليد الإشارات اللحظية فقط.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-amber-300 font-bold block">قاطع الأمان للطوارئ (Emergency Kill Switch):</span>
                <span className="text-[10px] text-slate-400 font-sans">
                  إعداد تشغيلي أمني (ليس سراً) لإيقاف أي تنفيذ لحظي
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyKillSwitch(!emergencyKillSwitch)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  emergencyKillSwitch
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {emergencyKillSwitch ? 'مفعل (نشط)' : 'معطل'}
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              حالة القاطع الحالية: <strong className="text-white">{emergencyKillSwitch ? 'مفعل (يضمن عدم تنفيذ أي صفقات)' : 'معطل'}</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
