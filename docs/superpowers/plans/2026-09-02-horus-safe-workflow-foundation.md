# Horus Safe Workflow Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a base segura do novo fluxo do Horus — sem migração de banco — removendo exclusões destrutivas, preservando o histórico de pessoas inativas, esclarecendo os três perfis e criando a área de fechamento em modo somente conferência.

**Architecture:** Esta é a primeira de três entregas independentes. Ela parte de `main` em um worktree limpo, altera somente aplicação, testes e um script SQL de leitura, e mantém o fechamento real desligado. O backend transacional e a ativação em produção terão planos próprios depois que esta fundação passar pela revisão.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase/Postgres 17, Supabase JS 2, Node test runner, CSS existente do Horus.

**Spec:** `docs/superpowers/specs/2026-09-02-horus-safe-workflow-redesign-design.md`

## Global Constraints

- Histórico é intocável: não apagar lançamentos, versões, auditorias, folhas, usuários ou movimentações.
- O enum interno continua `PJ`; somente a interface usa **Colaborador**.
- O acesso `DEV` continua protegido e a simulação de colaborador permanece somente leitura.
- Esta entrega não aplica DDL, não executa migração e não grava no Supabase de produção.
- O endpoint legado de fechamento fica bloqueado por padrão até existir backend transacional aprovado.
- Nenhuma ação de exclusão de pessoa permanece disponível na interface ou nas APIs.
- Pessoas inativas com dados no período continuam nos totais e nas consultas históricas.
- O visual existente do Horus é preservado; a entrega reorganiza conteúdo e linguagem, não cria uma nova identidade.
- Cada tarefa começa com teste falhando, termina com teste passando e recebe commit próprio.
- Implementar em um novo worktree criado a partir de `main`; o branch combinado `feat/safer-month-closing` permanece apenas como referência.

---

### Task 1: Baseline imutável do histórico

**Files:**
- Create: `db/history-baseline.ts`
- Create: `scripts/print-history-baseline.mjs`
- Create: `tests/history-safety-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: tabelas legadas `time_entries`, `time_entry_versions`, `monthly_timesheets` e `audit_logs`.
- Produces: `historyBaselineSql(): string`, comando `npm run history:baseline` e teste `npm run test:safety`.

- [ ] **Step 1: Write the failing safety-contract test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { historyBaselineSql } from "../db/history-baseline.ts";

test("history baseline is read-only and covers every protected dataset", async () => {
  const sql = historyBaselineSql();
  assert.match(sql, /begin transaction read only/i);
  for (const table of ["time_entries", "time_entry_versions", "monthly_timesheets", "audit_logs"]) {
    assert.match(sql, new RegExp(`public\\.${table}`, "i"));
  }
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  assert.match(sql, /rollback/i);
});
```

- [ ] **Step 2: Run the test and verify it fails because the SQL file does not exist**

Run: `node --test tests/history-safety-contract.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `db/history-baseline.ts`.

- [ ] **Step 3: Add the read-only baseline query**

```ts
export function historyBaselineSql() {
  return `begin transaction read only;

select 'time_entries'::text as dataset,
       count(*)::bigint as row_count,
       coalesce(sum(calculated_minutes), 0)::bigint as metric_a,
       coalesce(sum(eligible_minutes), 0)::bigint as metric_b,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), '')) as signature
from public.time_entries as t
union all
select 'time_entry_versions', count(*), 0, 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.time_entry_versions as t
union all
select 'monthly_timesheets', count(*),
       coalesce(sum(required_minutes), 0), coalesce(sum(considered_minutes), 0),
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.monthly_timesheets as t
union all
select 'audit_logs', count(*), 0, 0,
       md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by id), ''))
from public.audit_logs as t
order by dataset;

rollback;`;
}
```

Create the executable printer:

```js
import { historyBaselineSql } from "../db/history-baseline.ts";
process.stdout.write(historyBaselineSql() + "\n");
```

- [ ] **Step 4: Expose the safety test without changing the existing test command**

Add to `package.json`:

```json
"history:baseline": "node scripts/print-history-baseline.mjs",
"test:safety": "node --test tests/history-safety-contract.test.mjs"
```

- [ ] **Step 5: Run the focused and complete test suites**

Run: `npm run test:safety`

Expected: PASS.

Run: `npm run history:baseline`

Expected: prints one read-only transaction covering the four protected datasets and exits with code 0.

Run: `npm test`

Expected: build and every Node test PASS.

- [ ] **Step 6: Commit the baseline contract**

```bash
git add package.json db/history-baseline.ts scripts/print-history-baseline.mjs tests/history-safety-contract.test.mjs
git commit -m "test: protect Horus history baseline"
```

### Task 2: Remove permanent deletion of people

**Files:**
- Modify: `app/api/team/route.ts`
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/HorusApp.tsx`
- Modify: `app/HorusViews.tsx`
- Modify: `app/AdminView.tsx`
- Modify: `app/globals.css`
- Create: `tests/people-history-protection.test.mjs`
- Create: `tests/fixtures/dashboard.mjs`

