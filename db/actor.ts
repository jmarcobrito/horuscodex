import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "./supabase";
import { createSupabaseServerClient } from "./supabase-auth";

export type HorusRole = "RH" | "PJ" | "ADMIN" | "DEV";

export type HorusActor = {
  id: string;
  authUserId: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  role: HorusRole;
};

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = "Sess\u00e3o n\u00e3o autenticada.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Usu\u00e1rio sem acesso ao Horus.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

type HorusUserRow = {
  id: string;
  auth_user_id: string | null;
  organization_id: string;
  name: string;
  email: string;
  role: HorusRole;
  status: "ACTIVE" | "INACTIVE";
  organizations: { name: string; status: "ACTIVE" | "INACTIVE" } | null;
};

function bootstrapEmails(): Set<string> {
  return new Set(
    (process.env.HORUS_BOOTSTRAP_RH_EMAILS ?? "britojoaomarco@gmail.com")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function bootstrapDevEmails(): Set<string> {
  return new Set(
    (process.env.HORUS_BOOTSTRAP_DEV_EMAILS ?? "britojoaomarco@gmail.com")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function safeId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isBootstrapRhEmail(email: string): boolean {
  return bootstrapEmails().has(email.trim().toLowerCase());
}

export function isBootstrapDevEmail(email: string): boolean {
  return bootstrapDevEmails().has(email.trim().toLowerCase());
}

export async function ensureBootstrapAccess(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await admin
    .from("users")
    .select("id,status")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing.status === "ACTIVE";
  if (!isBootstrapRhEmail(normalizedEmail) && !isBootstrapDevEmail(normalizedEmail)) return false;

  const organizationId = process.env.HORUS_BOOTSTRAP_ORGANIZATION_ID?.trim() || "org_horuscodex";
  const organizationName = process.env.HORUS_BOOTSTRAP_ORGANIZATION_NAME?.trim() || "Horus Codex";
  const displayName = process.env.HORUS_BOOTSTRAP_RH_NAME?.trim() || "Jo\u00e3o Marco Brito";

  const { error: organizationError } = await admin.from("organizations").upsert({
    id: organizationId,
    name: organizationName,
    status: "ACTIVE",
  }, { onConflict: "id", ignoreDuplicates: true });
  if (organizationError) throw organizationError;

  const { error: policyError } = await admin.from("organization_policies").upsert(
    {
      id: "policy_" + safeId(organizationId),
      organization_id: organizationId,
      monthly_required_minutes: 9_720,
    },
    { onConflict: "organization_id", ignoreDuplicates: true },
  );
  if (policyError) throw policyError;

  const { error: userError } = await admin.from("users").insert({
    id: "usr_" + safeId(normalizedEmail),
    organization_id: organizationId,
    name: displayName,
    email: normalizedEmail,
    role: isBootstrapDevEmail(normalizedEmail) ? "DEV" : "RH",
    status: "ACTIVE",
  });
  if (userError) throw userError;

  return true;
}

export async function resolveViewActor(actor: HorusActor, viewAsId?: string): Promise<HorusActor> {
  if (!viewAsId) return actor;
  if (actor.role !== "DEV") throw new AuthorizationError("Apenas o perfil DEV pode simular a visão de outro usuário.");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("users")
    .select("id,name,email,role,status")
    .eq("id", viewAsId)
    .eq("organization_id", actor.organizationId)
    .eq("role", "PJ")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AuthorizationError("Prestador não encontrado para visualização.");

  return {
    ...actor,
    id: String(data.id),
    name: String(data.name),
    email: String(data.email),
    role: "PJ",
  };
}

async function findActorRow(authUser: SupabaseAuthUser, bindIdentity = false): Promise<HorusUserRow> {
  const email = authUser.email?.trim().toLowerCase();
  if (!email) throw new AuthorizationError("A conta autenticada n\u00e3o possui e-mail.");

  const admin = getSupabaseAdmin();
  let { data, error } = await admin
    .from("users")
    .select("id,auth_user_id,organization_id,name,email,role,status,organizations(name,status)")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const result = await admin
      .from("users")
      .select("id,auth_user_id,organization_id,name,email,role,status,organizations(name,status)")
      .eq("email", email)
      .maybeSingle();
    data = result.data;
    error = result.error;
    if (error) throw error;
  }

  const row = data as unknown as HorusUserRow | null;
  if (!row || row.status !== "ACTIVE" || row.organizations?.status !== "ACTIVE") {
    throw new AuthorizationError();
  }

  if (row.auth_user_id && row.auth_user_id !== authUser.id) {
    throw new AuthorizationError("Este cadastro j\u00e1 est\u00e1 vinculado a outra identidade.");
  }

  if (!row.auth_user_id && bindIdentity) {
    const { data: bound, error: bindError } = await admin
      .from("users")
      .update({ auth_user_id: authUser.id, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("auth_user_id", null)
      .select("id")
      .maybeSingle();
    if (bindError) throw bindError;
    if (!bound) throw new AuthorizationError("N\u00e3o foi poss\u00edvel vincular a identidade.");
  }

  return row;
}

export async function getOptionalActor(): Promise<HorusActor | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const row = await findActorRow(data.user);
  return {
    id: row.id,
    authUserId: data.user.id,
    organizationId: row.organization_id,
    organizationName: row.organizations?.name ?? "Horus Codex",
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

// Identity creation/binding belongs to an explicit, verified sign-in, never a page read.
export async function completeSignInAccess(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) throw new AuthenticationError();
  if (!await ensureBootstrapAccess(data.user.email)) throw new AuthorizationError();
  await findActorRow(data.user, true);
}

export async function requireActor(): Promise<HorusActor> {
  const actor = await getOptionalActor();
  if (!actor) throw new AuthenticationError();
  return actor;
}

export function actorErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
