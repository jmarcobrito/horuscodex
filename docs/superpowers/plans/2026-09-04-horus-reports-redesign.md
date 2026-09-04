# Horus Reports Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma Central de Relatórios clara e filtrável, com exportações CSV, Excel e PDF, setores controlados pelo RH e preservação integral dos dados históricos do Horus.

**Architecture:** A interface consulta uma API administrativa paginada e tipada; a API usa visões SQL somente de leitura para normalizar lançamentos, banco de horas e histórico sem regravar registros. Setores entram de forma aditiva no cadastro de usuários, enquanto a linguagem natural e as transformações de exportação ficam em módulos puros compartilhados para impedir divergências entre tela e arquivos.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase/Postgres, Node test runner, Vite `runnerImport`, ExcelJS 4.4.0 e pdf-lib 1.17.1.

**Spec:** `docs/superpowers/specs/2026-09-04-horus-reports-redesign-design.md`

## Global Constraints

- Preservar todos os lançamentos, versões, fechamentos, saldos, solicitações e registros de auditoria existentes.
- Relatórios são somente leitura e nunca alteram dados ao consultar, filtrar, paginar ou exportar.
- Não renomear nem regravar códigos históricos no banco; a linguagem natural é uma camada de apresentação.
- Mudanças de estrutura são aditivas, sem `delete`, `truncate`, recriação de tabela ou atualização em massa.
- RH, ADMIN e DEV consultam somente a própria organização; PJ não acessa relatórios administrativos.
- O perfil DEV mantém a Central de Relatórios na Visão RH e não a vê ao simular um colaborador.
- Tela e exportação usam os mesmos filtros, regras de classificação e textos naturais.
- O setor é a classificação atual e fixa do colaborador; não haverá histórico temporal nem cópia em lançamentos antigos.
- Colaboradores existentes permanecem com setor indefinido até o RH atribuir um setor.
- Nenhuma migração, push, pull request, merge ou publicação em produção ocorre sem a autorização correspondente.
- A nova tabela e as visões recebem privilégios explícitos para `service_role`, RLS quando aplicável e nenhum acesso de `anon` ou `authenticated`.
- Excel armazena datas, horários e durações como valores tipados; códigos e identificadores ficam apenas em rastreabilidade técnica.
- A interface preserva as cores, tipografia, componentes e navegação global já usadas pelo Horus.

---

## File map

### Banco e segurança

- Create via Supabase CLI: `supabase/migrations/<timestamp>_reporting_foundation.sql` — tabela de setores, vínculo opcional do usuário, índices, visões administrativas somente de leitura e privilégios explícitos.
- Modify: `db/history-baseline.ts` — assinatura de todos os conjuntos históricos protegidos.
- Create: `tests/reporting-migration-contract.test.mjs` — contrato estático contra operações destrutivas e permissões incorretas.
- Create: `tests/backend/reporting-foundation-fixture.sql` — dados fictícios isolados para setores e relatórios.
- Create: `tests/backend/reporting-foundation-cases.mjs` — verificação SQL de integridade, isolamento e consulta das visões.

### Domínio e consulta

- Create: `app/reports/report-types.ts` — contratos discriminados de filtros, linhas, opções, resumos e paginação.
- Create: `app/reports/report-language.ts` — tradução única de ações, entidades, situações e movimentações.
- Create: `db/reports.ts` — validação dos filtros, consultas paginadas e carregamento completo para exportação.
- Create: `app/api/reports/route.ts` — endpoint JSON somente de leitura.
- Modify: `app/api/reports/export/route.ts` — roteador de formatos e pacote completo.
- Modify: `db/dashboard.ts` — remover o carregamento ilimitado de auditoria do painel.
- Modify: `app/dashboard-types.ts` — remover `DashboardAudit` e acrescentar setor atual ao colaborador.
- Modify: `tests/helpers/read-boundary.mjs` — simulação das novas visões, setores e filtros.
- Modify: `tests/helpers/read-harness.ts` — exportar a API e o leitor de relatórios reais para os ensaios.

### Exportação

- Modify: `package.json` and `package-lock.json` — dependências exatas `exceljs@4.4.0` e `pdf-lib@1.17.1`.
- Create: `db/report-export-model.ts` — dados comuns para todos os formatos e proteção contra fórmulas em CSV.
- Create: `db/report-csv.ts` — CSV UTF-8 em português.
- Create: `db/report-excel.ts` — relatório atual e pacote completo em XLSX.
- Create: `db/report-pdf.ts` — PDF resumido paginado.

### Interface e administração

- Create: `app/reports/report-client.ts` — serialização dos filtros, consulta abortável e download.
- Create: `app/reports/ReportsView.tsx` — composição da Central de Relatórios.
- Create: `app/reports/ReportFilters.tsx` — período, pessoa, setor, tipo e responsável.
- Create: `app/reports/ReportTable.tsx` — tabela contextual, expansão técnica para DEV e paginação.
- Create: `app/reports/ExportMenu.tsx` — quatro opções de exportação e estados de progresso.
- Create: `app/AdministrationView.tsx` — abas Setores, Políticas e Acessos.
- Create: `app/SectorsPanel.tsx` — lista, criação, edição e inativação de setores.
- Create: `app/api/sectors/route.ts` — leitura e manutenção controlada de setores.
- Modify: `app/AdminView.tsx` — tornar o controle exclusivo DEV um painel interno de Acessos.
- Modify: `app/admin-types.ts` — tipos de setores e da resposta administrativa.
- Modify: `app/HorusViews.tsx` — remover o relatório antigo e acrescentar setor/edição em Pessoas.
- Modify: `app/HorusApp.tsx` — estados, rotas e navegação da nova Central e Administração.
- Modify: `app/globals.css` — layout responsivo, estados, filtros, tabela, exportação e abas.
- Modify: `tests/fixtures/dashboard.mjs` — setor atual nas pessoas fictícias.

---

### Task 1: Contratos e linguagem natural dos relatórios

**Files:**
- Create: `app/reports/report-types.ts`
- Create: `app/reports/report-language.ts`
- Create: `tests/report-language.test.mjs`

**Interfaces:**
- Consumes: códigos já gravados por `supabase/migrations/20260903171101_monthly_write_protection.sql`, `app/api/team/route.ts`, `app/api/policies/route.ts` e `app/api/admin/users/route.ts`.
- Produces: `ReportKind`, `ReportFilters`, `ReportResponse`, `ReportRow`, `actionLabel`, `entityLabel`, `relatedRecordLabel`, `balanceMovementLabel`, `entrySituationLabel`, `historyCategory` e `safeUnknownActionLabel`.

- [ ] **Step 1: Write the failing language and type contract test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { runnerImport } from "vite";

const { module: language } = await runnerImport("./app/reports/report-language.ts", { configFile: false });

test("all actions currently produced by Horus have natural labels and categories", () => {
  const actions = [
    "TIME_ENTRY_CREATED", "TIME_ENTRY_UPDATED", "TIMESHEET_CLOSED", "TIMESHEET_REOPENED",
    "NON_BUSINESS_AUTH_REQUESTED", "NON_BUSINESS_AUTH_APPROVE", "NON_BUSINESS_AUTH_REJECT", "NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT",
    "OCCURRENCE_CREATED_APPROVED", "OCCURRENCE_REQUESTED", "OCCURRENCE_APPROVE", "OCCURRENCE_REJECT", "OCCURRENCE_CANCEL",
    "LEAVE_REQUEST_CREATED", "LEAVE_REQUEST_APPROVE", "LEAVE_REQUEST_REJECT", "LEAVE_REQUEST_CANCEL", "LEAVE_REQUEST_UTILIZE",
    "CONTRACTOR_CREATED", "CONTRACTOR_PASSWORD_SET", "CONTRACTOR_STATUS_CHANGED", "CONTRACTOR_SECTOR_CHANGED",
    "USER_PASSWORD_SET", "USER_ROLE_CHANGED", "USER_STATUS_CHANGED", "ORGANIZATION_POLICY_CHANGED",
    "SECTOR_CREATED", "SECTOR_UPDATED", "SECTOR_STATUS_CHANGED",
  ];
  for (const action of actions) {
    assert.doesNotMatch(language.actionLabel(action), /^[A-Z0-9_]+$/);
    assert.notEqual(language.historyCategory(action), "unknown");
  }
  assert.equal(language.actionLabel("UNRECOGNIZED_CODE"), "Registrou uma alteração no Horus");
  assert.equal(language.entityLabel("TimeEntry"), "Lançamento de horas");
  assert.equal(language.balanceMovementLabel("CONSUMPTION"), "Utilização");
});
```

- [ ] **Step 2: Run the language test and verify that it fails because the modules do not exist**

Run: `node --test tests/report-language.test.mjs`

Expected: FAIL resolving `app/reports/report-language.ts`.

- [ ] **Step 3: Define the discriminated report contracts**

```ts
export type ReportKind = "entries" | "balances" | "history";
export type SectorFilter = "UNASSIGNED" | string | null;
export type ReportCategory = string | null;

