# Horus — Monthly Workflow Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execução nesta tarefa, sem subagentes, conforme a preferência expressa do usuário.

**Goal:** Corrigir a navegação mensal, a consulta/edição diária e a conferência do fechamento, demonstrando o fluxo completo com dados fictícios sem acessar ou modificar o Supabase de produção.

**Architecture:** Reutilizar o Horus existente. Um seletor controlado alimenta períodos independentes por tela/perfil; funções puras tratam seleção, respostas fora de ordem, filtros, histórico e conferência. A interface de fechamento recebe uma operação de teste explicitamente injetada; o caminho real permanece desativado até superar as condições de integração descritas ao final.

**Tech Stack:** React 19.2.6, TypeScript 5.9.3, Next 16.2.6/Vinext existente, Vite 8.0.13, `node:test`, `react-dom/server` e `runnerImport` já instalados. Não instalar bibliotecas de estado, datas, formulários ou testes nesta execução.

**Spec:** `docs/superpowers/specs/2026-09-03-horus-monthly-workflow-repair-design.md`, aprovada pelo usuário em 03/09/2026.

## Acompanhamento da execução local — 03/09/2026

- [x] Tarefa 1: transporte isolado e fixtures. Commit `33265e1`; testes de isolamento e DEV passaram.
- [x] Tarefa 2: componente controlado de período e calendário. Commit `8f155d6`; testes passaram.
- [x] Tarefa 3: períodos independentes e respostas antigas descartadas. Commit `6a6ea35`.
- [x] Tarefa 4: resumo por pessoa e edição diária. Commit `f75ca0d`.
- [x] Tarefa 5: histórico e foco dos diálogos. Commit `e02c5aa`, com ajuste de menu na verificação.
- [x] Tarefa 6: conferência e fechamento exclusivamente fictício. Commit `5f43956`.
- [x] Tarefa 7: ensaio no navegador e verificação final. Código `5d447c4`: 43 testes, lint, tipos e dois builds aprovados. Registros de entrega em `docs/runbooks/monthly-workflow-local-validation.md` e `docs/runbooks/monthly-workflow-release-gates.md`.

Antecipados os passos 7.1–7.3 para executar a base sem credenciais. O atalho para `node_modules` foi rejeitado pelo Turbopack; a montagem foi corrigida para copiar as dependências instaladas, sem instalar pacotes. Nenhuma alteração no Supabase ou publicação foi realizada. A base passou nos 21 testes e nos dois builds após corrigir a montagem e autorizar a busca de fontes públicas. A verificação final passou nos 43 testes, lint, tipos e builds Vinext/Next, em cópia sem credenciais.

A verificação acrescentou correções pontuais: manter resultado após clique duplo, conter o menu no diálogo, evitar saída sem período em Aprovações e rejeitar mensagens malformadas. As diferenças e os cenários efetivamente exercitados estão no registro de validação. Nenhuma condição de backend/produção foi marcada como liberada. Worktree e branch permanecem locais, sem merge, push ou publicação.

## Global Constraints

- Não gravar, corrigir, excluir, substituir, recriar, importar ou fechar dados reais durante desenvolvimento e testes.
- Preservar os lançamentos de agosto, suas versões anteriores e todo o histórico já existente.
- Não aplicar migrações nem alterar tabelas, funções, políticas, permissões ou configurações do Supabase nesta etapa.
- Não ativar `HORUS_MONTH_CLOSING_WRITE_ENABLED` em produção.
- Não fazer deploy, push ou abrir publicação automática sem autorização específica posterior.
- Usar dados fictícios em ambiente de teste isolado, sem credenciais nem chamadas ao Supabase de produção.
- Não mudar as permissões dos perfis RH, colaborador e DEV como efeito colateral de uma correção visual.
- Manter históricos de pessoas inativas consultáveis; inatividade não apaga nem oculta seus registros do período.
- Não adicionar bibliotecas, serviços, mapas persistentes ou dependências sem necessidade comprovada.
- Executar o trabalho nesta tarefa, sem subagentes, respeitando a preferência já dada pelo usuário.
- Usar português claro: “mês”, “colaborador”, “Editar este dia”, “Histórico deste dia” e “Fechar mês da equipe”.

## Escopo e ponto de parada

Este plano entrega código e demonstração LOCAL. Não entrega autorização para publicar nem para executar fechamento real. Não chamar `/api/dashboard` da produção: a auditoria identificou uma atualização de saldos nesse caminho de consulta.

Os impedimentos de backend não serão disfarçados por um botão habilitado. A confirmação funcionará no ensaio com dados fictícios. Sem operação de fechamento validada e fornecida pelo servidor, a aplicação continuará informando que a gravação está indisponível. Não apresentar esse resultado intermediário como fechamento de produção concluído.

A base de planejamento é `a36b88f` na cópia isolada `work/horuscodex/.worktrees/safer-month-closing`, branch `docs/monthly-workflow-repair`. Todos os caminhos abaixo são relativos a essa cópia. Antes da execução, conferir alterações locais e diferenças posteriores do repositório, preservando mudanças de terceiros. Não criar outra worktree dentro desta.

## Estrutura e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `tests/helpers/mock-request.mjs` | Transporte sem rede, com rotas fictícias explícitas e registro de chamadas. |
| `tests/fixtures/monthly-workflow.mjs` | Pessoas, meses, lançamentos e versões exclusivamente fictícios. |
| `app/period.ts` | Validar/construir mês e intervalo; serializar consulta; reconhecer mês completo. |
| `app/PeriodPicker.tsx` | Seletor controlado, reutilizado nas quatro telas. |
| `app/workspace-state.ts` | Estado por tela/perfil e rejeição de respostas antigas. |
| `app/entries-model.ts` | Filtro por pessoa e motivos de bloqueio da edição diária. |
| `db/monthly-timesheet-view.ts` | Projeção pura de registros mensais já existentes. |
| `app/EntryHistory.tsx` | Estados e comparação de versões de um dia. |
| `app/Modal.tsx` | Diálogo existente extraído, com foco e teclado corrigidos. |
| `app/closing-model.ts` | Classificação, pendências, alvos e normalização dos resultados de fechamento. |
| `app/ClosingConfirmation.tsx` | Revisão explícita e resultados, sem escolher como gravar no banco. |
| `tests/browser/` | Ensaio da aplicação real com transporte fictício, sem servidor Supabase. |
| `scripts/verify-workflow-isolated.mjs` | Executar as verificações existentes em cópia temporária sem configurações secretas. |

Arquivos existentes modificados: `app/HorusApp.tsx`, `app/HorusViews.tsx`, `app/ClosingOverview.tsx`, `app/dashboard-types.ts`, `app/globals.css`, `db/dashboard.ts`, testes afetados e `package.json` apenas para acrescentar o comando de ensaio/verificação. Não modificar migrações, autenticação, permissões, flags de fechamento ou rotas de gravação nesta etapa.

---

## Tarefa 1 — Tornar o ensaio incapaz de chamar produção

**Files:** Create `tests/helpers/mock-request.mjs`, `tests/mock-request.test.mjs`, `tests/fixtures/monthly-workflow.mjs`. Modify `app/HorusApp.tsx`.

**Interfaces:** `createMockRequest(routes)` retorna `{ request, calls }`. Cada rota recebe `(url: URL, init: RequestInit)` e retorna `Response | Promise<Response>`. Acrescentar ao `HorusApp` a prop opcional `request?: (path: string, init?: RequestInit) => Promise<Response>`, com padrão `fetch`; a página real não fornece essa prop. O transporte fictício nunca fica em `app/` ou `db/`.

- [x] **1.1 Escrever o teste antes da implementação.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockRequest } from './helpers/mock-request.mjs';

