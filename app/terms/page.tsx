import { Ban, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-white text-slate-900 py-16 px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 border-b border-slate-200 pb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-slate-600 font-medium">
            Last Revised: April 15, 2026
          </p>
        </header>

        <div className="space-y-12">
          <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                1. No Financial Advice or Real Trading
              </h2>
            </div>
            <div className="text-slate-700 space-y-3 font-medium text-sm leading-relaxed">
              <p>
                <strong>Simulation Only: </strong> All data, prices, and
                &quot;money&quot; shown on M. G &apos; Civics Lab are for
                educational simulation only. No real currency is ever used,
                earned, or traded.
              </p>
              <p>
                <strong>Not Financial Advice:</strong> Content on this site is
                for classroom instruction and does not constitute professional
                financial or investment advice.
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Ban className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                2. Prohibited Conduct
              </h2>
            </div>
            <p className="text-slate-700 mb-3">Users agree NOT to:</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
              <li className="p-3 bg-slate-50 rounded-lg border border-slate-100 italic">
                &quot;Hack&quot; or manipulate simulation game balances.
              </li>
              <li className="p-3 bg-slate-50 rounded-lg border border-slate-100 italic">
                Use the platform for any &quot;commercial&quot; real-world
                purposes.
              </li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                3. Limitation of Liability
              </h2>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed italic">
              Civics Lab is provided &quot;as is&quot; without any warranties.
              We are not liable for any technical inaccuracies in market data or
              for any perceived &quot;losses&quot; in the virtual simulation.
            </p>
          </section>

          <footer className="border-t border-slate-200 pt-10 pb-20 text-center">
            <p className="text-slate-600 mb-2 font-medium tracking-tight">
              Questions about our &quot;Terms&quot;?
            </p>
            <a
              href="mailto:admin@civicslab.pro"
              className="text-lg font-bold text-blue-600 hover:text-blue-800"
            >
              mrgscivicslab@gmail.com
            </a>
          </footer>
        </div>
      </div>
    </main>
  );
}
