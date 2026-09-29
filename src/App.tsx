/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TopBar, NavTab } from './components/navigation/TopBar.tsx';
import { BottomNav } from './components/navigation/BottomNav.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { MarketView } from './components/views/MarketView.tsx';
import { ChartView } from './components/views/ChartView.tsx';
import { ScannerView } from './components/views/ScannerView.tsx';
import { SignalsView } from './components/views/SignalsView.tsx';
import { TradesView } from './components/views/TradesView.tsx';
import { RiskView } from './components/views/RiskView.tsx';
import { HistoryView } from './components/views/HistoryView.tsx';
import { SystemView } from './components/views/SystemView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { SignalDetailModal } from './components/modals/SignalDetailModal.tsx';
import { Timeframe } from './types/market.ts';
import { Signal } from './types/signal.ts';
import { TradingEngine, TradingEngineState } from './services/trading_engine.ts';
import { settingsService } from './services/settings_service.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [timeframe, setTimeframe] = useState<Timeframe>('5M');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  const engine = TradingEngine.getInstance();
  const [engineState, setEngineState] = useState<TradingEngineState>(() => engine.getState());

  useEffect(() => {
    // 1. Load persisted settings into runtime engine
    settingsService.loadAndApplySettings().catch((err) => {
      console.warn('Initial settings load error:', err);
    });

    // 2. Subscribe to live trading engine state updates
    const unsubscribe = engine.subscribe((newState) => {
      setEngineState({ ...newState });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    engine.fetchCandlesForTimeframe(tf).catch((err) => {
      console.warn(`Error fetching candles for ${tf}:`, err);
    });
  };

  const handleManualScan = async () => {
    await engine.triggerManualScan();
  };

  const currentCandles = engineState.displayCandles?.[timeframe] || engineState.candles[timeframe] || [];
  const riskEngine = engine.getRiskEngine();
  const riskRules = riskEngine.getRisk();
  const accountState = riskEngine.getAccount();

  const riskSummary = {
    capital: accountState.currentCapital,
    riskPercentPerTrade: riskRules.riskPercentPerTrade,
    maxDailyRiskPercent: riskRules.maxDailyRiskPercent,
    dailyRiskUsedPercent: 0,
    openTradesCount: engineState.activeTrade ? 1 : 0,
    maxConcurrentTrades: riskRules.maxConcurrentTrades,
    currentDrawdownPercent: 0,
    riskStatus: 'NORMAL' as const,
  };

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* 1. TOP MARKET HEADER & NAVIGATION (ALL 10 WORKING TABS) */}
      <TopBar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        price={engineState.currentPrice}
        bidPrice={engineState.bidPrice}
        askPrice={engineState.askPrice}
        spread={engineState.spread}
        priceChangePct24h={engineState.priceChangePct24h}
        lastUpdatedSecondsAgo={engineState.dataFreshnessSeconds}
        providerHealth={engineState.providerHealth}
      />

      {/* 2. MAIN ACTIVE VIEWPORT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-20 md:pb-8">
        {/* VIEW 1: MAIN DASHBOARD */}
        {currentTab === 'dashboard' && (
          <DashboardView
            currentPrice={engineState.currentPrice}
            bidPrice={engineState.bidPrice}
            askPrice={engineState.askPrice}
            spread={engineState.spread}
            priceChangePct24h={engineState.priceChangePct24h}
            candles={currentCandles}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            regime={engineState.regime}
            activeSignal={engineState.activeSignal}
            activeTrade={engineState.activeTrade}
            activePosition={engineState.activePosition}
            recentSignals={engineState.recentSignals}
            providerHealth={engineState.providerHealth}
            dataFreshnessSeconds={engineState.dataFreshnessSeconds}
            lastScanTimestamp={engineState.lastScanTimestamp}
            nextScanTimestamp={engineState.nextScanTimestamp}
            strategyResults={engineState.lastScanDetails.strategyResults}
            mtfAnalysis={engineState.mtfAnalysis}
            riskSummary={riskSummary}
            onSelectSignal={setSelectedSignal}
            onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
          />
        )}

        {/* VIEW 2: MARKET OVERVIEW */}
        {currentTab === 'market' && (
          <MarketView
            currentPrice={engineState.currentPrice}
            bidPrice={engineState.bidPrice}
            askPrice={engineState.askPrice}
            spread={engineState.spread}
            priceChangePct24h={engineState.priceChangePct24h}
            regime={engineState.regime}
            providerHealth={engineState.providerHealth}
            dataFreshnessSeconds={engineState.dataFreshnessSeconds}
          />
        )}

        {/* VIEW 3: FULL CHART */}
        {currentTab === 'chart' && (
          <ChartView
            candles={currentCandles}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            activeSignal={engineState.activeSignal}
            currentPrice={engineState.currentPrice}
          />
        )}

        {/* VIEW 4: DEDICATED SCANNER PAGE (REQUIREMENTS 13-16) */}
        {currentTab === 'scanner' && (
          <ScannerView
            lastScanDetails={engineState.lastScanDetails}
            scannerLogs={engineState.scannerLogs}
            isScannerRunning={engineState.isScannerRunning}
            isScannerPaused={engineState.isScannerPaused}
            scanCount={engineState.scanCount}
            lastScanTimestamp={engineState.lastScanTimestamp}
            nextScanTimestamp={engineState.nextScanTimestamp}
            currentPrice={engineState.currentPrice}
            dataFreshnessSeconds={engineState.dataFreshnessSeconds}
            onTriggerManualScan={handleManualScan}
            onPauseScanner={() => engine.pauseScanner()}
            onResumeScanner={() => engine.resumeScanner()}
          />
        )}

        {/* VIEW 5: SIGNALS DIRECTORY */}
        {currentTab === 'signals' && (
          <SignalsView
            signals={engineState.recentSignals}
            onSelectSignal={setSelectedSignal}
          />
        )}

        {/* VIEW 6: ACTIVE TRADES */}
        {currentTab === 'trades' && (
          <TradesView
            activeTrade={engineState.activeTrade}
            activePosition={engineState.activePosition}
            completedTrades={engineState.completedTrades}
          />
        )}

        {/* VIEW 7: RISK ENGINE */}
        {currentTab === 'risk' && (
          <RiskView
            riskEngine={riskEngine}
            currentPrice={engineState.currentPrice}
          />
        )}

        {/* VIEW 8: HISTORY */}
        {currentTab === 'history' && (
          <HistoryView
            completedTrades={engineState.completedTrades}
            signals={engineState.recentSignals}
          />
        )}

        {/* VIEW 9: SYSTEM & CONNECTIVITY AUDIT */}
        {currentTab === 'system' && (
          <SystemView
            providerHealth={engineState.providerHealth}
            dataFreshnessSeconds={engineState.dataFreshnessSeconds}
          />
        )}

        {/* VIEW 10: SETTINGS (PERSISTENCE AUDIT & FIX) */}
        {currentTab === 'settings' && (
          <SettingsView
            onSettingsSaved={() => {
              // Engine state reflects new settings
              setEngineState({ ...engine.getState() });
            }}
          />
        )}
      </main>

      {/* 3. MOBILE BOTTOM NAVIGATION (OPTIMIZED FOR ANDROID/TOUCH) */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeSignalsCount={engineState.activeSignal ? 1 : 0}
        activeTradesCount={engineState.activeTrade ? 1 : 0}
      />

      {/* 4. SIGNAL DETAIL MODAL */}
      <SignalDetailModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </div>
  );
}
