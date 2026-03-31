'use client';

export default function Spinner() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white"
    >
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-white" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