test('fixture transport rejects external URLs and unknown routes', async () => {
  const mock = createMockRequest({
    'GET /api/dashboard': () => Response.json({ fixture: true }),
  });
  assert.deepEqual(await (await mock.request('/api/dashboard?month=8')).json(), { fixture: true });
  await assert.rejects(mock.request('https://example.com/api/dashboard'));
  await assert.rejects(mock.request('/api/timesheets', { method: 'POST' }));
  assert.equal(mock.calls.length, 1);
});
```

- [x] **1.2 Executar `node --test tests/mock-request.test.mjs`.** Deve falhar pela ausência do módulo, não por acesso à rede.
- [x] **1.3 Implementar o transporte e substituir todas as chamadas `fetch` internas de HorusApp por `request`.** Não alterar autenticação ou endpoints.

```js
export function createMockRequest(routes) {
  const calls = [];
  async function request(path, init = {}) {
    if (typeof path !== 'string' || !path.startsWith('/api/')) {
      throw new Error('Endereço externo proibido no ensaio');
    }
    const url = new URL(path, 'https://horus.invalid');
    const method = (init.method || 'GET').toUpperCase();
    const route = routes[`${method} ${url.pathname}`];
    if (!route) throw new Error(`Rota não simulada: ${method} ${url.pathname}`);
    calls.push({ method, path, body: init.body ?? null });
    return route(url, init);
  }
  return { request, calls };
}
```

No componente, manter o tipo explícito e o padrão real; não adicionar um parâmetro de URL ou variável pública que habilite simulação:

```ts
type WorkflowRequest = (path: string, init?: RequestInit) => Promise<Response>;
// Acrescentar request?: WorkflowRequest às props e request = fetch ao destructuring.
// Toda leitura ou mutação já existente no componente chama essa mesma prop.
```

Criar `makeWorkflowDashboard(year = 2026, month = 8)` a partir de `makeDashboard()` existente. A função retorna uma cópia nova em cada chamada, com:

| Pessoa fictícia | Cadastro | Agosto | Setembro |
| --- | --- | --- | --- |
| `person-1`, Ana Exemplo | Ativo | 480 minutos, dia 03 | 360 minutos, dia 03 |
| `person-2`, Bruno Teste | Inativo | 300 minutos, dia 04 | Sem lançamento |
| `person-3`, Carla Teste | Ativo | Sem registro mensal | Sem registro mensal |

Usar carga fictícia de 480 minutos por pessoa/mês, registros `entry-1` e `entry-2`, datas ISO do mês pedido e e-mails `@example.com`. Calcular os totais da fixture a partir das entradas; não copiar os registros reais. Inicialmente, meses existentes são OPEN; os testes de fechamento criam cópias CLOSED, vazias e pendentes. Exportar também `makeHistoryVersion()` com entrada `08:00 → 17:00`, intervalo anterior 60 e posterior 90, observação anterior `Original` e posterior `Corrigida`, autor `person-1` e justificativa `Ajuste de intervalo`.

```js
import { makeDashboard } from './dashboard.mjs';
/** @returns {import('../../app/dashboard-types').DashboardData} */
export function makeWorkflowDashboard(year = 2026, month = 8) {
  const data = makeDashboard();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  data.period = { from: `${prefix}-01`, to: `${prefix}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`, year, month };
  data.policy.monthlyRequiredMinutes = 480;
  const people = [
    ['person-1', 'Ana Exemplo', 'ACTIVE', month === 8 ? 480 : month === 9 ? 360 : 0, '03'],
    ['person-2', 'Bruno Teste', 'INACTIVE', month === 8 ? 300 : 0, '04'],
    ['person-3', 'Carla Teste', 'ACTIVE', 0, '05'],
  ];
  const template = data.contractors[0];
  data.contractors = people.map(([id, name, status, minutes, day]) => ({
    ...template, id, name, status, email: `${id}@example.com`,
    initials: name.split(' ').map(part => part[0]).join(''),
    workedMinutes: minutes, consideredMinutes: minutes, requiredMinutes: 480,
    fillPercentage: Math.round(minutes / 480 * 100),
    lastEntryDate: minutes ? `${prefix}-${day}` : null,
    lastEntryAt: minutes ? `${prefix}-${day}T18:00:00Z` : null,
  }));
  data.entries = people.filter(person => person[3] > 0).map(([id, name, , minutes, day]) => ({
    id: id === 'person-1' ? 'entry-1' : 'entry-2', contractorId: id, contractorName: name,
    workDate: `${prefix}-${day}`, startTime: '08:00',
    endTime: minutes === 480 ? '17:00' : minutes === 360 ? '15:00' : '14:00',
    breakMinutes: 60, calculatedMinutes: minutes, eligibleMinutes: minutes,
    nonBusinessDayStatus: 'NOT_APPLICABLE', notes: 'Registro fictício',
    createdAt: `${prefix}-${day}T18:00:00Z`, updatedAt: `${prefix}-${day}T18:00:00Z`,
  }));
  const workedMinutes = data.entries.reduce((sum, entry) => sum + entry.calculatedMinutes, 0);
  const requiredMinutes = 480 * (2 + (month === 8 ? 1 : 0));
  data.metrics = { ...data.metrics, activeContractors: 2, workedMinutes, requiredMinutes };
  data.timesheet = { ...data.timesheet, workedMinutes, consideredMinutes: workedMinutes, requiredMinutes, projectedBalanceMinutes: workedMinutes - requiredMinutes };
  return data;
}
export function makeHistoryVersion() {
  const previous = { start_time: '08:00', end_time: '17:00', break_minutes: 60, calculated_minutes: 480, notes: 'Original' };
  return {
    id: 'version-1', version_number: 2, previous_data: previous,
    new_data: { ...previous, break_minutes: 90, calculated_minutes: 450, notes: 'Corrigida' },
    changed_by: 'person-1', change_reason: 'Ajuste de intervalo', changed_at: '2026-08-05T18:00:00Z',
  };
}
```

- [x] **1.4 Reexecutar o teste e os testes DEV existentes.** Verificar que o comportamento padrão continua usando os endpoints existentes e que não há importação de fixtures pela página real.
- [x] **1.5 Commit local:** `test: isolate monthly workflow requests from production`. Incluir somente arquivos desta tarefa; não fazer push.

## Tarefa 2 — Um seletor de período que possa ser usado em qualquer tela

**Files:** Create `app/period.ts`, `app/PeriodPicker.tsx`, `tests/period.test.mjs`. Modify `app/globals.css` apenas para estados responsivos/foco desse controle.

**Interfaces:**

```ts
import type { DashboardPeriod } from './dashboard-types';
export function monthPeriod(year: number, month: number): DashboardPeriod;
export function parseMonthValue(value: string): DashboardPeriod | null;
export function asFullMonth(period: DashboardPeriod): DashboardPeriod | null;
export function shiftMonth(period: DashboardPeriod, offset: number): DashboardPeriod | null;
export function periodQuery(period: DashboardPeriod): string;
export function samePeriod(a: DashboardPeriod, b: DashboardPeriod): boolean;
export type PeriodPickerProps = {
  value: DashboardPeriod | null;
  busy: boolean;
  allowRange: boolean;
  onChange: (period: DashboardPeriod) => void;
};
```

- [x] **2.1 Escrever testes de calendário e controle renderizado.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { runnerImport } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('month navigation crosses years and recognizes full ranges', async () => {
  const { module: p } = await runnerImport('./app/period.ts', { configFile: false, envDir: false });
  assert.equal(p.monthPeriod(2028, 2).to, '2028-02-29');
  assert.deepEqual(p.shiftMonth(p.monthPeriod(2026, 12), 1), p.monthPeriod(2027, 1));
  assert.equal(p.parseMonthValue('2026-13'), null);
  assert.equal(p.asFullMonth({ from: '2026-08-10', to: '2026-09-10', year: null, month: null }), null);
  assert.deepEqual(p.asFullMonth({ from: '2026-08-01', to: '2026-08-31', year: null, month: null }), p.monthPeriod(2026, 8));
});

test('month selection is explicit and accessible', async () => {
  const { module: v } = await runnerImport('./app/PeriodPicker.tsx', { configFile: false, envDir: false });
  const html = renderToStaticMarkup(createElement(v.PeriodPicker, {
    value: null, busy: false, allowRange: false, onChange() {},
  }));
  assert.match(html, /Escolha o mês/);
  assert.match(html, /type="month"/);
  assert.match(html, /Mês de consulta/);
});
```

- [x] **2.2 Executar `node --test tests/period.test.mjs` e observar as falhas.**
- [x] **2.3 Implementar as funções puras e o controle.** Limites iguais ao servidor: ano 2000–2200, mês 1–12. Validar datas por calendário, não apenas expressão regular. Não importar `db/dashboard.ts` para o navegador.

