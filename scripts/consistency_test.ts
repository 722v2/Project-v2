/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BiquoteMarketDataProvider } from '../src/packages/market-data/biquote_provider.ts';

async function runConsistencyTest() {
  console.log('=== GOLD AI BOT V2 — DATA CONSISTENCY & LIVE INTEGRATION AUDIT ===');
  console.log('Timestamp:', new Date().toISOString());

  const provider = new BiquoteMarketDataProvider();

  // 1. Raw Biquote Fetch
  const rawStart = Date.now();
  const rawRes = await fetch('https://biquote.io/api/XAUUSD');
  const rawData = await rawRes.json();
  const rawDuration = Date.now() - rawStart;

  console.log('\n[1] RAW BIQUOTE API (/api/XAUUSD)');
  console.log('  Status:', rawRes.status);
  console.log('  Symbol:', rawData.symbol);
  console.log('  Bid:', rawData.bid);
  console.log('  Ask:', rawData.ask);
  console.log('  Mid:', rawData.mid);
  console.log('  Spread:', rawData.spread);
  console.log('  Timestamp:', rawData.timestamp || rawData.lastQuoteAt);
  console.log('  Latency:', rawDuration, 'ms');

  // 2. Provider Validated Snapshot
  const snapStart = Date.now();
  const snapshot = await provider.getSnapshot('XAUUSD');
  const snapDuration = Date.now() - snapStart;

  console.log('\n[2] MARKET DATA PROVIDER SNAPSHOT');
  console.log('  Symbol:', snapshot.symbol);
  console.log('  Bid:', snapshot.bidPrice);
  console.log('  Ask:', snapshot.askPrice);
  console.log('  Mid:', snapshot.midPrice);
  console.log('  Spread:', snapshot.spread);
  console.log('  Timestamp:', new Date(snapshot.timestamp).toISOString());
  console.log('  Is Stale:', snapshot.isStale);
  console.log('  Latency:', snapshot.latencyMs, 'ms');

  // 3. Candle Pipelines for 1M, 5M, 15M, 1H
  const timeframes: ('1M' | '5M' | '15M' | '1H')[] = ['1M', '5M', '15M', '1H'];
  const candleSummaries: any[] = [];

  for (const tf of timeframes) {
    const res = await provider.getCandles('XAUUSD', tf, 50);
    const lastClosed = res.closedCandles[res.closedCandles.length - 1];
    const forming = res.formingCandle;

    candleSummaries.push({
      timeframe: tf,
      closedCount: res.closedCandles.length,
      latestClosedOpenTime: new Date(lastClosed.openTime).toISOString(),
      latestClosedCloseTime: new Date(lastClosed.closeTime).toISOString(),
      latestClosedClose: lastClosed.close,
      formingOpenTime: forming ? new Date(forming.openTime).toISOString() : 'None',
      formingCurrentClose: forming?.close,
    });
  }

  console.log('\n[3] CANDLE PIPELINES (1M, 5M, 15M, 1H)');
  for (const cs of candleSummaries) {
    console.log(`  [${cs.timeframe}] Closed bars: ${cs.closedCount}`);
    console.log(`       Latest Closed: O=${cs.latestClosedOpenTime} C=${cs.latestClosedCloseTime} ClosePrice=$${cs.latestClosedClose}`);
    console.log(`       Forming Bar: O=${cs.formingOpenTime} CurrentPrice=$${cs.formingCurrentClose}`);
  }

  // 4. Consistency Verification
  const quoteMid = snapshot.midPrice;
  const candle1mClose = candleSummaries[0].formingCurrentClose || candleSummaries[0].latestClosedClose;
  const delta = Math.abs(quoteMid - candle1mClose);

  console.log('\n[4] CONSISTENCY CHECK');
  console.log('  Quote Mid Price:', quoteMid);
  console.log('  1M Candle Mark Price:', candle1mClose);
  console.log('  Price Delta:', delta.toFixed(4));
  console.log('  Consistent (Delta < $1.50):', delta < 1.50 ? 'PASS' : 'FAIL');

  console.log('\n=== AUDIT COMPLETE ===');
}

runConsistencyTest().catch(console.error);