export type ReportFilters = {
  kind: ReportKind;
  from: string;
  to: string;
  personId: string | null;
  sectorId: SectorFilter;
  category: ReportCategory;
  actorId: string | null;
  page: number;
  pageSize: 50;
};

export type ReportColumn = { key: string; label: string; technical?: boolean };
export type ReportOption = { value: string; label: string; description?: string };
export type ReportOptions = {
  people: ReportOption[];
  sectors: ReportOption[];
  actors: ReportOption[];
  categories: ReportOption[];
};

export type EntryReportRow = {
  id: string; workDate: string; personId: string; personName: string; sectorName: string;
  startTime: string; endTime: string; breakMinutes: number; workedMinutes: number;
  consideredMinutes: number; situation: string; notes: string;
};
export type BalanceReportRow = {
  id: string; createdAt: string; personId: string; personName: string; sectorName: string;
  movement: string; direction: "credit" | "debit" | "reservation" | "release" | "neutral";
  minutes: number; description: string; status: string;
};
export type HistoryReportRow = {
  id: string; createdAt: string; actorId: string; actorName: string; action: string;
  affectedPersonId: string | null; affectedPersonName: string; relatedRecord: string; reason: string;
  technical: { actionCode: string; entityType: string; entityId: string };
};
export type ReportRow = EntryReportRow | BalanceReportRow | HistoryReportRow;
export type ReportResponse = {
  kind: ReportKind; filters: ReportFilters; columns: ReportColumn[]; rows: ReportRow[];
  summary: Record<string, number>; options: ReportOptions;
  pagination: { page: number; pageSize: 50; total: number; pageCount: number };
};
```

- [ ] **Step 4: Implement the exhaustive natural-language maps and safe fallbacks**

```ts
const ACTION_LABELS: Record<string, string> = {
  TIME_ENTRY_CREATED: "Criou um lançamento de horas",
  TIME_ENTRY_UPDATED: "Alterou um lançamento de horas",
  TIMESHEET_CLOSED: "Fechou o mês do colaborador",
  TIMESHEET_REOPENED: "Reabriu o mês do colaborador",
  NON_BUSINESS_AUTH_REQUESTED: "Solicitou autorização para trabalhar em dia não útil",
  NON_BUSINESS_AUTH_APPROVE: "Aprovou o trabalho em dia não útil",
  NON_BUSINESS_AUTH_REJECT: "Recusou o trabalho em dia não útil",
  NON_BUSINESS_AUTH_NEEDS_ADJUSTMENT: "Solicitou ajuste na autorização de dia não útil",
  OCCURRENCE_CREATED_APPROVED: "Registrou e aprovou uma ocorrência",
  OCCURRENCE_REQUESTED: "Registrou uma ocorrência para análise",
  OCCURRENCE_APPROVE: "Aprovou uma ocorrência",
  OCCURRENCE_REJECT: "Recusou uma ocorrência",
  OCCURRENCE_CANCEL: "Cancelou uma ocorrência",
  LEAVE_REQUEST_CREATED: "Solicitou uma folga",
  LEAVE_REQUEST_APPROVE: "Aprovou uma folga",
  LEAVE_REQUEST_REJECT: "Recusou uma folga",
  LEAVE_REQUEST_CANCEL: "Cancelou uma folga",
  LEAVE_REQUEST_UTILIZE: "Registrou a utilização de uma folga",
  CONTRACTOR_CREATED: "Cadastrou um colaborador",
  CONTRACTOR_PASSWORD_SET: "Definiu a senha de um colaborador",
  CONTRACTOR_STATUS_CHANGED: "Alterou a situação de um colaborador",
  CONTRACTOR_SECTOR_CHANGED: "Alterou o setor de um colaborador",
  USER_PASSWORD_SET: "Redefiniu a senha de um usuário",
  USER_ROLE_CHANGED: "Alterou o perfil de um usuário",
  USER_STATUS_CHANGED: "Alterou a situação de um usuário",
  ORGANIZATION_POLICY_CHANGED: "Alterou uma política da organização",
  SECTOR_CREATED: "Criou um setor",
  SECTOR_UPDATED: "Alterou o nome de um setor",
  SECTOR_STATUS_CHANGED: "Alterou a situação de um setor",
};

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? "Registrou uma alteração no Horus";
}
```

Implement `historyCategory()` with these exact groups: `entries`, `closing`, `approval`, `request`, `registration`, `access`, `policy`, falling back to `unknown`. Implement entity and balance movement maps without exposing raw codes in their fallback.

Add `relatedRecordLabel(entityType: string, relatedDate: string | null, affectedPersonName: string | null): string`. It must return concise operational text such as `Lançamento de 18/08/2026 — Ana Silva` or `Fechamento de agosto de 2026 — Ana Silva`. For an unrecognized entity, return `Registro relacionado — Ana Silva`; when the person or date is unavailable, omit that fragment cleanly. Never expose the raw entity code in this label.

- [ ] **Step 5: Run the language test and verify it passes**

Run: `node --test tests/report-language.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the report contracts and language**

```bash
git add app/reports/report-types.ts app/reports/report-language.ts tests/report-language.test.mjs
git commit -m "feat: define linguagem dos relatorios"
```

### Task 2: Fundação aditiva do banco e prova de preservação

**Files:**
- Create via CLI: `supabase/migrations/<timestamp>_reporting_foundation.sql`
- Modify: `db/history-baseline.ts`
- Create: `tests/reporting-migration-contract.test.mjs`
- Create: `tests/backend/reporting-foundation-fixture.sql`
- Create: `tests/backend/reporting-foundation-cases.mjs`

**Interfaces:**
- Consumes: tabelas atuais `users`, `time_entries`, `monthly_timesheets`, `hour_balance_lots`, `hour_balance_transactions`, `leave_requests`, `occurrences`, `non_business_day_authorizations` e `audit_logs`.
- Produces: `sectors`, `users.sector_id`, `report_time_entries`, `report_balance_transactions`, `report_balance_lots` e `report_audit_events`.

- [ ] **Step 1: Write the failing migration safety contract**

```js
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("reporting foundation is additive and service-role only", async () => {
  const name = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
    .find(file => file.endsWith("_reporting_foundation.sql"));
  assert.ok(name);
  const sql = await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.sectors/i);
  assert.match(sql, /add column if not exists sector_id/i);
  assert.match(sql, /security_invoker\s*=\s*true/i);
  assert.match(sql, /grant select, insert, update on table public\.sectors to service_role/i);
  assert.match(sql, /revoke all on table public\.sectors from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
  for (const table of ["time_entries", "time_entry_versions", "monthly_timesheets", "hour_balance_lots", "hour_balance_transactions", "leave_requests", "occurrences", "non_business_day_authorizations", "audit_logs"]) {
    assert.doesNotMatch(sql, new RegExp(`\\b(insert into|update)\\s+public\\.${table}\\b`, "i"));
  }
});
```

- [ ] **Step 2: Run the contract and verify it fails because the migration does not exist**

Run: `node --test tests/reporting-migration-contract.test.mjs`

Expected: FAIL at `assert.ok(name)`.

- [ ] **Step 3: Ask the installed CLI for its current command shape and create the migration through the CLI**

Run:

```bash
npx supabase --version
npx supabase migration new reporting_foundation
```

Expected: the CLI creates exactly one file ending in `_reporting_foundation.sql`. Use the filename printed by the CLI in every remaining step of this task.

- [ ] **Step 4: Add sectors, the optional organization-safe foreign key and indexes**

