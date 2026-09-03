# Horus — plano de implementação e publicação segura

> **For agentic workers:** usar `superpowers:executing-plans`, nesta tarefa e sem subagentes, conforme preferência do usuário. Executar apenas as etapas cujas condições estejam cumpridas.

**Goal:** entregar no GitHub o fluxo mensal e a conferência diária opcional, e publicar a versão completa somente depois de validar o fechamento real e a preservação do histórico.

**Architecture:** a implementação de interface já existe localmente; este plano organiza sua revisão e publicação. Publicar um snapshot revisado sobre a `main` atual, em PR de rascunho, sem incorporar o PR antigo de backend. A conferência por dia é somente uma forma de visualizar os lançamentos; não substitui o fechamento mensal individual ou da equipe.

**Tech Stack:** React 19, Next.js 16, TypeScript, testes nativos Node, Vinext/Vite para verificação local, GitHub e Vercel. Sem novas dependências.

**Spec:** [fluxo mensal aprovado](../specs/2026-09-03-horus-monthly-workflow-repair-design.md), [implementação local](2026-09-03-horus-monthly-workflow-repair.md), [conferência diária opcional](../../runbooks/daily-review-local-validation.md) e [condições do backend](../../runbooks/monthly-workflow-release-gates.md).

## Global Constraints

- Não gravar, corrigir, excluir, substituir, recriar, importar ou fechar dados reais durante desenvolvimento e testes.
- Preservar os lançamentos de agosto, suas versões anteriores e todo o histórico já existente.
- Não aplicar migrações nem alterar tabelas, funções, políticas, permissões ou configurações do Supabase nesta etapa.
- Não ativar `HORUS_MONTH_CLOSING_WRITE_ENABLED` em produção.
- Usar dados fictícios em ambiente de teste isolado, sem credenciais nem chamadas ao Supabase de produção.
- Não mudar as permissões dos perfis RH, colaborador e DEV como efeito colateral de uma correção visual.
- Manter históricos de pessoas inativas consultáveis; inatividade não apaga nem oculta seus registros do período.
- Executar o trabalho nesta tarefa, sem subagentes, respeitando a preferência já dada pelo usuário.
- Usar português claro: “mês”, “colaborador”, “Editar este dia”, “Histórico deste dia” e “Fechar mês da equipe”.
- A autorização de GitHub/PR/deploy foi dada em 03/09/2026. Ela substitui a restrição de publicação da etapa local anterior, mas não dispensa as condições de segurança nem autoriza fechamento real, migrações, exportação, backup ou mudanças de acesso.
- Não publicar dados reais, credenciais, arquivos de ambiente nem contagens internas da auditoria em um repositório público.
- Não fazer merge do PR #1 (`feat/safer-month-closing`): ele contém outra proposta, inclusive mudanças de banco, e não faz parte desta entrega.

## Base verificada em 03/09/2026

- Repositório: `jmarcobrito/horuscodex`; produção e `main`: `bb9f3752a37da01a5647e5ed48ee4894f1c18628`.
- Implementação local: `06b985fa1799e4a5b75c18a102c7ba7ef958a48c`, branch `docs/monthly-workflow-repair`, em worktree existente.
- Projeto Vercel: `horuscodex`; domínio oficial: https://horuscodex.vercel.app.
- Deploy de produção conhecido: `dpl_A43LoReGToBdAkDbFSULKy4oyf6F`, estado READY. Não foi feita chamada ao dashboard real.
- `app/page.tsx` não fornece `closingSubmit`; `app/ClosingConfirmation.tsx` mantém confirmação real indisponível. O callback do ensaio não é integração de produção.
- A consulta existente `getDashboardData`, em `db/dashboard.ts`, chama `refresh_hour_balance_statuses`. Logo, abrir uma sessão real não serve como teste sem gravações.
- `main` não possui proteção nem verificações obrigatórias. Um rascunho e este documento não são um bloqueio técnico contra merge manual indevido.

## Mapa da entrega

