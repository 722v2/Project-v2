# GOLD AI BOT V2 — MASTER ARCHITECTURAL SPECIFICATION
**Project Name:** `project-V2`  
**Instrument:** `XAU/USD` (Gold Spot USD)  
**Philosophy:** *High Signal Quality Without Signal Starvation*

---

## 1. High-Level Architectural Overview

`project-V2` is engineered from scratch as an institutional-grade quantitative market analysis and trade lifecycle management platform. The architecture cleanly separates 6 core domains:
1. **Market Data Abstraction & MTF Ingestion:** Pure provider interfaces, clock alignment, anomaly rejection, and strictly closed candle ingestion.
2. **Deterministic Technical Analysis & Regime Engine:** Pure functional calculations of Market Structure (BOS/CHOCH/Swings), Liquidity (Sweeps, EQH/EQL), Institutional POIs (OB, Breakers, Mitigations), Imbalances (FVG, iFVG), and Momentum (MACD, RSI, EMA slope).
3. **Setup Identification & Deduplication Layer:** Deterministic setup fingerprinting (`setup_id`) guaranteeing "One Setup → One Lifecycle" across micro-price fluctuations.
4. **Evidence-Based Scoring Engine:** Non-binary confluence evaluation separating *Hard Invalidation* (fatal safety blocks) from *Soft Supporting Evidence* (gradient quality weights), eliminating V1's cascading rejection starvation.
5. **Dynamic Risk Engine:** Dashboard-driven capital calculation ($100 starting balance, 1% risk = $1 risk unit), pip/dollar SL normalization, dynamic lot sizing, and RR enforcement.
6. **Trade & Position Lifecycle Monitoring Subsystem:** An independent, asynchronous monitoring engine tracking every active trade every 5 seconds (MFE, MAE, TP1 partials, TP2 runner, BE adjustments, structural invalidation, and 3-tier Reversal Watch).

```
                      +---------------------------------------+
                      |       Market Data Providers           |
                      |   (BiquoteProvider / Replay / Mock)   |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |      Data Validation & Anti-Stale     |
                      |     (Closed Candles Only, No Leaks)   |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |  Deterministic Analysis & Regimes     |
                      | (Structure, Sweeps, FVG, OB, Momentum)|
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |   6 Approved Strategy Evaluators      |
                      |  (S1: Sweep, S2: BOS, S3: FVG, etc.)  |
                      +---------------------------------------+
                                          |
                                          v
        +---------------------------------+---------------------------------+
        |                                                                   |
        v                                                                   v
+-----------------------------+                             +-----------------------------+
|    Deduplication Engine     |                             |   Evidence Scoring Engine   |
| (Setup ID Fingerprint, POI) |                             | (Hard Invalidation vs Soft) |
+-----------------------------+                             +-----------------------------+
        |                                                                   |
        +---------------------------------+---------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |              Risk Engine              |
                      |  (Capital, Sizing, SL Bounds, Min RR) |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |   AI Reasoning & Context Synthesis    |
                      | (Explainability, News Context, Bias)  |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |           Signal Generation           |
                      |   (Persisted in Supabase & Queued)    |
                      +---------------------------------------+
                                          |
                    +---------------------+---------------------+
                    |                                           |
                    v                                           v
+---------------------------------------+   +---------------------------------------+
|    Trade Monitoring Subsystem (5s)    |   |    Telegram Notification Engine       |
| (MFE, MAE, TP1/2, SL, Reversal Watch) |   | (Rate-Limited, Throttled, Event-Only) |
+---------------------------------------+   +---------------------------------------+
                    |
                    v
+---------------------------------------+
|  Immutable Outcome & Experience Store |
|    (Cluster Keys, Advisory Feedback)  |
+---------------------------------------+
```

---

## 2. Zero-Lookahead Bias Guarantee

In financial algorithmic research and live trading, lookahead bias (peeking into future bars or evaluating an incomplete bar as confirmed fact) ruins backtests and induces live execution disasters.

`project-V2` strictly enforces:
1. **Candle Completion Guard:** Only candles with `is_closed === true` (where current system time $> \text{candle.close\_time}$) are ingested into the deterministic feature pipeline.
2. **Current Candle Price Exclusivity:** The active running candle's price is *only* observed by the Trade Monitoring Subsystem to evaluate intrabar SL/TP touches on previously finalized positions. It never forms swing points, BOS, or confirmed candle patterns.
3. **Clock-Synchronized Backtesting Engine:** In replay/backtest mode, historical candles are fed strictly in ascending chronological order with monotonic timestamp incrementation.

---

## 3. Subsystem Breakdown & Module Boundaries

| Package / Module | Responsibility | Inbound Dependencies | Outbound Dependencies |
| :--- | :--- | :--- | :--- |
| `packages/market-data` | Ingests XAU/USD candles via Biquote REST/WS. Validates gaps, timestamps, latency. | Network, Config | Domain Candle Types |
| `packages/analysis` | Pure math: Swing high/low, BOS/CHOCH, Order Blocks, FVGs, Premium/Discount, MACD, RSI, EMA. | Domain Candle Types | Feature Vectors |
| `packages/strategies` | Implements the 6 approved strategy modules (Liquidity Sweep, BOS Pullback, FVG, OB Reaction, Confluence, Range Reversal). | Analysis, Indicators | Candidate Setups |
| `packages/deduplication` | Calculates deterministic `setup_id`, evaluates POI spatial collision, manages setup state machine. | Candidate Setups, DB | Unique Setups, Prevention Logs |
| `packages/scoring` | Calculates 0–100 quality score across 12 weighted vectors. Separates hard invalidations from soft weights. | Setups, Analysis, News | Validated Signals, Rejection Records |
| `packages/risk` | Applies user account capital & risk rules. Computes lot size, pip values, dollar risk, and SL validation. | Candidate Setups, Risk Config | Sized Positions |
| `packages/news` | Tracks scheduled macroeconomic releases (CPI, NFP, FOMC) and computes temporal impact multipliers. | External APIs / DB | News Context Objects |
| `packages/monitoring` | Runs continuous 5s tracking of active setups/trades. Measures MFE/MAE, detects TP1/TP2/SL/BE, Reversal Watch. | Live Ticks, Active Trades | State Transitions, Immutable Outcomes |
| `packages/notifications` | Rate-limited Telegram publisher for state transition events. | Signal & Trade Events | Telegram Bot API |
| `packages/experience` | Evaluates historical outcomes clustered by feature similarity ($N \ge 30$) to advise scoring. | Trade Outcomes | Advisory Score Multipliers |
| `packages/execution` | Abstract broker gateway. **STRICTLY DISABLED (`AUTO_TRADING=false`)** during current phase. | Sized Orders | Simulated Execution / Broker |
