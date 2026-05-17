import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createClient } from "@/lib/supabase/server";
import { getAnalysis, type Usage } from "@/lib/api";

import { NegotiationSimulator } from "./negotiation";
import { PhotoUploader } from "./photos";
import { AmortizationChart } from "@/components/charts/amortization-chart";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { MonthlyBreakdownChart } from "@/components/charts/monthly-breakdown-chart";
import { CostBreakdownChart } from "@/components/charts/cost-breakdown-chart";
import { PrintButton } from "@/components/print-button";

type Props = { params: Promise<{ id: string }> };

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
type FraisAcq = {
  prix_achat: number;
  droits_enregistrement: number;
  frais_notaire: number;
  frais_hypotheque: number;
  total_frais: number;
  total_acquisition: number;
};
type Travaux = {
  postes: Record<string, number>;
  sous_total: number;
  reserve_imprevus: number;
  total_brut: number;
  primes_wallonie_estimees: number;
  total_net: number;
  user_provided?: boolean;
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
type ProjectionRow = {
  annee: number;
  loyer_mensuel: number;
  loyer_annuel: number;
  charges_annuelles: number;
  cash_flow_net: number;
  cumul_cash_flow: number;
};
type AmortRow = {
  annee: number;
  mensualite: number;
  interets_annuels: number;
  capital_rembourse_annuel: number;
  capital_restant_du: number;
};
type Params = {
  revenu_net: number;
  apport: number;
  usage: Usage;
  duree_credit: number;
  prix_negocie: number | null;
};
type Totaux = {
  total_remboursement: number;
  total_interets_banque: number;
  cout_total_acquisition_25ans: number;
};

function fmt(value: number | null | undefined, suffix = " EUR"): string {
  if (value === null || value === undefined) return "—";
  return Math.round(value).toLocaleString("fr-BE") + suffix;
}

export default async function AnalysisPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/analyses/${id}`)}`);
  }

  let analysis;
  try {
    analysis = await getAnalysis(id, session.access_token);
  } catch {
    notFound();
  }

  const { listing, analyse } = analysis;
  const financement = analyse.financement as Financement;
  const frais = analyse.frais_acquisition as FraisAcq;
  const travaux = analyse.travaux as Travaux;
  const scenarios = analyse.scenarios as Record<string, Scenario>;
  const marche = analyse.marche as Marche;
  const projection = analyse.projection_locative_10ans as ProjectionRow[];
  const amort = analyse.tableau_amortissement as AmortRow[];
  const aParams = analyse.params as Params;
  const invest = analyse.investissement_total as number;
  const prixNegocie = analyse.prix_negocie as number;
  // Defensive : si totaux pas dans la DB (analyses pre-v0.4), on calcule on the fly
  const rawTotaux = analyse.totaux as Totaux | undefined;
  const computedTotalRemboursement =
    financement.mensualite * 12 * financement.duree_annees;
  const computedTotalInterets =
    computedTotalRemboursement - financement.montant_emprunte;
  const totaux: Totaux = rawTotaux ?? {
    total_remboursement: computedTotalRemboursement,
    total_interets_banque: computedTotalInterets,
    cout_total_acquisition_25ans:
      prixNegocie + frais.total_frais + travaux.total_net + computedTotalInterets,
  };
  const aiAdvice = analyse.ai_advice as string | undefined;

  const interets_mois_1 = amort[0]?.interets_annuels
    ? amort[0].interets_annuels / 12
    : 0;

  // Cash-out le jour de la signature (hors travaux qui peuvent etre etales)
  const cashOutSignature = prixNegocie + frais.total_frais;
  const aEmprunter = financement.montant_emprunte;

  const usagePlafond = aParams.usage === "habitation_propre_unique" ? 90 : 80;
  const quotiteOK = financement.quotite_pct <= usagePlafond;
  const ratioOK = financement.ratio_effort_pct <= 33;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* HEADER */}
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
        <div className="flex gap-2 flex-wrap print:hidden">
          <PrintButton />
          <Link
            href="/mes-analyses"
            className={buttonVariants({ variant: "outline" })}
          >
            Mes analyses
          </Link>
          <Link href="/analyze" className={buttonVariants()}>
            + Analyse
          </Link>
        </div>
      </div>

      {/* IA COACH */}
      {aiAdvice && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xl font-bold">
                ✦
              </div>
              <div>
                <CardTitle className="text-xl">Ton coach IA</CardTitle>
                <CardDescription>
                  Conseils personnalisés pour CE bien et TON profil
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-foreground/90 leading-relaxed">
              {aiAdvice}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SYNTHESE FINANCIERE - les 2 cartes clés cote a cote */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* CASH-OUT SIGNATURE */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">À débourser le jour J</CardTitle>
            <CardDescription>
              Ce que tu sors de poche au moment de la signature notaire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Prix d'achat" value={fmt(prixNegocie)} />
            <Row
              label={`Droits enregistrement (${aParams.usage === "habitation_propre_unique" ? "3 %" : "12,5 %"})`}
              value={fmt(frais.droits_enregistrement)}
            />
            <Row label="Frais notaire" value={fmt(frais.frais_notaire)} />
            <Row label="Frais hypothèque" value={fmt(frais.frais_hypotheque)} />
            <div className="border-t border-border my-2"></div>
            <Row
              label="Total cash-out signature"
              value={fmt(cashOutSignature)}
              highlight
            />
            <Row
              label="Ton apport"
              value={`- ${fmt(aParams.apport)}`}
            />
            <Row
              label="Crédit hypothécaire"
              value={fmt(aEmprunter)}
              highlight
            />
            {travaux.total_net > 0 && (
              <p className="text-xs text-muted-foreground pt-3">
                + {fmt(travaux.total_net)} de travaux (étalables après l&apos;achat)
              </p>
            )}
          </CardContent>
        </Card>

        {/* COUT LONG TERME */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Coût sur {financement.duree_annees} ans
            </CardTitle>
            <CardDescription>
              Total que tu auras vraiment payé à la fin du crédit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row
              label="Mensualité"
              value={`${fmt(financement.mensualite)}/mois`}
              highlight
            />
            <Row
              label="Taux fixe appliqué"
              value={`${(financement.taux_applique * 100).toFixed(2)} %`}
            />
            <Row
              label={`Total remboursé (${financement.duree_annees * 12} mensualités)`}
              value={fmt(totaux.total_remboursement)}
            />
            <Row
              label="Intérêts payés à la banque"
              value={fmt(totaux.total_interets_banque)}
            />
            <div className="border-t border-border my-2"></div>
            <Row
              label="Coût total acquisition"
              value={fmt(totaux.cout_total_acquisition_25ans)}
              highlight
            />
            <p className="text-xs text-muted-foreground pt-3">
              Ratio d&apos;effort : {financement.ratio_effort_pct} % du revenu
              net mensuel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SIMULATEUR */}
      <Card>
        <CardHeader>
          <CardTitle>Simuler une négociation</CardTitle>
          <CardDescription>
            Change le prix d&apos;achat, relance l&apos;analyse instantanément.
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
            travaux_budget={travaux.user_provided ? travaux.total_net : null}
          />
        </CardContent>
      </Card>

      {/* GRAPHIQUES - 2x2 grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coût total décomposé</CardTitle>
            <CardDescription>
              Où vont les EUR sur la durée totale du crédit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostBreakdownChart
              prix={prixNegocie}
              frais={frais.total_frais}
              travaux={travaux.total_net}
              interets={totaux.total_interets_banque}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Mensualité : capital vs intérêts
            </CardTitle>
            <CardDescription>
              Décomposition du 1er mois — l&apos;équilibre s&apos;inverse avec
              le temps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBreakdownChart
              mensualite={financement.mensualite}
              interets_mois_1={interets_mois_1}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Amortissement du crédit sur {financement.duree_annees} ans
          </CardTitle>
          <CardDescription>
            Capital restant dû, capital remboursé cumulé, intérêts payés cumulés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AmortizationChart rows={amort} />
        </CardContent>
      </Card>

      {/* BON A SAVOIR - section informative neutre */}
      <Card className="border-dashed border-2 bg-secondary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bon à savoir avant ta banque</CardTitle>
          <CardDescription>
            Repères BNB et financement — informationnel, pas bloquant. Certaines
            banques sont plus souples que ces seuils.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 size-2 rounded-full shrink-0 ${
                  quotiteOK ? "bg-green-500" : "bg-amber-500"
                }`}
              />
              <div>
                <div className="font-medium">
                  Quotité : {financement.quotite_pct} % (plafond BNB{" "}
                  {usagePlafond} % pour ton usage)
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {quotiteOK
                    ? "Tu es sous le plafond BNB, ton dossier passe en général sans souci."
                    : `Tu dépasses le plafond. Solutions : plus d'apport (~${fmt(
                        Math.ceil(
                          invest -
                            (prixNegocie + travaux.total_net) *
                              (usagePlafond / 100),
                        ),
                      )} requis pour passer), prix négocié plus bas, ou banque avec quotité plus haute (avec surtaux).`}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 size-2 rounded-full shrink-0 ${
                  ratioOK ? "bg-green-500" : "bg-amber-500"
                }`}
              />
              <div>
                <div className="font-medium">
                  Ratio d&apos;effort : {financement.ratio_effort_pct} % (cible
                  ≤ 33 %)
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {ratioOK
                    ? "Charge mensuelle confortable vs tes revenus."
                    : "Charge mensuelle élevée. Une durée plus longue (30 ans) ferait baisser la mensualité."}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MARCHE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Marché — {marche.ville || "?"}</CardTitle>
          <CardDescription>Comparaison vs prix moyen local</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-secondary">
              <div className="text-xs text-muted-foreground">
                Prix moyen marché
              </div>
              <div className="text-xl font-bold mt-1">
                {marche.prix_moyen_m2}{" "}
                <span className="text-sm text-muted-foreground font-normal">
                  EUR/m²
                </span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary">
              <div className="text-xs text-muted-foreground">Prix de ce bien</div>
              <div className="text-xl font-bold mt-1">
                {marche.prix_bien_m2}{" "}
                <span className="text-sm text-muted-foreground font-normal">
                  EUR/m²
                </span>
              </div>
            </div>
            <div
              className={`p-4 rounded-lg ${
                marche.decote_vs_marche_pct >= 0
                  ? "bg-green-50 dark:bg-green-950/30"
                  : "bg-amber-50 dark:bg-amber-950/30"
              }`}
            >
              <div className="text-xs text-muted-foreground">
                Décote vs marché
              </div>
              <div className="text-xl font-bold mt-1">
                {marche.decote_vs_marche_pct > 0 ? "+" : ""}
                {marche.decote_vs_marche_pct} %
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TRAVAUX (optionnel) */}
      {travaux.total_net > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Travaux —{" "}
              {travaux.user_provided ? "ton budget" : "estimation conservatrice"}
            </CardTitle>
            <CardDescription>
              {travaux.user_provided ? (
                <>
                  Tu as indiqué <strong>{fmt(travaux.total_net)}</strong>. Pas
                  de décomposition par poste — tu sais ce que tu fais.
                </>
              ) : (
                <>
                  Total net après primes :{" "}
                  <strong>{fmt(travaux.total_net)}</strong> (
                  {fmt(travaux.primes_wallonie_estimees)} de primes Wallonie
                  déduites · 15 % réserve imprévus incluse)
                </>
              )}
            </CardDescription>
          </CardHeader>
          {!travaux.user_provided &&
            Object.keys(travaux.postes || {}).length > 0 && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {Object.entries(travaux.postes).map(([poste, montant]) => (
                    <div
                      key={poste}
                      className="flex justify-between border-b border-border py-1.5"
                    >
                      <span className="text-muted-foreground capitalize">
                        {poste.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium tabular-nums">
                        {fmt(montant)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Estimation conservatrice — tes vrais travaux peuvent être 30
                  à 50 % moins chers sur un petit bien. Relance l&apos;analyse
                  en décochant &laquo;&nbsp;estimer auto&nbsp;&raquo; et entre
                  ton vrai budget.
                </p>
              </CardContent>
            )}
        </Card>
      )}

      {/* SCENARIOS LOCATIFS */}
      {Object.keys(scenarios).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scénarios locatifs</CardTitle>
            <CardDescription>
              Rendement net après précompte, vacance, gestion, entretien,
              assurance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(scenarios).map(([key, sc]) => (
              <div
                key={key}
                className="border border-border rounded-lg p-4 bg-card"
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">{sc.nom}</h3>
                  <span
                    className={`text-base font-bold tabular-nums px-2 py-0.5 rounded ${
                      sc.rendement_net_pct >= 5
                        ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {sc.rendement_net_pct} % net
                  </span>
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
                    <div className="font-medium">
                      {fmt(sc.investissement_total)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PROJECTION CASH-FLOW */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Projection cash-flow locatif 10 ans
          </CardTitle>
          <CardDescription>
            Scénario unifamilial · indexation loyer 2 %/an, charges 2,5 %/an
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowChart rows={projection} />
        </CardContent>
      </Card>

      {/* PHOTOS RENOVATION IA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Photos &laquo;&nbsp;après rénovation&nbsp;&raquo;
          </CardTitle>
          <CardDescription>
            Génère 6 visuels dans ChatGPT / Bing / Midjourney, dépose-les ici.
            Sauvegardés dans ton dossier privé Supabase Storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoUploader analysisId={analysis.id} />
        </CardContent>
      </Card>

      {/* DETAILS BIEN */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détails du bien</CardTitle>
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
      className={`flex justify-between py-1 gap-2 ${
        highlight ? "font-semibold pt-2" : ""
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}
