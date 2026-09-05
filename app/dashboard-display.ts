import type { DashboardData } from "./dashboard-types";
import { asFullMonth } from "./period";

// Presentation only. Entries and monthly sheets are already scoped by the server.
// Lot status already reflects the organization's policy; do not expire lots here.
export function dashboardDisplay(data: DashboardData) {
  const credits = data.balanceLots.filter(lot => lot.type === "CREDIT" && lot.remainingMinutes > 0
    && !["EXPIRED", "CONSUMED", "CANCELLED", "SETTLED"].includes(lot.status));
  const dates = new Map(data.contractors.map(person => [person.id, new Set<string>()]));
  for (const entry of data.entries) {
    const personDates = dates.get(entry.contractorId) ?? new Set<string>();
    personDates.add(entry.workDate);
    dates.set(entry.contractorId, personDates);
  }
  const monthlyContext = data.monthlyTimesheets === undefined ? null : {
    creditedMinutes: data.monthlyTimesheets.reduce((total, sheet) => total + sheet.creditedMinutes, 0),
    requiredMinutes: data.metrics.requiredMinutes,
    projectedBalanceMinutes: data.monthlyTimesheets.reduce((total, sheet) => total + sheet.consideredMinutes, 0) - data.metrics.requiredMinutes,
  };
  return {
    fullMonth: Boolean(asFullMonth(data.period)),
    workedMinutes: data.entries.reduce((total, entry) => total + entry.calculatedMinutes, 0),
    entryEligibleMinutes: data.entries.reduce((total, entry) => total + entry.eligibleMinutes, 0),
    monthlyContext,
    validCreditMinutes: credits.reduce((total, lot) => total + lot.remainingMinutes, 0),
    reservedCreditMinutes: credits.reduce((total, lot) => total + lot.reservedMinutes, 0),
    availableCreditMinutes: credits.reduce((total, lot) => total + Math.max(0, lot.remainingMinutes - lot.reservedMinutes), 0),
    daysByPerson: Object.fromEntries([...dates].map(([id, days]) => [id, days.size])),
  };
}
