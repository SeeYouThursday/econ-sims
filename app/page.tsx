'use client'; // This tells Next.js this is an interactive game

import FedGame from '@/components/FedGame';

export default function GamePage() {
  return (
    <main style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '40px' }}>
      <FedGame />
    </main>
  );
}