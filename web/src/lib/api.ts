/**
 * Client API pour le backend FastAPI immo-analyzer.
 *
 * Base URL controlled by NEXT_PUBLIC_API_URL (default localhost:8000 in dev).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

// ----- Calls -----

export async function createAnalysis(req: AnalysisRequest): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/analyses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // body not JSON, keep default detail
    }
    throw new Error(detail);
  }

  return res.json();
}

export async function getAnalysis(id: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/analyses/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}
