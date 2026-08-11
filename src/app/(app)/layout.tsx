import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { AppSidebar } from "@/components/app-sidebar";

// Every page under this route group requires a session — "signed in" and
// "Gmail connected" are the same action in this product (the OAuth flow in
// src/app/api/auth/google/route.ts requests identity + gmail.readonly
// scopes together), so there's no separate identity-only sign-in to gate on.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/?connect=1");
  }

  return (
    <div className="min-h-screen bg-paper bg-kraft-texture flex">
      <AppSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
