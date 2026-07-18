import { createSupabaseServerClient } from "../../../../db/supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return Response.redirect(new URL("/", request.url), 303);
}