```sql
begin;

create table if not exists public.sectors (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sectors_id_organization_unique unique (id, organization_id)
);

create unique index if not exists sectors_org_name_unique
  on public.sectors (organization_id, lower(btrim(name)));
create index if not exists sectors_org_status_name_idx
  on public.sectors (organization_id, status, name);

alter table public.users add column if not exists sector_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_sector_organization_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_sector_organization_fkey
      foreign key (sector_id, organization_id)
      references public.sectors(id, organization_id)
      on update cascade on delete restrict;
  end if;
end $$;

create index if not exists users_org_sector_idx
  on public.users (organization_id, sector_id);

create index if not exists report_entries_org_person_date_idx
  on public.time_entries (organization_id, contractor_id, work_date desc, id desc);
create index if not exists report_transactions_org_person_date_idx
  on public.hour_balance_transactions (organization_id, contractor_id, created_at desc, id desc);
create index if not exists report_audit_org_actor_date_idx
  on public.audit_logs (organization_id, user_id, created_at desc, id desc);
```

- [ ] **Step 5: Add security-invoker reporting views without storing copied data**

```sql
create or replace view public.report_time_entries
with (security_invoker = true) as
select e.id, e.organization_id, e.contractor_id as person_id, u.name as person_name,
       u.email as person_email, u.sector_id, coalesce(s.name, 'Sem setor definido') as sector_name,
       e.work_date, e.start_time, e.end_time, e.break_minutes, e.calculated_minutes,
       e.eligible_minutes, e.non_business_day_status, e.notes, e.created_at, e.updated_at,
       ((e.created_at at time zone org.timezone)::date > e.work_date) as is_retroactive,
       (length(btrim(e.notes)) > 0) as has_notes
from public.time_entries e
join public.organizations org on org.id = e.organization_id
join public.users u on u.id = e.contractor_id and u.organization_id = e.organization_id
left join public.sectors s on s.id = u.sector_id and s.organization_id = u.organization_id;

create or replace view public.report_balance_transactions
with (security_invoker = true) as
select t.id, t.organization_id, t.contractor_id as person_id, u.name as person_name,
       u.email as person_email, u.sector_id, coalesce(s.name, 'Sem setor definido') as sector_name,
       t.lot_id, l.type as lot_type, t.type, t.minutes, t.description,
       t.related_timesheet_id, t.related_leave_request_id, t.created_at,
       (t.created_at at time zone org.timezone)::date as event_date, l.status as lot_status
from public.hour_balance_transactions t
join public.organizations org on org.id = t.organization_id
join public.users u on u.id = t.contractor_id and u.organization_id = t.organization_id
left join public.sectors s on s.id = u.sector_id and s.organization_id = u.organization_id
left join public.hour_balance_lots l on l.id = t.lot_id and l.organization_id = t.organization_id;

create or replace view public.report_balance_lots
with (security_invoker = true) as
select l.id, l.organization_id, l.contractor_id as person_id, u.name as person_name,
       u.email as person_email, u.sector_id, coalesce(s.name, 'Sem setor definido') as sector_name,
       l.type, l.original_minutes, l.remaining_minutes, l.reserved_minutes,
       l.origin_date, l.deadline_date, l.status, l.created_at
from public.hour_balance_lots l
join public.users u on u.id = l.contractor_id and u.organization_id = l.organization_id
left join public.sectors s on s.id = u.sector_id and s.organization_id = u.organization_id;
```

Add the audit view with the exact subject-resolution order and category rules below. It reads current names/sectors while retaining the untouched historical action/entity codes for technical traceability.

```sql
create or replace view public.report_audit_events
with (security_invoker = true) as
with resolved as (
  select a.id, a.organization_id, a.user_id as actor_id, a.action,
         a.entity_type, a.entity_id, a.reason, a.previous_value, a.new_value, a.created_at,
         coalesce(
           nullif(a.new_value ->> 'contractor_id', ''),
           nullif(a.previous_value ->> 'contractor_id', ''),
           case when a.entity_type = 'User' then a.entity_id end,
           te.contractor_id, mt.contractor_id, bl.contractor_id,
           lr.contractor_id, oc.contractor_id, nb.contractor_id
         ) as affected_user_id,
         coalesce(te.work_date, make_date(mt.year, mt.month, 1), bl.origin_date, lr.start_date,
           oc.start_date, nb.work_date) as related_date,
         case
           when left(a.action, 11) = 'TIME_ENTRY_' then 'entries'
           when left(a.action, 10) = 'TIMESHEET_' then 'closing'
           when a.action = 'OCCURRENCE_CREATED_APPROVED'
             or right(a.action, 8) = '_APPROVE' or right(a.action, 7) = '_REJECT'
             or right(a.action, 17) = '_NEEDS_ADJUSTMENT' then 'approval'
           when a.action in ('NON_BUSINESS_AUTH_REQUESTED', 'OCCURRENCE_REQUESTED',
             'OCCURRENCE_CANCEL', 'LEAVE_REQUEST_CREATED', 'LEAVE_REQUEST_CANCEL',
             'LEAVE_REQUEST_UTILIZE') then 'request'
           when a.action = 'CONTRACTOR_CREATED' or a.action = 'CONTRACTOR_SECTOR_CHANGED'
             or left(a.action, 7) = 'SECTOR_' then 'registration'
           when a.action in ('CONTRACTOR_PASSWORD_SET', 'CONTRACTOR_STATUS_CHANGED')
             or left(a.action, 5) = 'USER_' then 'access'
           when a.action = 'ORGANIZATION_POLICY_CHANGED' then 'policy'
           else 'unknown'
         end as category
  from public.audit_logs a
  join public.organizations org on org.id = a.organization_id
  left join public.time_entries te
    on a.entity_type = 'TimeEntry' and te.id = a.entity_id and te.organization_id = a.organization_id
  left join public.monthly_timesheets mt
    on a.entity_type = 'MonthlyTimesheet' and mt.id = a.entity_id and mt.organization_id = a.organization_id
  left join public.hour_balance_lots bl
    on a.entity_type = 'HourBalanceLot' and bl.id = a.entity_id and bl.organization_id = a.organization_id
  left join public.leave_requests lr
    on a.entity_type = 'LeaveRequest' and lr.id = a.entity_id and lr.organization_id = a.organization_id
  left join public.occurrences oc
    on a.entity_type = 'Occurrence' and oc.id = a.entity_id and oc.organization_id = a.organization_id
  left join public.non_business_day_authorizations nb
    on a.entity_type = 'NonBusinessAuthorization' and nb.id = a.entity_id and nb.organization_id = a.organization_id
)
select r.*, (r.created_at at time zone org.timezone)::date as event_date,
       actor.name as actor_name, affected.name as affected_user_name,
       affected.sector_id,
       case when affected.id is null then 'Não identificado'
            else coalesce(sector.name, 'Sem setor definido') end as sector_name
from resolved r
join public.organizations org on org.id = r.organization_id
left join public.users actor
  on actor.id = r.actor_id and actor.organization_id = r.organization_id
left join public.users affected
  on affected.id = r.affected_user_id and affected.organization_id = r.organization_id
left join public.sectors sector
  on sector.id = affected.sector_id and sector.organization_id = affected.organization_id;
```

- [ ] **Step 6: Lock down every new object explicitly**

```sql
alter table public.sectors enable row level security;

revoke all on table public.sectors from public, anon, authenticated;
grant select, insert, update on table public.sectors to service_role;

revoke all on table public.report_time_entries, public.report_balance_transactions,
  public.report_balance_lots, public.report_audit_events from public, anon, authenticated;
grant select on table public.report_time_entries, public.report_balance_transactions,
  public.report_balance_lots, public.report_audit_events to service_role;

commit;
```

Do not grant `delete` on `sectors`. This follows the current Supabase requirement for explicit Data API grants and keeps the new views restricted to the server.

- [ ] **Step 7: Expand the read-only baseline to all protected historical datasets**

Add unions in `historyBaselineSql()` for `hour_balance_lots`, `hour_balance_transactions`, `leave_requests`, `occurrences`, `non_business_day_authorizations` and `leave_request_reservations`. Keep `begin transaction read only`, deterministic `order by id`, an MD5 signature, and `rollback`. Do not include `users` because the approved feature intentionally changes only `users.sector_id`.

