import dynamic from 'next/dynamic';

const StudentGameExperience = dynamic(
  () => import('@/components/student-game/StudentGameExperience'),
  {
    ssr: false,
  },
);

export default function StockPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
      <StudentGameExperience />
    </main>
  );
}
