import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createClient } from "@/lib/supabase/server";
import { listAnalyses } from "@/lib/api";

export default async function MesAnalysesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?next=/mes-analyses");
  }

  let analyses: Awaited<ReturnType<typeof listAnalyses>> = [];
  let error: string | null = null;
  try {
    analyses = await listAnalyses(session.access_token);
  } catch (e) {
    error = e instanceof Error ? e.message : "Erreur";
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes analyses</h1>
          <p className="text-muted-foreground mt-1">
            {analyses.length} analyse{analyses.length > 1 ? "s" : ""} sauvegardée
            {analyses.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/analyze" className={buttonVariants()}>
          + Nouvelle analyse
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {analyses.length === 0 && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Aucune analyse encore</CardTitle>
            <CardDescription>
              Lance ta première analyse depuis une URL Immoweb pour la voir
              apparaître ici.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/analyze"
              className={buttonVariants({ size: "lg" }) + " w-full sm:w-auto"}
            >
              Analyser une annonce
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analyses.map((a) => (
          <Link
            key={a.id}
            href={`/analyses/${a.id}`}
            className="group"
          >
            <Card className="hover:border-primary/40 hover:-translate-y-0.5 transition-all h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                      {a.address || "Adresse inconnue"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {a.city ?? "—"}
                      {a.price !== null &&
                        ` · ${a.price.toLocaleString("fr-BE")} EUR`}
                    </CardDescription>
                  </div>
                  <VerdictBadge
                    color={a.verdict_color}
                    score={a.score}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {a.verdict}
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  {new Date(a.created_at).toLocaleDateString("fr-BE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}

function VerdictBadge({
  color,
  score,
}: {
  color: "vert" | "ambre" | "rouge" | null;
  score: number | null;
}) {
  if (score === null) return null;
  const cls =
    color === "vert"
      ? "bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-100 dark:border-green-800"
      : color === "ambre"
        ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800"
        : "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800";
  return (
    <Badge className={`${cls} font-semibold border tabular-nums px-2 py-0.5`}>
      {score}/100
    </Badge>
  );
}
