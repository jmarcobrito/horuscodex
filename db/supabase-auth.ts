import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SupabaseConfigurationError } from "./supabase";

function requiredEnvironmentValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  throw new SupabaseConfigurationError(
    "Supabase Auth n\u00e3o configurado. Defina " + names.join(" ou ") + ".",
  );
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = requiredEnvironmentValue("SUPABASE_URL");
  const authApiKey = process.env.SUPABASE_AUTH_USE_SERVICE_ROLE === "true"
    ? requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY")
    : requiredEnvironmentValue("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");

  return createServerClient(url, authApiKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. proxy.ts performs refreshes.
        }
      },
    },
  });
}
