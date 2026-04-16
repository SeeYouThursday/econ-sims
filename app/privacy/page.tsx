import { ShieldCheck, Lock, Globe, UserCheck, Mail } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    // We use bg-white and text-slate-900 for maximum readability
    <main className="min-h-screen bg-white text-slate-900 py-16 px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header Section */}
        <header className="mb-12 border-b border-slate-200 pb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-600 font-medium">
            Effective Date: April 15, 2026
          </p>
        </header>

        <div className="space-y-12">
          {/* 1. Educational Mission */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                1. Educational Mission
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-slate-700">
              Civics Lab (
              <span className="font-semibold underline">www.civicslab.pro</span>
              ) is a non-commercial educational resource. Our mission is to
              provide students and educators with a safe, simulated environment
              to learn about financial markets and economic civics without any
              financial risk.
            </p>
          </section>

          {/* 2. Safety Warning - High Visibility Box */}
          <section className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900 tracking-tight uppercase">
                2. No Real Money / No Financial Risk
              </h2>
            </div>
            <p className="text-slate-700 font-medium leading-relaxed">
              <strong>Civics Lab is a simulation.</strong> No real currency is
              ever deposited, earned, or exchanged on this platform. We do not
              facilitate the trading of actual stocks or cryptocurrencies. All
              portfolio balances are strictly virtual &quot;game money&quot;
              used for classroom education.
            </p>
          </section>

          {/* 3. Access Tiers */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                3. Access Tiers & Data
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="border border-slate-200 p-5 rounded-xl">
                <h3 className="font-bold text-slate-900 mb-2">Public Access</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Our Federal Reserve Simulator is open to all visitors. We do
                  not collect personally identifiable information (PII) from
                  users interacting with public tools.
                </p>
              </div>
              <div className="border border-slate-200 p-5 rounded-xl bg-white">
                <h3 className="font-bold text-slate-900 mb-2">
                  Verified Educators
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Access to the Stock Market Game is restricted to verified
                  teachers. We use <strong>Clerk</strong> for secure
                  authentication and manually vet every teacher request.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Student Privacy */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                4. Student Privacy (No PII)
              </h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              To ensure student safety, we adhere to a <strong>Zero-PII</strong>{' '}
              policy:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>
                Students are identified only by{' '}
                <strong>teacher-assigned aliases</strong>.
              </li>
              <li>
                We do not store student names, email addresses, or phone
                numbers.
              </li>
              <li>
                Data is stored securely in an encrypted <strong>Neon</strong>{' '}
                database.
              </li>
            </ul>
          </section>

          {/* 5. Contact Section */}
          <section className="border-t border-slate-200 pt-10 pb-20">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900">5. Contact</h2>
            </div>
            <p className="text-slate-700 mb-4">
              For privacy inquiries, data removal requests, or educator
              verification questions, please contact the administrator at:
            </p>
            <a
              href="mailto:admin@civicslab.pro"
              className="text-xl font-bold text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-4"
            >
              mrgscivicslab@gmail.com
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