**Interfaces:**
- Consumes: existing `PATCH /api/team` and `PATCH /api/admin/users` status changes.
- Produces: inactivation/reactivation as the only lifecycle operations; no `DELETE` handler or delete callback for people.

- [ ] **Step 1: Write a failing source-level regression test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as teamRoute from "../app/api/team/route.ts";
import * as adminRoute from "../app/api/admin/users/route.ts";
import { TeamView } from "../app/HorusViews.tsx";
import { AdminView } from "../app/AdminView.tsx";
import { makeAdminData, makeDashboard } from "./fixtures/dashboard.mjs";

test("people can be inactivated but never permanently deleted", async () => {
  assert.equal("DELETE" in teamRoute, false);
  assert.equal("DELETE" in adminRoute, false);
  const teamHtml = renderToStaticMarkup(createElement(TeamView, {
    data: makeDashboard(), onNew() {}, onStatus() {}, onDelete() {}, onTimesheet() {}, onSetPassword() {},
  }));
  const adminHtml = renderToStaticMarkup(createElement(AdminView, {
    data: makeAdminData(), loading: false, onRole() {}, onStatus() {}, onPassword() {}, onDelete() {}, onViewAs() {},
  }));
  assert.doesNotMatch(teamHtml + adminHtml, /Excluir/);
  assert.match(teamHtml, /Inativar/);
});
```

Create the complete UI fixture used by this and later rendering tests:

```js
export function makeDashboard() {
  return {
    period: { from: "2026-08-01", to: "2026-08-31", year: 2026, month: 8 },
    metrics: { activeContractors: 1, workedMinutes: 480, requiredMinutes: 9720, positiveBalanceMinutes: 0, negativeBalanceMinutes: 0, pendingRequests: 0, pendingOccurrences: 0, pendingAuthorizations: 0 },
    timesheet: { workedMinutes: 480, creditedMinutes: 0, consideredMinutes: 480, requiredMinutes: 9720, projectedBalanceMinutes: -9240, status: "OPEN" },
    policy: { monthlyRequiredMinutes: 9720, positiveBalanceAfterDeadlinePolicy: "ALLOW_AFTER_DEADLINE", minimumLeaveNoticeDays: null, retroactiveBatchThreshold: 3 },
    contractors: [{ id: "person-1", name: "Ana Exemplo", email: "ana@example.com", initials: "AE", status: "ACTIVE", lastEntryDate: "2026-08-01", lastEntryAt: "2026-08-01T20:00:00Z", workedMinutes: 480, consideredMinutes: 480, requiredMinutes: 9720, fillPercentage: 5, averageDelayDays: 0, retroactiveEntries: 0, timesheetStatus: "OPEN" }],
    entries: [], balanceLots: [], balanceTransactions: [], requests: [], occurrences: [], authorizations: [], audits: [],
  };
}

