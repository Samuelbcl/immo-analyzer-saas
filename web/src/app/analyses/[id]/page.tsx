import { notFound } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getAnalysis } from "@/lib/api";

type Props = { params: Promise<{ id: string }> };

type Verdict = { titre: string; couleur: string; texte: string };
type Score = { total: number; details: Record<string, number> };
type Financement = {
  apport: number;
  montant_emprunte: number;
  taux_applique: number;
  duree_annees: number;
  mensualite: number;
  capacite_max_emprunt: number;
  quotite_pct: number;
  quotite_acceptable: boolean;
  ratio_effort_pct: number;
};
type Travaux = {
  postes: Record<string, number>;
  sous_total: number;
  reserve_imprevus: number;
  total_brut: number;
  primes_wallonie_estimees: number;
  total_net: number;
};
type Scenario = {
  nom: string;
  loyer_mensuel: number;
  investissement_total: number;
  cash_flow_net_annuel: number;
  rendement_net_pct: number;
};
type Marche = {
  ville: string | null;
  prix_moyen_m2: number;
  prix_bien_m2: number;
  decote_vs_marche_pct: number;
};

export default async function AnalysisPage({ params }: Props) {
  const { id } = await params;

  let analysis;
  try {
    analysis = await getAnalysis(id);
  } catch {
    notFound();
  }

  const { listing, analyse } = analysis;
  const verdict = analyse.verdict as Verdict;
  const score = analyse.score as Score;
  const financement = analyse.financement as Financement;
  const travaux = analyse.travaux as Travaux;
  const scenarios = analyse.scenarios as Record<string, Scenario>;
  const marche = analyse.marche as Marche;
  const invest = analyse.investissement_total as number;

  const verdictBg =
    verdict.couleur === "vert"
      ? "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800"
      : verdict.couleur === "ambre"
      ? "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800"
      : "bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-800";

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Accueil
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            {listing.address || "Adresse inconnue"}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            {listing.price !== null && `${listing.price.toLocaleString("fr-BE")} EUR`}
            {listing.surface && ` · ${listing.surface} m²`}
            {listing.bedrooms !== null && ` · ${listing.bedrooms} ch.`}
            {listing.peb && ` · PEB ${listing.peb}`}
            {listing.year_built && ` · ${listing.year_built}`}
          </p>
        </div>
        <Link
          href="/analyze"
          className={buttonVariants({ variant: "outline" })}
        >
          Nouvelle analyse
        </Link>
      </div>

      <Card className={`${verdictBg} border-2`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl">{verdict.titre}</CardTitle>
              <CardDescription className="text-base mt-2 text-inherit/80">
                {verdict.texte}
              </CardDescription>
            </div>
            <div className="text-right shrink-0">
              <div className="text-5xl font-bold leading-none">
                {score.total}
              </div>
              <div className="text-sm opacity-70 mt-1">/100</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Financement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Investissement total"
              value={`${invest?.toLocaleString("fr-BE")} EUR`}
            />
            <Row
              label="Apport"
              value={`${financement.apport?.toLocaleString("fr-BE")} EUR`}
            />
            <Row
              label="À emprunter"
              value={`${financement.montant_emprunte?.toLocaleString("fr-BE")} EUR`}
            />
            <Row
              label="Taux appliqué"
              value={`${(financement.taux_applique * 100).toFixed(2)} %`}
            />
            <Row
              label="Durée"
              value={`${financement.duree_annees} ans`}
            />
            <Row
              label="Mensualité"
              value={`${financement.mensualite?.toLocaleString("fr-BE")} EUR/mois`}
              highlight
            />
            <Row
              label="Ratio d'effort"
              value={`${financement.ratio_effort_pct} %`}
            />
            <Row
              label="Quotité"
              value={`${financement.quotite_pct} % ${
                financement.quotite_acceptable ? "✓ OK" : "✗ trop élevée"
              }`}
              highlight
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marché — {marche.ville || "?"}</CardTitle>
            <CardDescription>Comparaison vs prix moyen local</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Prix moyen marché (m²)"
              value={`${marche.prix_moyen_m2} EUR/m²`}
            />
            <Row
              label="Prix du bien (m²)"
              value={`${marche.prix_bien_m2} EUR/m²`}
            />
            <Row
              label="Décote vs marché"
              value={`${
                marche.decote_vs_marche_pct > 0 ? "+" : ""
              }${marche.decote_vs_marche_pct} %`}
              highlight
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Travaux estimés</CardTitle>
          <CardDescription>
            Total net après primes Wallonie :{" "}
            <strong>{travaux.total_net?.toLocaleString("fr-BE")} EUR</strong>{" "}
            ({travaux.primes_wallonie_estimees?.toLocaleString("fr-BE")} EUR de
            primes déduites · 15% de réserve imprévus incluse)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(travaux.postes || {}).map(([poste, montant]) => (
              <div
                key={poste}
                className="flex justify-between border-b py-1.5"
              >
                <span className="text-zinc-600 dark:text-zinc-400 capitalize">
                  {poste.replace(/_/g, " ")}
                </span>
                <span className="font-medium tabular-nums">
                  {montant.toLocaleString("fr-BE")} EUR
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scénarios locatifs</CardTitle>
          <CardDescription>
            Rendement net après précompte, vacance, gestion, entretien et
            assurance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(scenarios).map(([key, sc]) => (
            <div
              key={key}
              className="border rounded-md p-4 space-y-3 bg-white dark:bg-zinc-900"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">{sc.nom}</h3>
                <Badge
                  variant={sc.rendement_net_pct >= 5 ? "default" : "secondary"}
                  className="text-base px-3 py-1"
                >
                  {sc.rendement_net_pct} % net
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500">Loyer mensuel</div>
                  <div className="font-medium">
                    {sc.loyer_mensuel?.toLocaleString("fr-BE")} EUR
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Cash-flow net annuel</div>
                  <div
                    className={`font-medium ${
                      sc.cash_flow_net_annuel < 0
                        ? "text-red-700 dark:text-red-400"
                        : ""
                    }`}
                  >
                    {sc.cash_flow_net_annuel?.toLocaleString("fr-BE")} EUR
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Investissement</div>
                  <div className="font-medium">
                    {sc.investissement_total?.toLocaleString("fr-BE")} EUR
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détails du bien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Référence Immoweb" value={listing.reference || "—"} />
          <Row
            label="Année construction"
            value={listing.year_built?.toString() || "—"}
          />
          <Row label="Agence" value={listing.agency || "—"} />
          <Row
            label="Features détectées"
            value={listing.features.join(", ") || "Aucune"}
          />
          {listing.description && (
            <div className="pt-4">
              <div className="text-zinc-500 mb-1">Description</div>
              <p className="text-zinc-700 dark:text-zinc-300">
                {listing.description.slice(0, 600)}
                {listing.description.length > 600 && " …"}
              </p>
            </div>
          )}
          {listing.url && (
            <div className="pt-4">
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-700 dark:text-orange-500 hover:underline"
              >
                Voir l&apos;annonce originale sur Immoweb →
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1 ${
        highlight ? "font-semibold border-t pt-2 mt-1" : ""
      }`}
    >
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
