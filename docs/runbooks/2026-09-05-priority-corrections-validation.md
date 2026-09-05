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

## Checkpoint seguinte — tarefa 3 concluída localmente

Base: `9c46e42`. Autorização: seguir para a carga mensal por pessoa/mês, nesta área local, sem subagentes nem operações remotas. Este checkpoint substitui a retomada anterior.

Implementado:

- O resumo e cada pessoa usam a mesma função pura de carga mensal. Cada mês com registro conserva sua carga gravada, inclusive zero; apenas meses sem registro de pessoas atualmente ativas recebem estimativa baseada na política consultada.
- Pessoas inativas mantêm toda a carga histórica disponível, mas não recebem carga estimada para meses ausentes. Totais individuais e da equipe usam o mesmo critério.
- A chave pessoa/ano/mês identifica duplicatas: a consulta falha explicitamente sem somar duas vezes e sem tentar reparar registros.
- O mapeamento conserva ano e mês e recebe somente folhas do intervalo consultado. Novos metadados indicam quantos meses estimados existem por pessoa e no total.
- Painel e Lançamentos informam “Inclui estimativa para meses sem registro mensal” quando pertinente. Em Lançamentos, o aviso acompanha a seleção individual; não aparece na conferência diária.
- O servidor fictício reutiliza a mesma função, inclusive no percentual derivado. Nenhuma dependência ou regra de fechamento foi alterada.

| Verificação da tarefa 3 | Resultado observado |
|---|---|
| Baseline | 29 testes passaram |
| TDD do resumo | Caso de dois meses falhou com 60 em vez de 120 antes da correção |
| TDD da integração | Pessoa ativa com carga histórica 60 e política 120 retornava 60 em vez de 180; duplicata não era rejeitada |
| TDD da interface | Avisos ausentes no Painel e em Lançamentos antes da implementação |
| TDD da fixture | Após corrigir a ordem de inicialização do teste, caso de dois meses falhou com 480 em vez de 960 |
| Suítes específicas após correção | 38 testes passaram, zero falhas/ignorados |
| Suíte completa final | 180 testes passaram, zero falhas/ignorados |
| Lint e TypeScript | Código de saída 0 em ambos |
| Preservação | Comparação integral das tabelas fictícias antes/depois; zero mutações e zero RPC nas consultas, inclusive na falha por duplicata |
| Histórico | Cargas históricas diferentes e zero preservados; inativo continua incluído; consulta de setembro não estima carga para inativo sem registro |
| Isolamento | Totais por equipe e pessoa concordam; consulta PJ retorna somente sua carga e estimativa |
| Preview RH, setembro–outubro | 06:00 realizadas, meta 32:00, com aviso de estimativa |
| Preview RH, agosto | Ana: meta 08:00 sem aviso; Carla: meta 08:00 com aviso; Bruno inativo: histórico 05:00 e meta 08:00 sem aviso |
| Conferência diária | Sem meta mensal nem aviso de estimativa; fechamento mensal permanece separado |
| Visual | Aviso visível na janela normal e em 390×844, após a transição responsiva; largura restaurada |
| Navegação | Log do simulador mostrou somente dois GET de consulta, nenhum fechamento ou outro envio |

Revisão local: consumidores de `buildPeriodSummary`/`requiredForPerson` conferidos; consultas SQL, autenticação, políticas, migrações, dependências e rotas de escrita inalteradas. Superpowers orientou execução, reprodução do erro antes da correção e verificação antes de concluir. Sem grafo Graphify nesta área; impacto conferido diretamente no código.

Limites: nenhuma conexão ao Supabase de produção, leitura de credenciais, recálculo ou alteração em agosto. As provas de preservação usam dados fictícios, não uma nova auditoria do banco real. Nenhum push, PR ou deploy. Build completo isolado e PostgreSQL continuam na tarefa 7.

Próxima etapa: tarefa 4 — distinguir informações do mês, dias com lançamento e saldo livre, evitando indicadores com significados misturados. Tarefas 4–7 e a reorganização visual completa permanecem pendentes.

## Checkpoint seguinte — tarefa 4 concluída localmente

Base: `a1d8e24`. Autorização: executar a próxima etapa dos indicadores, mantendo a área isolada e sem subagentes. Este checkpoint substitui a retomada anterior.

Implementado:

