/**
 * Handler du callback magic link / OAuth.
 *
 * Pattern officiel Supabase + Next.js App Router :
 *  1. Cree le NextResponse.redirect (la reponse finale)
 *  2. Cree le supabase client avec cookies qui ecrivent SUR CETTE RESPONSE
 *  3. exchangeCodeForSession set les cookies session sur cette response
 *  4. Return cette response (cookies inclus -> session etablie cote client)
 *
 * L'ancien pattern (createClient + cookies de next/headers) ne propage pas
 * les cookies via le redirect, d'ou le bug "redirection infinie vers login".
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/analyze";

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }

    console.error("exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