```ts
export function monthPeriod(year: number, month: number): DashboardPeriod {
  if (!Number.isInteger(year) || year < 2000 || year > 2200 ||
      !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Mês inválido');
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}`, year, month };
}
export function parseMonthValue(value: string): DashboardPeriod | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  try { return monthPeriod(year, month); } catch { return null; }
}
```

`asFullMonth` compara `from` e `to` com o mês reconstruído a partir de `from`; `shiftMonth` retorna null para intervalo parcial ou limite excedido; `samePeriod` compara `from`/`to`. `periodQuery` usa `year/month` para mês completo e `from/to` para intervalo válido. Intervalo inválido deve ser rejeitado, nunca normalizado para o mês atual.

O controle usa `<input type="month" aria-label="Mês de consulta">`, valor derivado exclusivamente da prop e setas com os nomes acessíveis existentes. Ao escolher um mês válido, chama `onChange` sem salvar preferência em banco. Em `allowRange`, renderiza um formulário separado com “Data inicial”, “Data final” e “Aplicar intervalo”; sincroniza os rascunhos quando `value` mudar. Bloqueia envio com datas inválidas/invertidas, mas preserva o texto para correção. Não manter um segundo mês interno que possa divergir da prop.

- [x] **2.4 Executar os testes e acrescentar limites 2000/2200, dezembro/janeiro, intervalo inválido e erro de consulta no ensaio da tarefa 7.**
- [x] **2.5 Commit local:** `feat: add controlled monthly period selection`.

## Tarefa 3 — Períodos independentes, sem mistura de respostas ou perfis

**Files:** Create `app/workspace-state.ts`, `tests/workspace-state.test.mjs`. Modify `app/HorusApp.tsx`, `app/HorusViews.tsx`, `tests/rendered-html.test.mjs`.

**Interfaces:**

```ts
type WorkspaceKey = string;
type WorkspaceSlot = {
  period: DashboardPeriod | null;
  data: DashboardData | null;
  requestId: number;
  loading: boolean;
  error: string | null;
};
export type WorkspaceState = Record<WorkspaceKey, WorkspaceSlot>;
export type WorkspaceAction =
  | { type: 'open'; key: string; period: DashboardPeriod | null }
  | { type: 'start'; key: string; period: DashboardPeriod; requestId: number }
  | { type: 'success'; key: string; requestId: number; data: DashboardData }
  | { type: 'failure'; key: string; requestId: number; message: string }
  | { type: 'invalidate' };
export function workspaceKey(role: 'rh' | 'pj', section: Section, viewAsId?: string): string;
export function initialWorkspace(key: string, data: DashboardData): WorkspaceState;
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState;
```

Importar `DashboardPeriod`/`DashboardData` de `dashboard-types` e `Section` como type de `HorusViews`; não criar dependência runtime circular.

- [x] **3.1 Escrever a regressão de navegação e resposta atrasada.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { runnerImport } from 'vite';
import { makeWorkflowDashboard } from './fixtures/monthly-workflow.mjs';

test('tabs keep independent months and reject old responses', async () => {
  const { module: w } = await runnerImport('./app/workspace-state.ts', { configFile: false, envDir: false });
  const august = makeWorkflowDashboard(2026, 8);
  const september = makeWorkflowDashboard(2026, 9);
  let state = w.initialWorkspace('rh:self:overview', august);
  state = w.workspaceReducer(state, { type: 'open', key: 'rh:self:entries', period: august.period });
  state = w.workspaceReducer(state, { type: 'start', key: 'rh:self:entries', period: august.period, requestId: 1 });
  state = w.workspaceReducer(state, { type: 'start', key: 'rh:self:entries', period: september.period, requestId: 2 });
  state = w.workspaceReducer(state, { type: 'success', key: 'rh:self:entries', requestId: 1, data: august });
  assert.equal(state['rh:self:entries'].data, null);
  state = w.workspaceReducer(state, { type: 'success', key: 'rh:self:entries', requestId: 2, data: september });
  assert.equal(state['rh:self:entries'].data.period.month, 9);
  assert.equal(state['rh:self:overview'].period.month, 8);
  assert.notEqual(w.workspaceKey('pj', 'entries', 'person-1'), w.workspaceKey('pj', 'entries', 'person-2'));
});
```

- [x] **3.2 Executar `node --test tests/workspace-state.test.mjs`, esperando falha.**
- [x] **3.3 Implementar reducer e integração.**

```ts
export function workspaceKey(role: 'rh' | 'pj', section: Section, viewAsId = '') {
  return `${role}:${viewAsId || 'self'}:${section}`;
}
// No reducer, esta condição precede success/failure:
if ((action.type === 'success' || action.type === 'failure') &&
    state[action.key]?.requestId !== action.requestId) return state;
```

Regras exatas do reducer: `open` não sobrescreve uma tela já visitada; cria slot sem dados para tela nova. `start` guarda o período novo, limpa dados/erro e marca loading. `success` só aceita resposta do requestId atual com `samePeriod(slot.period, data.period)`; inconsistência de período vira erro e não publica dados. `failure` termina loading e mantém dados nulos. `invalidate` preserva escolhas e limpa dados de todos os slots, tornando requestIds anteriores inválidos: usar `requestId: -1`, `loading: false` e `error: null`; requests reais sempre usam IDs positivos crescentes.

Separar `fetchDashboard` em leitura que retorna dados e orquestração que despacha ações. Capturar key, query, viewAs e requestId antes do await. Um contador em ref gera requestId único; respostas não escrevem diretamente no dashboard de outra tela. `initialWorkspace` semeia somente a tela inicial com o dashboard recebido do servidor.

Renderizar `PeriodPicker` uma vez no contêiner de conteúdo para overview/entries/closing/reports. Remover o seletor interno e seus estados de `Overview`. A própria tela recebe apenas os dados de seu slot. Em tela mensal, herdar `asFullMonth` na primeira abertura; se null, mostrar seletor e instrução sem tabela vazia. Pessoas, Banco e Administração não ganham controles mensais novos; manter os dados de apoio que já usam sem emprestar uma resposta PJ à visão RH.

Atualizar `switchToRh`, `switchToContractor`, `refreshDashboard`, `adminMutate` e os consumidores do antigo `dashboardQuery`. A lista de pessoas para a seleção DEV é mantida separadamente com dados autorizados da visão RH; não é um dashboard PJ. Fechar diálogos ao trocar perfil. Bloquear troca de perfil durante gravação já iniciada.

Substituir em `tests/rendered-html.test.mjs` somente os asserts ligados à posição antiga do seletor (`moveMonth`, setas e intervalo dentro de HorusViews) pelos testes de controle/renderização e navegação. Preservar os testes de autenticação, justificativa, histórico e ausência de exclusão.

- [x] **3.4 Testar reducer, controles e navegação DEV.** Acrescentar resposta com mês errado, erro, invalidação durante request, retorno à aba, primeira entrada por intervalo e isolamento de duas pessoas simuladas.
- [x] **3.5 Commit local:** `fix: isolate monthly workspace state and stale responses`.

## Tarefa 4 — Resumo por pessoa e edição de um único dia

**Files:** Create `app/entries-model.ts`, `db/monthly-timesheet-view.ts`, `tests/entries-flow.test.mjs`, `tests/monthly-timesheet-view.test.mjs`. Modify `app/dashboard-types.ts`, `db/dashboard.ts`, `app/HorusApp.tsx`, `app/HorusViews.tsx`, `tests/fixtures/monthly-workflow.mjs` e os testes renderizados afetados.

**Interfaces:** Acrescentar uma projeção das linhas mensais, sem criar ou alterar colunas. `monthlyTimesheets` é opcional para reconhecer uma resposta antiga: ausência do campo significa informação indisponível, não lista vazia.

```ts
// app/dashboard-types.ts
export type DashboardMonthlyTimesheet = {
  id: string; contractorId: string; year: number; month: number;
  status: 'OPEN' | 'CLOSED' | 'REOPENED';
  workedMinutes: number; creditedMinutes: number;
  consideredMinutes: number; requiredMinutes: number;
  closedAt: string | null; closedByName: string | null;
};
// Acrescentar em DashboardData: monthlyTimesheets?: DashboardMonthlyTimesheet[];

// db/monthly-timesheet-view.ts — não importa Supabase.
export type MonthlyTimesheetRow = {
  id: string; contractor_id: string; year: number; month: number;
  status: 'OPEN' | 'CLOSED' | 'REOPENED';
  worked_minutes: number; credited_minutes: number;
  considered_minutes: number; required_minutes: number;
  closed_at: string | null; closed_by: string | null;
};
export function projectMonthlyTimesheet(
  row: MonthlyTimesheetRow, names: ReadonlyMap<string, string>
): DashboardMonthlyTimesheet;

// app/entries-model.ts
export type EntriesSelection = {
  entries: DashboardEntry[];
  summary: DashboardData['timesheet'];
  title: string;
};
export function selectEntries(data: DashboardData, contractorId: string | null): EntriesSelection;
export function entryEditBlockReason(data: DashboardData, entry: DashboardEntry, readOnly: boolean): string | null;
export function saveThenRefresh(save: () => Promise<void>, refresh: () => Promise<void>): Promise<'saved' | 'saved-refresh-failed'>;
```

- [x] **4.1 Escrever os testes de filtro, estado individual e confirmação de salvamento.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { runnerImport } from 'vite';
import { makeWorkflowDashboard } from './fixtures/monthly-workflow.mjs';

