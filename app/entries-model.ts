import type { DashboardData, DashboardEntry, DashboardPeriod } from "./dashboard-types";
import { validPeriodDate } from "./period";

export type EntriesDisplayMode = "collaborator" | "day";

export function resolveEntryDate(period: DashboardPeriod, date: string) {
  return validPeriodDate(date) && date >= period.from && date <= period.to ? date : period.from;
}

export function shiftEntryDate(period: DashboardPeriod, date: string, offset: number): string | null {
  if (!validPeriodDate(date) || resolveEntryDate(period, date) !== date || !Number.isInteger(offset)) return null;
  const next = new Date(date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + offset);
  if (!Number.isFinite(next.getTime())) return null;
  const value = next.toISOString().slice(0, 10);
  return validPeriodDate(value) && value >= period.from && value <= period.to ? value : null;
}

export function selectDailyEntries(data: DashboardData, date: string) {
  if (!validPeriodDate(date) || resolveEntryDate(data.period, date) !== date) throw Error("Escolha uma data dentro do mês selecionado.");
  const entries = data.entries.filter(entry => entry.workDate === date);
  const recordedIds = new Set(entries.map(entry => entry.contractorId));
  return {
    entries,
    workedMinutes: entries.reduce((sum, entry) => sum + entry.calculatedMinutes, 0),
    recordedPeople: recordedIds.size,
    withoutEntry: selectableContractors(data).filter(person => !recordedIds.has(person.id)),
  };
}

export type EntriesSelection = { entries: DashboardEntry[]; summary: DashboardData["timesheet"]; title: string };
export function selectableContractors(data: DashboardData) {
  return data.contractors.filter(person => person.status === "ACTIVE" || data.entries.some(entry => entry.contractorId === person.id) || data.monthlyTimesheets?.some(month => month.contractorId === person.id));
}
export function selectEntries(data: DashboardData, contractorId: string | null): EntriesSelection {
  if (!contractorId) return { entries: data.entries, summary: data.timesheet, title: "Resumo da equipe" };
  const person = data.contractors.find(person => person.id === contractorId);
  if (!person) throw Error("Colaborador não disponível neste mês");
  const entries = data.entries.filter(entry => entry.contractorId === contractorId && entry.workDate >= data.period.from && entry.workDate <= data.period.to);
  const monthly = data.monthlyTimesheets?.filter(month => month.contractorId === contractorId && month.year * 12 + month.month >= Number(data.period.from.slice(0, 4)) * 12 + Number(data.period.from.slice(5, 7)) && month.year * 12 + month.month <= Number(data.period.to.slice(0, 4)) * 12 + Number(data.period.to.slice(5, 7)));
  const workedMinutes = entries.reduce((total, entry) => total + entry.calculatedMinutes, 0);
  const eligibleMinutes = entries.reduce((total, entry) => total + entry.eligibleMinutes, 0);
  const creditedMinutes = monthly ? monthly.reduce((total, month) => total + month.creditedMinutes, 0) : Math.max(0, person.consideredMinutes - eligibleMinutes);
  const consideredMinutes = eligibleMinutes + creditedMinutes;
  const statuses = new Set(monthly?.map(month => month.status) ?? []);
  const status = statuses.size === 1 ? [...statuses][0] : statuses.size > 1 ? "MIXED" : person.timesheetStatus;
  return { entries, title: "Resumo de " + person.name, summary: { workedMinutes, creditedMinutes, consideredMinutes, requiredMinutes: person.requiredMinutes, projectedBalanceMinutes: consideredMinutes - person.requiredMinutes, status } };
}
export function entryEditBlockReason(data: DashboardData, entry: DashboardEntry, readOnly: boolean): string | null {
  if (readOnly) return "Visualização somente para consulta.";
  const person = data.contractors.find(person => person.id === entry.contractorId);
  if (!person) return "Colaborador não disponível nesta consulta.";
  if (person.status === "INACTIVE") return "Cadastro inativo: o histórico permanece disponível para consulta.";
  if (!data.monthlyTimesheets) return "Situação mensal não disponível. Atualize a consulta antes de editar.";
  const months = data.monthlyTimesheets.filter(month => month.contractorId === entry.contractorId && month.year === Number(entry.workDate.slice(0, 4)) && month.month === Number(entry.workDate.slice(5, 7)));
  if (months.length !== 1) return "Não foi possível confirmar o registro mensal deste dia. Atualize a consulta.";
  if (months[0].status === "CLOSED") return "Este mês está fechado. O dia permanece disponível para consulta.";
  return null;
}
export async function saveThenRefresh(save: () => Promise<void>, refresh: () => Promise<void>): Promise<"saved" | "saved-refresh-failed"> {
  await save();
  try { await refresh(); return "saved"; } catch { return "saved-refresh-failed"; }
}