export function makeAdminData() {
  return {
    users: [{ id: "person-1", name: "Ana Exemplo", email: "ana@example.com", role: "PJ", status: "ACTIVE", hasAccess: true, createdAt: "2026-08-01T12:00:00Z", updatedAt: "2026-08-01T12:00:00Z" }],
    audits: [],
  };
}
```

- [ ] **Step 2: Run the test and verify it finds the legacy delete flows**

Run: `node --test tests/people-history-protection.test.mjs`

Expected: FAIL on the `DELETE` handlers and `onDelete` callbacks.

- [ ] **Step 3: Remove both DELETE route handlers**

Delete the entire `export async function DELETE` block from:

```ts
app/api/team/route.ts
app/api/admin/users/route.ts
```

Keep the existing `PATCH` paths for `ACTIVE` and `INACTIVE` unchanged.

- [ ] **Step 4: Remove destructive callbacks and keep status copy explicit**

In `app/HorusApp.tsx`:

```ts
async function mutate(path: string, method: "POST" | "PATCH", body: unknown, success: string, closeModal = true)
async function adminMutate(method: "PATCH", body: unknown, success: string, closeModal = true)
```

Remove `deleteContractor` and `deleteAdminUser`. Render views without `onDelete`:

```tsx
<TeamView
  data={dashboard}
  onNew={() => setModal("contractor")}
  onStatus={changeContractorStatus}
  onTimesheet={timesheetAction}
  onSetPassword={(id, name) => {
    setContractorPasswordForm({ id, name, password: "", scope: "team" });
    setModal("contractorPassword");
  }}
/>
<AdminView
  data={adminData}
  loading={loading}
  onRole={changeUserRole}
  onStatus={changeUserStatus}
  onViewAs={(target) => void switchToContractor(target.id)}
  onPassword={(target) => {
    setContractorPasswordForm({ id: target.id, name: target.name, password: "", scope: "admin" });
    setModal("contractorPassword");
  }}
/>
```

- [ ] **Step 5: Remove delete props and buttons from both people views**

`TeamView` becomes:

```ts
export function TeamView({ data, onNew, onStatus, onSetPassword }: {
  data: DashboardData;
  onNew: () => void;
  onStatus: (id: string, next: "ACTIVE" | "INACTIVE") => void;
  onSetPassword: (id: string, name: string) => void;
})
```

`AdminView` removes `onDelete` from `Props`, its argument list, and its action buttons. Remove `.delete-action` rules that become unused.

- [ ] **Step 6: Run tests, lint, and type-check**

Run: `node --test tests/people-history-protection.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit the non-destructive lifecycle**

```bash
git add app/api/team/route.ts app/api/admin/users/route.ts app/HorusApp.tsx app/HorusViews.tsx app/AdminView.tsx app/globals.css tests/fixtures/dashboard.mjs tests/people-history-protection.test.mjs
git commit -m "fix: preserve people and their history"
```

### Task 3: Include inactive people in historical totals

**Files:**
- Create: `db/dashboard-summary.ts`
- Create: `tests/dashboard-summary.test.mjs`
- Modify: `db/dashboard.ts`

**Interfaces:**
- Consumes: `SummaryUser[]`, `SummaryEntry[]`, `SummaryTimesheet[]`, `requiredPerMonth`, `monthCount`.
- Produces: `buildPeriodSummary(input): { activeContractors; workedMinutes; creditedMinutes; consideredMinutes; requiredMinutes; includedContractorIds }`.

- [ ] **Step 1: Write failing domain tests for inactive historical participation**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildPeriodSummary } from "../db/dashboard-summary.ts";

test("historical totals keep entries and timesheets from inactive people", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }, { id: "former", status: "INACTIVE" }],
    entries: [
      { contractorId: "active", calculatedMinutes: 480, eligibleMinutes: 480 },
      { contractorId: "former", calculatedMinutes: 420, eligibleMinutes: 420 },
    ],
    timesheets: [
      { contractorId: "active", requiredMinutes: 9720, creditedMinutes: 0 },
      { contractorId: "former", requiredMinutes: 9720, creditedMinutes: 60 },
    ],
    requiredPerMonth: 9720,
    monthCount: 1,
  });
  assert.deepEqual(result, {
    activeContractors: 1,
    workedMinutes: 900,
    creditedMinutes: 60,
    consideredMinutes: 960,
    requiredMinutes: 19440,
    includedContractorIds: ["active", "former"],
  });
});