- [ ] **Step 8: Add isolated SQL fixture and cases**

The fixture creates two organizations, one active and one inactive sector in each organization, users with and without a sector, one record in each report source and audit rows whose affected person is resolved both from JSON and from the referenced entity. Insert one audit row per action listed in Task 1 and compare the view category with the JavaScript `historyCategory()` result. The cases must also assert:

```js
assert.equal(query("select count(*) from public.time_entries where id='report-entry-a'"), "1");
assert.equal(query("select sector_name from public.report_time_entries where id='report-entry-a'"), "Engenharia");
assert.equal(query("select affected_user_id from public.report_audit_events where id='report-audit-old'"), "report-person-a");
assert.equal(query("select count(*) from public.report_time_entries where organization_id='other-report-org'"), "1");
const auditCountBefore = query("select count(*) from public.audit_logs where id like 'report-%'");
assert.equal(query("select count(*) from public.audit_logs where id like 'report-%'"), auditCountBefore);
```

Use only fictitious IDs prefixed with `report-`; the cleanup removes only those fixture rows from the isolated database.

- [ ] **Step 9: Run migration contract and isolated database tests**

Run:

```bash
node --test tests/reporting-migration-contract.test.mjs tests/history-safety-contract.test.mjs
node --test tests/backend/reporting-foundation-cases.mjs
```

Expected: PASS; the protected row counts and signatures are unchanged by the migration itself.

- [ ] **Step 10: Commit the additive foundation**

```bash
git add supabase/migrations db/history-baseline.ts tests/reporting-migration-contract.test.mjs tests/history-safety-contract.test.mjs tests/backend/reporting-foundation-fixture.sql tests/backend/reporting-foundation-cases.mjs
git commit -m "feat: add safe reporting foundation"
```

### Task 3: Setores controlados pelo RH

**Files:**
- Create: `app/api/sectors/route.ts`
- Modify: `app/api/team/route.ts`
- Modify: `app/dashboard-types.ts`
- Modify: `db/dashboard.ts`
- Create: `tests/sectors-api.test.mjs`
- Modify: `tests/request-security.test.mjs`
- Modify: `tests/helpers/read-boundary.mjs`

**Interfaces:**
- Consumes: `sectors`, `users.sector_id`, `requireActor`, `sameOriginFailure`, `cleanText`.
- Produces: `GET/POST/PATCH /api/sectors`, `PATCH /api/team` action `SET_SECTOR`, `DashboardContractor.sectorId` and `DashboardContractor.sectorName`.

- [ ] **Step 1: Write failing route tests for authorization, organization scope and audit**

```js
test("RH creates and inactivates sectors inside its organization", async () => {
  const created = await sectors.POST(request("POST", { name: "Engenharia" }));
  assert.equal(created.status, 201);
  assert.equal(boundary.tables.sectors.find(row => row.name === "Engenharia").organization_id, "test-org");
  assert.equal(boundary.tables.audit_logs.at(-1).action, "SECTOR_CREATED");

  const id = (await created.json()).id;
  const changed = await sectors.PATCH(request("PATCH", { id, name: "Engenharia", status: "INACTIVE", reason: "Reorganização interna" }));
  assert.equal(changed.status, 200);
  assert.equal(boundary.tables.sectors.find(row => row.id === id).status, "INACTIVE");
});

test("PJ cannot list or mutate sectors", async () => {
  boundary.tables.users.find(row => row.id === "test-rh").role = "PJ";
  assert.equal((await sectors.GET()).status, 403);
  assert.equal((await sectors.POST(request("POST", { name: "Arquitetura" }))).status, 403);
});

test("sector assignment rejects another organization and preserves time data", async () => {
  const before = structuredClone(boundary.tables.time_entries);
  const response = await team.PATCH(request("PATCH", { id: "person-0000", action: "SET_SECTOR", sectorId: "other-sector", reason: "Classificação" }));
  assert.equal(response.status, 400);
  assert.deepEqual(boundary.tables.time_entries, before);
});
```

- [ ] **Step 2: Run the sector route test and verify it fails**

Run: `node --test tests/sectors-api.test.mjs`

Expected: FAIL resolving `app/api/sectors/route.ts`.

- [ ] **Step 3: Implement the sector API with existing route conventions**

`GET` requires a non-PJ actor and returns all active/inactive sectors ordered by name. `POST` validates a trimmed name of 1–120 characters, creates an ID `sec_` plus `crypto.randomUUID()`, inserts only into `sectors`, and writes `SECTOR_CREATED`. `PATCH` requires a five-character reason, accepts only `ACTIVE` or `INACTIVE`, scopes the target to `actor.organizationId`, updates only `name`, `status` and `updated_at`, then writes `SECTOR_UPDATED` or `SECTOR_STATUS_CHANGED` with previous and new values.

Every write handler must begin with:

```ts
const originFailure = sameOriginFailure(request);
if (originFailure) return originFailure;
```

Every response must set `cache-control: private, no-store`; duplicate normalized names return 409 with “Já existe um setor com este nome.”

- [ ] **Step 4: Add the explicit `SET_SECTOR` branch to the team route**

```ts
if (body.action === "SET_SECTOR") {
  const sectorId = typeof body.sectorId === "string" && body.sectorId ? body.sectorId : null;
  const reason = cleanText(body.reason);
  if (reason.length < 5) return Response.json({ error: "Informe a justificativa da alteração." }, { status: 400 });
  const current = await admin.from("users").select("*")
    .eq("id", body.id).eq("organization_id", actor.organizationId).eq("role", "PJ").maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return Response.json({ error: "Colaborador não encontrado." }, { status: 404 });
  if (sectorId) {
    const sector = await admin.from("sectors").select("id").eq("id", sectorId)
      .eq("organization_id", actor.organizationId).eq("status", "ACTIVE").maybeSingle();
    if (sector.error) throw sector.error;
    if (!sector.data) return Response.json({ error: "Setor inválido ou inativo." }, { status: 400 });
  }
  const update = { sector_id: sectorId, updated_at: new Date().toISOString() };
  const changed = await admin.from("users").update(update).eq("id", body.id).eq("organization_id", actor.organizationId);
  if (changed.error) throw changed.error;
  const audit = await admin.from("audit_logs").insert({
    id: crypto.randomUUID(), organization_id: actor.organizationId, user_id: actor.id,
    action: "CONTRACTOR_SECTOR_CHANGED", entity_type: "User", entity_id: body.id,
    previous_value: current.data, new_value: { ...current.data, ...update }, reason,
  });
  if (audit.error) throw audit.error;
  return Response.json({ id: body.id, sectorId });
}
```

- [ ] **Step 5: Project the current sector into dashboard people without exposing other organizations**

Change the users select to the explicit relation:

```ts
.select("id,name,email,status,sector_id,sectors!users_sector_organization_fkey(name)", { count: "exact" })
```

Add `sectorId: string | null` and `sectorName: string` to `DashboardContractor`; map null as “Sem setor definido”. Do not change entries, timesheets, balances or historical rows.

- [ ] **Step 6: Add sector routes to the same-origin contract and run tests**

Run:

```bash
node --test tests/sectors-api.test.mjs tests/request-security.test.mjs tests/complete-reads.test.mjs
```

Expected: PASS, including `boundary.writes === 0` for dashboard/report reads.

- [ ] **Step 7: Commit sector management backend**

```bash
git add app/api/sectors/route.ts app/api/team/route.ts app/dashboard-types.ts db/dashboard.ts tests/sectors-api.test.mjs tests/request-security.test.mjs tests/helpers/read-boundary.mjs tests/complete-reads.test.mjs
git commit -m "feat: add controlled sectors"
```

### Task 4: Consulta paginada e filtrada no servidor

**Files:**
- Create: `db/reports.ts`
- Modify: `tests/helpers/read-boundary.mjs`
- Modify: `tests/helpers/read-harness.ts`
- Create: `tests/report-query.test.mjs`

**Interfaces:**
- Consumes: `ReportFilters`, reporting views from Task 2, labels from Task 1 and `HorusActor`.
- Produces: `parseReportFilters(searchParams)`, `getReportPage(actor, filters)`, `getAllReportRows(actor, filters)` and `getReportOptions(actor, kind)`.

