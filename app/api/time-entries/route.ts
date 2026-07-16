import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, monthlyTimesheets, organizations, timeEntries, timeEntryVersions, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function actorContext() {
  const authenticated = await getChatGPTUser();
  const email = authenticated?.email ?? "marina@acme.com.br";
  const name = authenticated?.displayName ?? "Marina Costa";
  const domain = email.split("@")[1] ?? "acme.com.br";
  return { email, name, userId: `usr_${safeId(email)}`, organizationId: `org_${safeId(domain)}` };
}

export async function GET() {
  const actor = await actorContext();
  const db = getDb();
  const rows = await db.select().from(timeEntries).where(and(eq(timeEntries.organizationId, actor.organizationId), eq(timeEntries.contractorId, actor.userId))).orderBy(desc(timeEntries.workDate)).limit(40);
  return Response.json({ entries: rows });
}

export async function POST(request: Request) {
  const actor = await actorContext();
  const payload = await request.json() as { workDate?: string; startTime?: string; endTime?: string; breakMinutes?: number; calculatedMinutes?: number; notes?: string };
  if (!payload.workDate || !payload.startTime || !payload.endTime || !Number.isInteger(payload.breakMinutes) || !Number.isInteger(payload.calculatedMinutes) || (payload.calculatedMinutes ?? 0) < 0) {
    return Response.json({ error: "Dados de lançamento inválidos." }, { status: 400 });
  }

  const db = getDb();
  const [year, month] = payload.workDate.split("-").map(Number);
  const timesheetId = `ts_${actor.userId}_${year}_${month}`;
  await db.insert(organizations).values({ id: actor.organizationId, name: actor.organizationId.replace(/^org_/, "").replaceAll("_", " ") }).onConflictDoNothing();
  await db.insert(users).values({ id: actor.userId, organizationId: actor.organizationId, name: actor.name, email: actor.email, role: "PJ" }).onConflictDoNothing();
  await db.insert(monthlyTimesheets).values({ id: timesheetId, organizationId: actor.organizationId, contractorId: actor.userId, year, month }).onConflictDoNothing();

  const [previous] = await db.select().from(timeEntries).where(and(eq(timeEntries.organizationId, actor.organizationId), eq(timeEntries.contractorId, actor.userId), eq(timeEntries.workDate, payload.workDate))).limit(1);
  const entryId = previous?.id ?? crypto.randomUUID();
  const values = { startTime: payload.startTime, endTime: payload.endTime, breakMinutes: payload.breakMinutes, calculatedMinutes: payload.calculatedMinutes, eligibleMinutes: payload.calculatedMinutes, notes: payload.notes ?? "", updatedBy: actor.userId, updatedAt: sql`CURRENT_TIMESTAMP` };

  if (previous) {
    await db.insert(timeEntryVersions).values({ id: crypto.randomUUID(), timeEntryId: previous.id, versionNumber: Date.now(), previousData: JSON.stringify(previous), newData: JSON.stringify(values), changedBy: actor.userId });
    await db.update(timeEntries).set(values).where(and(eq(timeEntries.id, previous.id), eq(timeEntries.organizationId, actor.organizationId)));
  } else {
    await db.insert(timeEntries).values({ id: entryId, organizationId: actor.organizationId, timesheetId, contractorId: actor.userId, workDate: payload.workDate, ...values, createdBy: actor.userId });
  }

  await db.insert(auditLogs).values({ id: crypto.randomUUID(), organizationId: actor.organizationId, userId: actor.userId, action: previous ? "TIME_ENTRY_UPDATED" : "TIME_ENTRY_CREATED", entityType: "TimeEntry", entityId: entryId, previousValue: previous ? JSON.stringify(previous) : null, newValue: JSON.stringify(values) });
  return Response.json({ id: entryId, persisted: true }, { status: previous ? 200 : 201 });
}
