export type DailyHours = Record<string, string>;

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function formatMinutes(minutes: number) {
  return Math.floor(minutes / 60).toString().padStart(2, "0") + ":" + (minutes % 60).toString().padStart(2, "0");
}

function datesBetween(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      || startDate > endDate) return [];
  const result: string[] = [];
  const cursor = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cursor <= end && result.length < 366) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function dailyAllocationPayload(startDate: string, endDate: string, values: DailyHours) {
  return datesBetween(startDate, endDate)
    .map((date) => ({ date, minutes: Math.round(Number((values[date] ?? "").replace(",", ".")) * 60) }))
    .filter((day) => Number.isInteger(day.minutes) && day.minutes > 0 && day.minutes <= 1_440);
}

export function DailyAllocationFields({
  startDate,
  endDate,
  values,
  onChange,
}: {
  startDate: string;
  endDate: string;
  values: DailyHours;
  onChange: (values: DailyHours) => void;
}) {
  const dates = datesBetween(startDate, endDate);
  const totalMinutes = dailyAllocationPayload(startDate, endDate, values)
    .reduce((total, day) => total + day.minutes, 0);

  return <fieldset className="daily-allocation">
    <legend>Horas por dia</legend>
    <p>Informe somente os dias que terão horas. O sistema não divide o total automaticamente.</p>
    {dates.length ? <div className="daily-allocation-list">{dates.map((date) => <label key={date}>
      <span>{formatDate(date)}</span>
      <span className="daily-hours-input"><input
        type="number"
        min="0"
        max="24"
        step="0.25"
        inputMode="decimal"
        value={values[date] ?? ""}
        onChange={(event) => onChange({ ...values, [date]: event.target.value })}
        aria-label={`Horas de ${formatDate(date)}`}
      /><small>h</small></span>
    </label>)}</div> : <div className="field-message error">Escolha um período válido.</div>}
    <div className="daily-allocation-total"><span>Total distribuído</span><strong>{formatMinutes(totalMinutes)}</strong></div>
  </fieldset>;
}
