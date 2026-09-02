# Horus Safe Month Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o novo fluxo de solicitações e fechamento mensal do Horus sem apagar nem reinterpretar o histórico existente do Supabase.

**Architecture:** O Postgres será a autoridade das regras críticas e executará pré-conferência, fechamento, consumo de folga, auditoria e reabertura em transações. As APIs Next.js autenticarão, validarão e traduzirão os códigos do domínio. A interface trabalhará com um modelo de pré-conferência explícito e linguagem orientada à tarefa.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase/Postgres 17, Supabase JS 2, Node test runner, CSS existente do Horus.

**Spec:** `C:/Users/danyel/Documents/Codex/2026-09-01/recordo-do-projeto-que-a-gente/outputs/horus-backend-validation/ESPECIFICACAO_ARQUITETURA.md`

## Global Constraints

- Nenhum comando destrutivo, `DROP TABLE`, `TRUNCATE`, `DELETE` de dados históricos ou reconstrução por aproximação.
- A migração `20260902093957_safe_month_closing.sql` deve ser aditiva e atômica.
- Registros antigos de um dia recebem distribuição diária determinística; registros antigos de vários dias recebem `NEEDS_REVIEW`.
- Alterações remotas começam em uma branch do Supabase e somente chegam à produção após backup restaurável, reconciliação e autorização de liberação.
- Uma folga aplicada abona o mês e consome o crédito reservado uma única vez.
- Operações críticas e sua auditoria concluem juntas ou sofrem rollback integral.
- Termos principais da interface: **Mês**, **Aguardando análise**, **Precisa de revisão**, **Pronto para fechar**, **Fechar mês** e **Fechar todos os prontos**.
- `service_role` permanece somente no servidor; novas tabelas têm RLS e nenhuma concessão para `PUBLIC`, `anon` ou `authenticated`.
- A implementação será inline; não usar subagentes.

---

### Task 1: Contratos de domínio e distribuição diária

**Files:**
- Create: `db/daily-allocation.ts`
- Create: `db/domain-errors.ts`
- Create: `tests/daily-allocation.test.mjs`
- Create: `tests/domain-errors.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `DailyAllocation`, `validateDailyAllocation(input)`, `DomainErrorCode`, `domainError(code, field?)`, `domainErrorResponse(error)`.
- Consumes: `validIsoDate` de `db/http.ts`.

- [ ] **Step 1: escrever testes que falham para distribuição diária**

```js
test("aceita horas informadas por dia quando datas e total conferem", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    totalMinutes: 720,
    days: [{ date: "2026-09-01", minutes: 480 }, { date: "2026-09-02", minutes: 240 }],
  }), { ok: true, days: [{ date: "2026-09-01", minutes: 480 }, { date: "2026-09-02", minutes: 240 }] });
});

test("rejeita soma diária diferente do total", () => {
  assert.deepEqual(validateDailyAllocation({
    startDate: "2026-09-01", endDate: "2026-09-02", totalMinutes: 720,
    days: [{ date: "2026-09-01", minutes: 480 }],
  }), { ok: false, code: "DAILY_TOTAL_MISMATCH", field: "days" });
});
```

- [ ] **Step 2: executar os testes e confirmar falha por módulos ausentes**

Run: `node --test tests/daily-allocation.test.mjs tests/domain-errors.test.mjs`

Expected: FAIL com `ERR_MODULE_NOT_FOUND` para os novos módulos.

- [ ] **Step 3: implementar validação e contrato de erros**

```ts
export type DailyAllocation = { date: string; minutes: number };

export function validateDailyAllocation(input: {
  startDate: unknown; endDate: unknown; totalMinutes: unknown; days: unknown;
}): DailyAllocationResult {
  // validar datas, intervalo, unicidade, 1..1440 minutos e soma literal
}

