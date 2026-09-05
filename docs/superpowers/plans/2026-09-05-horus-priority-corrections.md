# Horus Priority Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execução nesta sessão, sem subagentes, conforme preferência do usuário.

**Goal:** Corrigir as inconsistências de consulta, aprovações, banco e histórico antes de reorganizar o painel, preservando os registros existentes.

**Architecture:** Manter as funções transacionais do banco intactas. Corrigir projeções de leitura e apresentação com funções puras testáveis; proteger na API a criação de ocorrência que promete consumir saldo sem fazê-lo. A fila de aprovações terá escopo explícito, sem ampliar permissões.

**Tech Stack:** TypeScript, React 19, Next.js 16/Vinext, Supabase no servidor, testes Node/Vite e PostgreSQL local isolado. Nenhuma dependência nova.

**Spec:** `../specs/2026-09-05-horus-audit-corrections-design.md` — ler integralmente. Este plano executa apenas a Entrega A; B e C têm seus limites e critérios registrados na especificação.

## Global Constraints

- Nenhuma migração, alteração de schema, RLS, grants, política ou função SQL nesta primeira entrega.
- Nenhuma edição, exclusão, importação, recálculo, fechamento ou reabertura de dados reais para testar.
- Preservar integralmente agosto e as versões históricas; corrigir a leitura não autoriza regravar a origem.
- Consultar não pode gravar: zero INSERT, UPDATE, DELETE, UPSERT ou RPC de mutação.
- Manter autorização no servidor, isolamento de organização e restrição do colaborador aos próprios dados.
- Manter a visualização DEV como colaborador somente para consulta.
- Não criar registros mensais nem lançamentos artificiais para permitir fechamento.
- Não adicionar dependências. Manter Node >=22.13.0 e as ferramentas existentes.
- Linguagem natural em português; ausência de lançamento não significa falta.
- Cada área conserva seu período; ações explícitas de navegação contextual podem abrir pessoa e mês de destino.
- Não fazer deploy, merge ou operações remotas durante o planejamento.

---

## Estado e limites desta entrega

Plano escrito a partir do commit `54be4957d4e944f800935b0cafdf2c025a6cfeba`; verificar o diff na retomada. Na documentação inicial, os testes ainda não haviam sido executados. Em 2026-09-05, as tarefas 1–6 e a validação local integrada da tarefa 7 foram concluídas. PR, preview externo e liberação de produção continuam pendentes de autorização específica. Evidências e limites: `../../runbooks/2026-09-05-priority-corrections-validation.md`. Nenhuma publicação remota foi realizada.

Não executar `db:push`, `db:types`, scripts SQL remotos, `supabase db reset` ou importações. Não carregar `.env` real em ensaios. Não usar dados pessoais nas fixtures. Não usar contagem de registros como única prova de preservação: comparar o conteúdo das tabelas fictícias antes/depois e assertar zero mutações nas consultas.

## Mapa de arquivos

| Responsabilidade | Arquivos |
|---|---|
| Entrada segura de ocorrência e acesso à folga existente | `app/api/occurrences/route.ts`, `app/HorusApp.tsx` |
| Escopo de aprovações e isolamento de estado | `db/dashboard.ts`, `app/api/dashboard/route.ts`, `app/workspace-state.ts`, `app/HorusApp.tsx`, `app/HorusViews.tsx`, `app/dashboard-types.ts` |
| Agregação mensal | `db/dashboard-summary.ts`, `db/dashboard.ts`, `tests/helpers/workflow-server.ts` |
| Escopo de indicadores e banco | novo `app/dashboard-display.ts`, `app/HorusViews.tsx` |
| Datas civis | novo `db/civil-date.ts`, `db/dashboard.ts` |
| Histórico e autoria | `app/api/time-entries/[id]/history/route.ts`, `app/EntryHistory.tsx`, `app/HorusApp.tsx` |
| Testes de leitura/rotas/componentes | `tests/complete-reads.test.mjs`, `tests/monthly-write-routes.test.mjs`, `tests/dashboard-summary.test.mjs`, `tests/workspace-state.test.mjs`, `tests/entry-history.test.mjs`, novos testes indicados abaixo |

