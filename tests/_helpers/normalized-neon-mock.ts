import { vi } from 'vitest';

type Row = Record<string, unknown>;

export type NormalizedNeonStore = {
  classrooms: Map<string, Row>;
  studentsById: Map<string, Row>;
  sessions: Map<string, Row>;
  trades: Row[];
  marketPrices: Map<string, Map<string, Row>>; // classroom -> symbol -> row
  aliases: Row[];
  legacyState: Row | null;
};

function createStore(initial?: Partial<NormalizedNeonStore>): NormalizedNeonStore {
  return {
    classrooms: initial?.classrooms ?? new Map(),
    studentsById: initial?.studentsById ?? new Map(),
    sessions: initial?.sessions ?? new Map(),
    trades: initial?.trades ?? [],
    marketPrices: initial?.marketPrices ?? new Map(),
    aliases: initial?.aliases ?? [],
    legacyState: initial?.legacyState ?? null,
  };
}

function studentByClassUsername(
  store: NormalizedNeonStore,
  classroomCode: string,
  username: string,
): Row | null {
  for (const student of store.studentsById.values()) {
    if (
      student.classroom_code === classroomCode &&
      String(student.username).toLowerCase() === username.toLowerCase()
    ) {
      return student;
    }
  }
  return null;
}

function setMarketPrice(
  store: NormalizedNeonStore,
  classroomCode: string,
  symbol: string,
  price: number,
) {
  if (!store.marketPrices.has(classroomCode)) {
    store.marketPrices.set(classroomCode, new Map());
  }
  store.marketPrices.get(classroomCode)!.set(symbol, {
    classroom_code: classroomCode,
    symbol,
    price,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Builds a `vi.fn()` that mimics enough of the Neon serverless template-tag
 * driver to exercise our normalized stockGameStore code paths.
 *
 * Pattern matching is deliberately loose — it inspects lowercased SQL fragments
 * and reads bound values out of the template parameters. It is NOT a real
 * Postgres engine. It is just enough to make targeted tests work.
 */
export function createNormalizedNeonMock(initial?: Partial<NormalizedNeonStore>) {
  const store = createStore(initial);

  const sql = vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const raw = strings.join('?');
      const q = raw.toLowerCase();

      // ---- DDL: ignore ----
      if (
        q.includes('create table') ||
        q.includes('create index') ||
        q.includes('alter table')
      ) {
        return [];
      }

      // ---- placeTrade atomic CTE ----
      // Matched up-front because the CTE contains 'update students set',
      // 'insert into trades', and 'insert into market_prices' substrings that
      // would otherwise be claimed by less-specific branches below. Parameter
      // positions mirror lib/stockGameStore.ts placeTrade — keep in sync.
      if (q.includes('with trade_attempt as') && q.includes('update students')) {
        // Parameter index layout (one position per ${...}):
        //  [0]  cashDelta
        //  [1]  side  (CASE WHEN side::text = 'buy' THEN ... in positions)
        //  [2]  symbol (ARRAY[symbol] for buy jsonb_set)
        //  [3]  symbol (positions->>symbol for buy)
        //  [4]  shares (buy delta)
        //  [5]  symbol (positions->>symbol for sell guard inside positions CASE)
        //  [6]  shares (sell delta inside positions CASE)
        //  [7]  symbol (ARRAY[symbol] for sell jsonb_set)
        //  [8]  symbol (positions->>symbol inside sell jsonb_set)
        //  [9]  shares (sell jsonb_set delta)
        //  [10] symbol (positions - symbol ELSE branch)
        //  [11] studentId   (WHERE id = ...)
        //  [12] side        (CASE WHEN side::text = 'buy' THEN cash >= ?)
        //  [13] cost        (cash >= ?)
        //  [14] symbol      (sell guard COALESCE((positions->>symbol)::int, 0))
        //  [15] shares      (sell guard >= shares)
        //  [16] tradeId
        //  [17] symbol      (INSERT INTO trades VALUES symbol)
        //  [18] side
        //  [19] shares
        //  [20] price
        //  [21] quoteAsOf
        //  [22] executedAt
        //  [23] symbol      (market_prices upsert)
        //  [24] price
        const side = String(values[1]).toLowerCase() as 'buy' | 'sell';
        const symbol = String(values[2]);
        const shares = Number(values[4]);
        const studentId = String(values[11]);
        const cost = Number(values[13]);
        const tradeId = String(values[16]);
        const price = Number(values[20]);
        const quoteAsOf = String(values[21]);
        const executedAt = String(values[22]);

        const student = store.studentsById.get(studentId);
        if (!student) return [];

        const positions = { ...(student.positions as Record<string, number>) };
        const currentShares = Number(positions[symbol] ?? 0);
        const currentCash = Number(student.cash);

        if (side === 'buy') {
          if (currentCash < cost) return [];
          positions[symbol] = currentShares + shares;
        } else {
          if (currentShares < shares) return [];
          const remaining = currentShares - shares;
          if (remaining > 0) positions[symbol] = remaining;
          else delete positions[symbol];
        }

        const newCash = side === 'buy' ? currentCash - cost : currentCash + cost;
        const updated: Row = {
          ...student,
          cash: newCash,
          positions,
          updated_at: new Date().toISOString(),
        };
        store.studentsById.set(studentId, updated);

        store.trades.push({
          id: tradeId,
          classroom_code: student.classroom_code,
          student_id: studentId,
          symbol,
          side,
          shares,
          price,
          quote_as_of: quoteAsOf,
          executed_at: executedAt,
        });

        setMarketPrice(store, String(student.classroom_code), symbol, price);

        return [
          {
            id: studentId,
            classroom_code: student.classroom_code,
            cash: newCash,
            positions,
            username: student.username,
          },
        ];
      }

      // ---- Legacy stock_game_state ----
      if (q.includes('from stock_game_state')) {
        if (q.includes('select')) {
          return store.legacyState ? [{ data: store.legacyState }] : [];
        }
        if (q.includes('delete')) {
          store.legacyState = null;
          return [];
        }
      }
      if (q.includes('insert into stock_game_state')) {
        const incoming = values[1];
        store.legacyState =
          typeof incoming === 'string'
            ? (JSON.parse(incoming) as Row)
            : (incoming as Row);
        return [];
      }

      // ---- Aliases (from studentAliasStore) ----
      if (q.includes('from stock_game_student_aliases') && q.includes('select')) {
        const classroomCode = values[0] as string;
        return store.aliases.filter(
          (alias) => alias.classroom_code === classroomCode,
        );
      }

      // ---- Classroom counts / lookups ----
      if (q.includes('count(*)') && q.includes('from classrooms')) {
        return [{ count: store.classrooms.size }];
      }
      if (q.includes('from classrooms') && q.includes('where code')) {
        const code = values[0] as string;
        const c = store.classrooms.get(code);
        return c ? [c] : [];
      }

      // ---- Classrooms: insert / upsert ----
      if (q.includes('insert into classrooms')) {
        const code = values[0] as string;

        // ensureTeacherClassroom create form: 5 bound params, has RETURNING
        if (q.includes('returning')) {
          const row: Row = {
            code,
            teacher_passcode_hash: null,
            owner_teacher_id: values[1] ?? null,
            title: values[2] ?? null,
            starting_cash: values[3] ?? null,
            duration_days: values[4] ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          store.classrooms.set(code, row);
          return [row];
        }

        // Seed form: (code, teacher_passcode_hash, NOW()) — 2 bound params
        if (values.length === 2) {
          if (!store.classrooms.has(code)) {
            store.classrooms.set(code, {
              code,
              teacher_passcode_hash: values[1],
              owner_teacher_id: null,
              title: null,
              starting_cash: null,
              duration_days: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          return [];
        }

        // Migration form: 7 bound params with ON CONFLICT (code) DO NOTHING
        if (!store.classrooms.has(code)) {
          store.classrooms.set(code, {
            code,
            teacher_passcode_hash: values[1] ?? null,
            owner_teacher_id: values[2] ?? null,
            title: values[3] ?? null,
            starting_cash: values[4] ?? null,
            duration_days: values[5] ?? null,
            created_at: values[6],
            updated_at: new Date().toISOString(),
          });
        }
        return [];
      }

      // ---- Classrooms: update ----
      if (q.includes('update classrooms set')) {
        if (q.includes('owner_teacher_id') && q.includes('returning')) {
          // ensureTeacherClassroom existing path
          const ownerTeacherId = values[0];
          const title = values[1];
          const startingCash = values[2];
          const durationDays = values[3];
          const code = values[4] as string;
          const existing = store.classrooms.get(code);
          if (!existing) return [];
          const updated: Row = {
            ...existing,
            owner_teacher_id: ownerTeacherId,
            title,
            starting_cash: startingCash,
            duration_days: durationDays,
            updated_at: new Date().toISOString(),
          };
          store.classrooms.set(code, updated);
          return [updated];
        }
        if (q.includes('created_at')) {
          // restart-game: UPDATE classrooms SET created_at = ? WHERE code = ?
          const newCreatedAt = values[0];
          const code = values[1] as string;
          const existing = store.classrooms.get(code);
          if (existing) {
            store.classrooms.set(code, {
              ...existing,
              created_at: newCreatedAt,
            });
          }
          return [];
        }
      }

      // ---- Students: select by id ----
      if (
        q.includes('from students') &&
        q.includes('where id') &&
        q.includes('select')
      ) {
        const id = values[0] as string;
        const s = store.studentsById.get(id);
        return s ? [s] : [];
      }

      // ---- Students: select by classroom + username ----
      if (
        q.includes('from students') &&
        q.includes('where classroom_code') &&
        q.includes('username') &&
        q.includes('select')
      ) {
        if (q.includes('select username')) {
          const classroomCode = values[0] as string;
          return Array.from(store.studentsById.values())
            .filter((s) => s.classroom_code === classroomCode)
            .map((s) => ({ username: s.username }));
        }
        const classroomCode = values[0] as string;
        const username = values[1] as string;
        const s = studentByClassUsername(store, classroomCode, username);
        if (!s) return [];
        if (q.includes('select id, is_active')) {
          return [{ id: s.id, is_active: s.is_active }];
        }
        return [s];
      }

      // ---- Students: insert ----
      if (q.includes('insert into students')) {
        if (q.includes('from unnest')) {
          // createStudentsBatch:
          //   values[0]=classroomCode, values[1]=startingCash, values[2]=createdAt,
          //   values[3]=ids[], values[4]=usernames[], values[5]=passcodeHashes[]
          const classroomCode = values[0] as string;
          const startingCash = Number(values[1] ?? 10000);
          const createdAt = values[2];
          const ids = values[3] as string[];
          const usernames = values[4] as string[];
          const passcodeHashes = values[5] as string[];
          for (let i = 0; i < ids.length; i++) {
            store.studentsById.set(ids[i], {
              id: ids[i],
              classroom_code: classroomCode,
              username: usernames[i],
              passcode_hash: passcodeHashes[i],
              is_active: true,
              cash: startingCash,
              positions: {},
              created_at: createdAt,
              updated_at: new Date().toISOString(),
            });
          }
          return [];
        }

        // Single insert — three known forms:
        //   6 params: createStudent(id, classroomCode, username, passcodeHash, cash, createdAt)
        //   7 params: recovery(id, classroomCode, username, passcodeHash, isActive, cash, createdAt)
        //   8 params: migration(id, classroomCode, username, passcodeHash, isActive, cash, positions, createdAt)
        const id = values[0] as string;
        const classroomCode = values[1] as string;
        const username = String(values[2]);
        const passcodeHash = values[3] as string;

        let isActive = true;
        let cash = 10000;
        let parsedPositions: Record<string, number> = {};
        let createdAt: unknown = new Date().toISOString();

        if (values.length === 6) {
          cash = Number(values[4] ?? 10000);
          createdAt = values[5];
        } else if (values.length === 7) {
          isActive = Boolean(values[4]);
          cash = Number(values[5] ?? 10000);
          createdAt = values[6];
        } else if (values.length === 8) {
          isActive = Boolean(values[4]);
          cash = Number(values[5] ?? 10000);
          const raw = values[6];
          if (typeof raw === 'string') {
            try {
              parsedPositions = JSON.parse(raw) as Record<string, number>;
            } catch {
              parsedPositions = {};
            }
          } else if (raw && typeof raw === 'object') {
            parsedPositions = raw as Record<string, number>;
          }
          createdAt = values[7];
        }

        const dup =
          studentByClassUsername(store, classroomCode, username) ||
          store.studentsById.get(id);
        if (dup) {
          if (q.includes('on conflict')) {
            return [];
          }
          throw new Error('duplicate key value violates unique constraint');
        }

        store.studentsById.set(id, {
          id,
          classroom_code: classroomCode,
          username,
          passcode_hash: passcodeHash,
          is_active: isActive,
          cash,
          positions: parsedPositions,
          created_at: createdAt,
          updated_at: new Date().toISOString(),
        });
        return [];
      }

      // ---- Students: update / delete ----
      // Use bare 'update students' (no trailing 'set') so multi-line SQL
      // where SET sits on its own line still matches. The trade CTE is
      // claimed by the placeTrade branch above this block.
      if (q.includes('update students')) {
        // manageStudent.reset: SET cash = ?, positions = '{}'::jsonb WHERE id = ?
        if (
          q.includes('cash =') &&
          q.includes("positions = '{}'::jsonb") &&
          q.includes('where id')
        ) {
          const cash = Number(values[0] ?? 0);
          const id = values[1] as string;
          const existing = store.studentsById.get(id);
          if (existing) {
            store.studentsById.set(id, {
              ...existing,
              cash,
              positions: {},
              updated_at: new Date().toISOString(),
            });
          }
          return [];
        }
        // manageStudent.deactivate: SET is_active = FALSE WHERE id = ?
        // manageStudent.activate:   SET is_active = TRUE  WHERE id = ?
        if (q.includes('is_active = false') && q.includes('where id')) {
          const id = values[0] as string;
          const existing = store.studentsById.get(id);
          if (existing) {
            store.studentsById.set(id, {
              ...existing,
              is_active: false,
              updated_at: new Date().toISOString(),
            });
          }
          return [];
        }
        if (q.includes('is_active = true') && q.includes('where id')) {
          const id = values[0] as string;
          const existing = store.studentsById.get(id);
          if (existing) {
            store.studentsById.set(id, {
              ...existing,
              is_active: true,
              updated_at: new Date().toISOString(),
            });
          }
          return [];
        }
        return [];
      }
      if (q.includes('delete from students')) {
        if (q.includes('where classroom_code') && q.includes('username')) {
          const classroomCode = values[0] as string;
          const username = values[1] as string;
          const target = studentByClassUsername(store, classroomCode, username);
          if (!target) return [];
          store.studentsById.delete(String(target.id));
          return [{ id: target.id }];
        }
        store.studentsById.clear();
        return [];
      }

      // ---- Sessions ----
      if (q.includes('insert into sessions')) {
        const token = values[0] as string;
        store.sessions.set(token, {
          token,
          student_id: values[1],
          classroom_code: values[2],
          expires_at: values[3],
          created_at: new Date().toISOString(),
        });
        return [];
      }
      if (q.includes('from sessions')) {
        if (q.includes('select') && q.includes('count(*)')) {
          const classroomCode = values[0] as string;
          const minExpires = Number(values[1]);
          let count = 0;
          for (const s of store.sessions.values()) {
            if (
              s.classroom_code === classroomCode &&
              Number(s.expires_at) >= minExpires
            ) {
              count++;
            }
          }
          return [{ count }];
        }
        if (q.includes('select') && q.includes('join students')) {
          // assertCanAttemptStudentTrade or listStudentTrades inner JOIN
          const token = values[0] as string;
          const session = store.sessions.get(token);
          if (!session) return [];
          const student = store.studentsById.get(String(session.student_id));
          if (!student) return [];
          const classroom = store.classrooms.get(String(session.classroom_code));
          if (!classroom) return [];
          if (q.includes('classroom_code_actual')) {
            // assertCanAttemptStudentTrade widens the JOIN to hand back a full
            // Classroom row; keys must match the c.* AS classroom_* aliases in
            // lib/stockGameStore.ts so decodeNeonClassroom decodes correctly.
            return [
              {
                token: session.token,
                student_id: session.student_id,
                classroom_code: session.classroom_code,
                expires_at: session.expires_at,
                username: student.username,
                is_active: student.is_active,
                classroom_code_actual: classroom.code,
                classroom_teacher_passcode_hash: classroom.teacher_passcode_hash,
                classroom_owner_teacher_id: classroom.owner_teacher_id,
                classroom_title: classroom.title,
                classroom_starting_cash: classroom.starting_cash,
                classroom_duration_days: classroom.duration_days,
                classroom_created_at: classroom.created_at,
              },
            ];
          }
          return [
            {
              student_id: session.student_id,
              classroom_code: session.classroom_code,
              expires_at: session.expires_at,
              username: student.username,
            },
          ];
        }
        if (q.includes('select') && q.includes('where token')) {
          const token = values[0] as string;
          const s = store.sessions.get(token);
          return s ? [s] : [];
        }
      }
      if (q.includes('delete from sessions')) {
        if (q.includes('where token')) {
          store.sessions.delete(values[0] as string);
          return [];
        }
        if (q.includes('where student_id')) {
          for (const [token, s] of store.sessions.entries()) {
            if (s.student_id === values[0]) store.sessions.delete(token);
          }
          return [];
        }
        if (q.includes('where classroom_code')) {
          for (const [token, s] of store.sessions.entries()) {
            if (s.classroom_code === values[0]) store.sessions.delete(token);
          }
          return [];
        }
        if (q.includes('where expires_at')) {
          const cutoff = Number(values[0]);
          for (const [token, s] of store.sessions.entries()) {
            if (Number(s.expires_at) < cutoff) store.sessions.delete(token);
          }
          return [];
        }
        store.sessions.clear();
        return [];
      }

      // ---- Trades ----
      if (q.includes('insert into trades')) {
        store.trades.push({
          id: values[0],
          classroom_code: values[1],
          student_id: values[2],
          symbol: values[3],
          side: values[4],
          shares: values[5],
          price: values[6],
          quote_as_of: values[7],
          executed_at: values[8],
        });
        return [];
      }
      // Guard SELECT-shaped branches with q.includes('select') so DELETE
      // FROM trades doesn't get claimed here (DELETE keeps "from trades" in
      // its SQL).
      if (q.includes('from trades') && q.includes('select')) {
        if (q.includes('count(*)') && q.includes('total_trades')) {
          const classroomCode = values[0] as string;
          const filtered = store.trades.filter(
            (t) => t.classroom_code === classroomCode,
          );
          return [
            {
              total_trades: filtered.length,
              buys: filtered.filter((t) => t.side === 'buy').length,
              sells: filtered.filter((t) => t.side === 'sell').length,
            },
          ];
        }
        if (q.includes('group by symbol')) {
          const classroomCode = values[0] as string;
          const counts = new Map<string, number>();
          for (const t of store.trades) {
            if (t.classroom_code === classroomCode) {
              counts.set(
                String(t.symbol),
                (counts.get(String(t.symbol)) ?? 0) + 1,
              );
            }
          }
          return Array.from(counts.entries())
            .map(([symbol, trades]) => ({ symbol, trades }))
            .sort((a, b) => b.trades - a.trades || a.symbol.localeCompare(b.symbol))
            .slice(0, 5);
        }
        if (q.includes('where student_id')) {
          const studentId = values[0] as string;
          const limit = Number(values[1] ?? 20);
          return store.trades
            .filter((t) => t.student_id === studentId)
            .sort(
              (a, b) =>
                Date.parse(String(b.executed_at)) -
                Date.parse(String(a.executed_at)),
            )
            .slice(0, limit);
        }
      }
      if (q.includes('delete from trades')) {
        if (q.includes('where student_id')) {
          store.trades = store.trades.filter((t) => t.student_id !== values[0]);
          return [];
        }
        if (q.includes('where classroom_code')) {
          store.trades = store.trades.filter(
            (t) => t.classroom_code !== values[0],
          );
          return [];
        }
        if (q.includes('where executed_at')) {
          const cutoff = String(values[0]);
          store.trades = store.trades.filter(
            (t) => String(t.executed_at) >= cutoff,
          );
          return [];
        }
        store.trades = [];
        return [];
      }

      // ---- Market prices ----
      if (q.includes('insert into market_prices')) {
        const classroomCode = values[0] as string;
        const symbol = values[1] as string;
        const price = Number(values[2]);
        setMarketPrice(store, classroomCode, symbol, price);
        return [];
      }
      if (q.includes('from market_prices')) {
        const classroomCode = values[0] as string;
        const map = store.marketPrices.get(classroomCode);
        if (!map) return [];
        return Array.from(map.values()).map((row) => ({
          symbol: row.symbol,
          price: row.price,
        }));
      }
      if (q.includes('delete from market_prices')) {
        if (q.includes('where classroom_code')) {
          store.marketPrices.delete(values[0] as string);
          return [];
        }
        store.marketPrices.clear();
        return [];
      }

      // ---- Leaderboard / roster aggregates ----
      if (q.includes('jsonb_each_text')) {
        // students × market_prices aggregation
        const classroomCode = values[0] as string;
        const minExpires = q.includes('expires_at') ? Number(values[1]) : 0;
        const prices = store.marketPrices.get(classroomCode) ?? new Map();
        const studentsInClass = Array.from(store.studentsById.values()).filter(
          (s) => s.classroom_code === classroomCode,
        );
        const activeIds = new Set<string>();
        for (const s of store.sessions.values()) {
          if (
            s.classroom_code === classroomCode &&
            Number(s.expires_at) >= minExpires
          ) {
            activeIds.add(String(s.student_id));
          }
        }
        const rows = studentsInClass.map((s) => {
          const positions = (s.positions as Record<string, number>) ?? {};
          let holdings = 0;
          for (const [symbol, shares] of Object.entries(positions)) {
            const p = prices.get(symbol);
            if (p) holdings += Number(shares) * Number(p.price);
          }
          const cash = Number(s.cash);
          return {
            id: s.id,
            username: s.username,
            is_active: s.is_active,
            cash,
            created_at: s.created_at,
            holdings_value: holdings,
            total_value: cash + holdings,
            has_active_session: activeIds.has(String(s.id)),
          };
        });
        if (q.includes('order by total_value')) {
          rows.sort(
            (a, b) =>
              b.total_value - a.total_value ||
              String(a.username).localeCompare(String(b.username)),
          );
        } else {
          rows.sort((a, b) =>
            String(a.username).localeCompare(String(b.username)),
          );
        }
        return rows;
      }

      // Default: return empty
      return [];
    },
  );

  return { sql, store };
}
