import { clerkMiddleware } from '@clerk/nextjs/server';

// Clerk session propagation for teacher auth routes.
// Only active when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
// See lib/clerk.ts for graceful degradation when Clerk is not configured.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
