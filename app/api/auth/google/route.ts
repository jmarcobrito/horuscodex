import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../../db/supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin + "/auth/callback",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error || !data.url) throw error ?? new Error("Google OAuth URL ausente.");
    return NextResponse.redirect(data.url, 303);
  } catch (error) {
    console.error("[horus] Could not start Google sign-in", error);
    return NextResponse.redirect(new URL("/?auth_error=google_unavailable", origin), 303);
  }
}
