-- Migration: 002-money-as-cents.sql
--
-- Switches every monetary column from dollars-as-NUMERIC(14,2) (or
-- starting_cash as dollar INTEGER) to BIGINT cents. Multiplies existing rows
-- by 100 in the same ALTER so on-disk values keep the same dollar amount.
--
-- AGENTS.md section 3 requires storing virtual currency as integer cents;
-- migration 001 left a transitional NUMERIC schema so the JSONB → normalized
-- cutover could ship without also flipping the money contract. This migration
-- is the planned follow-up and must land in lockstep with the server/API/UI
-- changes that read and write cents (see lib/stockGameStore.ts, the
-- /api/stock-game/* routes, and components/student-game).
--
-- Idempotency: each ALTER is guarded by an information_schema check so
-- re-running this file after columns have already been converted is a no-op.
-- The lazy DDL in ensureNormalizedTables() (lib/stockGameStore.ts) and
-- ensureTeacherTables() (lib/teacherStore.ts) creates BIGINT columns directly
-- on a fresh deploy, so this migration is only needed where a previous deploy
-- left NUMERIC/INTEGER columns behind.

-- students.cash: NUMERIC(14,2) dollars → BIGINT cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students'
      AND column_name = 'cash'
      AND data_type = 'numeric'
  ) THEN
    ALTER TABLE students
      ALTER COLUMN cash DROP DEFAULT,
      ALTER COLUMN cash TYPE BIGINT USING ROUND(cash * 100)::BIGINT,
      ALTER COLUMN cash SET DEFAULT 1000000;
  END IF;
END $$;

-- trades.price: NUMERIC(14,2) dollars → BIGINT cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades'
      AND column_name = 'price'
      AND data_type = 'numeric'
  ) THEN
    ALTER TABLE trades
      ALTER COLUMN price TYPE BIGINT USING ROUND(price * 100)::BIGINT;
  END IF;
END $$;

-- market_prices.price: NUMERIC(14,2) dollars → BIGINT cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_prices'
      AND column_name = 'price'
      AND data_type = 'numeric'
  ) THEN
    ALTER TABLE market_prices
      ALTER COLUMN price TYPE BIGINT USING ROUND(price * 100)::BIGINT;
  END IF;
END $$;

-- classrooms.starting_cash: INTEGER dollars → BIGINT cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classrooms'
      AND column_name = 'starting_cash'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE classrooms
      ALTER COLUMN starting_cash TYPE BIGINT USING starting_cash * 100;
  END IF;
END $$;

-- stock_game_classrooms.starting_cash (legacy teacher table): INTEGER dollars
-- → BIGINT cents. Default also moves from 10000 to 1000000.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_game_classrooms'
      AND column_name = 'starting_cash'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE stock_game_classrooms
      ALTER COLUMN starting_cash DROP DEFAULT,
      ALTER COLUMN starting_cash TYPE BIGINT USING starting_cash * 100,
      ALTER COLUMN starting_cash SET DEFAULT 1000000,
      ALTER COLUMN starting_cash SET NOT NULL;
  END IF;
END $$;
