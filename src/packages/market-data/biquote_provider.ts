/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, MarketSnapshot, Timeframe } from '../../types/market.ts';
import { MarketDataProvider, CandlesResult, MarketDataHealth } from './provider.ts';
import { validateCandleSeries } from './validator.ts';

export interface BiquoteProviderConfig {
  baseUrl?: string;
  wsUrl?: string;
  maxAllowedStalenessSeconds?: number;
  timeoutMs?: number;
}

export class BiquoteMarketDataProvider implements MarketDataProvider {
  public readonly name = 'biquote';
  private readonly configuredBaseUrl?: string;
  private readonly maxStalenessMs: number;
  private readonly timeoutMs: number;

  constructor(config?: BiquoteProviderConfig) {
    this.configuredBaseUrl = config?.baseUrl?.replace(/\/+$/, '');
    this.maxStalenessMs = (config?.maxAllowedStalenessSeconds ?? 120) * 1000;
    this.timeoutMs = config?.timeoutMs ?? 8000;
  }

  /**
   * Resolves list of candidate base URLs to try in order.
   * If a custom baseUrl is explicitly configured, only that baseUrl is used.
   * Otherwise:
   * In browser: same-origin proxy '/api/biquote' is tried first to eliminate CORS/preflight issues,
   * with 'https://biquote.io/api' as direct fallback.
   * In Node/CLI: 'https://biquote.io/api' is tried first.
   */
  private getCandidateBaseUrls(): string[] {
    if (this.configuredBaseUrl) {
      const normalized = this.configuredBaseUrl.endsWith('/api')
        ? this.configuredBaseUrl
        : `${this.configuredBaseUrl}/api`;
      return [normalized];
    }

    const isBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined';
    if (isBrowser) {
      return ['/api/biquote', 'https://biquote.io/api'];
    }

    return ['https://biquote.io/api', 'http://localhost:3000/api/biquote'];
  }

  /**
   * Normalizes symbol for Biquote API (e.g. "XAU/USD" -> "XAUUSD")
   */
  public normalizeSymbol(symbol: string): string {
    return symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  /**
   * Maps domain Timeframe to Biquote API interval query parameter.
   * Valid intervals on Biquote: "1m", "5m", "15m", "30m", "1h", "4h", "1d"
   */
  public mapTimeframeToInterval(tf: Timeframe): string {
    switch (tf) {
      case '1M':
        return '1m';
      case '5M':
        return '5m';
      case '15M':
        return '15m';
      case '1H':
        return '1h';
      default:
        return '5m';
    }
  }

  /**
   * Gets duration in milliseconds for a timeframe.
   */
  public getTimeframeDurationMs(tf: Timeframe): number {
    switch (tf) {
      case '1M':
        return 60 * 1000;
      case '5M':
        return 5 * 60 * 1000;
      case '15M':
        return 15 * 60 * 1000;
      case '1H':
        return 60 * 60 * 1000;
    }
  }

  /**
   * Helper that executes HTTP GET across candidate base URLs until one succeeds.
   * Absolutely NO mock fallback. If all candidates fail, errors are preserved and thrown.
   */
  private async fetchWithFallback(endpointPath: string): Promise<{ data: any; latencyMs: number; usedUrl: string }> {
    const candidates = this.getCandidateBaseUrls();
    let lastError: Error | null = null;

    for (const base of candidates) {
      const cleanBase = base.replace(/\/+$/, '');
      const cleanPath = endpointPath.replace(/^\/+/, '');
      const url = `${cleanBase}/${cleanPath}`;
      const startTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const latencyMs = Date.now() - startTime;
          return { data, latencyMs, usedUrl: url };
        }

        lastError = new Error(`HTTP ${response.status} (${response.statusText}) from ${url}`);
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = new Error(`Connection failed to ${url}: ${err.message}`);
      }
    }

