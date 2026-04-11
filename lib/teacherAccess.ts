export type TeacherAccessMode = 'invite-only' | 'open';

const DEFAULT_TEACHER_ACCESS_MODE: TeacherAccessMode = 'invite-only';

export function getTeacherAccessMode(): TeacherAccessMode {
  const configuredMode = process.env.TEACHER_ACCESS_MODE?.trim().toLowerCase();

  if (configuredMode === 'open') {
    return 'open';
  }

  return DEFAULT_TEACHER_ACCESS_MODE;
}

export function isInviteOnlyTeacherAccess() {
  return getTeacherAccessMode() === 'invite-only';
}

export function allowsTeacherSelfSignUp() {
  return getTeacherAccessMode() === 'open';
}
