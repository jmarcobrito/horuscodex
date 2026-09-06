# Horus Month Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execução nesta sessão, sem subagentes, conforme preferência já registrada do usuário.

**Goal:** Implementar o Painel da opção 1, orientando o RH à conferência mensal e diária sem alterar dados, regras ou permissões.

**Architecture:** Extrair o Overview para uma unidade de apresentação com projeções puras dos dados existentes. Navegação contextual explícita liga Painel a Lançamentos, Fechamento e Banco, preservando o período independente de cada aba na navegação normal. Estados de fechamento vêm de `buildClosingRows`; nenhuma função transacional é modificada.

**Tech Stack:** TypeScript, React 19, Next.js 16/Vinext, CSS existente, Node >=22.13.0, testes Node/Vite e ensaio de navegador com dados fictícios. Sem dependência nova.

**Spec:** `../specs/2026-09-05-horus-month-overview-design.md`, aprovada pelo usuário em 05/09/2026. Ler integralmente antes da execução.

## Global Constraints

- Nenhum SQL, migração, schema, RLS, grant, função transacional, credencial ou variável de ambiente alterado.
- Nenhum INSERT, UPDATE, DELETE, UPSERT, RPC de mutação, recálculo, importação ou limpeza de dados como parte desta entrega ou de seus testes reais.
- Nenhuma conversão de histórico, atribuição retroativa de setor ou criação automática de registro mensal. Agosto permanece como está.
- Somente dados já autorizados pela API atual; filtros de apresentação não ampliam permissões.
- Testes de escrita exclusivamente em fixtures/banco local fictício. Nunca fechar ou reabrir um mês real para validar a interface.
- Sem mudanças em edição diária, histórico imutável, aprovação, regras do banco de horas ou política mensal.
- Preservar fechamento individual e coletivo, revisão, confirmação, resultado por pessoa, tratamento de resultado incerto e proteção contra repetição.
- Preservar DEV na visão RH e DEV como colaborador somente para consulta. Colaborador comum não recebe Painel do RH.
- Sem push, PR, merge ou deploy nesta etapa documental. Publicação futura requer verificação e autorização específica; reversão somente do aplicativo.
- Nenhuma alteração em `db/`, `app/api/`, Supabase, arquivos de ambiente, configuração de deploy, `package.json` ou lockfile. Se necessária, parar e explicar a expansão.
- Linguagem natural em português. Ausência de lançamento não significa falta. Situação indisponível não significa zero. Banco atual não representa posição histórica do mês escolhido.
- Preservar a opção 1: `C:/Users/danyel/.codex/generated_images/01a05e3c-f25a-7182-ae03-4a9d592eaf05/exec-0ec5299b-b81f-412d-a953-92f21925d726.png`. Não copiar números fictícios como constantes do aplicativo.
- Não reinicializar o produto nem trocar o runtime. Reaproveitar fontes, marca, menu e perfis. Novos ícones, se necessários, somente arquivos oficiais licenciados; sem SVG manual, emoji ou biblioteca de pacote nova.

---

## Base, responsabilidades e verificação segura

Planejamento realizado no worktree `work/horuscodex/.worktrees/safer-month-closing`, HEAD `eb2e2a4`. Código funcional é o da Entrega A publicada pelo PR #5; commits posteriores são documentação. Worktree limpo na abertura deste planejamento. Não atualizar/resetar o checkout principal do usuário. Não criar um segundo aplicativo de demonstração desconectado do código real.

Não há grafo Graphify existente neste worktree, conforme inspeção anterior; confirmar na execução. Este plano usa relações conferidas no código e não inicia grafo/memória. Diagnósticos pequenos e contratos exatos foram lidos sem compressão; RTK é dispensável aqui. Escolher a solução direta, sem abstrações de consulta/backend novas.

| Unidade | Responsabilidade |
| --- | --- |
| `app/overview-model.ts` (novo) | Escopo de pessoas, projeção da tabela, contagens e banco filtrado, sem escrita |
| `app/overview-navigation.ts` (novo) | Descrever destinos de leitura a partir do mês/filtros/ação |
| `app/Overview.tsx` (novo) | Renderizar a opção 1 e emitir intenções, sem buscar/gravar dados |
| `app/ReviewScopeBanner.tsx` (novo) | Mostrar e limpar contexto recebido nas telas existentes |
| `app/HorusApp.tsx` | Integrar intenções aos workspaces existentes e preservar identidade/foco |
| `app/workspace-state.ts` | Horário de resposta aceita e proteção de concorrência existente |
| `app/PeriodPicker.tsx` | Variante compacta exclusiva do Painel, intervalo recolhível |
| `app/ClosingOverview.tsx` | Filtrar linhas visíveis e invalidar seleção ao trocar escopo |
| `app/HorusViews.tsx` | Manter views existentes; receber escopo em EntriesView/BalanceView |
| `app/globals.css` | Estilos limitados ao novo painel e controles contextuais |
| `tests/overview-*.test.mjs` (novos) | Modelos, navegação e HTML renderizado |
| `tests/browser/main.tsx`, `tests/helpers/workflow-server.ts` | Estados fictícios e contagem de chamadas para ensaio integrado |
| `docs/runbooks/2026-09-05-month-overview-validation.md` (novo na execução) | Evidências reais e limites da implementação |

