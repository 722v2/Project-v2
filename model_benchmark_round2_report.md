# GOLD AI BOT V2 — OPENROUTER MODEL EVALUATION ROUND 2 REPORT

**Date**: 2026-09-28T14:55:26.066Z
**OpenRouter Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
**Total Requests Executed**: 15

---

## 1. Model Availability

- `inclusionai/ling-3.0-flash-fin:free`: **Available**
- `nvidia/nemotron-3-ultra-550b-a55b:free`: **Available**
- `nvidia/nemotron-3-super-120b-a12b:free`: **Available**

---

## 2. API Reliability & Structured Output Performance

| Model ID | Success / Total | 429 Errors | Timeout Errors | Native Structured Output Supported | Native Success | Fallback JSON Success | Schema Validity % | Avg Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `inclusionai/ling-3.0-flash-fin:free` | 0/5 | 5 | 0 | No | 0 | 0 | 0% | 2152ms |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 0/5 | 5 | 0 | No | 0 | 0 | 0% | 2059ms |
| `nvidia/nemotron-3-super-120b-a12b:free` | 0/5 | 5 | 0 | No | 0 | 0 | 0% | 2108ms |

---

## 3. Trading Outputs

| Case | Model | Expected | Model Decision | Entry | SL | TP1 | TP2 | Confidence | Setup Quality | Schema Valid | Latency | Error |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `case_001_bullish_sweep` | `inclusionai/ling-3.0-flash-fin:free` | LONG | **INVALID** | null | null | null | null | 0 | NONE | No | 2244ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_002_bearish_bos` | `inclusionai/ling-3.0-flash-fin:free` | SHORT | **INVALID** | null | null | null | null | 0 | NONE | No | 2336ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_003_no_trade_low_confluence` | `inclusionai/ling-3.0-flash-fin:free` | NO_TRADE | **INVALID** | null | null | null | null | 0 | NONE | No | 2059ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_004_conflicting_signals` | `inclusionai/ling-3.0-flash-fin:free` | NO_TRADE | **INVALID** | null | null | null | null | 0 | NONE | No | 2061ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_008_repeat_bullish_sweep` | `inclusionai/ling-3.0-flash-fin:free` | LONG | **INVALID** | null | null | null | null | 0 | NONE | No | 2061ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_001_bullish_sweep` | `nvidia/nemotron-3-ultra-550b-a55b:free` | LONG | **INVALID** | null | null | null | null | 0 | NONE | No | 2064ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_002_bearish_bos` | `nvidia/nemotron-3-ultra-550b-a55b:free` | SHORT | **INVALID** | null | null | null | null | 0 | NONE | No | 2057ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_003_no_trade_low_confluence` | `nvidia/nemotron-3-ultra-550b-a55b:free` | NO_TRADE | **INVALID** | null | null | null | null | 0 | NONE | No | 2064ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_004_conflicting_signals` | `nvidia/nemotron-3-ultra-550b-a55b:free` | NO_TRADE | **INVALID** | null | null | null | null | 0 | NONE | No | 2060ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_008_repeat_bullish_sweep` | `nvidia/nemotron-3-ultra-550b-a55b:free` | LONG | **INVALID** | null | null | null | null | 0 | NONE | No | 2050ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_001_bullish_sweep` | `nvidia/nemotron-3-super-120b-a12b:free` | LONG | **INVALID** | null | null | null | null | 0 | NONE | No | 2056ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_002_bearish_bos` | `nvidia/nemotron-3-super-120b-a12b:free` | SHORT | **INVALID** | null | null | null | null | 0 | NONE | No | 2056ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_003_no_trade_low_confluence` | `nvidia/nemotron-3-super-120b-a12b:free` | NO_TRADE | **INVALID** | null | null | null | null | 0 | NONE | No | 2056ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_004_conflicting_signals` | `nvidia/nemotron-3-super-120b-a12b:free` | NO_TRADE | **INVALID** | null | null | null | null | 0 | NONE | No | 2317ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |
| `case_008_repeat_bullish_sweep` | `nvidia/nemotron-3-super-120b-a12b:free` | LONG | **INVALID** | null | null | null | null | 0 | NONE | No | 2056ms | HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"head |

---

## 4. Behavioral Observations

### Model: `inclusionai/ling-3.0-flash-fin:free`
- **Response Integrity**: 0/5 API calls executed successfully.
- **Structured Output Compliance**: Native JSON support was **not supported (fallback JSON invoked)**; resulting in **0%** final valid schema compliance.
- **Trade Frequency & Decisions**: generated 0 LONG, 0 SHORT, and 0 NO_TRADE decisions.
- **Accuracy & Support**: reached **0%** alignment with the expected quantitative ground truth decisions.

### Model: `nvidia/nemotron-3-ultra-550b-a55b:free`
- **Response Integrity**: 0/5 API calls executed successfully.
- **Structured Output Compliance**: Native JSON support was **not supported (fallback JSON invoked)**; resulting in **0%** final valid schema compliance.
- **Trade Frequency & Decisions**: generated 0 LONG, 0 SHORT, and 0 NO_TRADE decisions.
- **Accuracy & Support**: reached **0%** alignment with the expected quantitative ground truth decisions.

### Model: `nvidia/nemotron-3-super-120b-a12b:free`
- **Response Integrity**: 0/5 API calls executed successfully.
- **Structured Output Compliance**: Native JSON support was **not supported (fallback JSON invoked)**; resulting in **0%** final valid schema compliance.
- **Trade Frequency & Decisions**: generated 0 LONG, 0 SHORT, and 0 NO_TRADE decisions.
- **Accuracy & Support**: reached **0%** alignment with the expected quantitative ground truth decisions.


---

## 5. Production Governance Confirmation

- **NO WINNER DECLARED**: No candidate model has been selected as the official model.
- **NO AUTOMATIC DEPLOYMENT**: Production configs and trading logics remain completely untouched.
