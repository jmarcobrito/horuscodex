import { makeDashboard } from "./dashboard.mjs";

/** @returns {import('../../app/dashboard-types').DashboardData} */
export function makeWorkflowDashboard(year = 2026, month = 8) {
  const data = makeDashboard();
  const prefix = year + "-" + String(month).padStart(2, "0");
  data.period = { from: prefix + "-01", to: prefix + "-" + new Date(Date.UTC(year, month, 0)).getUTCDate(), year, month };
  data.policy.monthlyRequiredMinutes = 480;
  const people = [
    { id: "person-1", name: "Ana Exemplo", status: "ACTIVE", minutes: month === 8 ? 480 : month === 9 ? 360 : 0, day: "03" },
    { id: "person-2", name: "Bruno Teste", status: "INACTIVE", minutes: month === 8 ? 300 : 0, day: "04" },
    { id: "person-3", name: "Carla Teste", status: "ACTIVE", minutes: 0, day: "05" },
  ];
  const template = data.contractors[0];
  data.contractors = people.map(({ id, name, status, minutes, day }) => ({
    ...template, id, name, status, email: id + "@example.com",
    initials: name.split(" ").map(part => part[0]).join(""),
    workedMinutes: minutes, consideredMinutes: minutes, requiredMinutes: 480,
    fillPercentage: Math.round(minutes / 480 * 100),
    lastEntryDate: minutes ? prefix + "-" + day : null,
    lastEntryAt: minutes ? prefix + "-" + day + "T18:00:00Z" : null,
  }));
  data.entries = people.filter(person => person.minutes > 0).map(({ id, name, minutes, day }) => ({
    id: id === "person-1" ? "entry-1" : "entry-2", contractorId: id, contractorName: name,
    workDate: prefix + "-" + day, startTime: "08:00",
    endTime: minutes === 480 ? "17:00" : minutes === 360 ? "15:00" : "14:00",
    breakMinutes: 60, calculatedMinutes: minutes, eligibleMinutes: minutes,
    nonBusinessDayStatus: "NOT_APPLICABLE", notes: "Registro fictício",
    createdAt: prefix + "-" + day + "T18:00:00Z", updatedAt: prefix + "-" + day + "T18:00:00Z",
  }));
  const workedMinutes = data.entries.reduce((sum, entry) => sum + entry.calculatedMinutes, 0);
  const requiredMinutes = 480 * (2 + (month === 8 ? 1 : 0));
  data.metrics = { ...data.metrics, activeContractors: 2, workedMinutes, requiredMinutes };
  data.timesheet = { ...data.timesheet, workedMinutes, consideredMinutes: workedMinutes, requiredMinutes, projectedBalanceMinutes: workedMinutes - requiredMinutes };
  data.monthlyTimesheets = data.contractors.filter(person => person.workedMinutes > 0).map(person => ({
    id: "month-" + person.id + "-" + prefix, contractorId: person.id, year, month,
    status: "OPEN", workedMinutes: person.workedMinutes, creditedMinutes: 0,
    consideredMinutes: person.consideredMinutes, requiredMinutes: 480, closedAt: null, closedByName: null,
  }));
  return data;
}
export function makeHistoryVersion() {
  const previous = { start_time: "08:00", end_time: "17:00", break_minutes: 60, calculated_minutes: 480, notes: "Original" };
  return {
    id: "version-1", version_number: 2, previous_data: previous,
    new_data: { ...previous, break_minutes: 90, calculated_minutes: 450, notes: "Corrigida" },
    changed_by: "person-1", change_reason: "Ajuste de intervalo", changed_at: "2026-08-05T18:00:00Z",
  };
}
