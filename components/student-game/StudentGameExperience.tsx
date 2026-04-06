'use client';

import { useState } from 'react';
import StudentSignInPanel from '../StudentSignInPanel';
import { clearStudentSession, loadStudentSession } from './sessionStorage';
import StudentDashboard from './StudentDashboard';
import { StudentSession } from './types';

export default function StudentGameExperience() {
  const [session, setSession] = useState<StudentSession | null>(() => {
    const loaded = loadStudentSession();
    if (!loaded) {
      return null;
    }

    const expiresAtMs = Date.parse(loaded.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
      return loaded;
    }

    clearStudentSession();
    return null;
  });

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
