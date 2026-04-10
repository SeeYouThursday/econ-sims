import { NextResponse } from 'next/server';
import { AdminAccessError, requireTeacherAdminUser } from '@/lib/adminAccess';
import {
  createTeacherInvitation,
  validateTeacherInvitation,
} from '@/lib/teacherStore';

export const runtime = 'nodejs';

/**
 * POST /api/teacher/invitations
 * Returns: { token: string, inviteUrl: string }
 *
 * Generate a single-use teacher invitation.
 * Requires a signed-in allowlisted admin (TEACHER_ADMIN_USER_IDS).
 */
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

  try {
    const { token } = await createTeacherInvitation();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ??
      request.headers.get('origin') ??
      '';
    const inviteUrl = `${baseUrl}/sign-up?invite=${token}`;
    return NextResponse.json({ token, inviteUrl }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create invitation.',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/teacher/invitations?token=...
 * Returns: { valid: boolean, reason?: string }
 *
 * Check whether an invitation token is valid and unused.
 * Does NOT consume the token.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';

  try {
    const result = await validateTeacherInvitation(token);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to validate invitation.',
      },
      { status: 500 },
    );
  }
}
