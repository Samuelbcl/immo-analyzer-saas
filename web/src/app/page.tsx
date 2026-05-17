import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl text-center space-y-8">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Analyse ton investissement immobilier
          <span className="block text-orange-700 dark:text-orange-500 mt-2">
            en 30 secondes
          </span>
        </h1>

        <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Colle une URL Immoweb. Reçois un rapport complet : verdict d&apos;achat,
          chiffrage travaux, rendement locatif net, scénarios, faisabilité du
          financement. Conçu pour la Wallonie (Liège, Verviers, Namur, Charleroi).
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/analyze"
            className={buttonVariants({ size: "lg" }) + " text-base px-8"}
          >
            Analyser une annonce
          </Link>
        </div>

        <p className="text-sm text-zinc-500 pt-8">
          Gratuit pendant la bêta · Sans inscription
        </p>
      </div>
    </main>
  );
}
