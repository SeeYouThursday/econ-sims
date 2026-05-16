'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  generateStudentAlias,
  generateStudentPasscode,
} from '@/lib/studentAliasGenerator';
import {
  toCredentialsCsv,
  type GeneratedCredential,
  writeAndPrintCredentialCards,
} from '@/lib/teacherCredentialExports';
import {
  parseCredentialCsv,
  sanitizeClassroomCodeForFilename,
} from '@/lib/studentCredentialCsv';
import { ClassroomListCard } from '@/components/teacher-dashboard/ClassroomListCard';
import { ClassroomMetricsCard } from '@/components/teacher-dashboard/ClassroomMetricsCard';
import { ConfirmDialog } from '@/components/teacher-dashboard/ConfirmDialog';
import { CreateClassroomCard } from '@/components/teacher-dashboard/CreateClassroomCard';
import { ManageStudentsPanel } from '@/components/teacher-dashboard/ManageStudentsPanel';
import { dollarsToCents } from '@/lib/formatCents';
import type {
  ClassroomApiError,
  ClassroomAudit,
  ClassroomStudent,
  ClassroomStudentListPayload,
  ConfirmDialogState,
  TeacherClassroom,
} from '@/components/teacher-dashboard/types';

function isTeacherClassroom(value: unknown): value is TeacherClassroom {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TeacherClassroom>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.startingCash === 'number' &&
    typeof candidate.durationDays === 'number' &&
    typeof candidate.createdAt === 'string'
  );
}

function getApiErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as ClassroomApiError;
  return typeof candidate.error === 'string' ? candidate.error : null;
}