Os comandos de teste abaixo são executados a partir da raiz do worktree, com imports Vite `{ configFile: false, envDir: false }`. Eles não iniciam o servidor real nem leem o banco. Builds e suíte completa devem usar `npm run verify:workflow`, que copia apenas arquivos rastreados permitidos e filtra o ambiente. Nunca executar `db:push`, `db:types` ou `history:baseline` nesta entrega. As contagens antigas de 209/39 testes são referências históricas, não aprovação deste plano.

## Tarefa 1 — projeção pura do Painel

**Files:** criar `app/overview-model.ts`, `tests/overview-model.test.mjs`; ler `app/dashboard-display.ts`, `app/dashboard-types.ts`, `app/closing-model.ts`, `app/entries-model.ts`, `tests/fixtures/monthly-workflow.mjs`.

**Interfaces:** exportar estes tipos/funções; demais tarefas devem importar os mesmos nomes.

```ts
export type ReviewScope = { personId: string | null; sectorId: string | null };
// sectorId null = todos; valor reservado "__unassigned__" = sem setor.
export type OverviewFilters = ReviewScope & { status: ClosingStatus | "all" };
export const defaultOverviewFilters: OverviewFilters = {
  personId: null, sectorId: null, status: "all",
};
export type OverviewRow = {
  person: DashboardContractor; days: number; workedMinutes: number;
  closing: ClosingRow | null;
};
export type OverviewModel = {
  fullMonth: boolean; rows: OverviewRow[];
  counts: Record<ClosingStatus, number> | null; totalPeople: number;
  pendingPeople: number | null;
  bank: { availableMinutes: number; reservedMinutes: number; debitMinutes: number };
  scopedData: DashboardData;
};
export function resolveReviewIds(data: DashboardData, scope: ReviewScope): Set<string>;
export function scopeDashboard(data: DashboardData, scope: ReviewScope): DashboardData;
export function normalizeOverviewFilters(data: DashboardData, filters: OverviewFilters):
  { filters: OverviewFilters; notice: string | null };
export function buildOverviewModel(data: DashboardData, filters: OverviewFilters): OverviewModel;
```

- [x] Escrever primeiro a suíte com `runnerImport` e teste de população/inativos/imobilidade:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
const load = async () => (await runnerImport("./app/overview-model.ts", {
  configFile: false, envDir: false,
})).module;
test("overview reuses closing states and preserves historical inactive people", async () => {
  const m = await load(), data = makeWorkflowDashboard(), before = structuredClone(data);
  const result = m.buildOverviewModel(data, m.defaultOverviewFilters);
  assert.equal(result.totalPeople, 3);
  assert.equal(result.counts.READY, 2);
  assert.equal(result.counts.NO_RECORD, 1);
  assert.equal(Object.values(result.counts).reduce((a, b) => a + b, 0), 3);
  assert.equal(result.rows.find(r => r.person.id === "person-2").person.status, "INACTIVE");
  assert.deepEqual(data, before);
});
test("partial periods never infer monthly readiness", async () => {
  const m = await load(), data = makeWorkflowDashboard();
  data.period = { from: "2026-08-03", to: "2026-08-05", year: null, month: null };
  const result = m.buildOverviewModel(data, { ...m.defaultOverviewFilters, status: "READY" });
  assert.equal(result.fullMonth, false);
  assert.equal(result.counts, null);
  assert.ok(result.rows.every(r => r.closing === null));
});
```

- [x] Rodar `node --test tests/overview-model.test.mjs`; registrar falha por módulo/contrato ainda ausente, não confundir falha de ambiente com teste vermelho funcional.
- [x] Implementar `resolveReviewIds` por interseção dos dois filtros em `data.contractors`, sem filtrar por ACTIVE. Núcleo:

```ts
const matchesSector = (person: DashboardContractor, sectorId: string | null) =>
  sectorId === null || (sectorId === "__unassigned__"
    ? person.sectorId === null : person.sectorId === sectorId);