test('person summary and list share scope, including inactive history', async () => {
  const { module: e } = await runnerImport('./app/entries-model.ts', { configFile: false, envDir: false });
  const data = makeWorkflowDashboard();
  const filtered = e.selectEntries(data, 'person-2');
  assert.equal(filtered.entries.length, 1);
  assert.equal(filtered.entries[0].contractorId, 'person-2');
  assert.equal(filtered.summary.workedMinutes, 300);
  assert.equal(filtered.title, 'Resumo de Bruno Teste');
  assert.equal(e.selectEntries(data, null).summary.workedMinutes, 780);
  assert.throws(() => e.selectEntries(data, 'unavailable-person'));
});

test('closed person is blocked independently of the aggregate status', async () => {
  const { module: e } = await runnerImport('./app/entries-model.ts', { configFile: false, envDir: false });
  const data = makeWorkflowDashboard();
  data.timesheet.status = 'MIXED';
  const entry = data.entries.find(item => item.id === 'entry-1');
  assert.equal(e.entryEditBlockReason(data, entry, false), null);
  data.monthlyTimesheets.find(item => item.contractorId === 'person-1').status = 'CLOSED';
  assert.match(e.entryEditBlockReason(data, entry, false), /fechado/i);
  assert.match(e.entryEditBlockReason(data, entry, true), /consulta/i);
});

test('refresh failure never invites a second save of an already saved day', async () => {
  const { module: e } = await runnerImport('./app/entries-model.ts', { configFile: false, envDir: false });
  let saves = 0;
  const result = await e.saveThenRefresh(async () => { saves += 1; }, async () => { throw Error('offline'); });
  assert.equal(result, 'saved-refresh-failed');
  assert.equal(saves, 1);
  await assert.rejects(e.saveThenRefresh(async () => { throw Error('save denied'); }, async () => {}));
});
```

- [x] **4.2 Executar `node --test tests/entries-flow.test.mjs tests/monthly-timesheet-view.test.mjs`.** Esperar falhas pelas funções novas; não carregar `db/dashboard.ts` nos testes da projeção.

Conteúdo inicial de `tests/monthly-timesheet-view.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { runnerImport } from 'vite';
test('monthly projection preserves source and never guesses closer identity', async () => {
  const { module: m } = await runnerImport('./db/monthly-timesheet-view.ts', { configFile: false, envDir: false });
  const row = { id: 'month-1', contractor_id: 'person-1', year: 2026, month: 8, status: 'CLOSED', worked_minutes: 480, credited_minutes: 30, considered_minutes: 510, required_minutes: 480, closed_at: '2026-09-01T12:00:00Z', closed_by: 'rh-test' };
  const before = structuredClone(row);
  assert.equal(m.projectMonthlyTimesheet(row, new Map([['rh-test', 'RH Exemplo']])).closedByName, 'RH Exemplo');
  assert.equal(m.projectMonthlyTimesheet(row, new Map()).closedByName, null);
  assert.deepEqual(row, before);
});
```
- [x] **4.3 Implementar a projeção, atualizar o tipo local da consulta existente e as fixtures.**

```ts
export function projectMonthlyTimesheet(row: MonthlyTimesheetRow, names: ReadonlyMap<string, string>): DashboardMonthlyTimesheet {
  return {
    id: row.id, contractorId: row.contractor_id, year: row.year, month: row.month,
    status: row.status, workedMinutes: row.worked_minutes, creditedMinutes: row.credited_minutes,
    consideredMinutes: row.considered_minutes, requiredMinutes: row.required_minutes,
    closedAt: row.closed_at, closedByName: row.closed_by ? names.get(row.closed_by) ?? null : null,
  };
}
```

Em `db/dashboard.ts`, substituir o tipo privado `TimesheetRow` pelo import type `MonthlyTimesheetRow` e ampliar o SELECT existente para `id,contractor_id,year,month,required_minutes,credited_minutes,worked_minutes,considered_minutes,status,closed_at,closed_by`. No retorno, acrescentar `monthlyTimesheets: timesheets.map(row => projectMonthlyTimesheet(row, names))`. Preservar os filtros por organização/pessoa e os cálculos existentes. As colunas constam nas migrações versionadas; se o código atualizado contradisser o contrato, parar essa integração, sem aplicar SQL. Não executar essa consulta em produção nem alterar `refresh_hour_balance_statuses` aqui.

Teste da projeção: entrada `id: 'month-1'`, pessoa `person-1`, agosto/2026, CLOSED, 480 trabalhados, 30 abonados, 510 considerados, 480 exigidos, `closed_at: '2026-09-01T12:00:00Z'`, `closed_by: 'rh-test'`. Esperar `closedByName: 'RH Exemplo'` com `new Map([['rh-test', 'RH Exemplo']])`; mapa vazio retorna null e nunca o nome do usuário atual. Repetir com OPEN e datas/responsável nulos. Conferir deepEqual da entrada antes/depois para provar ausência de mutação no helper.

Acrescentar às fixtures `monthlyTimesheets` de Ana nos dois meses e de Bruno em agosto, com `id: month-person-N-YYYY-MM`, totais correspondentes aos dias, crédito zero, exigência 480, OPEN, datas/responsáveis nulos. Carla continua sem linha. Não gerar mês para uma pessoa somente para fazê-la parecer “aberta”.

- [x] **4.4 Implementar filtro e bloqueios locais da edição.**

```ts
export async function saveThenRefresh(save: () => Promise<void>, refresh: () => Promise<void>) {
  await save();
  try { await refresh(); return 'saved' as const; }
  catch { return 'saved-refresh-failed' as const; }
}
```

`selectEntries(data, null)` retorna entradas do mês, resumo atual da equipe e título “Resumo da equipe”. Para ID explícito, exigir pessoa presente no payload; filtrar entradas por ID e data dentro de `data.period`. Somar minutos dessas entradas e créditos das linhas mensais dessa pessoa. Carga exigida vem da mesma pessoa no payload, sem recalcular política. Projetar saldo como considerados menos exigidos e situação a partir das linhas correspondentes. Se a projeção mensal estiver ausente, o resumo ainda pode usar os totais já fornecidos da pessoa, mas nenhuma ação dependente do fechamento deduz estado com segurança. Nunca retornar o resumo da equipe como fallback de ID inexistente.

Usar `SelectMenu` já existente com “Toda a equipe”, ativos e inativos com registros relevantes. Guardar seleção por contexto RH; ao trocar mês e perder a pessoa disponível, limpar filtro e informar “O filtro de colaborador foi removido porque essa pessoa não está disponível neste mês”. Não adicionar seletor de outras pessoas ao colaborador real ou simulado.

`entryEditBlockReason` verifica, nesta ordem: simulação DEV somente consulta; pessoa inexistente; pessoa INACTIVE (mesma regra de `save_time_entry`); projeção mensal indisponível; nenhuma/mais de uma linha da pessoa no ano/mês de `entry.workDate`; linha CLOSED. Retorna texto específico para cada motivo; OPEN/REOPENED válido retorna null. Esse bloqueio visual não substitui as regras do servidor e não muda permissões.

As ações por linha ficam “Editar este dia” e “Histórico deste dia”, com data/pessoa no nome acessível. O diálogo identifica o dia, mantém pessoa/data desabilitadas e informa “Esta alteração corrige somente este dia”. Preservar entrada, saída, intervalo, observação e justificativa obrigatória do RH. Não adicionar exclusão nem edição coletiva.

No `mutate`, separar confirmação do POST e atualização da consulta usando `saveThenRefresh`. Depois de resposta de gravação válida, fechar o formulário, invalidar slots anteriores e impedir reenvio. Se só a atualização falhar, informar “Salvo. Não foi possível atualizar o resumo; tente atualizar a consulta”, com ação que refaz apenas GET. Se o POST falhar ou a resposta não confirmar salvamento, não afirmar sucesso. Resultado incerto de rede exige consulta antes de nova tentativa; não repetir automaticamente POST.

- [x] **4.5 Reexecutar testes novos e contratos de edição/DEV.** Acrescentar um caso de pessoa ativa com mês aberto ao lado de outra fechada; ausência do campo mensal; mês sem linha; pessoa inativa consultável; justificativa e pessoa/data imutáveis no corpo da gravação fictícia. Alterar só expectativas renderizadas afetadas por rótulos, preservando proteções existentes.
- [x] **4.6 Commit local:** `fix: scope daily entry actions and summaries to the selected person`.

## Tarefa 5 — Histórico verdadeiro e diálogos utilizáveis por teclado

**Files:** Create `app/EntryHistory.tsx`, `app/Modal.tsx`, `tests/entry-history.test.mjs`. Modify `app/HorusApp.tsx`, `app/globals.css`, `tests/rendered-html.test.mjs`.

**Interfaces:**

```ts
export type HistoryVersion = {
  id: string; version_number: number;
  previous_data: Record<string, unknown>; new_data: Record<string, unknown>;
  changed_by: string; change_reason: string | null; changed_at: string;
};
export type HistoryState =
  | { status: 'loading'; entryId: string }
  | { status: 'error'; entryId: string; message: string }
  | { status: 'ready'; entryId: string; versions: HistoryVersion[] };
