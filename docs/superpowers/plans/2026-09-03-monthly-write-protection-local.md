# Proteção do mês fechado — implementação local

> **For agentic workers:** usar `superpowers:executing-plans`, sem subagentes. O usuário autorizou preparar e testar esta correção somente localmente.

**Goal:** corrigir os três contraexemplos registrados em `closing-integration-validation.md`, preservando todos os registros existentes ao instalar as funções propostas.

**Architecture:** funções PostgreSQL serializam as operações mensais de uma mesma pessoa antes de bloquear linhas; a proteção cobre inclusive pedidos feitos antes de existir um registro mensal. Decisão, cálculo, versão e auditoria passam a ser uma única transação. SQL candidato fica fora de `supabase/migrations`, sem aplicação automática.

**Tech Stack:** PostgreSQL 17.11 local, TypeScript, testes Node existentes. Nenhuma dependência nova.

**Spec:** [causas e proposta mínima aprovada](../../runbooks/closing-integration-validation.md).

## Global Constraints

- Não conectar ao Supabase real, mudar flags, executar migração remota, fazer push/merge/deploy ou usar registros reais como teste.
- Não alterar migrações históricas. Não apagar, recriar, importar ou corrigir histórico.
- SQL só é carregado pelo executor em um cluster novo de dados fictícios. Comparar todas as tabelas protegidas antes/depois da instalação.
- Manter a interface, seus contratos HTTP, fechamento individual/equipe e consulta diária.
- Novas funções: `security invoker`, `search_path = ''`, execução restrita ao serviço; validar organização e papel do ator. Não ampliar acesso público.

## 1. Bloqueio consistente e pendências

**Files:** criar `db/proposals/monthly-write-protection/guards.sql` e `existing-functions.sql`; ampliar `scripts/verify-closing-postgres.mjs` e criar `tests/backend/monthly-protection-fixture.sql`, preservando a fixture inicial.

**Interfaces:** `lock_monthly_workflow(text,text)` serializa por organização/pessoa; `assert_open_months(text,text,date,date)` valida os meses sobrepostos; assinaturas de `save_time_entry`, `recalculate_timesheet`, `close_timesheet` e `reopen_timesheet` permanecem iguais.

- [x] Reproduzir o baseline: 3 testes aprovados, 3 falhas de segurança, banco local encerrado.
- [x] Acrescentar testes para instalação sem alterar linhas, pendências sem lançamento/em ajuste, ocorrência atravessando meses, gravação direta em mês fechado e concorrência em ambas as ordens.
- [x] Executar testes antes da correção. Exemplo: `assert.throws(() => query("select public.recalculate_timesheet('ts_test-a_2026_8')"), /closed/i)` depois de fechar o mês.
- [x] Implementar proteção compartilhada com `pg_advisory_xact_lock(hashtextextended(...))`; bloqueio transacional antes de `FOR UPDATE`. A chave usa organização/pessoa para proteger também meses ainda não criados, sem inserir registros mensais só para bloquear.
- [x] Atualizar as quatro funções sem modificar os cálculos de saldo. Verificar autorizações `REQUESTED`/`NEEDS_ADJUSTMENT` e ocorrências sobrepostas na transação de fechamento. Triggers impedem escrita de dias, autorizações e ocorrências em meses fechados; identidade de registros existentes não pode ser transferida.
- [x] Executar em cluster novo com `--candidate`; exigir rejeição da edição após fechamento, sem alteração de dias/versões/snapshot.

## 2. Aprovações atômicas

**Files:** criar `db/proposals/monthly-write-protection/decisions.sql`, `tests/backend/monthly-protection-cases.mjs`, `tests/monthly-write-routes.test.mjs` e suportes de teste; modificar as rotas `app/api/non-business-authorizations/route.ts`, `app/api/occurrences/route.ts` e mapeamento de erros `db/http.ts`.

**Interfaces:** `request_non_business_authorization(org,actor,contractor,date,estimated,reason)`, `decide_non_business_authorization(org,actor,id,action,approved,notes)`, `create_occurrence(org,actor,contractor,type,start,end,minutes,effect,description)` e `decide_occurrence(org,actor,id,action,notes)` retornam JSON `{id,status}`. Datas SQL `date`, minutos `integer`, demais parâmetros `text`.

- [x] Escrever e observar falhas para decisão após fechar, rollback quando auditoria falha, uma única versão por alteração, repetição recusada, dados inválidos e acesso PJ/organização incorretos.
- [x] Implementar as quatro RPCs: validar ator e período, bloquear pessoa/mês, validar estado atual, gravar alteração/cálculo/versão/auditoria na mesma transação. Preservar a regra existente de atribuição de abono ao mês inicial; bloquear qualquer mês fechado sobreposto sem inventar rateio.
- [x] Substituir as várias gravações das duas rotas por uma única RPC, mantendo verificação de origem e autenticação. Exemplo: `admin.rpc("decide_non_business_authorization", {p_organization_id: actor.organizationId, p_actor_id: actor.id, p_authorization_id: body.id, p_action: action, p_approved_minutes: approved, p_notes: cleanText(body.notes)})`.
- [x] Testar os handlers reais com sessão/transporte externos substituídos por dependências de teste; testar as funções reais separadamente no PostgreSQL. Não afirmar homologação da autenticação real.

## 3. Verificação e entrega local

- [x] Executar todos os testes SQL candidatos, testes da aplicação, builds, lint e tipos em cópia sem credenciais.
- [x] Revisar permissões, caminhos de escrita, ordem dos bloqueios e diff. Não executar advisors remotos; inspeção local de catálogos verifica ACLs e funções.
- [x] Registrar resultados, diferenças mínimas nas funções antigas e limitações em `docs/runbooks/monthly-write-protection-local-validation.md`.
- [x] Manter mudanças locais e produção intacta. Completar estes testes não libera os outros critérios pendentes: consulta sem escrita implícita, vencimentos/completude e revisão de aplicação no Supabase.
