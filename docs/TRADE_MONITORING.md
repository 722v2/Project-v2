# TRADE & POSITION MONITORING SUBSYSTEM
**Principle:** *Continuous Independent Lifecycle Tracking with Zero Post-Facto Revision*

---

## 1. Separation of Concerns

Signal generation answers: **"Is there an actionable trade opportunity right now?"**  
Trade monitoring answers: **"What is the precise health, risk, and excursion state of the active position right now?"**

In `project-V2`, these two engines run independently:
- **Scanner Engine:** Runs every 60 seconds across timeframes.
- **Trade Monitoring Engine:** Runs continuously (every 5 seconds) against live bid/ask/mid ticks and 1-minute updates.

---

## 2. Monitored Real-Time Metrics

For every active trade, the monitoring engine computes and persists:
1. **Unrealized P&L ($):** Based on current mark price and position size.
2. **Current R-Multiple ($R$):**
   $$\text{Current } R = \frac{\text{Current Price} - \text{Entry Price}}{\text{Entry Price} - \text{Stop Loss}} \quad (\text{for BUY})$$
3. **MFE (Maximum Favorable Excursion):** The highest favorable price and R-multiple achieved since entry. Tracks peak potential profit.
4. **MAE (Maximum Adverse Excursion):** The deepest drawdown price and negative R-multiple experienced since entry. Essential for evaluating stop-loss efficiency.
5. **Distance to Targets:** Real-time dollar and pip distance to $\text{SL}$, $\text{TP}_1$, and $\text{TP}_2$.
6. **Elapsed Duration:** Setup age and active holding time.

---

## 3. TP1, TP2, and Stop Management Flow

```
Entry Fill
    │
    ▼
Monitoring (Tick by Tick)
    │
    ├── Price crosses TP1:
    │     ├── Mark `tp1_hit = true`
    │     ├── Record `tp1_timestamp` and price
    │     ├── Trigger Partial Close (e.g. 50% locked)
    │     ├── Move SL to Breakeven (Entry + buffer)
    │     └── Emit Event: `TP1_REACHED`
    │
    ├── Price crosses TP2:
    │     ├── Mark `tp2_hit = true`
    │     ├── Close remaining runner position
    │     └── Emit Event: `TP2_REACHED` (Terminal)
    │
    └── Price crosses SL:
          ├── Mark `sl_hit = true`
          ├── Record `sl_timestamp` and exit price
          └── Emit Event: `SL_REACHED` (Terminal)
```

---

## 4. Reversal & Early Exit Manager (3-Tier Protocol)

Rather than abruptly closing trades or letting winners turn into full stop-outs during institutional trend shifts, the system implements a graded 3-tier protocol:

### Level 1 — Trend Changing
- **Condition:** Higher timeframe (15M/1H) shows initial deceleration or minor opposing pullback, but position structure on the setup timeframe remains intact.
- **Action:** `DO NOTHING`. Maintain original trade plan.

### Level 2 — Trend Change + Position Weakening (`REVERSAL_WATCH`)
- **Condition:** Setup timeframe experiences an opposing CHOCH or aggressive displacement against the position, and current $R < 0.5$.
- **Action:** Transition position status to `REVERSAL_WATCH`.
- **Alert:** Dispatch advisory update to Dashboard and Telegram. Do not close trade prematurely.

### Level 3 — Confirmed Opposite High-Conviction Setup (`EARLY_EXIT`)
- **Condition:** A confirmed, high-scoring opposite strategy setup triggers on the same or higher timeframe while the existing trade is in `REVERSAL_WATCH`.
- **Action:** Transition position status to `EARLY_EXIT_RECOMMENDED`. In manual mode, alerts the trader to secure remaining profits/minimize loss. In future automated execution, initiates market exit before the hard SL is hit.
