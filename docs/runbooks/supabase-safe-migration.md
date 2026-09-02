# Liberação segura do fechamento mensal no Supabase

Este procedimento protege o histórico do Horus. Ele não autoriza uma implantação: a produção só pode ser alterada depois de uma aprovação final específica, dada após a apresentação das evidências deste documento.

## Estado validado em 2 de setembro de 2026

- Produção: projeto `pronuvcdjyitpygxyrdu`. Nenhuma migração desta entrega foi aplicada.
- Validação: branch `horus-safe-closing-2026-09-02`, projeto `uirrbmpobebbtappyhjv`.
- A branch recebeu apenas cópia do esquema, sem dados reais. As migrações, o backfill conservador e os testes transacionais passaram nela.
- A história de migrações da produção está vazia, embora o esquema legado exista. Por isso, **não usar merge automático da branch** e não executar `db push` antes de reconciliar a história.
- Os scripts novos são aditivos. Eles não removem tabelas nem convertem períodos antigos de vários dias por média. Registros antigos que não podem ser distribuídos com certeza ficam como `NEEDS_REVIEW`.

### Baseline agregado mais recente de produção

Capturado por consulta somente de leitura por volta de 11:36 UTC. A produção recebeu atividade normal durante o trabalho, portanto estes números são referência histórica e devem ser recapturados na janela de implantação.

| Medida | Valor |
| --- | ---: |
| Organizações / usuários | 1 / 18 |
| Meses / lançamentos / versões | 21 / 243 / 41 |
| Auditorias | 301 |
| Minutos exigidos / trabalhados / abonados / considerados | 204.120 / 113.996 / 0 / 112.890 |
| Saldo mensal calculado | -91.230 min |
| Minutos calculados / elegíveis nos lançamentos | 113.996 / 112.890 |
| Folgas / reservas / lotes / movimentações | 0 / 0 / 0 / 0 |
| Ausências / autorizações | 0 / 0 |

O baseline não contém nomes, e-mails, identificadores de pessoas ou chaves.

## Porta de entrada: tudo precisa estar confirmado

- [ ] Responsável técnico e responsável do RH identificados.
- [ ] Janela curta de mudança comunicada; lançamentos e decisões pausados durante baseline, migração e reconciliação.
- [ ] Data e estado do backup mais recente confirmados em **Database > Backups**.
- [ ] Restauração testada em clone/branch ou exportação restaurável validada. Não basta existir um arquivo sem teste.
- [ ] Baseline imediatamente anterior salvo executando somente o primeiro `SELECT` de `supabase/tests/reconcile_production.sql`.
- [ ] `supabase migration list` conferido. Como a produção não registra o legado, o histórico deve ser reparado por uma pessoa responsável antes de qualquer fluxo automático.
- [ ] Commit exato da aplicação e os dois arquivos SQL exatos registrados no chamado de mudança.
- [ ] Autorização final específica para alterar a produção recebida.