const ids = new Set(data.contractors.filter(person =>
  (!scope.personId || person.id === scope.personId) && matchesSector(person, scope.sectorId)
).map(person => person.id));
```

- [x] Implementar `scopeDashboard` como cópia de apresentação: filtrar contractors por id e entries/monthlyTimesheets/requests/occurrences/authorizations/balanceLots/balanceTransactions por contractorId. Conservar `monthlyTimesheets: undefined` se ausente. Recalcular métricas usadas pelas views a partir do subconjunto: horas dos lançamentos, carga/estimativas somadas dos contractors, pendências das listas filtradas, débitos dos lotes DEBIT e créditos conforme `dashboardDisplay`. Não reutilizar totais de pessoas removidas. Resumo mensal: horas elegíveis dos lançamentos mais abonos dos registros mensais filtrados; estado único ou MIXED segundo registros disponíveis. Quando metadados mensais estiverem ausentes, as views devem mostrar indisponibilidade para os números dependentes, nunca exibir um zero auxiliar como valor apurado. Não colocar essa cópia no workspace, no cache principal, em `rhDashboard` ou em chamadas de gravação.
- [x] Implementar normalização: setor inexistente limpa setor; pessoa inexistente/incompatível limpa pessoa; juntar avisos naturais em uma mensagem; período parcial limpa somente status. Não limpar por situação sem linhas. Para `buildOverviewModel`, calcular `buildClosingRows(data)` apenas se `asFullMonth(data.period)` existir, depois filtrar seus ids por pessoa/setor; no intervalo usar ativos ou inativos com registro relevante no período (lançamento, registro mensal, ocorrência sobreposta ou autorização). Ordenar por nome e id para empate.
- [x] Construir contagens antes do filtro status; rows depois. Banco ignora status da tabela. Dias contam datas distintas; workedMinutes soma calculatedMinutes dos lançamentos filtrados; não depende da existência da folha. Usar `dashboardDisplay(scopedData)` para banco e contexto de intervalo.
- [ ] Acrescentar casos: todos os seis estados por alteração individual da fixture; metadata undefined versus []; folha duplicada; duas entradas no mesmo dia; carga zero; sector null; combinação incompatível; banco reservado/expirado/débito de outra pessoa; filtro status sem efeito no banco; dados e versões imutáveis após cada projeção. Verificar soma das contagens e valores do subconjunto, não apenas snapshots.
- [x] Rodar `node --test tests/overview-model.test.mjs tests/dashboard-display.test.mjs tests/closing-review.test.mjs`; revisar diff e fazer commit somente dos dois arquivos novos.

## Tarefa 2 — navegação contextual e horário confiável

**Files:** criar `app/overview-navigation.ts`, `tests/overview-navigation.test.mjs`; modificar `app/workspace-state.ts`, `tests/workspace-state.test.mjs`. Integração React fica na tarefa 5.

**Interfaces:** consumir `ReviewScope`/`OverviewFilters`; exportar:

```ts
export type OverviewIntent =
  | { kind: "closing" } | { kind: "pending" }
  | { kind: "person"; personId: string }
  | { kind: "daily" } | { kind: "balance" };
export type OverviewTarget = {
  section: "entries" | "closing" | "balance";
  period: DashboardPeriod; scope: ReviewScope;
  closingStatus: ClosingStatus | "all";
  entriesMode: "collaborator" | "day"; workDate: string;
};
export function overviewTarget(data: DashboardData, filters: OverviewFilters,
  intent: OverviewIntent): OverviewTarget;
```

- [x] Escrever teste e executar `node --test tests/overview-navigation.test.mjs` antes da função:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";
import { makeWorkflowDashboard } from "./fixtures/monthly-workflow.mjs";
test("explicit person navigation carries the selected month", async () => {
  const { module: n } = await runnerImport("./app/overview-navigation.ts", {
    configFile: false, envDir: false,
  });
  const data = makeWorkflowDashboard();
  const filters = { personId: null, sectorId: null, status: "all" };
  const target = n.overviewTarget(data, filters, { kind: "person", personId: "person-2" });
  assert.equal(target.section, "entries");
  assert.equal(target.entriesMode, "collaborator");
  assert.equal(target.scope.personId, "person-2");
  assert.deepEqual(target.period, data.period);
  assert.equal(target.workDate, "2026-08-01");
  data.period.to = "2026-09-15";
  assert.throws(() => n.overviewTarget(data, filters, { kind: "closing" }));
  assert.equal(n.overviewTarget(data, filters, { kind: "balance" }).period.to, "2026-09-15");
});
```

