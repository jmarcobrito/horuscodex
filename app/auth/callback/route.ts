import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../db/supabase-auth";
import { completeSignInAccess } from "../../../db/actor";

export const dynamic = "force-dynamic";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        await completeSignInAccess();
        return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url.origin));
      } catch {
        await supabase.auth.signOut();
      }
    }
  }

  return NextResponse.redirect(new URL("/?auth_error=invalid_callback", url.origin));
}
