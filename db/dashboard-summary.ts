export type SummaryUser = { id: string; status: "ACTIVE" | "INACTIVE" };
export type SummaryEntry = { contractorId: string; calculatedMinutes: number; eligibleMinutes: number };
export type SummaryTimesheet = { contractorId: string; requiredMinutes: number; creditedMinutes: number };

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
  const sheetIds = new Set(input.timesheets.map((row) => row.contractorId));
  const timesheetRequirement = input.timesheets.reduce((total, row) => total + row.requiredMinutes, 0);
  const missingActiveSheets = [...activeIds].filter((id) => !sheetIds.has(id)).length;
  const requiredMinutes = timesheetRequirement + missingActiveSheets * input.requiredPerMonth * input.monthCount;

  return {
    activeContractors: activeIds.size,
    workedMinutes,
    creditedMinutes,
    consideredMinutes: eligibleMinutes + creditedMinutes,
    requiredMinutes,
    includedContractorIds: [...includedIds].sort(),
  };
}
