# Integração do fechamento — execução isolada

> **For agentic workers:** executar com `superpowers:executing-plans`, sem subagentes. Autorização do usuário em 03/09/2026: concluir integração e testes, sem aplicar mudanças ao Supabase real.

**Goal:** conectar a confirmação mensal ao contrato real da API, validar resultados por pessoa e comprovar os limites de segurança em ambiente local.

**Architecture:** reutilizar `POST /api/timesheets`; um adaptador cliente envia uma pessoa de cada vez e não repete gravações automaticamente. A liberação no servidor continua condicionada à flag existente. Testar funções SQL atuais em PostgreSQL descartável, com dados inventados, para distinguir integração pronta de backend apto à produção.

**Tech Stack:** TypeScript/React, Node test, Supabase JS existente, PostgreSQL local de teste. Nenhuma dependência nova da aplicação.

**Spec:** [plano de publicação](2026-09-03-horus-github-release.md), tarefa 4, e [condições do backend](../../runbooks/monthly-workflow-release-gates.md).

## Global Constraints

- Nenhuma chamada, migração, alteração de configuração, exportação, backup ou gravação no Supabase real.
- Não ativar `HORUS_MONTH_CLOSING_WRITE_ENABLED` na Vercel; não fazer merge/deploy com critérios pendentes.
- Manter a conferência diária opcional e somente leitura; fechamento sempre mensal, individual ou da equipe.
- Não incorporar o PR #1. Não modificar migrações históricas. SQL de teste usa exclusivamente um banco novo em loopback.
- Preservar entradas, versões e auditoria; não usar pessoas ou dados reais em fixtures.

## 1. Adaptador entre confirmação e API

**Files:** criar `app/closing-client.ts`, `tests/closing-client.test.mjs`; modificar `app/HorusApp.tsx`, `app/ClosingConfirmation.tsx`, `app/page.tsx`, `tests/browser/main.tsx`.

**Interface:** `createClosingSubmit(request: WorkflowRequest): ClosingSubmit`. Recebe `{year, month, contractorIds}` e retorna `ClosingResult[]`. Para cada pessoa, enviar exclusivamente `POST /api/timesheets` com `{action:'CLOSE', contractorId, year, month}`. Nunca aceitar URL externa como parâmetro.

- [x] Testar antes da implementação: seleção vazia/período inválido não envia; duplicatas não repetem chamadas; sucesso exige `action:'CLOSE'`, `timesheetId` correspondente e `alreadyClosed` booleano; erro HTTP/transporte/JSON resulta em informação individual sem falso sucesso.
- [x] Reproduzir teste vermelho com `node --test tests/closing-client.test.mjs` em ambiente sem credenciais.
- [x] Implementar envio sequencial sem retry, bloqueio de chamadas simultâneas do mesmo adaptador, prazo de resposta e interrupção da fila quando houver resultado incerto. Quem não foi enviado recebe resultado explícito de não processado.
- [x] Ligar a interface por uma propriedade booleana vinda do servidor, mantendo padrão desativado. Perfil PJ e simulação DEV nunca recebem operação de fechamento. Manter injeção de operação fictícia no ensaio, identificada explicitamente como teste; não deduzir ambiente pela mera presença de callback.
- [x] Testar uma pessoa, equipe, resposta incerta, erro parcial, clique repetido e proteção dos perfis. A flag de servidor ainda controla a rota, independentemente da interface.

## 2. Verificação das regras SQL existentes

**Files:** criar `tests/backend/closing-regression.sql`, `scripts/verify-closing-postgres.mjs` e `docs/runbooks/closing-integration-validation.md`.

**Interface do ensaio:** PostgreSQL local novo, criado a partir das migrações versionadas e fixtures `test-org`, `test-rh`, `test-person`. O script não recebe URL arbitrária, não lê `.env` e não reutiliza banco existente. Binários oficiais separados do repositório; servidor somente em `127.0.0.1`.

- [x] Criar fixture sintética com dois dias, versões anteriores e mês aberto. Registrar representação determinística dos dias e versões antes de fechar.
- [x] Exercitar `close_timesheet` com uma pessoa, repetir e fechar outra pessoa; comprovar resposta, uma única movimentação e histórico preservado. Injetar falha na auditoria e exigir rollback do mês e saldo.
- [x] Testar pendências e tentativa de alteração após fechamento, além de concorrência entre fechamento e edição. Se falhar, registrar o contraexemplo; não “aprovar” o backend por testes do adaptador cliente.
- [x] Identificar a menor mudança exigida em funções/rotas e apresentar seu efeito. Não aplicar SQL em produção nem ativar fechamento para contornar falha.

## 3. Verificar e atualizar o mesmo PR

- [x] Executar a suíte isolada, builds, lint e tipos. Comparar o código enviado com o código testado.
- [ ] Atualizar PR #3 com integração, resultados reais do ensaio e limites restantes. Manter rascunho se qualquer condição de backend falhar.
- [x] Registrar explicitamente se o fechamento real pode ou não ser liberado. Não confundir teste HTTP ou SQL local com validação do banco de produção.

## Resultado desta execução

Integração cliente concluída; 57 testes da aplicação, builds, lint e tipos aprovados. PostgreSQL local: 3 testes aprovados e 3 reprovados. Backend não liberado; proposta mínima e evidências em [closing-integration-validation.md](../../runbooks/closing-integration-validation.md). As falhas locais não foram corrigidas por alteração de SQL em produção.