- [x] Implementar matriz sem I/O: closing → closing/status atual; pending → closing/PENDING; person → entries/collaborator/pessoa validada no escopo; daily → entries/day/primeiro dia do mês; balance → balance/mesmo período/pessoa e setor/sem status. Exceto balance, exigir `asFullMonth`, usando o mês normalizado em period. Pessoa ausente ou fora do escopo lança “Colaborador não disponível nesta consulta”. Não introduzir URL de API ou função de fechar neste módulo.
- [x] Adicionar `receivedAt?: string` somente à action success de workspace e `receivedAt: string | null` ao slot. Inicial/open/start/failure/invalidate deixam null. O reducer aceita horário só após validações atuais de requestId/período/approvalsScope. Recebido inválido vira null; não chamar relógio dentro do reducer. Código da atribuição depois dos guards:

```ts
const receivedAt = action.receivedAt && Number.isFinite(Date.parse(action.receivedAt))
  ? action.receivedAt : null;
return { ...state, [action.key]: { ...slot, data: action.data,
  loading: false, error: null, receivedAt } };
```

- [x] Acrescentar em `tests/workspace-state.test.mjs` dois starts no mesmo slot (requestId 10/11), success 10 com horário antigo e success 11 com horário novo; somente 11 pode definir data/receivedAt. Validar mismatch de período, falha e invalidate limpando horário; ação success antiga sem receivedAt continua compatível. Manter todos os testes existentes de independência das abas.
- [x] Cobrir pending, daily, balance, setor incompatível e imutabilidade em `overview-navigation.test.mjs`. Rodar `node --test tests/overview-navigation.test.mjs tests/workspace-state.test.mjs tests/period.test.mjs`. Revisar e commitar os quatro arquivos.

## Tarefa 3 — layout da opção 1 e seletor compacto

**Files:** criar `app/Overview.tsx`, `tests/overview-view.test.mjs`, `tests/period-picker-view.test.mjs`; modificar `app/PeriodPicker.tsx`, `app/globals.css`; acrescentar `public/icons/overview/` e licença apenas se usar ícones oficiais novos.

**Interfaces:** componente novo consome os tipos das tarefas 1/2; não depende de `HorusApp`:

```ts
export type OverviewProps = {
  data: DashboardData; filters: OverviewFilters; busy: boolean;
  receivedAt: string | null;
  onFiltersChange: (filters: OverviewFilters) => void;
  onPeriodChange: (period: DashboardPeriod) => void;
  onRefresh: () => void; onIntent: (intent: OverviewIntent) => void;
};
export function Overview(props: OverviewProps): React.ReactNode;
// PeriodPickerProps acrescenta variant?: "default" | "compact";
// default mantém o JSX/comportamento atual fora do Painel.
```

- [ ] Inspecionar a imagem escolhida com view_image antes de editar; usar Product Design image-to-code na execução, respeitando o produto existente. Medir referência real em vez de assumir que o gerador entregou 1440x1024. Não gerar novos layouts. Fontes já existem; manter marca/menu. Se usar ícones novos, resolver arquivos oficiais licenciados de uma única família com correspondência ao alvo, salvar somente os usados e licença, sem pacote novo.
- [x] Escrever testes renderizados com `createElement`/`renderToStaticMarkup` e runnerImport. Props de teste:

```js
const props = { data: makeWorkflowDashboard(),
  filters: { personId: null, sectorId: null, status: "all" },
  busy: false, receivedAt: null,
  onFiltersChange() {}, onPeriodChange() {}, onRefresh() {}, onIntent() {},
};
const html = renderToStaticMarkup(createElement(Overview, props));
assert.match(html, /Ir para fechamento/);
assert.match(html, /Conferir por dia/);
assert.match(html, /Situação indisponível/);
assert.match(html, /Banco de horas.*posição atual/s);
assert.doesNotMatch(html, /type="checkbox"|ana@example.com/);
```

Importar assert/test de node, React e runnerImport como nas suítes existentes. Acrescentar teste PeriodPicker default versus compact: default mantém formulário visível; compact inclui “Outro intervalo” e região recolhível identificada. Rodar os dois arquivos e observar falha antes da implementação.
- [x] Implementar variante compacta com `<details><summary>Outro intervalo</summary>` e RangePicker existente. Não aplicar formulário ao abrir/fechar; conservar busy, min/max e validação. Exemplo do novo ramo:

```tsx
{allowRange && (variant === "compact"
  ? <details className="overview-range"><summary>Outro intervalo</summary>
      <RangePicker key={value?.from + ":" + value?.to}
        value={value} busy={busy} onChange={onChange} />
    </details>
  : <><div className="period-divider" aria-hidden="true" />
      <RangePicker key={value?.from + ":" + value?.to}
        value={value} busy={busy} onChange={onChange} /></>)}
```

