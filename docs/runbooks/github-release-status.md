# Horus — preparação da publicação no GitHub

Data: 03/09/2026. Plano: [publicação segura](../superpowers/plans/2026-09-03-horus-github-release.md).

## Escopo e estado

Publicação de código e abertura de PR autorizadas pelo usuário. A versão completa ainda não está liberada para merge/deploy: falta validar e integrar o fechamento real, por pessoa e para a equipe. A conferência por dia permanece uma opção somente de consulta.

A preparação usa um snapshot revisado sobre `main` (`bb9f3752a37da01a5647e5ed48ee4894f1c18628`), sem publicar o histórico local anterior dos documentos que continha contagens internas. Nenhuma alteração no histórico local nem nos registros dos colaboradores.

`vercel.json` desabilita o deploy automático somente de `release/monthly-review-2026-09-03`; outras branches e produção mantêm a configuração existente. Isto não impede deploy manual nem merge indevido. O ambiente de prévia remoto não foi comprovado isolado do Supabase real.

## Verificação

- Nova execução de `npm run verify:workflow` em 03/09/2026: **48 testes aprovados**, zero falhas e zero testes ignorados. Builds Vinext e Next, ESLint e TypeScript concluídos; processo final com saída 0.
- A verificação foi feita em uma nova cópia temporária sem arquivos de ambiente nem credenciais de produção. Não foi iniciado servidor autenticado.
- `git diff --check` e `git diff --cached --check` sem erros. Revisados 45 arquivos alterados em relação à `main`; nenhum arquivo de ambiente ou mudança nos caminhos de banco/API protegidos. A busca por padrões comuns de credenciais não encontrou ocorrências; e-mails no conteúdo novo/revisado usam apenas `example.com`.
- Configuração JSON válida; bloqueio de deploy automático restrito à branch de revisão. A avaliação remota será conferida após publicar a branch; parse local não comprova execução da Vercel.
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
