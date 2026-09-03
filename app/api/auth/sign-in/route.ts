import { completeSignInAccess } from "../../../../db/actor";
import { sameOriginFailure } from "../../../../db/request-security";
import { SupabaseConfigurationError } from "../../../../db/supabase";
import { createSupabaseServerClient } from "../../../../db/supabase-auth";

export const dynamic = "force-dynamic";

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}

export async function POST(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo JSON inv\u00e1lido." }, { status: 400 });
  }

  const credentials = body as { email?: unknown; password?: unknown } | null;
  const email = credentials?.email;
  const password = credentials?.password;
  if (!validEmail(email) || !validPassword(password)) {
    return Response.json({ error: "Informe um e-mail v\u00e1lido e uma senha com pelo menos 8 caracteres." }, { status: 400 });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return Response.json({ error: "E-mail ou senha inv\u00e1lidos." }, { status: 401 });

    try { await completeSignInAccess(); }
    catch {
      await supabase.auth.signOut();
      return Response.json({ error: "Esta conta não possui acesso ativo ao Horus." }, { status: 403 });
    }

    return Response.json({ message: "Acesso autorizado.", redirectTo: "/" });
  } catch (error) {
    console.error("[horus] Could not start sign-in", error);
    if (error instanceof SupabaseConfigurationError) {
      return Response.json({ error: "Autentica\u00e7\u00e3o ainda n\u00e3o configurada no servidor." }, { status: 503 });
    }
    return Response.json({ error: "N\u00e3o foi poss\u00edvel entrar. Tente novamente." }, { status: 502 });
  }
}