- [x] Renderizar cabeçalho/Painel, PeriodPicker compact, SelectMenu pessoa/setor, atualização. Formatar receivedAt no fuso recebido; null mostra “Consulta carregada”. Controles em carregamento desabilitados, nenhum novo fetch no Overview. Reusar labels de períodos existentes.
- [x] Renderizar seis botões de contagem com `aria-pressed`, nome incluindo estado/quantidade e onFiltersChange. Clique na situação ativa retorna all. Mostrar “Limpar filtro de situação”; counts não mudam com status. Botão principal emite `{kind:"closing"}`; aviso de PENDING emite `{kind:"pending"}`. Nunca chamar callback de gravação.
- [x] Renderizar cinco colunas da referência, nomes/setores sem email, todos os registros filtrados. “Conferir” emite person, ação da seção emite daily. Por linha, `<details>` mantém carga/estimativa, último trabalho/envio e indicadores de registro existentes; reutilizar formatação/fuso, não reimplementar cálculo. Manter aviso global de estimativa quando `estimatedRequiredPersonMonths > 0`, inclusive se a fonte histórica não possui contagem individual, sem atribuir estimativa a pessoa errada.
- [x] Renderizar faixa do banco com dados do modelo e ação balance. Intervalo parcial: sem seis números mensais, ações mensais desabilitadas e explicação/atalho com foco no seletor, horas/dias conhecidos visíveis; contexto mensal separado reutiliza lógica existente, metadata undefined explícita como indisponível.
- [x] CSS limitado a `.overview-*` e `.period-panel.overview-period`: tabela sem coluna de email; 5 colunas desktop; superfície clara, divisores leves; contagens com seis posições no desktop e quebra em telas estreitas; controles e linhas adaptam sem overflow da página. Body 14–16 px; foco contrastante; sem depender só de cores. Exemplo estrutural, ajustado à medição da imagem:

```css
.overview-statuses { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); }
.overview-bank { display:flex; flex-wrap:wrap; align-items:center; gap:24px; }
.overview-action:focus-visible { outline:3px solid var(--violet); outline-offset:3px; }
@media(max-width:900px) { .overview-statuses { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:580px) { .overview-statuses { grid-template-columns:repeat(2,minmax(0,1fr)); } }
```

- [ ] Acrescentar render tests: todos os estados, NO_RECORD com horas existentes, ausência de metadata, zero, filtro vazio, tabela sem truncar lista, inativo marcado, contexto parcial/estimado, botões disabled quando busy. Rodar `node --test tests/overview-view.test.mjs tests/period-picker-view.test.mjs`; commitar os arquivos desta tarefa. Comparação de navegador fica na tarefa 6, não classificar HTML estático como interação aprovada.

## Tarefa 4 — destinos filtrados sem seleção oculta

**Files:** criar `app/ReviewScopeBanner.tsx`, `tests/overview-scope.test.mjs`; modificar `app/ClosingOverview.tsx`, `app/HorusViews.tsx` (EntriesView e BalanceView), `tests/closing-review.test.mjs`, `tests/daily-entries.test.mjs` e estilos `.review-scope-*` em `app/globals.css`.

**Interfaces:** `ReviewScopeBanner({data,scope,onClear}: {data:DashboardData;scope:ReviewScope;onClear:()=>void})`; acrescentar props opcionais `reviewScope?: ReviewScope`, `onClearReviewScope?: () => void` a EntriesView/BalanceView/ClosingOverview; ClosingOverview também recebe `statusFilter?: ClosingStatus | "all"` e `scopeRevision?: number`.

- [x] Escrever testes estáticos de escopo antes das props: BalanceView com person-1 exclui lote/movimentação person-2 e recalcula débito; EntriesView diário inclui apenas pessoas do setor em registros e “sem lançamento”; ClosingOverview com scope person-1/status READY não renderiza person-2, nem checkbox de outra pessoa. Render helpers iguais aos usados na tarefa 3, importando as views e fixtures reais de testes. Rodar `node --test tests/overview-scope.test.mjs` para registrar o teste vermelho.
- [x] Implementar banner com pessoa/setor/mês e botão “Limpar filtros recebidos”. Sem informações identificáveis de quem não foi retornado pela API; filtro sem correspondência mostra vazio, não tudo. Após limpar, manter mês e devolver o escopo completo autorizado da tela.
- [x] EntriesView/BalanceView usam `scopeDashboard` somente na apresentação; objeto original continua com HorusApp. Quando monthlyTimesheets for undefined, resumo mensal/abonos dependentes exibem “Não disponível”, inclusive no escopo filtrado. Para pessoa inativa recebida explicitamente e presente no payload, mas fora de selectableContractors por só ter ocorrência/autorização, incluir essa pessoa na opção de consulta; não mudar sua elegibilidade de edição.
- [x] ClosingOverview calcula `allRows = buildClosingRows(data)` com dados originais, depois filtra por resolveReviewIds/status. Seleção guarda identidade do payload e chave de escopo:

