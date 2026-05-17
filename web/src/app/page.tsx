import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center bg-mesh">
      <section className="w-full max-w-5xl px-6 py-24 sm:py-32 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-sm font-medium">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span>IA + données belges · Wallonie</span>
        </div>

        <h1 className="mt-8 text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter leading-[1.05]">
          L&apos;analyse d&apos;investissement{" "}
          <span className="bg-gradient-to-r from-primary via-chart-2 to-primary bg-clip-text text-transparent">
            immobilier
          </span>
          ,
          <br />
          réinventée.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Colle une URL Immoweb. En quelques secondes, reçois un rapport
          complet avec verdict, scénarios financiers, projections, et un coach
          IA qui te conseille sur ce bien précis et ton profil.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={user ? "/analyze" : "/login?next=/analyze"}
            className={
              buttonVariants({ size: "lg" }) +
              " text-base px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
            }
          >
            Analyser une annonce →
          </Link>
          {user && (
            <Link
              href="/mes-analyses"
              className={
                buttonVariants({ size: "lg", variant: "outline" }) +
                " text-base px-8 h-12"
              }
            >
              Mes analyses
            </Link>
          )}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {user ? `Connecté : ${user.email}` : "Sans CB · sans engagement · gratuit en bêta"}
        </p>
      </section>

      <section className="w-full max-w-6xl px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Feature
          title="Scraping intelligent"
          body="Prix, surface, PEB, photos, description — tout extrait automatiquement depuis Immoweb avec bypass anti-bot."
          icon="◆"
        />
        <Feature
          title="Analyse financière complète"
          body="Mensualité, quotité BNB, ratio d'effort, rendement net, stress tests, projection 10 ans. Spécifique Belgique."
          icon="◈"
        />
        <Feature
          title="Coach IA personnalisé"
          body="3 conseils actionnables générés par GPT-4 pour CE bien et TON profil. Tu sais quoi faire après l'analyse."
          icon="◉"
        />
      </section>

      <section className="w-full bg-secondary/30 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Pensé pour l&apos;investisseur belge
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Droits d&apos;enregistrement 3 % / 12,5 %, quotité BNB 80 % /
            90 %, primes Wallonie, indexation RC, précompte communal — tout est
            câblé pour la Wallonie. Liège, Verviers, Namur, Charleroi.
          </p>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
            <Stat label="Calculs financiers" value="20+" />
            <Stat label="Scénarios par bien" value="3" />
            <Stat label="Années projetées" value="10" />
            <Stat label="Conseils IA" value="3+" />
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: string;
}) {
  return (
    <div className="glass border border-border rounded-xl p-6 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200">
      <div className="text-2xl text-primary mb-3">{icon}</div>
      <h3 className="font-semibold text-base">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight text-primary">
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
