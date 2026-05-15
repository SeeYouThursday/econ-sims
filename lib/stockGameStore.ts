import { createHash, randomUUID } from 'crypto';
import { getNeonSql, isNeonConfigured } from './neon';
import { getRedisClient, isRedisConfigured } from './redis';
import { __resetStudentAliasStore } from './studentAliasStore';
import { decryptRecoverablePasscode } from './passcodeCipher';

type TradeSide = 'buy' | 'sell';

type Classroom = {
  code: string;
  teacherPasscodeHash?: string;
  ownerTeacherId?: string;
  title?: string;
  startingCash?: number;
  durationDays?: number;
  createdAt: string;
};

type Student = {
  id: string;
  classroomCode: string;
  username: string;
  passcodeHash: string;
  isActive?: boolean;
  cash: number;
  positions: Record<string, number>;
  createdAt: string;
};

type Session = {
  token: string;
  studentId: string;
  classroomCode: string;
  expiresAt: number;
};

type Trade = {
  id: string;
  classroomCode: string;
  studentId: string;
  symbol: string;
  side: TradeSide;
  shares: number;
  price: number;
  quoteAsOf: string;
  executedAt: string;
};

type StudentTradeHistoryEntry = {
  id: string;
  symbol: string;
  side: TradeSide;
  shares: number;
  price: number;
  quoteAsOf: string;
  executedAt: string;
};

type StudentTradeHistoryResponse = {
  classroomCode: string;
  username: string;
  asOf: string;
  trades: StudentTradeHistoryEntry[];
};

type PortfolioSnapshot = {
  studentId: string;
  classroomCode: string;
  username: string;
  classroomActive: boolean;
  classroomEndsAt: string | null;
  cash: number;
  positions: Record<string, number>;
  holdingsValue: number;
  totalValue: number;
  pnlValue: number;
  pnlPercent: number;
};

type LeaderboardEntry = {
  rank: number;
  username: string;
  cash: number;
  holdingsValue: number;
  totalValue: number;
};

type LeaderboardResponse = {
  classroomCode: string;
  asOf: string;
  source: 'computed' | 'cache';
  entries: LeaderboardEntry[];
};

type PersistedState = {
  classrooms: Record<string, Classroom>;
  students: Record<string, Student>;
  studentsByClassAndName: Record<string, string>;
  sessions: Record<string, Session>;
  trades: Trade[];
  marketPricesByClass: Record<string, Record<string, number>>;
};

type LeaderboardCacheEntry = {
  expiresAt: number;
  data: LeaderboardResponse;
};

type CreateStudentInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
  username: string;
  studentPasscode: string;
};

type CreateStudentsBatchInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
  students: Array<{
    username: string;
    studentPasscode: string;
  }>;
};

type LoginInput = {
  classroomCode: string;
  username: string;
  studentPasscode: string;
};

type PlaceTradeInput = {
  token: string;
  symbol: string;
  side: TradeSide;
  shares: number;
  price: number;
  quoteAsOf?: string;
};

type DeleteStudentInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
  username: string;
};

type TeacherAuditInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
};

type ListStudentsInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
};

type ClassroomStudentSummary = {
  studentId: string;
  username: string;
  createdAt: string;
  isActive: boolean;
  cash: number;
  holdingsValue: number;
  totalValue: number;
  hasActiveSession: boolean;
};

type ManageStudentInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
  username: string;
  action: 'reset' | 'deactivate' | 'activate';
};

type ManageClassroomStudentsInput = {
  classroomCode: string;
  teacherPasscode?: string;
  teacherUserId?: string;
  action: 'reset-all' | 'restart-game';
};

export class StockGameError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

declare global {
  var __stockGameState: PersistedState | undefined;
  var __stockGameLeaderboardCache:
    | Map<string, LeaderboardCacheEntry>
    | undefined;
}

// Module-scoped so vi.resetModules() resets it for tests; serverless cold
// starts re-init it naturally.
let neonInitialized = false;

const STARTING_CASH = 10000;
const DEFAULT_CLASSROOM_DURATION_DAYS = 30;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LEADERBOARD_TTL_MS = 60 * 1000;
const TRADE_RETENTION_DAYS = Number(
  process.env.STOCK_GAME_TRADE_RETENTION_DAYS ?? '180',
);
const LEGACY_STATE_ROW_ID = 'primary';
const LEGACY_REDIS_STATE_KEY = 'econ-sims:stock-game:state';
const LEADERBOARD_KEY_PREFIX = 'econ-sims:stock-game:leaderboard';

let hasLoggedNeonFallback = false;

// =============================================================================
// Util / validation
// =============================================================================

function nowIso() {
  return new Date().toISOString();
}

function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

function normalizeClassroomCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function makeClassAndUserKey(classroomCode: string, username: string) {
  return `${classroomCode}::${normalizeUsername(username)}`;
}

function isStudentActive(student: Student) {
  return student.isActive !== false;
}

function validateUsername(username: string) {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 24) {
    throw new StockGameError('Username must be between 3 and 24 characters.');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new StockGameError(
      'Username can only include letters, numbers, underscores, and hyphens.',
    );
  }

  // FERPA/COPPA data minimization: enforce alias-like usernames, not real names.
  if (!/[0-9]/.test(trimmed)) {
    throw new StockGameError(
      'Use a student alias that includes at least one number (for example: student_01).',
    );
  }

  return trimmed;
}

function validatePasscode(passcode: string, label: string) {
  const trimmed = passcode.trim();
  if (trimmed.length < 4 || trimmed.length > 64) {
    throw new StockGameError(`${label} must be between 4 and 64 characters.`);
  }
  return trimmed;
}

function validateClassroomCode(code: string) {
  const normalized = normalizeClassroomCode(code);
  if (normalized.length < 3 || normalized.length > 16) {
    throw new StockGameError(
      'Classroom code must be between 3 and 16 characters.',
    );
  }

  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    throw new StockGameError(
      'Classroom code can only include letters, numbers, underscores, and hyphens.',
    );
  }

  return normalized;
}

function getClassStartingCash(classroom?: Classroom | null) {
  return classroom?.startingCash ?? STARTING_CASH;
}

function getClassDurationDays(classroom?: Classroom | null) {
  const durationDays = classroom?.durationDays;
  if (typeof durationDays !== 'number' || !Number.isFinite(durationDays)) {
    return DEFAULT_CLASSROOM_DURATION_DAYS;
  }

  return Math.max(1, Math.trunc(durationDays));
}

function getClassroomEndsAtMs(classroom: Classroom) {
  const createdAtMs = Date.parse(classroom.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  return createdAtMs + getClassDurationDays(classroom) * 24 * 60 * 60 * 1000;
}

function assertClassroomIsActive(classroom: Classroom) {
  const endsAtMs = getClassroomEndsAtMs(classroom);
  if (endsAtMs !== null && endsAtMs <= Date.now()) {
    throw new StockGameError(
      'This classroom game has ended. Ask your teacher for help.',
      403,
    );
  }
}

function assertSymbolFormat(symbol: string) {
  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
    throw new StockGameError('Symbol format is invalid.');
  }
}

function assertTradeSide(side: unknown): asserts side is TradeSide {
  if (side !== 'buy' && side !== 'sell') {
    throw new StockGameError('Trade side must be buy or sell.');
  }
}

function assertPositiveShares(shares: number) {
  if (
    !Number.isFinite(shares) ||
    shares <= 0 ||
    !Number.isInteger(shares)
  ) {
    throw new StockGameError('Shares must be a positive whole number.');
  }
}

function assertPositivePrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new StockGameError('Price must be a positive number.');
  }
}

function authorizeTeacher(
  classroom: Classroom,
  teacherPasscode?: string,
  teacherUserId?: string,
) {
  if (classroom.ownerTeacherId) {
    if (teacherUserId === classroom.ownerTeacherId) {
      return;
    }
    throw new StockGameError(
      'Teacher is not authorized for this classroom.',
      403,
    );
  }

  if (
    !teacherPasscode ||
    classroom.teacherPasscodeHash !== hashSecret(teacherPasscode)
  ) {
    throw new StockGameError('Invalid teacher passcode.', 401);
  }
}