test("an active person without a timesheet still contributes the fallback requirement", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }], entries: [], timesheets: [],
    requiredPerMonth: 9720, monthCount: 2,
  });
  assert.equal(result.requiredMinutes, 19440);
  assert.deepEqual(result.includedContractorIds, ["active"]);
});

test("fallback requirement is added only for active people missing a timesheet", () => {
  const result = buildPeriodSummary({
    users: [{ id: "active", status: "ACTIVE" }, { id: "former", status: "INACTIVE" }],
    entries: [],
    timesheets: [{ contractorId: "former", requiredMinutes: 9000, creditedMinutes: 0 }],
    requiredPerMonth: 9720, monthCount: 1,
  });
  assert.equal(result.requiredMinutes, 18720);
});
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

Run: `node --test tests/dashboard-summary.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure summary model**

```ts
export type SummaryUser = { id: string; status: "ACTIVE" | "INACTIVE" };
export type SummaryEntry = { contractorId: string; calculatedMinutes: number; eligibleMinutes: number };
export type SummaryTimesheet = { contractorId: string; requiredMinutes: number; creditedMinutes: number };

export function buildPeriodSummary(input: {
  users: SummaryUser[];
  entries: SummaryEntry[];
  timesheets: SummaryTimesheet[];
  requiredPerMonth: number;
  monthCount: number;
}) {
  const activeIds = new Set(input.users.filter((user) => user.status === "ACTIVE").map((user) => user.id));
  const includedIds = new Set(activeIds);
  for (const entry of input.entries) includedIds.add(entry.contractorId);
  for (const sheet of input.timesheets) includedIds.add(sheet.contractorId);
  const workedMinutes = input.entries.reduce((total, row) => total + row.calculatedMinutes, 0);
  const eligibleMinutes = input.entries.reduce((total, row) => total + row.eligibleMinutes, 0);
  const creditedMinutes = input.timesheets.reduce((total, row) => total + row.creditedMinutes, 0);
  const sheetIds = new Set(input.timesheets.map((row) => row.contractorId));
  const timesheetRequirement = input.timesheets.reduce((total, row) => total + row.requiredMinutes, 0);
  const missingActiveSheets = [...activeIds].filter((id) => !sheetIds.has(id)).length;
  const requiredMinutes = timesheetRequirement + missingActiveSheets * input.requiredPerMonth * input.monthCount;
  return {
    activeContractors: activeIds.size,
    workedMinutes,
    creditedMinutes,
    consideredMinutes: eligibleMinutes + creditedMinutes,
    requiredMinutes,
    includedContractorIds: [...includedIds].sort(),
  };
}
```

- [ ] **Step 4: Refactor dashboard totals to use the pure model**

In `db/dashboard.ts`, map database rows to the camel-case input and replace `activeEntries`/`activeTimesheets` totals:

```ts
const summary = buildPeriodSummary({
  users: users.map((user) => ({ id: user.id, status: user.status })),
  entries: entries.map((entry) => ({ contractorId: entry.contractor_id, calculatedMinutes: entry.calculated_minutes, eligibleMinutes: entry.eligible_minutes })),
  timesheets: timesheets.map((row) => ({ contractorId: row.contractor_id, requiredMinutes: row.required_minutes, creditedMinutes: row.credited_minutes })),
  requiredPerMonth,
  monthCount: keys.size,
});
```

Use `summary` for dashboard worked, required, credited and considered totals. Keep `metrics.activeContractors` equal to `summary.activeContractors`.

- [ ] **Step 5: Run domain and full tests**

Run: `node --test tests/dashboard-summary.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: build and all tests PASS.

- [ ] **Step 6: Commit historical visibility**

```bash
git add db/dashboard-summary.ts db/dashboard.ts tests/dashboard-summary.test.mjs
git commit -m "fix: include inactive people in historical totals"
```

### Task 4: Clarify navigation and preserve the Developer modes

