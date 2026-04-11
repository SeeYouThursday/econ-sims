import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { AdminAccessError, requireTeacherAdminUser } from '@/lib/adminAccess';
import { isClerkConfigured } from '@/lib/clerk';

export const runtime = 'nodejs';

type WaitlistActionBody = {
  waitlistEntryId?: unknown;
  action?: unknown;
};

function mapWaitlistEntry(entry: {
  id: string;
  emailAddress: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: entry.id,
    emailAddress: entry.emailAddress,
    status: entry.status,
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
  };
}

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

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const query = url.searchParams.get('query') ?? undefined;

  try {
    const client = await clerkClient();
    const result = await client.waitlistEntries.list({
      limit: 100,
      orderBy: '-created_at',
      query,
    });

    const entries = Array.isArray(result.data)
      ? result.data.map((entry) => mapWaitlistEntry(entry))
      : [];

    return NextResponse.json({
      entries,
      totalCount:
        typeof result.totalCount === 'number'
          ? result.totalCount
          : entries.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load waitlist entries.',
      },
      { status: 500 },
    );
  }
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

  let body: WaitlistActionBody = {};
  try {
    body = (await request.json()) as WaitlistActionBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  if (
    typeof body.waitlistEntryId !== 'string' ||
    body.waitlistEntryId.trim().length === 0
  ) {
    return NextResponse.json(
      { error: 'waitlistEntryId is required.' },
      { status: 400 },
    );
  }

  const action = body.action === 'reject' ? 'reject' : 'invite';

  try {
    const client = await clerkClient();
    const updated =
      action === 'reject'
        ? await client.waitlistEntries.reject(body.waitlistEntryId)
        : await client.waitlistEntries.invite(body.waitlistEntryId, {
            ignoreExisting: true,
          });

    return NextResponse.json({
      entry: mapWaitlistEntry(updated),
      action,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update waitlist entry.',
      },
      { status: 500 },
    );
  }
}