function logNeonFallback(message: string, error?: unknown) {
  if (hasLoggedNeonFallback) {
    return;
  }

  hasLoggedNeonFallback = true;
  if (error) {
    console.error(message, error);
    return;
  }

  console.error(message);
}

// =============================================================================
// MEMORY MODE — used in dev/test when DATABASE_URL is not configured
// =============================================================================

function createEmptyState(): PersistedState {
  return {
    classrooms: {},
    students: {},
    studentsByClassAndName: {},
    sessions: {},
    trades: [],
    marketPricesByClass: {},
  };
}

function getMemoryLeaderboardCache() {
  if (!globalThis.__stockGameLeaderboardCache) {
    globalThis.__stockGameLeaderboardCache = new Map();
  }

  return globalThis.__stockGameLeaderboardCache;
}

function ensureSeedClassroom(state: PersistedState) {
  const code = normalizeClassroomCode(
    process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101',
  );
  const teacherPasscode =
    process.env.STOCK_GAME_TEACHER_PASSCODE ?? 'teacher-demo';

  if (!state.classrooms[code]) {
    state.classrooms[code] = {
      code,
      teacherPasscodeHash: hashSecret(teacherPasscode),
      createdAt: nowIso(),
    };
  }
}

function ensureStockGameStateShape(state: PersistedState) {
  if (!state.classrooms) state.classrooms = {};
  if (!state.students) state.students = {};
  if (!state.studentsByClassAndName) state.studentsByClassAndName = {};
  if (!state.sessions) state.sessions = {};
  if (!state.trades) state.trades = [];
  if (!state.marketPricesByClass) state.marketPricesByClass = {};

  const rebuiltIndex: Record<string, string> = {};
  for (const student of Object.values(state.students)) {
    if (!student?.id || !student?.username || !student?.classroomCode) {
      continue;
    }
    rebuiltIndex[makeClassAndUserKey(student.classroomCode, student.username)] =
      student.id;
  }
  state.studentsByClassAndName = rebuiltIndex;
}

function stripLegacyStudentPasscodes(state: PersistedState) {
  for (const student of Object.values(state.students)) {
    if ('studentPasscode' in student) {
      delete (student as Student & { studentPasscode?: string })
        .studentPasscode;
    }
  }
}

function purgeExpiredMemoryData(state: PersistedState) {
  const now = Date.now();
  for (const [token, session] of Object.entries(state.sessions)) {
    if (session.expiresAt < now) {
      delete state.sessions[token];
    }
  }

  const retentionDays = Number.isFinite(TRADE_RETENTION_DAYS)
    ? Math.max(1, Math.trunc(TRADE_RETENTION_DAYS))
    : 180;
  const cutoffMs = now - retentionDays * 24 * 60 * 60 * 1000;
  state.trades = state.trades.filter((trade) => {
    const executedMs = Date.parse(trade.executedAt);
    return Number.isFinite(executedMs) && executedMs >= cutoffMs;
  });
}

function loadMemoryState(): PersistedState {
  if (!globalThis.__stockGameState) {
    globalThis.__stockGameState = createEmptyState();
    ensureSeedClassroom(globalThis.__stockGameState);
  }

  const state = globalThis.__stockGameState;
  ensureStockGameStateShape(state);
  stripLegacyStudentPasscodes(state);
  purgeExpiredMemoryData(state);
  return state;
}

function getMemoryActiveSession(state: PersistedState, token: string) {
  const session = state.sessions[token];
  if (!session) {
    throw new StockGameError('Invalid session token.', 401);
  }
  if (session.expiresAt < Date.now()) {
    delete state.sessions[token];
    throw new StockGameError('Session expired. Please sign in again.', 401);
  }
  return session;
}

function buildPortfolioSnapshot(
  classroom: Classroom | null,
  student: Student,
  marketPrices: Record<string, number>,
): PortfolioSnapshot {
  const classStartingCash = getClassStartingCash(classroom);
  const classroomEndsAtMs = classroom ? getClassroomEndsAtMs(classroom) : null;

  const holdingsValue = Object.entries(student.positions).reduce(
    (sum, [symbol, shares]) => sum + shares * (marketPrices[symbol] ?? 0),
    0,
  );

  const totalValue = Number((student.cash + holdingsValue).toFixed(2));
  const pnlValue = Number((totalValue - classStartingCash).toFixed(2));
  const pnlPercent = Number(((pnlValue / classStartingCash) * 100).toFixed(2));

  return {
    studentId: student.id,
    classroomCode: student.classroomCode,
    username: student.username,
    classroomActive:
      classroomEndsAtMs === null || classroomEndsAtMs > Date.now(),
    classroomEndsAt:
      classroomEndsAtMs === null
        ? null
        : new Date(classroomEndsAtMs).toISOString(),
    cash: Number(student.cash.toFixed(2)),
    positions: { ...student.positions },
    holdingsValue: Number(holdingsValue.toFixed(2)),
    totalValue,
    pnlValue,
    pnlPercent,
  };
}

function getMemoryPortfolioSnapshot(
  state: PersistedState,
  student: Student,
): PortfolioSnapshot {
  const classroom = state.classrooms[student.classroomCode] ?? null;
  const marketPrices = state.marketPricesByClass[student.classroomCode] ?? {};
  return buildPortfolioSnapshot(classroom, student, marketPrices);
}

// =============================================================================
// NEON MODE — normalized tables, targeted queries
// =============================================================================

async function ensureNormalizedTables() {
  if (neonInitialized) {
    return;
  }

  const sql = getNeonSql();

  await sql`
    CREATE TABLE IF NOT EXISTS classrooms (
      code TEXT PRIMARY KEY,
      teacher_passcode_hash TEXT,
      owner_teacher_id TEXT,
      title TEXT,
      starting_cash INTEGER,
      duration_days INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      classroom_code TEXT NOT NULL REFERENCES classrooms(code) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS market_prices (
      classroom_code TEXT NOT NULL REFERENCES classrooms(code) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      price NUMERIC(14,2) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (classroom_code, symbol)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_classroom ON sessions(classroom_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trades_classroom_executed ON trades(classroom_code, executed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trades_student_executed ON trades(student_id, executed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trades_classroom_symbol ON trades(classroom_code, symbol)`;

  await bootstrapFromLegacyJsonbIfNeeded();
  await ensureSeedClassroomNeon();
  await purgeExpiredNeonData();

  neonInitialized = true;
}

