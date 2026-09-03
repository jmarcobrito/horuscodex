import { requireActor } from "../../../../db/actor";
import { apiFailure, validIsoDate } from "../../../../db/http";
import { getSupabaseAdmin } from "../../../../db/supabase";
import { readAllRows } from "../../../../db/read-all";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const content = String(value ?? "");
  return /[;"\n\r]/.test(content) ? '"' + content.replaceAll('"', '""') + '"' : content;
}
function csv(rows: unknown[][]) { return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n"); }

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") return Response.json({ error: "Apenas o RH pode exportar relatórios." }, { status: 403 });
    const url = new URL(request.url); const type = url.searchParams.get("type") ?? "entries";
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    if (!validIsoDate(from) || !validIsoDate(to) || from > to) return Response.json({ error: "Período inválido." }, { status: 400 });
    const admin = getSupabaseAdmin(); let rows: unknown[][];
    if (type === "balances") {
      const query = admin.from("hour_balance_lots")
        .select("id,contractor_id,type,original_minutes,remaining_minutes,reserved_minutes,origin_date,deadline_date,status,users!hour_balance_lots_contractor_id_fkey(name,email)", { count: "exact" })
        .eq("organization_id", actor.organizationId).gte("origin_date", from).lte("origin_date", to).order("origin_date").order("id");
      const data = await readAllRows((fromIndex, toIndex) => query.range(fromIndex, toIndex));
      rows = [["Colaborador", "E-mail", "Tipo", "Original (min)", "Restante (min)", "Reservado (min)", "Origem", "Prazo", "Situação"],
        ...data.map((row: Record<string, unknown>) => { const user = row.users as { name?: string; email?: string } | null; return [user?.name, user?.email, row.type, row.original_minutes, row.remaining_minutes, row.reserved_minutes, row.origin_date, row.deadline_date, row.status]; })];
    } else if (type === "audit") {
      const query = admin.from("audit_logs").select("id,created_at,action,entity_type,entity_id,reason,users!audit_logs_user_id_fkey(name,email)", { count: "exact" })
        .eq("organization_id", actor.organizationId).gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59.999").order("created_at").order("id");
      const data = await readAllRows((fromIndex, toIndex) => query.range(fromIndex, toIndex));
      rows = [["Data", "Responsável", "E-mail", "Ação", "Entidade", "ID", "Justificativa"],
        ...data.map((row: Record<string, unknown>) => { const user = row.users as { name?: string; email?: string } | null; return [row.created_at, user?.name, user?.email, row.action, row.entity_type, row.entity_id, row.reason]; })];
    } else {
      const query = admin.from("time_entries")
        .select("id,work_date,start_time,end_time,break_minutes,calculated_minutes,eligible_minutes,non_business_day_status,notes,created_at,updated_at,users!time_entries_contractor_id_fkey(name,email)", { count: "exact" })
        .eq("organization_id", actor.organizationId).gte("work_date", from).lte("work_date", to).order("work_date").order("id");
      const data = await readAllRows((fromIndex, toIndex) => query.range(fromIndex, toIndex));
      rows = [["Data trabalhada", "Colaborador", "E-mail", "Entrada", "Saída", "Intervalo (min)", "Trabalhadas (min)", "Consideradas (min)", "Dia não útil", "Observação", "Criado em", "Atualizado em"],
        ...data.map((row: Record<string, unknown>) => { const user = row.users as { name?: string; email?: string } | null; return [row.work_date, user?.name, user?.email, row.start_time, row.end_time, row.break_minutes, row.calculated_minutes, row.eligible_minutes, row.non_business_day_status, row.notes, row.created_at, row.updated_at]; })];
    }
    const filename = `horus-${type}-${from}-${to}.csv`;
    return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
  } catch (error) { return apiFailure(error, "report export"); }
}