As funções de negócio `close_timesheet`, `create_leave_request` e `decide_leave_request` não serão alteradas. Não refatorar áreas administrativas ou exportações neste pacote.

## Preparação para execução autorizada

- [x] Conferir `git status --short` e `git diff`; preservar alterações alheias. Selecionar branch de execução apropriada, usando a skill de worktrees se uma nova área isolada for necessária. Não presumir que a branch atual ainda pode receber PR.
- [x] Ler `scripts/verify-workflow-isolated.mjs`. Ele copia arquivos rastreados: novos arquivos de implementação/teste precisam estar rastreados antes da verificação completa; verificar lista e não incluir segredos.
- [x] Registrar baseline dos testes isolados. Nenhum “verde” pode resultar de teste que não foi executado ou que alcançou serviço real.

### Tarefa 1 — impedir novas ocorrências de consumo fictício

**Files:** modificar `app/api/occurrences/route.ts`, `app/HorusApp.tsx`; testar em `tests/monthly-write-routes.test.mjs` e `tests/rendered-html.test.mjs`.

**Interfaces:** manter POST da ocorrência e POST `/api/leave-requests` existentes. Novas ocorrências incompatíveis retornam 409 com mensagem; o formulário de folga continua usando `requestedMinutes`, não `minutes`.

- [x] Acrescentar o teste abaixo à suíte de rotas, aproveitando `occurrence`, `boundary` e `request` já definidos nela:

```js
test("bank use cannot be created through occurrences", async () => {
  for (const role of ["RH", "DEV", "PJ"]) {
    for (const body of [
      { type: "BANK_LEAVE" },
      { type: "OTHER", calculationEffect: "CONSUMES_BALANCE" },
    ]) {
      boundary.reset(role);
      const response = await occurrence.POST(request("POST", {
        contractorId: "person-1", startDate: "2026-10-12",
        endDate: "2026-10-12", minutes: 60, description: "Fictício", ...body,
      }));
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /solicitação de folga/i);
      assert.equal(boundary.calls.length, 0);
    }
  }
});
```

- [x] Rodar `node --test tests/monthly-write-routes.test.mjs`; confirmar falha por status 201 nos casos reproduzidos, não por erro de ambiente.
- [x] Após `requireActor()` e antes da chamada RPC, adicionar a guarda. Verificar o tipo bruto e o efeito bruto, mesmo para PJ; não confiar na opção removida da interface:

```ts
if (String(body.type) === "BANK_LEAVE" || String(body.calculationEffect ?? "") === "CONSUMES_BALANCE") {
  return Response.json({ error: "Para usar o banco de horas, abra uma solicitação de folga." },
    { status: 409, headers: { "cache-control": "private, no-store" } });
}
```

- [x] Atualizar o teste existente de atestado PJ que envia `CONSUMES_BALANCE`: ele passa a verificar rejeição explícita. Adicionar um atestado sem efeito bruto para continuar provando que o servidor aplica `CREDITS_HOURS`, sem permitir escolha indevida de efeito pelo PJ.
- [x] Remover BANK_LEAVE e CONSUMES_BALANCE das opções de nova ocorrência. No modal, inserir ação secundária “Solicitar folga com banco de horas” que copia pessoa, datas, horas e descrição para `leaveForm` e chama `setModal("leave")`. Não enviar nenhuma requisição nessa transição. Respeitar bloqueio de mutação e visualização DEV somente leitura.

```ts
setLeaveForm({ contractorId: occurrenceForm.contractorId,
  startDate: occurrenceForm.startDate, endDate: occurrenceForm.endDate,
  hours: occurrenceForm.hours, reason: occurrenceForm.description });
setModal("leave");
```

