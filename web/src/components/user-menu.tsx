"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function onLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div
        className="size-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center"
        title={email}
      >
        {initials}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLogout}
        className="text-muted-foreground"
      >
        Logout
      </Button>
    </div>
  );
}
