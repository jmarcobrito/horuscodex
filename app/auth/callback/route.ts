import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../db/supabase-auth";

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
    if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url.origin));
  }

  return NextResponse.redirect(new URL("/?auth_error=invalid_callback", url.origin));
}