    throw new Error(`Biquote Market Data Provider Failure (${endpointPath}): ${lastError?.message || 'All endpoints unreachable'}`);
  }

  /**
   * Fetches real-time validated market snapshot from Biquote REST endpoint.
   * No API key required for Biquote public read endpoints.
   */
  public async getSnapshot(symbol: string): Promise<MarketSnapshot> {
    const cleanSym = this.normalizeSymbol(symbol);
    const { data, latencyMs } = await this.fetchWithFallback(cleanSym);

    if (!data || typeof data.bid !== 'number' || typeof data.ask !== 'number') {
      throw new Error(`Malformed quote response from Biquote for ${cleanSym}: ${JSON.stringify(data)}`);
    }

    const rawTimestamp = data.timestamp || data.lastQuoteAt || data.time;
    const quoteTime = rawTimestamp ? new Date(rawTimestamp).getTime() : Date.now();
    const now = Date.now();
    const isStale = (now - quoteTime) > this.maxStalenessMs;

    const bidPrice = Number(data.bid);
    const askPrice = Number(data.ask);
    const midPrice = Number((data.mid ?? (bidPrice + askPrice) / 2));
    const spread = Number((data.spread ?? (askPrice - bidPrice)));
    const high24h = data.high !== undefined ? Number(data.high) : undefined;
    const low24h = data.low !== undefined ? Number(data.low) : undefined;
    const dayDiffPercent = data.dayDiffPercent !== undefined ? Number(data.dayDiffPercent) : undefined;
    const direction = data.direction === 'UP' || data.direction === 'DOWN' ? data.direction : undefined;
    const marketState = data.marketState || 'open';
    const quoteAgeSeconds = data.quoteAgeSeconds !== undefined ? Number(data.quoteAgeSeconds) : Math.max(0, Math.round((now - quoteTime) / 1000));

    return {
      symbol: symbol.includes('/') ? symbol : `${cleanSym.slice(0, 3)}/${cleanSym.slice(3)}`,
      timestamp: quoteTime,
      bidPrice,
      askPrice,
      midPrice,
      spread,
      high24h,
      low24h,
      dayDiffPercent,
      direction,
      marketState,
      quoteAgeSeconds,
      provider: 'biquote',
      isStale,
      latencyMs,
    };
  }

  /**
   * Fetches multi-timeframe candles from Biquote, strictly distinguishing
   * completed closed candles from the active forming candle.
   */
  public async getCandles(
    symbol: string,
    timeframe: Timeframe,
    count = 100
  ): Promise<CandlesResult> {
    const cleanSym = this.normalizeSymbol(symbol);
    const interval = this.mapTimeframeToInterval(timeframe);
    const durationMs = this.getTimeframeDurationMs(timeframe);
    const now = Date.now();

    const { data } = await this.fetchWithFallback(`${cleanSym}/ohlc?interval=${interval}`);
    const rawBars: any[] = data.bars || [];

    if (!Array.isArray(rawBars) || rawBars.length === 0) {
      throw new Error(`No candle bars returned by Biquote for ${cleanSym} (${interval})`);
    }

    const formattedSymbol = symbol.includes('/') ? symbol : `${cleanSym.slice(0, 3)}/${cleanSym.slice(3)}`;

    let formingCandle: Candle | undefined = undefined;
    const rawClosedCandles: Candle[] = [];

    for (const bar of rawBars) {
      const openTime = new Date(bar.openTime).getTime();
      const closeTime = openTime + durationMs;
      const candle: Candle = {
        symbol: formattedSymbol,
        timeframe,
        openTime,
        closeTime,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume || bar.tickVolume || 0),
        isClosed: !bar.isOpen,
      };

      if (bar.isOpen) {
        formingCandle = candle;
      } else {
        rawClosedCandles.push(candle);
      }
    }

    // Biquote returns bars from newest to oldest; sort ascending (oldest to newest)
    rawClosedCandles.sort((a, b) => a.openTime - b.openTime);

    // Slice to desired count from latest closed
    const targetClosed = rawClosedCandles.slice(-count);

    // Dynamic timeframe-aware staleness threshold:
    // A 1H candle is fresh up to 2.5 hours after its close, not 120s!
    const timeframeStalenessMs = Math.max(this.maxStalenessMs, durationMs * 2.5);

    // Enforce zero-lookahead bias, monotonicity, and non-staleness validation
    const validation = validateCandleSeries(targetClosed, {
      currentTimeMs: now,
      maxAllowedStalenessMs: timeframeStalenessMs,
      allowUnclosedCurrentBar: false,
      clockSkewToleranceMs: 5000,
    });

    const isStale = !validation.isValid && validation.errors.some((e) => e.includes('Stale'));

    return {
      closedCandles: validation.cleanCandles,
      formingCandle,
      timeframe,
      symbol: formattedSymbol,
      isStale,
      fetchedAt: now,
    };
  }

  /**
   * Health verification check for Biquote endpoint
   */
  public async checkHealth(symbol = 'XAUUSD'): Promise<MarketDataHealth> {
    const startTime = Date.now();
    try {
      const snapshot = await this.getSnapshot(symbol);
      const latencyMs = Date.now() - startTime;
      return {
        status: snapshot.isStale ? 'STALE' : 'CONNECTED',
        latencyMs,
        lastUpdate: snapshot.timestamp,
        providerName: 'biquote',
        bidPrice: snapshot.bidPrice,
        askPrice: snapshot.askPrice,
        midPrice: snapshot.midPrice,
        spread: snapshot.spread,
        high24h: snapshot.high24h,
        low24h: snapshot.low24h,
        dayDiffPercent: snapshot.dayDiffPercent,
        direction: snapshot.direction,
        marketState: snapshot.marketState,
      };
    } catch (err: any) {
      return {
        status: 'DISCONNECTED',
        latencyMs: Date.now() - startTime,
        lastUpdate: 0,
        providerName: 'biquote',
        error: err.message,
      };
    }
  }
}