- [ ] **Step 1: Write failing parser, scope, filter and pagination tests**

```js
test("report parser accepts only exact filters and fixes page size at 50", () => {
  const filters = parseReportFilters(new URLSearchParams("kind=entries&from=2026-08-01&to=2026-08-31&page=2&personId=person-0001"));
  assert.deepEqual(filters, {
    kind: "entries", from: "2026-08-01", to: "2026-08-31", page: 2, pageSize: 50,
    personId: "person-0001", sectorId: null, category: null, actorId: null,
  });
  assert.throws(() => parseReportFilters(new URLSearchParams("kind=entries&from=2026-09-31&to=2026-09-01")), /Período inválido/);
});

test("September entry report never returns August rows", async () => {
  const response = await getReportPage(rh, filters({ kind: "entries", from: "2026-09-01", to: "2026-09-30" }));
  assert.ok(response.rows.every(row => row.workDate.startsWith("2026-09-")));
  assert.equal(boundary.writes, 0);
  assert.equal(boundary.rpcCalls, 0);
});

test("person, sector, category and actor filters combine inside one organization", async () => {
  const response = await getReportPage(rh, filters({ kind: "history", personId: "person-0001", sectorId: "sector-engineering", category: "entries", actorId: "test-rh" }));
  assert.ok(response.rows.length > 0);
  assert.ok(response.rows.every(row => row.affectedPersonId === "person-0001" && row.actorId === "test-rh"));
});

test("report returns 50 newest rows and exact paging metadata", async () => {
  const response = await getReportPage(rh, filters({ kind: "history", page: 2 }));
  assert.equal(response.rows.length, 50);
  assert.deepEqual(response.pagination, { page: 2, pageSize: 50, total: 1105, pageCount: 23 });
});
```

- [ ] **Step 2: Run the report query test and verify it fails**

Run: `node --test tests/report-query.test.mjs`

Expected: FAIL resolving `db/reports.ts`.

- [ ] **Step 3: Implement strict filter parsing**

Use `validIsoDate` from `db/http.ts`. Accept only `entries`, `balances` and `history`; dates from 2000 through 2200; integer page from 1; fixed page size 50; IDs matching `/^[A-Za-z0-9_-]{1,200}$/`; `UNASSIGNED` as the sole special sector value. Ignore `actorId` unless kind is `history`. Reject a category not present in the exact allow-list for that kind.

```ts
export class ReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportInputError";
  }
}
```

```ts
export const REPORT_CATEGORIES = {
  entries: ["regular", "retroactive", "non_business", "with_notes"],
  balances: ["CREDIT", "DEBIT", "COMPENSATION", "RESERVATION", "RELEASE", "CONSUMPTION", "REVERSAL", "EXPIRATION", "ADJUSTMENT"],
  history: ["entries", "closing", "approval", "request", "registration", "access", "policy"],
} as const;
```

- [ ] **Step 4: Implement one query builder per report kind**

Each builder starts with `organization_id = actor.organizationId`, applies dates to `work_date` for entries and `event_date` for transactions/history, then optional `person_id`, `sector_id`, category and actor. `UNASSIGNED` applies `.is("sector_id", null)`; on history it also requires a non-null `affected_user_id` so unresolved legacy events are not mislabeled as people without a sector. Order by the timestamp/date descending and `id` descending, request `{ count: "exact" }`, and apply `.range((page - 1) * 50, page * 50 - 1)`.

Entries categories use exact predicates: `regular` means not retroactive and `non_business_day_status = NOT_APPLICABLE`; `retroactive` means `is_retroactive = true`; `non_business` means status differs from `NOT_APPLICABLE`; `with_notes` means `has_notes = true`.

- [ ] **Step 5: Map raw view rows into natural report rows and summaries**

```ts
function pagination(page: number, total: number) {
  return { page, pageSize: 50 as const, total, pageCount: Math.ceil(total / 50) };
}

function mapHistory(row: AuditViewRow): HistoryReportRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorName: row.actor_name ?? "Usuário não identificado",
    action: actionLabel(row.action),
    affectedPersonId: row.affected_user_id,
    affectedPersonName: row.affected_user_name ?? "Não identificado",
    relatedRecord: relatedRecordLabel(row.entity_type, row.related_date, row.affected_user_name),
    reason: row.reason ?? "",
    technical: { actionCode: row.action, entityType: row.entity_type, entityId: row.entity_id },
  };
}
```

For balance direction, `CREDIT` is credit, `DEBIT` is debit, `RESERVATION` is reservation, `RELEASE` is release, and `CONSUMPTION`/`EXPIRATION` are debit. `COMPENSATION` uses `lot_type`: reducing a credit is debit and reducing a debit is credit. `REVERSAL` and `ADJUSTMENT` remain neutral unless the stored row carries an unambiguous direction; never infer direction from free text. Keep stored minutes unchanged and expose direction separately.

- [ ] **Step 6: Load filter options with inactive historical values preserved**

Load all users in the organization with role PJ for `people`, all users for `actors`, and all sectors for `sectors`. Include status descriptions. Add `{ value: "UNASSIGNED", label: "Sem setor definido" }`. Only the selected report’s category choices are returned.

Before running the page query, validate a supplied `personId`, `sectorId` or `actorId` against these organization-scoped option sets. Reject a foreign, missing or inactive sector for administration writes; keep inactive sectors valid for historical report filtering. Throw `ReportInputError("Pessoa, setor ou responsável inválido para esta organização.")` instead of returning a misleading empty report for a foreign ID.

- [ ] **Step 7: Implement complete iteration for exports without silent truncation**

`getAllReportRows` repeatedly calls a private page reader with deterministic ordering and 500-row server batches. It verifies the exact count is stable and every ID is unique, matching the invariants in `readAllRows`; a changed/incomplete history throws `Incomplete history read` or `History changed during read` rather than exporting partial data.

- [ ] **Step 8: Run query tests**

Run: `node --test tests/report-query.test.mjs tests/complete-reads.test.mjs`

Expected: PASS; no read causes insert, update, delete or RPC.

- [ ] **Step 9: Commit the report query layer**

```bash
git add db/reports.ts tests/helpers/read-boundary.mjs tests/helpers/read-harness.ts tests/report-query.test.mjs tests/complete-reads.test.mjs
git commit -m "feat: add filtered report queries"
```

### Task 5: API JSON e retirada da auditoria ilimitada do dashboard

**Files:**
- Create: `app/api/reports/route.ts`
- Modify: `db/dashboard.ts`
- Modify: `app/dashboard-types.ts`
- Modify: `app/HorusApp.tsx`
- Modify: `tests/helpers/read-harness.ts`
- Create: `tests/report-route.test.mjs`
- Modify: `tests/complete-reads.test.mjs`
- Modify: `tests/fixtures/dashboard.mjs`

**Interfaces:**
- Consumes: `parseReportFilters`, `getReportPage`, `requireActor`.
- Produces: `GET /api/reports` returning `ReportResponse` with `cache-control: private, no-store`.

- [ ] **Step 1: Write failing API access and response tests**

