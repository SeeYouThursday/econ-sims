-- Migration: 001-normalize-stock-game-state.sql
--
-- Splits the monolithic JSONB stock_game_state row into normalized tables so
-- per-classroom and per-student operations no longer serialize through one row.
--
-- This migration is idempotent and safe to run repeatedly:
--   1. Creates normalized tables and indexes if absent.
--   2. Migrates the legacy `stock_game_state` JSONB row into normalized tables
--      ONLY if `classrooms` is currently empty.
--   3. Leaves `stock_game_state` in place for one deploy cycle so a rollback
--      is possible. Drop it via a follow-up migration after verification.
--
-- The application also runs equivalent setup lazily on first Neon connection
-- (see lib/stockGameStore.ts ensureNormalizedTables()), so production deploys
-- can apply this migration as belt-and-suspenders or rely on the lazy path.
--
-- TRANSITIONAL MONEY SCHEMA: cash and price columns are NUMERIC(14,2) to
-- preserve the existing dollars-as-decimal behavior carried over from the
-- legacy JSONB row. AGENTS.md section 3 mandates integer cents; a follow-up
-- migration (002-money-as-cents.sql) is planned to migrate cash/price to
-- BIGINT cents and update the application's read/write paths in lockstep.
-- Do not extend NUMERIC arithmetic outside this transitional window.

CREATE TABLE IF NOT EXISTS classrooms (
  code TEXT PRIMARY KEY,
  teacher_passcode_hash TEXT,
  owner_teacher_id TEXT,
  title TEXT,
  starting_cash INTEGER,
  duration_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  classroom_code TEXT NOT NULL REFERENCES classrooms(code) ON DELETE CASCADE,
  username TEXT NOT NULL,
  passcode_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  cash NUMERIC(14,2) NOT NULL DEFAULT 10000,
  positions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (classroom_code, username)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  classroom_code TEXT NOT NULL REFERENCES classrooms(code) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  classroom_code TEXT NOT NULL REFERENCES classrooms(code) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  shares INTEGER NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  quote_as_of TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_prices (
  classroom_code TEXT NOT NULL REFERENCES classrooms(code) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (classroom_code, symbol)
);

CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_code);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_classroom ON sessions(classroom_code);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_trades_classroom_executed ON trades(classroom_code, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_student_executed ON trades(student_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_classroom_symbol ON trades(classroom_code, symbol);

-- One-shot data migration from the legacy JSONB row. Skipped if classrooms
-- already has rows (i.e. someone has already migrated, or this is a fresh DB).
DO $$
DECLARE
  state_data JSONB;
  classroom_kv RECORD;
  student_kv RECORD;
  session_kv RECORD;
  trade_value JSONB;
  market_outer RECORD;
  market_inner RECORD;
BEGIN
  IF (SELECT COUNT(*) FROM classrooms) > 0 THEN
    RAISE NOTICE 'classrooms already populated; skipping legacy migration.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'stock_game_state'
  ) THEN
    RAISE NOTICE 'stock_game_state table not present; nothing to migrate.';
    RETURN;
  END IF;

  SELECT data INTO state_data
  FROM stock_game_state
  WHERE id = 'primary'
  LIMIT 1;

  IF state_data IS NULL THEN
    RAISE NOTICE 'no legacy stock_game_state row to migrate.';
    RETURN;
  END IF;

  FOR classroom_kv IN
    SELECT key AS code, value FROM jsonb_each(state_data->'classrooms')
  LOOP
    INSERT INTO classrooms (
      code, teacher_passcode_hash, owner_teacher_id, title,
      starting_cash, duration_days, created_at
    ) VALUES (
      classroom_kv.code,
      classroom_kv.value->>'teacherPasscodeHash',
      classroom_kv.value->>'ownerTeacherId',
      classroom_kv.value->>'title',
      NULLIF(classroom_kv.value->>'startingCash', '')::INTEGER,
      NULLIF(classroom_kv.value->>'durationDays', '')::INTEGER,
      COALESCE((classroom_kv.value->>'createdAt')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (code) DO NOTHING;
  END LOOP;

  FOR student_kv IN
    SELECT key AS id, value FROM jsonb_each(state_data->'students')
  LOOP
    INSERT INTO students (
      id, classroom_code, username, passcode_hash,
      is_active, cash, positions, created_at
    ) VALUES (
      student_kv.id,
      student_kv.value->>'classroomCode',
      LOWER(student_kv.value->>'username'),
      student_kv.value->>'passcodeHash',
      COALESCE((student_kv.value->>'isActive')::BOOLEAN, TRUE),
      COALESCE((student_kv.value->>'cash')::NUMERIC, 10000),
      COALESCE(student_kv.value->'positions', '{}'::jsonb),
      COALESCE((student_kv.value->>'createdAt')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR session_kv IN
    SELECT key AS token, value FROM jsonb_each(state_data->'sessions')
  LOOP
    -- Skip already-expired sessions.
    IF (session_kv.value->>'expiresAt')::BIGINT < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT THEN
      CONTINUE;
    END IF;
    INSERT INTO sessions (token, student_id, classroom_code, expires_at)
    VALUES (
      session_kv.token,
      session_kv.value->>'studentId',
      session_kv.value->>'classroomCode',
      (session_kv.value->>'expiresAt')::BIGINT
    )
    ON CONFLICT (token) DO NOTHING;
  END LOOP;

  FOR trade_value IN
    SELECT value FROM jsonb_array_elements(COALESCE(state_data->'trades', '[]'::jsonb))
  LOOP
    INSERT INTO trades (
      id, classroom_code, student_id, symbol, side,
      shares, price, quote_as_of, executed_at
    ) VALUES (
      trade_value->>'id',
      trade_value->>'classroomCode',
      trade_value->>'studentId',
      trade_value->>'symbol',
      trade_value->>'side',
      (trade_value->>'shares')::INTEGER,
      (trade_value->>'price')::NUMERIC,
      trade_value->>'quoteAsOf',
      (trade_value->>'executedAt')::TIMESTAMPTZ
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR market_outer IN
    SELECT key AS classroom_code, value AS symbol_map
    FROM jsonb_each(COALESCE(state_data->'marketPricesByClass', '{}'::jsonb))
  LOOP
    FOR market_inner IN
      SELECT key AS symbol, value AS price_value FROM jsonb_each(market_outer.symbol_map)
    LOOP
      INSERT INTO market_prices (classroom_code, symbol, price)
      VALUES (
        market_outer.classroom_code,
        market_inner.symbol,
        (market_inner.price_value::TEXT)::NUMERIC
      )
      ON CONFLICT (classroom_code, symbol) DO UPDATE SET
        price = EXCLUDED.price,
        updated_at = NOW();
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Legacy stock_game_state migrated to normalized tables.';
END $$;