**Files:**
- Modify: `app/HorusViews.tsx`
- Modify: `app/HorusApp.tsx`
- Modify: `app/AdminView.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Create: `tests/developer-view-contract.test.mjs`

**Interfaces:**
- Consumes: existing `viewAs` read-only dashboard query and `readOnly` props.
- Produces: RH navigation labels `Painel`, `Lançamentos`, `Aprovações`, `Fechamento do mês`, `Pessoas`, `Relatórios`, `Administração`; collaborator labels `Meu mês`, `Banco de horas`, `Solicitações`.

- [ ] **Step 1: Write failing navigation and Developer-mode assertions**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HorusApp } from "../app/HorusApp.tsx";
import { makeDashboard } from "./fixtures/dashboard.mjs";

test("navigation uses clear names and keeps DEV simulation read-only", async () => {
  const app = renderToStaticMarkup(createElement(HorusApp, {
    user: { name: "João Dev", email: "dev@example.com" }, accountRole: "dev",
    organizationName: "Exemplo", initialDashboard: makeDashboard(),
  }));
  for (const label of ["Painel", "Aprovações", "Fechamento do mês", "Pessoas", "Visualizar como colaborador"]) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /Modo de visualização — somente leitura/);
  assert.doesNotMatch(app, />Prestador</);
});
```

- [ ] **Step 2: Run the test and verify legacy names fail it**

Run: `node --test tests/developer-view-contract.test.mjs`

Expected: FAIL because `Equipe`, `Visão geral` and `Prestador` are still primary labels.

- [ ] **Step 3: Split role-specific navigation without changing backend roles**

Use role-specific items:

```ts
const rhNav = [
  ["overview", "Painel"], ["entries", "Lançamentos"], ["requests", "Aprovações"],
  ["closing", "Fechamento do mês"], ["team", "Pessoas"], ["reports", "Relatórios"],
] as const;
const collaboratorNav = [["entries", "Meu mês"], ["balance", "Banco de horas"], ["requests", "Solicitações"]] as const;
```

Add `"closing"` to `Section`. Keep `PJ`, `rh` and `pj` internal identifiers unchanged.

- [ ] **Step 4: Rename visible people terminology**

Change visible copy only:

```tsx
<h1>Pessoas</h1>
<p>Cadastros, acesso e situação dos colaboradores.</p>
<button className="primary-button">+ Novo colaborador</button>
```

Update `AdminView` labels from `Prestador PJ` to `Colaborador` while its select value remains `PJ`.

- [ ] **Step 5: Make the Developer toggle unambiguous**

```tsx
<button className={viewMode === "rh" ? "active" : ""}>Visão RH</button>
<button className={viewMode === "pj" ? "active" : ""}>Visualizar como colaborador</button>
```

Banner copy:

```tsx
<span>VISUALIZAÇÃO DEV</span>
<strong>Você está vendo o Horus como {selectedName}</strong>
<p>Modo de visualização — somente leitura. Nenhuma ação será realizada em nome desta pessoa.</p>
```

- [ ] **Step 6: Run focused tests, lint, and type-check**

Run: `node --test tests/developer-view-contract.test.mjs tests/rendered-html.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit the information architecture**

```bash
git add app/HorusViews.tsx app/HorusApp.tsx app/AdminView.tsx tests/rendered-html.test.mjs tests/developer-view-contract.test.mjs
git commit -m "feat: clarify Horus roles and navigation"
```

### Task 5: Add the read-only monthly closing workspace

**Files:**
- Create: `app/ClosingOverview.tsx`
- Modify: `app/HorusApp.tsx`
- Modify: `app/HorusViews.tsx`
- Modify: `app/globals.css`
- Modify: `app/api/timesheets/route.ts`
- Create: `db/feature-flags.ts`
- Create: `tests/closing-read-only.test.mjs`

**Interfaces:**
- Consumes: `DashboardData.contractors`, selected monthly period, `HORUS_MONTH_CLOSING_WRITE_ENABLED`.
- Produces: `ClosingOverview({ data })` with open/closed groups; legacy write route returns 503 unless the server flag is exactly `true`.

- [ ] **Step 1: Write failing tests for read-only closing**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClosingOverview } from "../app/ClosingOverview.tsx";
import { POST } from "../app/api/timesheets/route.ts";
import { makeDashboard } from "./fixtures/dashboard.mjs";

test("closing workspace is visible but writes are disabled by default", async () => {
  delete process.env.HORUS_MONTH_CLOSING_WRITE_ENABLED;
  const view = renderToStaticMarkup(createElement(ClosingOverview, { data: makeDashboard() }));
  assert.match(view, /Somente conferência/);
  assert.match(view, /Nenhum dado será alterado nesta tela/);
  assert.doesNotMatch(view, /<button|Fechar todos/);
  const response = await POST(new Request("https://horuscodex.vercel.app/api/timesheets", { method: "POST" }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "O fechamento está temporariamente disponível somente para conferência." });
});
```