| Arquivos | Responsabilidade |
| --- | --- |
| `app/period.ts`, `app/PeriodPicker.tsx`, `app/workspace-state.ts`, `app/HorusApp.tsx` | Mês próprio por tela, navegação e proteção contra respostas antigas. |
| `app/entries-model.ts`, `app/HorusViews.tsx`, `app/globals.css` | Filtro por colaborador e opção de conferência por dia, inclusive no celular. |
| `app/EntryHistory.tsx`, `app/Modal.tsx`, `app/SelectMenu.tsx` | Histórico do dia, estados de carregamento/erro e foco. |
| `app/closing-model.ts`, `app/ClosingOverview.tsx`, `app/ClosingConfirmation.tsx` | Revisão mensal, seleção de uma pessoa ou equipe e resultado individual; gravação real ainda não integrada. |
| `app/dashboard-types.ts`, `db/dashboard.ts`, `db/monthly-timesheet-view.ts` | Projeção dos metadados mensais já existentes. Não criar estrutura no banco. |
| `tests/`, `scripts/verify-workflow-isolated.mjs`, `package.json` | Casos automatizados e ensaio com dados inventados, sem credenciais. |
| `vercel.json` | Impedir somente o deploy automático da branch de revisão. Manter configuração da produção. |
| Este plano e runbooks | Evidências, limites e condição de liberação. |

## Tarefa 1 — Preparar um pacote público sem publicação automática

**Files:** modificar `vercel.json` e os dois documentos anteriores apenas para retirar contagens internas; criar este plano e `docs/runbooks/github-release-status.md`.

