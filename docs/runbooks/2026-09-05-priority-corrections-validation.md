# Validação das correções prioritárias — Horus

## Checkpoint de 2026-09-05: somente tarefa 1

Autorização desta rodada: iniciar a primeira etapa do plano, nesta conversa e sem subagentes. Base: `54be4957d4e944f800935b0cafdf2c025a6cfeba`. Mantida a área isolada `safer-month-closing`, branch local `feature/reports-redesign-design`; a situação remota da branch deverá ser reavaliada antes de qualquer PR.

Implementado: POST de ocorrência rejeita novos usos de banco com 409, após autenticar e antes da RPC. A guarda usa a mesma coerção textual da validação existente, cobrindo também arrays de um elemento que antes burlavam a comparação estrita. A interface remove as duas opções incompatíveis e oferece “Solicitar folga com banco de horas”, copiando pessoa, datas, horas e descrição para o formulário existente, sem enviar requisição nessa passagem.

## Evidências

| Verificação | Resultado observado |
|---|---|
| Baseline: rotas mensais, contrato DEV e lançamentos | 20 testes passaram |
| TDD: nova rejeição na rota antes da correção | Falha esperada: 201 em vez de 409 |
| TDD: arrays na validação antes do reforço | Falha esperada: 201 em vez de 409 |
| Rotas mensais após correção | 14 testes passaram; 4 perfis × 6 combinações de tipo/efeito bloqueados sem RPC |
| Fixture de solicitação antes/depois de suporte no ensaio | Dois testes inicialmente falharam por rota não simulada; depois 6/6 passaram |
| Suíte completa `node --test tests/*.test.mjs` após última mudança | 163 passaram, 0 falhas, 0 ignorados |
| `npm run lint` após última mudança | Código de saída 0, sem problemas relatados |
| `tsc --noEmit` após última mudança | Código de saída 0 |
| Preview local, RH: opções | Não oferece BANK_LEAVE nem “Consome banco” na ocorrência |
| Preview local, RH: transferência | Carla Teste, 12–13/08/2026, 2,25h e descrição mantidos no formulário de folga |
| Preview local, RH: cancelar | Log contém somente GET de consulta; nenhum POST |
| Preview local, RH: erro simulado | Erro 409 mantém datas, 10h e justificativa |
| Preview local, RH: envio após corrigir horas | POST somente em `/api/leave-requests`, com `requestedMinutes: 135`; pedido aparece pendente, 02:15 |
| Preview local, DEV como colaborador | Banner somente leitura; tela Solicitações sem ações de criação/decisão |
| Preview local, DEV na visão RH | Novo acesso à solicitação visível no modal; conferência visual realizada |

O limite de 8h do simulador serve apenas para provocar erro de transporte no ensaio; **não é regra do produto nem validação do saldo real**. O simulador nunca acessa Supabase. Os testes das rotas reais substituem apenas autenticação/persistência por doubles; os testes da fixture não substituem a verificação das funções SQL de negócio.

## Preservação e limites

- Nenhuma chamada ao Supabase de produção, leitura de credenciais, migração, mudança de SQL, política, permissão ou dependência nesta etapa.
- Nenhum lançamento real foi criado, editado, recalculado, fechado ou apagado. Agosto e versões históricas não foram tocados por este trabalho.
- PATCH de ocorrência, leitores, fechamento e rotas de folga existentes permanecem inalterados. Ocorrências antigas não foram convertidas nem canceladas.
- Os testes comparam o conteúdo dos dias e versões fictícios antes/depois e exigem ausência de RPC nos casos bloqueados; não representam uma nova auditoria do conteúdo do banco real.
- Preview usado: `http://127.0.0.1:4176/`, com a marca “TESTE LOCAL — dados fictícios; sem Supabase”. A porta 4175 já estava ocupada e seu processo não foi alterado.
- Build completo isolado, testes PostgreSQL e matriz integrada de release não foram executados nesta rodada. Continuam obrigatórios na tarefa 7, antes de propor publicação.
- Nenhum push, PR, merge ou deploy nesta rodada.

## Retomada

Tarefa 1 concluída localmente. Próxima: tarefa 2, escopo explícito de Aprovações, “Todas as datas” versus “Período escolhido”, com filtros e estado independente. Consultar o plano e conferir o diff antes de editar. As tarefas 2–7, reorganização visual do painel e publicação não estão concluídas.

Se uma consulta futura identificar ocorrência antiga de consumo de banco, bloquear a liberação para definir o tratamento; jamais regravar ou corrigir automaticamente esse histórico.