```ts
const scopeKey = JSON.stringify([reviewScope?.personId ?? null,
  reviewScope?.sectorId ?? null, statusFilter ?? "all", scopeRevision ?? 0]);
const current = selection.data === data && selection.scopeKey === scopeKey
  ? selection : { data, scopeKey, ids: [], acknowledged: [] };
```

Atualizações de checkbox/ack/select-ready devem carregar scopeKey. “Selecionar prontos para revisar” usa somente rows visíveis READY. Antes de review, conferir `current.ids.every(id => visibleIds.has(id))`; falha bloqueia com mensagem “A seleção mudou. Confira as pessoas novamente.” Nunca filtrar silenciosamente um comando já montado. `makeClosingCommand(data.period, allRows, current.ids, current.acknowledged)` e confirmação transacional ficam intactos.
- [x] Repetir suites `node --test tests/overview-scope.test.mjs tests/closing-review.test.mjs tests/daily-entries.test.mjs tests/entries-flow.test.mjs tests/closing-client.test.mjs`. Acrescentar fixtures para NO_ENTRIES e UNKNOWN; não criar novos SQLs. Registrar interação de limpar seleção na tarefa 6, pois SSR não testa eventos. Revisar e commitar caminhos explícitos.

## Tarefa 5 — ligar o Painel aos workspaces existentes

**Files:** modificar `app/HorusApp.tsx`, `app/HorusViews.tsx`, `tests/required-estimates-view.test.mjs`, `tests/registration-view.test.mjs`, `tests/rendered-html.test.mjs`, `tests/developer-view-contract.test.mjs`, `tests/browser/main.tsx`; criar `tests/overview-integration.test.mjs`.

**Interfaces:** importar `Overview` diretamente de `app/Overview.tsx`; remover export do Overview antigo em HorusViews e atualizar todos os consumidores encontrados. Reusar `OverviewTarget` para contexto por workspace e `OverviewFilters` no Painel, sem introduzir contrato HTTP.

- [x] Procurar todos os consumidores com `rg -n 'Overview|RegistrationDelay|submissionLabel|MonthlyContext' app tests`; listar arquivos realmente encontrados. Não remover auxiliares usados por EntriesView. Atualizar testes de indicadores para a nova localização e props mantendo asserções semânticas de fuso/estimativa, não apagar testes para passar.
- [x] Acrescentar teste de contrato contra mutação e acesso usando renderização HorusApp com fixture e perfil PJ: Painel não aparece; DEV conserva seletor e modo somente leitura. Além do HTML, planejar no ensaio fictício a asserção dinâmica de chamadas (tarefa 6); não aceitar busca textual como prova única de zero escrita.
- [x] Guardar filtros por identidade RH/DEV-RH e contexto de destino por workspaceKey. Overview usa filtros normalizados de resposta aceita; aviso emitido uma única vez quando uma escolha realmente é removida. Não limpar filtros por resposta antiga. Recebimento de filtros de destino não modifica o Painel.
- [x] Passar `receivedAt: new Date().toISOString()` ao success somente após validações da resposta em loadWorkspace. Remover/limitar o efeito atual que limpa `entryContractorId` usando closure desatualizada: só pode afetar o workspace e a navegação ainda ativos. Resultados fora da identidade atual não alteram `rhDashboard`, filtros, pessoa ou foco.
- [x] Implementar navegação explícita, diferente de openSection comum. Sequência:

```ts
// overviewNavigationId é um useRef<number>(0).
const token = ++overviewNavigationId.current;
const target = overviewTarget(dashboard, overviewFilters, intent);
const key = workspaceKey("rh", target.section);
// Guardar target sob key, fechar modal, mostrar destino e iniciar somente GET.
const result = await loadWorkspace(key, target.period);
if (token !== overviewNavigationId.current) return;
// Aplicar pessoa/modo/dia e foco apenas se a identidade e a aba continuam iguais.
// Validar a pessoa no result.contractors, não somente na closure do clique.
```

