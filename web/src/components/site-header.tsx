import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-border bg-background/70 backdrop-blur-md sticky top-0 z-10 print:hidden">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-lg tracking-tight hover:text-primary transition-colors flex items-center gap-2"
        >
          <span className="inline-block size-2 rounded-full bg-primary" />
          immo<span className="text-primary">·</span>analyzer
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/mes-analyses"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                Mes analyses
              </Link>
              <Link
                href="/mes-alertes"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                Alertes
              </Link>
              <Link
                href="/analyze"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                + Analyser
              </Link>
              <UserMenu email={user.email ?? ""} />
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              Connexion
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