- [x] Manter leitura de ocorrências antigas e PATCH existentes. Não converter nem cancelar registros antigos. Se aparecer ocorrência antiga de consumo numa consulta futura, registrar bloqueio de release para definição do tratamento; não alterar o dado automaticamente.
- [x] Rodar a suíte de rotas e testar no preview fictício: transição preserva formulário; cancelar não grava; enviar folga chama somente o endpoint de folgas; erro de saldo preserva campos. Revisar e fazer commit apenas dos arquivos desta tarefa.

### Tarefa 2 — tornar o escopo de Aprovações explícito e consistente

**Files:** modificar `app/dashboard-types.ts`, `db/dashboard.ts`, `app/api/dashboard/route.ts`, `app/workspace-state.ts`, `app/HorusApp.tsx`, `app/HorusViews.tsx`, `tests/helpers/workflow-server.ts`; testar `tests/complete-reads.test.mjs`, `tests/workspace-state.test.mjs`, `tests/workflow-server.test.mjs`.

**Interfaces:** adicionar `ApprovalsScope = "period" | "all"`; opção `approvalsScope?: ApprovalsScope` em `PeriodInput`; resposta `DashboardData.approvalsScope?: ApprovalsScope`, ausência interpretada como `period` para fixtures antigas. `GET /api/dashboard?...&approvalsScope=all` continua autenticado e somente leitura. Parâmetro ausente usa `period`, inválido retorna 400.

- [x] Em `complete-reads.test.mjs`, usar a fixture existente com autorizações em agosto; chamar setembro com `approvalsScope: "all"` e afirmar que elas aparecem. Repetir com `period` e afirmar que não aparecem. Inserir folgas/ocorrências fictícias com datas de agosto e setembro, incluindo uma ocorrência atravessando meses, e exigir o mesmo resultado por interseção. Antes/depois: `assert.deepEqual(boundary.tables, before)` e `assert.equal(boundary.writes, 0)` / `rpcCalls === 0`.

```js
test("all-date approval read includes older requests without writes", async () => {
  const before = structuredClone(boundary.tables);
  const data = await getDashboardData(rh, { year: 2026, month: 9, approvalsScope: "all" });
  assert.equal(data.authorizations.length, 1105);
  assert.equal(data.approvalsScope, "all");
  assert.deepEqual(boundary.tables, before);
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});
```

- [x] Rodar `node --test tests/complete-reads.test.mjs`; observar falha do novo contrato. Testar separadamente PJ e DEV como PJ, incluindo registros de outra organização, que nunca podem ser retornados.
- [x] Construir as três consultas sem datas primeiro; quando `approvalsScope !== "all"`, acrescentar os filtros abaixo. Preservar `organization_id`, restrição PJ, ordenação estável e `readAllRows` em todos os caminhos:

```ts
requestsQuery = requestsQuery.lte("start_date", period.to).gte("end_date", period.from);
occurrencesQuery = occurrencesQuery.lte("start_date", period.to).gte("end_date", period.from);
authorizationsQuery = authorizationsQuery.gte("work_date", period.from).lte("work_date", period.to);
```

- [x] Na interface, começar a aba Aprovações em “Todas as datas” / “Pendências”. A situação Pendências inclui REQUESTED e NEEDS_ADJUSTMENT; exibir separadamente “Aguardando decisão do RH” e “Aguardando ajuste”. Acrescentar seletores de tipo e pessoa; o filtro pessoa nunca amplia o conjunto autorizado. Dar a estados vazios o texto “Nenhuma pendência com estes filtros”.
- [x] Reutilizar `PeriodPicker` somente no modo “Período escolhido”. Não alterar automaticamente o mês do Painel. O foco vindo do fechamento abre o mês/pessoa do problema e torna esse filtro visível; “Limpar foco” não muda o mês das outras abas.
- [x] Estender `workspaceKey(role, section, viewAsId = "", approvalsScope: ApprovalsScope = "period")`: só para `requests`, adicionar `":" + approvalsScope`. Manter os demais resultados atuais. `HorusApp` deve usar essa chave em abertura, requisição, atualização e invalidação; incluir o escopo na URL e rejeitar resposta cujo escopo seja diferente. Guardar a escolha por perfil/pessoa visualizada; não reaproveitar respostas de outra identidade.