export default function TeacherDashboardPanel({
  initialClassrooms,
}: {
  initialClassrooms: TeacherClassroom[];
}) {
  const [classrooms, setClassrooms] = useState(initialClassrooms);
  const [title, setTitle] = useState('');
  const [selectedClassroomCode, setSelectedClassroomCode] = useState(
    initialClassrooms[0]?.code ?? '',
  );
  const [studentAlias, setStudentAlias] = useState(() =>
    generateStudentAlias(),
  );
  const [studentPasscode, setStudentPasscode] = useState(() =>
    generateStudentPasscode(),
  );
  const [studentsByClass, setStudentsByClass] = useState<
    Record<string, ClassroomStudent[]>
  >({});
  const [auditByClass, setAuditByClass] = useState<
    Record<string, ClassroomAudit>
  >({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [studentActionKey, setStudentActionKey] = useState<string | null>(null);
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [bulkCount, setBulkCount] = useState('23');
  const [bulkCreating, setBulkCreating] = useState(false);
  const [exportingCredentials, setExportingCredentials] = useState(false);
  const [updatingClassroomSettings, setUpdatingClassroomSettings] =
    useState(false);
  const [newClassStartingCash, setNewClassStartingCash] = useState('10000');
  const [newClassDurationDays, setNewClassDurationDays] = useState('30');
  const [selectedStartingCash, setSelectedStartingCash] = useState('10000');
  const [showGeneratedPasscode, setShowGeneratedPasscode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentMessage, setStudentMessage] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<'single' | 'bulk' | 'roster'>(
    'single',
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );

  const selectedClassroomStudents = selectedClassroomCode
    ? (studentsByClass[selectedClassroomCode] ?? [])
    : [];
  const selectedClassroom = classrooms.find(
    (classroom) => classroom.code === selectedClassroomCode,
  );
  const selectedClassroomAudit = selectedClassroomCode
    ? auditByClass[selectedClassroomCode]
    : undefined;

  const loadClassroomRoster = useCallback(async (classroomCode: string) => {
    if (!classroomCode) {
      return;
    }

    setLoadingRoster(true);

    try {
      const params = new URLSearchParams({ classroomCode });
      const response = await fetch(
        `/api/stock-game/students?${params.toString()}`,
      );
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to load students.');
        return;
      }

      const roster =
        payload && typeof payload === 'object'
          ? ((payload as ClassroomStudentListPayload).students ?? [])
          : [];

      setStudentsByClass((current) => ({
        ...current,
        [classroomCode]: Array.isArray(roster) ? roster : [],
      }));
    } catch {
      setError('Unable to load students right now.');
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  const loadClassroomAudit = useCallback(async (classroomCode: string) => {
    if (!classroomCode) {
      return;
    }

    setLoadingMetrics(true);

    try {
      const response = await fetch('/api/stock-game/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomCode }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(
          getApiErrorMessage(payload) ?? 'Unable to load classroom metrics.',
        );
        return;
      }

      if (!payload || typeof payload !== 'object') {
        setError('Unexpected classroom metrics response from server.');
        return;
      }

      const candidate = payload as Partial<ClassroomAudit>;
      if (
        typeof candidate.classroomCode !== 'string' ||
        typeof candidate.asOf !== 'string' ||
        typeof candidate.studentCount !== 'number' ||
        typeof candidate.activeSessionCount !== 'number' ||
        typeof candidate.tradeCount !== 'number' ||
        typeof candidate.buyCount !== 'number' ||
        typeof candidate.sellCount !== 'number' ||
        !Array.isArray(candidate.topSymbols)
      ) {
        setError('Unexpected classroom metrics response from server.');
        return;
      }

      setAuditByClass((current) => ({
        ...current,
        [classroomCode]: candidate as ClassroomAudit,
      }));
    } catch {
      setError('Unable to load classroom metrics right now.');
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedClassroomCode) {
      return;
    }

    void loadClassroomRoster(selectedClassroomCode);
    void loadClassroomAudit(selectedClassroomCode);
  }, [loadClassroomAudit, loadClassroomRoster, selectedClassroomCode]);

  useEffect(() => {
    if (!selectedClassroom) {
      return;
    }

    // selectedClassroom.startingCash is cents; the input field displays whole
    // dollars, so divide here and again on every read below.
    const cents = selectedClassroom.startingCash ?? 1_000_000;
    setSelectedStartingCash(String(Math.round(cents / 100)));
  }, [selectedClassroom]);

  const createClassroom = async () => {
    if (!title.trim()) {
      setError('Enter a classroom title.');
      return;
    }

    const parsedStartingCashDollars = Math.trunc(Number(newClassStartingCash));
    if (
      !Number.isFinite(parsedStartingCashDollars) ||
      parsedStartingCashDollars < 100 ||
      parsedStartingCashDollars > 1_000_000
    ) {
      setError('Starting cash must be between $100 and $1,000,000.');
      return;
    }

    const parsedDurationDays = Math.trunc(Number(newClassDurationDays));
    if (
      !Number.isFinite(parsedDurationDays) ||
      parsedDurationDays < 1 ||
      parsedDurationDays > 365
    ) {
      setError('Game duration must be between 1 and 365 days.');
      return;
    }

    setCreatingClassroom(true);
    setError(null);

    try {
      const response = await fetch('/api/teacher/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          startingCash: dollarsToCents(parsedStartingCashDollars),
          durationDays: parsedDurationDays,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to create classroom.');
        return;
      }

      if (!isTeacherClassroom(payload)) {
        setError('Unexpected classroom response from server.');
        return;
      }

      setClassrooms((current) => [...current, payload]);
      setSelectedClassroomCode(payload.code);
      setStudentsByClass((current) => ({ ...current, [payload.code]: [] }));
      setAuditByClass((current) => ({
        ...current,
        [payload.code]: {
          classroomCode: payload.code,
          asOf: new Date().toISOString(),
          studentCount: 0,
          activeSessionCount: 0,
          tradeCount: 0,
          buyCount: 0,
          sellCount: 0,
          topSymbols: [],
        },
      }));
      setTitle('');
      setNewClassStartingCash('10000');
      setNewClassDurationDays('30');
    } catch {
      setError('Unable to create classroom right now.');
    } finally {
      setCreatingClassroom(false);
    }
  };

  const updateSelectedClassroomStartingCash = async () => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    const parsedStartingCashDollars = Math.trunc(Number(selectedStartingCash));
    if (
      !Number.isFinite(parsedStartingCashDollars) ||
      parsedStartingCashDollars < 100 ||
      parsedStartingCashDollars > 1_000_000
    ) {
      setError('Starting cash must be between $100 and $1,000,000.');
      return;
    }

    setUpdatingClassroomSettings(true);
    setError(null);
    setStudentMessage(null);

    try {
      const response = await fetch('/api/teacher/classrooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          startingCash: dollarsToCents(parsedStartingCashDollars),
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(
          getApiErrorMessage(payload) ?? 'Unable to update classroom settings.',
        );
        return;
      }

      if (!isTeacherClassroom(payload)) {
        setError('Unexpected classroom response from server.');
        return;
      }

      setClassrooms((current) =>
        current.map((classroom) =>
          classroom.code === payload.code ? payload : classroom,
        ),
      );
      // payload.startingCash is cents; the input field shows whole dollars.
      setSelectedStartingCash(String(Math.round(payload.startingCash / 100)));
      setStudentMessage(`Updated starting cash for ${payload.code}.`);
    } catch {
      setError('Unable to update classroom settings right now.');
    } finally {
      setUpdatingClassroomSettings(false);
    }
  };

  const createStudentAlias = async () => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    const aliasToCreate = studentAlias.trim() || generateStudentAlias();

    if (!studentPasscode.trim()) {
      setError('Enter a student passcode.');
      return;
    }

    setCreatingStudent(true);
    setError(null);
    setStudentMessage(null);

    try {
      const response = await fetch('/api/stock-game/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          username: aliasToCreate,
          studentPasscode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to create student.');
        return;
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);
      setStudentAlias(generateStudentAlias());
      setStudentPasscode(generateStudentPasscode());
      setStudentMessage(
        'Student alias created. Share alias, passcode, and class code.',
      );
    } catch {
      setError('Unable to create student right now.');
    } finally {
      setCreatingStudent(false);
    }
  };

  const fillGeneratedAlias = () => {
    setStudentAlias(generateStudentAlias());
    setError(null);
  };

  const fillGeneratedPasscode = () => {
    setStudentPasscode(generateStudentPasscode());
    setShowGeneratedPasscode(true);
    setError(null);
  };

  const runStudentAction = async (
    username: string,
    action: 'reset' | 'deactivate' | 'activate' | 'delete',
    skipConfirm = false,
  ) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (action === 'delete' && !skipConfirm) {
      setConfirmDialog({
        title: 'Delete Student?',
        message: `Delete ${username}? This will remove the alias and cannot be undone.`,
        confirmLabel: 'Delete',
        tone: 'danger',
        onConfirm: () => {
          void runStudentAction(username, action, true);
        },
      });
      return;
    }

    setError(null);
    setStudentMessage(null);
    setStudentActionKey(`${username}:${action}`);

    try {
      const response = await fetch('/api/stock-game/students', {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          username,
          ...(action === 'delete' ? {} : { action }),
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setError(getApiErrorMessage(payload) ?? 'Unable to update student.');
        return;
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);
      if (action === 'reset') {
        setStudentMessage(`Reset portfolio for ${username}.`);
      } else if (action === 'delete') {
        setStudentMessage(`Deleted ${username}.`);
      } else if (action === 'deactivate') {
        setStudentMessage(`Deactivated ${username}.`);
      } else {
        setStudentMessage(`Reactivated ${username}.`);
      }
    } catch {
      setError('Unable to update student right now.');
    } finally {
      setStudentActionKey(null);
    }
  };

  const resetAllStudentsToStartingCash = async (skipConfirm = false) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (!skipConfirm) {
      setConfirmDialog({
        title: 'Reset Entire Class?',
        message:
          'This will reset every student portfolio in this class to the current starting cash and clear open sessions/trade history.',
        confirmLabel: 'Reset All',
        tone: 'danger',
        onConfirm: () => {
          void resetAllStudentsToStartingCash(true);
        },
      });
      return;
    }

    setStudentActionKey(`${selectedClassroomCode}:reset-all`);
    setError(null);
    setStudentMessage(null);

    try {
      const response = await fetch('/api/stock-game/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          action: 'reset-all',
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(
          getApiErrorMessage(payload) ?? 'Unable to reset the classroom.',
        );
        return;
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);
      setStudentMessage('Reset all student portfolios for this classroom.');
    } catch {
      setError('Unable to reset the classroom right now.');
    } finally {
      setStudentActionKey(null);
    }
  };

  const restartClassroomGame = async (skipConfirm = false) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (!skipConfirm) {
      setConfirmDialog({
        title: 'Restart Classroom Game?',
        message:
          'This keeps the same classroom code and student logins, resets portfolios/trade history, clears sessions, and restarts the game clock.',
        confirmLabel: 'Restart Game',
        tone: 'danger',
        onConfirm: () => {
          void restartClassroomGame(true);
        },
      });
      return;
    }

    setStudentActionKey(`${selectedClassroomCode}:restart-game`);
    setError(null);
    setStudentMessage(null);

    try {
      const response = await fetch('/api/stock-game/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomCode: selectedClassroomCode,
          action: 'restart-game',
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(
          getApiErrorMessage(payload) ??
            'Unable to restart the classroom game.',
        );
        return;
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);
      setStudentMessage(
        'Classroom game restarted. Students can use the same aliases and passcodes.',
      );
    } catch {
      setError('Unable to restart the classroom game right now.');
    } finally {
      setStudentActionKey(null);
    }
  };

  const exportStudentCredentials = async (skipConfirm = false) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (!skipConfirm) {
      setConfirmDialog({
        title: 'Export Credentials CSV?',
        message:
          'This file contains sensitive credentials. Store it securely and delete it when done.',
        confirmLabel: 'Export CSV',
        onConfirm: () => {
          void exportStudentCredentials(true);
        },
      });
      return;
    }

    setExportingCredentials(true);
    setError(null);
    setStudentMessage(null);

    try {
      const params = new URLSearchParams({
        classroomCode: selectedClassroomCode,
        format: 'csv',
      });
      const response = await fetch(`/api/stock-game/students?${params}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        setError(
          getApiErrorMessage(payload) ??
            'Unable to export student credentials.',
        );
        return;
      }

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);
      const safeClassroomCode = sanitizeClassroomCodeForFilename(
        selectedClassroomCode,
      );
      link.href = url;
      link.download = `${safeClassroomCode}-student-credentials-${dateStamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStudentMessage(
        'Export complete. Keep the CSV secure and delete it after use.',
      );
    } catch {
      setError('Unable to export student credentials right now.');
    } finally {
      setExportingCredentials(false);
    }
  };

  const printRosterCredentialCards = async (skipConfirm = false) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    if (!skipConfirm) {
      setConfirmDialog({
        title: 'Print Roster Cards?',
        message:
          'This includes sensitive credentials. Collect and store printed pages securely.',
        confirmLabel: 'Print Cards',
        onConfirm: () => {
          void printRosterCredentialCards(true);
        },
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError(
        'Unable to open print preview. Please retry and ensure this browser allows opening new windows from this page.',
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      '<!doctype html><html><head><title>Preparing cards...</title></head><body><p style="font-family: Arial, sans-serif; padding: 16px;">Preparing student credential cards...</p></body></html>',
    );
    printWindow.document.close();

    setExportingCredentials(true);
    setError(null);
    setStudentMessage(null);

    try {
      const params = new URLSearchParams({
        classroomCode: selectedClassroomCode,
        format: 'csv',
      });
      const response = await fetch(`/api/stock-game/students?${params}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(
          getApiErrorMessage(payload) ?? 'Unable to load student credentials.',
        );
      }

      const csv = await response.text();
      const credentials = parseCredentialCsv(csv);

      if (credentials.length === 0) {
        printWindow.close();
        setStudentMessage(
          'No printable credentials are available for this classroom yet.',
        );
        return;
      }

      printCredentialCards(selectedClassroomCode, credentials, printWindow);
      setStudentMessage(
        'Print preview ready. Collect cards and store them securely.',
      );
    } catch (nextError) {
      printWindow.close();
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to print student credentials right now.',
      );
    } finally {
      setExportingCredentials(false);
    }
  };

  const downloadCredentialsCsv = (
    classroomCode: string,
    credentials: GeneratedCredential[],
  ) => {
    const csv = toCredentialsCsv(classroomCode, credentials);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const safeClassroomCode = sanitizeClassroomCodeForFilename(classroomCode);
    link.href = url;
    link.download = `${safeClassroomCode}-new-student-credentials-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const printCredentialCards = (
    classroomCode: string,
    credentials: GeneratedCredential[],
    popup: Window,
  ) => {
    writeAndPrintCredentialCards(popup, classroomCode, credentials);
  };

  const bulkCreateStudents = async (
    output: 'csv' | 'cards',
    skipConfirm = false,
  ) => {
    if (!selectedClassroomCode) {
      setError('Select a classroom first.');
      return;
    }

    const count = Math.trunc(Number(bulkCount));
    if (!Number.isFinite(count) || count < 1 || count > 35) {
      setError('Enter a class size between 1 and 35.');
      return;
    }

    if (!skipConfirm) {
      setConfirmDialog({
        title: 'Generate Student Credentials?',
        message: `Generate ${count} student aliases/passcodes for ${selectedClassroomCode}?`,
        confirmLabel: output === 'csv' ? 'Create + CSV' : 'Create + Print',
        onConfirm: () => {
          void bulkCreateStudents(output, true);
        },
      });
      return;
    }

    const printWindow = output === 'cards' ? window.open('', '_blank') : null;
    if (output === 'cards' && !printWindow) {
      setError(
        'Unable to open print preview. Please retry and ensure this browser allows opening new windows from this page.',
      );
      return;
    }

    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(
        '<!doctype html><html><head><title>Preparing cards...</title></head><body><p style="font-family: Arial, sans-serif; padding: 16px;">Preparing student credential cards...</p></body></html>',
      );
      printWindow.document.close();
    }

    setBulkCreating(true);
    setError(null);
    setStudentMessage(null);

    try {
      let created: GeneratedCredential[] = [];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const batch: GeneratedCredential[] = [];
        const seenAliases = new Set<string>();

        while (batch.length < count) {
          const alias = generateStudentAlias();
          if (seenAliases.has(alias)) {
            continue;
          }

          batch.push({ alias, passcode: generateStudentPasscode() });
          seenAliases.add(alias);
        }

        const response = await fetch('/api/stock-game/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classroomCode: selectedClassroomCode,
            students: batch.map((entry) => ({
              username: entry.alias,
              studentPasscode: entry.passcode,
            })),
          }),
        });

        if (response.ok) {
          created = batch;
          break;
        }

        const payload = (await response.json().catch(() => null)) as unknown;
        const message =
          getApiErrorMessage(payload) ??
          'Unable to bulk create student credentials.';
        if (response.status === 409) {
          continue;
        }

        throw new Error(message);
      }

      if (created.length !== count) {
        throw new Error(
          'Could not generate a unique class set after several attempts. Try again.',
        );
      }

      await loadClassroomRoster(selectedClassroomCode);
      await loadClassroomAudit(selectedClassroomCode);

      if (output === 'csv') {
        downloadCredentialsCsv(selectedClassroomCode, created);
      } else {
        printCredentialCards(
          selectedClassroomCode,
          created,
          printWindow as Window,
        );
      }

      setStudentAlias(generateStudentAlias());
      setStudentPasscode(generateStudentPasscode());
      setShowGeneratedPasscode(true);
      setStudentMessage(
        `Generated ${created.length} student credentials successfully.`,
      );
    } catch (nextError) {
      if (printWindow) {
        printWindow.close();
      }
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to bulk generate student credentials right now.',
      );
    } finally {
      setBulkCreating(false);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Top row: Classrooms and Create Classroom */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <ClassroomListCard
          classrooms={classrooms}
          selectedClassroomCode={selectedClassroomCode}
          onSelectClassroom={(classroomCode) => {
            setError(null);
            setStudentMessage(null);
            setSelectedClassroomCode(classroomCode);
          }}
        />

        <CreateClassroomCard
          title={title}
          newClassStartingCash={newClassStartingCash}
          newClassDurationDays={newClassDurationDays}
          creatingClassroom={creatingClassroom}
          onTitleChange={setTitle}
          onStartingCashChange={setNewClassStartingCash}
          onDurationDaysChange={setNewClassDurationDays}
          onCreateClassroom={() => {
            void createClassroom();
          }}
        />
      </div>

      {/* Metrics Row */}
      {selectedClassroomCode && (
        <ClassroomMetricsCard
          selectedStartingCash={selectedStartingCash}
          selectedClassroomStudents={selectedClassroomStudents}
          selectedClassroomAudit={selectedClassroomAudit}
          loadingMetrics={loadingMetrics}
          updatingClassroomSettings={updatingClassroomSettings}
          studentActionKey={studentActionKey}
          onSelectedStartingCashChange={setSelectedStartingCash}
          onSaveStartingCash={() => {
            void updateSelectedClassroomStartingCash();
          }}
          onRefreshMetrics={() => {
            void loadClassroomAudit(selectedClassroomCode);
          }}
          onResetAll={() => {
            void resetAllStudentsToStartingCash();
          }}
          onRestartGame={() => {
            void restartClassroomGame();
          }}
        />
      )}

      {/* Manage Students Section with Tabs */}
      {selectedClassroomCode && (
        <ManageStudentsPanel
          selectedClassroomStudents={selectedClassroomStudents}
          manageTab={manageTab}
          studentAlias={studentAlias}
          studentPasscode={studentPasscode}
          showGeneratedPasscode={showGeneratedPasscode}
          bulkCount={bulkCount}
          loadingRoster={loadingRoster}
          creatingStudent={creatingStudent}
          bulkCreating={bulkCreating}
          exportingCredentials={exportingCredentials}
          studentActionKey={studentActionKey}
          studentMessage={studentMessage}
          onManageTabChange={setManageTab}
          onStudentPasscodeChange={setStudentPasscode}
          onBulkCountChange={setBulkCount}
          onFillGeneratedAlias={fillGeneratedAlias}
          onTogglePasscodeVisibility={() => {
            setShowGeneratedPasscode((current) => !current);
          }}
          onFillGeneratedPasscode={fillGeneratedPasscode}
          onCreateStudentAlias={() => {
            void createStudentAlias();
          }}
          onBulkCreateCsv={() => {
            void bulkCreateStudents('csv');
          }}
          onBulkCreateCards={() => {
            void bulkCreateStudents('cards');
          }}
          onExportStudentCredentials={() => {
            void exportStudentCredentials();
          }}
          onPrintRosterCredentialCards={() => {
            void printRosterCredentialCards();
          }}
          onRunStudentAction={(username, action) => {
            void runStudentAction(username, action);
          }}
        />
      )}

      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </p>
      )}

      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
