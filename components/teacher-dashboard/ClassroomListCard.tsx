import type { TeacherClassroom } from '@/components/teacher-dashboard/types';

type ClassroomListCardProps = {
  classrooms: TeacherClassroom[];
  selectedClassroomCode: string;
  onSelectClassroom: (classroomCode: string) => void;
};

export function ClassroomListCard({
  classrooms,
  selectedClassroomCode,
  onSelectClassroom,
}: ClassroomListCardProps) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-slate-50 p-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
        Your classrooms
      </p>
      {classrooms.length === 0 ? (
        <p className="mt-4 text-sm leading-7 text-slate-600">
          No classrooms yet. Create one to get started.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {classrooms.map((classroom) => (
            <button
              key={classroom.code}
              type="button"
              onClick={() => onSelectClassroom(classroom.code)}
              className={`rounded-2xl border px-3 py-2 text-left transition ${
                selectedClassroomCode === classroom.code
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-black">{classroom.title}</p>
              <p className="mt-0.5 text-[10px] opacity-75">{classroom.code}</p>
              <p className="mt-0.5 text-[10px] opacity-75">
                Start ${classroom.startingCash.toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