export type DomainErrorCode =
  | "DAILY_TOTAL_MISMATCH" | "DUPLICATE_DAY" | "DAY_OUTSIDE_PERIOD"
  | "MONTH_ALREADY_CLOSED" | "REVIEW_OUTDATED" | "NO_ENTRIES"
  | "PENDING_LEAVE" | "PENDING_OCCURRENCE" | "PENDING_NON_BUSINESS_AUTH"
  | "INCOMPLETE_DAILY_ALLOCATION" | "BALANCE_ALREADY_USED";
```

- [ ] **Step 4: executar testes de domínio e suíte completa**

Run: `node --test tests/daily-allocation.test.mjs tests/domain-errors.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: build e todos os testes PASS.

- [ ] **Step 5: versionar a unidade**

```bash
git add package.json db/daily-allocation.ts db/domain-errors.ts tests/daily-allocation.test.mjs tests/domain-errors.test.mjs
git commit -m "feat: add daily allocation domain contracts"
```

### Task 2: Migração aditiva e proteção do histórico

**Files:**
- Modify: `supabase/migrations/20260902093957_safe_month_closing.sql`
- Create: `supabase/tests/safe_month_closing_schema.sql`

**Interfaces:**
- Produces: `leave_request_days`, `occurrence_days`, `allocation_status`, reservas parcialmente consumíveis, snapshot v2 e índices da especificação.
- Consumes: tabelas e funções das quatro migrações existentes.

- [ ] **Step 1: escrever teste SQL de esquema antes da migração**

```sql
begin;
do $$
begin
  if to_regclass('public.leave_request_days') is null then
    raise exception 'leave_request_days missing';
  end if;
  if to_regclass('public.occurrence_days') is null then
    raise exception 'occurrence_days missing';
  end if;
end $$;
rollback;
```

- [ ] **Step 2: executar o teste na branch Supabase antes da migração**

Run: enviar `supabase/tests/safe_month_closing_schema.sql` por `execute_sql` para a branch de desenvolvimento.

Expected: FAIL com `leave_request_days missing`.

- [ ] **Step 3: implementar o esquema aditivo e o backfill determinístico**

```sql
begin;
alter table public.leave_requests
  add column if not exists allocation_status text not null default 'COMPLETE';
alter table public.occurrences
  add column if not exists allocation_status text not null default 'COMPLETE';
alter table public.leave_request_reservations
  add column if not exists consumed_minutes integer not null default 0;

create table if not exists public.leave_request_days (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete restrict,
  leave_request_id text not null references public.leave_requests(id) on delete restrict,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  application_status text not null default 'PENDING'
    check (application_status in ('PENDING','APPROVED','APPLIED','CANCELLED')),
  applied_timesheet_id text references public.monthly_timesheets(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (leave_request_id, work_date)
);

create table if not exists public.occurrence_days (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete restrict,
  occurrence_id text not null references public.occurrences(id) on delete restrict,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (occurrence_id, work_date)
);

insert into public.leave_request_days (
  id, organization_id, leave_request_id, work_date, minutes, application_status
)
select 'lrd_' || id, organization_id, id, start_date, requested_minutes,
  case status when 'REQUESTED' then 'PENDING' when 'APPROVED' then 'APPROVED'
    when 'UTILIZED' then 'APPLIED' when 'CANCELLED' then 'CANCELLED' else 'CANCELLED' end
from public.leave_requests
where start_date = end_date and requested_minutes > 0
on conflict (leave_request_id, work_date) do nothing;

update public.leave_requests
set allocation_status = 'NEEDS_REVIEW'
where start_date <> end_date or requested_minutes <= 0;

insert into public.occurrence_days (
  id, organization_id, occurrence_id, work_date, minutes
)
select 'ocd_' || id, organization_id, id, start_date, minutes
from public.occurrences
where start_date = end_date and minutes > 0
on conflict (occurrence_id, work_date) do nothing;

update public.occurrences
set allocation_status = 'NEEDS_REVIEW'
where start_date <> end_date or minutes <= 0;
commit;
```

