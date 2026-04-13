'use client';

import { useEffect, useState } from 'react';
import StudentSignInPanel from '../StudentSignInPanel';
import { clearStudentSession, loadStudentSession } from './sessionStorage';
import StudentDashboard from './StudentDashboard';
import { StudentSession } from './types';

export default function StudentGameExperience() {
  const [session, setSession] = useState<StudentSession | null>(null);

  // Restore session from localStorage after hydration to avoid mismatch
  useEffect(() => {
    const loaded = loadStudentSession();
    if (loaded) {
      const expiresAtMs = Date.parse(loaded.expiresAt);
      if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession(loaded);
      } else {
        clearStudentSession();
      }
    }
  }, []);

  const handleSignOut = () => {
    clearStudentSession();
    setSession(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {!session ? <StudentSignInPanel onSignedIn={setSession} /> : null}

      {session ? (
        <StudentDashboard session={session} onSignOut={handleSignOut} />
      ) : null}
    </div>
  );
}