export function historyFields(version: HistoryVersion): Array<{ label: string; before: string; after: string }>;
export function EntryHistory(props: {
  state: HistoryState; names: ReadonlyMap<string, string>; onRetry: () => void;
}): React.ReactNode;
export function Modal(props: {
  title: string; eyebrow: string; description: string;
  onClose: () => void; children: React.ReactNode; busy?: boolean;
}): React.ReactNode;
```

- [x] **5.1 Escrever testes que separem carregamento, falha e vazio verdadeiro.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runnerImport } from 'vite';
import { makeHistoryVersion } from './fixtures/monthly-workflow.mjs';

test('history never reports empty while loading or failed', async () => {
  const { module: h } = await runnerImport('./app/EntryHistory.tsx', { configFile: false, envDir: false });
  const render = state => renderToStaticMarkup(createElement(h.EntryHistory, { state, names: new Map(), onRetry() {} }));
  const loading = render({ status: 'loading', entryId: 'entry-1' });
  assert.match(loading, /Carregando histórico deste dia/);
  assert.doesNotMatch(loading, /ainda não teve alterações|versão original/);
  const failed = render({ status: 'error', entryId: 'entry-1', message: 'Falha de teste' });
  assert.match(failed, /Não foi possível carregar o histórico/);
  assert.match(failed, /Tentar novamente/);
  assert.doesNotMatch(failed, /ainda não teve alterações|versão original/);
  assert.match(render({ status: 'ready', entryId: 'entry-1', versions: [] }), /Este dia ainda não teve alterações/);
});

test('history compares changed break and notes without guessing the author', async () => {
  const { module: h } = await runnerImport('./app/EntryHistory.tsx', { configFile: false, envDir: false });
  const version = makeHistoryVersion();
  version.change_reason = null;
  const fields = h.historyFields(version);
  assert.deepEqual(fields.find(item => item.label === 'Intervalo'), { label: 'Intervalo', before: '60 min', after: '90 min' });
  assert.deepEqual(fields.find(item => item.label === 'Observação'), { label: 'Observação', before: 'Original', after: 'Corrigida' });
  const html = renderToStaticMarkup(createElement(h.EntryHistory, {
    state: { status: 'ready', entryId: 'entry-1', versions: [version] }, names: new Map(), onRetry() {},
  }));
  assert.match(html, /Responsável não identificado/);
  assert.match(html, /Justificativa não informada/);
  assert.doesNotMatch(html, /Alteração realizada pelo colaborador/);
});
```

- [x] **5.2 Executar `node --test tests/entry-history.test.mjs` e registrar falha inicial.**
- [x] **5.3 Extrair a apresentação e implementar o estado de leitura.**

```ts
const comparisonFields = [
  ['Entrada', 'start_time'], ['Saída', 'end_time'],
  ['Intervalo', 'break_minutes'], ['Observação', 'notes'], ['Horas calculadas', 'calculated_minutes'],
] as const;
export function historyFields(version: HistoryVersion) {
  const display = (data: Record<string, unknown>, key: string) => {
    const value = data[key];
    if (value === null || value === undefined) return 'Não informado';
    if (key === 'start_time' || key === 'end_time') return String(value).slice(0, 5);
    if (key === 'break_minutes') return `${value} min`;
    if (key === 'calculated_minutes') return formatMinutes(Number(value));
    return String(value) || 'Sem observação';
  };
  return comparisonFields.map(([label, key]) => ({ label, before: display(version.previous_data, key), after: display(version.new_data, key) }));
}
```

Reutilizar `formatMinutes` existente. Mostrar justificativa ou “Justificativa não informada”, nome confirmado em `names` ou “Responsável não identificado”, data disponível e todos os campos da comparação. Campo ausente não vira zero. Não alterar a rota de histórico nem os dados retornados. `ready` exige `versions` como array; resposta incompleta é erro, não vazio.

No HorusApp, `historyState: HistoryState | null` substitui a lista isolada. `openHistory` captura entryId e incrementa `historyRequestId.current`. Ao resolver, somente publica se esse token ainda for atual. Fechar/trocar dia/perfil incrementa o token e descarta resultado anterior. Nunca usar loading global para apresentar vazio no histórico. A nova tentativa repete exclusivamente GET de `/api/time-entries/${entry.id}/history` pelo transporte injetado. Não chamar `fetchDashboard` ao abrir histórico.

- [x] **5.4 Extrair o Modal preservando seus estilos e corrigir foco.**

```tsx
const rootRef = useRef<HTMLDivElement>(null);
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose;
const busyRef = useRef(busy);
busyRef.current = busy;
useEffect(() => {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const root = rootRef.current;
  if (!root) return;
  const focusable = () => Array.from(root.querySelectorAll<HTMLElement>(
    'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
  )).filter(node => !node.hidden && node.getClientRects().length > 0);
  (focusable()[0] ?? root).focus();
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (!busyRef.current) onCloseRef.current();
    }
    if (event.key !== 'Tab') return;
    const nodes = focusable(); const first = nodes[0]; const last = nodes.at(-1);
    if (!first || !last) { event.preventDefault(); root.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };
  root.addEventListener('keydown', onKey);
  return () => { root.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
}, []);
```

Usar `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby` com IDs de `useId()`, `tabIndex={-1}` e ref no contêiner. Manter X e fundo como fechamento, respeitando busy. Retirar o listener global de Escape de HorusApp para não furar busy nem fechar dois diálogos. Não abrir diálogos simultâneos. Bloquear/fechar corretamente a navegação que retiraria o acionador durante uma gravação; foco retorna para o cabeçalho da tela se o acionador foi removido. Mensagens usam `role="status"` ou `role="alert"` conforme urgência, não apenas cor.

- [x] **5.5 Executar testes novos e testar foco/Tab/Shift+Tab/Escape no ensaio da tarefa 7.** Incluir troca rápida entre dois dias com respostas invertidas e data inválida de versão exibida como indisponível, sem quebrar o diálogo.
- [x] **5.6 Commit local:** `fix: distinguish daily history states and restore dialog focus`.

## Tarefa 6 — Fechamento com revisão útil e confirmação somente no ensaio

**Files:** Create `app/closing-model.ts`, `app/ClosingConfirmation.tsx`, `tests/closing-review.test.mjs`. Modify `app/ClosingOverview.tsx`, `app/HorusApp.tsx`, `app/HorusViews.tsx`, `app/globals.css`, `tests/closing-read-only.test.mjs`.

**Interfaces:**

```ts
export type ClosingStatus = 'UNKNOWN' | 'NO_RECORD' | 'NO_ENTRIES' | 'PENDING' | 'READY' | 'CLOSED';
export type ClosingIssue = {
  kind: 'entry-authorization' | 'occurrence' | 'authorization-request';
  sourceId: string; contractorId: string; workDate: string; label: string;
};
export type ClosingRow = {
  contractorId: string; name: string; status: ClosingStatus;
  month: DashboardMonthlyTimesheet | null; entryCount: number;
  issues: ClosingIssue[]; forecastMinutes: number | null;
};
export type ClosingCommand = { year: number; month: number; contractorIds: string[] };
export type ClosingResult = {
  contractorId: string;
  status: 'closed' | 'already-closed' | 'blocked' | 'failed' | 'uncertain';
  message?: string;
};
export type ClosingSubmit = (command: ClosingCommand) => Promise<ClosingResult[]>;
export function buildClosingRows(data: DashboardData): ClosingRow[];
export function makeClosingCommand(
  period: DashboardPeriod, rows: ClosingRow[], selectedIds: string[], acknowledgedEmptyIds: string[]
): ClosingCommand;
export function normalizeClosingResults(command: ClosingCommand, results: ClosingResult[]): {
  results: ClosingResult[]; complete: boolean; warning: string | null;
};
export function ClosingConfirmation(props: {
  command: ClosingCommand; rows: ClosingRow[]; submit?: ClosingSubmit;
  onClose: () => void; onSettled: () => void;
}): React.ReactNode;
```

`ClosingOverview` passa a receber `onReview: (command: ClosingCommand, rows: ClosingRow[]) => void`, `onIssue: (issue: ClosingIssue) => void`, além de `data`. HorusApp recebe `closingSubmit?: ClosingSubmit`; apenas a raiz do ensaio em `tests/browser/` fornece a função. A página real não fornece callback, não recebe uma flag pública e não chama `/api/timesheets` por essa interface.

