"use client";

import type { HistoryReportRow, ReportResponse, ReportRow } from "./report-types";

function formatMinutes(value: number) {
  const sign = value < 0 ? "−" : "";
  const minutes = Math.abs(value);
  return `${sign}${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function cellValue(row: ReportRow, key: string, timezone: string) {
  const value = (row as unknown as Record<string, unknown>)[key];
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && key.toLowerCase().includes("minutes")) return formatMinutes(value);
  if (typeof value === "string" && key === "workDate") return formatDate(value);
  if (typeof value === "string" && key === "createdAt") return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}

function ReportSummary({ report }: { report: ReportResponse }) {
  if (report.kind === "entries") return <section className="timesheet-summary" aria-label="Resumo dos lançamentos">
    <div><span>Horas trabalhadas</span><strong>{formatMinutes(report.summary.workedMinutes)}</strong></div>
    <div><span>Horas consideradas</span><strong>{formatMinutes(report.summary.consideredMinutes)}</strong></div>
  </section>;
  if (report.kind === "balances") return <section className="timesheet-summary" aria-label="Resumo do banco de horas">
    <div><span>Créditos</span><strong>{formatMinutes(report.summary.creditMinutes)}</strong></div>
    <div><span>Débitos</span><strong>{formatMinutes(report.summary.debitMinutes)}</strong></div>
    <div><span>Reservas</span><strong>{formatMinutes(report.summary.reservationMinutes)}</strong></div>
    <div><span>Utilizações</span><strong>{formatMinutes(report.summary.utilizationMinutes)}</strong></div>
  </section>;
  return <section className="timesheet-summary" aria-label="Resumo do histórico">
    <div><span>Alterações encontradas</span><strong>{report.summary.events}</strong></div>
    <div><span>Pessoas afetadas</span><strong>{report.summary.affectedPeople}</strong></div>
  </section>;
}

function TechnicalDetails({ row }: { row: HistoryReportRow }) {
  return <details><summary>Dados técnicos</summary><dl>
    <div><dt>Ação original</dt><dd>{row.technical.actionCode}</dd></div>
    <div><dt>Entidade</dt><dd>{row.technical.entityType}</dd></div>
    <div><dt>Identificador</dt><dd>{row.technical.entityId}</dd></div>
  </dl></details>;
}

export function ReportTable({ report, isDev, onPageChange }: { report: ReportResponse; isDev: boolean; onPageChange: (page: number) => void }) {
  const columns = report.columns.filter(column => !column.technical);
  const start = report.pagination.total ? (report.pagination.page - 1) * report.pagination.pageSize + 1 : 0;
  const end = Math.min(report.pagination.page * report.pagination.pageSize, report.pagination.total);
  return <>
    <ReportSummary report={report} />
    {report.rows.length > 0 && <section className="panel ledger-panel" aria-label="Resultados do relatório">
      <div className="table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key}>{cellValue(row, column.key, report.timezone)}{isDev && report.kind === "history" && column.key === columns.at(-1)?.key && <TechnicalDetails row={row as HistoryReportRow} />}</td>)}</tr>)}</tbody>
      </table></div>
    </section>}
    <nav className="panel entries-toolbar report-pagination" aria-label="Paginação do relatório">
      <span aria-live="polite">Resultados {start}–{end} de {report.pagination.total}</span>
      <div><button type="button" className="secondary-button" aria-label="Página anterior" disabled={report.pagination.page <= 1} onClick={() => onPageChange(report.pagination.page - 1)}>Anterior</button>
        <button type="button" className="secondary-button" aria-label="Próxima página" disabled={report.pagination.page >= report.pagination.pageCount} onClick={() => onPageChange(report.pagination.page + 1)}>Próxima</button></div>
    </nav>
  </>;
}
