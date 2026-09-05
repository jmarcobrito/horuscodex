export type SummaryUser = { id: string; status: "ACTIVE" | "INACTIVE" };
export type SummaryEntry = { contractorId: string; calculatedMinutes: number; eligibleMinutes: number };
export type SummaryTimesheet = { contractorId: string; year: number; month: number; requiredMinutes: number; creditedMinutes: number };

// Sheets must belong to one person and be filtered to the requested months.
// Estimates are display-only: persisted monthly requirements remain authoritative.
export function requiredForPerson(sheets: SummaryTimesheet[], active: boolean, requiredPerMonth: number, monthCount: number) {
  const present = new Set<string>();
  let stored = 0;
  for (const sheet of sheets) {
    const key = sheet.year + "-" + sheet.month;
    if (present.has(key)) throw new Error("Registro mensal duplicado. Não foi possível calcular a carga com segurança.");
    present.add(key);
    stored += sheet.requiredMinutes;
  }
  const estimatedMonths = active ? Math.max(0, monthCount - present.size) : 0;
  return { requiredMinutes: stored + estimatedMonths * requiredPerMonth, estimatedMonths };
}

export function buildPeriodSummary(input: {
  users: SummaryUser[];
  entries: SummaryEntry[];
  timesheets: SummaryTimesheet[];
  requiredPerMonth: number;
  monthCount: number;
}) {
  const activeIds = new Set(input.users.filter((user) => user.status === "ACTIVE").map((user) => user.id));
  const includedIds = new Set(activeIds);
  for (const entry of input.entries) includedIds.add(entry.contractorId);
  for (const sheet of input.timesheets) includedIds.add(sheet.contractorId);

  const workedMinutes = input.entries.reduce((total, row) => total + row.calculatedMinutes, 0);
  const eligibleMinutes = input.entries.reduce((total, row) => total + row.eligibleMinutes, 0);
  const creditedMinutes = input.timesheets.reduce((total, row) => total + row.creditedMinutes, 0);
  const sheetsByPerson = new Map<string, SummaryTimesheet[]>();
  for (const sheet of input.timesheets) {
    const sheets = sheetsByPerson.get(sheet.contractorId) ?? [];
    sheets.push(sheet);
    sheetsByPerson.set(sheet.contractorId, sheets);
  }
  let requiredMinutes = 0;
  let estimatedRequiredPersonMonths = 0;
  for (const id of includedIds) {
    const person = requiredForPerson(sheetsByPerson.get(id) ?? [], activeIds.has(id), input.requiredPerMonth, input.monthCount);
    requiredMinutes += person.requiredMinutes;
    estimatedRequiredPersonMonths += person.estimatedMonths;
  }

  return {
    activeContractors: activeIds.size,
    workedMinutes,
    creditedMinutes,
    consideredMinutes: eligibleMinutes + creditedMinutes,
    requiredMinutes,
    estimatedRequiredPersonMonths,
    includedContractorIds: [...includedIds].sort(),
  };
}
