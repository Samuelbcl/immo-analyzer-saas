"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/analyze";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam ? "Authentification echouee, reessaie." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📬 Vérifie tes emails</CardTitle>
          <CardDescription className="text-base">
            Un lien magique a été envoyé à <strong>{email}</strong>. Clique
            dessus dans les 60 minutes pour te connecter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="w-full"
          >
            Changer d&apos;email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>
          Saisis ton email — on t&apos;envoie un lien magique. Aucun mot de
          passe à retenir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="toi@exemple.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full"
            size="lg"
          >
            {loading ? "Envoi…" : "Recevoir le lien magique"}
          </Button>

          <p className="text-xs text-muted-foreground text-center pt-2">
            En te connectant tu acceptes que tes analyses soient sauvegardées
            sur Supabase (gratuit pendant la bêta).
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Suspense fallback={<div>Chargement…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
