import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-lg tracking-tight hover:text-primary transition-colors"
        >
          immo<span className="text-primary">·</span>analyzer
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/analyze"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Analyser
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