- Função pura `app/dashboard-display.ts` separa horas trabalhadas/consideradas dos lançamentos, contexto mensal completo, dias distintos por pessoa e créditos válidos/reservados/disponíveis.
- Intervalos livres mostram apenas as horas dos lançamentos dentro das datas. Abonos, carga e projeção dos meses aparecem em “Contexto dos meses consultados”, com aviso de valores completos, sem rateio.
- A projeção mensal usa os totais de `monthlyTimesheets.consideredMinutes`, incluindo valores persistidos de folhas fechadas, menos a carga agregada. Não reutiliza a projeção híbrida das datas. Ausência de metadados resulta em “Contexto mensal indisponível”, não zero.
- Painel e Pessoas mostram “Dias com lançamento” e “Horas em relação à carga mensal”. Duas entradas no mesmo dia contam uma data; fora de um mês completo o percentual é substituído por “Consulte um mês completo”. Não se infere falta.
- O banco apresenta “Disponível para usar”, “Créditos válidos”, “Reservado para folgas” e déficit separado. Disponível soma o restante menos reservas por lote, limitado a zero por lote. Créditos expirados/consumidos/cancelados/liquidados e débitos não entram; a situação de vencimento continua definida no servidor.
- Aviso explícito: o banco mostra o saldo atual, não uma posição histórica do mês. O contrato de `metrics.positiveBalanceMinutes` não foi alterado.
- Ajustes CSS limitados ao espaçamento de Pessoas e à área de contexto mensal, inclusive empilhamento em tela estreita. Nenhuma reorganização completa do painel.

| Verificação da tarefa 4 | Resultado observado |
|---|---|
| Baseline direcionado | 11 testes passaram |
| TDD da função de apresentação | 6 testes inicialmente falharam pela função ausente, conforme plano; passaram após implementação |
| TDD de renderização real | 4 falhas esperadas: contexto ausente, indisponibilidade omitida, dias ausentes e saldo reservado tratado como disponível |
| Crédito reservado | 10h válidas − 8h reservadas = 2h disponíveis; déficit de 1h permanece separado |
| Casos de saldo | Lotes inutilizáveis excluídos; OVERDUE_AVAILABLE incluído; reserva excessiva em um lote não reduz o saldo livre de outro |
| Abono versus dia | Teste: dia vazio = 0h; abono mensal de 8h permanece no contexto; projeção usa 900 − 600 = +300 min persistidos, não −120 min híbridos |
| Dias e períodos | Duas entradas no mesmo dia contam uma data; pessoas sem entradas têm zero; mês completo reconhecido pelas datas, incluindo fevereiro bissexto |
| Preservação | Objetos fictícios comparados integralmente antes/depois; função não modifica entradas, lotes, folhas ou métricas de origem |
| Suíte completa | 190 testes passaram, zero falhas/ignorados |
| Lint e TypeScript | Código de saída 0 em ambos |
| Preview de intervalo vazio | Em 10/08, 00:00 trabalhadas e consideradas; contexto mensal separado; percentual oculto |
| Preview com abono fictício | Em 10/08, zero horas do dia; 01:00 de abono no contexto, carga 24:00 e projeção mensal −10:00 |
| Metadados indisponíveis | Mensagem explícita, sem cartões mensais falsamente zerados |
| Banco vazio e Pessoas | Rótulos novos conferidos; créditos e déficit separados; inativo permanece visível em Pessoas |
| Visual | Janela normal e 390×844 conferidas; contexto empilhado e legível; largura restaurada |
| Consultas | No último cenário, log registra somente GET do intervalo; nenhuma chamada de fechamento |

Superpowers orientou execução pelo plano, testes antes da implementação e verificação antes de concluir. Revisão local do diff e dos consumidores, sem delegação. Esta alteração é restrita à apresentação; backend, rotas, permissões, SQL, fechamento e relatórios/exportações permanecem inalterados.

Limites: nenhum acesso ao Supabase, credenciais ou dados reais de agosto; nenhuma migração, dependência nova, recálculo, push, PR ou deploy. A conferência visual de banco nesta rodada usou saldo zero; os valores de reserva e disponibilidade não zero foram verificados nos testes da função e de renderização real. Build completo isolado, PostgreSQL e matriz integrada de release continuam reservados para a tarefa 7.

Próxima etapa: tarefa 5 — datas de registro no fuso da organização e nomes claros para atraso/último envio. Tarefas 5–7 e a reorganização visual completa continuam pendentes.
