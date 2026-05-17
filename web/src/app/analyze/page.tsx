"use client";

import { useState } from "react";
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

import { createAnalysis, type Usage } from "@/lib/api";

export default function AnalyzePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    revenu_net: 2500,
    apport: 20000,
    usage: "habitation_propre_unique" as Usage,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await createAnalysis(form);
      router.push(`/analyses/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Retour
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle analyse</CardTitle>
          <CardDescription>
            Colle l&apos;URL de l&apos;annonce Immoweb et ton profil financier.
            Le scraping + l&apos;analyse prennent 10 à 15 secondes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">URL Immoweb</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://www.immoweb.be/fr/annonce/..."
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

            <div className="space-y-2">
              <Label htmlFor="usage">Usage prévu</Label>
              <Select
                value={form.usage}
                onValueChange={(v) =>
                  setForm({ ...form, usage: v as Usage })
                }
                disabled={loading}
              >
                <SelectTrigger id="usage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="habitation_propre_unique">
                    Habitation propre (résidence principale, 3% droits)
                  </SelectItem>
                  <SelectItem value="investissement_locatif">
                    Investissement locatif (12,5% droits)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm dark:bg-red-950 dark:border-red-900 dark:text-red-200">
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
                ? "Analyse en cours (10-15s)..."
                : "Lancer l'analyse"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
