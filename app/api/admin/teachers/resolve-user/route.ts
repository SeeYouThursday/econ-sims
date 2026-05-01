import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { AdminAccessError, requireTeacherAdminUser } from '@/lib/adminAccess';
import { isClerkConfigured } from '@/lib/clerk';
import { clientIpKey, enforceRateLimit, rateLimitKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';

type ResolveUserBody = {
  emailAddress?: unknown;
};

async function requireAdminForRoute() {
  try {
    await requireTeacherAdminUser();
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unable to verify admin access.' },
      { status: 500 },
    );
  }

  return null;
}

export async function POST(request: Request) {
  const accessError = await requireAdminForRoute();
  if (accessError) {
    return accessError;
  }

  if (!isClerkConfigured()) {
    return NextResponse.json(
      { error: 'Clerk is not configured on this server.' },
      { status: 503 },
    );
  }

  let body: ResolveUserBody = {};
  try {
    body = (await request.json()) as ResolveUserBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  if (
    typeof body.emailAddress !== 'string' ||
    body.emailAddress.trim().length === 0
  ) {
    return NextResponse.json(
      { error: 'emailAddress is required.' },
      { status: 400 },
    );
  }

  const normalizedEmail = body.emailAddress.trim().toLowerCase();
  const rateLimited = await enforceRateLimit({
    key: rateLimitKey('admin-teacher-resolve-user', clientIpKey(request)),
    limit: 30,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({
      emailAddress: [normalizedEmail],
      limit: 10,
    });

    const matches = Array.isArray(users.data)
      ? users.data.filter((user) => user.id)
      : [];

    return NextResponse.json({
      emailAddress: normalizedEmail,
      matchCount: matches.length,
      clerkUserId: matches.length === 1 ? matches[0].id : null,
      candidateUserIds: matches.map((user) => user.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to resolve Clerk user ID.',
      },
      { status: 500 },
    );
  }
}