```js
test("RH receives the normalized response and private no-store cache", async () => {
  const response = await reportsData.GET(new Request("https://horus.invalid/api/reports?kind=entries&from=2026-08-01&to=2026-08-31&page=1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.kind, "entries");
  assert.equal(body.filters.from, "2026-08-01");
  assert.equal(body.pagination.pageSize, 50);
});

test("PJ is blocked before report data is queried", async () => {
  boundary.tables.users.find(row => row.id === "test-rh").role = "PJ";
  const response = await reportsData.GET(new Request("https://horus.invalid/api/reports?kind=entries&from=2026-08-01&to=2026-08-31&page=1"));
  assert.equal(response.status, 403);
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run: `node --test tests/report-route.test.mjs`

Expected: FAIL resolving `app/api/reports/route.ts`.

- [ ] **Step 3: Implement the read-only JSON handler**

```ts
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role === "PJ") {
      return Response.json({ error: "Apenas o RH pode consultar relatórios." }, { status: 403 });
    }
    const filters = parseReportFilters(new URL(request.url).searchParams);
    const report = await getReportPage(actor, filters);
    return Response.json(report, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return reportFailure(error);
  }
}
```

Export `ReportInputError` from `db/reports.ts` and implement the route helper exactly as follows; nonexistent person/sector validation throws the same error type.

```ts
function reportFailure(error: unknown) {
  if (error instanceof ReportInputError) {
    return Response.json({ error: error.message }, { status: 400, headers: { "cache-control": "private, no-store" } });
  }
  return apiFailure(error, "report read");
}
```

- [ ] **Step 4: Remove audit data from the dashboard transport**

Delete `DashboardAudit`, `DashboardData.audits`, `AuditRow`, `auditsQuery`, its result slot and mapping from `db/dashboard.ts` and `app/dashboard-types.ts`. Remove only the dashboard read; do not alter `audit_logs`. Update empty dashboard fallbacks and fixtures so no client assumes `audits` exists.

- [ ] **Step 5: Prove the dashboard no longer fetches unlimited audit history**

Extend `tests/complete-reads.test.mjs`:

```js
test("dashboard does not load the administrative audit ledger", async () => {
  boundary.tables.audit_logs = Array.from({ length: 5000 }, (_, index) => ({ id: "audit-" + index }));
  const data = await getDashboardData(rh, { year: 2026, month: 8 });
  assert.equal("audits" in data, false);
  assert.equal(boundary.readsByTable.audit_logs ?? 0, 0);
});
```

Add `readsByTable` counting to the read boundary without changing production code.

- [ ] **Step 6: Run API and regression tests**

Run: `node --test tests/report-route.test.mjs tests/complete-reads.test.mjs tests/dashboard-summary.test.mjs tests/developer-view-contract.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the report endpoint and dashboard cleanup**

```bash
git add app/api/reports/route.ts db/dashboard.ts app/dashboard-types.ts app/HorusApp.tsx tests/helpers/read-harness.ts tests/report-route.test.mjs tests/complete-reads.test.mjs tests/fixtures/dashboard.mjs
git commit -m "feat: serve paginated reports"
```

### Task 6: Exportações CSV, Excel e PDF

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `db/report-export-model.ts`
- Create: `db/report-csv.ts`
- Create: `db/report-excel.ts`
- Create: `db/report-pdf.ts`
- Modify: `app/api/reports/export/route.ts`
- Create: `tests/report-export.test.mjs`

**Interfaces:**
- Consumes: `getAllReportRows`, common filters and natural labels.
- Produces: `buildCsv`, `buildCurrentWorkbook`, `buildCompleteWorkbook`, `buildSummaryPdf`, downloadable responses for `csv`, `xlsx`, `package` and `pdf`.

- [ ] **Step 1: Install exact server-side document dependencies and inspect the resulting audit**

Run:

```bash
npm install --save-exact exceljs@4.4.0 pdf-lib@1.17.1
npm audit --omit=dev
```

Expected: lockfile records exact direct versions. Do not use `npm audit fix --force`. Any high or critical production finding blocks this task until the dependency or override is changed and the audit passes the agreed security gate.

- [ ] **Step 2: Write failing export tests that open the generated files**

```js
test("CSV uses natural headers, UTF-8 BOM and neutralizes formulas", async () => {
  const bytes = buildCsv(entryExportFixture({ notes: "=HYPERLINK(\"https://example.invalid\")" }));
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.startsWith("\uFEFF"));
  assert.match(text, /Data trabalhada;Colaborador;Setor/);
  assert.match(text, /'=HYPERLINK/);
  assert.doesNotMatch(text, /TIME_ENTRY_|NOT_APPLICABLE/);
});

test("Excel current report has Summary, Data and Traceability sheets with typed values", async () => {
  const buffer = await buildCurrentWorkbook(entryExportFixture());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ["Resumo", "Dados", "Rastreabilidade"]);
  assert.ok(workbook.getWorksheet("Dados").getCell("A2").value instanceof Date);
  assert.equal(typeof workbook.getWorksheet("Dados").getCell("G2").value, "number");
  assert.equal(workbook.getWorksheet("Dados").views[0].state, "frozen");
});

test("PDF opens, contains pages and never includes technical codes", async () => {
  const fixture = historyExportFixture();
  assert.doesNotMatch(JSON.stringify(fixture.operationalRows), /TIME_ENTRY_CREATED|TimeEntry/);
  const bytes = await buildSummaryPdf(fixture);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
});
```

- [ ] **Step 3: Run the export test and verify it fails**

Run: `node --test tests/report-export.test.mjs`

Expected: FAIL resolving the exporter modules.

- [ ] **Step 4: Build one normalized export model**

`buildExportModel()` receives organization, authenticated actor, normalized filters, report response and generation timestamp. It returns title, filter labels, summary items, operational columns/rows and technical columns/rows. `safeSpreadsheetText()` prefixes a single quote for strings beginning with `=`, `+`, `-`, `@`, tab or carriage return. CSV, Excel and PDF must consume this same model.

- [ ] **Step 5: Implement CSV with Portuguese-compatible encoding**

Use semicolon separation, CRLF lines, RFC-style quote escaping and UTF-8 BOM. Dates use `dd/mm/yyyy`, timestamps use the organization timezone, durations use signed `hh:mm`. CSV contains only the current view and no technical columns.

- [ ] **Step 6: Implement the current-view workbook**

Use ExcelJS only on the server. Create `Resumo`, `Dados` and `Rastreabilidade`. Freeze the data header, enable `autoFilter`, set explicit widths and wrap text. Store dates as `Date`, durations as numeric days (`minutes / 1440`) with `[h]:mm;-[h]:mm`, and counts as numbers. Set `workbook.properties.date1904 = true` so negative durations remain visible. Technical IDs/codes appear only in `Rastreabilidade`; do not add formulas, macros, hyperlinks or external connections.

- [ ] **Step 7: Implement the complete workbook**

Create these exact sheets: `Resumo geral`, `Lançamentos`, `Banco de horas`, `Lotes e saldos`, `Histórico de alterações`, `Rastreabilidade`. Apply only period, person and sector to every dataset. Ignore the current contextual type and actor filter and state this rule in the export menu before download. Add totals by person and sector to `Resumo geral`.

- [ ] **Step 8: Implement the summarized PDF**

Use `PDFDocument.create()`, standard Helvetica/HelveticaBold, A4 portrait, page margins, header, footer, page number and deterministic line wrapping. Include organization, report title, filters, generation time, totals and compact groupings. Do not reproduce unlimited rows, identifiers, action codes or entity codes.

- [ ] **Step 9: Refactor the export route to strict formats**

Parse `format=csv|xlsx|package|pdf`, defaulting to `csv` only for backwards compatibility. Validate the same filters through `parseReportFilters`; block PJ; fetch all rows with stable-count validation; return 422 before generation when there are no rows. Use these content types:

```ts
const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  package: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;
```

All responses set `content-disposition` with a sanitized Portuguese filename and `cache-control: private, no-store`.

- [ ] **Step 10: Run export, query and complete-read tests**

Run: `node --test tests/report-export.test.mjs tests/report-query.test.mjs tests/complete-reads.test.mjs`

Expected: PASS. Inspect representative cells in every Excel sheet, parse both XLSX variants and load the PDF bytes.

- [ ] **Step 11: Commit the export formats**

```bash
git add package.json package-lock.json db/report-export-model.ts db/report-csv.ts db/report-excel.ts db/report-pdf.ts app/api/reports/export/route.ts tests/report-export.test.mjs
git commit -m "feat: add report export formats"
```

### Task 7: Central de Relatórios no cliente

**Files:**
- Create: `app/reports/report-client.ts`
- Create: `app/reports/ReportsView.tsx`
- Create: `app/reports/ReportFilters.tsx`
- Create: `app/reports/ReportTable.tsx`
- Create: `app/reports/ExportMenu.tsx`
- Modify: `app/HorusViews.tsx`
- Modify: `app/HorusApp.tsx`
- Create: `tests/report-client.test.mjs`
- Create: `tests/reports-view.test.mjs`

**Interfaces:**
- Consumes: `GET /api/reports`, export route, `PeriodPicker`, `SelectMenu`, current report types.
- Produces: `ReportsView({ period, onPeriodChange, request, isDev })`, abortable fetch, filters, contextual table, pagination and downloads.

- [ ] **Step 1: Write failing client query and race tests**

