import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AlertsManager } from "./alerts-manager";

export default async function MesAlertesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login?next=/mes-alertes");
  }
  return <AlertsManager jwt={session.access_token} />;
}