No mesmo arquivo, adicionar exatamente:

```sql
alter table public.audit_logs add column if not exists actor_name text;
alter table public.audit_logs add column if not exists actor_email text;
update public.audit_logs a set actor_name = u.name, actor_email = u.email
from public.users u where u.id = a.user_id and a.actor_name is null;
alter table public.audit_logs alter column user_id drop not null;
alter table public.audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs add constraint audit_logs_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

alter table public.leave_request_days enable row level security;
alter table public.occurrence_days enable row level security;
revoke all on table public.leave_request_days, public.occurrence_days from public, anon, authenticated;
grant all on table public.leave_request_days, public.occurrence_days to service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

create index if not exists entry_timesheet_auth_date_idx
  on public.time_entries (timesheet_id, non_business_day_status, work_date);
create index if not exists leave_contractor_status_period_idx
  on public.leave_requests (organization_id, contractor_id, status, start_date, end_date);
create index if not exists leave_day_org_date_status_idx
  on public.leave_request_days (organization_id, work_date, application_status);
create index if not exists occurrence_contractor_status_period_idx
  on public.occurrences (organization_id, contractor_id, status, start_date, end_date);
create index if not exists occurrence_day_org_date_idx
  on public.occurrence_days (organization_id, work_date);
create index if not exists authorization_contractor_date_status_idx
  on public.non_business_day_authorizations (organization_id, contractor_id, work_date, status);
create index if not exists leave_reservation_lot_status_idx
  on public.leave_request_reservations (lot_id, status);
create index if not exists balance_transaction_timesheet_created_idx
  on public.hour_balance_transactions (related_timesheet_id, created_at);
create index if not exists balance_transaction_leave_created_idx
  on public.hour_balance_transactions (related_leave_request_id, created_at);
```

Trocar as chaves estrangeiras `contractor_id` que hoje usam `on delete cascade` em `monthly_timesheets`, `time_entries`, `hour_balance_lots`, `leave_requests`, `occurrences` e `non_business_day_authorizations` por `on delete restrict`, preservando os nomes atuais das constraints. Adicionar checks `allocation_status in ('COMPLETE','NEEDS_REVIEW')` e `consumed_minutes between 0 and minutes`.

- [ ] **Step 4: executar migração e teste de esquema na branch**

Run: aplicar a migração com o conector Supabase na branch; depois executar `safe_month_closing_schema.sql`.

Expected: migração concluída e teste PASS.

- [ ] **Step 5: reconciliar a branch antes e depois**

Run: consulta agregada de contagem por tabela e soma de `calculated_minutes`, `eligible_minutes`, `remaining_minutes` e `reserved_minutes`.

Expected: todas as contagens e somas históricas anteriores permanecem idênticas; apenas tabelas e colunas novas ganham dados derivados de registros de um dia.

- [ ] **Step 6: versionar a unidade**

```bash
git add supabase/migrations/20260902093957_safe_month_closing.sql supabase/tests/safe_month_closing_schema.sql
git commit -m "feat: add non-destructive daily allocation schema"
```

### Task 3: Pré-conferência, fechamento e reabertura transacionais

**Files:**
- Modify: `supabase/migrations/20260902093957_safe_month_closing.sql`
- Create: `supabase/tests/safe_month_closing_workflows.sql`
- Create: `db/timesheet-preview.ts`
- Create: `tests/timesheet-preview.test.mjs`

**Interfaces:**
- Produces RPCs `preview_timesheet_v2`, `close_timesheet_v2`, `reopen_timesheet_preview_v2`, `reopen_timesheet_v2`, `decide_occurrence_v2`, `decide_non_business_authorization_v2`.
- Produces TypeScript `TimesheetPreview`, `TimesheetBlocker`, `normalizeTimesheetPreview`.

