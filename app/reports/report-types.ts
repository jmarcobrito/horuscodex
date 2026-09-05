export type ReportKind = "entries" | "balances" | "history";
export type SectorFilter = "UNASSIGNED" | string | null;
export type ReportCategory = string | null;
export type ReportFilters = { kind: ReportKind; from: string; to: string; personId: string | null; sectorId: SectorFilter; category: ReportCategory; actorId: string | null; page: number; pageSize: 50 };
export type ReportColumn = { key: string; label: string; technical?: boolean };
export type ReportOption = { value: string; label: string; description?: string };
export type ReportOptions = { people: ReportOption[]; sectors: ReportOption[]; actors: ReportOption[]; categories: ReportOption[] };
export type EntryReportRow = { id:string; workDate:string; personId:string; personName:string; sectorName:string; startTime:string; endTime:string; breakMinutes:number; workedMinutes:number; consideredMinutes:number; situation:string; notes:string };
export type BalanceReportRow = { id:string; createdAt:string; personId:string; personName:string; sectorName:string; movement:string; direction:"credit"|"debit"|"reservation"|"release"|"neutral"; directionLabel:string; minutes:number; description:string; status:string };
export type HistoryReportRow = { id:string; createdAt:string; actorId:string; actorName:string; action:string; affectedPersonId:string|null; affectedPersonName:string; relatedRecord:string; reason:string; technical:{actionCode:string; entityType:string; entityId:string} };
export type ReportRow = EntryReportRow | BalanceReportRow | HistoryReportRow;
export type EntryReportSummary = { workedMinutes:number; consideredMinutes:number };
export type BalanceReportSummary = { creditMinutes:number; debitMinutes:number; reservationMinutes:number; utilizationMinutes:number };
export type HistoryReportSummary = { events:number; affectedPeople:number };
type ReportResponseBase = { timezone:string; filters:ReportFilters; columns:ReportColumn[]; options:ReportOptions; pagination:{page:number;pageSize:50;total:number;pageCount:number} };
export type ReportResponse =
  | ReportResponseBase & { kind:"entries"; rows:EntryReportRow[]; summary:EntryReportSummary }
  | ReportResponseBase & { kind:"balances"; rows:BalanceReportRow[]; summary:BalanceReportSummary }
  | ReportResponseBase & { kind:"history"; rows:HistoryReportRow[]; summary:HistoryReportSummary };
