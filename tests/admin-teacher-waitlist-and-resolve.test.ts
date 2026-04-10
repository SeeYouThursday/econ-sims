import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadWaitlistRoute(options: {
  userId: string | null;
  listResult?: {
    data: Array<{
      id: string;
      emailAddress: string;
      status: string;
      createdAt: number;
      updatedAt: number;
    }>;
    totalCount?: number;
  };
}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
  vi.stubEnv('TEACHER_ADMIN_USER_IDS', 'user_admin');

  const list = vi.fn(async () => ({
    data: options.listResult?.data ?? [],
    totalCount: options.listResult?.totalCount ?? 0,
  }));
  const invite = vi.fn(async (id: string) => ({
    id,
    emailAddress: 'teacher@example.org',
    status: 'invited',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
  const reject = vi.fn(async (id: string) => ({
    id,
    emailAddress: 'teacher@example.org',
    status: 'rejected',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  vi.doMock('@clerk/nextjs/server', () => ({
    auth: vi.fn(async () => ({ userId: options.userId })),
    clerkClient: vi.fn(async () => ({
      waitlistEntries: {
        list,
        invite,
        reject,
      },
      users: {
        getUserList: vi.fn(),
      },
    })),
  }));

  const route = await import('../app/api/admin/teachers/waitlist/route');
  return { route, mocks: { list, invite, reject } };
}

async function loadResolveUserRoute(options: {
  userId: string | null;
  users: Array<{ id: string }>;
}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
  vi.stubEnv('TEACHER_ADMIN_USER_IDS', 'user_admin');

  const getUserList = vi.fn(async () => ({ data: options.users }));

  vi.doMock('@clerk/nextjs/server', () => ({
    auth: vi.fn(async () => ({ userId: options.userId })),
    clerkClient: vi.fn(async () => ({
      users: {
        getUserList,
      },
      waitlistEntries: {
        list: vi.fn(),
        invite: vi.fn(),
        reject: vi.fn(),
      },
    })),
  }));

  const route = await import('../app/api/admin/teachers/resolve-user/route');
  return { route, mocks: { getUserList } };
}

describe('admin waitlist and resolve-user routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('blocks waitlist listing for non-admin users', async () => {
    const { route } = await loadWaitlistRoute({ userId: 'user_not_admin' });

    const response = await route.GET(
      new Request('http://localhost/api/admin/teachers/waitlist'),
    );

    expect(response.status).toBe(403);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('not authorized');
  });

  it('lists waitlist entries for an admin user', async () => {
    const now = Date.now();
    const { route, mocks } = await loadWaitlistRoute({
      userId: 'user_admin',
      listResult: {
        data: [
          {
            id: 'wl_123',
            emailAddress: 'teacher@example.org',
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          },
        ],
        totalCount: 1,
      },
    });

    const response = await route.GET(
      new Request('http://localhost/api/admin/teachers/waitlist'),
    );

    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledTimes(1);

    const payload = (await response.json()) as {
      entries: Array<{ id: string; emailAddress: string; status: string }>;
      totalCount: number;
    };

    expect(payload.totalCount).toBe(1);
    expect(payload.entries[0]).toMatchObject({
      id: 'wl_123',
      emailAddress: 'teacher@example.org',
      status: 'pending',
    });
  });

  it('runs waitlist invite and reject actions', async () => {
    const { route, mocks } = await loadWaitlistRoute({ userId: 'user_admin' });

    const inviteRes = await route.POST(
      new Request('http://localhost/api/admin/teachers/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          waitlistEntryId: 'wl_invite',
          action: 'invite',
        }),
      }),
    );

    expect(inviteRes.status).toBe(200);
    expect(mocks.invite).toHaveBeenCalledWith('wl_invite', {
      ignoreExisting: true,
    });

    const rejectRes = await route.POST(
      new Request('http://localhost/api/admin/teachers/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          waitlistEntryId: 'wl_reject',
          action: 'reject',
        }),
      }),
    );

    expect(rejectRes.status).toBe(200);
    expect(mocks.reject).toHaveBeenCalledWith('wl_reject');
  });

  it('resolves a single Clerk user id from waitlist email', async () => {
    const { route, mocks } = await loadResolveUserRoute({
      userId: 'user_admin',
      users: [{ id: 'user_teacher_1' }],
    });

    const response = await route.POST(
      new Request('http://localhost/api/admin/teachers/resolve-user', {
        method: 'POST',
        body: JSON.stringify({ emailAddress: 'Teacher@Example.org' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getUserList).toHaveBeenCalled();

    const payload = (await response.json()) as {
      emailAddress: string;
      matchCount: number;
      clerkUserId: string | null;
      candidateUserIds: string[];
    };

    expect(payload.emailAddress).toBe('teacher@example.org');
    expect(payload.matchCount).toBe(1);
    expect(payload.clerkUserId).toBe('user_teacher_1');
    expect(payload.candidateUserIds).toEqual(['user_teacher_1']);
  });

  it('returns candidate IDs when multiple users match an email', async () => {
    const { route } = await loadResolveUserRoute({
      userId: 'user_admin',
      users: [{ id: 'user_one' }, { id: 'user_two' }],
    });

    const response = await route.POST(
      new Request('http://localhost/api/admin/teachers/resolve-user', {
        method: 'POST',
        body: JSON.stringify({ emailAddress: 'teacher@example.org' }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      matchCount: number;
      clerkUserId: string | null;
      candidateUserIds: string[];
    };

    expect(payload.matchCount).toBe(2);
    expect(payload.clerkUserId).toBeNull();
    expect(payload.candidateUserIds).toEqual(['user_one', 'user_two']);
  });
});
