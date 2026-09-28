# EVIDENCE-BASED SIGNAL SCORING & ANTI-STARVATION ENGINE
**Principle:** *High Signal Quality Without Cascading Filter Rejection*

---

## 1. Why V1 Failed: The "Strict but Stupid" Trap

In V1, every technical condition was written as a boolean gate:
```typescript
// V1 Anti-pattern (DO NOT DO THIS)
if (!hasBullishBOS) return NO_TRADE;
if (!hasBullishFVG) return NO_TRADE;
if (!isMACDBullish) return NO_TRADE; // Neutral MACD kills valid setup!
if (!isRSIOversold) return NO_TRADE; // RSI at 48 kills valid setup!
if (!isFib618Retracement) return NO_TRADE; // 50% pullbacks ignored!
if (upcomingNewsInNext6Hours) return NO_TRADE; // All setups halted for half the day!
```
When 10 to 15 independent boolean gates are stacked, even a setup with 90% institutional confluence has an overwhelming probability of failing at least one gate. The result was **signal starvation**: weeks with zero trades, followed by arbitrary relaxing of filters that ruined edge consistency.

---

## 2. V2 Architecture: Hard Invalidation vs. Soft Supporting Evidence

`project-V2` strictly divides all conditions into two categories:

### A. Hard Invalidation Conditions (Binary Safety Gates)
A setup is ONLY rejected outright if it violates fundamental physical or risk safety parameters:
1. **Corrupted or Stale Data:** Timestamps out of bounds, missing candles, or provider latency $> 120\text{s}$.
2. **Invalid Price Structure:** e.g., A BUY setup where Stop Loss $\ge$ Entry Price.
3. **Unacceptable Risk / Distance:** Stop loss distance exceeds maximum allowable threshold (e.g. $> \$12.00$ on Gold).
4. **Sub-minimum Risk/Reward:** Calculated $\text{RR}_1 < \text{Min RR}$ (e.g. $< 1.50$).
5. **Active Invalidation Event:** Price has already traded through the invalidation boundary of the POI before entry fill.

### B. Soft Supporting Evidence (Gradient Weighting: 0–100 Scale)
All other factors provide additive or subtractive confidence weights. If MACD is neutral, it simply contributes 0 points instead of positive momentum points; **it never kills the setup.**

---

## 3. The 100-Point Evidence Weighting Matrix

| Evidence Factor | Max Points | Weight Class | Description |
| :--- | :---: | :--- | :--- |
| **Market Structure Alignment** | 20 | Primary Core | BOS / CHOCH alignment with trade direction on 15M/1H. |
| **Liquidity Event Quality** | 18 | Primary Core | External/internal liquidity sweep magnitude and rejection wick ratio. |
| **POI / Zone Validity** | 15 | Institutional | Order block or FVG displacement strength and cleanliness. |
| **Multi-Timeframe Confluence** | 12 | Contextual | 1H trend alignment, 15M structure, 5M trigger harmony. |
| **Risk/Reward Attractiveness** | 10 | Mathematical | Higher score for cleanly reachable $\text{RR}_1 \ge 2.0$ with nearby structural liquidity targets. |
| **MACD Momentum Vector** | 7 | Supporting Momentum | Histogram expansion, zero-line crossover, momentum acceleration. Neutral = 3 pts. |
| **RSI Context & Divergence** | 6 | Supporting Momentum | Value range (40–60 in trend continuation, <30/ >70 with divergence in reversals). Neutral = 3 pts. |
| **EMA Dynamic Alignment** | 5 | Supporting Trend | Slope and positioning relative to 20/50 EMA on 15M. |
| **Premium / Discount Location** | 4 | Contextual | Buying in Discount (<50% of dealing range), Selling in Premium (>50%). |
| **News / Volatility Environment** | 3 | Risk Context | Clean macro window provides bonus points; near-term high impact applies soft penalty, not a hard kill. |
| **TOTAL** | **100** | | Minimum threshold for actionable signal: **65 Points**. |

---

## 4. Explainable Score Output

Every signal and every rejected setup generates an explainable breakdown:
```json
{
  "total_score": 78,
  "confidence": "HIGH",
  "breakdown": {
    "market_structure": 18,
    "liquidity_event": 16,
    "poi_validity": 14,
    "mtf_confluence": 9,
    "risk_reward": 8,
    "macd_momentum": 4,
    "rsi_context": 3,
    "ema_alignment": 4,
    "premium_discount": 2
  },
  "verdict": "ACTIONABLE_SIGNAL"
}
```
If a setup scores 61 (below the 65 threshold), it is logged to `rejected_setups` with classification `SOFT_EVIDENCE_INSUFFICIENT`, allowing data analysis on exactly which factors suppressed the setup.
