// All monetary fields below are integer cents (AGENTS.md §3). The teacher UI
// converts to/from dollars at the input/display boundary; everything else
// stays in cents.
export type TeacherClassroom = {
  code: string;
  title: string;
  /** cents */
  startingCash: number;
  durationDays: number;
  createdAt: string;
};

export type ClassroomApiError = {
  error?: string;
};

export type ClassroomStudent = {
  studentId: string;
  username: string;
  createdAt: string;
  isActive: boolean;
  /** cents */
  cash: number;
  /** cents */
  holdingsValue: number;
  /** cents */
  totalValue: number;
  hasActiveSession: boolean;
};

export type ClassroomStudentListPayload = {
  students?: ClassroomStudent[];
};

export type ClassroomAudit = {
  classroomCode: string;
  asOf: string;
  studentCount: number;
  activeSessionCount: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  topSymbols: Array<{ symbol: string; trades: number }>;
};

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
};