Referências oficiais: [backups do banco](https://supabase.com/docs/guides/platform/backups), [migrações](https://supabase.com/docs/guides/deployment/database-migrations) e [reparo da história de migrações](https://supabase.com/docs/reference/cli/supabase-migration-repair).

## Sequência de implantação

1. Pausar temporariamente os fluxos de escrita do Horus.
2. Executar somente o primeiro `SELECT` da reconciliação e guardar o horário e o resultado. As consultas seguintes dependem das tabelas novas.
3. Confirmar que o backup/restauração continua disponível.
4. Aplicar explicitamente, nesta ordem, somente:
   - `20260902093957_safe_month_closing.sql`;
   - `20260902095102_transactional_month_closing.sql`.
5. Não executar a migração inicial nem a de fluxos legados contra o esquema já existente. Não usar `merge_branch` enquanto o histórico remoto estiver divergente.
6. Executar imediatamente `supabase/tests/reconcile_production.sql` completo.
7. Comparar o primeiro resultado com o baseline da mesma janela. Contagens e somas das tabelas legadas devem ser idênticas. As únicas linhas novas esperadas são parcelas diárias derivadas com certeza de registros de um único dia.
8. Confirmar que todos os campos de inconsistência do terceiro resultado são zero. Valores em `NEEDS_REVIEW` são permitidos somente se listados no chamado para correção manual posterior; eles não podem ser aproximados.
9. Executar advisors de segurança e desempenho e comparar com o baseline conhecido.
10. Publicar a aplicação somente depois da reconciliação do banco passar.
11. Fazer uma leitura assistida de Painel, Aprovações, Fechamento do mês, Pessoas e Meu mês; não realizar fechamento real como teste.
12. Retomar os fluxos de escrita e monitorar erros de API, autenticação e banco por pelo menos 30 minutos.

Cada migração está dentro de uma transação. Se uma instrução falhar, a transação deve ser revertida e a implantação deve parar.

## Advisors e segurança

- Na branch não há alerta de `function_search_path_mutable` nem chave estrangeira nova sem índice de cobertura.
- Os avisos `rls_enabled_no_policy` são informativos e esperados neste desenho: as tabelas têm RLS, os papéis de navegador não possuem privilégios e apenas o servidor usa `service_role`. Referência: [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- A produção já possui o aviso `auth_leaked_password_protection`. Ele não foi criado por esta entrega. A decisão de habilitá-lo deve ser registrada pelo responsável de segurança: [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Avisos antigos de índices sem uso ou chaves estrangeiras legadas devem ser comparados pelo nome. Um alerta novo nas tabelas ou funções desta entrega bloqueia a liberação até análise.

## Recuo e recuperação

- Falha antes do `commit`: confirmar que a transação foi revertida e não repetir automaticamente.
- Falha da aplicação com reconciliação correta: voltar o código para a versão anterior. Manter as colunas, tabelas e funções aditivas; não apagá-las, pois o código antigo as ignora.
- Divergência de contagem, soma ou integridade: manter as escritas pausadas, guardar os resultados, não tentar “corrigir” manualmente e restaurar primeiro em clone para investigar.
- Corrupção confirmada: a restauração/PITR só pode ser acionada pelo responsável da produção, usando o ponto anterior à janela. Isso substitui o banco inteiro e exige confirmação explícita.
- Nunca usar uma migração de recuo que apague parcelas diárias, fotografias de fechamento, auditorias, usuários ou lançamentos.

## Critérios de aceitação e evidências

| # | Critério | Evidência |
| ---: | --- | --- |
| 1 | Folga de 8 h abona e consome exatamente 8 h | `safe_month_closing_workflows.sql` |
| 2 | Parcela diária só entra no mês de sua data | teste SQL de fluxo e `daily-allocation.test.mjs` |
| 3 | Interface não mostra pronto quando há bloqueio | `preview_timesheet_v2`, modelo do dashboard e `ClosingView` |
| 4 | Falha não deixa alteração parcial | funções transacionais e teste SQL de fluxo |
| 5 | Mês vazio exige exceção justificada | teste SQL, API e confirmação separada na interface |
| 6 | Grupo inclui somente pessoas prontas | `ClosingView` envia apenas previews `READY`; API revalida cada versão |
| 7 | Reabertura bloqueada não altera dados | prévia e função transacional de reabertura testadas |
| 8 | Inativação preserva histórico | FKs restritivas, exclusão removida das APIs e interface |
| 9 | Usuário recebe orientação clara | contrato de erros e teste de interface renderizada |
| 10 | Build, lint, banco, APIs, UI e acessibilidade passam | 25 testes, lint, build, testes SQL, advisors e inspeção 1440/1024/390 px |

## Decisão final

Preencher imediatamente antes da produção:

- Backup verificado em: `________________`
- Restauração testada por: `________________`
- Baseline e reconciliação idênticos: `sim / não`
- Advisors sem alerta novo: `sim / não`
- Responsável técnico: `________________`
- Responsável do RH: `________________`
- Commit aprovado: `________________`
- Autorização final registrada em: `________________`

Qualquer resposta vazia ou “não” mantém a produção bloqueada.
