import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-3xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-sm text-accent-foreground border border-border">
          <span className="size-1.5 rounded-full bg-primary" />
          Wallonie · Liège · Verviers · Namur · Charleroi
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Analyse ton investissement
          <span className="block text-primary mt-2">
            immobilier en 30 secondes
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Colle une URL Immoweb. Reçois un rapport complet : verdict
          d&apos;achat, chiffrage travaux, rendement locatif net, scénarios,
          faisabilité du financement, projection 10 ans.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/analyze"
            className={
              buttonVariants({ size: "lg" }) + " text-base px-8 h-12"
            }
          >
            Analyser une annonce
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 text-left">
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="text-primary text-2xl mb-2">●</div>
            <h3 className="font-semibold mb-1">Scraping automatique</h3>
            <p className="text-sm text-muted-foreground">
              Prix, surface, PEB, photos, description — tout récupéré depuis
              Immoweb en quelques secondes.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="text-primary text-2xl mb-2">●</div>
            <h3 className="font-semibold mb-1">Analyse financière</h3>
            <p className="text-sm text-muted-foreground">
              Mensualité, quotité, ratio d&apos;effort, rendement net après
              charges, stress tests, projection.
            </p>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="text-primary text-2xl mb-2">●</div>
            <h3 className="font-semibold mb-1">Verdict honnête</h3>
            <p className="text-sm text-muted-foreground">
              Score sur 100 + couleur vert / ambre / rouge. Et si bloqué, on te
              dit exactement quoi faire pour débloquer.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground pt-8">
          Gratuit pendant la bêta · Sans inscription
        </p>
      </div>
    </main>
  );
}
