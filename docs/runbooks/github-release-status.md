# Horus — preparação da publicação no GitHub

Data: 03/09/2026. Plano: [publicação segura](../superpowers/plans/2026-09-03-horus-github-release.md).

## Atualização — integração e testes do backend local

A integração cliente foi implementada após `731e825`, mantendo a flag do servidor e a API existentes. O detalhe está em [closing-integration-validation.md](closing-integration-validation.md). A lacuna de ligação da interface foi resolvida no código; **a versão continua sem autorização técnica para merge/deploy**, pois três verificações das funções SQL reprovaram em banco novo com dados fictícios.

Nova execução isolada: **57 testes da aplicação aprovados**, 0 falhas/ignorados; builds Vinext/Next, ESLint e TypeScript concluídos com saída 0. Comparação de 105 arquivos com a cópia testada sem diferenças; 57 arquivos da aplicação e do ensaio visual também conferidos. SQL local: 3 testes aprovados e 3 reprovados, saída 1; servidor temporário encerrado.

As falhas são: pendência sem lançamento não bloqueia o fechamento; aprovação pode alterar mês fechado; edição concorrente pode gravar depois do fechamento. A menor proposta de correção está no relatório. Não houve alteração de migrações, rotas ou funções de banco nesta integração, nem chamada ao Supabase real. O valor da flag de produção não foi consultado nem alterado. Não houve merge/deploy por esta execução.

O código foi publicado no mesmo PR #3 pelo commit `39a16c54305ec65a30673afbdb114a31024599fc`, árvore `f06325de64b7e45d78f1f74ad4e28bfb6689dc66`, igual ao conteúdo local revisado. A descrição do PR foi atualizada com os resultados e o rascunho foi mantido. A configuração que desabilita deploy automático desta branch permanece igual. A abertura do PR e os testes locais não comprovam a integridade dos dados reais. O commit posterior apenas registra esta publicação e conclui os checkboxes desta etapa isolada.

## Registro da preparação anterior

As seções abaixo documentam a entrega inicial de 48 testes, antes desta integração. Afirmações sobre `app/page.tsx` e ligação do fechamento são históricas; o estado atual está na atualização acima.

## Escopo e estado

Publicação de código e abertura de PR autorizadas pelo usuário. A versão completa ainda não está liberada para merge/deploy: falta validar e integrar o fechamento real, por pessoa e para a equipe. A conferência por dia permanece uma opção somente de consulta.

**PR aberto, em rascunho:** [#3 — Revisa fluxo mensal e adiciona conferência diária opcional](https://github.com/jmarcobrito/horuscodex/pull/3). Commit inicial do pacote: `e047b283945f3a498f563daa817d4e99742c0a17`; sua árvore `0d86aa781735c1f9de03d96029023401a582da9d` corresponde exatamente ao snapshot local revisado. O registro posterior de publicação altera somente este relatório e os checkboxes do plano.

A preparação usa um snapshot revisado sobre `main` (`bb9f3752a37da01a5647e5ed48ee4894f1c18628`), sem publicar o histórico local anterior dos documentos que continha contagens internas. Nenhuma alteração no histórico local nem nos registros dos colaboradores.

`vercel.json` desabilita o deploy automático somente de `release/monthly-review-2026-09-03`; outras branches e produção mantêm a configuração existente. Isto não impede deploy manual nem merge indevido. O ambiente de prévia remoto não foi comprovado isolado do Supabase real.

## Verificação

- Nova execução de `npm run verify:workflow` em 03/09/2026: **48 testes aprovados**, zero falhas e zero testes ignorados. Builds Vinext e Next, ESLint e TypeScript concluídos; processo final com saída 0.
- A verificação foi feita em uma nova cópia temporária sem arquivos de ambiente nem credenciais de produção. Não foi iniciado servidor autenticado.
- `git diff --check` e `git diff --cached --check` sem erros. Revisados 45 arquivos alterados em relação à `main`; nenhum arquivo de ambiente ou mudança nos caminhos de banco/API protegidos. A busca por padrões comuns de credenciais não encontrou ocorrências; e-mails no conteúdo novo/revisado usam apenas `example.com`.
- Configuração JSON válida; bloqueio de deploy automático restrito à branch de revisão. Após abrir o PR, não havia novo deploy desta branch na lista Vercel. Não havia checks/statuses de CI no commit; isso não é uma aprovação remota dos testes nem uma prova isolada do motivo pelo qual o deploy não foi criado.
- Evidência visual anterior em [daily-review-local-validation.md](daily-review-local-validation.md), sem mudança no código da interface nesta preparação. Os testes locais não comprovam integridade nem prontidão do Supabase real.

## Revisão de prontidão

- A opção diária filtra dados já carregados, preserva a escolha por pessoa e não acrescenta gravações. O fechamento continua mensal, com seleção individual ou conjunta na interface.
- O diff desta entrega não modifica `supabase/`, rotas `app/api/`, autenticação, permissões, flag de fechamento ou `app/page.tsx`. A alteração em `db/dashboard.ts` apenas inclui campos de metadados na consulta/projeção já existente.
- **Impedimento de publicação completa:** `app/page.tsx` não fornece `closingSubmit`. O fechamento real permanece desabilitado; a confirmação executável do ensaio é fictícia.
- **Condições herdadas de backend:** a consulta do dashboard chama uma rotina de atualização; completude/paginação, consistência, proteção de mês fechado, concorrência e repetição precisam das provas registradas no [runbook de liberação](monthly-workflow-release-gates.md).
- O PR #1 é uma proposta diferente, com mudanças de backend/banco, e não deve ser incorporado a esta entrega.
- Revisão feita diretamente, sem subagentes. Graphify não possui grafo existente neste worktree; a análise usou arquivos e diferenças Git, sem gerar grafo ou memória.

## Dados e produção

Nenhuma chamada ao Supabase real, migração, fechamento, reabertura, alteração de flag, backup/exportação ou mudança de acesso faz parte desta preparação. Não foi feita verificação atual dos dados reais, portanto não se afirma uma conciliação de integridade com base nos testes fictícios.

Produção identificada pelos metadados Vercel: `dpl_A43LoReGToBdAkDbFSULKy4oyf6F`, commit `bb9f3752a37da01a5647e5ed48ee4894f1c18628`. A abertura de PR não autoriza fechar nenhum mês real.

Após a abertura do PR, a produção continuava nesse deploy. O PR permaneceu em rascunho; não houve merge ou deploy manual. A cópia de trabalho local passou à branch de revisão, mantendo a branch anterior e seu histórico local preservados.
