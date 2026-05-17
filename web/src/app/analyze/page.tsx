"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createClient } from "@/lib/supabase/client";
import { createAnalysis, type Usage } from "@/lib/api";

export default function AnalyzePage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    revenu_net: 2500,
    apport: 20000,
    usage: "habitation_propre_unique" as Usage,
    duree_credit: 25,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login?next=/analyze");
      } else {
        setAuthed(true);
        setAuthChecking(false);
      }
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login?next=/analyze");
        return;
      }
      const res = await createAnalysis(form, session.access_token);
      router.push(`/analyses/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  if (authChecking) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-muted-foreground">Vérification de la session…</p>
      </main>
    );
  }

  if (!authed) return null;

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Accueil
        </Link>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-2xl">Nouvelle analyse</CardTitle>
          <CardDescription>
            Le scraping + l&apos;analyse + le conseil IA prennent 10-15 secondes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="url">URL Immoweb</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://www.immoweb.be/fr/annonce/…"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenu">Revenu net mensuel (EUR)</Label>
                <Input
                  id="revenu"
                  type="number"
                  min={500}
                  max={20000}
                  step={100}
                  value={form.revenu_net}
                  onChange={(e) =>
                    setForm({ ...form, revenu_net: Number(e.target.value) })
                  }
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apport">Apport disponible (EUR)</Label>
                <Input
                  id="apport"
                  type="number"
                  min={0}
                  max={2000000}
                  step={1000}
                  value={form.apport}
                  onChange={(e) =>
                    setForm({ ...form, apport: Number(e.target.value) })
                  }
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usage">Usage prévu</Label>
                <Select
                  value={form.usage}
                  onValueChange={(v) => setForm({ ...form, usage: v as Usage })}
                  disabled={loading}
                >
                  <SelectTrigger id="usage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="habitation_propre_unique">
                      Habitation propre (3 % droits, 90 % quotité)
                    </SelectItem>
                    <SelectItem value="investissement_locatif">
                      Investissement locatif (12,5 % droits, 80 % quotité)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duree">Durée crédit</Label>
                <Select
                  value={String(form.duree_credit)}
                  onValueChange={(v) =>
                    setForm({ ...form, duree_credit: Number(v) })
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="duree">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 ans</SelectItem>
                    <SelectItem value="20">20 ans</SelectItem>
                    <SelectItem value="25">25 ans</SelectItem>
                    <SelectItem value="30">30 ans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
                <strong>Erreur :</strong> {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading
                ? "Analyse en cours (10-15s)…"
                : "🚀 Lancer l'analyse"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
