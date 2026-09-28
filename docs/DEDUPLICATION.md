# SETUP IDENTITY & DEDUPLICATION ARCHITECTURE
**Principle:** *One Setup → One Lifecycle*

---

## 1. The Core Failure in V1

In the previous system (V1), signals were generated whenever an algorithmic condition was true on a given bar. When price hovered around a 5-minute Order Block or consolidated inside a Fair Value Gap over 15–30 minutes, slight micro-fluctuations (e.g. gold moving between 2342.10 and 2342.60) caused the bot to trigger 3 to 7 separate BUY signals for the exact same market idea.

V1 attempted to band-aid this with simple time cooldowns (e.g. "don't alert for 10 minutes"). This failed because:
1. After 10 minutes, if the price was still in the zone, another duplicate signal was dispatched.
2. If a genuine new setup on another timeframe or in the opposite direction appeared within 10 minutes, it was erroneously silenced.

---

## 2. The V2 Solution: Deterministic Setup Identity (`setup_id`)

In `project-V2`, a setup is not an isolated tick event; it is an identified spatial-structural opportunity. 

Every candidate setup is assigned a deterministic SHA-256 fingerprint generated from 6 immutable spatial properties:

$$\text{setup\_id} = \text{SHA256}(\text{strategy} \parallel \text{direction} \parallel \text{timeframe} \parallel \text{anchor\_swing\_id} \parallel \text{poi\_zone\_bucket} \parallel \text{anchor\_bar\_time})$$

### Components of the Fingerprint:
1. **`strategy`**: e.g., `liquidity_sweep_reversal`, `bos_pullback_continuation`.
2. **`direction`**: `BUY` or `SELL`.
3. **`timeframe`**: `1M`, `5M`, `15M`, `1H`.
4. **`anchor_swing_id`**: The unique identifier of the swing high/low that was swept or broken to create this setup.
5. **`poi_zone_bucket`**: The Price of Interest zone rounded to a spatial tolerance (default: $\$0.50$ increments for XAU/USD). For example, any POI between $\$2342.00$ and $\$2342.49$ is bucketed into `2342.00`.
6. **`anchor_bar_time`**: The close timestamp of the structure-creating displacement bar.

### Deduplication Rule:
When the scanner evaluates a candidate setup:
1. It generates the candidate's `setup_id`.
2. It queries active and pending setups in memory/Supabase.
3. If an active setup with the same `setup_id` or an overlapping POI zone ($\Delta \text{Price} \le \$0.50$) within the active window (e.g., 60 minutes) already exists:
   - **No new signal is created.**
   - A row is appended to `duplicate_preventions` documenting the attempted detection, the existing setup ID, price distance, and timestamp.
   - The existing setup's `last_updated_at` is refreshed.
4. Only when a setup has reached a terminal state (`CLOSED`, `INVALIDATED`, `EXPIRED`, `SL_REACHED`, `TP2_REACHED`) or when a structurally distinct event occurs can a new setup be registered.

---

## 3. Setup Lifecycle State Machine

A setup progresses through an explicit, strictly monitored lifecycle:

```
[ DETECTED ] 
      |
      v
[ WATCHING ] ---------> (Invalidated / Cancelled before entry) ------> [ INVALIDATED ]
      |
      v
[ CONFIRMED ]
      |
      v
[ SIGNAL_SENT ]
      |
      v
[ ACTIVE ]
      |
      +-------------> [ BREAKEVEN / PARTIAL_CLOSED ]
      |                         |
      +-------------> [ REVERSAL_WATCH ]
      |
      v
[ TERMINAL STATES ]
      ├── [ TP1_REACHED ] (Runner active to TP2)
      ├── [ TP2_REACHED ] (Fully closed)
      ├── [ SL_REACHED ]
      ├── [ EARLY_EXIT ] (Manual / Level 3 reversal exit)
      └── [ EXPIRED ]
```

---

## 4. Preventing Over-Aggressive Deduplication

Deduplication must never suppress genuine independent opportunities. A setup is considered genuinely new if:
- The anchor swing point is different (e.g. a new liquidity pool was swept).
- The strategy type differs (e.g. a range reversal vs. a trend continuation).
- The timeframe of origin differs with non-overlapping structural anchors.
- The previous setup was structurally invalidated (e.g. price broke beyond the POI invalidation boundary, resetting the structural context).