- [ ] **Step 2: Run the test and verify missing files**

Run: `node --test tests/closing-read-only.test.mjs`

Expected: FAIL with `ENOENT` for `ClosingOverview.tsx`.

- [ ] **Step 3: Implement the server-only feature flag**

```ts
export function monthClosingWriteEnabled() {
  return process.env.HORUS_MONTH_CLOSING_WRITE_ENABLED === "true";
}
```

At the start of `POST /api/timesheets`, before reading the body:

```ts
if (!monthClosingWriteEnabled()) {
  return Response.json({ error: "O fechamento está temporariamente disponível somente para conferência." }, { status: 503 });
}
```

- [ ] **Step 4: Implement the closing overview without action callbacks**

```tsx
import type { DashboardData } from "./dashboard-types";
import { monthLabel } from "./HorusViews";

export function ClosingOverview({ data }: { data: DashboardData }) {
  const closed = data.contractors.filter((person) => person.timesheetStatus === "CLOSED");
  const open = data.contractors.filter((person) => person.status === "ACTIVE" && person.timesheetStatus !== "CLOSED");
  return <>
    <section className="page-heading">
      <div><span className="eyebrow">SOMENTE CONFERÊNCIA</span><h1>Fechamento do mês</h1>
        <p>{monthLabel(data.period)} · Nenhum dado será alterado nesta tela.</p></div>
    </section>
    <section className="closing-groups">
      <ClosingGroup title="Em aberto" people={open} empty="Nenhum mês em aberto." />
      <ClosingGroup title="Mês fechado" people={closed} empty="Nenhum mês fechado neste período." />
    </section>
  </>;
}
```

`ClosingGroup` displays name, current state and hours considered. It has no buttons.

- [ ] **Step 5: Remove legacy closing actions from People**

Delete `onTimesheet` from `TeamView`, remove `timesheetAction` from `HorusApp`, and render:

```tsx
{section === "closing" && role === "rh" && <ClosingOverview data={dashboard} />}
```

- [ ] **Step 6: Style with existing tokens and responsive patterns**

Add only classes for `.closing-groups`, `.closing-group`, and `.closing-person-row`, using existing `--panel`, `--line`, `--ink`, `--muted`, `--green` and `--amber` tokens. At `max-width: 800px`, stack the groups into one column.

- [ ] **Step 7: Run focused and complete checks**

Run: `node --test tests/closing-read-only.test.mjs tests/people-history-protection.test.mjs`

Expected: PASS.

Run: `npm run lint && npm test`

Expected: PASS.

- [ ] **Step 8: Commit the read-only workspace**

```bash
git add app/ClosingOverview.tsx app/HorusApp.tsx app/HorusViews.tsx app/globals.css app/api/timesheets/route.ts db/feature-flags.ts tests/closing-read-only.test.mjs
git commit -m "feat: add safe closing review workspace"
```

### Task 6: Protect state-changing routes against cross-origin requests

**Files:**
- Create: `db/request-security.ts`
- Create: `tests/request-security.test.mjs`
- Modify: every state-changing `app/api/**/route.ts` handler except GET-only routes.

**Interfaces:**
- Consumes: `Request` headers `origin`, `host`, `x-forwarded-host`, `x-forwarded-proto`.
- Produces: `sameOriginFailure(request): Response | null`.

- [ ] **Step 1: Write failing unit tests for allowed and rejected origins**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { sameOriginFailure } from "../db/request-security.ts";

