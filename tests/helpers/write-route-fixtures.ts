// Replaces only authentication/database boundaries in the real route tests.
// No production URL, credentials or network implementation exists here.
type Role = "PJ" | "RH" | "ADMIN" | "DEV";
export const boundary = {
  role: "RH" as Role, actorCalls: 0,
  calls: [] as { name: string; args: Record<string, unknown> }[],
  result: { data: { id: "synthetic-id", status: "APPROVED" }, error: null as unknown },
  reset(role: Role = "RH") {
    this.role = role; this.actorCalls = 0; this.calls = [];
    this.result = { data: { id: "synthetic-id", status: "APPROVED" }, error: null };
  },
};
export async function requireActor() {
  boundary.actorCalls++;
  return { id: "test-actor", organizationId: "test-org", role: boundary.role };
}
export function actorErrorResponse() { return null; }
export class SupabaseConfigurationError extends Error {}
export function getSupabaseAdmin() {
  return {
    from() { throw Error("Direct table operations are forbidden in atomic route tests"); },
    async rpc(name: string, args: Record<string, unknown>) {
      boundary.calls.push({ name, args }); return boundary.result;
    },
  };
}
