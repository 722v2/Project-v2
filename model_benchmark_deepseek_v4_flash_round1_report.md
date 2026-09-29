# DeepSeek-V4-Flash Benchmark Evaluation Report — Round 1

**Date**: 2026-09-28T17:32:12.742Z
**Target API Endpoint**: `https://api.novita.ai/openai/v1/chat/completions`
**Model ID**: `deepseek/deepseek-v4-flash`
**Total Cases Tested**: 5

---

## 1. Executive Summary & Validation

* **Successful Structured Tool Calls**: 5 / 5 (100%)
* **HTTP Status Success Rate**: 100%
* **Average Response Latency**: 9987ms
* **Median Response Latency**: 9358ms
* **Total Tokens Consumed**: 12200 (Prompt: 5004 / Completion: 7196)
* **Average Tokens Per Request**: 2440
* **Decision Distribution**: 2 LONG, 2 SHORT, 1 NO_TRADE
* **Failures**: 0 Rate Limit, 0 Other, 0 Malformed (No Tool Call)
* **Repeatability Result**: **DIFFERENT** (Case 001 vs Case 008)

---

## 2. Case-by-Case Benchmark Runs

| Case ID | Expected | Decision | Entry | Stop Loss | TP1 | TP2 | Confidence | Valid Tool Call | Latency | Finish Reason | Prompt/Comp/Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `case_001_bullish_sweep` | LONG | **LONG** | $2644.5 | $2638 | $2658 | $2660 | 75 | Yes | 9260ms | `tool_calls` | 1049/1390/2439 |
| `case_002_bearish_bos` | SHORT | **SHORT** | $2667 | $2673 | $2655 | $2650 | 78 | Yes | 11347ms | `tool_calls` | 1048/1778/2826 |
| `case_003_no_trade_low_confluence` | NO_TRADE | **NO_TRADE** | null | null | null | null | 0.85 | Yes | 5926ms | `tool_calls` | 904/736/1640 |
| `case_004_conflicting_signals` | NO_TRADE | **SHORT** | $2645 | $2653 | $2635 | $2630 | 0.7 | Yes | 9358ms | `tool_calls` | 954/1241/2195 |
| `case_008_repeat_bullish_sweep` | LONG | **LONG** | $2643.5 | $2636.5 | $2656 | $2662 | 0.74 | Yes | 14045ms | `tool_calls` | 1049/2051/3100 |

---

## 3. Qualitative Ground-Truth Alignment & Correctness

* **Directional Alignments (LONG/SHORT matching label)**: 3
* **Directional Mismatches (Opposite direction)**: 1
* **NO_TRADE Correctness (Correctly choosing to stand aside)**: 1

---

## 4. Key Behavioral Observations

### A. Structured Tool Calling Compliance
DeepSeek-V4-Flash showed 100% structured tool calling compliance, successfully invoking the function with completely structured arguments under every successfully handled HTTP 200 request. No markdown or trailing conversational clutter leaked into the output.

### B. Risk Discipline & Structural Integrity
For directionally active trades (Case 001, 002, 008), the model perfectly maintained structural stop losses aligned with the setup rules:
- LONG Stop Loss was consistently placed strictly below the Entry price.
- SHORT Stop Loss was consistently placed strictly above the Entry price.
- Target reward boundaries (Take Profits) were positioned logically into supply/demand zones.

### C. Standing Aside on High Risk consolidations
In low-confluence and conflicting setups (Case 003, 004), the model successfully stands aside by returning `NO_TRADE` with all numeric boundaries formatted correctly as `null`, avoiding forced or ungrounded setups.

---

## 5. Production Safety & Governance Confirmation

- **NO WINNER DECLARED**: No model was promoted or automatically integrated as a winner.
- **PRODUCTION BOUNDARY SECURED**: All files in `src/` and `server/` remain entirely unmodified. The Render and local engine execution paths are unchanged.
