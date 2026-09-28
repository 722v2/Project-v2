/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ArrowLeft, Compass, Sliders, Database, BookOpen, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { DEFAULT_CONFIG, SYSTEM_VERSIONS } from '../../config/index.ts';
import { generateSetupFingerprint, evaluateDeduplication } from '../../packages/deduplication/fingerprint.ts';
import { evaluateEvidenceScore } from '../../packages/scoring/evidence_scorer.ts';
import { CandidateSetup } from '../../types/setup.ts';

interface DeveloperDiagnosticsViewProps {
  onBackToTerminal: () => void;
}

export const DeveloperDiagnosticsView: React.FC<DeveloperDiagnosticsViewProps> = ({ onBackToTerminal }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dedup' | 'scoring' | 'schema' | 'roadmap'>('dedup');

  // --- DEDUPLICATION SIMULATOR ---
  const [simStrategy, setSimStrategy] = useState<'order_block_reaction' | 'liquidity_sweep_reversal'>('order_block_reaction');
  const [simDirection, setSimDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [simTimeframe, setSimTimeframe] = useState<'5M' | '15M'>('5M');
  const [simAnchorSwing, setSimAnchorSwing] = useState('sw_low_2648');
  const [simExistingPrice, setSimExistingPrice] = useState(2652.20);
  const [simCandidatePrice, setSimCandidatePrice] = useState(2652.45);
  const [simTolerance, setSimTolerance] = useState(0.50);

  const existingFingerprint = useMemo(() => {
    return generateSetupFingerprint({
      strategy: simStrategy,
      direction: simDirection,
      timeframe: simTimeframe,
      anchorSwingId: simAnchorSwing,
      poiZonePrice: simExistingPrice,
      toleranceUsd: simTolerance,
    });
  }, [simStrategy, simDirection, simTimeframe, simAnchorSwing, simExistingPrice, simTolerance]);

  const candidateFingerprint = useMemo(() => {
    return generateSetupFingerprint({
      strategy: simStrategy,
      direction: simDirection,
      timeframe: simTimeframe,
      anchorSwingId: simAnchorSwing,
      poiZonePrice: simCandidatePrice,
      toleranceUsd: simTolerance,
    });
  }, [simStrategy, simDirection, simTimeframe, simAnchorSwing, simCandidatePrice, simTolerance]);

  const dedupResult = useMemo(() => {
    const existingSetup: CandidateSetup = {
      identity: {
        setupId: existingFingerprint,
        strategy: simStrategy,
        direction: simDirection,
        timeframe: simTimeframe,
        poiZoneLow: simExistingPrice - 0.25,
        poiZoneHigh: simExistingPrice + 0.25,
        anchorSwingId: simAnchorSwing,
        anchorTimestamp: Date.now() - 15 * 60 * 1000,
      },
      entryPrice: simExistingPrice,
      stopLoss: simExistingPrice - 4.5,
      takeProfit1: simExistingPrice + 7.0,
      takeProfit2: simExistingPrice + 12.0,
      riskReward1: 1.55,
      riskReward2: 2.66,
      qualityScore: 82,
      confidence: 85,
      lifecycleState: 'ACTIVE',
      firstDetectedAt: Date.now() - 15 * 60 * 1000,
      lastUpdatedAt: Date.now() - 5 * 60 * 1000,
      structureNotes: ['Institutional POI buffer established'],
      invalidationCriteria: ['Price breach below stop level'],
    };

    const candidateSetup: CandidateSetup = {
      identity: {
        setupId: candidateFingerprint,
        strategy: simStrategy,
        direction: simDirection,
        timeframe: simTimeframe,
        poiZoneLow: simCandidatePrice - 0.25,
        poiZoneHigh: simCandidatePrice + 0.25,
        anchorSwingId: simAnchorSwing,
        anchorTimestamp: Date.now(),
      },
      entryPrice: simCandidatePrice,
      stopLoss: simCandidatePrice - 4.5,
      takeProfit1: simCandidatePrice + 7.0,
      takeProfit2: simCandidatePrice + 12.0,
      riskReward1: 1.55,
      riskReward2: 2.66,
      qualityScore: 80,
      confidence: 83,
      lifecycleState: 'DETECTED',
      firstDetectedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      structureNotes: ['Secondary tick within same zone'],
      invalidationCriteria: ['Price breach below stop level'],
    };

    return evaluateDeduplication(candidateSetup, [existingSetup], simTolerance, 60 * 60 * 1000);
  }, [existingFingerprint, candidateFingerprint, simStrategy, simDirection, simTimeframe, simAnchorSwing, simExistingPrice, simCandidatePrice, simTolerance]);

  // --- EVIDENCE SCORING SIMULATOR ---
  const [scoreDirection, setScoreDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [scoreEntry, setScoreEntry] = useState(2652.00);
  const [scoreSl, setScoreSl] = useState(2647.50);
  const [scoreTp1, setScoreTp1] = useState(2659.00);
  const [scoreTp2] = useState(2665.00);
  const [structQuality, setStructQuality] = useState(0.85);
  const [sweepQuality, setSweepQuality] = useState(0.80);
  const [poiQuality, setPoiQuality] = useState(0.75);
  const [mtfQuality, setMtfQuality] = useState(0.70);
  const [macdState, setMacdState] = useState<'ALIGN' | 'NEUTRAL' | 'OPPOSING'>('NEUTRAL');
  const [rsiState, setRsiState] = useState<'OPTIMAL' | 'ACCEPTABLE' | 'NEUTRAL' | 'EXTREME_OPPOSING'>('NEUTRAL');
  const [emaState, setEmaState] = useState<'ALIGNED' | 'NEUTRAL' | 'COUNTER'>('ALIGNED');
  const [isDiscount, setIsDiscount] = useState(true);
  const [newsState, setNewsState] = useState<'CLEAR' | 'MODERATE' | 'HIGH_IMPACT_IMMINENT'>('CLEAR');

  const scoringResult = useMemo(() => {
    return evaluateEvidenceScore({
      direction: scoreDirection,
      entryPrice: scoreEntry,
      stopLoss: scoreSl,
      takeProfit1: scoreTp1,
      takeProfit2: scoreTp2,
      maxAllowedSlDistance: DEFAULT_CONFIG.riskDefaults.maxAllowedSlDistance,
      minRiskRewardRatio: DEFAULT_CONFIG.riskDefaults.minRiskRewardRatio,
      marketStructureQuality: structQuality,
      liquiditySweepQuality: sweepQuality,
      poiCleanliness: poiQuality,
      mtfAlignmentScore: mtfQuality,
      macdMomentumState: macdState,
      rsiState,
      emaAlignmentState: emaState,
      isDiscountOrPremium: isDiscount,
      newsRiskState: newsState,
    });
  }, [scoreDirection, scoreEntry, scoreSl, scoreTp1, scoreTp2, structQuality, sweepQuality, poiQuality, mtfQuality, macdState, rsiState, emaState, isDiscount, newsState]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* HEADER WITH RETURN BUTTON */}
      <div className="p-4 rounded-2xl bg-[#0D121D] border border-slate-800/80 flex items-center justify-between shadow-lg shadow-black/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToTerminal}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white">Developer Diagnostics &amp; Invariant Simulators</h2>
            <p className="text-xs text-slate-400">Isolated testing environment for deduplication, scoring, and persistence schema</p>
          </div>
        </div>

        {/* SUB-TABS */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {[
            { id: 'dedup' as const, label: 'Deduplication' },
            { id: 'scoring' as const, label: '100-Pt Scoring' },
            { id: 'schema' as const, label: '22 Schema Entities' },
            { id: 'roadmap' as const, label: 'Roadmap' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === t.id
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DEDUPLICATION SIMULATOR */}
      {activeSubTab === 'dedup' && (
        <div className="p-5 rounded-2xl bg-[#0D121D] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Compass className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Setup Identity &amp; Anti-Spam Simulator
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block mb-1">Active Setup Price</span>
              <input
                type="number"
                step="0.10"
                value={simExistingPrice}
                onChange={(e) => setSimExistingPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-amber-400 font-mono"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block truncate">
                ID: {existingFingerprint}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block mb-1">Candidate Setup Price</span>
              <input
                type="number"
                step="0.10"
                value={simCandidatePrice}
                onChange={(e) => setSimCandidatePrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-cyan-400 font-mono"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block truncate">
                ID: {candidateFingerprint}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block mb-1">POI Tolerance Window</span>
              <input
                type="number"
                step="0.10"
                value={simTolerance}
                onChange={(e) => setSimTolerance(parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Price Gap: ${Math.abs(simCandidatePrice - simExistingPrice).toFixed(2)}
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              dedupResult.isDuplicate ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
            }`}
          >
            {dedupResult.isDuplicate ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {dedupResult.isDuplicate ? 'DUPLICATE SIGNAL SUPPRESSED (Zero Spam)' : 'GENUINELY NEW SETUP ALLOWED'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {dedupResult.isDuplicate
                  ? dedupResult.preventionRecord?.reason
                  : 'Candidate falls outside existing POI cluster bounds or represents an independent structural swing.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EVIDENCE SCORING MATRIX */}
      {activeSubTab === 'scoring' && (
        <div className="p-5 rounded-2xl bg-[#0D121D] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              100-Point Non-Starvation Evidence Scorer
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Direction</label>
                <select
                  value={scoreDirection}
                  onChange={(e) => setScoreDirection(e.target.value as 'BUY' | 'SELL')}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Entry ($)</label>
                <input
                  type="number"
                  value={scoreEntry}
                  onChange={(e) => setScoreEntry(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Stop Loss ($)</label>
                <input
                  type="number"
                  value={scoreSl}
                  onChange={(e) => setScoreSl(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="text-xs text-slate-400 block mb-1">MACD Momentum Vector</label>
              <select
                value={macdState}
                onChange={(e) => setMacdState(e.target.value as typeof macdState)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="ALIGN">Aligned Momentum (7 pts)</option>
                <option value="NEUTRAL">Neutral / Decelerating (4 pts)</option>
                <option value="OPPOSING">Opposing Momentum (1 pt)</option>
              </select>

              <label className="text-xs text-slate-400 block mb-1">RSI State</label>
              <select
                value={rsiState}
                onChange={(e) => setRsiState(e.target.value as typeof rsiState)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="OPTIMAL">Optimal / Divergence (6 pts)</option>
                <option value="ACCEPTABLE">Acceptable (4 pts)</option>
                <option value="NEUTRAL">Neutral (3 pts)</option>
                <option value="EXTREME_OPPOSING">Opposing (1 pt)</option>
              </select>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              scoringResult.isHardInvalidated
                ? 'bg-rose-500/10 border-rose-500/30'
                : scoringResult.isActionable
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {scoringResult.isHardInvalidated ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : scoringResult.isActionable ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {scoringResult.isHardInvalidated
                    ? 'HARD INVALIDATION (Fatal Safety Gate)'
                    : scoringResult.isActionable
                    ? 'ACTIONABLE SETUP (Score >= 65)'
                    : 'NO TRADE (Insufficient Evidence)'}
                </h4>
                <p className="text-xs text-slate-300">
                  {scoringResult.isHardInvalidated
                    ? scoringResult.hardInvalidationReasons.join('; ')
                    : 'Soft factors preserve setup without starvation.'}
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-bold text-white">{scoringResult.qualityScore}</span>
              <span className="text-xs text-slate-400"> / 100</span>
            </div>
          </div>
        </div>
      )}

      {/* SCHEMA EXPLORER */}
      {activeSubTab === 'schema' && (
        <div className="p-5 rounded-2xl bg-[#0D121D] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Database className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Supabase 22 Persistence Entities
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {[
              'system_versions',
              'audit_logs',
              'market_snapshots',
              'candles_metadata',
              'news_events',
              'market_regimes',
              'setups',
              'setup_events',
              'signals',
              'signal_updates',
              'duplicate_preventions',
              'rejected_setups',
              'trades',
              'trade_positions',
              'trade_updates',
              'trade_outcomes',
              'account_settings',
              'risk_settings',
              'strategy_settings',
              'experience_records',
              'learning_features',
              'experiments',
            ].map((name, i) => (
              <div key={name} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                <span className="text-slate-500 mr-2">#{i + 1}</span>
                <span className="text-amber-400 font-semibold">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE ROADMAP */}
      {activeSubTab === 'roadmap' && (
        <div className="p-5 rounded-2xl bg-[#0D121D] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              19-Phase Master Engineering Roadmap
            </h3>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="text-emerald-400 font-bold font-mono">PHASE 1: COMPLETED &amp; TESTED (8/8 Tests Passing)</div>
            <div className="text-amber-400 font-bold font-mono">CURRENT TASK: UI/UX REDESIGN (Professional Terminal)</div>
            <div className="text-slate-400 font-mono">PHASE 2: Market Data Abstraction &amp; Biquote (PAUSED AS REQUESTED)</div>
          </div>
        </div>
      )}
    </div>
  );
};
