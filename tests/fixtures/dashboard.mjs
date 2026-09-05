export function makeDashboard() {
  return {
    period: { from: "2026-08-01", to: "2026-08-31", year: 2026, month: 8 },
    metrics: {
      activeContractors: 1,
      workedMinutes: 480,
      requiredMinutes: 9720,
      positiveBalanceMinutes: 0,
      negativeBalanceMinutes: 0,
      pendingRequests: 0,
      pendingOccurrences: 0,
      pendingAuthorizations: 0,
    },
    timesheet: {
      workedMinutes: 480,
      creditedMinutes: 0,
      consideredMinutes: 480,
      requiredMinutes: 9720,
      projectedBalanceMinutes: -9240,
      status: "OPEN",
    },
    policy: {
      monthlyRequiredMinutes: 9720,
      positiveBalanceAfterDeadlinePolicy: "ALLOW_AFTER_DEADLINE",
      minimumLeaveNoticeDays: null,
      retroactiveBatchThreshold: 3,
    },
    contractors: [{
      id: "person-1",
      name: "Ana Exemplo",
      email: "ana@example.com",
      initials: "AE",
      status: "ACTIVE",
      sectorId: "sector-engineering",
      sectorName: "Engenharia",
      lastEntryDate: "2026-08-01",
      lastEntryAt: "2026-08-01T20:00:00Z",
      workedMinutes: 480,
      consideredMinutes: 480,
      requiredMinutes: 9720,
      fillPercentage: 5,
      averageDelayDays: 0,
      retroactiveEntries: 0,
      timesheetStatus: "OPEN",
    }],
    entries: [],
    balanceLots: [],
    balanceTransactions: [],
    requests: [],
    occurrences: [],
    authorizations: [],
  };
}

export function makeAdminData() {
  return {
    users: [{
      id: "person-1",
      name: "Ana Exemplo",
      email: "ana@example.com",
      role: "PJ",
      status: "ACTIVE",
      hasAccess: true,
      createdAt: "2026-08-01T12:00:00Z",
      updatedAt: "2026-08-01T12:00:00Z",
    }],
    audits: [],
  };
}
