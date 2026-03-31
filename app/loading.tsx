import Spinner from '@/components/Spinner';

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="max-w-md rounded-4xl border border-slate-200 bg-white p-10 shadow-2xl text-center">
        <div className="mx-auto">
          <Spinner />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900">
          Loading your lesson...
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Please wait while we prepare the simulation and fetch the latest data.
        </p>
      </div>
    </main>
  );
}
