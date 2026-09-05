"use client";

import { useRef, useState } from "react";
import { requestReportExport, type ReportRequest } from "./report-client";
import type { ReportFilters } from "./report-types";

const PACKAGE_GUIDANCE = "O pacote usa período, pessoa e setor; o filtro Tipo vale somente para a aba atual.";
const EXPORTS = [
  { format: "xlsx", label: "Excel — relatório atual" },
  { format: "package", label: "Excel — pacote completo" },
  { format: "csv", label: "CSV — relatório atual" },
  { format: "pdf", label: "PDF — resumo" },
] as const;

export function ExportMenu({ filters, request }: { filters: ReportFilters; request: ReportRequest }) {
  const [exporting, setExporting] = useState<(typeof EXPORTS)[number]["format"] | null>(null);
  const [status, setStatus] = useState("");
  const inFlight = useRef(false);

  async function download(format: (typeof EXPORTS)[number]["format"]) {
    if (inFlight.current) return;
    if (format === "package" && typeof window !== "undefined" && !window.confirm(PACKAGE_GUIDANCE)) return;
    inFlight.current = true;
    setExporting(format);
    setStatus(format === "package" ? PACKAGE_GUIDANCE : "Preparando exportação…");
    try {
      const result = await requestReportExport(request, filters, format);
      if (typeof document !== "undefined") {
        const href = URL.createObjectURL(result.blob);
        const link = document.createElement("a");
        link.href = href; link.download = result.filename; link.click();
        URL.revokeObjectURL(href);
      }
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível exportar o relatório.");
    } finally { inFlight.current = false; setExporting(null); }
  }

  return <section className="panel report-export-panel" aria-label="Exportar relatório">
    <div className="panel-heading static"><div><span>ARQUIVOS</span><h2>Exportar</h2></div></div>
    <div className="request-list">
      <p>{PACKAGE_GUIDANCE}</p>
      <div className="heading-actions">{EXPORTS.map(item => <button key={item.format} type="button" className={item.format === "xlsx" ? "primary-button" : "secondary-button"} disabled={exporting !== null} onClick={() => void download(item.format)}>{exporting === item.format ? "Preparando…" : item.label}</button>)}</div>
      <p role="status" aria-live="polite">{status}</p>
    </div>
  </section>;
}
