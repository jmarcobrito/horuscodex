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

## Checkpoint seguinte — tarefa 2 concluída localmente

Base desta rodada: `61b523c`. Autorização: seguir para Aprovações, sem subagentes, operações remotas ou alterações no banco. Este checkpoint substitui a seção de retomada anterior.

Implementado:

- As três consultas de solicitações usam o mesmo escopo: `all` sem restrição de datas, ou `period` por interseção com o período informado. Folgas que atravessam meses entram nos dois meses correspondentes.
- A rota valida o escopo e responde de forma privada/não cacheável; organização e identidade continuam restritas no servidor.
- A tela começa em “Todas as datas” e “Pendências”. Filtros de pessoa, tipo e situação se combinam. “Aguardando ajuste” entra na contagem de pendências; pedidos aprovados continuam acessíveis em “Todas as situações” ou “Aprovadas”.
- Escolhas são guardadas por perfil/pessoa visualizada durante a sessão. Cada escopo tem estado próprio; respostas de outro escopo ou de requisições anteriores não substituem a consulta ativa.
- O foco vindo do fechamento seleciona explicitamente mês e pessoa; “Limpar foco” conserva o período. Decidir, solicitar e fechar continuam usando as rotas existentes, não alteradas nesta tarefa.
- Novo helper puro `app/approvals-model.ts`, teste de renderização `tests/approvals-view.test.mjs` e espaçamento CSS local dos filtros. Nenhuma dependência nova.

| Verificação da tarefa 2 | Resultado observado |
|---|---|
| Baseline de leituras, estado e fixture | 26 testes passaram |
| TDD de escopo, isolamento e rota | 4 falhas esperadas antes da implementação; passaram após a correção |
| TDD de filtros/pendências | Renderização inicialmente exibia aprovados e ignorava filtros; passou após a correção |
| TDD do contador de ajustes | 1104 em vez de 1105 antes da correção; 1105 depois |
| Suíte completa final | 171 testes, 171 passaram, zero falhas/ignorados |
| Lint e TypeScript finais | Código de saída 0 em ambos |
| Diff | Sem erros de whitespace; sem SQL, migração, dependência ou credencial |
| RH: períodos independentes | Aprovações em setembro, Painel em agosto; retorno à aba conservou setembro |
| RH: pedido de agosto | Pedido fictício aparece em todas as datas e não aparece em setembro |
| Pessoa | Carla sem pedidos mostra estado vazio, sem exibir o pedido da Ana |
| Fechamento → pendência | Ana e agosto explícitos; formulário de autorização aberto sem envio; cancelar/limpar foco não mudou o mês |
| Falha de leitura | Erro explícito, sem falso vazio; filtros de datas continuam disponíveis e “Tentar novamente” recupera a consulta |
| Resposta atrasada | Agosto em carregamento; escolha imediata de setembro; setembro permanece após o retorno atrasado |
| DEV como colaborador | Banner somente leitura; sem botões de criação nem filtro que amplie a pessoa consultada |
| Visual | Filtros conferidos na janela normal e em 390×844; janela restaurada |

O log do simulador mostrou somente GET ao alternar datas/filtros. O único POST do ensaio de filtros foi a criação explicitamente fictícia de uma folga na memória do simulador; não houve chamada de fechamento. Os testes de leitura real com persistência substituída verificaram 1.105 autorizações e comparação integral das tabelas fictícias antes/depois, com zero mutações/RPC.

Limites: Graphify não tem grafo nesta área; relações confirmadas no código e nos testes, sem criar grafo. Build completo isolado, PostgreSQL e revisão integrada continuam na tarefa 7. Nenhum deploy, push, PR ou acesso ao Supabase de produção nesta rodada. Não é uma nova verificação do conteúdo real de agosto.

Próxima etapa: tarefa 3, carga mensal por pessoa e por mês, somente na leitura. Tarefas 3–7 e a reorganização visual completa do painel permanecem pendentes.