```js
test("query serializes exactly the visible filters", async () => {
  const filters = reportFilters({ kind: "history", personId: "person-1", sectorId: "sector-1", category: "entries", actorId: "rh-1", page: 3 });
  const query = reportQuery(filters);
  assert.equal(query.get("kind"), "history");
  assert.equal(query.get("personId"), "person-1");
  assert.equal(query.get("sectorId"), "sector-1");
  assert.equal(query.get("actorId"), "rh-1");
  assert.equal(query.get("page"), "3");
});

test("a late response cannot replace the newest filter selection", async () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
  };
  const augustResponse = deferred();
  const septemberResponse = deferred();
  const request = url => url.includes("from=2026-08-01") ? augustResponse.promise : septemberResponse.promise;
  const controller = createReportLoader(request);
  const august = controller.load(reportFilters({ from: "2026-08-01", to: "2026-08-31" }));
  const september = controller.load(reportFilters({ from: "2026-09-01", to: "2026-09-30" }));
  septemberResponse.resolve(Response.json(reportFixture({ from: "2026-09-01", to: "2026-09-30" })));
  await september;
  augustResponse.resolve(Response.json(reportFixture({ from: "2026-08-01", to: "2026-08-31" })));
  await august;
  assert.equal(controller.current().filters.from, "2026-09-01");
});
```

- [ ] **Step 2: Run client tests and verify they fail**

Run: `node --test tests/report-client.test.mjs tests/reports-view.test.mjs`

Expected: FAIL resolving the new client modules.

- [ ] **Step 3: Implement query serialization and abortable loading**

`reportQuery()` serializes only non-null filters. `createReportLoader()` assigns a monotonically increasing request ID, aborts the previous request and commits a response only when its normalized filters match the request and its ID is still current. Distinguish `loading`, `empty`, `error` and `ready`; an error never becomes an empty result.

- [ ] **Step 4: Build the report tabs and visible guidance**

The tablist contains exactly:

```ts
const REPORT_TABS = [
  { value: "entries", label: "Lançamentos de horas", description: "Confira os horários registrados, as horas calculadas e as observações de cada dia." },
  { value: "balances", label: "Banco de horas", description: "Acompanhe créditos, débitos, reservas, utilizações, liberações e vencimentos." },
  { value: "history", label: "Histórico de alterações", description: "Veja quem realizou cada ação, quando aconteceu e qual pessoa ou registro foi afetado." },
] as const;
```

Use `role="tablist"`, `role="tab"`, `aria-selected` and one `role="tabpanel"`. Changing tab keeps period/person/sector, clears incompatible category/actor, resets page to 1 and starts one new request.

- [ ] **Step 5: Build the filter bar**

Render `PeriodPicker` inside ReportsView, followed by Pessoa, Setor and Tipo. “Quem realizou a ação” appears in “Mais filtros” only for history. Selected filters appear as removable text chips and “Limpar filtros” resets person, sector, type, actor and page while preserving the selected period and tab. Every filter change resets page to 1.

- [ ] **Step 6: Build contextual summaries, tables and paging**

Entries show worked and considered totals; balances show credit, debit, reserve and utilization; history shows count and affected people. Render only columns supplied by the response. History technical details are inside an expandable `<details>` shown only when `isDev` is true. Pagination reads “Resultados X–Y de Z” and provides Previous/Next with accessible labels.

- [ ] **Step 7: Build the export menu**

Offer exact labels: “Excel — relatório atual”, “Excel — pacote completo”, “CSV — relatório atual” and “PDF — resumo”. Keep one `exporting` format, disable repeated clicks and report success/failure through an `aria-live` status. Before package export, show “O pacote usa período, pessoa e setor; o filtro Tipo vale somente para a aba atual.” Use the same `reportQuery(filters)` and change only `format`.

- [ ] **Step 8: Replace the old ReportsView integration**

Remove `ReportsView` and `ReportCard` from `app/HorusViews.tsx`. Import the new component in `HorusApp.tsx`. Stop rendering the top-level `PeriodPicker` for `section === "reports"`; pass that section’s period into the new component and route period changes through the existing workspace `changePeriod`, preserving an independent report period.

- [ ] **Step 9: Render static accessibility and copy assertions**

`tests/reports-view.test.mjs` renders the initial state and asserts the three natural tab names, filter labels, export labels, loading message and absence of `TIME_ENTRY_CREATED`, `TimeEntry` and “Auditoria” as the primary tab name.

- [ ] **Step 10: Run client and developer-contract tests**

Run: `node --test tests/report-client.test.mjs tests/reports-view.test.mjs tests/developer-view-contract.test.mjs tests/workspace-state.test.mjs`

Expected: PASS; DEV sees Reports in RH view and collaborator simulation does not render it.

- [ ] **Step 11: Commit the Central de Relatórios UI**

```bash
git add app/reports app/HorusViews.tsx app/HorusApp.tsx tests/report-client.test.mjs tests/reports-view.test.mjs tests/developer-view-contract.test.mjs tests/workspace-state.test.mjs
git commit -m "feat: build report center"
```

### Task 8: Administração de setores, políticas e acessos

**Files:**
- Create: `app/AdministrationView.tsx`
- Create: `app/SectorsPanel.tsx`
- Modify: `app/AdminView.tsx`
- Modify: `app/admin-types.ts`
- Modify: `app/HorusViews.tsx`
- Modify: `app/HorusApp.tsx`
- Modify: `tests/fixtures/dashboard.mjs`
- Create: `tests/administration-view.test.mjs`
- Modify: `tests/developer-view-contract.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: sector API, team `SET_SECTOR`, policy modal/route and existing DEV access controls.
- Produces: Administration visible to RH/ADMIN/DEV in RH view; Acessos remains exclusive to the real DEV account.

- [ ] **Step 1: Write failing visibility and copy tests**

```js
test("RH administration exposes sectors and policies but not DEV access controls", async () => {
  const html = renderToStaticMarkup(createElement(AdministrationView, {
    isDev: false, sectors: sectorFixture(), adminData: null, policy: policyFixture(),
    loading: false, onCreateSector() {}, onUpdateSector() {}, onPolicy() {}, onRole() {}, onStatus() {}, onPassword() {}, onViewAs() {},
  }));
  assert.match(html, /Setores/);
  assert.match(html, /Políticas/);
  assert.doesNotMatch(html, /Controle de acesso|DEV PROTEGIDO/);
});

test("real DEV keeps access controls in RH view", async () => {
  const html = renderToStaticMarkup(createElement(AdministrationView, {
    isDev: true, sectors: sectorFixture(), adminData: makeAdminData(), policy: policyFixture(),
    loading: false, onCreateSector() {}, onUpdateSector() {}, onPolicy() {}, onRole() {}, onStatus() {}, onPassword() {}, onViewAs() {},
  }));
  assert.match(html, /Setores/);
  assert.match(html, /Políticas/);
  assert.match(html, /Acessos/);
});