```js
assert.notEqual(w.workspaceKey("rh", "requests", "", "all"),
  w.workspaceKey("rh", "requests", "", "period"));
assert.equal(w.workspaceKey("rh", "entries", "", "all"),
  w.workspaceKey("rh", "entries", "", "period"));
```

- [x] No simulador `createWorkflowServer`, aplicar as mesmas regras de escopo às arrays de pedidos e devolver `approvalsScope`. Cobrir alternância rápida entre escopos e resposta atrasada: a resposta anterior não substitui a última seleção. Contador do menu não deve ser apresentado como global se vier do escopo mensal; nesta entrega, rotular “Pendências deste período” quando aplicável.
- [x] Rodar as três suítes, conferir comportamento no preview fictício e fazer commit da tarefa. Revalidar que solicitar/decidir ainda usa as rotas transacionais existentes e que nenhuma consulta grava.

### Tarefa 3 — completar a carga de cada pessoa/mês sem gravar folhas

**Files:** modificar `db/dashboard-summary.ts`, `db/dashboard.ts`, `app/dashboard-types.ts`, `tests/dashboard-summary.test.mjs`, `tests/helpers/workflow-server.ts`; testar também `tests/complete-reads.test.mjs`.

**Interfaces:** `SummaryTimesheet` passa a exigir `year: number; month: number`. Acrescentar função `requiredForPerson(sheets: SummaryTimesheet[], active: boolean, requiredPerMonth: number, monthCount: number): { requiredMinutes: number; estimatedMonths: number }`. A função recebe somente folhas da pessoa dentro do período; consumidores devem filtrá-las previamente. O banco garante uma folha por pessoa/mês; detectar duplicatas em leitura e falhar, não somar duas vezes.

- [x] Adicionar teste com duas competências e uma folha; atualizar os testes antigos para informar year/month:

```js
test("requirement covers each missing active month", () => {
  const result = buildPeriodSummary({
    users: [{ id: "a", status: "ACTIVE" }], entries: [],
    timesheets: [{ contractorId: "a", year: 2026, month: 8, requiredMinutes: 60, creditedMinutes: 0 }],
    requiredPerMonth: 60, monthCount: 2,
  });
  assert.equal(result.requiredMinutes, 120);
});
```

- [x] Rodar `node --test tests/dashboard-summary.test.mjs`; o caso novo deve falhar em 60 versus 120. Acrescentar casos: duas folhas com cargas históricas diferentes, pessoa inativa com uma folha, ativa sem folha, duplicata de competência.
- [x] Implementar a soma por pessoa com o núcleo abaixo; primeiro validar duplicatas pela chave `year + "-" + month`. Reusar a função nos totais e em cada `DashboardContractor`, eliminando o atual fallback por pessoa inteira:

```ts
const stored = sheets.reduce((n, row) => n + row.requiredMinutes, 0);
const present = new Set(sheets.map(row => row.year + "-" + row.month)).size;
const estimatedMonths = active ? Math.max(0, monthCount - present) : 0;
return { requiredMinutes: stored + estimatedMonths * requiredPerMonth, estimatedMonths };
```

- [x] Adicionar `estimatedRequiredMonths?: number` ao tipo de pessoa e `estimatedRequiredPersonMonths?: number` ao resumo retornado; somar a contagem estimada. Quando >0, a interface informa “Inclui estimativa para meses sem registro mensal”. Não chamar essa estimativa de carga histórica confirmada.
- [x] Atualizar todos os chamadores encontrados por `rg -n "buildPeriodSummary|requiredForPerson" app db tests`, incluindo o servidor fictício. Adicionar year/month ao mapeamento de folhas de `db/dashboard.ts`. Nenhuma chamada `ensure_*`/recalcular durante leitura.
- [x] Executar as suítes de resumo, leituras completas e servidor fictício. Confirmar pessoa inativa com histórico continua visível; conferir teste de zero gravações. Revisar e fazer commit desta tarefa.