- [x] **6.1 Escrever testes de classificação, alvos e falha parcial.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { runnerImport } from 'vite';
import { makeWorkflowDashboard } from './fixtures/monthly-workflow.mjs';

test('missing month is not open; inactive history remains visible', async () => {
  const { module: c } = await runnerImport('./app/closing-model.ts', { configFile: false, envDir: false });
  const data = makeWorkflowDashboard();
  const rows = c.buildClosingRows(data);
  assert.equal(rows.find(row => row.contractorId === 'person-1').status, 'READY');
  assert.equal(rows.find(row => row.contractorId === 'person-2').status, 'READY');
  assert.equal(rows.find(row => row.contractorId === 'person-3').status, 'NO_RECORD');
  assert.throws(() => c.makeClosingCommand(data.period, rows, ['person-3'], []));
  assert.deepEqual(c.makeClosingCommand(data.period, rows, ['person-1'], []), {
    year: 2026, month: 8, contractorIds: ['person-1'],
  });
});

test('partial and missing results cannot announce whole-team success', async () => {
  const { module: c } = await runnerImport('./app/closing-model.ts', { configFile: false, envDir: false });
  const command = { year: 2026, month: 8, contractorIds: ['person-1', 'person-2'] };
  const output = c.normalizeClosingResults(command, [{ contractorId: 'person-1', status: 'closed' }]);
  assert.equal(output.complete, false);
  assert.equal(output.results.find(row => row.contractorId === 'person-2').status, 'uncertain');
  assert.equal(c.normalizeClosingResults(command, [
    { contractorId: 'person-1', status: 'closed' }, { contractorId: 'person-2', status: 'already-closed' },
  ]).complete, true);
});
```

- [x] **6.2 Executar `node --test tests/closing-review.test.mjs` e observar falha inicial.**
- [x] **6.3 Implementar classificação conservadora, sem inventar registros.**

```ts
function closingStatus(metadataAvailable: boolean, month: DashboardMonthlyTimesheet | null, entryCount: number, issues: ClosingIssue[]): ClosingStatus {
  if (!metadataAvailable) return 'UNKNOWN';
  if (!month) return 'NO_RECORD';
  if (month.status === 'CLOSED') return 'CLOSED';
  if (issues.length) return 'PENDING';
  if (!entryCount) return 'NO_ENTRIES';
  return 'READY';
}
```

`buildClosingRows` exige `asFullMonth(data.period)` válido. Inclui ativos e qualquer inativo com linha mensal, lançamento ou ocorrência relevante no mês. Para a pessoa, encontrar linha exata do ano/mês; múltiplas linhas ou metadados ausentes classificam UNKNOWN. Não usar `contractor.timesheetStatus === 'OPEN'` como evidência de linha existente. Saldo previsto usa `month.consideredMinutes - month.requiredMinutes`, ou null quando não verificável.

Pendências são: entrada `PENDING_AUTHORIZATION` no mês; autorização `REQUESTED` ou `NEEDS_ADJUSTMENT` no mês; ocorrência `REQUESTED` que sobrepõe o mês. Associar autorização existente à pessoa/data da entrada; preferir um único item de autorização com seus dados e não duplicar entrada+solicitação. Para entrada sem solicitação, `sourceId` é o ID do dia e kind `entry-authorization`. Para ocorrência, `workDate` é o maior entre início da ocorrência e início do mês. Essa classificação é conferência conservadora, não substitui validação transacional nem prova que as listas vieram completas. Solicitações de folga permanecem consultáveis, sem criar nova regra automática de bloqueio não validada.

Rótulos: UNKNOWN “Situação mensal não disponível”; NO_RECORD “Sem registro mensal”; NO_ENTRIES “Sem lançamentos”; PENDING “Com pendências”; READY “Pronto para revisar”; CLOSED “Fechado”. Mostrar horas trabalhadas, consideradas, carga, previsão e os abonos existentes em NO_ENTRIES. Fechados mostram data/responsável ou “Não informado”. Lista de fechados vazia: “Nenhum colaborador com este mês fechado”.

- [x] **6.4 Implementar seleção explícita e navegação para pendências.**

```ts
export function makeClosingCommand(period: DashboardPeriod, rows: ClosingRow[], selectedIds: string[], acknowledgedEmptyIds: string[]): ClosingCommand {
  const month = asFullMonth(period);
  if (!month || month.year === null || month.month === null) throw Error('Escolha um mês completo');
  const ids = [...new Set(selectedIds)];
  if (!ids.length) throw Error('Selecione os colaboradores para revisar');
  for (const id of ids) {
    const row = rows.find(item => item.contractorId === id);
    const allowedEmpty = row?.status === 'NO_ENTRIES' && acknowledgedEmptyIds.includes(id);
    if (!row || (row.status !== 'READY' && !allowedEmpty)) throw Error('Há colaborador sem condições para revisão');
  }
  return { year: month.year, month: month.month, contractorIds: ids };
}
```

Iniciar seleção vazia e oferecer “Selecionar prontos para revisar”; não selecionar sem registro nem sem lançamentos. A seleção de NO_ENTRIES exige caixa separada “Conferi este mês sem lançamentos e quero incluí-lo”. Mudar mês/resposta limpa seleção e revisão anteriores. “Revisar fechamento” apresenta apenas alvos explicitamente selecionados; a consulta/revisão não grava nada.

Acrescentar `requestFocus?: ClosingIssue` a `RequestsView`. Ao abrir pendência, carregar slot de Solicitações/Aprovações com o mês capturado do fechamento, destacar a pessoa/item exato, mostrar filtro e ação “Ver todas”. IDs dos cards permitem foco após carregamento. Para `entry-authorization` sem solicitação, abrir formulário existente de autorização com pessoa/data preenchidas, sem enviar. Para os outros tipos, abrir o card já existente. Se o item não vier na resposta, informar “Esta pendência não foi encontrada na consulta; atualize os dados” em vez de aprovar ou fingir resolução. Voltar ao Fechamento restaura o mês; após decisão fictícia, invalidar/reconsultar antes de revisar novamente. Nenhuma navegação altera status.

- [x] **6.5 Implementar diálogo e resultados sem conectar gravação real.**

```ts
export function normalizeClosingResults(command: ClosingCommand, results: ClosingResult[]) {
  const allowed = new Set(['closed', 'already-closed', 'blocked', 'failed', 'uncertain']);
  const unexpected = results.some(result => !command.contractorIds.includes(result.contractorId));
  const normalized: ClosingResult[] = command.contractorIds.map(contractorId => {
    const matches = results.filter(result => result.contractorId === contractorId);
    if (matches.length !== 1 || !allowed.has(matches[0].status)) {
      return { contractorId, status: 'uncertain', message: 'Resultado não confirmado. Consulte antes de repetir.' };
    }
    return matches[0];
  });
  return {
    results: normalized,
    complete: !unexpected && normalized.length > 0 && normalized.every(item => item.status === 'closed' || item.status === 'already-closed'),
    warning: unexpected ? 'A resposta incluiu uma pessoa fora da seleção. Confira o resultado antes de continuar.' : null,
  };
}
```

Congelar cópia do comando e linhas revisadas no momento da abertura. O Modal mostra mês/ano, nomes/quantidade e efeito: registrar o fechamento e as movimentações calculadas, preservando os horários originais. Resultado individual sempre visível; “Equipe fechada” significa somente todos os alvos desse comando confirmados, nunca todas as pessoas da organização. Renderizar `warning` quando presente. Resultados para IDs fora do comando são ignorados e reportados como inconsistência; não devem atualizar outra pessoa.

Sem `submit`, botão “Fechar mês da equipe” desabilitado com explicação “Fechamento real ainda indisponível: validação de segurança do backend pendente”. O botão de revisar permanece utilizável. Com callback do ensaio, o ambiente identifica “TESTE — dados fictícios” de forma permanente. Não acrescentar fallback de simulação na produção nem acionar a rota existente ao faltar callback.

Usar ref `inFlight` e estado visual para impedir dois envios mesmo antes do próximo render. No início, se ref for true, retornar; caso contrário, marcar true antes do await. Manter diálogo/período/perfil bloqueados durante envio. Exceção de transporte ou resposta malformada gera `uncertain` para alvos sem confirmação; não executar rollback/reabertura nem repetir. Invocar `onSettled` para invalidar a consulta fictícia, mas preservar a tela de resultados se atualizar a lista falhar. Repetição só fica disponível depois de consulta que confirme estado atual; pessoas já fechadas não são reenviadas.

- [x] **6.6 Ajustar contratos e reexecutar testes.** O teste antigo que proíbe todo `<button>` deve passar a permitir revisão, preservando a prova de confirmação desabilitada por padrão. Manter teste da rota real retornando 503 com flag desativada. Cobrir NO_ENTRIES com/sem ciência explícita, PENDING, CLOSED, UNKNOWN, mês parcial, metadados duplicados, clique repetido, resposta ausente/duplicada, falha parcial, resultado incerto e imutabilidade dos dias/versões ao revisar e simular fechar.
- [x] **6.7 Commit local:** `feat: add explicit monthly closing review with isolated confirmation`.

## Tarefa 7 — Demonstrar o fluxo isolado e registrar os limites da entrega

**Files:** Create `tests/browser/index.html`, `tests/browser/main.tsx`, `tests/browser/vite.config.ts`, `tests/isolated-verification.test.mjs`, `scripts/verify-workflow-isolated.mjs`, `docs/runbooks/monthly-workflow-local-validation.md`, `docs/runbooks/monthly-workflow-release-gates.md`. Modify `package.json` para `verify:workflow` e `preview:workflow`. Reutilizar `tests/helpers/mock-request.mjs` e `tests/fixtures/monthly-workflow.mjs`.

**Interfaces:** Exportar do script `isSafeSourcePath(relativePath: string): boolean` e `buildSafeEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv`, sem iniciar subprocesso quando importado como módulo. Comandos fixos aceitos: `checks` e `preview`; nenhum argumento vira comando arbitrário. `checks` executa build Vinext, todos os testes, lint, build Next e análise de tipos em cópia saneada. `preview` inicia somente o Vite de `tests/browser` na mesma cópia saneada.

- [x] **7.1 Escrever o teste do isolamento antes do script.**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeSourcePath, buildSafeEnv } from '../scripts/verify-workflow-isolated.mjs';

test('isolated verification excludes environment files and credentials', () => {
  for (const path of ['.env', '.env.local', 'tests/.env.production', '.dev.vars', '.vercel/project.json', '../outside.ts']) {
    assert.equal(isSafeSourcePath(path), false, path);
  }
  assert.equal(isSafeSourcePath('app/HorusApp.tsx'), true);
  const env = buildSafeEnv({ PATH: 'local-tools', TEMP: 'local-temp', SUPABASE_URL: 'forbidden', SUPABASE_SERVICE_ROLE_KEY: 'forbidden', VERCEL_TOKEN: 'forbidden', NODE_OPTIONS: 'forbidden' });
  assert.equal(env.PATH, 'local-tools');
  assert.equal(env.SUPABASE_URL, undefined);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(env.VERCEL_TOKEN, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
});
```

