# Horus — concluir a publicação segura

> **For agentic workers:** usar superpowers:executing-plans, sem subagentes. O usuário autorizou concluir todas as pendências até o deploy; não há autorização para alterar lançamentos históricos ou fechar/reabrir meses reais.

**Goal:** publicar no projeto oficial da Vercel o fluxo mensal e a conferência diária, com backend compatível e histórico preservado.

**Architecture:** manter a interface já validada; completar leituras paginadas sem gravações, aplicar vencimentos nas decisões e proteger o limite aprovado nas edições. Instalar somente definições de funções/triggers verificadas; publicar aplicação após confirmar compatibilidade.

**Tech Stack:** Next/Vinext, TypeScript, Supabase PostgreSQL 17, executores isolados existentes.

**Spec:** condições de liberação em `docs/runbooks/monthly-workflow-release-gates.md` e autorização do usuário nesta conversa.

## Global Constraints

- Não apagar, regravar, importar, exportar nem corrigir registros reais. Não usar produção como ambiente de teste de escrita.
- Não fechar/reabrir meses reais. Publicar código e habilitar uma ação não significa executá-la.
- Usar o branch atual; preservar alterações locais já verificadas. Não incorporar o PR #1 ou histórico privado de auditoria.
- Não mudar papéis ou permissões dos usuários; não expor credenciais.
- Consultas de compatibilidade em produção são somente leitura. Instalação remota deve abortar integralmente se a versão divergir, se não conseguir os bloqueios rapidamente ou se a verificação de preservação falhar.

## 1. Consultas completas e sem efeitos colaterais

**Files:** `db/read-all.ts`, `db/dashboard.ts`, `db/actor.ts`, rotas de login, leitura de lançamentos/histórico/relatórios/admin; testes correspondentes em `tests/`.

**Interface:** `readAllRows<T extends {id:string}>(fetchPage:(from:number,to:number)=>PromiseLike<{data:T[]|null,error:unknown,count:number|null}>):Promise<T[]>`. Contagem exata em cada página, ordem determinística com ID, rejeição de páginas vazias incompletas, IDs repetidos e mudança de contagem.

- [x] Reproduzir truncamento com mais de 1000 registros e recusa de gravação durante consulta. Exemplo: `assert.equal(data.entries.length,1105)` e transporte de teste que lança erro ao receber escrita.
- [x] Implementar carregamento completo. Cada consulta usa `.select(fields,{count:"exact"}).order("id").range(from,to)`; preservar ordenação de negócio antes do desempate por ID.
- [x] Projetar vencimento apenas na resposta do dashboard; retirar a chamada de atualização de saldos da consulta.
- [x] Tornar resolução de usuário somente leitura. Vincular identidade somente após login explícito autenticado, mantendo perfis e vínculos existentes.
- [x] Verificar falha parcial, conjunto vazio legítimo, histórico de inativos e escopo PJ/DEV/organização.

## 2. Saldos e gravações consistentes

**Files:** candidato SQL existente, novo `db/proposals/monthly-write-protection/balance-workflows.sql`, fixtures e casos de regressão SQL; rota de folgas quando necessária.

**Interfaces:** manter `close_timesheet`, `save_time_entry`, `reopen_timesheet` e `decide_leave_request`. Operações de saldo usam o mesmo bloqueio por pessoa. Vencimento considera a política vigente e a data na timezone da organização.

- [x] Teste vermelho: aprovar 240 minutos e editar o dia não pode voltar a considerar 480; o valor esperado é literalmente 240.
- [x] Teste vermelho: crédito com prazo de ontem sob BLOCK_AFTER_DEADLINE não pode compensar déficit nem aprovar nova reserva. Reserva já concedida continua utilizável/cancelável sem perda de histórico.
- [x] Corrigir os predicados de elegibilidade nas operações, sem atualizar lotes antigos na instalação ou durante consulta. Preservar FIFO e reservas.
- [x] Testar consistência de solicitações de folga e auditoria; manter criação/decisão atômicas e validar ator/organização.
- [x] Manter a função antiga de atualização de vencimentos compatível, mas sem escrita implícita.
- [x] Reexecutar todos os casos anteriores, concorrência e falhas injetadas.

## 3. Empacotar e validar a liberação

**Files:** nova migração gerada pelo CLI, executor local de verificação, relatório final de publicação.

- [x] Confirmar projetos oficiais e comparar por leitura as seis funções operacionais instaladas: corpos iguais às migrações locais originais.
- [x] Comparar tabelas/colunas/constraints e advisors; resolver riscos pertinentes sem alterar dados.
- [x] Gerar a migração pelo CLI, reunindo apenas definições revisadas e pré-condições de compatibilidade. Não executar as quatro migrações antigas na produção que já existe.
- [x] No PostgreSQL fictício, provar instalação repetível sem mudança nas 14 tabelas protegidas, grants/RLS preservados e operações corretas.
- [x] Executar testes da aplicação, builds Vinext/Next, lint e tipos em cópia sem credenciais. Comparar fontes.
- [x] Revisar diretamente o diff e escanear segredos/fixtures antes do commit/push.

## 4. Publicar e confirmar

- [x] Atualizar o PR #3 com código e evidência, preservando bloqueio de autodeploy do branch até a liberação.
- [x] Aplicar somente a migração nova revisada no projeto Horus, com pré-condições e comparação de preservação na mesma transação; nunca executar operações de ponto como teste.
- [x] Verificar por leitura funções instaladas, permissões e advisors. Não avançar se houver divergência.
- [ ] Finalizar/mesclar o PR usando o SHA verificado; publicar no projeto oficial e habilitar o fechamento somente com backend validado.
- [ ] Confirmar deployment READY, commit publicado, domínio oficial e ausência de novos erros de inicialização. Não executar escrita autenticada em produção como smoke test.
- [ ] Registrar resultado e encerrar a meta somente após publicação confirmada.
