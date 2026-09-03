# Candidato local — proteção das gravações mensais

Estes arquivos são fontes de ensaio e **não devem ser executados separadamente em produção**. O pacote único revisado é `supabase/migrations/20260903171101_monthly_write_protection.sql`, com verificações de compatibilidade e preservação na mesma transação.

Atualização: o usuário autorizou a conclusão até o deploy. O executor local agora testa o pacote final, inclusive instalação repetida e cancelamento integral de uma instalação adulterada. Ver [validação da publicação](../../../docs/runbooks/production-release-validation.md). O restante deste documento registra a etapa inicial do candidato.

O usuário autorizou somente preparação e testes locais, com dados fictícios. Nada desta pasta é carregado pela aplicação ou por `db:push`; as migrações históricas não foram modificadas.

O executor `scripts/verify-closing-postgres.mjs --bin <diretório absoluto dos binários PostgreSQL> --candidate` cria um cluster novo em `127.0.0.1`, sem aceitar URL ou banco existente. Somente nele são carregados, nesta ordem:

1. `guards.sql`: bloqueio transacional por organização/pessoa, validações e proteção dos lançamentos, autorizações e ocorrências.
2. `existing-functions.sql`: quatro funções existentes com assinaturas e fórmulas de saldo preservadas; proteção de mês fechado e pendências acrescentada.
3. `decisions.sql`: quatro operações atômicas de autorização/ocorrência usadas pelas rotas locais.

Nenhum comando de instalação altera registros. Os INSERT/UPDATE existentes dentro das funções só executam quando elas são chamadas; nos testes, apenas sobre dados inventados.

**Não publicar as rotas locais isoladamente:** elas dependem das quatro novas funções, que não foram instaladas no Supabase. Uma futura publicação exige revisar os demais critérios pendentes, empacotar uma instalação única e coordenada, verificar a disponibilidade das operações e obter autorização específica. Estes três arquivos com transações separadas são suporte de ensaio, não um roteiro de rollout.

Ver [evidência e limitações](../../../docs/runbooks/monthly-write-protection-local-validation.md) e [plano aprovado](../../../docs/superpowers/plans/2026-09-03-monthly-write-protection-local.md).