- [x] **7.2 Executar `node --test tests/isolated-verification.test.mjs`; esperar falha pelo módulo ausente.**
- [x] **7.3 Implementar a cópia de verificação sem transportar segredos.**

```js
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isSafeSourcePath(path) {
  if (isAbsolute(path)) return false;
  const parts = path.replaceAll('\\', '/').split('/');
  return parts.every(part => part !== '..' && part !== '' &&
    !/^\.env(?:\.|$)/i.test(part) && !/^\.dev\.vars(?:\.|$)/i.test(part) &&
    !['.git', '.vercel', '.supabase', '.codex', '.agents', '.mcp.json', '.npmrc', '.netrc', 'node_modules'].includes(part.toLowerCase()));
}
export function buildSafeEnv(source) {
  const allowed = new Set(['path', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'pathext']);
  const env = Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.has(key.toLowerCase()) && value !== undefined));
  return { ...env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', WRANGLER_WRITE_LOGS: 'false' };
}
function main(mode) {
  if (!['checks', 'preview'].includes(mode)) throw Error('Use checks ou preview');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const target = mkdtempSync(join(tmpdir(), 'horus-workflow-check-'));
  for (const path of paths) {
    if (!isSafeSourcePath(path)) continue;
    const source = resolve(root, path);
    if (relative(root, source).startsWith('..') || lstatSync(source).isSymbolicLink()) throw Error('Fonte fora do escopo permitido');
    const destination = resolve(target, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  // Dependências já instaladas; não copiar .env nem executar instalação.
  symlinkSync(join(root, 'node_modules'), join(target, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const env = buildSafeEnv(process.env);
  const run = args => {
    const result = spawnSync(process.execPath, args, { cwd: target, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(`Verificação terminou com código ${result.status}`);
  };
  console.log(`Cópia de verificação sem arquivos de ambiente: ${target}`);
  if (mode === 'preview') {
    run(['node_modules/vite/bin/vite.js', '--config', 'tests/browser/vite.config.ts']);
    return;
  }
  run(['node_modules/vinext/dist/cli.js', 'build']);
  const tests = readdirSync(join(target, 'tests')).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
  run(['--test', ...tests]);
  run(['node_modules/eslint/bin/eslint.js', 'app', 'db', 'tests', 'worker', 'proxy.ts', '--ignore-pattern', '.next', '--ignore-pattern', '.vinext']);
  run(['node_modules/next/dist/bin/next', 'build']);
  run(['node_modules/typescript/bin/tsc', '--noEmit']);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2] ?? 'checks');
}
```

Antes de usar o script, incluir os novos arquivos explicitamente no índice local para que `git ls-files` os encontre; revisar os nomes incluídos. Isso não faz push nem altera o conteúdo staged ao executar. Cópias temporárias permanecem para inspeção; não incluir limpeza recursiva. Não substituir as variáveis de ambiente do processo principal nem imprimir valores de credenciais. Acrescentar `"verify:workflow": "node scripts/verify-workflow-isolated.mjs checks"` e `"preview:workflow": "node scripts/verify-workflow-isolated.mjs preview"` sem alterar outros scripts.

Revisar os testes existentes antes de rodar a suíte completa: `new Request('https://horuscodex.vercel.app/...')` por si só não é acesso externo; os testes atuais invocam handlers locais e validam rejeição antecipada. Nenhum teste novo pode fazer `fetch` para essa origem, iniciar autenticação real ou importar arquivo de ambiente. Caso uma dependência tente buscar fontes públicas durante o build, relatar eventual restrição de rede; não injetar credenciais de produção para fazer a verificação passar.

- [x] **7.4 Criar a raiz do ensaio fora da aplicação publicada.**

```ts
// tests/browser/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  root, envDir: false, envPrefix: [], plugins: [react()],
  server: {
    host: '127.0.0.1', port: 4175, strictPort: true,
    fs: { allow: [repository] },
    headers: { 'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws://127.0.0.1:4175; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'none'; base-uri 'none'" },
  },
});
```

`index.html` contém lang pt-BR, charset UTF-8, viewport e `<div id="root"></div><script type="module" src="/main.tsx"></script>`. `main.tsx` importa `createRoot`, HorusApp, `app/globals.css` e as duas fixtures. Não importar layout/page/API/server, não configurar proxy nem vinext. O banner “TESTE LOCAL — dados fictícios; sem Supabase” fica fora do HorusApp, sempre visível.

A raiz mantém dashboards fictícios em memória por ano/mês. `GET /api/dashboard` usa `year/month` ou `from/to` para responder período idêntico ao pedido; intervalo fictício soma apenas entradas contidas nele, usando o mesmo helper de resumo existente, sem banco. Em simulação PJ, `viewAs` filtra todas as coleções pelo ID; perfil PJ real de teste também só recebe person-1, independentemente de parâmetro. Resposta inicial de cada perfil tem o mesmo filtro. Fornecer controles de ensaio para RH, colaborador e DEV, remontando HorusApp com key para evitar sessão fictícia misturada.

Mapear expressamente somente as rotas usadas nos cenários: GET dashboard, GET histórico dos dois IDs, POST time-entries e POST/PATCH de autorizações/ocorrências fictícias. O padrão é rejeitar rota desconhecida, nunca encaminhar para rede. O POST diário atualiza apenas o dia identificado e acrescenta versão fictícia; se pessoa/data estiver fora da fixture, rejeitar. O mock de fechamento altera somente a projeção mensal em memória e devolve resultados individuais; não altera `entries` nem versões. Exemplo do callback do ensaio:

```ts
const closingSubmit: ClosingSubmit = async command => command.contractorIds.map(contractorId => {
  const data = dashboards.get(`${command.year}-${command.month}`);
  const month = data?.monthlyTimesheets?.find(item => item.contractorId === contractorId);
  if (!month) return { contractorId, status: 'blocked', message: 'Sem registro mensal fictício' };
  if (month.status === 'CLOSED') return { contractorId, status: 'already-closed' };
  month.status = 'CLOSED'; month.closedAt = new Date().toISOString(); month.closedByName = 'RH de teste';
  return { contractorId, status: 'closed' };
});
```

