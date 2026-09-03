import { AuthorizationError, getOptionalActor } from "../db/actor";
import { getDashboardData } from "../db/dashboard";
import { monthClosingWriteEnabled } from "../db/feature-flags";
import { HorusApp } from "./HorusApp";
import { AccessDeniedScreen, SignInScreen } from "./SignInScreen";

export const dynamic = "force-dynamic";

async function resolveHomeState() {
  try {
    const actor = await getOptionalActor();
    if (!actor) return { kind: "signed-out" as const };
    const initialDashboard = await getDashboardData(actor);
    return { kind: "ready" as const, actor, initialDashboard };
  } catch (error) {
    if (error instanceof AuthorizationError) return { kind: "denied" as const };
    console.error("[horus] Could not resolve authenticated actor", error);
    return { kind: "signed-out" as const };
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const [state, params] = await Promise.all([resolveHomeState(), searchParams]);
  if (state.kind === "signed-out") return <SignInScreen authError={params.auth_error} />;
  if (state.kind === "denied") return <AccessDeniedScreen />;

  return (
    <HorusApp
      user={{ name: state.actor.name, email: state.actor.email }}
      accountRole={state.actor.role === "DEV" ? "dev" : state.actor.role === "PJ" ? "pj" : "rh"}
      organizationName={state.actor.organizationName}
      initialDashboard={state.initialDashboard}
      closingEnabled={state.actor.role !== "PJ" && monthClosingWriteEnabled()}
    />
  );
}
