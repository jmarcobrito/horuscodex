import type { ClosingCommand, ClosingResult, ClosingSubmit } from "./closing-model";

export type WorkflowRequest = (path: string, init?: RequestInit) => Promise<Response>;

function validate(command: ClosingCommand) {
  if (!command || !Number.isInteger(command.year) || command.year < 2000 || command.year > 2200
      || !Number.isInteger(command.month) || command.month < 1 || command.month > 12
      || !Array.isArray(command.contractorIds) || !command.contractorIds.length
      || command.contractorIds.some(id => typeof id !== "string" || !id.trim() || id.length > 200 || id !== id.trim())) {
    throw Error("Selecione um mês válido e os colaboradores para fechar.");
  }
  return [...new Set(command.contractorIds)];
}

export function createClosingSubmit(request: WorkflowRequest): ClosingSubmit {
  let running = false;
  return async command => {
    const ids = validate(command);
    if (running) throw Error("Um fechamento já está em andamento.");
    running = true;
    const { year, month } = command;
    const results: ClosingResult[] = [];
    let interrupted = false;
    try {
      for (const contractorId of ids) {
        if (interrupted) {
          results.push({ contractorId, status: "blocked", message: "Não enviado. Consulte o resultado anterior antes de continuar." });
          continue;
        }
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(Error("Resposta não confirmada")); }, 15_000);
          });
          const operation = async (): Promise<ClosingResult> => {
            const response = await request("/api/timesheets", {
              method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "CLOSE", contractorId, year, month }), signal: controller.signal,
            });
            const body = await response.json();
            if (!response.ok) {
              if (![400, 401, 403, 404, 409, 422].includes(response.status)) throw Error("Resposta não confirmada");
              if (response.status === 401 || response.status === 403) interrupted = true;
              return { contractorId, status: "blocked", message: typeof body?.error === "string" ? body.error.slice(0, 500) : "Fechamento não autorizado. Atualize a consulta." };
            }
            if (body?.action !== "CLOSE" || body?.result?.timesheetId !== `ts_${contractorId}_${year}_${month}`
                || typeof body.result.alreadyClosed !== "boolean") throw Error("Resposta incompatível com a seleção");
            return { contractorId, status: body.result.alreadyClosed ? "already-closed" : "closed" };
          };
          results.push(await Promise.race([operation(), timeout]));
        } catch {
          interrupted = true;
          results.push({ contractorId, status: "uncertain", message: "Não foi possível confirmar o resultado. Consulte a situação do mês antes de repetir; cancelar a espera não desfaz o fechamento." });
        } finally { clearTimeout(timer); }
      }
      return results;
    } finally { running = false; }
  };
}