- [ ] **Step 1: escrever testes SQL que reproduzem os riscos atuais**

O fixture deve criar uma organização e pessoa isoladas dentro de `begin/rollback` e verificar literalmente:

```sql
-- 154h trabalhadas + 8h de folga = 162h consideradas;
-- crédito antigo reduz exatamente 480 minutos;
-- não nasce débito adicional pelo mesmo afastamento;
-- mês vazio falha sem exceção e fecha com justificativa;
-- solicitação pendente bloqueia;
-- reviewVersion antigo falha;
-- reabertura falha quando o lote teve movimentação posterior.
```

- [ ] **Step 2: executar testes e confirmar falha por RPCs ausentes**

Run: enviar `safe_month_closing_workflows.sql` para a branch.

Expected: FAIL informando que `preview_timesheet_v2` não existe.

- [ ] **Step 3: implementar RPC de pré-conferência sem efeitos colaterais**

```sql
create or replace function public.preview_timesheet_v2(
  p_organization_id text, p_actor_id text, p_contractor_id text,
  p_year integer, p_month integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
-- validar ator, calcular horas, folgas, bloqueios, avisos e reviewVersion
$$;
```

- [ ] **Step 4: implementar fechamento v2 com revalidação e snapshot**

`close_timesheet_v2` deve bloquear mês e dependências, recalcular `reviewVersion`, aplicar somente parcelas do mês, consumir reservas exatamente uma vez, aceitar a exceção vazia apenas com justificativa e gravar `closure_snapshot` versão 2.

- [ ] **Step 5: implementar prévia e execução de reabertura**

`reopen_timesheet_preview_v2` será somente leitura. `reopen_timesheet_v2` usará o snapshot para estornar todos os efeitos ou retornar `BALANCE_ALREADY_USED` sem mudar dados.

- [ ] **Step 6: tornar decisões de ausência e autorização atômicas**

Substituir os fluxos de múltiplas chamadas por `decide_occurrence_v2` e `decide_non_business_authorization_v2`, incluindo recálculo e auditoria na mesma transação.

- [ ] **Step 7: executar testes SQL e normalização TypeScript**

Run: teste SQL completo na branch.

Expected: todos os cenários terminam sem exceção e o `rollback` remove apenas os fixtures.

Run: `node --test tests/timesheet-preview.test.mjs`

Expected: PASS para READY, NEEDS_REVIEW e CLOSED.

- [ ] **Step 8: versionar a unidade**

```bash
git add supabase/migrations/20260902093957_safe_month_closing.sql supabase/tests/safe_month_closing_workflows.sql db/timesheet-preview.ts tests/timesheet-preview.test.mjs
git commit -m "feat: add transactional month closing workflows"
```

### Task 4: APIs seguras e erros estruturados

**Files:**
- Modify: `db/http.ts`
- Modify: `app/api/leave-requests/route.ts`
- Modify: `app/api/occurrences/route.ts`
- Modify: `app/api/non-business-authorizations/route.ts`
- Modify: `app/api/timesheets/route.ts`
- Create: `app/api/timesheets/preview/route.ts`
- Create: `app/api/timesheets/close-batch/route.ts`
- Create: `app/api/timesheets/reopen-preview/route.ts`
- Create: `tests/api-contracts.test.mjs`

**Interfaces:**
- Consumes: RPCs v2 e `validateDailyAllocation`.
- Produces: respostas `{ error: { code, message, field, action } }`, preview individual, fechamento individual, resultado parcial em grupo e prévia de reabertura.

- [ ] **Step 1: escrever testes para payloads e traduções antes das rotas**

```js
test("traduz REVIEW_OUTDATED para ação de revisar novamente", () => {
  assert.deepEqual(domainErrorResponse({ code: "REVIEW_OUTDATED" }), {
    status: 409,
    body: { error: { code: "REVIEW_OUTDATED", message: "Os dados deste mês mudaram. Revise novamente antes de fechar.", field: null, action: "REVIEW_AGAIN" } },
  });
});
```