test("accepts the public request origin behind a trusted proxy", () => {
  const request = new Request("http://internal/api/team", { method: "POST", headers: {
    origin: "https://horuscodex.vercel.app", host: "internal",
    "x-forwarded-host": "horuscodex.vercel.app", "x-forwarded-proto": "https",
  }});
  assert.equal(sameOriginFailure(request), null);
});

test("rejects a cross-origin state change", async () => {
  const request = new Request("https://horuscodex.vercel.app/api/team", { method: "POST", headers: {
    origin: "https://evil.example", host: "horuscodex.vercel.app",
  }});
  const response = sameOriginFailure(request);
  assert.equal(response?.status, 403);
  assert.deepEqual(await response?.json(), { error: "Origem da solicitação não autorizada." });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --test tests/request-security.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the origin guard**

```ts
function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

export function sameOriginFailure(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return Response.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  const url = new URL(request.url);
  const host = firstHeaderValue(request.headers.get("x-forwarded-host")) || request.headers.get("host") || url.host;
  const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto")) || url.protocol.replace(":", "");
  const expected = `${protocol}://${host}`;
  return origin === expected || origin === url.origin
    ? null
    : Response.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
}
```

- [ ] **Step 4: Apply the guard as the first line of every POST/PATCH handler**

Use this exact pattern:

```ts
const originFailure = sameOriginFailure(request);
if (originFailure) return originFailure;
```

Apply it to business and auth POST/PATCH routes. GET routes and the OAuth callback GET remain unchanged.

- [ ] **Step 5: Run security, API, and full checks**

Run: `node --test tests/request-security.test.mjs`

Expected: PASS.

Run: `npm run lint && npx tsc --noEmit && npm test`

Expected: PASS.

- [ ] **Step 6: Commit same-origin protection**

```bash
git add db/request-security.ts app/api tests/request-security.test.mjs
git commit -m "security: require same-origin state changes"
```

### Task 7: Final verification and foundation handoff

**Files:**
- Modify: `README.md`
- Create: `docs/runbooks/safe-workflow-foundation.md`

**Interfaces:**
- Consumes: outputs from Tasks 1–6.
- Produces: explicit release boundary: local foundation ready; database/backend plan still required; production remains blocked.

- [ ] **Step 1: Document the foundation boundary**

Add to `README.md`:

```md
## Fechamento mensal seguro

O novo espaço de fechamento inicia em modo somente conferência. Escritas permanecem bloqueadas por padrão por `HORUS_MONTH_CLOSING_WRITE_ENABLED`. A proteção do histórico, a consulta de baseline e a sequência das próximas etapas estão no runbook da fundação segura.
```

- [ ] **Step 2: Write the runbook with exact go/no-go checks**

The runbook must require:

```md
- [ ] `npm run test:safety` passou.
- [ ] `npm run lint` passou.
- [ ] `npx tsc --noEmit` passou.
- [ ] `npm test` passou.
- [ ] Não existe handler `DELETE` para pessoas.
- [ ] O fechamento real responde 503 com a flag ausente.
- [ ] DEV alterna entre Visão RH e simulação somente leitura.
- [ ] Pessoa inativa com histórico aparece no período correspondente.
- [ ] Nenhuma migração foi aplicada.
- [ ] Nenhum deploy de produção foi realizado.
```

- [ ] **Step 3: Run the complete local verification**

Run: `npm run test:safety`

Run: `npm run lint`

Run: `npx tsc --noEmit`

Run: `npm test`

Run: `git diff --check`

Expected: every command PASS and no whitespace errors.

- [ ] **Step 4: Inspect the branch diff against main**

Run: `git diff --stat main...HEAD`

Run: `git diff --name-status main...HEAD`

Expected: only application, tests, read-only SQL and documentation; no migration file under `supabase/migrations`.

- [ ] **Step 5: Commit the verified handoff**

```bash
git add README.md docs/runbooks/safe-workflow-foundation.md
git commit -m "docs: record safe workflow foundation gate"
```

- [ ] **Step 6: Stop before database work**

Do not deploy and do not touch production. Present the verified branch, test evidence and diff. The next approved artifact is a separate plan for additive schema and transactional preview/close/reopen with the feature flag still off.
