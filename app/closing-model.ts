import type { DashboardData, DashboardMonthlyTimesheet, DashboardPeriod } from "./dashboard-types";
import { asFullMonth } from "./period";
export type ClosingStatus = "UNKNOWN" | "NO_RECORD" | "NO_ENTRIES" | "PENDING" | "READY" | "CLOSED";
export type ClosingIssue = { kind: "entry-authorization" | "occurrence" | "authorization-request"; sourceId: string; contractorId: string; workDate: string; label: string };
export type ClosingRow = { contractorId: string; name: string; status: ClosingStatus; month: DashboardMonthlyTimesheet | null; entryCount: number; issues: ClosingIssue[]; forecastMinutes: number | null };
export type ClosingCommand = { year: number; month: number; contractorIds: string[] };
export type ClosingResult = { contractorId: string; status: "closed" | "already-closed" | "blocked" | "failed" | "uncertain"; message?: string };
export type ClosingSubmit = (command: ClosingCommand) => Promise<ClosingResult[]>;
export function buildClosingRows(data: DashboardData): ClosingRow[] {
  const period = asFullMonth(data.period);
  if (!period) throw Error("Escolha um mês completo para revisar o fechamento");
  const inMonth = (date: string) => date >= period.from && date <= period.to;
  return data.contractors.filter(person => person.status === "ACTIVE" ||
    data.entries.some(entry => entry.contractorId === person.id && inMonth(entry.workDate)) ||
    data.monthlyTimesheets?.some(month => month.contractorId === person.id && month.year === period.year && month.month === period.month) ||
    data.occurrences.some(item => item.contractorId === person.id && item.startDate <= period.to && item.endDate >= period.from) ||
    data.authorizations.some(item => item.contractorId === person.id && inMonth(item.workDate))
  ).map(person => {
    const matches = data.monthlyTimesheets?.filter(month => month.contractorId === person.id && month.year === period.year && month.month === period.month);
    const month = matches?.length === 1 ? matches[0] : null;
    const entries = data.entries.filter(entry => entry.contractorId === person.id && inMonth(entry.workDate));
    const authorizations = data.authorizations.filter(item => item.contractorId === person.id && inMonth(item.workDate));
    const issues: ClosingIssue[] = authorizations.filter(item => ["REQUESTED", "NEEDS_ADJUSTMENT"].includes(item.status)).map(item => ({
      kind: "authorization-request", sourceId: item.id, contractorId: person.id, workDate: item.workDate, label: item.status === "NEEDS_ADJUSTMENT" ? "Autorização precisa de ajuste" : "Autorização de dia não útil pendente",
    }));
    for (const entry of entries.filter(entry => entry.nonBusinessDayStatus === "PENDING_AUTHORIZATION")) {
      const authorization = authorizations.find(item => item.workDate === entry.workDate);
      if (authorization && issues.some(issue => issue.sourceId === authorization.id)) continue;
      issues.push({ kind: authorization ? "authorization-request" : "entry-authorization", sourceId: authorization?.id ?? entry.id, contractorId: person.id, workDate: entry.workDate, label: authorization ? "Conferir autorização: este dia continua pendente" : "Dia não útil ainda sem autorização" });
    }
    for (const item of data.occurrences.filter(item => item.contractorId === person.id && item.status === "REQUESTED" && item.startDate <= period.to && item.endDate >= period.from)) {
      issues.push({ kind: "occurrence", sourceId: item.id, contractorId: person.id, workDate: item.startDate < period.from ? period.from : item.startDate, label: "Ocorrência aguardando análise" });
    }
    const status: ClosingStatus = !matches || matches.length > 1 ? "UNKNOWN" : !month ? "NO_RECORD" : month.status === "CLOSED" ? "CLOSED" : issues.length ? "PENDING" : !entries.length ? "NO_ENTRIES" : "READY";
    return { contractorId: person.id, name: person.name, status, month, entryCount: entries.length, issues, forecastMinutes: month ? month.consideredMinutes - month.requiredMinutes : null };
  });
}
export function makeClosingCommand(period: DashboardPeriod, rows: ClosingRow[], selectedIds: string[], acknowledgedEmptyIds: string[]): ClosingCommand {
  const month = asFullMonth(period);
  if (!month || month.year === null || month.month === null) throw Error("Escolha um mês completo");
  const ids = [...new Set(selectedIds)];
  if (!ids.length) throw Error("Selecione os colaboradores para revisar");
  for (const id of ids) {
    const matches = rows.filter(item => item.contractorId === id), row = matches[0];
    const allowedEmpty = row?.status === "NO_ENTRIES" && acknowledgedEmptyIds.includes(id);
    if (matches.length !== 1 || !row?.month || row.month.year !== month.year || row.month.month !== month.month || (row.status !== "READY" && !allowedEmpty)) throw Error("Há colaborador sem condições para revisão");
  }
  return { year: month.year, month: month.month, contractorIds: ids };
}
export function normalizeClosingResults(command: ClosingCommand, results: ClosingResult[]) {
  const rows = Array.isArray(results) ? results : [];
  const allowed = new Set(["closed", "already-closed", "blocked", "failed", "uncertain"]);
  const unexpected = !Array.isArray(results) || rows.some(result => !result || !command.contractorIds.includes(result.contractorId));
  const normalized: ClosingResult[] = command.contractorIds.map(contractorId => {
    const matches = rows.filter(result => result?.contractorId === contractorId);
    const validMessage = matches[0]?.message === undefined || typeof matches[0]?.message === "string";
    return matches.length === 1 && allowed.has(matches[0].status) && validMessage ? matches[0] : { contractorId, status: "uncertain", message: "Resultado não confirmado. Consulte antes de repetir." };
  });
  return { results: normalized, complete: !unexpected && normalized.length > 0 && normalized.every(item => item.status === "closed" || item.status === "already-closed"), warning: unexpected ? "A resposta está incompleta ou inclui alguém fora da seleção. Confira o resultado antes de continuar." : null };
}
