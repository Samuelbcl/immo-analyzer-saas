"use client";

import { useCallback, useEffect, useState } from "react";

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
import { Badge } from "@/components/ui/badge";

type Alert = {
  id: string;
  label: string | null;
  city: string;
  max_price: number;
  min_bedrooms: number;
  property_type: string;
  active: boolean;
  created_at: string;
};

const API_BASE = "";

async function apiFetch(
  path: string,
  jwt: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export function AlertsManager({ jwt }: { jwt: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    city: "liege",
    max_price: 150000,
    min_bedrooms: 2,
    property_type: "maison-et-appartement" as const,
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/alerts", jwt);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlerts(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/alerts", jwt, {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      await refresh();
      setForm((f) => ({ ...f, label: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(alert: Alert) {
    await apiFetch(`/api/alerts/${alert.id}`, jwt, {
      method: "PATCH",
      body: JSON.stringify({ active: !alert.active }),
    });
    await refresh();
  }

  async function deleteAlert(alert: Alert) {
    if (!confirm(`Supprimer l'alerte « ${alert.label || alert.city} » ?`)) return;
    await apiFetch(`/api/alerts/${alert.id}`, jwt, { method: "DELETE" });
    await refresh();
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes alertes email</h1>
        <p className="text-muted-foreground mt-1">
          Reçois un email automatique quand un nouveau bien Immoweb matche tes
          critères. Scan quotidien.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle alerte</CardTitle>
          <CardDescription>
            Tu seras notifié quand de nouveaux biens correspondants apparaissent
            sur Immoweb.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="label">Nom de l&apos;alerte (optionnel)</Label>
              <Input
                id="label"
                placeholder="Ex: Investissement Liège centre"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Select
                value={form.city}
                onValueChange={(v) => v && setForm({ ...form, city: v })}
              >
                <SelectTrigger id="city">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="liege">Liège</SelectItem>
                  <SelectItem value="verviers">Verviers</SelectItem>
                  <SelectItem value="namur">Namur</SelectItem>
                  <SelectItem value="charleroi">Charleroi</SelectItem>
                  <SelectItem value="mons">Mons</SelectItem>
                  <SelectItem value="seraing">Seraing</SelectItem>
                  <SelectItem value="herstal">Herstal</SelectItem>
                  <SelectItem value="bruxelles">Bruxelles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ptype">Type de bien</Label>
              <Select
                value={form.property_type}
                onValueChange={(v) =>
                  v &&
                  setForm({
                    ...form,
                    property_type: v as typeof form.property_type,
                  })
                }
              >
                <SelectTrigger id="ptype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maison-et-appartement">
                    Maison + Appartement
                  </SelectItem>
                  <SelectItem value="maison">Maison uniquement</SelectItem>
                  <SelectItem value="appartement">
                    Appartement uniquement
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_price">Prix max (EUR)</Label>
              <Input
                id="max_price"
                type="number"
                min={10000}
                max={5000000}
                step={5000}
                value={form.max_price}
                onChange={(e) =>
                  setForm({ ...form, max_price: Number(e.target.value) })
                }
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_bedrooms">Chambres min</Label>
              <Input
                id="min_bedrooms"
                type="number"
                min={0}
                max={10}
                value={form.min_bedrooms}
                onChange={(e) =>
                  setForm({ ...form, min_bedrooms: Number(e.target.value) })
                }
                required
                disabled={submitting}
              />
            </div>
            {error && (
              <div className="sm:col-span-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2"
              size="lg"
            >
              {submitting ? "Création…" : "Créer l'alerte"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-3">
          Mes alertes actives
        </h2>

        {loading && (
          <p className="text-muted-foreground">Chargement…</p>
        )}

        {!loading && alerts.length === 0 && (
          <p className="text-muted-foreground italic">
            Aucune alerte créée pour l&apos;instant.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {alerts.map((a) => (
            <Card key={a.id} className={a.active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {a.label || `${a.city} < ${a.max_price.toLocaleString("fr-BE")} EUR`}
                    </CardTitle>
                    <CardDescription className="mt-1 capitalize">
                      {a.city} · {a.property_type.replace(/-/g, " ")}
                    </CardDescription>
                  </div>
                  <Badge variant={a.active ? "default" : "secondary"}>
                    {a.active ? "Actif" : "Pausé"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground space-y-1">
                <div>Prix max : {a.max_price.toLocaleString("fr-BE")} EUR</div>
                <div>Chambres min : {a.min_bedrooms}</div>
                <div className="pt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(a)}
                  >
                    {a.active ? "Pauser" : "Réactiver"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAlert(a)}
                    className="text-destructive hover:text-destructive"
                  >
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-secondary/40 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Comment marche le scan automatique
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>
            • Tous les jours, le serveur scanne Immoweb pour les biens
            correspondant à chaque alerte active.
          </div>
          <div>
            • Quand un NOUVEAU bien apparaît (jamais vu pour cette alerte), tu
            reçois un email avec le lien direct.
          </div>
          <div>
            • Tu peux pauser/supprimer une alerte à tout moment. Pas de spam :
            chaque bien notifié une seule fois.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
