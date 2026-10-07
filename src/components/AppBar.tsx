import Link from "next/link";
import { Briefcase, Settings, User } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { isAuthenticated } from "@/lib/auth";

export async function AppBar() {
  const isLoggedIn = await isAuthenticated();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold transition-opacity hover:opacity-80"
        >
          <Briefcase className="h-5 w-5 text-primary" />
          <span>Job Aggregator</span>
        </Link>

        <nav className="flex items-center gap-2 md:gap-4">
          {isLoggedIn ? (
            <>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
              <div className="h-4 w-px bg-border mx-1" />
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
            >
              <User className="h-4 w-4" />
              <span>Log in</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
