import { auth } from '@clerk/nextjs/server';

export class TeacherAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
    process.env.CLERK_SECRET_KEY?.trim(),
  );
}

export async function requireTeacherAuth() {
  if (!isClerkConfigured()) {
    return null;
  }

  const { userId } = await auth();
  if (!userId) {
    throw new TeacherAuthError('Teacher sign-in is required.', 401);
  }

  return userId;
}
