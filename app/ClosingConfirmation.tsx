"use client";
import { useRef, useState } from "react";
import { Modal } from "./Modal";
import { formatMinutes } from "./HorusViews";
import { monthPeriod } from "./period";
import { monthLabel } from "./HorusViews";
import { normalizeClosingResults, type ClosingCommand, type ClosingRow, type ClosingSubmit } from "./closing-model";

export function ClosingConfirmation({ command, rows, submit, testMode = false, onClose, onSettled, onBusyChange }: {
  command: ClosingCommand; rows: ClosingRow[]; submit?: ClosingSubmit; onClose: () => void;
  onSettled: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void; testMode?: boolean;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof normalizeClosingResults> | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const selected = rows.filter(row => command.contractorIds.includes(row.contractorId));
  const valid = command.contractorIds.length > 0 && selected.length === command.contractorIds.length;
  const closeLabel = selected.length === 1 ? "Fechar mês de " + selected[0].name : "Fechar mês da equipe";
  async function confirm() {
    if (!submit || !valid || inFlight.current || result) return;
    inFlight.current = true; setBusy(true); onBusyChange?.(true);
    try { setResult(normalizeClosingResults(command, await submit(structuredClone(command)))); }
    catch { setResult(normalizeClosingResults(command, [])); }
    finally {
      try { await onSettled(); } catch { setRefreshFailed(true); }
      setBusy(false); onBusyChange?.(false);
    }
  }
  const resultLabel = { closed: "Fechado", "already-closed": "Já fechado", blocked: "Impedido", failed: "Falhou", uncertain: "Resultado não confirmado" };
  return <Modal title={result ? "Resultado do fechamento" : "Revisar fechamento"} eyebrow={testMode ? "TESTE — DADOS FICTÍCIOS" : "CONFIRMAÇÃO DO MÊS"} description={monthLabel(monthPeriod(command.year, command.month)) + " · " + command.contractorIds.length + " colaborador(es) selecionado(s)"} onClose={onClose} busy={busy}>
    <div className="closing-confirmation">
      {!result && <><p>Fechar registra a situação mensal e as movimentações calculadas no banco de horas. Não apaga nem reescreve os horários originais dos dias trabalhados.</p>
        <ul>{selected.map(row => <li key={row.contractorId}><strong>{row.name}</strong> · saldo previsto: {row.forecastMinutes === null ? "Não disponível" : formatMinutes(row.forecastMinutes, true)}{row.status === "NO_ENTRIES" && " · mês sem lançamentos conferido"}</li>)}</ul>
        {!submit && <p role="status">Fechamento real ainda indisponível: validação de segurança do backend pendente.</p>}
        {!valid && <p role="alert">Não foi possível confirmar a seleção. Volte e revise os colaboradores.</p>}
      </>}
      {result && <div role="status">
        <h3>{result.complete ? selected.length === 1 ? "Mês do colaborador fechado" : "Equipe selecionada fechada" : "Confira o resultado de cada colaborador"}</h3>
        {result.warning && <p>{result.warning}</p>}
        <ul>{result.results.map(item => <li key={item.contractorId}><strong>{rows.find(row => row.contractorId === item.contractorId)?.name ?? item.contractorId}</strong>: {resultLabel[item.status]}{item.message && <p>{item.message}</p>}</li>)}</ul>
        {!result.complete && <p>Não repita o envio sem consultar a situação atual. Nenhum fechamento será refeito automaticamente.</p>}
        {refreshFailed && <p>Resultado recebido. Não foi possível atualizar a lista; atualize a consulta antes de revisar novamente.</p>}
      </div>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>{result ? "Voltar à conferência" : "Voltar"}</button>
        <button type="button" className="primary-button" disabled={Boolean(result) || !submit || busy || !valid} onClick={() => void confirm()}>{result ? "Envio encerrado" : busy ? "Processando…" : closeLabel}</button>
      </div>
    </div>
  </Modal>;
}
