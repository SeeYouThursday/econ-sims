import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import { isTeacherAdminUserId } from '@/lib/adminAccess';
import { isClerkConfigured } from '@/lib/clerk';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: `Mr. G's Civics Lab`,
  description:
    'Economics Simulations to use in classrooms including a Federal Reserve Simulation.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkEnabled = isClerkConfigured();
  let showTeacherApprovalLink = false;

  if (clerkEnabled) {
    const { userId } = await auth();
    showTeacherApprovalLink = isTeacherAdminUserId(userId);
  }

  const shell = (
    <>
      <SiteHeader
        clerkEnabled={clerkEnabled}
        showTeacherApprovalLink={showTeacherApprovalLink}
      />
      {children}
    </>
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {clerkEnabled ? <ClerkProvider>{shell}</ClerkProvider> : shell}
        <Footer />
      </body>
    </html>
  );
}