`dashboards` é `Map<string, DashboardData>` criado a partir de `makeWorkflowDashboard` e clonado para cada novo ensaio. O transporte responde com `Response.json(structuredClone(data))`, nunca expõe objetos mutáveis diretamente à UI. Acrescentar controles exclusivamente no ensaio para atraso, resposta antiga, erro, histórico vazio, pendência, mês vazio, CLOSED, falha parcial e resultado incerto. Os controles modificam somente a fixture selecionada e mostram qual cenário está ativo. Não criar botões de ensaio dentro de HorusApp.

O mock não é prova das regras reais de saldo ou fechamento. Antes/depois de navegação, filtro, histórico, revisão e fechamento fictício, comparar cópias de `entries` e versões com `assert.deepEqual`. Após edição diária fictícia, somente aquele dia pode mudar e a versão anterior deve continuar disponível. Tentar URL externa no transporte e confirmar rejeição; revisar o registro de chamadas e a política de rede do navegador.

- [x] **7.5 Rodar verificações em cópia saneada e inspecionar resultados completos.** Primeiro o teste isolado novo; depois `npm run verify:workflow`. Registrar quantidade de testes/falhas e códigos de saída de build Vinext, testes, lint, build Next e tipos. Não declarar aprovação se um comando não rodou ou falhou. O build não inicia o servidor de produção nem publica nada.
- [x] **7.6 Rodar `npm run preview:workflow` e validar a aplicação no navegador local.** Usar a skill de navegador aplicável no momento, somente `http://127.0.0.1:4175`, sem aproveitar a sessão de produção. Não criar contas nem usar logins reais. Executar a seguinte matriz e registrar resultado observado, não apenas marcar intenção:

| Cenário | Ação e resultado exigido |
| --- | --- |
| Independência | Painel agosto → Lançamentos setembro → Painel continua agosto → Fechamento escolhe agosto sem visitar Painel; Relatórios também tem controle próprio. |
| Primeira visita/intervalo | Painel com intervalo parcial → primeira abertura mensal pede mês; retornos restauram a escolha local; dezembro/janeiro e fevereiro bissexto corretos. |
| Atraso/erro | Resposta antiga de agosto chega após setembro e não substitui lista; erro mostra tentativa novamente e nunca “Sem lançamentos”. |
| Pessoas/dia | Bruno inativo aparece em agosto com 300 min, sem misturar 780 min da equipe; editar Ana afeta apenas o dia escolhido; mês fechado informa impedimento; salvar com falha só no refresh não repete POST. |
| Histórico | Carregando, falha, vazio e múltiplas versões distinguíveis; intervalo/observação aparecem; trocar dia rapidamente não mistura respostas; nenhuma gravação ao abrir. |
| Fechamento | Todos os estados da tarefa 6; escolher alvos; resolver pendência fictícia preservando pessoa/data; revisar; confirmar; resultado individual correto em sucesso, falha parcial e incerteza; clique duplo gera uma chamada. |
| Perfis | RH, PJ e DEV RH; simulação DEV não envia escrita; trocar simulado não mostra a pessoa anterior; RH volta com seus filtros/períodos. |
| Teclado/tela estreita | Controle de mês acessível, Tab/Shift+Tab presos ao diálogo, Escape respeita envio, foco retorna; a 375 px mês e ação principal permanecem utilizáveis. |
| Preservação | Chamadas registradas só nas rotas fictícias; dias/versões idênticos antes/depois de consultar/revisar/fechar no mock; nada chamado no Supabase. |

Nas capturas do ensaio, nomes, datas e totais são fictícios. Não apresentar fonte substituta do ensaio como prova de identidade tipográfica exata da produção: o layout Next com fontes remotas não é necessário para o teste funcional isolado.

- [x] **7.7 Escrever os dois registros de entrega.** `monthly-workflow-local-validation.md` contém data, commit testado, comandos e resultados reais, capturas locais, cenários aprovados/falhos/não executados, diferenças permitidas e limitações. `monthly-workflow-release-gates.md` contém as condições abaixo, com estado inicial “BLOQUEADO — não autorizado/testado nesta etapa”. Não preencher aprovações fictícias nem concluir o backend por resultado do mock.
- [x] **7.8 Revisar o diff completo e fazer commit local:** `test: verify monthly workflows in an isolated browser harness`. Incluir arquivos explicitamente, conferir `git diff --cached --stat` e `git diff --cached --check` antes. Nenhum arquivo de ambiente, credencial, migração, flag, rota de gravação ou arquivo de permissão pode entrar no commit. Não fazer push/deploy.

## Condições obrigatórias para a etapa posterior de backend

Estas condições são tarefas de investigação/integração POSTERIORES, não autorização para executá-las agora. O relatório local deve apontar responsável “próxima etapa de backend, após autorização específica” e as evidências abaixo necessárias para sair de BLOQUEADO.

| Condição | Evidência exigida antes de liberar | Limite atual |
| --- | --- | --- |
| Consultas sem gravação implícita | Demonstração em backend isolado de que dashboard/histórico/revisão não escrevem; verificação de que vencimento continua respeitado nas operações de saldo. | Não retirar simplesmente `refresh_hour_balance_statuses` e deixar saldo vencido utilizável. Nenhuma chamada de dashboard real neste ensaio. |
| Mês fechado protegido em todos os caminhos | Testes concorrentes de fechamento versus edição, autorização e ocorrência; tentativas após fechamento rejeitadas sem alteração parcial. | Bloqueio no frontend ou consulta prévia ao status não resolve corrida no servidor. |
| Registro, cálculo e histórico consistentes | Injeção de falhas entre etapas, rollback/consistência por operação, versões/auditoria preservadas e saldo conciliado com o estado mensal. | Não corrigir dados reais para fazer testes passar. Mudança de função/transação exige proposta e autorização antes de aplicação. |
| Repetição/resultado incerto | Duas chamadas concorrentes, retry após timeout e consulta de reconciliação sem duplicar lotes/movimentações. Resultado individual confirmado para cada alvo. | API atual é por pessoa; não prometer atomicidade da equipe nem usar reabertura como compensação automática. |
| Escopo e completude | Paginação/contagem demonstrando todos os registros/pendências relevantes do mês, inclusive inativos; organização e permissões verificadas; metadados mensais completos. | Listas atuais limitadas a 100 e limites de retorno do serviço não podem fundamentar “sem pendências” autoritativo. |
| Preservação comprovada | Comparação autorizada, somente leitura, de conjuntos protegidos antes/depois de mudanças permitidas, contemplando gravações legítimas ocorridas no intervalo. | Contagens antigas da auditoria não são prova de integridade atual; não criar cópia, importar, restaurar ou baixar dados reais sem autorização. |
| Liberação deliberada | Revisão das diferenças, provas de teste, limites conhecidos e aprovação específica de publicação; outra decisão explícita para fechar mês real. | Manter flag de fechamento desativada; nenhuma ativação, publicação ou execução de agosto está autorizada por este plano. |

Se uma condição exigir alteração de função, tabela, política, permissão ou configuração no Supabase, apresentar a menor mudança proposta, seu efeito e como será verificada antes de solicitar autorização. Não executar `db:push`, migração, redefinição de banco, seed, restauração ou rotina de fechamento como parte da entrega local.

## Revisão de cobertura do plano

| Requisito da especificação | Cobertura |
| --- | --- |
| Regras globais e agosto preservado | Restrições globais; tarefas 1 e 7; condições de backend. |
| Período independente, primeira visita, intervalos e respostas | Tarefas 2–3; matriz da tarefa 7. |
| RH/PJ/DEV e consulta de inativos | Tarefas 3–4; matriz de perfis; nenhum ajuste de autorização. |
| Edição diária, motivo e sucesso após confirmação | Tarefa 4; transporte fictício da tarefa 7. |
| Histórico de quatro estados e comparação completa | Tarefa 5; ensaio de respostas invertidas. |
| Fechamento revisável, pendências, alvos e resultado | Tarefa 6; integração real explicitamente bloqueada. |
| Acessibilidade e telas estreitas | Tarefas 2, 5 e 7; sem alegar conformidade total. |
| Testes, tipos, lint, builds e evidência | Tarefa 7 em cópia sem credenciais. |
| Autorização de backend/publicação separada | Seções de escopo e condições posteriores; nenhuma gravação real nesta entrega. |

Execução escolhida: na própria tarefa, sem subagentes, usando `superpowers:executing-plans`, com verificação antes de afirmar conclusão. Um teste falho por infraestrutura não é aprovação; uma integração bloqueada não é implementação concluída em produção.
