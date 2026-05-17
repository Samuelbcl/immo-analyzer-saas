/**
 * Client API pour le backend FastAPI.
 *
 * - cote browser : URL relative (Next.js rewrites vers Railway)
 * - cote serveur : URL absolue via BACKEND_API_URL
 *
 * Toutes les requetes requierent un JWT Supabase passe en parametre.
 */

function apiUrl(path: string): string {
  if (typeof window === "undefined") {
    const base = process.env.BACKEND_API_URL || "http://localhost:8000";
    return `${base}${path}`;
  }
  return path;
}

// ----- Types -----

export type Usage = "habitation_propre_unique" | "investissement_locatif";

export type AnalysisRequest = {
  url: string;
  revenu_net: number;
  apport: number;
  usage: Usage;
  duree_credit?: number;
  prix_negocie?: number | null;
};

export type ListingSummary = {
  url: string | null;
  reference: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  price: number | null;
  surface: number | null;
  land_surface: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  peb: string | null;
  rc: number | null;
  year_built: number | null;
  features: string[];
  photos: string[];
  description: string | null;
  agency: string | null;
};

export type AnalysisResponse = {
  id: string;
  url: string;
  listing: ListingSummary;
  analyse: Record<string, unknown>;
  created_at: string;
};

export type AnalysisListItem = {
  id: string;
  url: string;
  address: string | null;
  city: string | null;
  price: number | null;
  verdict: string | null;
  verdict_color: "vert" | "ambre" | "rouge" | null;
  score: number | null;
  created_at: string;
};

// ----- Calls -----

async function fetchWithAuth(
  path: string,
  jwt: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${jwt}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...options, headers, cache: "no-store" });
}

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function createAnalysis(
  req: AnalysisRequest,
  jwt: string,
): Promise<AnalysisResponse> {
  const res = await fetchWithAuth("/api/analyses", jwt, {
    method: "POST",
    body: JSON.stringify(req),
  });
  return parseOrThrow(res);
}

export async function getAnalysis(
  id: string,
  jwt: string,
): Promise<AnalysisResponse> {
  const res = await fetchWithAuth(`/api/analyses/${id}`, jwt);
  return parseOrThrow(res);
}

export async function listAnalyses(jwt: string): Promise<AnalysisListItem[]> {
  const res = await fetchWithAuth("/api/analyses", jwt);
  return parseOrThrow(res);
}

export async function deleteAnalysis(
  id: string,
  jwt: string,
): Promise<{ deleted: string }> {
  const res = await fetchWithAuth(`/api/analyses/${id}`, jwt, {
    method: "DELETE",
  });
  return parseOrThrow(res);
}