### Tarefa 4 — separar contexto mensal, dias e saldo livre

**Files:** criar `app/dashboard-display.ts` e `tests/dashboard-display.test.mjs`; modificar `app/HorusViews.tsx`; testar renderização existente em `tests/rendered-html.test.mjs`.

**Interfaces:** exportar `dashboardDisplay(data: DashboardData)`, retornando `{ fullMonth: boolean; workedMinutes: number; entryEligibleMinutes: number; monthlyContext: { creditedMinutes: number; requiredMinutes: number; projectedBalanceMinutes: number } | null; validCreditMinutes: number; reservedCreditMinutes: number; availableCreditMinutes: number; daysByPerson: Record<string, number> }`. Manter `metrics.positiveBalanceMinutes` como total de créditos válidos para não trocar silenciosamente o significado dos consumidores antigos.

- [x] Escrever o teste da função com `runnerImport` e fixture existente:

```js
test("available credit excludes reservations without changing lots", async () => {
  const { module: m } = await runnerImport("./app/dashboard-display.ts", { configFile: false, envDir: false });
  const data = makeWorkflowDashboard();
  data.balanceLots = [{ id: "lot-1", contractorId: "person-1", contractorName: "Pessoa fictícia",
    type: "CREDIT", originalMinutes: 600, remainingMinutes: 600, reservedMinutes: 480,
    originDate: "2026-08-31", deadlineDate: "2099-12-31", status: "RESERVED" }];
  const before = structuredClone(data);
  const result = m.dashboardDisplay(data);
  assert.equal(result.validCreditMinutes, 600);
  assert.equal(result.reservedCreditMinutes, 480);
  assert.equal(result.availableCreditMinutes, 120);
  assert.deepEqual(data, before);
});
```

Importar `test`, `assert`, `runnerImport` e `makeWorkflowDashboard` de seus caminhos já usados nas suítes existentes. Adicionar lotes EXPIRED, CONSUMED, CANCELLED, SETTLED e DEBIT que não entram em crédito disponível. OVERDUE_AVAILABLE entra conforme projeção da política já feita em `db/dashboard.ts`. Não duplicar a regra de vencimento no navegador.

- [x] Rodar `node --test tests/dashboard-display.test.mjs`; a falha inicial deve ser a ausência da função. Implementar seleção dos créditos válidos usando os mesmos estados aceitos atualmente em `getDashboardData`; calcular por lote `Math.max(0, remainingMinutes - reservedMinutes)` e somar. Dias = datas distintas de lançamento por pessoa, não horas divididas por jornada.
- [x] Usar `asFullMonth(data.period)` para `fullMonth`. Para intervalo livre, mostrar horas trabalhadas e horas consideradas dos lançamentos (`sum(entry.eligibleMinutes)`) como valores das datas. Mostrar abonos/carga/projeção de folhas em área “Contexto dos meses consultados — valores mensais completos, sem rateio”. Não apresentar `data.timesheet.consideredMinutes` ou sua projeção híbrida como resultado diário.
- [x] Calcular a projeção do contexto mensal a partir de `monthlyTimesheets.consideredMinutes` completos menos a carga mensal agregada; se `monthlyTimesheets` estiver ausente, retornar `monthlyContext: null` e mostrar “Contexto mensal indisponível”, não zero. Tratar null em todos os consumidores. Folhas fechadas usam valores persistidos, sem recálculo.
- [x] Renomear “Preenchimento” em Painel e Pessoas para “Horas em relação à carga mensal”; em intervalo parcial, ocultar o percentual híbrido e mostrar “Consulte um mês completo”. Acrescentar “Dias com lançamento” sem sugerir faltas. Em Banco, exibir “Créditos válidos”, “Reservado para folgas” e “Disponível para usar”, com “Saldo atual do banco; não é uma posição histórica do mês selecionado”. Manter déficit separado.
- [x] Acrescentar teste de um dia sem lançamento e folha com 480 min de abono: horas consideradas dos dias = 0; abono no contexto mensal = 480; não aparece como abono daquele dia. Testar estados vazios, erro/indisponibilidade e duas entradas no mesmo dia contando apenas uma data.
- [x] Rodar as duas suítes, conferir nomes/valores no preview fictício e fazer commit específico. Corrigir textos existentes sem reorganizar o layout inteiro do painel.

