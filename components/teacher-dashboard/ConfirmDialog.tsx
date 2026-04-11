import type { ConfirmDialogState } from '@/components/teacher-dashboard/types';

type ConfirmDialogProps = {
  dialog: ConfirmDialogState;
  onClose: () => void;
};

export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-black text-slate-900">{dialog.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{dialog.message}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-slate-700 transition hover:border-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const next = dialog.onConfirm;
              onClose();
              next();
            }}
            className={`rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-white transition ${
              dialog.tone === 'danger'
                ? 'bg-rose-700 hover:bg-rose-600'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
