export type FifoLot = {
  id: string;
  originDate: string;
  remainingMinutes: number;
  reservedMinutes?: number;
};

export type FifoAllocation = { lotId: string; minutes: number };

export function balanceDeadline(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const deadline = new Date(Date.UTC(year, month, 0));
  deadline.setUTCDate(deadline.getUTCDate() + 90);
  return deadline.toISOString().slice(0, 10);
}

export function allocateFifo(lots: FifoLot[], requestedMinutes: number) {
  if (!Number.isInteger(requestedMinutes) || requestedMinutes < 0) return null;
  let remaining = requestedMinutes;
  const allocations: FifoAllocation[] = [];
  const ordered = [...lots].sort((left, right) => left.originDate.localeCompare(right.originDate) || left.id.localeCompare(right.id));
  for (const lot of ordered) {
    if (remaining === 0) break;
    const available = Math.max(0, lot.remainingMinutes - (lot.reservedMinutes ?? 0));
    const minutes = Math.min(remaining, available);
    if (minutes > 0) allocations.push({ lotId: lot.id, minutes });
    remaining -= minutes;
  }
  return { allocations, remainingMinutes: remaining, fullyAllocated: remaining === 0 };
}

export function deadlineStatus(
  type: "CREDIT" | "DEBIT",
  deadlineDate: string,
  policy: "ALLOW_AFTER_DEADLINE" | "BLOCK_AFTER_DEADLINE",
  today: string,
) {
  if (deadlineDate >= today) return "AVAILABLE";
  if (type === "DEBIT") return "OVERDUE";
  return policy === "ALLOW_AFTER_DEADLINE" ? "OVERDUE_AVAILABLE" : "EXPIRED";
}