### Tarefa 5 — datas de registro no fuso correto

**Files:** criar `db/civil-date.ts`, `tests/civil-date.test.mjs`; modificar `db/dashboard.ts`, `app/dashboard-types.ts` e `app/HorusViews.tsx`; testar `tests/complete-reads.test.mjs`.

**Interfaces:** `civilDate(instant: string, timeZone: string): string | null`; `registrationDelayDays(workDate: string, createdAt: string, timeZone: string): number | null`. Retorno null indica data inválida; não converter para atraso zero silenciosamente. Fuso inválido da organização deve produzir erro de configuração/consulta, não usar o fuso do computador.

- [x] Criar teste puro:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { registrationDelayDays } from "../db/civil-date.ts";
test("same civil day is not retroactive", () => {
  assert.equal(registrationDelayDays("2026-08-03", "2026-08-04T01:00:00Z", "America/Sao_Paulo"), 0);
  assert.equal(registrationDelayDays("2026-08-03", "2026-08-04T03:01:00Z", "America/Sao_Paulo"), 1);
  assert.equal(registrationDelayDays("2026-08-03", "invalid", "America/Sao_Paulo"), null);
});
```

- [x] Rodar `node --test tests/civil-date.test.mjs`; confirmar falha pela função ausente. Implementar com `Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)` e montar YYYY-MM-DD pelos tipos de parte, sem depender da ordem da string localizada. Diferença = dias entre as duas datas civis interpretadas à meia-noite UTC, limitada a zero para registro antecipado. Validar data trabalhada com `validPeriodDate` existente ou função equivalente sem coerção de data inexistente.
- [x] Substituir `delayDays` em `db/dashboard.ts` pelo helper, usando o timezone já lido de `organizations`. Média usa somente datas válidas; acrescentar contador `unavailableRegistrationDates?: number` por pessoa para sinalizar registros desconsiderados no indicador. Não alterar `created_at` nem `work_date`.
- [x] Atualizar rótulos: “Dias entre trabalho e registro” e “Registrados após a data trabalhada”; quando há datas inválidas, indicar a quantidade sem avaliar atraso dessas linhas. Diferenciar “Última data trabalhada” de “Último envio”: o último envio deve ser o maior `created_at`, não a data de envio da primeira linha ordenada por trabalho.
- [x] Em leituras completas, alterar apenas a fixture para o caso 22h e verificar contador zero mais conteúdo intacto. Testar mudança de mês/ano e outro timezone IANA válido. Rodar as duas suítes, revisar e fazer commit.

### Tarefa 6 — completar o histórico diário sem regravar versões

**Files:** modificar `app/api/time-entries/[id]/history/route.ts`, `app/EntryHistory.tsx`, `app/HorusApp.tsx`, `tests/entry-history.test.mjs`, `tests/complete-reads.test.mjs`, `tests/helpers/workflow-server.ts`.

**Interfaces:** resposta continua `{ versions }` e acrescenta `timezone: string`; cada versão acrescenta `changed_by_name: string | null`. `HistoryVersion` aceita esse campo opcional para compatibilidade; estado `ready` aceita `timezone?: string`. O endpoint real sempre retorna timezone; fixtures antigas usam fallback explícito America/Sao_Paulo, não fuso do navegador. Nome armazenado/resolvido hoje não deve ser descrito como nome histórico imutável.

- [x] Acrescentar testes de campos:

```js
const version = makeHistoryVersion();
version.previous_data.eligible_minutes = 0;
version.new_data.eligible_minutes = 120;
version.previous_data.non_business_day_status = "PENDING_AUTHORIZATION";
version.new_data.non_business_day_status = "AUTHORIZED";
assert.deepEqual(h.historyFields(version).find(f => f.label === "Horas consideradas"),
  { label: "Horas consideradas", before: "00:00", after: "02:00" });
