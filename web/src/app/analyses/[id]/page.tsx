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

import { getAnalysis, type Usage } from "@/lib/api";
import { NegotiationSimulator } from "./negotiation";
import { PhotoUploader } from "./photos";

type Props = { params: Promise<{ id: string }> };

type Verdict = { titre: string; couleur: "vert" | "ambre" | "rouge"; texte: string };
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
type StressTest = {
  base: { mensualite: number; ratio_effort: number; couverture_loyer: number };
  taux_plus_1pct: { mensualite: number; ratio_effort: number };
  taux_plus_2pct: { mensualite: number; ratio_effort: number };
  vacance_15pct: { loyer_net: number; cash_flow_vs_mensualite: number };
};
type ProjectionRow = {
  annee: number;
  loyer_mensuel: number;
  loyer_annuel: number;
  charges_annuelles: number;
  cash_flow_net: number;
  cumul_cash_flow: number;
  rendement_an: number;
};
type Params = {
  revenu_net: number;
  apport: number;
  usage: Usage;
  duree_credit: number;
  prix_negocie: number | null;
};

function fmt(value: number | null | undefined, suffix = " EUR"): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-BE") + suffix;
}

function computeAdvice(
  analyse: {
    verdict: Verdict;
    financement: Financement;
    travaux: Travaux;
    prix_negocie: number;
    investissement_total: number;
    params: Params;
  }
): { title: string; actions: string[] } | null {
  const { verdict, financement, travaux, prix_negocie, investissement_total, params } = analyse;

  if (verdict.couleur === "rouge" && !financement.quotite_acceptable) {
    const maxQuotite = params.usage === "habitation_propre_unique" ? 0.9 : 0.8;
    const valGarantie = prix_negocie + travaux.total_net;
    const maxEmprunt = valGarantie * maxQuotite;
    const apportNeeded = Math.ceil(investissement_total - maxEmprunt);
    const apportMissing = Math.max(0, apportNeeded - financement.apport);
    const prixCible = Math.max(
      30000,
      Math.round((prix_negocie - apportMissing) / 1000) * 1000
    );

    return {
      title: "Comment débloquer ce bien",
      actions: [
        `Atteindre ${fmt(apportNeeded)} d'apport (il te manque ${fmt(apportMissing)})`,
        `Ou négocier le prix d'achat aux alentours de ${fmt(prixCible)} (simulateur ci-dessous)`,
        params.usage === "investissement_locatif"
          ? "Ou ré-analyser ce bien en habitation propre (plafond quotité 90% au lieu de 80%)"
          : "Ou viser un bien moins cher dans le même quartier",
      ],
    };
  }

  if (verdict.couleur === "ambre" && financement.ratio_effort_pct > 35) {
    return {
      title: "Comment alléger la charge mensuelle",
      actions: [
        `Augmenter la durée du crédit (passe de ${financement.duree_annees} à 30 ans si la banque l'accepte)`,
        "Augmenter l'apport pour réduire le montant emprunté",
        "Négocier le prix à la baisse (simulateur ci-dessous)",
      ],
    };
  }

  if (verdict.couleur === "vert") {
    return {
      title: "Tu es bien positionné — passe à l'action",
      actions: [
        "Visite le bien rapidement (un bien à ce niveau ne reste pas sur le marché)",
        "Prépare ton dossier banque (3 derniers bulletins de paie, relevés bancaires, contrat)",
        "Fais une offre d'achat formalisée par l'agent immobilier",
      ],
    };
  }

  return null;
}

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
  const stress = analyse.stress_test as StressTest;
  const projection = analyse.projection_locative_10ans as ProjectionRow[];
  const aParams = analyse.params as Params;
  const invest = analyse.investissement_total as number;
  const prixNegocie = analyse.prix_negocie as number;

  const advice = computeAdvice({
    verdict,
    financement,
    travaux,
    prix_negocie: prixNegocie,
    investissement_total: invest,
    params: aParams,
  });

  const verdictBg =
    verdict.couleur === "vert"
      ? "bg-green-50 border-green-300 text-green-950 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100"
      : verdict.couleur === "ambre"
        ? "bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100"
        : "bg-red-50 border-red-300 text-red-950 dark:bg-red-950/30 dark:border-red-800 dark:text-red-100";

  const scenarioBest = Math.max(
    ...Object.values(scenarios).map((s) => s.rendement_net_pct ?? 0)
  );

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {listing.address || "Adresse inconnue"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {listing.price !== null && fmt(listing.price)}
            {listing.surface && ` · ${listing.surface} m²`}
            {listing.bedrooms !== null && ` · ${listing.bedrooms} ch.`}
            {listing.peb && ` · PEB ${listing.peb}`}
            {listing.year_built && ` · ${listing.year_built}`}
          </p>
        </div>
        <Link href="/analyze" className={buttonVariants({ variant: "outline" })}>
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
              <div className="text-5xl font-bold leading-none">{score.total}</div>
              <div className="text-sm opacity-70 mt-1">/100</div>
            </div>
          </div>
        </CardHeader>
        {advice && (
          <CardContent className="border-t pt-4 border-current/20">
            <div className="font-semibold mb-2">→ {advice.title}</div>
            <ul className="space-y-1 text-sm">
              {advice.actions.map((action, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-current/60 shrink-0">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simuler une négociation</CardTitle>
          <CardDescription>
            Change le prix d&apos;achat pour voir l&apos;impact sur la quotité,
            la mensualité et le verdict.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NegotiationSimulator
            url={analysis.url}
            revenu_net={aParams.revenu_net}
            apport={aParams.apport}
            usage={aParams.usage}
            duree_credit={aParams.duree_credit}
            currentPrice={prixNegocie}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Financement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Investissement total" value={fmt(invest)} />
            <Row label="Apport" value={fmt(financement.apport)} />
            <Row label="À emprunter" value={fmt(financement.montant_emprunte)} />
            <Row
              label="Taux appliqué"
              value={`${(financement.taux_applique * 100).toFixed(2)} %`}
            />
            <Row label="Durée" value={`${financement.duree_annees} ans`} />
            <Row
              label="Mensualité"
              value={`${fmt(financement.mensualite)}/mois`}
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
            <Row
              label="Capacité max emprunt"
              value={fmt(financement.capacite_max_emprunt)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marché — {marche.ville || "?"}</CardTitle>
            <CardDescription>Comparaison vs prix moyen local</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
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
            <div className="pt-4 text-xs text-muted-foreground">
              {marche.decote_vs_marche_pct > 20
                ? "Décote forte — bien probablement à rénover ou quartier moins prisé. Va sur place valider."
                : marche.decote_vs_marche_pct > 5
                  ? "Décote modérée — bonne opportunité si le bien est en bon état."
                  : marche.decote_vs_marche_pct > -10
                    ? "Prix dans la fourchette du marché."
                    : "Prix au-dessus du marché — il faut une raison particulière (location vue, jardin exceptionnel, etc.)."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Travaux estimés</CardTitle>
          <CardDescription>
            Total net après primes Wallonie :{" "}
            <strong>{fmt(travaux.total_net)}</strong> ({fmt(travaux.primes_wallonie_estimees)} de
            primes déduites · 15% de réserve imprévus incluse)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(travaux.postes || {}).map(([poste, montant]) => (
              <div
                key={poste}
                className="flex justify-between border-b border-border py-1.5"
              >
                <span className="text-muted-foreground capitalize">
                  {poste.replace(/_/g, " ")}
                </span>
                <span className="font-medium tabular-nums">{fmt(montant)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scénarios locatifs</CardTitle>
          <CardDescription>
            Rendement net après précompte, vacance, gestion, entretien, assurance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(scenarios).map(([key, sc]) => (
            <div
              key={key}
              className={`border rounded-md p-4 space-y-3 bg-card ${
                sc.rendement_net_pct === scenarioBest
                  ? "border-primary/50 bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">
                  {sc.nom}
                  {sc.rendement_net_pct === scenarioBest && (
                    <Badge className="ml-2 align-middle">Meilleur</Badge>
                  )}
                </h3>
                <Badge
                  variant={sc.rendement_net_pct >= 5 ? "default" : "secondary"}
                  className="text-base px-3 py-1"
                >
                  {sc.rendement_net_pct} % net
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Loyer mensuel</div>
                  <div className="font-medium">{fmt(sc.loyer_mensuel)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    Cash-flow net annuel
                  </div>
                  <div
                    className={`font-medium ${
                      sc.cash_flow_net_annuel < 0
                        ? "text-red-700 dark:text-red-400"
                        : ""
                    }`}
                  >
                    {fmt(sc.cash_flow_net_annuel)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Investissement</div>
                  <div className="font-medium">{fmt(sc.investissement_total)}</div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stress test du financement</CardTitle>
          <CardDescription>
            Et si les taux montent ? Et si tu as 15% de vacance locative ?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <StressBox
              title="Base"
              mensualite={stress.base.mensualite}
              effort={stress.base.ratio_effort}
              extra={`Couverture loyer/mensualité : ${stress.base.couverture_loyer}%`}
            />
            <StressBox
              title="Taux +1 %"
              mensualite={stress.taux_plus_1pct.mensualite}
              effort={stress.taux_plus_1pct.ratio_effort}
            />
            <StressBox
              title="Taux +2 %"
              mensualite={stress.taux_plus_2pct.mensualite}
              effort={stress.taux_plus_2pct.ratio_effort}
            />
            <StressBox
              title="Vacance 15 %"
              mensualite={null}
              effort={null}
              extra={`Loyer net : ${fmt(stress.vacance_15pct.loyer_net)}/mois · cash-flow vs mensualité : ${fmt(stress.vacance_15pct.cash_flow_vs_mensualite)}`}
              isVacance
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projection cash-flow 10 ans</CardTitle>
          <CardDescription>
            Scénario locatif unifamilial · indexation loyer 2 %/an, charges
            2,5 %/an
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Année</th>
                  <th className="py-2 pr-4 text-right">Loyer mensuel</th>
                  <th className="py-2 pr-4 text-right">Charges/an</th>
                  <th className="py-2 pr-4 text-right">Cash-flow net</th>
                  <th className="py-2 text-right">Cumul</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((row) => (
                  <tr
                    key={row.annee}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1.5 pr-4 font-medium">An {row.annee}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      {fmt(row.loyer_mensuel)}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                      {fmt(row.charges_annuelles)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right tabular-nums ${
                        row.cash_flow_net < 0
                          ? "text-red-700 dark:text-red-400"
                          : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      {fmt(row.cash_flow_net)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {fmt(row.cumul_cash_flow)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail du score sur 100</CardTitle>
          <CardDescription>
            Décomposition des points par catégorie
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ScoreBar
              label="Prix /m² vs marché"
              value={score.details.prix_m2}
              max={25}
            />
            <ScoreBar
              label="Rendement locatif"
              value={score.details.rendement}
              max={30}
            />
            <ScoreBar
              label="État technique"
              value={score.details.etat_technique}
              max={20}
            />
            <ScoreBar
              label="Localisation"
              value={score.details.localisation}
              max={15}
            />
            <ScoreBar
              label="Potentiel division"
              value={score.details.potentiel_division}
              max={10}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photos &quot;après rénovation&quot;</CardTitle>
          <CardDescription>
            Génère 6 visuels dans ChatGPT, Bing Image Creator, Midjourney ou
            Stable Diffusion, puis dépose-les ici. Pour l&apos;instant les
            photos sont gardées en mémoire navigateur seulement — la
            sauvegarde permanente arrivera avec Supabase Storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoUploader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détails du bien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
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
              <div className="text-muted-foreground mb-1">Description</div>
              <p className="text-foreground/90 whitespace-pre-line">
                {listing.description.slice(0, 800)}
                {listing.description.length > 800 && " …"}
              </p>
            </div>
          )}
          {listing.url && (
            <div className="pt-4">
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
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
        highlight ? "font-semibold border-t border-border pt-2 mt-1" : ""
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}

function StressBox({
  title,
  mensualite,
  effort,
  extra,
  isVacance,
}: {
  title: string;
  mensualite: number | null;
  effort: number | null;
  extra?: string;
  isVacance?: boolean;
}) {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="font-semibold text-sm mb-2">{title}</div>
      {mensualite !== null && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Mensualité</span>
          <span className="tabular-nums">{fmt(mensualite)}</span>
        </div>
      )}
      {effort !== null && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ratio effort</span>
          <span
            className={`tabular-nums ${
              effort > 35 ? "text-red-700 dark:text-red-400" : ""
            }`}
          >
            {effort} %
          </span>
        </div>
      )}
      {extra && (
        <div
          className={`text-xs mt-2 ${
            isVacance ? "text-muted-foreground" : "text-muted-foreground"
          }`}
        >
          {extra}
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <strong>{value}</strong>
          <span className="text-muted-foreground"> / {max}</span>
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
