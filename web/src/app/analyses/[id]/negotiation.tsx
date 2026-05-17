"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createClient } from "@/lib/supabase/client";
import { createAnalysis, type Usage } from "@/lib/api";

type Props = {
  url: string;
  revenu_net: number;
  apport: number;
  usage: Usage;
  duree_credit: number;
  currentPrice: number;
};

export function NegotiationSimulator({
  url,
  revenu_net,
  apport,
  usage,
  duree_credit,
  currentPrice,
}: Props) {
  const router = useRouter();
  const [price, setPrice] = useState(currentPrice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSimulate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const res = await createAnalysis(
        {
          url,
          revenu_net,
          apport,
          usage,
          duree_credit,
          prix_negocie: price,
        },
        session.access_token,
      );
      router.push(`/analyses/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  const diff = price - currentPrice;
  const diffPct = ((diff / currentPrice) * 100).toFixed(1);

  return (
    <form onSubmit={onSimulate} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="space-y-2">
          <Label htmlFor="negociate-price">Prix négocié (EUR)</Label>
          <Input
            id="negociate-price"
            type="number"
            min={1000}
            max={5_000_000}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || price === currentPrice}
          size="lg"
        >
          {loading ? "Recalcul…" : "Recalculer"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Prix actuel :{" "}
          <strong>{currentPrice.toLocaleString("fr-BE")} EUR</strong>
        </span>
        {diff !== 0 && (
          <>
            <span>·</span>
            <span
              className={
                diff < 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-orange-700 dark:text-orange-400"
              }
            >
              {diff > 0 ? "+" : ""}
              {diff.toLocaleString("fr-BE")} EUR ({diffPct} %)
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}
    </form>
  );
}