async function bootstrapFromLegacyJsonbIfNeeded() {
  const sql = getNeonSql();

  // Check if classrooms table is empty — only then do we attempt migration.
  const classroomCountRows = (await sql`
    SELECT COUNT(*)::int AS count FROM classrooms
  `) as Array<{ count: number }>;
  const classroomCount = classroomCountRows[0]?.count ?? 0;
  if (classroomCount > 0) {
    return;
  }

  // Try the legacy JSONB row first. If the table doesn't exist or has nothing
  // for us, fall through to the legacy Redis state key.
  let legacyData: unknown = null;
  try {
    const legacyRows = (await sql`
      SELECT data FROM stock_game_state WHERE id = ${LEGACY_STATE_ROW_ID} LIMIT 1
    `) as Array<{ data?: unknown }>;
    legacyData = legacyRows[0]?.data ?? null;
  } catch {
    legacyData = null;
  }

  if (!legacyData) {
    legacyData = await loadLegacyRedisState();
  }

  if (!legacyData) {
    return;
  }

  const parsed = parsePersistedState(legacyData);
  if (!parsed) {
    return;
  }

  ensureStockGameStateShape(parsed);
  stripLegacyStudentPasscodes(parsed);

  // Migrate classrooms first (parents).
  for (const classroom of Object.values(parsed.classrooms)) {
    await sql`
      INSERT INTO classrooms (
        code, teacher_passcode_hash, owner_teacher_id, title,
        starting_cash, duration_days, created_at
      ) VALUES (
        ${classroom.code},
        ${classroom.teacherPasscodeHash ?? null},
        ${classroom.ownerTeacherId ?? null},
        ${classroom.title ?? null},
        ${classroom.startingCash ?? null},
        ${classroom.durationDays ?? null},
        ${classroom.createdAt}
      )
      ON CONFLICT (code) DO NOTHING
    `;
  }

  for (const student of Object.values(parsed.students)) {
    await sql`
      INSERT INTO students (
        id, classroom_code, username, passcode_hash,
        is_active, cash, positions, created_at
      ) VALUES (
        ${student.id},
        ${student.classroomCode},
        ${normalizeUsername(student.username)},
        ${student.passcodeHash},
        ${student.isActive ?? true},
        ${student.cash ?? STARTING_CASH},
        ${JSON.stringify(student.positions ?? {})}::jsonb,
        ${student.createdAt}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const session of Object.values(parsed.sessions)) {
    if (session.expiresAt < Date.now()) continue;
    await sql`
      INSERT INTO sessions (token, student_id, classroom_code, expires_at)
      VALUES (
        ${session.token},
        ${session.studentId},
        ${session.classroomCode},
        ${session.expiresAt}
      )
      ON CONFLICT (token) DO NOTHING
    `;
  }

  for (const trade of parsed.trades) {
    await sql`
      INSERT INTO trades (
        id, classroom_code, student_id, symbol, side,
        shares, price, quote_as_of, executed_at
      ) VALUES (
        ${trade.id},
        ${trade.classroomCode},
        ${trade.studentId},
        ${trade.symbol},
        ${trade.side},
        ${trade.shares},
        ${trade.price},
        ${trade.quoteAsOf},
        ${trade.executedAt}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const [classroomCode, symbols] of Object.entries(
    parsed.marketPricesByClass,
  )) {
    for (const [symbol, price] of Object.entries(symbols)) {
      await sql`
        INSERT INTO market_prices (classroom_code, symbol, price)
        VALUES (${classroomCode}, ${symbol}, ${price})
        ON CONFLICT (classroom_code, symbol) DO UPDATE SET
          price = EXCLUDED.price,
          updated_at = NOW()
      `;
    }
  }
}

async function ensureSeedClassroomNeon() {
  const code = normalizeClassroomCode(
    process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101',
  );
  const teacherPasscode =
    process.env.STOCK_GAME_TEACHER_PASSCODE ?? 'teacher-demo';

  const sql = getNeonSql();
  await sql`
    INSERT INTO classrooms (code, teacher_passcode_hash, created_at)
    VALUES (${code}, ${hashSecret(teacherPasscode)}, NOW())
    ON CONFLICT (code) DO NOTHING
  `;
}

async function purgeExpiredNeonData() {
  const now = Date.now();
  const sql = getNeonSql();
  await sql`DELETE FROM sessions WHERE expires_at < ${now}`;

  const retentionDays = Number.isFinite(TRADE_RETENTION_DAYS)
    ? Math.max(1, Math.trunc(TRADE_RETENTION_DAYS))
    : 180;
  const cutoffMs = now - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  await sql`DELETE FROM trades WHERE executed_at < ${cutoffIso}`;
}

async function recoverMissingStudentsFromAliasStoreNeon(classroomCode: string) {
  // Only invoked when a student is unexpectedly missing — rebuilds from
  // stock_game_student_aliases (which holds encrypted recoverable passcodes).
  const sql = getNeonSql();

  let aliasRows: Array<Record<string, unknown>> = [];
  try {
    aliasRows = (await sql`
      SELECT classroom_code, username, student_passcode_encrypted, is_active, created_at
      FROM stock_game_student_aliases
      WHERE classroom_code = ${classroomCode}
    `) as Array<Record<string, unknown>>;
  } catch {
    return;
  }

  if (aliasRows.length === 0) return;

  const classroomRows = (await sql`
    SELECT starting_cash FROM classrooms WHERE code = ${classroomCode} LIMIT 1
  `) as Array<{ starting_cash: number | null }>;
  const startingCash =
    classroomRows[0]?.starting_cash ?? STARTING_CASH;

  for (const row of aliasRows) {
    const username =
      typeof row.username === 'string' ? normalizeUsername(row.username) : '';
    const encryptedPasscode =
      typeof row.student_passcode_encrypted === 'string'
        ? row.student_passcode_encrypted
        : null;
    const createdAt =
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date(String(row.created_at ?? nowIso())).toISOString();
    const isActive = Boolean(row.is_active);

    if (!username || !encryptedPasscode) continue;

    const passcode = decryptRecoverablePasscode(encryptedPasscode);
    if (!passcode) continue;

    await sql`
      INSERT INTO students (
        id, classroom_code, username, passcode_hash, is_active, cash, positions, created_at
      ) VALUES (
        ${randomUUID()},
        ${classroomCode},
        ${username},
        ${hashSecret(passcode)},
        ${isActive},
        ${startingCash},
        '{}'::jsonb,
        ${createdAt}
      )
      ON CONFLICT (classroom_code, username) DO NOTHING
    `;
  }
}

async function loadLegacyRedisState() {
  if (!isRedisConfigured()) return null;
  try {
    const redis = await getRedisClient();
    const raw = await redis?.get(LEGACY_REDIS_STATE_KEY);
    return parsePersistedState(raw);
  } catch {
    return null;
  }
}

function parsePersistedState(value: unknown): PersistedState | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as PersistedState;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as PersistedState;
  }
  return null;
}

// ---- Neon row decoders ----

