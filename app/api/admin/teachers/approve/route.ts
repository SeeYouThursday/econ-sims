import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { AdminAccessError, requireTeacherAdminUser } from '@/lib/adminAccess';
import { isClerkConfigured } from '@/lib/clerk';
import { provisionTeacherRecord } from '@/lib/teacherStore';

export const runtime = 'nodejs';

type ApproveTeacherBody = {
  clerkUserId?: unknown;
  approved?: unknown;
  approvedBy?: unknown;
};

export async function POST(request: Request) {
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

  if (!isClerkConfigured()) {
    return NextResponse.json(
      { error: 'Clerk is not configured on this server.' },
      { status: 503 },
    );
  }

  let body: ApproveTeacherBody = {};
  try {
    body = (await request.json()) as ApproveTeacherBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  if (typeof body.clerkUserId !== 'string' || !body.clerkUserId.trim()) {
    return NextResponse.json(
      { error: 'clerkUserId is required.' },
      { status: 400 },
    );
  }

  const approved = typeof body.approved === 'boolean' ? body.approved : true;
  const approvedBy =
    typeof body.approvedBy === 'string' && body.approvedBy.trim()
      ? body.approvedBy.trim()
      : 'allowlisted-admin';
  const approvedAt = new Date().toISOString();

  try {
    const client = await clerkClient();

    await client.users.updateUserMetadata(body.clerkUserId, {
      publicMetadata: {
        role: approved ? 'teacher' : 'user',
        teacherApproved: approved,
      },
      privateMetadata: {
        teacherApprovalStatus: approved ? 'approved' : 'revoked',
        teacherApprovedAt: approved ? approvedAt : null,
        teacherApprovedBy: approvedBy,
      },
    });

    if (approved) {
      await provisionTeacherRecord(body.clerkUserId);
    }

    return NextResponse.json({
      clerkUserId: body.clerkUserId,
      approved,
      approvedAt: approved ? approvedAt : null,
      approvedBy,
      teacherRecordProvisioned: approved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update teacher approval.',
      },
      { status: 500 },
    );
  }
}