Os comentários acima são sequência de integração, não funções novas: usar setters já existentes e adicionar estado `reviewContexts: Record<string, OverviewTarget>` e `scopeRevision` incremental por navegação contextual. Incrementar o token também em mudança normal de aba, mês ou identidade. `loadWorkspace` já dispara start que limpa conteúdo; não reaproveitar dados de mês diferente. Capturar falha sem reenvio automático; a tela mantém erro e “Tentar novamente”.
- [ ] Garantir que consulta contextual sempre configure o mês alvo mesmo quando destino já existia em outro mês; menu comum continua usando openSection/firstVisitPeriod. Foco no título da área após sucesso atual (`tabIndex=-1`), não após resposta obsoleta. Ao limpar escopo, limpar pessoa recebida e seleção/ack no fechamento, mas conservar período. Não manter seleção em retorno contextual ao mesmo mês (scopeRevision novo).
- [x] Integrar Overview com seu seletor compacto. Retirar PeriodPicker externo apenas quando o novo Overview está visível; em erro/carregamento manter um seletor utilizável no shell, sem duplicação e sem perder a recuperação. Entries/closing/requests conservam seletores próprios; Relatórios não recebe novo seletor.
- [x] Passar reviewScope às três views somente em RH; nunca em DEV/PJ ou PJ comum. Para person, iniciar `entryContractorId` com a pessoa alvo; daily usa o escopo recebido e primeiro dia; balance usa escopo e período de movimentações. Fechamento usa statusFilter e scopeRevision, mas callbacks de comando e confirmação continuam os existentes.
- [ ] Rodar `node --test tests/overview-*.test.mjs tests/workspace-state.test.mjs tests/developer-view-contract.test.mjs tests/required-estimates-view.test.mjs tests/registration-view.test.mjs tests/rendered-html.test.mjs tests/people-history-protection.test.mjs`. No Windows, se o wildcard não expandir, enumerar os arquivos com Get-ChildItem e passar os caminhos como array ao Node; não contar zero arquivos como sucesso. Revisar diff e commitar somente arquivos relacionados.

## Tarefa 6 — ensaio integrado, fidelidade e segurança

**Files:** criar `docs/runbooks/2026-09-05-month-overview-validation.md`, `design-qa.md`; modificar apenas fixtures/controles necessários em `tests/browser/main.tsx`, `tests/helpers/workflow-server.ts`, `tests/workflow-server.test.mjs`. Fonte de verificação: scripts isolados existentes, sem mudar suas proteções.

- [x] Antes de qualquer build, revisar `git status`, `git diff --check` e arquivos novos; rastrear somente arquivos permitidos para o executor isolado incluí-los. Não abrir `.env` nem executar o app conectado ao banco real.
- [ ] Preparar fixtures dedicadas aos seis estados, seleção de setor, pessoa sem setor, inativo com histórico, zero, metadata indisponível, muitos colaboradores e intervalo livre. Não alterar a semântica de fixtures antigas usadas por outros testes. Incluir contador de chamadas e comparação profunda de dados antes/depois no servidor fictício. Exemplo para o cenário de consultas:

```js
const before = server.fullSnapshot();
// No ensaio: filtrar, mudar mês, atualizar, Conferir, histórico, voltar e extrato.
// Comparar ao concluir usando a API de snapshot real do helper, conferida antes.
assert.deepEqual(server.fullSnapshot(), before);
assert.ok(server.calls.every(call => (call.method ?? "GET") === "GET"));
assert.equal(server.closingCalls.length, 0);
```