test("people cards show current sector and an explicit edit action", async () => {
  const html = renderToStaticMarkup(createElement(TeamView, {
    data: makeDashboard(), onNew() {}, onEdit() {}, onStatus() {}, onSetPassword() {},
  }));
  assert.match(html, /Engenharia/);
  assert.match(html, /Editar colaborador/);
});
```

- [ ] **Step 2: Run administration tests and verify they fail**

Run: `node --test tests/administration-view.test.mjs tests/developer-view-contract.test.mjs`

Expected: FAIL resolving `AdministrationView.tsx`.

- [ ] **Step 3: Build Administration with clear role boundaries**

Remove `devOnly` from the Administration navigation item for RH mode. `AdministrationView` shows Setores and Políticas to every non-PJ account; it adds Acessos only when `accountRole === "dev"` and `viewMode === "rh"`. `AdminView` becomes the content of the Acessos tab and keeps all existing DEV protections unchanged.

- [ ] **Step 4: Build the sectors panel**

Load `GET /api/sectors` on Administration open. Show name, situation and number of assigned collaborators. “Novo setor” opens a modal with a 120-character name. Rename and inactivate require a five-character reason. Inactive sectors remain visible, may be reactivated and cannot be selected for a new assignment.

- [ ] **Step 5: Move policy access out of Reports**

Render “Configurar políticas” in the Políticas tab and reuse the existing policy modal and `/api/policies` handler. Remove the button from reports. Keep the existing warning that applying deadline policy to old open balances is a write action and requires confirmation.

- [ ] **Step 6: Add Edit collaborator with sector assignment**

Add `onEdit(person)` to `TeamView`. The modal shows name/email as identification and a `SelectMenu` with active sectors plus “Sem setor definido”. Saving calls:

```ts
await mutate("/api/team", "PATCH", {
  id: contractor.id,
  action: "SET_SECTOR",
  sectorId: selectedSectorId || null,
  reason,
}, "Setor do colaborador atualizado.");
```

The confirmation states that historical point records are not changed and reports associate them with the collaborator’s current sector.

- [ ] **Step 7: Run administration and regression tests**

Run: `node --test tests/administration-view.test.mjs tests/developer-view-contract.test.mjs tests/rendered-html.test.mjs tests/people-history-protection.test.mjs`

Expected: PASS. Existing password, status, role and view-as protections remain present.

- [ ] **Step 8: Commit administration and people integration**

```bash
git add app/AdministrationView.tsx app/SectorsPanel.tsx app/AdminView.tsx app/admin-types.ts app/HorusViews.tsx app/HorusApp.tsx tests/fixtures/dashboard.mjs tests/administration-view.test.mjs tests/developer-view-contract.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: organize sectors and policies"
```

### Task 9: Visual, responsividade e acessibilidade

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/browser/main.tsx`
- Modify: `tests/browser/preview.css`
- Create: `tests/reports-accessibility.test.mjs`

**Interfaces:**
- Consumes: semantic markup from Tasks 7 and 8 and the existing Horus design tokens.
- Produces: desktop/mobile layouts and a realistic isolated preview for RH and DEV.

- [ ] **Step 1: Write failing structural accessibility assertions**

The test must assert keyboard-operable tabs/buttons, associated labels, `aria-live` status, table headers with `scope="col"`, expandable DEV detail, and that filters/export remain outside the horizontally scrolling table container.

```js
assert.match(source, /role="tablist"/);
assert.match(source, /aria-selected/);
assert.match(source, /aria-live="polite"/);
assert.match(source, /scope="col"/);
assert.doesNotMatch(source, /onClick=\{[^}]+\}\s*\/?>\s*<div/);
```

- [ ] **Step 2: Run the accessibility test and verify it fails on missing final markup/styles**

Run: `node --test tests/reports-accessibility.test.mjs`

Expected: FAIL on at least one required semantic selector.

- [ ] **Step 3: Style the Central using existing tokens**

Add focused classes for `.reports-tabs`, `.report-filters`, `.filter-chips`, `.report-summary`, `.report-table`, `.report-pagination`, `.export-menu`, `.administration-tabs` and `.sector-list`. Reuse `--ink`, `--muted`, `--line`, `--soft-line`, existing purple actions, 8–14px radii and Sora headings. Do not introduce a new palette, font, icon system or decorative dashboard.

- [ ] **Step 4: Add responsive behavior**

At widths below 850px, allow tabs and chips to wrap and collapse secondary filters behind “Mais filtros”. At widths below 580px, keep period, primary filters and Exportar full-width; keep the table in its own `.table-scroll`; never require horizontal scrolling to choose filters, change tabs or export.

- [ ] **Step 5: Expand the isolated browser fixture**

Add realistic fictitious rows for all three report types, active/inactive sectors, person filters, no-results and server-error toggles. The preview request map must reject every unmocked/external URL and make no Supabase or production request.

- [ ] **Step 6: Run isolated preview and inspect required states**

Run: `npm run preview:workflow`

Inspect at 1440×900 and 390×844:

- Lançamentos default and filtered person;
- Banco de horas with credit/debit summaries;
- Histórico with “Quem realizou” and DEV technical details;
- empty, loading and error states;
- export menu;
- Administration Setores/Políticas and DEV Acessos.

Fix clipped text, overlap, inaccessible focus, missing labels, inconsistent spacing, table overflow and mobile action placement before continuing.

- [ ] **Step 7: Run accessibility and UI contracts**

Run: `node --test tests/reports-accessibility.test.mjs tests/reports-view.test.mjs tests/administration-view.test.mjs tests/developer-view-contract.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit the verified visual layer**

```bash
git add app/globals.css tests/browser/main.tsx tests/browser/preview.css tests/reports-accessibility.test.mjs
git commit -m "feat: finish report center experience"
```

### Task 10: Full verification and release gates

**Files:**
- Modify only if a test exposes a defect in files already covered by Tasks 1–9.

**Interfaces:**
- Consumes: the complete feature branch.
- Produces: evidence for review; this task does not authorize production changes.

- [ ] **Step 1: Verify the branch contains no unintended history writes**

Run:

```bash
git diff origin/main -- supabase/migrations db app tests
git diff origin/main --check
rg -n "\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b" supabase/migrations -g "*_reporting_foundation.sql"
```

Expected: only the documented new sector writes exist; report reads and exports contain no persistence calls; the destructive scan returns no match.

- [ ] **Step 2: Run the isolated full application verification**

Run: `npm run verify:workflow`

Expected: Vinext build, all top-level Node tests, ESLint, Next/Vercel build and TypeScript checks PASS inside the environment-stripped copy.

- [ ] **Step 3: Run the isolated backend suite and migration advisors**

Run:

```bash
node --test tests/backend/reporting-foundation-cases.mjs tests/backend/monthly-protection-cases.mjs tests/backend/release-cases.mjs
npx supabase db advisors --help
npx supabase db advisors
npx supabase migration list --local
```

Expected: backend tests PASS; no security or performance advisor error for new objects; migration list is ordered and complete. If the installed CLI does not provide `db advisors`, use the authenticated Supabase advisor tool and record its output in the review.

- [ ] **Step 4: Validate representative generated files**

Generate all four exports from fictitious data. Load both XLSX files with ExcelJS and inspect sheet names, row counts, typed dates/durations, filters, frozen headers and totals. Load the PDF with pdf-lib and verify page count. Decode CSV and verify BOM, accents, escaping and formula neutralization. No file may contain a raw action/entity code outside the Excel Rastreabilidade sheet.

- [ ] **Step 5: Compare protected history before and after an isolated migration**

Run `npm run history:baseline` immediately before and after applying the migration to an isolated clone. Compare dataset, row count, metrics and signature for every protected table. Any difference blocks the release review.

- [ ] **Step 6: Review the branch before any remote action**

Use `superpowers:requesting-code-review`. Address findings, rerun the narrow affected tests and then rerun `npm run verify:workflow`. Commit only verified fixes with a scoped message.

- [ ] **Step 7: Present preview and evidence to the user**

Present the working RH and DEV views, the four fictitious exports, test results, migration safety evidence and the exact list of database objects to be added. State explicitly that no production data has been changed.

- [ ] **Step 8: Stop at the production authorization gate**

Push the branch and open a pull request only after user authorization for the remote action. Merge only after CI/review approval. Apply the additive migration and deploy to Vercel only after a separate production authorization and a fresh read-only baseline. Production smoke checks are login, tab access, filter queries and export downloads only; do not create, edit, close, reopen or delete real records.

---

## Release order and rollback

1. Merge application code that tolerates a null sector and only uses new report objects after the migration is present in the target environment.
2. At the authorized production window, capture the read-only history baseline and current migration list.
3. Apply the additive reporting foundation; compare the protected baseline immediately.
4. If the baseline differs, stop before deploy and investigate from the pre-migration snapshot. Do not repair employee records manually.
5. Deploy the application only after the baseline matches and advisors are clear.
6. Smoke-test only reads and downloads at `https://horuscodex.vercel.app/`.
7. Application rollback uses the prior Vercel deployment. The new nullable column, sectors table and read-only views remain in place because the previous application ignores them; rollback never drops data or schema objects.

## Documentation references used by the implementer

- Supabase Data API security and explicit grants: `https://supabase.com/docs/guides/api/securing-your-api`
- Supabase security-invoker views: `https://supabase.com/docs/guides/database/tables#view-security`
- Supabase joins and nested filters: `https://supabase.com/docs/guides/database/joins-and-nesting`
- ExcelJS workbook API: `https://github.com/exceljs/exceljs#readme`
- pdf-lib document API: `https://pdf-lib.js.org/docs/api/classes/pdfdocument`
