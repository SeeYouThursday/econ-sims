import { createHash, randomUUID } from 'crypto';
import { getRedisClient, isRedisConfigured } from './redis';
import { __resetStudentAliasStore } from './studentAliasStore';

type TradeSide = 'buy' | 'sell';

type Classroom = {
  code: string;
  teacherPasscodeHash?: string;
  ownerTeacherId?: string;
  title?: string;
  startingCash?: number;
  createdAt: string;
};

type Student = {
  id: string;
  classroomCode: string;
  username: string;
  studentPasscode?: string;
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
  studentPasscode: string | null;
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
  action: 'reset-all';
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

const STARTING_CASH = 10000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LEADERBOARD_TTL_MS = 60 * 1000;
const TRADE_RETENTION_DAYS = Number(
  process.env.STOCK_GAME_TRADE_RETENTION_DAYS ?? '180',
);
const STATE_KEY = 'econ-sims:stock-game:state';
const LEADERBOARD_KEY_PREFIX = 'econ-sims:stock-game:leaderboard';

let hasLoggedRedisFallback = false;

function logRedisFallback(message: string, error?: unknown) {
  if (hasLoggedRedisFallback) {
    return;
  }

  hasLoggedRedisFallback = true;
  if (error) {
    console.error(message, error);
    return;
  }

  console.error(message);
}

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

function purgeExpiredData(state: PersistedState) {
  let changed = false;

  const now = Date.now();
  for (const [token, session] of Object.entries(state.sessions)) {
    if (session.expiresAt < now) {
      delete state.sessions[token];
      changed = true;
    }
  }

  const retentionDays = Number.isFinite(TRADE_RETENTION_DAYS)
    ? Math.max(1, Math.trunc(TRADE_RETENTION_DAYS))
    : 180;
  const cutoffMs = now - retentionDays * 24 * 60 * 60 * 1000;
  const retainedTrades = state.trades.filter((trade) => {
    const executedMs = Date.parse(trade.executedAt);
    return Number.isFinite(executedMs) && executedMs >= cutoffMs;
  });

  if (retainedTrades.length !== state.trades.length) {
    state.trades = retainedTrades;
    changed = true;
  }

  return changed;
}

async function loadState() {
  if (!isRedisConfigured()) {
    if (!globalThis.__stockGameState) {
      globalThis.__stockGameState = createEmptyState();
      ensureSeedClassroom(globalThis.__stockGameState);
    }

    return globalThis.__stockGameState;
  }

  let redis = null;
  try {
    redis = await getRedisClient();
  } catch (error) {
    logRedisFallback('Redis unavailable while loading stock game state', error);
  }

  if (!redis) {
    if (!globalThis.__stockGameState) {
      globalThis.__stockGameState = createEmptyState();
      ensureSeedClassroom(globalThis.__stockGameState);
    }
    return globalThis.__stockGameState;
  }

  try {
    const raw = await redis.get(STATE_KEY);
    const fallbackState = globalThis.__stockGameState;
    const state = raw
      ? (JSON.parse(raw) as PersistedState)
      : (fallbackState ?? createEmptyState());
    const beforeSeedCount = Object.keys(state.classrooms).length;
    ensureSeedClassroom(state);
    const purged = purgeExpiredData(state);

    // Keep process-local fallback in sync so request paths in the same dev
    // process can continue when Redis writes are intermittently failing.
    globalThis.__stockGameState = state;

    if (
      !raw ||
      Object.keys(state.classrooms).length !== beforeSeedCount ||
      purged
    ) {
      await redis.set(STATE_KEY, JSON.stringify(state));
    }

    return state;
  } catch (error) {
    logRedisFallback(
      'Redis read failed, using in-memory stock game state',
      error,
    );
    if (!globalThis.__stockGameState) {
      globalThis.__stockGameState = createEmptyState();
      ensureSeedClassroom(globalThis.__stockGameState);
    }
    return globalThis.__stockGameState;
  }
}

async function saveState(state: PersistedState) {
  if (!isRedisConfigured()) {
    globalThis.__stockGameState = state;
    return;
  }

  let redis = null;
  try {
    redis = await getRedisClient();
  } catch (error) {
    logRedisFallback('Redis unavailable while saving stock game state', error);
  }

  if (!redis) {
    globalThis.__stockGameState = state;
    return;
  }

  try {
    await redis.set(STATE_KEY, JSON.stringify(state));
  } catch (error) {
    logRedisFallback('Redis write failed, state stored in-memory only', error);
    globalThis.__stockGameState = state;
  }
}

function leaderboardCacheKey(classroomCode: string) {
  return `${LEADERBOARD_KEY_PREFIX}:${classroomCode}`;
}

async function getCachedLeaderboard(classroomCode: string) {
  if (!isRedisConfigured()) {
    const cached = getMemoryLeaderboardCache().get(classroomCode);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.data,
        source: 'cache' as const,
      };
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

  if (!redis) {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = await redis.get(leaderboardCacheKey(classroomCode));
  } catch {
    raw = null;
  }

  if (!raw) {
    return null;
  }

  const data = JSON.parse(raw) as LeaderboardResponse;
  return {
    ...data,
    source: 'cache' as const,
  };
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

  if (!redis) {
    return;
  }

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

  if (!redis) {
    return;
  }

  try {
    await redis.del(leaderboardCacheKey(classroomCode));
  } catch {
    // Cache invalidation failure should not block updates.
  }
}

function ensureClassroom(
  state: PersistedState,
  classroomCode: string,
  teacherPasscode?: string,
  teacherUserId?: string,
) {
  const classroom = state.classrooms[classroomCode];
  if (!classroom) {
    throw new StockGameError('Classroom was not found.', 404);
  }

  if (classroom.ownerTeacherId) {
    if (teacherUserId === classroom.ownerTeacherId) {
      return classroom;
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

  return classroom;
}

function getClassStartingCash(classroom?: Classroom) {
  return classroom?.startingCash ?? STARTING_CASH;
}

export async function ensureTeacherClassroom({
  classroomCode,
  teacherUserId,
  title,
  startingCash,
}: {
  classroomCode: string;
  teacherUserId: string;
  title?: string;
  startingCash?: number;
}) {
  const state = await loadState();
  const normalizedCode = validateClassroomCode(classroomCode);
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
    };
    await saveState(state);
    return state.classrooms[normalizedCode];
  }

  state.classrooms[normalizedCode] = {
    code: normalizedCode,
    ownerTeacherId: teacherUserId,
    title,
    startingCash: startingCash ?? STARTING_CASH,
    createdAt: nowIso(),
  };
  await saveState(state);
  return state.classrooms[normalizedCode];
}

function getActiveSession(state: PersistedState, token: string) {
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

function getMarketPrice(
  state: PersistedState,
  classroomCode: string,
  symbol: string,
) {
  return state.marketPricesByClass[classroomCode]?.[symbol] ?? 0;
}

function getPortfolioSnapshot(
  state: PersistedState,
  student: Student,
): PortfolioSnapshot {
  const classroom = state.classrooms[student.classroomCode];
  const classStartingCash = getClassStartingCash(classroom);
  const holdingsValue = Object.entries(student.positions).reduce(
    (sum, [symbol, shares]) => {
      return (
        sum + shares * getMarketPrice(state, student.classroomCode, symbol)
      );
    },
    0,
  );

  const totalValue = Number((student.cash + holdingsValue).toFixed(2));
  const pnlValue = Number((totalValue - classStartingCash).toFixed(2));
  const pnlPercent = Number(((pnlValue / classStartingCash) * 100).toFixed(2));

  return {
    studentId: student.id,
    classroomCode: student.classroomCode,
    username: student.username,
    cash: Number(student.cash.toFixed(2)),
    positions: { ...student.positions },
    holdingsValue: Number(holdingsValue.toFixed(2)),
    totalValue,
    pnlValue,
    pnlPercent,
  };
}

export async function createStudent(input: CreateStudentInput) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  const username = validateUsername(input.username);
  const studentPasscode = validatePasscode(
    input.studentPasscode,
    'Student passcode',
  );

  const classroom = ensureClassroom(
    state,
    classroomCode,
    teacherPasscode,
    input.teacherUserId,
  );
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
    username,
    studentPasscode,
    passcodeHash: hashSecret(studentPasscode),
    isActive: true,
    cash: classStartingCash,
    positions: {},
    createdAt: nowIso(),
  };

  state.students[id] = student;
  state.studentsByClassAndName[key] = id;
  await saveState(state);

  return {
    studentId: id,
    classroomCode,
    username: student.username,
    startingCash: classStartingCash,
    createdAt: student.createdAt,
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function createStudentsBatch(input: CreateStudentsBatchInput) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  const classroom = ensureClassroom(
    state,
    classroomCode,
    teacherPasscode,
    input.teacherUserId,
  );
  const classStartingCash = getClassStartingCash(classroom);

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

    const key = makeClassAndUserKey(classroomCode, entry.username);
    if (state.studentsByClassAndName[key]) {
      throw new StockGameError(
        `Username is already assigned in this classroom: ${entry.username}`,
        409,
      );
    }

    seenUsernames.add(entry.username);
  }

  const createdAt = nowIso();
  const createdStudents = normalizedStudents.map((entry) => {
    const studentId = randomUUID();
    const student: Student = {
      id: studentId,
      classroomCode,
      username: entry.username,
      studentPasscode: entry.studentPasscode,
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
      username: entry.username,
      startingCash: classStartingCash,
      createdAt,
    };
  });

  await saveState(state);

  return {
    classroomCode,
    createdCount: createdStudents.length,
    students: createdStudents,
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function loginStudent(input: LoginInput) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const username = validateUsername(input.username);
  const studentPasscode = validatePasscode(
    input.studentPasscode,
    'Student passcode',
  );

  const key = makeClassAndUserKey(classroomCode, username);
  const studentId = state.studentsByClassAndName[key];
  if (!studentId) {
    throw new StockGameError('Student account was not found.', 404);
  }

  const student = state.students[studentId];
  if (!student || student.passcodeHash !== hashSecret(studentPasscode)) {
    throw new StockGameError('Invalid username or passcode.', 401);
  }

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
  await saveState(state);

  return {
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    studentId,
    classroomCode,
    username: student.username,
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function placeTrade(input: PlaceTradeInput) {
  const state = await loadState();
  const token = input.token.trim();
  if (!token) {
    throw new StockGameError('Session token is required.', 401);
  }

  const session = getActiveSession(state, token);
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }

  const symbol = normalizeSymbol(input.symbol);
  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
    throw new StockGameError('Symbol format is invalid.');
  }

  if (input.side !== 'buy' && input.side !== 'sell') {
    throw new StockGameError('Trade side must be buy or sell.');
  }

  if (
    !Number.isFinite(input.shares) ||
    input.shares <= 0 ||
    !Number.isInteger(input.shares)
  ) {
    throw new StockGameError('Shares must be a positive whole number.');
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new StockGameError('Price must be a positive number.');
  }

  const cost = Number((input.shares * input.price).toFixed(2));
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
  state.marketPricesByClass[session.classroomCode][symbol] = Number(
    input.price.toFixed(2),
  );

  const executedAt = nowIso();
  const quoteAsOf = input.quoteAsOf?.trim() || executedAt.slice(0, 10);
  state.trades.push({
    id: randomUUID(),
    classroomCode: session.classroomCode,
    studentId: student.id,
    symbol,
    side: input.side,
    shares: input.shares,
    price: Number(input.price.toFixed(2)),
    quoteAsOf,
    executedAt,
  });

  await saveState(state);
  await clearCachedLeaderboard(session.classroomCode);

  return {
    portfolio: getPortfolioSnapshot(state, student),
    latestPrice: Number(input.price.toFixed(2)),
    quoteAsOf,
    executedAt,
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function listStudentTrades(
  tokenInput: string,
  limitInput = 20,
): Promise<StudentTradeHistoryResponse> {
  const state = await loadState();
  const token = tokenInput.trim();
  if (!token) {
    throw new StockGameError('Session token is required.', 401);
  }

  const session = getActiveSession(state, token);
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }

  const limit = Number.isFinite(limitInput)
    ? Math.max(1, Math.min(100, Math.trunc(limitInput)))
    : 20;

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

  await saveState(state);

  return {
    classroomCode: session.classroomCode,
    username: student.username,
    asOf: nowIso(),
    trades,
  };
}

export async function getPortfolio(token: string) {
  const state = await loadState();
  const session = getActiveSession(state, token.trim());
  const student = state.students[session.studentId];
  if (!student) {
    throw new StockGameError('Student account was not found.', 404);
  }

  const portfolio = getPortfolioSnapshot(state, student);
  await saveState(state);
  return portfolio;
}

export async function getLeaderboard(
  classroomCodeInput: string,
): Promise<LeaderboardResponse> {
  const state = await loadState();
  const classroomCode = validateClassroomCode(classroomCodeInput);

  if (!state.classrooms[classroomCode]) {
    throw new StockGameError('Classroom was not found.', 404);
  }

  const cached = await getCachedLeaderboard(classroomCode);
  if (cached) {
    return cached;
  }

  const portfolios = Object.values(state.students)
    .filter((student) => student.classroomCode === classroomCode)
    .map((student) => getPortfolioSnapshot(state, student))
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
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  const username = validateUsername(input.username);

  ensureClassroom(state, classroomCode, teacherPasscode, input.teacherUserId);

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

  await saveState(state);
  await clearCachedLeaderboard(classroomCode);

  return {
    classroomCode,
    username,
    deleted: true,
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function getTeacherAudit(input: TeacherAuditInput) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  ensureClassroom(state, classroomCode, teacherPasscode, input.teacherUserId);

  const students = Object.values(state.students).filter(
    (student) => student.classroomCode === classroomCode,
  );
  const activeSessionCount = Object.values(state.sessions).filter(
    (session) => session.classroomCode === classroomCode,
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
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol, trades]) => ({ symbol, trades }));

  return {
    classroomCode,
    asOf: nowIso(),
    retentionDays: Number.isFinite(TRADE_RETENTION_DAYS)
      ? Math.max(1, Math.trunc(TRADE_RETENTION_DAYS))
      : 180,
    studentCount: students.length,
    activeSessionCount,
    tradeCount: classroomTrades.length,
    buyCount,
    sellCount,
    topSymbols,
    storage: isRedisConfigured() ? 'redis' : 'memory',
    piiIncluded: false,
  };
}

export async function listStudentsForClassroom(input: ListStudentsInput) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  ensureClassroom(state, classroomCode, teacherPasscode, input.teacherUserId);

  const activeStudentIds = new Set(
    Object.values(state.sessions)
      .filter((session) => session.classroomCode === classroomCode)
      .map((session) => session.studentId),
  );

  const students: ClassroomStudentSummary[] = Object.values(state.students)
    .filter((student) => student.classroomCode === classroomCode)
    .map((student) => {
      const portfolio = getPortfolioSnapshot(state, student);
      return {
        studentId: student.id,
        username: student.username,
        studentPasscode: student.studentPasscode ?? null,
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
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function manageStudent(input: ManageStudentInput) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;
  const username = validateUsername(input.username);

  const classroom = ensureClassroom(
    state,
    classroomCode,
    teacherPasscode,
    input.teacherUserId,
  );

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

  await saveState(state);
  await clearCachedLeaderboard(classroomCode);

  return {
    classroomCode,
    username,
    action: input.action,
    isActive: isStudentActive(student),
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function manageClassroomStudents(
  input: ManageClassroomStudentsInput,
) {
  const state = await loadState();
  const classroomCode = validateClassroomCode(input.classroomCode);
  const teacherPasscode = input.teacherPasscode
    ? validatePasscode(input.teacherPasscode, 'Teacher passcode')
    : undefined;

  const classroom = ensureClassroom(
    state,
    classroomCode,
    teacherPasscode,
    input.teacherUserId,
  );

  if (input.action !== 'reset-all') {
    throw new StockGameError('Unsupported classroom action.');
  }

  const classStartingCash = getClassStartingCash(classroom);
  const studentIdsToReset = Object.values(state.students)
    .filter((student) => student.classroomCode === classroomCode)
    .map((student) => student.id);

  for (const studentId of studentIdsToReset) {
    const student = state.students[studentId];
    if (!student) {
      continue;
    }

    student.cash = classStartingCash;
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

  await saveState(state);
  await clearCachedLeaderboard(classroomCode);

  return {
    classroomCode,
    action: input.action,
    studentCount: studentIdsToReset.length,
    startingCash: classStartingCash,
    storage: isRedisConfigured() ? 'redis' : 'memory',
  };
}

export async function __resetStockGameState() {
  delete globalThis.__stockGameState;
  getMemoryLeaderboardCache().clear();
  hasLoggedRedisFallback = false;
  __resetStudentAliasStore();

  if (!isRedisConfigured()) {
    return;
  }

  let redis = null;
  try {
    redis = await getRedisClient();
  } catch {
    redis = null;
  }

  if (!redis) {
    return;
  }

  const seedCode = normalizeClassroomCode(
    process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101',
  );

  try {
    await redis.del(STATE_KEY);
    await redis.del(leaderboardCacheKey(seedCode));
  } catch {
    // Ignore reset cache failures in tests/dev.
  }
}
