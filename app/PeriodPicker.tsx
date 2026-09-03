"use client";

import { useState, type FormEvent } from "react";
import type { DashboardPeriod } from "./dashboard-types";
import { asFullMonth, parseMonthValue, shiftMonth, validPeriodDate } from "./period";
import { monthLabel } from "./HorusViews";

export type PeriodPickerProps = {
  value: DashboardPeriod | null;
  busy: boolean;
  allowRange: boolean;
  onChange: (period: DashboardPeriod) => void;
};
export function PeriodPicker({ value, busy, allowRange, onChange }: PeriodPickerProps) {
  const month = value ? asFullMonth(value) : null;
  const previous = month ? shiftMonth(month, -1) : null;
  const next = month ? shiftMonth(month, 1) : null;
  return <section className="period-panel panel" aria-label="Selecionar período">
    <div className="month-selector">
      <span className="period-section-label">MÊS DE CONSULTA</span>
      <div className="month-selector-controls">
        <button type="button" aria-label="Voltar para o mês anterior" disabled={busy || !previous} onClick={() => previous && onChange(previous)}>←</button>
        <input aria-label="Mês de consulta" type="month" min="2000-01" max="2200-12" disabled={busy} value={month?.from.slice(0, 7) ?? ""} onChange={event => { const selected = parseMonthValue(event.target.value); if (selected) onChange(selected); }} />
        <button type="button" aria-label="Avançar para o próximo mês" disabled={busy || !next} onClick={() => next && onChange(next)}>→</button>
      </div>
      <span className="period-caption" aria-live="polite">{value ? monthLabel(value) : "Escolha o mês"}</span>
    </div>
    {allowRange && <><div className="period-divider" aria-hidden="true" /><RangePicker key={value?.from + ":" + value?.to} value={value} busy={busy} onChange={onChange} /></>}
  </section>;
}
function RangePicker({ value, busy, onChange }: Omit<PeriodPickerProps, "allowRange">) {
  const [from, setFrom] = useState(value?.from ?? "");
  const [to, setTo] = useState(value?.to ?? "");
  const valid = validPeriodDate(from) && validPeriodDate(to) && from <= to;
  function submit(event: FormEvent) { event.preventDefault(); if (valid && !busy) onChange({ from, to, year: null, month: null }); }
  return <form className="custom-period-selector" onSubmit={submit}>
    <span className="period-section-label">INTERVALO DE DATAS</span>
    <div className="period-inline">
      <label>Data inicial<input type="date" min="2000-01-01" max="2200-12-31" value={from} disabled={busy} onChange={event => setFrom(event.target.value)} /></label>
      <label>Data final<input type="date" min={from || "2000-01-01"} max="2200-12-31" value={to} disabled={busy} onChange={event => setTo(event.target.value)} /></label>
      <button className="primary-button" type="submit" disabled={busy || !valid}>Aplicar intervalo</button>
    </div>
    {from && to && !valid && <small role="alert">Confira as datas do intervalo.</small>}
  </form>;
}
