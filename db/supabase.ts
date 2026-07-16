import { env } from "cloudflare:workers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RuntimeEnvironment = Record<string, string | undefined>;

let adminClient: SupabaseClient | undefined;

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function runtimeValue(name: string): string | undefined {
  const workerEnvironment = env as unknown as RuntimeEnvironment;
  const value = workerEnvironment[name] ?? process.env[name];
  return value?.trim() || undefined;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = runtimeValue("SUPABASE_URL");
  const serviceRoleKey = runtimeValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new SupabaseConfigurationError(
      "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.",
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "horus-sites" },
    },
  });

  return adminClient;
}
