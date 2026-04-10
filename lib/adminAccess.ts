import { auth } from '@clerk/nextjs/server';
import { isClerkConfigured } from '@/lib/clerk';

export class AdminAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getTeacherAdminUserIds() {
  return (process.env.TEACHER_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isTeacherAdminUserId(userId: string | null | undefined) {
  if (!userId) {
    return false;
  }

  return getTeacherAdminUserIds().includes(userId);
}

export async function requireTeacherAdminUser() {
  if (!isClerkConfigured()) {
    throw new AdminAccessError('Clerk is not configured on this server.', 503);
  }

  const { userId } = await auth();
  if (!userId) {
    throw new AdminAccessError('Admin sign-in is required.', 401);
  }

  const adminUserIds = getTeacherAdminUserIds();
  if (adminUserIds.length === 0) {
    throw new AdminAccessError(
      'TEACHER_ADMIN_USER_IDS is not configured on this server.',
      503,
    );
  }

  if (!adminUserIds.includes(userId)) {
    throw new AdminAccessError(
      'You are not authorized for this admin tool.',
      403,
    );
  }

  return userId;
}