assert.deepEqual(h.historyFields(version).find(f => f.label === "Autorização do dia"),
  { label: "Autorização do dia", before: "Aguardando autorização", after: "Autorizado" });
```

- [x] Rodar `node --test tests/entry-history.test.mjs`; confirmar falha porque os campos não existem. Na rota, depois de autorizar o lançamento, consultar somente autores citados nas versões, com `organization_id` da sessão e seleção `id,name`, paginada/completa. Não enviar diretório completo, e-mails ou perfis administrativos. Ler timezone da organização. Se a consulta de autoria falhar, retornar erro com nova tentativa; nome realmente não encontrado é null.
- [x] Acrescentar a `fields` as chaves `eligible_minutes` e `non_business_day_status`. Formatar a primeira com `formatMinutes`, a segunda com mapa natural: NOT_APPLICABLE → Regular; PENDING_AUTHORIZATION → Aguardando autorização; AUTHORIZED → Autorizado; REJECTED → Rejeitado; NEEDS_ADJUSTMENT → Requer ajuste. Confirmar os demais valores contra os tipos SQL existentes antes de completar o mapa; desconhecido → “Situação não reconhecida”, nunca substituir o dado gravado.
- [x] `EntryHistory` prefere `version.changed_by_name`, mantém fallback de `names` para compatibilidade e “Responsável não identificado” quando ambos faltarem. Passar `timeZone` ao `Intl.DateTimeFormat`; manter “Data não disponível” para instant inválido. `openHistory` armazena `timezone` junto com versions; conservar proteção contra resposta atrasada e botão de nova tentativa.
- [x] Testar autor RH e DEV com nome resolvido, autor ausente, tentativa de autor de outra organização, colaborador tentando abrir lançamento alheio, mais de 1000 versões, erro na segunda página, campo antigo ausente e horário próximo à meia-noite. A fixture deve provar `versions` e tabelas intactas e zero RPC/mutações após a consulta.
- [x] Rodar `node --test tests/entry-history.test.mjs tests/complete-reads.test.mjs tests/developer-view-contract.test.mjs`; conferir antes/depois no preview fictício, revisar e fazer commit da tarefa.

### Tarefa 7 — revisão integrada e liberação controlada

**Files:** criar `docs/runbooks/2026-09-05-priority-corrections-validation.md`; usar `scripts/verify-workflow-isolated.mjs`, `scripts/verify-closing-postgres.mjs` e as suítes existentes sem modificar suas proteções.

- [x] Procurar todos os consumidores alterados com `rg -n "approvalsScope|positiveBalanceMinutes|buildPeriodSummary|HistoryState|HistoryVersion|workspaceKey" app db tests`; conferir contratos, fixtures e ausência de indicadores com significado trocado.
- [x] Verificar `git diff --name-only` e `git diff --check`: nenhum arquivo de migração, SQL de produção, política ou dependência deve integrar o pacote. Novos arquivos precisam estar rastreados para o verificador isolado copiá-los; adicionar somente caminhos revisados, nunca `git add .` sem inspeção.
- [x] Rodar `npm run verify:workflow`: build Vinext, testes da aplicação, lint, build Next e TypeScript numa cópia sem ambiente real. Guardar saídas e contagens reais no runbook. Se rede/fontes bloquearem a compilação, registrar falha de ambiente e obter autorização, sem classificar como teste aprovado. A primeira execução parou nas fontes; Next e TypeScript passaram na repetição autorizada, na mesma cópia e com ambiente filtrado.
- [x] Resolver a instalação local PostgreSQL e rodar o verificador com o procedimento abaixo. Se não estiver no PATH, parar essa verificação e localizar a pasta registrada na execução anterior ou solicitar a localização; não instalar automaticamente. O script cria cluster fictício próprio; não pode receber Supabase, PGDATA existente ou base real.

```powershell
$horusInitdb = Get-Command initdb -CommandType Application -ErrorAction Stop
$horusPgBin = Split-Path -Parent $horusInitdb.Source
foreach ($horusExecutable in @('initdb.exe', 'pg_ctl.exe', 'psql.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $horusPgBin $horusExecutable) -PathType Leaf)) {
    throw 'Instalação PostgreSQL local incompleta; não iniciar testes.'
  }
}
node scripts/verify-closing-postgres.mjs --bin $horusPgBin --candidate
if ($LASTEXITCODE -ne 0) { throw 'Verificação PostgreSQL falhou.' }
```
O sinalizador `--candidate` é necessário para testar no cluster novo as proteções mensais do SQL existente, já publicado conforme o runbook de release de 03/09. Não cria uma migração neste pacote nem autoriza execução remota. Sem ele, o executor usa apenas a base antiga. Executáveis locais foram localizados no caminho registrado no runbook, sem nova instalação.

- [x] Rodar preview isolado (`npm run preview:workflow`) e conferir: RH; colaborador; DEV/RH; DEV como colaborador; mês sem dados; mês fechado; falha de leitura; resposta atrasada; seleção individual/coletiva; fechamento bloqueado por ajuste; resultado parcial/incerto sem reenvio; histórico; relatórios/exportações inalterados. Todas as ações de escrita apenas sobre fixtures. Usada a mesma cópia isolada do verificador, em 4177, com ambiente filtrado; distinção entre evidência de navegador e testes automatizados registrada no runbook (ajuste e arquivos exportados verificados nas suítes, não por nova escrita/download no navegador).
- [x] Registrar no runbook uma tabela para cada cenário com resultado real, evidência e falhas. Não marcar “passou” antes de observar o resultado. Conferir teclado/foco e janela ampla/estreita nas áreas tocadas.
- [x] Após autorização de execução e revisão local, preparar PR com: achados F01–F07 cobertos; arquivos; testes; ausência de migrações; prova de leitura sem gravação; limites; instrução de reversão da versão do aplicativo. Não incluir dados pessoais ou capturas reais no PR. PR #5 aberto em rascunho; deploy Git automático desabilitado somente na branch de revisão. Produção e banco inalterados nesta preparação.
- [ ] Preview publicado somente quando autorizado e identificado seu ambiente. Se usa banco de produção, limitar a navegação a leitura; nenhum cadastro, edição, aprovação ou fechamento de teste. Não copiar chaves privilegiadas para variáveis públicas.
- [ ] Antes de produção, apresentar resultado do PR/preview e pedir aprovação específica do release. Confirmar versão anterior recuperável. Publicar somente o aplicativo, sem comandos Supabase; depois verificar leitura e navegação. Qualquer regressão bloqueia a entrega e exige reverter o aplicativo, não o banco.

## Revisão do plano

Cobertura: F01 → tarefa 1; F02 → tarefa 2; F03 → tarefa 3; F04/F06 → tarefa 4; F05 → tarefas 4/5; F07 → tarefa 6. F08 e regras novas ficam explicitamente fora, na Entrega C da especificação. Dashboard visual, fechamento compacto e relatórios compactos ficam na Entrega B, após validação funcional.

Revisão documental realizada: cobertura F01–F07 mapeada; contratos de contexto mensal anulável e autoria opcional alinhados; tipos compartilhados incluídos nas tarefas que os alteram; ausência de instrução de migração ou recálculo remoto. Testes de fixture não podem substituir os testes das rotas/leitores reais.

Critério final: o RH recebe nomes e valores coerentes, Aprovações não oculta o escopo, o histórico permanece íntegro e o fechamento mantém sua proteção. Aprovar este plano não autoriza alterar regras históricas, banco real ou promover automaticamente a produção.