**Interfaces:** a branch remota será `release/monthly-review-2026-09-03`. O contrato de configuração é `git.deploymentEnabled`, da [documentação oficial Vercel](https://vercel.com/docs/project-configuration/git-configuration).

- [x] Conferir a `main`, produção, PRs existentes e isolamento do worktree, sem tocar no Supabase.
- [x] Acrescentar somente esta propriedade ao `vercel.json`, preservando framework e comando de build:

```json
"git": {
  "deploymentEnabled": {
    "release/monthly-review-2026-09-03": false
  }
}
```

As demais branches mantêm o comportamento atual. Esta configuração não impede deploy manual nem protege um merge na `main`. Não renomear a branch para contornar a condição. Só liberar uma prévia quando seu isolamento de produção tiver sido comprovado.

- [x] Retirar das versões públicas dos documentos as contagens de registros reais. Preservar o histórico local; não publicar os commits antigos que continham essas contagens.
- [x] Revisar `git diff --name-status origin/main` e `git diff origin/main -- supabase app/api db/feature-flags.ts db/actor.ts db/supabase.ts proxy.ts app/page.tsx`; a segunda consulta deve continuar sem diferenças.

## Tarefa 2 — Revalidar exatamente o código que irá ao PR

**Files:** testar o pacote existente, sem alterar dados nem testes para esconder falhas. Registrar resultados em `docs/runbooks/github-release-status.md`.

**Interfaces:** `npm run verify:workflow` copia arquivos rastreados para diretório temporário, exclui configurações e credenciais, e executa builds Vinext/Next, testes, ESLint e TypeScript.

- [x] Incluir explicitamente no índice apenas os arquivos desta preparação; o script usa `git ls-files` e precisa enxergar os arquivos novos.
- [x] Executar `npm run verify:workflow`. Esperar todos os testes aprovados e saída 0 em cada etapa. Falha de infraestrutura não é aprovação. Não iniciar o servidor autenticado nem fornecer credenciais reais ao build.
- [x] Executar `git diff --check` e `git diff --cached --check`; conferir ausência de arquivos de ambiente ou dados exportados no pacote.
- [x] Reaproveitar a evidência visual datada da conferência diária somente enquanto seus arquivos permanecerem iguais ao código validado. Qualquer mudança funcional exige novo teste do cenário atingido.

## Tarefa 3 — Publicar o código e abrir PR de rascunho

**Files:** snapshot dos arquivos revisados em relação à árvore da `main`. Preservar todo arquivo não alterado.

**Interfaces:** GitHub Git Trees/Commits/Refs e Pull Requests; base `main`, head `release/monthly-review-2026-09-03`, `draft: true`. Não usar merge automático.

- [ ] Conferir novamente o SHA da `main`. Se houver avanço, revisar as mudanças antes de criar o snapshot; não sobrescrever trabalho posterior.
- [ ] Criar uma árvore baseada na árvore completa da `main`, com os conteúdos revisados. Criar um commit com pai igual à `main` verificada. Não incluir commits locais anteriores nem arquivos fora do diff aprovado.
- [ ] Criar a branch diretamente nesse commit, que já contém a configuração de deploy automático desabilitado. Não criar primeiro a branch numa revisão sem essa configuração.
- [ ] Abrir o PR como rascunho, informando: conferência diária opcional, fechamento mensal preservado na interface mas integração real pendente, testes realizados e ausência de mudanças de banco.
- [ ] Buscar a branch e comparar a árvore remota com a árvore local revisada. Conferir arquivos e estado do PR; registrar o link. Verificar metadados Vercel sem abrir uma sessão real; produção deve continuar na revisão anterior.

## Tarefa 4 — Condição impeditiva: validar o fechamento real

**Estado inicial: não cumprida.** Esta etapa é uma revisão de prontidão, não autorização para modificar o Supabase. Não tratar o PR como versão completa até atendê-la.

**Files a inspecionar:** `app/page.tsx`, `app/HorusApp.tsx`, `app/ClosingConfirmation.tsx`, `app/closing-model.ts`, `app/api/timesheets/route.ts`, `app/api/time-entries/route.ts`, `app/api/non-business-authorizations/route.ts`, `app/api/occurrences/route.ts`, `db/dashboard.ts`, `db/feature-flags.ts` e funções existentes em `supabase/migrations/`.

**Contrato atual:** `ClosingSubmit = (command: { year: number; month: number; contractorIds: string[] }) => Promise<ClosingResult[]>`. A API real é individual: `POST /api/timesheets` com `{ action: "CLOSE", contractorId, year, month }`. Não ligar o callback fictício à produção nem presumir atomicidade de toda a equipe.

- [ ] Obter aprovação da proposta mínima de integração em backend isolado, com dados fictícios; não implementar uma migração de produção sob a autorização de deploy.
- [ ] Demonstrar consultas sem gravações implícitas, sem permitir o uso de crédito vencido.
- [ ] Demonstrar proteção transacional do mês fechado, consistência entre lançamento/versão/auditoria/saldo, concorrência, repetição e resposta incerta. Não reabrir automaticamente como compensação.
- [ ] Demonstrar paginação e completude de registros/pendências, escopo por organização/perfil e consulta a pessoas inativas. Lista limitada não comprova ausência de pendências.
- [ ] Validar fechar uma pessoa e toda a equipe em backend isolado, retornando resultado por pessoa. Separar claramente o ambiente real do rótulo “TESTE — DADOS FICTÍCIOS”. Não esconder um botão inoperante como conclusão da integração.
- [ ] Revisar todas as condições de [monthly-workflow-release-gates.md](../../runbooks/monthly-workflow-release-gates.md). Qualquer necessidade de função, tabela, política, configuração ou verificação real exige autorização específica antes da execução.

## Tarefa 5 — Merge e produção, somente depois das condições anteriores

**Files:** nenhum arquivo de banco será executado por este plano. A revisão deve produzir o SHA exato aprovado para publicação e evidências de todos os critérios anteriores.

- [ ] Confirmar revisão final e testes do SHA do PR; retirar o rascunho somente quando o fechamento individual e da equipe estiver pronto, sem regressão dos perfis RH/PJ/DEV.
- [ ] Fazer merge somente deste PR na `main`, sem incluir o PR #1 nem ativar flags de gravação como efeito colateral.
- [ ] Acompanhar o deploy automático do projeto Vercel `horuscodex`; não criar outro projeto ou trocar domínio/configuração de acesso. Confirmar `READY`, commit esperado e domínio oficial pelos metadados.
- [ ] Para verificação funcional real, combinar antes um procedimento autorizado que não escreva nos registros protegidos. Não fechar agosto nem editar lançamentos para testar. Build aprovado não prova integridade do banco.
- [ ] Se a publicação falhar, não repetir gravações nem executar reparos de banco. Se houver regressão confirmada, retornar apenas o código ao deploy anterior compatível; nunca restaurar ou reverter o banco. Reversão de código não desfaz eventuais operações de dados.
- [ ] Entregar link oficial, SHA publicado, evidências e limites. Não afirmar “em produção” antes de confirmar o deploy correto.

## Critério de conclusão

O PR de rascunho é uma entrega intermediária. O trabalho completo só termina com opção diária de consulta, fechamento mensal individual e da equipe realmente validado, produção no SHA aprovado e nenhuma operação não autorizada sobre dados reais.

Nesta preparação, a decisão segura é **código e plano no GitHub; merge/deploy aguardando a condição de backend**, sem mudar o sistema em uso.