- [ ] **Step 2: executar testes e confirmar falha por contrato ainda antigo**

Run: `node --test tests/api-contracts.test.mjs`

Expected: FAIL porque `apiFailure` ainda retorna string simples.

- [ ] **Step 3: implementar erros estruturados e validação de sessão**

As rotas não aceitarão `organizationId` como autoridade do corpo; usarão `actor.organizationId`. O papel será validado antes da RPC e novamente no banco.

- [ ] **Step 4: substituir criação de folga e ausência por distribuição diária**

Remover `UTILIZE`, bloquear `BANK_LEAVE` em novas ocorrências e enviar as parcelas diárias às operações transacionais.

- [ ] **Step 5: implementar preview, fechamento individual, grupo e reabertura**

O fechamento em grupo chamará uma transação por pessoa e devolverá `closed`, `alreadyClosed`, `needsReview` ou `failed` sem desfazer sucessos anteriores.

- [ ] **Step 6: executar testes, lint e build**

Run: `node --test tests/api-contracts.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: 0 erros.

Run: `npm test`

Expected: build e testes PASS.

- [ ] **Step 7: versionar a unidade**

```bash
git add db/http.ts app/api/leave-requests/route.ts app/api/occurrences/route.ts app/api/non-business-authorizations/route.ts app/api/timesheets tests/api-contracts.test.mjs
git commit -m "feat: expose safe closing API contracts"
```

### Task 5: Leitura mensal e caixa de entrada coerentes

**Files:**
- Modify: `db/dashboard.ts`
- Modify: `app/dashboard-types.ts`
- Create: `db/approval-inbox.ts`
- Create: `tests/dashboard-model.test.mjs`

**Interfaces:**
- Produces: dashboard sem escrita, solicitações filtradas pelo período, `ApprovalInbox` com pendentes e histórico paginado, previews de fechamento por pessoa.
- Consumes: `normalizeTimesheetPreview` e RPC `preview_timesheet_v2`.

- [ ] **Step 1: escrever testes do modelo mensal**

Verificar que mês sem registro não aparece como aberto e pronto; que solicitações fora do mês não entram na lista mensal; e que a leitura não chama `refresh_hour_balance_statuses`.

- [ ] **Step 2: executar testes e confirmar o estado incorreto atual**

Run: `node --test tests/dashboard-model.test.mjs`

Expected: FAIL para mês inexistente tratado como `OPEN`.

- [ ] **Step 3: implementar modelo sem efeitos colaterais**

Remover a atualização de status do `GET`, consultar folgas por sobreposição de período e anexar os previews oficiais às pessoas quando o intervalo representar um único mês.

- [ ] **Step 4: executar testes e suíte completa**

Run: `node --test tests/dashboard-model.test.mjs && npm test`

Expected: todos PASS.

- [ ] **Step 5: versionar a unidade**

```bash
git add db/dashboard.ts db/approval-inbox.ts app/dashboard-types.ts tests/dashboard-model.test.mjs
git commit -m "feat: align monthly dashboard with closing preview"
```

### Task 6: Navegação, solicitações e Fechamento do mês

**Files:**
- Create: `app/ClosingView.tsx`
- Create: `app/DailyAllocationFields.tsx`
- Create: `app/ApprovalInboxView.tsx`
- Modify: `app/HorusViews.tsx`
- Modify: `app/HorusApp.tsx`
- Modify: `app/AdminView.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: seção RH `closing`, `ClosingView` e formulários diários; navegação do colaborador com Meu mês/Banco de horas/Solicitações; navegação RH com Painel/Lançamentos/Aprovações/Fechamento/Pessoas/Relatórios.
- Consumes: previews e APIs da Task 4.

- [ ] **Step 1: escrever testes de comportamento observável antes da UI**