O helper já expõe `snapshot()` limitado a entries/versions e `calls` com `{method,path,body}`. Preservar esses contratos. Acrescentar `fullSnapshot()` à lista retornada, com implementação `() => structuredClone({ dashboards: [...dashboards.entries()], versions })`, cobrindo folhas, saldos, solicitações, cadastros e versões. Não incluir contadores/controles nesse snapshot. Agosto e setembro já existem no Map; limitar o cenário de comparação a esses meses e seus intervalos. Se acrescentar outro mês ao ensaio, preparar a fixture antes do snapshot, pois getMonth inicializa meses fictícios sob demanda. Comparação não pode excluir campos de negócio apenas para mascarar diferença. Fechamento fictício usa `closingCalls`, não necessariamente o transporte HTTP; exigir também que esse array continue vazio no ensaio de leitura.
- [ ] Rodar `npm run verify:workflow`: Vinext, todos os testes, lint, Next e TypeScript. Registrar diretório isolado/saída/contagens. Falha de download de fonte ou restrição Windows não é sucesso; seguir o fluxo de permissão específico sem desativar proteções.
- [ ] Para navegador, reutilizar a cópia isolada recém-validada com ambiente de `buildSafeEnv`, servindo `tests/browser/vite.config.ts`. Porta padrão 4175 pode estar ocupada pelo ensaio do usuário: inspecionar o processo antes, não encerrá-lo; usar uma porta livre explícita (ex.: 4178), `--strictPort`, mantendo CSP e WebSocket restritos ao localhost correspondente. Ajuste de porta/CSP apenas na cópia fictícia, sem acesso externo. Confirmar banner “TESTE LOCAL — dados fictícios; sem Supabase” antes de qualquer ação.
- [ ] Conferir com navegador: filtros combinados; mês/intervalo/retorno mensal; seis indicadores; detalhes recolhíveis; refresh/error/retry; agosto no Painel e setembro em Lançamentos antes do clique Conferir; destino passa a agosto/pessoa correta; voltar mantém Painel. Repetir com duas navegações/respostas fora de ordem, troca DEV/PJ durante consulta e pessoa ausente no retorno.
- [ ] Conferir daily com setor: registros e sem-lançamento do mesmo grupo; data dentro do mês; limpar contexto. Banco: totais e registros do mesmo escopo; situação mensal da tabela não restringe saldo. Logs somente GET e snapshot integral idêntico nesses cenários.
- [ ] Em fixtures separadas, selecionar pessoa no fechamento, trocar escopo e confirmar seleção vazia; selecionar prontos inclui apenas visíveis; sem registro/UNKNOWN não selecionáveis; NO_ENTRIES exige reconhecimento explícito. Fechar uma pessoa e equipe com revisão/confirmar existentes. Conferir resultados parcial/incerto sem repetição automática. Registrar os POST fictícios separadamente do ensaio de leitura.
- [x] Repetir PostgreSQL com executáveis já instalados: `node scripts/verify-closing-postgres.mjs --bin C:/Users/danyel/AppData/Local/Temp/horus-postgres-tests-bf4dfb1be39545bdb2635ed7a7d24bb1/pgsql/bin --candidate`. initdb, pg_ctl e psql foram localizados durante o planejamento; reconfirmar os três arquivos antes da execução. Se ausentes, parar só essa verificação e localizar a instalação registrada, sem instalar automaticamente. Nunca fornecer Supabase/PGDATA existente. O script deve criar cluster fictício novo e encerrá-lo; registrar os testes realmente executados.
- [ ] Ler skill Product Design design-qa, comparar alvo escolhido e captura do ensaio no mesmo viewport/estado. Avaliar desktop, 390px, zoom 200%, teclado/foco, rótulos, contraste e overflow. Não substituir QA por build ou screenshot solto. Registrar achados e corrigir P0/P1/P2 até `final result: passed`; se captura/comparação bloqueada, registrar `blocked` e não afirmar fidelidade aprovada. Limites P3 ficam explícitos.
- [ ] Revisão final: caminhos fora do escopo não mudaram; função `makeClosingCommand`, API e SQL intactos; DEV/PJ sem expansão de acesso; contexto parcial não virou fechamento; datas/carga/estimativas e relatórios/exportações preservados. Repetir verificações afetadas após qualquer correção.
- [ ] Preencher runbook com tabela cenário/resultado/evidência/limite, marcar somente tarefas concluídas neste plano e commitar documentação. Entregar preview local verificado. Não publicar automaticamente; apresentar resultado/diff e solicitar autorização de PR/release quando aplicável. Reversão futura é somente da versão do aplicativo.

## Revisão do plano e andamento

Cobertura da especificação: filtros/população/banco → tarefa 1; destinos/períodos/concorrência → tarefas 2/5; layout/intervalo/fidelidade → tarefas 3/6; seleção segura e escopo recebido → tarefa 4; RH/DEV/PJ → tarefas 5/6; preservação e regressões → todas, com provas integradas na tarefa 6. Reorganizações gerais de Fechamento e Relatórios e regras da Entrega C permanecem fora.

Contratos novos têm nomes/tipos definidos antes de uso; os nomes de callback das views existentes precisam ser preservados. Snippets são orientações de implementação futura e ainda não foram executados. Passos de código incluem núcleo concreto e testes; interfaces declaradas devem receber implementação na tarefa indicada. Plano não transforma os resultados antigos da Entrega A em aprovação do novo painel.

Estado atualizado em 05/09/2026: implementação local das tarefas 1–5 realizada, sem subagentes. Limpeza autorizada recuperou cerca de 4,82 GB. Na cópia isolada nova passaram Vinext, 223 testes, lint global e, após repetir a etapa de fontes com rede autorizada, Next e TypeScript. Tarefa 6 permanece em andamento: matriz interativa parcialmente concluída e QA visual bloqueado por fontes/densidade da captura. Não houve publicação nem acesso ao Supabase. Evidências e retomada em `../../runbooks/2026-09-05-month-overview-validation.md`.

Checkpoint anterior: 68 testes selecionados e 39 testes PostgreSQL em cluster fictício novo e encerrado. Retomada: 223 testes na suíte completa; navegador comprovou meses independentes, filtros, diário, preservação integral nas consultas, fechamento individual/coletivo em fixtures, retorno parcial/incerto e DEV somente leitura. Os itens compostos acima continuam desmarcados quando ainda têm cenários pendentes. `design-qa.md` registra `final result: blocked`; não considerar a interface aprovada visualmente. Fontes, histórico Git e previews anteriores preservados; código funcional desta retomada permanece `6278a00`.