function decodeNeonClassroom(row: Record<string, unknown>): Classroom {
  return {
    code: String(row.code),
    teacherPasscodeHash:
      row.teacher_passcode_hash == null
        ? undefined
        : String(row.teacher_passcode_hash),
    ownerTeacherId:
      row.owner_teacher_id == null ? undefined : String(row.owner_teacher_id),
    title: row.title == null ? undefined : String(row.title),
    startingCash:
      row.starting_cash == null ? undefined : Number(row.starting_cash),
    durationDays:
      row.duration_days == null ? undefined : Number(row.duration_days),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function decodeNeonStudent(row: Record<string, unknown>): Student {
  const positionsRaw = row.positions;
  let positions: Record<string, number> = {};
  if (typeof positionsRaw === 'string') {
    try {
      positions = JSON.parse(positionsRaw) as Record<string, number>;
    } catch {
      positions = {};
    }
  } else if (positionsRaw && typeof positionsRaw === 'object') {
    positions = positionsRaw as Record<string, number>;
  }

  // Drop any zero-valued positions (artifacts of full-close sells).
  for (const key of Object.keys(positions)) {
    if (!positions[key] || positions[key] <= 0) {
      delete positions[key];
    }
  }

  return {
    id: String(row.id),
    classroomCode: String(row.classroom_code),
    username: String(row.username),
    passcodeHash: String(row.passcode_hash),
    isActive: row.is_active == null ? true : Boolean(row.is_active),
    cash: Number(row.cash),
    positions,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

async function fetchNeonClassroom(
  classroomCode: string,
): Promise<Classroom | null> {
  const sql = getNeonSql();
  const rows = (await sql`
    SELECT code, teacher_passcode_hash, owner_teacher_id, title,
           starting_cash, duration_days, created_at
    FROM classrooms
    WHERE code = ${classroomCode}
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  return rows[0] ? decodeNeonClassroom(rows[0]) : null;
}

async function fetchNeonStudentById(studentId: string): Promise<Student | null> {
  const sql = getNeonSql();
  const rows = (await sql`
    SELECT id, classroom_code, username, passcode_hash, is_active,
           cash, positions, created_at
    FROM students
    WHERE id = ${studentId}
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  return rows[0] ? decodeNeonStudent(rows[0]) : null;
}

async function fetchNeonStudentByClassAndName(
  classroomCode: string,
  username: string,
): Promise<Student | null> {
  const sql = getNeonSql();
  const rows = (await sql`
    SELECT id, classroom_code, username, passcode_hash, is_active,
           cash, positions, created_at
    FROM students
    WHERE classroom_code = ${classroomCode} AND username = ${username}
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  return rows[0] ? decodeNeonStudent(rows[0]) : null;
}

async function fetchNeonMarketPrices(
  classroomCode: string,
): Promise<Record<string, number>> {
  const sql = getNeonSql();
  const rows = (await sql`
    SELECT symbol, price FROM market_prices
    WHERE classroom_code = ${classroomCode}
  `) as Array<{ symbol: string; price: string | number }>;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.symbol] = Number(row.price);
  }
  return result;
}

async function getInitializedNeonSql() {
  await ensureNormalizedTables();
  return getNeonSql();
}

async function withDurableNeon<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StockGameError) {
      throw error;
    }
    logNeonFallback('Neon operation failed', error);
    throw new StockGameError(
      'Persistent stock game storage is unavailable. Please try again shortly.',
      503,
    );
  }
}

// =============================================================================
// Cache layer (per-classroom leaderboard only)
// =============================================================================

function leaderboardCacheKey(classroomCode: string) {
  return `${LEADERBOARD_KEY_PREFIX}:${classroomCode}`;
}

async function getCachedLeaderboard(classroomCode: string) {
  if (!isRedisConfigured()) {
    const cached = getMemoryLeaderboardCache().get(classroomCode);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, source: 'cache' as const };
    }
    if (cached) {
      getMemoryLeaderboardCache().delete(classroomCode);
    }
    return null;
  }

  let redis = null;
  try {
    redis = await getRedisClient();
  } catch {
    redis = null;
  }
  if (!redis) return null;

  let raw: string | null = null;
  try {
    raw = await redis.get(leaderboardCacheKey(classroomCode));
  } catch {
    raw = null;
  }
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as LeaderboardResponse;
    return { ...data, source: 'cache' as const };
  } catch {
    return null;
  }
}

async function setCachedLeaderboard(data: LeaderboardResponse) {
  if (!isRedisConfigured()) {
    getMemoryLeaderboardCache().set(data.classroomCode, {
      expiresAt: Date.now() + LEADERBOARD_TTL_MS,
      data,
    });
    return;
  }

  let redis = null;
  try {
    redis = await getRedisClient();
  } catch {
    redis = null;
  }
  if (!redis) return;

  try {
    await redis.setEx(
      leaderboardCacheKey(data.classroomCode),
      Math.ceil(LEADERBOARD_TTL_MS / 1000),
      JSON.stringify(data),
    );
  } catch {
    // Cache failure should not block the request path.
  }
}

async function clearCachedLeaderboard(classroomCode: string) {
  if (!isRedisConfigured()) {
    getMemoryLeaderboardCache().delete(classroomCode);
    return;
  }

  let redis = null;
  try {
    redis = await getRedisClient();
  } catch {
    redis = null;
  }
  if (!redis) return;

  try {
    await redis.del(leaderboardCacheKey(classroomCode));
  } catch {
    // Cache invalidation failure should not block updates.
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function ensureTeacherClassroom({
  classroomCode,
  teacherUserId,
  title,
  startingCash,
  durationDays,
}: {
  classroomCode: string;
  teacherUserId: string;
  title?: string;
  startingCash?: number;
  durationDays?: number;
}) {
  const normalizedCode = validateClassroomCode(classroomCode);

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();

      const existing = await fetchNeonClassroom(normalizedCode);
      if (existing) {
        if (
          existing.ownerTeacherId &&
          existing.ownerTeacherId !== teacherUserId
        ) {
          throw new StockGameError(
            'Teacher is not authorized for this classroom.',
            403,
          );
        }

        const newStartingCash = startingCash ?? getClassStartingCash(existing);
        const newDurationDays = durationDays ?? getClassDurationDays(existing);
        const newTitle = title ?? existing.title ?? null;

        const rows = (await sql`
          UPDATE classrooms SET
            owner_teacher_id = ${teacherUserId},
            title = ${newTitle},
            starting_cash = ${newStartingCash},
            duration_days = ${newDurationDays},
            updated_at = NOW()
          WHERE code = ${normalizedCode}
          RETURNING code, teacher_passcode_hash, owner_teacher_id, title,
                    starting_cash, duration_days, created_at
        `) as Array<Record<string, unknown>>;
        return decodeNeonClassroom(rows[0]);
      }

      const rows = (await sql`
        INSERT INTO classrooms (
          code, owner_teacher_id, title, starting_cash, duration_days, created_at
        ) VALUES (
          ${normalizedCode},
          ${teacherUserId},
          ${title ?? null},
          ${startingCash ?? STARTING_CASH},
          ${durationDays ?? DEFAULT_CLASSROOM_DURATION_DAYS},
          NOW()
        )
        RETURNING code, teacher_passcode_hash, owner_teacher_id, title,
                  starting_cash, duration_days, created_at
      `) as Array<Record<string, unknown>>;
      return decodeNeonClassroom(rows[0]);
    });
  }

  // Memory mode
  const state = loadMemoryState();
  const existing = state.classrooms[normalizedCode];

  if (existing) {
    if (existing.ownerTeacherId && existing.ownerTeacherId !== teacherUserId) {
      throw new StockGameError(
        'Teacher is not authorized for this classroom.',
        403,
      );
    }

    state.classrooms[normalizedCode] = {
      ...existing,
      ownerTeacherId: teacherUserId,
      title: title ?? existing.title,
      startingCash: startingCash ?? getClassStartingCash(existing),
      durationDays: durationDays ?? getClassDurationDays(existing),
    };
    return state.classrooms[normalizedCode];
  }

  state.classrooms[normalizedCode] = {
    code: normalizedCode,
    ownerTeacherId: teacherUserId,
    title,
    startingCash: startingCash ?? STARTING_CASH,
    durationDays: durationDays ?? DEFAULT_CLASSROOM_DURATION_DAYS,
    createdAt: nowIso(),
  };
  return state.classrooms[normalizedCode];
}

export async function createStudent(input: CreateStudentInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  const username = validateUsername(input.username);
  const studentPasscode = validatePasscode(
    input.studentPasscode,
    'Student passcode',
  );
  const normalizedUser = normalizeUsername(username);

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const classStartingCash = getClassStartingCash(classroom);
      const id = randomUUID();
      const createdAt = nowIso();

      try {
        await sql`
          INSERT INTO students (
            id, classroom_code, username, passcode_hash,
            is_active, cash, positions, created_at
          ) VALUES (
            ${id},
            ${classroomCode},
            ${normalizedUser},
            ${hashSecret(studentPasscode)},
            TRUE,
            ${classStartingCash},
            '{}'::jsonb,
            ${createdAt}
          )
        `;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('duplicate') || message.includes('unique')) {
          throw new StockGameError(
            'Username is already assigned in this classroom.',
            409,
          );
        }
        throw error;
      }

      await clearCachedLeaderboard(classroomCode);
      return {
        studentId: id,
        classroomCode,
        username: normalizedUser,
        studentPasscode,
        startingCash: classStartingCash,
        createdAt,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const classStartingCash = getClassStartingCash(classroom);
  const key = makeClassAndUserKey(classroomCode, username);
  if (state.studentsByClassAndName[key]) {
    throw new StockGameError(
      'Username is already assigned in this classroom.',
      409,
    );
  }

  const id = randomUUID();
  const student: Student = {
    id,
    classroomCode,
    username: normalizedUser,
    passcodeHash: hashSecret(studentPasscode),
    isActive: true,
    cash: classStartingCash,
    positions: {},
    createdAt: nowIso(),
  };
  state.students[id] = student;
  state.studentsByClassAndName[key] = id;

  await clearCachedLeaderboard(classroomCode);
  return {
    studentId: id,
    classroomCode,
    username: normalizedUser,
    studentPasscode,
    startingCash: classStartingCash,
    createdAt: student.createdAt,
    storage: 'memory' as const,
  };
}

export async function createStudentsBatch(input: CreateStudentsBatchInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  if (!Array.isArray(input.students) || input.students.length === 0) {
    throw new StockGameError('At least one student is required.');
  }
  if (input.students.length > 35) {
    throw new StockGameError('You can create up to 35 students at once.');
  }

  const normalizedStudents = input.students.map((entry) => ({
    username: validateUsername(entry.username),
    studentPasscode: validatePasscode(
      entry.studentPasscode,
      'Student passcode',
    ),
  }));

  const seenUsernames = new Set<string>();
  for (const entry of normalizedStudents) {
    if (seenUsernames.has(entry.username)) {
      throw new StockGameError(
        `Duplicate alias in bulk request: ${entry.username}`,
        409,
      );
    }
    seenUsernames.add(entry.username);
  }

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const classStartingCash = getClassStartingCash(classroom);

      // Pre-check duplicates against existing rows.
      const existingRows = (await sql`
        SELECT username FROM students WHERE classroom_code = ${classroomCode}
      `) as Array<{ username: string }>;
      const existingUsernames = new Set(
        existingRows.map((r) => normalizeUsername(r.username)),
      );
      for (const entry of normalizedStudents) {
        if (existingUsernames.has(normalizeUsername(entry.username))) {
          throw new StockGameError(
            `Username is already assigned in this classroom: ${entry.username}`,
            409,
          );
        }
      }

      const createdAt = nowIso();
      const createdStudents = normalizedStudents.map((entry) => ({
        studentId: randomUUID(),
        classroomCode,
        username: normalizeUsername(entry.username),
        studentPasscode: entry.studentPasscode,
        startingCash: classStartingCash,
        createdAt,
      }));

      // Bulk insert via UNNEST.
      const ids = createdStudents.map((s) => s.studentId);
      const usernames = createdStudents.map((s) => s.username);
      const passcodeHashes = createdStudents.map((s) =>
        hashSecret(s.studentPasscode),
      );
      await sql`
        INSERT INTO students (
          id, classroom_code, username, passcode_hash,
          is_active, cash, positions, created_at
        )
        SELECT
          id, ${classroomCode}, username, passcode_hash,
          TRUE, ${classStartingCash}, '{}'::jsonb, ${createdAt}
        FROM UNNEST(
          ${ids}::text[],
          ${usernames}::text[],
          ${passcodeHashes}::text[]
        ) AS t(id, username, passcode_hash)
      `;

      await clearCachedLeaderboard(classroomCode);
      return {
        classroomCode,
        createdCount: createdStudents.length,
        students: createdStudents,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const classStartingCash = getClassStartingCash(classroom);
  for (const entry of normalizedStudents) {
    const key = makeClassAndUserKey(classroomCode, entry.username);
    if (state.studentsByClassAndName[key]) {
      throw new StockGameError(
        `Username is already assigned in this classroom: ${entry.username}`,
        409,
      );
    }
  }

  const createdAt = nowIso();
  const createdStudents = normalizedStudents.map((entry) => {
    const studentId = randomUUID();
    const student: Student = {
      id: studentId,
      classroomCode,
      username: normalizeUsername(entry.username),
      passcodeHash: hashSecret(entry.studentPasscode),
      isActive: true,
      cash: classStartingCash,
      positions: {},
      createdAt,
    };
    state.students[studentId] = student;
    state.studentsByClassAndName[
      makeClassAndUserKey(classroomCode, entry.username)
    ] = studentId;
    return {
      studentId,
      classroomCode,
      username: normalizeUsername(entry.username),
      studentPasscode: entry.studentPasscode,
      startingCash: classStartingCash,
      createdAt,
    };
  });

  await clearCachedLeaderboard(classroomCode);
  return {
    classroomCode,
    createdCount: createdStudents.length,
    students: createdStudents,
    storage: 'memory' as const,
  };
}

export async function loginStudent(input: LoginInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const username = validateUsername(input.username);
  const studentPasscode = validatePasscode(
    input.studentPasscode,
    'Student passcode',
  );
  const normalizedUser = normalizeUsername(username);
  const expectedHash = hashSecret(studentPasscode);

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      assertClassroomIsActive(classroom);

      let student = await fetchNeonStudentByClassAndName(
        classroomCode,
        normalizedUser,
      );
      if (!student) {
        // Attempt recovery from the alias store, then retry once.
        await recoverMissingStudentsFromAliasStoreNeon(classroomCode);
        student = await fetchNeonStudentByClassAndName(
          classroomCode,
          normalizedUser,
        );
      }
      if (!student) {
        throw new StockGameError('Student account was not found.', 404);
      }
      if (student.passcodeHash !== expectedHash) {
        throw new StockGameError('Invalid username or passcode.', 401);
      }
      if (!isStudentActive(student)) {
        throw new StockGameError('Student account is inactive.', 403);
      }

      const token = randomUUID();
      const expiresAt = Date.now() + SESSION_TTL_MS;
      await sql`
        INSERT INTO sessions (token, student_id, classroom_code, expires_at)
        VALUES (${token}, ${student.id}, ${classroomCode}, ${expiresAt})
      `;

      return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        studentId: student.id,
        classroomCode,
        username: student.username,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const key = makeClassAndUserKey(classroomCode, username);
  const studentId = state.studentsByClassAndName[key];
  if (!studentId) {
    throw new StockGameError('Student account was not found.', 404);
  }
  const student = state.students[studentId];
  if (!student || student.passcodeHash !== expectedHash) {
    throw new StockGameError('Invalid username or passcode.', 401);
  }
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  assertClassroomIsActive(classroom);
  if (!isStudentActive(student)) {
    throw new StockGameError('Student account is inactive.', 403);
  }

  const token = randomUUID();
  state.sessions[token] = {
    token,
    studentId,
    classroomCode,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  return {
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    studentId,
    classroomCode,
    username: student.username,
    storage: 'memory' as const,
  };
}

export async function assertCanAttemptStudentTrade(tokenInput: string) {
  const token = tokenInput.trim();
  if (!token) {
    throw new StockGameError('Session token is required.', 401);
  }

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const rows = (await sql`
        SELECT s.token, s.student_id, s.classroom_code, s.expires_at,
               st.username, st.is_active,
               c.code AS classroom_code_actual,
               c.teacher_passcode_hash AS classroom_teacher_passcode_hash,
               c.owner_teacher_id AS classroom_owner_teacher_id,
               c.title AS classroom_title,
               c.starting_cash AS classroom_starting_cash,
               c.duration_days AS classroom_duration_days,
               c.created_at AS classroom_created_at
        FROM sessions s
        JOIN students st ON st.id = s.student_id
        JOIN classrooms c ON c.code = s.classroom_code
        WHERE s.token = ${token}
        LIMIT 1
      `) as Array<Record<string, unknown>>;
      const row = rows[0];
      if (!row) {
        throw new StockGameError('Invalid session token.', 401);
      }
      const expiresAt = Number(row.expires_at);
      if (expiresAt < Date.now()) {
        await sql`DELETE FROM sessions WHERE token = ${token}`;
        throw new StockGameError('Session expired. Please sign in again.', 401);
      }
      const classroom = decodeNeonClassroom({
        code: row.classroom_code_actual,
        teacher_passcode_hash: row.classroom_teacher_passcode_hash,
        owner_teacher_id: row.classroom_owner_teacher_id,
        title: row.classroom_title,
        starting_cash: row.classroom_starting_cash,
        duration_days: row.classroom_duration_days,
        created_at: row.classroom_created_at,
      });
      assertClassroomIsActive(classroom);
      if (row.is_active != null && !Boolean(row.is_active)) {
        throw new StockGameError('Student account is inactive.', 403);
      }
      return {
        classroomCode: String(row.classroom_code),
        studentId: String(row.student_id),
        username: String(row.username),
        classroom,
      };
    });
  }

  const state = loadMemoryState();
  const session = getMemoryActiveSession(state, token);
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }
  const classroom = state.classrooms[session.classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  assertClassroomIsActive(classroom);
  if (!isStudentActive(student)) {
    throw new StockGameError('Student account is inactive.', 403);
  }

  return {
    classroomCode: session.classroomCode,
    studentId: student.id,
    username: student.username,
    classroom,
  };
}

/**
 * Executes a buy or sell against the student's portfolio.
 *
 * SECURITY CONTRACT: `input.price` MUST be sourced server-side from a trusted
 * market quote (Polygon.io via app/api/stock-game/trades/route.ts). The current
 * API route honors this; if you add a new caller, do the same. The function
 * persists `input.price` into `market_prices`, so a client-controlled price
 * would let one student mutate the classroom's quote for everyone.
 */
export async function placeTrade(input: PlaceTradeInput) {
  const token = input.token.trim();
  if (!token) {
    throw new StockGameError('Session token is required.', 401);
  }

  const symbol = normalizeSymbol(input.symbol);
  assertSymbolFormat(symbol);
  assertTradeSide(input.side);
  assertPositiveShares(input.shares);
  assertPositivePrice(input.price);

  const cost = Number((input.shares * input.price).toFixed(2));
  const price = Number(input.price.toFixed(2));
  const executedAt = nowIso();
  const quoteAsOf = input.quoteAsOf?.trim() || executedAt.slice(0, 10);

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();

      // Resolve session → student → classroom in one round-trip; the JOIN in
      // assertCanAttemptStudentTrade already validates token + classroom active
      // and hands back the full Classroom row, so we don't refetch it here.
      const meta = await assertCanAttemptStudentTrade(token);
      const classroom = meta.classroom;

      // Atomic CTE: conditional UPDATE gates the trade. INSERTs only run if
      // the gate passes. Single round-trip, no race conditions across concurrent
      // trades for the same student.
      const cashDelta = input.side === 'buy' ? -cost : cost;
      const tradeId = randomUUID();

      const rows = (await sql`
        WITH trade_attempt AS (
          UPDATE students
          SET
            cash = cash + ${cashDelta},
            positions = (
              CASE
                WHEN ${input.side}::text = 'buy' THEN
                  jsonb_set(
                    positions,
                    ARRAY[${symbol}],
                    to_jsonb(COALESCE((positions->>${symbol})::int, 0) + ${input.shares})
                  )
                WHEN COALESCE((positions->>${symbol})::int, 0) - ${input.shares} > 0 THEN
                  jsonb_set(
                    positions,
                    ARRAY[${symbol}],
                    to_jsonb(COALESCE((positions->>${symbol})::int, 0) - ${input.shares})
                  )
                ELSE
                  positions - ${symbol}
              END
            ),
            updated_at = NOW()
          WHERE id = ${meta.studentId}
            AND CASE
              WHEN ${input.side}::text = 'buy' THEN cash >= ${cost}
              ELSE COALESCE((positions->>${symbol})::int, 0) >= ${input.shares}
            END
          RETURNING id, classroom_code, cash, positions, username, is_active
        ),
        trade_inserted AS (
          INSERT INTO trades (
            id, classroom_code, student_id, symbol, side,
            shares, price, quote_as_of, executed_at
          )
          SELECT
            ${tradeId}, ta.classroom_code, ta.id, ${symbol}, ${input.side},
            ${input.shares}, ${price}, ${quoteAsOf}, ${executedAt}
          FROM trade_attempt ta
          RETURNING id
        ),
        price_upserted AS (
          INSERT INTO market_prices (classroom_code, symbol, price, updated_at)
          SELECT ta.classroom_code, ${symbol}, ${price}, NOW() FROM trade_attempt ta
          ON CONFLICT (classroom_code, symbol) DO UPDATE SET
            price = EXCLUDED.price,
            updated_at = NOW()
          RETURNING price
        )
        SELECT id, classroom_code, cash, positions, username
        FROM trade_attempt
      `) as Array<Record<string, unknown>>;

      if (rows.length === 0) {
        if (input.side === 'buy') {
          throw new StockGameError('Insufficient cash to place buy order.');
        }
        throw new StockGameError('Insufficient shares to place sell order.');
      }

      const updatedStudent = decodeNeonStudent({
        ...rows[0],
        passcode_hash: '',
        is_active: true,
        created_at: nowIso(),
      });
      const marketPrices = await fetchNeonMarketPrices(meta.classroomCode);
      const portfolio = buildPortfolioSnapshot(
        classroom,
        updatedStudent,
        marketPrices,
      );

      await clearCachedLeaderboard(meta.classroomCode);

      return {
        portfolio,
        latestPrice: price,
        quoteAsOf,
        executedAt,
        storage: 'neon' as const,
      };
    });
  }

  // Memory mode
  const state = loadMemoryState();
  const session = getMemoryActiveSession(state, token);
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }
  const classroom = state.classrooms[session.classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  assertClassroomIsActive(classroom);

  const currentShares = student.positions[symbol] ?? 0;
  if (input.side === 'buy') {
    if (student.cash < cost) {
      throw new StockGameError('Insufficient cash to place buy order.');
    }
    student.cash = Number((student.cash - cost).toFixed(2));
    student.positions[symbol] = currentShares + input.shares;
  } else {
    if (currentShares < input.shares) {
      throw new StockGameError('Insufficient shares to place sell order.');
    }
    student.cash = Number((student.cash + cost).toFixed(2));
    const remaining = currentShares - input.shares;
    if (remaining > 0) {
      student.positions[symbol] = remaining;
    } else {
      delete student.positions[symbol];
    }
  }

  state.marketPricesByClass[session.classroomCode] ??= {};
  state.marketPricesByClass[session.classroomCode][symbol] = price;

  state.trades.push({
    id: randomUUID(),
    classroomCode: session.classroomCode,
    studentId: student.id,
    symbol,
    side: input.side,
    shares: input.shares,
    price,
    quoteAsOf,
    executedAt,
  });

  await clearCachedLeaderboard(session.classroomCode);

  return {
    portfolio: getMemoryPortfolioSnapshot(state, student),
    latestPrice: price,
    quoteAsOf,
    executedAt,
    storage: 'memory' as const,
  };
}

export async function listStudentTrades(
  tokenInput: string,
  limitInput = 20,
): Promise<StudentTradeHistoryResponse> {
  const token = tokenInput.trim();
  if (!token) {
    throw new StockGameError('Session token is required.', 401);
  }
  const limit = Number.isFinite(limitInput)
    ? Math.max(1, Math.min(100, Math.trunc(limitInput)))
    : 20;

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const sessionRows = (await sql`
        SELECT s.student_id, s.classroom_code, s.expires_at, st.username
        FROM sessions s
        JOIN students st ON st.id = s.student_id
        WHERE s.token = ${token}
        LIMIT 1
      `) as Array<Record<string, unknown>>;
      const session = sessionRows[0];
      if (!session) {
        throw new StockGameError('Invalid session token.', 401);
      }
      if (Number(session.expires_at) < Date.now()) {
        await sql`DELETE FROM sessions WHERE token = ${token}`;
        throw new StockGameError('Session expired. Please sign in again.', 401);
      }
      const tradeRows = (await sql`
        SELECT id, symbol, side, shares, price, quote_as_of, executed_at
        FROM trades
        WHERE student_id = ${String(session.student_id)}
        ORDER BY executed_at DESC
        LIMIT ${limit}
      `) as Array<Record<string, unknown>>;

      return {
        classroomCode: String(session.classroom_code),
        username: String(session.username),
        asOf: nowIso(),
        trades: tradeRows.map((row) => ({
          id: String(row.id),
          symbol: String(row.symbol),
          side: row.side as TradeSide,
          shares: Number(row.shares),
          price: Number(Number(row.price).toFixed(2)),
          quoteAsOf: String(row.quote_as_of),
          executedAt: new Date(String(row.executed_at)).toISOString(),
        })),
      };
    });
  }

  const state = loadMemoryState();
  const session = getMemoryActiveSession(state, token);
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }
  const trades = state.trades
    .filter((trade) => trade.studentId === student.id)
    .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt))
    .slice(0, limit)
    .map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      shares: trade.shares,
      price: Number(trade.price.toFixed(2)),
      quoteAsOf: trade.quoteAsOf,
      executedAt: trade.executedAt,
    }));

  return {
    classroomCode: session.classroomCode,
    username: student.username,
    asOf: nowIso(),
    trades,
  };
}

export async function getPortfolio(token: string) {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new StockGameError('Session token is required.', 401);
  }

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const sessionRows = (await sql`
        SELECT student_id, classroom_code, expires_at
        FROM sessions
        WHERE token = ${trimmedToken}
        LIMIT 1
      `) as Array<Record<string, unknown>>;
      const session = sessionRows[0];
      if (!session) {
        throw new StockGameError('Invalid session token.', 401);
      }
      if (Number(session.expires_at) < Date.now()) {
        await sql`DELETE FROM sessions WHERE token = ${trimmedToken}`;
        throw new StockGameError('Session expired. Please sign in again.', 401);
      }
      const student = await fetchNeonStudentById(String(session.student_id));
      if (!student) {
        throw new StockGameError('Student account was not found.', 404);
      }
      const classroom = await fetchNeonClassroom(student.classroomCode);
      const marketPrices = await fetchNeonMarketPrices(student.classroomCode);
      return buildPortfolioSnapshot(classroom, student, marketPrices);
    });
  }

  const state = loadMemoryState();
  const session = getMemoryActiveSession(state, trimmedToken);
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }
  return getMemoryPortfolioSnapshot(state, student);
}

export async function getLeaderboard(
  classroomCodeInput: string,
): Promise<LeaderboardResponse> {
  const classroomCode = validateClassroomCode(classroomCodeInput);

  const cached = await getCachedLeaderboard(classroomCode);
  if (cached) {
    return cached;
  }

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }

      // Single SQL aggregation: students × market_prices → totals.
      // Computes holdingsValue server-side, returning ranked entries.
      const rows = (await sql`
        WITH student_holdings AS (
          SELECT
            s.id,
            s.username,
            s.cash,
            COALESCE(SUM((value)::numeric * COALESCE(mp.price, 0)), 0) AS holdings_value
          FROM students s
          LEFT JOIN LATERAL jsonb_each_text(s.positions) AS p(symbol, value) ON TRUE
          LEFT JOIN market_prices mp
            ON mp.classroom_code = s.classroom_code AND mp.symbol = p.symbol
          WHERE s.classroom_code = ${classroomCode}
          GROUP BY s.id, s.username, s.cash
        )
        SELECT
          username,
          cash,
          holdings_value,
          (cash + holdings_value) AS total_value
        FROM student_holdings
        ORDER BY total_value DESC, username ASC
      `) as Array<{
        username: string;
        cash: string | number;
        holdings_value: string | number;
        total_value: string | number;
      }>;

      const entries: LeaderboardEntry[] = rows.map((row, index) => ({
        rank: index + 1,
        username: row.username,
        cash: Number(Number(row.cash).toFixed(2)),
        holdingsValue: Number(Number(row.holdings_value).toFixed(2)),
        totalValue: Number(Number(row.total_value).toFixed(2)),
      }));

      const response: LeaderboardResponse = {
        classroomCode,
        asOf: nowIso(),
        source: 'computed',
        entries,
      };
      await setCachedLeaderboard(response);
      return response;
    });
  }

  const state = loadMemoryState();
  if (!state.classrooms[classroomCode]) {
    throw new StockGameError('Classroom was not found.', 404);
  }

  const portfolios = Object.values(state.students)
    .filter((student) => student.classroomCode === classroomCode)
    .map((student) => getMemoryPortfolioSnapshot(state, student))
    .sort((a, b) => b.totalValue - a.totalValue);

  const entries = portfolios.map((portfolio, index) => ({
    rank: index + 1,
    username: portfolio.username,
    cash: portfolio.cash,
    holdingsValue: portfolio.holdingsValue,
    totalValue: portfolio.totalValue,
  }));

  const response: LeaderboardResponse = {
    classroomCode,
    asOf: nowIso(),
    source: 'computed',
    entries,
  };
  await setCachedLeaderboard(response);
  return response;
}

export async function deleteStudent(input: DeleteStudentInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  const username = validateUsername(input.username);
  const normalizedUser = normalizeUsername(username);

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const rows = (await sql`
        DELETE FROM students
        WHERE classroom_code = ${classroomCode} AND username = ${normalizedUser}
        RETURNING id
      `) as Array<{ id: string }>;
      if (rows.length === 0) {
        throw new StockGameError('Student account was not found.', 404);
      }
      // Sessions and trades cascade via FK ON DELETE CASCADE.

      await clearCachedLeaderboard(classroomCode);
      return {
        classroomCode,
        username: normalizedUser,
        deleted: true,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const key = makeClassAndUserKey(classroomCode, username);
  const studentId = state.studentsByClassAndName[key];
  if (!studentId) {
    throw new StockGameError('Student account was not found.', 404);
  }
  delete state.studentsByClassAndName[key];
  delete state.students[studentId];
  for (const [token, session] of Object.entries(state.sessions)) {
    if (session.studentId === studentId) {
      delete state.sessions[token];
    }
  }
  state.trades = state.trades.filter((trade) => trade.studentId !== studentId);

  await clearCachedLeaderboard(classroomCode);
  return {
    classroomCode,
    username: normalizedUser,
    deleted: true,
    storage: 'memory' as const,
  };
}

export async function getTeacherAudit(input: TeacherAuditInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  const retentionDays = Number.isFinite(TRADE_RETENTION_DAYS)
    ? Math.max(1, Math.trunc(TRADE_RETENTION_DAYS))
    : 180;

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const studentCountRows = (await sql`
        SELECT COUNT(*)::int AS count FROM students WHERE classroom_code = ${classroomCode}
      `) as Array<{ count: number }>;
      const sessionCountRows = (await sql`
        SELECT COUNT(*)::int AS count FROM sessions
        WHERE classroom_code = ${classroomCode} AND expires_at >= ${Date.now()}
      `) as Array<{ count: number }>;
      const tradeAggRows = (await sql`
        SELECT
          COUNT(*)::int AS total_trades,
          SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END)::int AS buys,
          SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END)::int AS sells
        FROM trades
        WHERE classroom_code = ${classroomCode}
      `) as Array<{
        total_trades: number;
        buys: number | null;
        sells: number | null;
      }>;
      const topSymbolRows = (await sql`
        SELECT symbol, COUNT(*)::int AS trades
        FROM trades
        WHERE classroom_code = ${classroomCode}
        GROUP BY symbol
        ORDER BY trades DESC, symbol ASC
        LIMIT 5
      `) as Array<{ symbol: string; trades: number }>;

      return {
        classroomCode,
        asOf: nowIso(),
        retentionDays,
        studentCount: studentCountRows[0]?.count ?? 0,
        activeSessionCount: sessionCountRows[0]?.count ?? 0,
        tradeCount: tradeAggRows[0]?.total_trades ?? 0,
        buyCount: tradeAggRows[0]?.buys ?? 0,
        sellCount: tradeAggRows[0]?.sells ?? 0,
        topSymbols: topSymbolRows.map((row) => ({
          symbol: row.symbol,
          trades: row.trades,
        })),
        storage: 'neon' as const,
        piiIncluded: false,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const students = Object.values(state.students).filter(
    (student) => student.classroomCode === classroomCode,
  );
  const activeSessionCount = Object.values(state.sessions).filter(
    (session) =>
      session.classroomCode === classroomCode &&
      session.expiresAt >= Date.now(),
  ).length;
  const classroomTrades = state.trades.filter(
    (trade) => trade.classroomCode === classroomCode,
  );

  let buyCount = 0;
  let sellCount = 0;
  const symbolActivity: Record<string, number> = {};
  for (const trade of classroomTrades) {
    if (trade.side === 'buy') {
      buyCount += 1;
    } else {
      sellCount += 1;
    }
    symbolActivity[trade.symbol] = (symbolActivity[trade.symbol] ?? 0) + 1;
  }
  const topSymbols = Object.entries(symbolActivity)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([symbol, trades]) => ({ symbol, trades }));

  return {
    classroomCode,
    asOf: nowIso(),
    retentionDays,
    studentCount: students.length,
    activeSessionCount,
    tradeCount: classroomTrades.length,
    buyCount,
    sellCount,
    topSymbols,
    storage: 'memory' as const,
    piiIncluded: false,
  };
}

export async function listStudentsForClassroom(input: ListStudentsInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const rows = (await sql`
        WITH student_holdings AS (
          SELECT
            s.id, s.username, s.is_active, s.cash, s.created_at,
            COALESCE(SUM((value)::numeric * COALESCE(mp.price, 0)), 0) AS holdings_value
          FROM students s
          LEFT JOIN LATERAL jsonb_each_text(s.positions) AS p(symbol, value) ON TRUE
          LEFT JOIN market_prices mp
            ON mp.classroom_code = s.classroom_code AND mp.symbol = p.symbol
          WHERE s.classroom_code = ${classroomCode}
          GROUP BY s.id, s.username, s.is_active, s.cash, s.created_at
        ),
        active_sessions AS (
          SELECT DISTINCT student_id FROM sessions
          WHERE classroom_code = ${classroomCode} AND expires_at >= ${Date.now()}
        )
        SELECT
          sh.id, sh.username, sh.is_active, sh.cash, sh.created_at, sh.holdings_value,
          (sh.cash + sh.holdings_value) AS total_value,
          (a.student_id IS NOT NULL) AS has_active_session
        FROM student_holdings sh
        LEFT JOIN active_sessions a ON a.student_id = sh.id
        ORDER BY sh.username ASC
      `) as Array<{
        id: string;
        username: string;
        is_active: boolean;
        cash: string | number;
        created_at: string;
        holdings_value: string | number;
        total_value: string | number;
        has_active_session: boolean;
      }>;

      const students: ClassroomStudentSummary[] = rows.map((row) => ({
        studentId: row.id,
        username: row.username,
        createdAt: new Date(row.created_at).toISOString(),
        isActive: Boolean(row.is_active),
        cash: Number(Number(row.cash).toFixed(2)),
        holdingsValue: Number(Number(row.holdings_value).toFixed(2)),
        totalValue: Number(Number(row.total_value).toFixed(2)),
        hasActiveSession: Boolean(row.has_active_session),
      }));

      return {
        classroomCode,
        asOf: nowIso(),
        studentCount: students.length,
        students,
        piiIncluded: true,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const activeStudentIds = new Set(
    Object.values(state.sessions)
      .filter(
        (session) =>
          session.classroomCode === classroomCode &&
          session.expiresAt >= Date.now(),
      )
      .map((session) => session.studentId),
  );

  const students: ClassroomStudentSummary[] = Object.values(state.students)
    .filter((student) => student.classroomCode === classroomCode)
    .map((student) => {
      const portfolio = getMemoryPortfolioSnapshot(state, student);
      return {
        studentId: student.id,
        username: student.username,
        createdAt: student.createdAt,
        isActive: isStudentActive(student),
        cash: portfolio.cash,
        holdingsValue: portfolio.holdingsValue,
        totalValue: portfolio.totalValue,
        hasActiveSession: activeStudentIds.has(student.id),
      };
    })
    .sort((a, b) => a.username.localeCompare(b.username));

  return {
    classroomCode,
    asOf: nowIso(),
    studentCount: students.length,
    students,
    piiIncluded: true,
    storage: 'memory' as const,
  };
}

export async function manageStudent(input: ManageStudentInput) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  const username = validateUsername(input.username);
  const normalizedUser = normalizeUsername(username);

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const studentRows = (await sql`
        SELECT id, is_active FROM students
        WHERE classroom_code = ${classroomCode} AND username = ${normalizedUser}
        LIMIT 1
      `) as Array<{ id: string; is_active: boolean }>;
      const studentRow = studentRows[0];
      if (!studentRow) {
        throw new StockGameError('Student account was not found.', 404);
      }
      const studentId = studentRow.id;
      const startingCash = getClassStartingCash(classroom);

      let isActive = Boolean(studentRow.is_active);

      if (input.action === 'reset') {
        await sql`
          UPDATE students
          SET cash = ${startingCash}, positions = '{}'::jsonb, updated_at = NOW()
          WHERE id = ${studentId}
        `;
        await sql`DELETE FROM sessions WHERE student_id = ${studentId}`;
        await sql`DELETE FROM trades WHERE student_id = ${studentId}`;
      } else if (input.action === 'deactivate') {
        await sql`
          UPDATE students SET is_active = FALSE, updated_at = NOW()
          WHERE id = ${studentId}
        `;
        await sql`DELETE FROM sessions WHERE student_id = ${studentId}`;
        isActive = false;
      } else if (input.action === 'activate') {
        await sql`
          UPDATE students SET is_active = TRUE, updated_at = NOW()
          WHERE id = ${studentId}
        `;
        isActive = true;
      }

      await clearCachedLeaderboard(classroomCode);
      return {
        classroomCode,
        username: normalizedUser,
        action: input.action,
        isActive,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const key = makeClassAndUserKey(classroomCode, username);
  const studentId = state.studentsByClassAndName[key];
  if (!studentId) {
    throw new StockGameError('Student account was not found.', 404);
  }
  const student = state.students[studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }

  if (input.action === 'reset') {
    student.cash = getClassStartingCash(classroom);
    student.positions = {};
    for (const [token, session] of Object.entries(state.sessions)) {
      if (session.studentId === studentId) {
        delete state.sessions[token];
      }
    }
    state.trades = state.trades.filter(
      (trade) => trade.studentId !== studentId,
    );
  } else if (input.action === 'deactivate') {
    student.isActive = false;
    for (const [token, session] of Object.entries(state.sessions)) {
      if (session.studentId === studentId) {
        delete state.sessions[token];
      }
    }
  } else if (input.action === 'activate') {
    student.isActive = true;
  }

  await clearCachedLeaderboard(classroomCode);
  return {
    classroomCode,
    username: normalizedUser,
    action: input.action,
    isActive: isStudentActive(student),
    storage: 'memory' as const,
  };
}

export async function manageClassroomStudents(
  input: ManageClassroomStudentsInput,
) {
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  if (input.action !== 'reset-all' && input.action !== 'restart-game') {
    throw new StockGameError('Unsupported classroom action.');
  }

  if (isNeonConfigured()) {
    return withDurableNeon(async () => {
      const sql = await getInitializedNeonSql();
      const classroom = await fetchNeonClassroom(classroomCode);
      if (!classroom) {
        throw new StockGameError('Classroom was not found.', 404);
      }
      authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

      const startingCash = getClassStartingCash(classroom);

      const studentCountRows = (await sql`
        SELECT COUNT(*)::int AS count FROM students WHERE classroom_code = ${classroomCode}
      `) as Array<{ count: number }>;
      const studentCount = studentCountRows[0]?.count ?? 0;

      await sql`
        UPDATE students
        SET cash = ${startingCash}, positions = '{}'::jsonb, updated_at = NOW()
        WHERE classroom_code = ${classroomCode}
      `;
      await sql`DELETE FROM sessions WHERE classroom_code = ${classroomCode}`;
      await sql`DELETE FROM trades WHERE classroom_code = ${classroomCode}`;

      let restartedAt: string | undefined;
      if (input.action === 'restart-game') {
        const newCreatedAt = nowIso();
        await sql`
          UPDATE classrooms
          SET created_at = ${newCreatedAt}, updated_at = NOW()
          WHERE code = ${classroomCode}
        `;
        await sql`DELETE FROM market_prices WHERE classroom_code = ${classroomCode}`;
        restartedAt = newCreatedAt;
      }

      await clearCachedLeaderboard(classroomCode);

      return {
        classroomCode,
        action: input.action,
        studentCount,
        startingCash,
        restartedAt,
        storage: 'neon' as const,
      };
    });
  }

  const state = loadMemoryState();
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }
  authorizeTeacher(classroom, teacherPasscode, input.teacherUserId);

  const startingCash = getClassStartingCash(classroom);
  const studentIdsToReset = Object.values(state.students)
    .filter((student) => student.classroomCode === classroomCode)
    .map((student) => student.id);

  for (const studentId of studentIdsToReset) {
    const student = state.students[studentId];
    if (!student) continue;
    student.cash = startingCash;
    student.positions = {};
  }
  for (const [token, session] of Object.entries(state.sessions)) {
    if (session.classroomCode === classroomCode) {
      delete state.sessions[token];
    }
  }
  state.trades = state.trades.filter(
    (trade) => trade.classroomCode !== classroomCode,
  );

  let restartedAt: string | undefined;
  if (input.action === 'restart-game') {
    classroom.createdAt = nowIso();
    delete state.marketPricesByClass[classroomCode];
    restartedAt = classroom.createdAt;
  }

  await clearCachedLeaderboard(classroomCode);
  return {
    classroomCode,
    action: input.action,
    studentCount: studentIdsToReset.length,
    startingCash,
    restartedAt,
    storage: 'memory' as const,
  };
}

export async function __resetStockGameState() {
  delete globalThis.__stockGameState;
  neonInitialized = false;
  getMemoryLeaderboardCache().clear();
  hasLoggedNeonFallback = false;
  __resetStudentAliasStore();

  if (!isNeonConfigured()) {
    return;
  }

  try {
    const sql = getNeonSql();
    // Clean both legacy and normalized state.
    await sql`DELETE FROM stock_game_state WHERE id = ${LEGACY_STATE_ROW_ID}`;
    await sql`DELETE FROM trades`;
    await sql`DELETE FROM sessions`;
    await sql`DELETE FROM market_prices`;
    await sql`DELETE FROM students`;
    await sql`DELETE FROM classrooms`;
  } catch {
    // Ignore reset failures in tests/dev.
  }
}