Atualizar o teste renderizado para exigir as novas seções e para rejeitar **Marcar utilizada**, `BANK_LEAVE`, **Excluir permanentemente** e o uso principal de **Competência**.

- [ ] **Step 2: executar teste e confirmar falha com a interface antiga**

Run: `npm test`

Expected: FAIL nas novas expectativas de navegação e fechamento.

- [ ] **Step 3: implementar navegação e caixa de entrada**

Separar pendentes de histórico, incluir filtros claros e apresentar **Nova solicitação** com as três escolhas aprovadas.

- [ ] **Step 4: implementar formulários de distribuição diária**

Cada data do intervalo terá campo de horas; soma, dias duplicados e limites serão mostrados junto aos campos antes do envio.

- [ ] **Step 5: implementar Fechamento do mês**

Mostrar **Prontas para fechar**, **Precisam de revisão** e **Mês fechado**; permitir fechamento individual e **Fechar todos os prontos**; exibir impacto no banco, exceção de mês vazio e prévia de reabertura.

- [ ] **Step 6: remover ações destrutivas e caminhos duplicados**

Substituir exclusão por inativação, remover utilização manual de folga e retirar `BANK_LEAVE` dos formulários.

- [ ] **Step 7: verificar layout, teclado e telas pequenas no navegador**

Run: iniciar `npm run dev`, percorrer RH e colaborador em 1440 px, 1024 px e 390 px; verificar foco visível, Escape nos modais, nomes acessíveis e ausência de rolagem horizontal indevida.

- [ ] **Step 8: executar lint, build e testes**

Run: `npm run lint && npm test`

Expected: 0 erros e todos os testes PASS.

- [ ] **Step 9: versionar a unidade**

```bash
git add app/ClosingView.tsx app/DailyAllocationFields.tsx app/ApprovalInboxView.tsx app/HorusViews.tsx app/HorusApp.tsx app/AdminView.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: deliver intuitive Horus monthly workflow"
```

### Task 7: Reconciliação, segurança e preparação da produção

**Files:**
- Create: `docs/runbooks/supabase-safe-migration.md`
- Create: `supabase/tests/reconcile_production.sql`
- Modify: `README.md`

**Interfaces:**
- Produces: checklist operacional de backup, restauração, migração, reconciliação, rollback e monitoramento.
- Consumes: migração e testes das Tasks 2 e 3.

- [ ] **Step 1: registrar baseline de produção somente leitura**

Guardar no relatório de execução apenas totais agregados: contagens das tabelas e somas de minutos; nunca copiar nomes, e-mails ou chaves.

- [ ] **Step 2: validar branch Supabase**

Executar migração, testes SQL, advisors de segurança/desempenho e os mesmos totais agregados na branch.

- [ ] **Step 3: documentar backup e restauração antes da produção**

O runbook exigirá confirmação da data do último backup, teste de restauração/clonagem, janela de mudança, pessoa responsável e consulta de reconciliação pós-migração.

- [ ] **Step 4: verificar código completo**

Run: `npm run lint`

Expected: 0 erros.

Run: `npm test`

Expected: build e todos os testes PASS.

Run: advisors de segurança e desempenho na branch.

Expected: nenhum alerta novo causado pelas tabelas ou funções v2.

- [ ] **Step 5: revisar diferenças e critérios de aceitação**

Comparar cada um dos dez critérios da especificação com teste ou evidência. Se qualquer item não tiver evidência, a produção permanece bloqueada.

- [ ] **Step 6: versionar a documentação de liberação**

```bash
git add docs/runbooks/supabase-safe-migration.md supabase/tests/reconcile_production.sql README.md
git commit -m "docs: add safe Supabase migration runbook"
```

- [ ] **Step 7: aguardar autorização explícita para produção**

Não executar a migração na produção apenas porque a branch passou. Apresentar backup, reconciliação, advisors, testes e diff; aplicar em produção somente após autorização final específica.
