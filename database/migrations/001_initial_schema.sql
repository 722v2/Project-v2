-- ==============================================================================
-- GOLD AI BOT V2 — MASTER SUPABASE PERSISTENCE SCHEMA (MIGRATION 001)
-- Instrument: XAU/USD
-- Schema Version: 2.0.0
-- Principles:
--   1. Immutability of historical trade outcomes and signal evaluations.
--   2. Append-only event logs for trade-state transitions and setup lifecycles.
--   3. First-class no-trade / rejection logging for anti-starvation observability.
--   4. Explicit setup identity and duplicate prevention audit records.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. SYSTEM VERSIONS & AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_version VARCHAR(32) NOT NULL,
    analysis_version VARCHAR(32) NOT NULL,
    risk_config_version VARCHAR(32) NOT NULL,
    monitoring_version VARCHAR(32) NOT NULL,
    experience_version VARCHAR(32) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    actor VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_component_created ON audit_logs(component, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. MARKET DATA & SNAPSHOTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAU/USD',
    timestamp TIMESTAMPTZ NOT NULL,
    bid_price NUMERIC(12, 4) NOT NULL,
    ask_price NUMERIC(12, 4) NOT NULL,
    mid_price NUMERIC(12, 4) NOT NULL,
    spread NUMERIC(8, 4) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    latency_ms INTEGER,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_timestamp ON market_snapshots(timestamp DESC);

CREATE TABLE IF NOT EXISTS candles_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAU/USD',
    timeframe VARCHAR(8) NOT NULL, -- '1M', '5M', '15M', '1H'
    open_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(12, 4) NOT NULL,
    high NUMERIC(12, 4) NOT NULL,
    low NUMERIC(12, 4) NOT NULL,
    close NUMERIC(12, 4) NOT NULL,
    volume NUMERIC(16, 4) NOT NULL DEFAULT 0,
    is_closed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candle_symbol_tf_opentime UNIQUE (symbol, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS idx_candles_tf_time ON candles_metadata(timeframe, close_time DESC);

-- ------------------------------------------------------------------------------
-- 3. NEWS EVENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name VARCHAR(128) NOT NULL,
    country VARCHAR(8) NOT NULL DEFAULT 'USD',
    impact VARCHAR(16) NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW', 'NONE'
    scheduled_time TIMESTAMPTZ NOT NULL,
    actual_value VARCHAR(32),
    forecast_value VARCHAR(32),
    previous_value VARCHAR(32),
    source VARCHAR(64) NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_events_time ON news_events(scheduled_time DESC);

-- ------------------------------------------------------------------------------
-- 4. MARKET REGIMES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_regimes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAU/USD',
    timeframe VARCHAR(8) NOT NULL DEFAULT '15M',
    regime VARCHAR(32) NOT NULL, -- 'TREND_UP', 'TREND_DOWN', 'RANGE', 'TRANSITION', 'UNCLEAR'
    confidence NUMERIC(5, 2) NOT NULL,
    adx_value NUMERIC(6, 2),
    ema_slope NUMERIC(8, 4),
    range_high NUMERIC(12, 4),
    range_low NUMERIC(12, 4),
    context_notes TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_regimes_eval ON market_regimes(evaluated_at DESC);

-- ------------------------------------------------------------------------------
-- 5. SETUPS & SETUP IDENTITY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS setups (
    setup_id VARCHAR(128) PRIMARY KEY, -- Deterministic Hash/Fingerprint
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAU/USD',
    strategy VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL, -- 'BUY', 'SELL'
    primary_timeframe VARCHAR(8) NOT NULL,
    poi_zone_low NUMERIC(12, 4) NOT NULL,
    poi_zone_high NUMERIC(12, 4) NOT NULL,
    anchor_price NUMERIC(12, 4) NOT NULL,
    anchor_timestamp TIMESTAMPTZ NOT NULL,
    structure_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    liquidity_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    quality_score NUMERIC(5, 2) NOT NULL,
    lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'DETECTED',
    -- 'DETECTED', 'WATCHING', 'CONFIRMED', 'SIGNAL_SENT', 'ACTIVE', 'MONITORING', 'TP1_REACHED', 'TP2_REACHED', 'SL_REACHED', 'BREAKEVEN', 'PARTIAL_CLOSED', 'INVALIDATED', 'EXPIRED', 'CLOSED'
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ NOT NULL,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setups_lifecycle ON setups(lifecycle_state, last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_setups_strategy_dir ON setups(strategy, direction);

CREATE TABLE IF NOT EXISTS setup_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setup_id VARCHAR(128) NOT NULL REFERENCES setups(setup_id) ON DELETE CASCADE,
    from_state VARCHAR(32) NOT NULL,
    to_state VARCHAR(32) NOT NULL,
    trigger_price NUMERIC(12, 4),
    trigger_reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setup_events_id ON setup_events(setup_id, event_timestamp ASC);

-- ------------------------------------------------------------------------------
-- 6. SIGNALS & SIGNAL UPDATES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
    signal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setup_id VARCHAR(128) NOT NULL REFERENCES setups(setup_id),
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAU/USD',
    strategy VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    timeframe VARCHAR(8) NOT NULL,
    entry_price NUMERIC(12, 4) NOT NULL,
    stop_loss NUMERIC(12, 4) NOT NULL,
    take_profit_1 NUMERIC(12, 4) NOT NULL,
    take_profit_2 NUMERIC(12, 4) NOT NULL,
    risk_reward_1 NUMERIC(6, 2) NOT NULL,
    risk_reward_2 NUMERIC(6, 2) NOT NULL,
    confidence NUMERIC(5, 2) NOT NULL,
    quality_score NUMERIC(5, 2) NOT NULL,
    market_regime VARCHAR(32) NOT NULL,
    evidence_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    analysis_reasons TEXT[] NOT NULL DEFAULT '{}',
    risk_notes TEXT[] NOT NULL DEFAULT '{}',
    news_context JSONB DEFAULT '{}'::jsonb,
    invalidating_conditions TEXT[] NOT NULL DEFAULT '{}',
    strategy_version VARCHAR(32) NOT NULL,
    analysis_version VARCHAR(32) NOT NULL,
    telegram_message_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_setup_id ON signals(setup_id);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);

CREATE TABLE IF NOT EXISTS signal_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID NOT NULL REFERENCES signals(signal_id) ON DELETE CASCADE,
    update_type VARCHAR(32) NOT NULL, -- 'STATUS_CHANGE', 'TELEGRAM_DISPATCH', 'REVISION'
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. DEDUPLICATION PREVENTIONS AUDIT (CRITICAL V2 REQUIREMENT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duplicate_preventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempted_setup_id VARCHAR(128) NOT NULL,
    existing_setup_id VARCHAR(128) NOT NULL REFERENCES setups(setup_id),
    strategy VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    new_candidate_price NUMERIC(12, 4) NOT NULL,
    existing_poi_zone_low NUMERIC(12, 4) NOT NULL,
    existing_poi_zone_high NUMERIC(12, 4) NOT NULL,
    dedup_reason TEXT NOT NULL,
    prevention_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dedup_existing ON duplicate_preventions(existing_setup_id);
CREATE INDEX IF NOT EXISTS idx_dedup_time ON duplicate_preventions(prevention_timestamp DESC);

-- ------------------------------------------------------------------------------
-- 8. REJECTED SETUPS / NO-TRADE LOGGING (ANTI-STARVATION OBSERVABILITY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rejected_setups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    strategy VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    market_regime VARCHAR(32) NOT NULL,
    candidate_entry NUMERIC(12, 4),
    candidate_sl NUMERIC(12, 4),
    quality_score NUMERIC(5, 2) NOT NULL,
    evidence_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    rejection_classification VARCHAR(16) NOT NULL, -- 'HARD_INVALIDATION', 'SOFT_EVIDENCE_INSUFFICIENT', 'RISK_VIOLATION'
    rejection_reasons TEXT[] NOT NULL,
    risk_evaluation JSONB DEFAULT '{}'::jsonb,
    news_context JSONB DEFAULT '{}'::jsonb,
    setup_identity_hint VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rejected_setups_time ON rejected_setups(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rejected_setups_class ON rejected_setups(rejection_classification);

-- ------------------------------------------------------------------------------
-- 9. TRADES & POSITION MONITORING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    trade_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID NOT NULL REFERENCES signals(signal_id),
    setup_id VARCHAR(128) NOT NULL REFERENCES setups(setup_id),
    symbol VARCHAR(16) NOT NULL DEFAULT 'XAU/USD',
    direction VARCHAR(8) NOT NULL,
    entry_price NUMERIC(12, 4) NOT NULL,
    stop_loss NUMERIC(12, 4) NOT NULL,
    take_profit_1 NUMERIC(12, 4) NOT NULL,
    take_profit_2 NUMERIC(12, 4) NOT NULL,
    planned_risk_usd NUMERIC(10, 2) NOT NULL,
    position_size_lots NUMERIC(8, 2) NOT NULL,
    current_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    -- 'PENDING', 'ACTIVE', 'TP1_REACHED', 'TP2_REACHED', 'SL_REACHED', 'BREAKEVEN', 'PARTIAL_CLOSED', 'MANUALLY_CLOSED', 'INVALIDATED', 'EXPIRED', 'CLOSED'
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(current_status);

CREATE TABLE IF NOT EXISTS trade_positions (
    trade_id UUID PRIMARY KEY REFERENCES trades(trade_id) ON DELETE CASCADE,
    current_market_price NUMERIC(12, 4) NOT NULL,
    current_unrealized_pnl_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_r_multiple NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    distance_to_sl NUMERIC(12, 4) NOT NULL,
    distance_to_tp1 NUMERIC(12, 4) NOT NULL,
    distance_to_tp2 NUMERIC(12, 4) NOT NULL,
    mfe_price NUMERIC(12, 4) NOT NULL, -- Maximum Favorable Excursion
    mfe_r NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    mae_price NUMERIC(12, 4) NOT NULL, -- Maximum Adverse Excursion
    mae_r NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    tp1_hit BOOLEAN NOT NULL DEFAULT FALSE,
    tp1_timestamp TIMESTAMPTZ,
    tp2_hit BOOLEAN NOT NULL DEFAULT FALSE,
    tp2_timestamp TIMESTAMPTZ,
    sl_hit BOOLEAN NOT NULL DEFAULT FALSE,
    sl_timestamp TIMESTAMPTZ,
    is_breakeven BOOLEAN NOT NULL DEFAULT FALSE,
    is_partial_closed BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_watch_status VARCHAR(32) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'REVERSAL_WATCH', 'EARLY_EXIT_RECOMMENDED'
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(trade_id) ON DELETE CASCADE,
    from_state VARCHAR(32) NOT NULL,
    to_state VARCHAR(32) NOT NULL,
    price_at_event NUMERIC(12, 4) NOT NULL,
    realized_r NUMERIC(6, 2),
    event_type VARCHAR(32) NOT NULL, -- 'TP1_HIT', 'TP2_HIT', 'SL_HIT', 'BE_MOVED', 'PARTIAL_CLOSE', 'REVERSAL_WATCH', 'EARLY_EXIT', 'INVALIDATION'
    notes TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_updates_trade ON trade_updates(trade_id, event_timestamp ASC);

-- ------------------------------------------------------------------------------
-- 10. FINAL IMMUTABLE TRADE OUTCOMES (EXPERIENCE & LEARNING INPUTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL UNIQUE REFERENCES trades(trade_id),
    setup_id VARCHAR(128) NOT NULL,
    signal_id UUID NOT NULL,
    strategy VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    entry_price NUMERIC(12, 4) NOT NULL,
    exit_price NUMERIC(12, 4) NOT NULL,
    exit_reason VARCHAR(64) NOT NULL, -- 'TP1', 'TP2', 'SL', 'EARLY_EXIT', 'INVALIDATION', 'EXPIRY', 'MANUAL'
    pnl_usd NUMERIC(12, 2) NOT NULL,
    realized_r NUMERIC(6, 2) NOT NULL,
    mfe_r NUMERIC(6, 2) NOT NULL,
    mae_r NUMERIC(6, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    market_regime VARCHAR(32) NOT NULL,
    news_context JSONB DEFAULT '{}'::jsonb,
    risk_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    strategy_version VARCHAR(32) NOT NULL,
    analysis_version VARCHAR(32) NOT NULL,
    monitoring_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_outcomes_strategy ON trade_outcomes(strategy, realized_r);
CREATE INDEX IF NOT EXISTS idx_trade_outcomes_regime ON trade_outcomes(market_regime);

-- ------------------------------------------------------------------------------
-- 11. DASHBOARD SETTINGS (RISK, ACCOUNT, STRATEGY, SCANNER)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'DEFAULT',
    starting_capital NUMERIC(12, 2) NOT NULL DEFAULT 100.00,
    current_capital NUMERIC(12, 2) NOT NULL DEFAULT 100.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'DEFAULT',
    risk_percent_per_trade NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    max_daily_risk_percent NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
    max_concurrent_trades INTEGER NOT NULL DEFAULT 2,
    max_allowed_sl_distance NUMERIC(8, 2) NOT NULL DEFAULT 12.00,
    min_risk_reward_ratio NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
    max_drawdown_limit_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_settings (
    strategy_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    min_confidence NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
    max_active_setups INTEGER NOT NULL DEFAULT 3,
    custom_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial strategy settings
INSERT INTO strategy_settings (strategy_id, name, is_enabled, min_confidence)
VALUES 
    ('liquidity_sweep_reversal', 'Strategy 1: Liquidity Sweep + Reversal', true, 70.00),
    ('bos_pullback_continuation', 'Strategy 2: BOS + Pullback / Continuation', true, 70.00),
    ('fvg_retracement', 'Strategy 3: FVG Retracement (Normal & Inverse)', true, 70.00),
    ('order_block_reaction', 'Strategy 4: Order Block Reaction', true, 70.00),
    ('liquidity_ob_fvg_confluence', 'Strategy 5: Liquidity + OB/FVG Confluence', true, 72.00),
    ('range_eqh_eql_reversal', 'Strategy 6: Range / Equal High-Low Reversal', true, 70.00)
ON CONFLICT (strategy_id) DO NOTHING;

-- Seed default account & risk settings
INSERT INTO account_settings (id, starting_capital, current_capital, currency)
VALUES ('DEFAULT', 100.00, 100.00, 'USD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_settings (id, risk_percent_per_trade, max_daily_risk_percent, max_concurrent_trades, max_allowed_sl_distance, min_risk_reward_ratio, max_drawdown_limit_percent)
VALUES ('DEFAULT', 1.00, 3.00, 2, 12.00, 1.50, 10.00)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 12. EXPERIENCE RECORDS & LEARNING FEATURES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_key VARCHAR(128) NOT NULL, -- Hash of Strategy + Regime + Key Feature Vector
    sample_size INTEGER NOT NULL DEFAULT 1,
    win_count INTEGER NOT NULL DEFAULT 0,
    loss_count INTEGER NOT NULL DEFAULT 0,
    avg_realized_r NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    avg_mfe_r NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    avg_mae_r NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    confidence_weight NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- Near 0 for small samples, scaling up when N >= 30
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experience_cluster ON experience_records(cluster_key);

-- ------------------------------------------------------------------------------
-- 13. RESEARCH / EXPERIMENTS (ISOLATED SANDBOX)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_name VARCHAR(128) NOT NULL,
    hypothesis TEXT NOT NULL,
    dataset_period VARCHAR(64) NOT NULL,
    parameters JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'RUNNING', 'COMPLETED', 'ARCHIVED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    sample_size INTEGER NOT NULL,
    in_sample_metrics JSONB NOT NULL,
    out_of_sample_metrics JSONB NOT NULL,
    limitations TEXT,
    conclusion TEXT NOT NULL,
    version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
