'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ApprovalResponse = {
  error?: string;
  clerkUserId?: string;
  approved?: boolean;
  approvedAt?: string | null;
  approvedBy?: string;
  teacherRecordProvisioned?: boolean;
};

type WaitlistEntry = {
  id: string;
  emailAddress: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type WaitlistResponse = {
  error?: string;
  entries?: WaitlistEntry[];
  totalCount?: number;
};

type ResolveUserResponse = {
  error?: string;
  emailAddress?: string;
  matchCount?: number;
  clerkUserId?: string | null;
  candidateUserIds?: string[];
};

export default function TeacherApprovalAdminClient() {
  const [clerkUserId, setClerkUserId] = useState('');
  const [approvedBy, setApprovedBy] = useState('manual-admin-page');
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<ApprovalResponse | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistActionId, setWaitlistActionId] = useState<string | null>(null);
  const [resolvingWaitlistId, setResolvingWaitlistId] = useState<string | null>(
    null,
  );
  const [waitlistQuery, setWaitlistQuery] = useState('');
  const [helperMessage, setHelperMessage] = useState<string | null>(null);

  const isReady = useMemo(() => clerkUserId.trim().length > 0, [clerkUserId]);

  const submitApproval = async (approved: boolean) => {
    if (!isReady) {
      setResponse({ error: 'Enter Clerk User ID.' });
      return;
    }

    setSubmitting(true);
    setResponse(null);

    try {
      const result = await fetch('/api/admin/teachers/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId,
          approvedBy,
          approved,
        }),
      });

      const payload = (await result
        .json()
        .catch(() => null)) as ApprovalResponse | null;

      if (!result.ok) {
        setResponse({
          error: payload?.error ?? 'Unable to update teacher approval.',
        });
        return;
      }

      setResponse(payload ?? { error: 'Unexpected empty response.' });
    } catch {
      setResponse({ error: 'Network error while updating teacher approval.' });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const loadWaitlist = async (query?: string) => {
    setWaitlistLoading(true);
    setWaitlistError(null);

    try {
      const params = new URLSearchParams();
      if (query?.trim()) {
        params.set('query', query.trim());
      }

      const endpoint = params.toString()
        ? `/api/admin/teachers/waitlist?${params.toString()}`
        : '/api/admin/teachers/waitlist';

      const result = await fetch(endpoint, { method: 'GET' });
      const payload = (await result
        .json()
        .catch(() => null)) as WaitlistResponse | null;

      if (!result.ok) {
        setWaitlistError(payload?.error ?? 'Unable to load waitlist entries.');
        setWaitlistEntries([]);
        return;
      }

      setWaitlistEntries(
        Array.isArray(payload?.entries) ? payload.entries : [],
      );
    } catch {
      setWaitlistError('Network error while loading waitlist entries.');
      setWaitlistEntries([]);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const runWaitlistAction = async (
    waitlistEntryId: string,
    action: 'invite' | 'reject',
  ) => {
    setWaitlistActionId(waitlistEntryId);
    setResponse(null);

    try {
      const result = await fetch('/api/admin/teachers/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistEntryId, action }),
      });

      const payload = (await result.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!result.ok) {
        setWaitlistError(payload?.error ?? 'Unable to update waitlist entry.');
        return;
      }

      await loadWaitlist(waitlistQuery);
    } catch {
      setWaitlistError('Network error while updating waitlist entry.');
    } finally {
      setWaitlistActionId(null);
    }
  };

  const resolveUserIdFromEmail = async (
    waitlistEntryId: string,
    emailAddress: string,
  ) => {
    setResolvingWaitlistId(waitlistEntryId);
    setWaitlistError(null);
    setHelperMessage(null);

    try {
      const result = await fetch('/api/admin/teachers/resolve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress }),
      });

      const payload = (await result
        .json()
        .catch(() => null)) as ResolveUserResponse | null;

      if (!result.ok) {
        setWaitlistError(payload?.error ?? 'Unable to resolve Clerk user ID.');
        return;
      }

      if (payload?.clerkUserId) {
        setClerkUserId(payload.clerkUserId);
        setHelperMessage(
          `Resolved ${emailAddress} to ${payload.clerkUserId}. Clerk User ID has been populated in the approval form.`,
        );
        return;
      }

      const matchCount = payload?.matchCount ?? 0;
      if (matchCount === 0) {
        setHelperMessage(
          `No Clerk user account exists yet for ${emailAddress}. They must complete sign-up before direct approval by user ID.`,
        );
        return;
      }

      setHelperMessage(
        `Found ${matchCount} matching Clerk users for ${emailAddress}. Choose one user ID manually: ${(payload?.candidateUserIds ?? []).join(', ')}`,
      );
    } catch {
      setWaitlistError('Network error while resolving Clerk user ID.');
    } finally {
      setResolvingWaitlistId(null);
    }
  };

  useEffect(() => {
    void loadWaitlist();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-4xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          Admin tools
        </p>
        <h1 className="mt-4 text-3xl font-black text-slate-900">
          Teacher Approval
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Use this page to approve or revoke a teacher by Clerk user ID. This
          updates Clerk metadata and provisions a local teacher record when
          approved.
        </p>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Only allowlisted admin users can use this page.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="clerk-user-id"
              className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
            >
              Clerk User ID
            </label>
            <input
              id="clerk-user-id"
              value={clerkUserId}
              onChange={(event) => setClerkUserId(event.target.value)}
              placeholder="user_2abcDEF..."
              title="Target Clerk user ID"
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="approved-by"
              className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
            >
              Approved By
            </label>
            <input
              id="approved-by"
              value={approvedBy}
              onChange={(event) => setApprovedBy(event.target.value)}
              placeholder="principal@example.org"
              title="Audit label for who approved this teacher"
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void submitApproval(true)}
              disabled={!isReady || submitting}
              className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Working…' : 'Approve Teacher'}
            </button>
            <button
              type="button"
              onClick={() => void submitApproval(false)}
              disabled={!isReady || submitting}
              className="rounded-2xl bg-rose-700 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Working…' : 'Revoke Teacher'}
            </button>
          </div>
        </form>

        {response && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            {response.error ? (
              <p className="text-rose-700">{response.error}</p>
            ) : (
              <div className="space-y-1 text-slate-700">
                <p>
                  Updated:{' '}
                  <span className="font-semibold">{response.clerkUserId}</span>
                </p>
                <p>
                  Approved:{' '}
                  <span className="font-semibold">
                    {response.approved ? 'Yes' : 'No'}
                  </span>
                </p>
                <p>
                  Approved by:{' '}
                  <span className="font-semibold">{response.approvedBy}</span>
                </p>
                <p>
                  Provisioned local teacher:{' '}
                  <span className="font-semibold">
                    {response.teacherRecordProvisioned ? 'Yes' : 'No'}
                  </span>
                </p>
                {response.approvedAt && (
                  <p>
                    Approved at:{' '}
                    <span className="font-semibold">{response.approvedAt}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Clerk waitlist
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Review interested teachers and send Clerk invites directly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadWaitlist(waitlistQuery)}
              disabled={waitlistLoading}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {waitlistLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={waitlistQuery}
              onChange={(event) => setWaitlistQuery(event.target.value)}
              placeholder="Search by email or entry ID"
              title="Filter Clerk waitlist entries"
              className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
            />
            <button
              type="button"
              onClick={() => void loadWaitlist(waitlistQuery)}
              disabled={waitlistLoading}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Search
            </button>
          </div>

          {waitlistError && (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {waitlistError}
            </p>
          )}

          {helperMessage && (
            <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {helperMessage}
            </p>
          )}

          {waitlistLoading ? (
            <p className="mt-4 text-sm text-slate-600">Loading waitlist…</p>
          ) : waitlistEntries.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No waitlist entries found.
            </p>
          ) : (
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {waitlistEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.emailAddress}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {entry.status.toUpperCase()} •{' '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {entry.id}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void resolveUserIdFromEmail(
                            entry.id,
                            entry.emailAddress,
                          )
                        }
                        disabled={resolvingWaitlistId === entry.id}
                        className="rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resolvingWaitlistId === entry.id
                          ? 'Resolving…'
                          : 'Resolve user ID'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runWaitlistAction(entry.id, 'invite')
                        }
                        disabled={waitlistActionId === entry.id}
                        className="rounded-full border border-emerald-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {waitlistActionId === entry.id
                          ? 'Sending…'
                          : 'Send invite'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runWaitlistAction(entry.id, 'reject')
                        }
                        disabled={waitlistActionId === entry.id}
                        className="rounded-full border border-rose-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
