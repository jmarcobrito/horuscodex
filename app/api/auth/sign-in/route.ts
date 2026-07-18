import { ensureBootstrapAccess } from "../../../../db/actor";
import { SupabaseConfigurationError } from "../../../../db/supabase";
import { createSupabaseServerClient } from "../../../../db/supabase-auth";

export const dynamic = "force-dynamic";

const GENERIC_MESSAGE = "Se o e-mail estiver autorizado, voc\u00ea receber\u00e1 um link de acesso em instantes.";

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo JSON inv\u00e1lido." }, { status: 400 });
  }

  const email = (body as { email?: unknown } | null)?.email;
  if (!validEmail(email)) {
    return Response.json({ error: "Informe um e-mail v\u00e1lido." }, { status: 400 });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const allowed = await ensureBootstrapAccess(normalizedEmail);
    if (!allowed) return Response.json({ message: GENERIC_MESSAGE });

    const supabase = await createSupabaseServerClient();
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: origin + "/auth/callback",
        shouldCreateUser: true,
      },
    });
    if (error) throw error;

    return Response.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("[horus] Could not start sign-in", error);
    if (error instanceof SupabaseConfigurationError) {
      return Response.json({ error: "Autentica\u00e7\u00e3o ainda n\u00e3o configurada no servidor." }, { status: 503 });
    }
    return Response.json({ error: "N\u00e3o foi poss\u00edvel enviar o link de acesso." }, { status: 502 });
  }
}
