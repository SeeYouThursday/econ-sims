type CreateClassroomCardProps = {
  title: string;
  newClassStartingCash: string;
  creatingClassroom: boolean;
  onTitleChange: (value: string) => void;
  onStartingCashChange: (value: string) => void;
  onCreateClassroom: () => void;
};

export function CreateClassroomCard({
  title,
  newClassStartingCash,
  creatingClassroom,
  onTitleChange,
  onStartingCashChange,
  onCreateClassroom,
}: CreateClassroomCardProps) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
        Create classroom
      </p>
      <label className="mt-4 block text-xs font-semibold uppercase text-slate-700">
        Title
      </label>
      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Period 3 Economics"
        title="Classroom title"
        className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
      />
      <label
        htmlFor="new-class-starting-cash"
        className="mt-3 block text-xs font-semibold uppercase text-slate-700"
      >
        Starting cash
      </label>
      <input
        id="new-class-starting-cash"
        type="number"
        min={100}
        max={1000000}
        step={100}
        value={newClassStartingCash}
        onChange={(event) => onStartingCashChange(event.target.value)}
        placeholder="10000"
        title="Starting cash for new students in this classroom"
        aria-label="New classroom starting cash"
        className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
      />
      <button
        type="button"
        onClick={onCreateClassroom}
        disabled={creatingClassroom}
        className="mt-3 w-full rounded-2xl bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {creatingClassroom ? 'Creating…' : 'Create'}
      </button>
    </div>
  );
}
