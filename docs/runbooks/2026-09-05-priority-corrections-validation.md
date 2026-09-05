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

## Checkpoint seguinte — tarefa 5 concluída localmente

Base: `68d536e`. Autorização: executar a etapa de datas no fuso da empresa, na mesma área isolada e sem subagentes. Este checkpoint substitui a retomada anterior.

Implementado:

- `db/civil-date.ts` converte instantes em datas civis no fuso da organização, com partes explícitas de ano/mês/dia. O indicador conta dias de calendário, inclusive nas viradas de mês/ano e mudanças de horário de verão.
- Registro às 22h de São Paulo não aparece como feito no dia seguinte. Datas inválidas ou sem fuso ficam fora da média, com contador explícito. Sem datas válidas, a média é indisponível, não zero.
- Fuso ausente ou inválido interrompe a consulta, sem assumir o fuso do computador. A data de hoje usada na apresentação de vencimentos também usa a conversão civil; nenhuma política ou lote é alterado.
- Painel distingue “Última data trabalhada” de “Último envio”. O envio usa o maior instante válido dentro da consulta, e não a primeira linha ordenada por dia trabalhado. Horário exibido no fuso retornado pelo servidor.
- Painel e Pessoas usam “Dias entre trabalho e registro”; o painel também mostra “Registrados após a data trabalhada”. Registros com data inválida recebem aviso de exclusão do cálculo.
- Simulador local alinhado aos indicadores calculados somente sobre os lançamentos consultados. Nenhum registro ou versão de origem é regravado.

| Verificação da tarefa 5 | Resultado observado |
|---|---|
| Baseline direcionado | 27 testes passaram |
| TDD | Falhas reproduzidas: função ausente, dia UTC incorreto, último envio incorreto, média inválida, fuso assumido e rótulos ausentes; testes passaram após implementação |
| Datas civis | 22h/virada do dia, mês, ano, ano bissexto, offset explícito, Tóquio, horário de verão em Nova York, datas inválidas e registro antecipado |
| Último envio | Maior instante válido selecionado independentemente da data trabalhada; inválido excluído |
| Preservação | Comparação integral das tabelas fictícias antes/depois; zero gravações e zero RPC nas consultas verificadas |
| Suíte completa | 201 testes passaram; zero falhas, cancelados ou ignorados |
| Lint e TypeScript | Código de saída 0 em ambos |
| Preview fictício | Painel exibe 03/08/2026 e envio às 15:00 para o instante 18:00Z; pessoa sem envios mostra indisponibilidade; rótulo conferido em Pessoas |
| Revisão | Diff e consumidores revisados localmente; nenhuma alteração de SQL, rotas de escrita, permissões ou dependências |

Superpowers orientou execução pelo plano, testes antes da implementação e verificação antes de concluir. Sem delegação. A tabela conserva sua rolagem horizontal existente; a reorganização visual completa do painel continua fora desta etapa.

Limites: nenhum acesso ao Supabase, credenciais ou dados reais de agosto; nenhuma migração, recálculo persistido, fechamento, push, PR ou deploy. Datas inválidas e outro fuso foram verificados nos testes puros, de leitura e renderização conforme os casos acima, não inseridos em dados reais. Build completo isolado, PostgreSQL e matriz integrada de release continuam reservados para a tarefa 7.

Próxima etapa: tarefa 6 — autoria e campos do histórico diário, sem regravar versões. Tarefas 6–7 e a reorganização visual completa continuam pendentes.

## Checkpoint seguinte — tarefa 6 concluída localmente

Base: `c740cc8`. Autorização: completar os detalhes e responsáveis do histórico diário, na área isolada existente e sem subagentes. Este checkpoint substitui a retomada anterior.

Implementado:

- Rota de histórico continua autorizando o lançamento antes de ler versões. Resolve somente os autores citados, com seleção `id,name` e filtro da organização, sem carregar o diretório completo ou enviar e-mails/perfis. IDs são divididos em grupos de 100 para limitar o tamanho da URL; cada grupo usa leitura paginada completa.
- Resposta acrescenta `changed_by_name` e `timezone`. Autor ausente ou de outra organização fica sem nome; falha de leitura não vira autoria desconhecida silenciosamente. Fuso ausente/inválido interrompe a consulta.
- Comparação inclui “Horas consideradas” e “Autorização do dia”, com nomes naturais. Campos ausentes em versões antigas continuam “Não informado”; situação desconhecida recebe aviso, sem substituir o conteúdo gravado.
- Estados de autorização foram conferidos no SQL local: lançamentos usam NOT_APPLICABLE, PENDING_AUTHORIZATION, AUTHORIZED e REJECTED. NEEDS_ADJUSTMENT também recebe rótulo defensivo conforme o plano; nenhuma regra transacional foi alterada.
- Interface prefere o nome resolvido e mantém compatibilidade com o mapa local. Nome é o cadastro resolvido hoje, não um nome histórico imutável. Data/hora usam o fuso da resposta; fixtures antigas usam fallback explícito de São Paulo.
- `openHistory` conserva o identificador que rejeita respostas antigas e armazena o fuso junto às versões. Comparação, carregamento, erro, nova tentativa e vazio continuam distintos.

| Verificação da tarefa 6 | Resultado observado |
|---|---|
| Baseline direcionado | 31 testes passaram |
| TDD | 6 falhas esperadas nos testes novos: campos, nome/fuso, autoria completa, falha paginada e configuração; passaram após implementação. Fixture teve falha de contrato antes do alinhamento |
| Suítes direcionadas | 38 testes de histórico, leitura e visualização DEV passaram |
| Suíte completa | 209 testes passaram, zero falhas/cancelados/ignorados |
| Lint e TypeScript | Código de saída 0 em ambos |
| Autoria | RH e DEV resolvidos; ausente/fora da organização permanecem null; seleção limitada aos IDs citados e `id,name` |
| Paginação | 1.105 versões e autores com limite fictício de 50 por página retornam completos; falha na segunda página de autores/versões impede sucesso parcial |
| Permissões | Colaborador não abre lançamento alheio; bloqueio ocorre antes da leitura de versões; acesso ao próprio lançamento preservado |
| Preservação | Conteúdo integral das tabelas e versões fictícias igual antes/depois; zero gravações e zero RPC nas consultas verificadas |
| Campos e fuso | Zero horas preservado como 00:00; 120 min como 02:00; situação desconhecida explicitada; São Paulo/Tóquio e virada da meia-noite testados na renderização real |
| Preview | Campos novos, antes/depois e responsável visíveis; ausência antiga como Não informado; carregamento lento explícito; erro seguido de Tentar novamente recupera versões; histórico vazio do inativo acessível |
| Revisão local | Diff, consumidores e proteção contra respostas atrasadas revisados; nenhuma mudança de permissões, escrita, SQL ou dependências |

Superpowers orientou execução pelo plano, testes antes da implementação e verificação antes de concluir. Sem delegação. O preview antigo estava sem servidor e exibia código anterior em memória; foi reiniciado com ambiente filtrado e configuração fictícia sem Supabase, em 127.0.0.1:4176. A nova aba foi conferida com os campos atuais. Não foi necessário alterar a configuração do navegador ou proteções de rede.

Limites: nenhum acesso ao Supabase, credenciais ou dados reais de agosto; nenhuma migração, recálculo persistido, fechamento, push, PR ou deploy. Build completo isolado, PostgreSQL, matriz de respostas atrasadas e teste responsivo integrado de release continuam na tarefa 7. As comparações numéricas dos campos novos foram verificadas nos testes de renderização; o preview manteve a versão fictícia antiga com esses campos ausentes.

Próxima etapa: tarefa 7 — revisão integrada, compilação isolada e cenários PostgreSQL fictícios. Publicação depende das verificações e da aprovação específica do release. A reorganização visual completa continua em entrega separada.

## Checkpoint seguinte — tarefa 7, validação local integrada concluída

Data: 2026-09-05. Código validado: `6e08cc0`, na branch `feature/reports-redesign-design`. Este checkpoint substitui a retomada anterior. Autorização desta etapa: validação integrada local, sem publicação e sem subagentes.

### Isolamento e compilação

- `npm run verify:workflow` criou `C:\Users\danyel\AppData\Local\Temp\horus-workflow-check-rKqKtA`, copiando fontes rastreadas e dependências locais, excluindo arquivos de ambiente/credenciais. Processos usam `buildSafeEnv`, sem variáveis Supabase e com telemetria desativada.
- Vinext compilou; os **209 testes da aplicação passaram**, sem falhas, cancelamentos ou testes ignorados; lint terminou com sucesso. A primeira execução completa retornou código 1 no Next porque não conseguiu baixar Manrope/Sora do Google Fonts. Isso foi falha de ambiente, não build aprovado.
- Repetição autorizada de Next e `tsc --noEmit`, na mesma cópia e ainda com ambiente filtrado: compilação Next concluída, rotas geradas e **código final 0**. Não foi necessário alterar código, fontes, certificados ou proteções do projeto. Não se afirma que a primeira execução única passou: todas as etapas passaram considerando a repetição documentada.
- Preview iniciado na mesma cópia isolada, com `tests/browser/vite.config.ts`, ambiente filtrado e porta 4177. Não foi feita outra cópia por `preview:workflow`. Interface exibe “TESTE LOCAL — dados fictícios; sem Supabase”. Nenhuma chamada real de produção foi usada para navegação ou escrita.

### PostgreSQL exclusivamente fictício

Executáveis existentes: `C:\Users\danyel\AppData\Local\Temp\horus-postgres-tests-bf4dfb1be39545bdb2635ed7a7d24bb1\pgsql\bin`. Nenhum software foi instalado. Comando: `node scripts/verify-closing-postgres.mjs --bin <pasta acima> --candidate`.

O procedimento original do plano omitia `--candidate`; corrigido somente na documentação. Esse modo instala no cluster fictício novo as funções do SQL existente `20260903171101`, já publicado conforme `production-release-validation.md`. Sem o sinalizador, o executor testa apenas sua base antiga. Nenhum arquivo SQL foi alterado, nenhuma migração foi criada e nada foi aplicado no Supabase.

A primeira tentativa não iniciou o servidor por restrição de processo do Windows (`pg_ctl: não pôde criar token restrito`, erro 87), com cluster fictício retido em `horus-closing-db-c7769R`, sem `postmaster.pid`. A repetição fora dessa restrição foi autorizada, usando o mesmo executor seguro, que criou **outro** cluster novo:

- PostgreSQL **17.11**, `127.0.0.1:58703`.
- Diretório: `C:\Users\danyel\AppData\Local\Temp\horus-closing-db-0HZ7JT`.
- **39 testes passaram; zero falhas; código de saída 0**.
- Executor confirmou `Test server stopped`. Arquivos sintéticos foram retidos; nenhum banco real ou diretório de dados existente foi aberto.

Casos observados: preservação integral de linhas ao instalar/repetir as funções, rollback de instalação adulterada, fechamento repetido sem reescrever dias/versões, fechamento independente de outra pessoa, falha de auditoria sem alteração parcial, autorização pendente e ajuste bloqueando o mês, ocorrência sobreposta, mês fechado recusando edição/recalculo, aprovação atômica, atores de outra organização recusados, concorrência entre edição/aprovação/fechamento, reabertura fictícia preservando versões, créditos vencidos conforme política e reserva anterior preservada. Esses resultados validam fixtures e regras executadas, não constituem inspeção dos dados reais.

### Matriz integrada de navegação e regressão

| Cenário | Evidência desta execução | Resultado / limite |
|---|---|---|
| RH, fechamento individual | Ana selecionada; revisão mostrou nome/mês e aviso de preservação; confirmação fictícia moveu apenas Ana para “Mês fechado” | Passou no navegador |
| RH, fechamento coletivo | Seleção dos dois prontos, revisão explícita e resultado “Equipe selecionada fechada” | Passou no navegador; Carla sem registro não foi inventada/incluída |
| Preservação após fechamento coletivo | Snapshot visível de dias e versões antes/depois, 2.035 caracteres, idêntico | Passou no simulador; complementado pela comparação integral no PostgreSQL |
| Resultado parcial | Ana fechada e Bruno impedido, explicação por pessoa, “Envio encerrado” desabilitado | Passou; painel de chamadas mostrou um envio por pessoa, sem repetição |
| Resultado incerto | Ana não confirmada; Bruno não enviado; orientação para consultar antes de repetir | Passou; painel de chamadas mostrou somente um POST, sem continuação/reenvio automático |
| Mês sem lançamentos | Carla com folha existente e abono: seleção desabilitada até conferência explícita | Passou; não confundido com folha ausente |
| Mês fechado | Ana exibida no grupo fechado sem seleção; metadados antigos ausentes como “Não informado” | Passou |
| Metadados indisponíveis | Todas as seleções e revisão desabilitadas; números indisponíveis, não zero | Passou |
| Pendência / requer ajuste | Navegador bloqueou Ana com dia não autorizado e atalho à pendência; suíte PostgreSQL bloqueou NEEDS_ADJUSTMENT sem mudar histórico | Passou nas camadas indicadas; não criada fixture adicional de ajuste na UI |
| Falha de leitura | Setembro exibiu erro e “Tentar novamente”, sem manter números antigos como sucesso; tentativa explícita recuperou | Passou |
| Resposta atrasada | Com agosto atrasado, troca setembro → agosto → setembro permaneceu em setembro e 06:00 após a resposta antiga | Passou no navegador; reducers também cobertos nos 209 testes |
| Colaborador | “Meu mês”, “Banco de horas”, “Solicitações”; próprio lançamento e histórico; sem fechamento de equipe | Passou; autorização real das rotas verificada nas suítes |
| DEV/RH e DEV como colaborador | Visão RH mantém áreas administrativas; visualizar Ana mostra somente leitura, sem registrar/editar; retorno à visão RH disponível | Passou |
| Histórico diário | Campos antigos preservados como “Não informado”; autoria, fuso e comparação antes/depois visíveis | Passou; autoria paginada e falhas de leitura cobertas nos testes da tarefa 6 e repetidas na suíte completa |
| Conferência por dia | Opção “Por dia” mantém aviso de somente conferência, fechamento mensal separado e ausência de lançamento não tratada como falta | Passou no navegador |
| Aprovações | Escopo “Todas as datas”, pessoa/tipo/situação explícitos, aviso de independência do Painel e vazio contextual | Passou; filtros e rejeição de resposta de outro escopo cobertos nas suítes |
| Relatórios | Três tipos, filtros e quatro exportações disponíveis; histórico usa “Quem realizou”, “O que aconteceu”, “Pessoa afetada”, “Motivo” e ações naturais | Passou no navegador |
| Arquivos exportados | Testes reais de CSV, Excel atual/pacote e PDF executados na suíte: abertura, tipos, totais, cabeçalhos, paginação e neutralização de fórmulas | Passou nos testes; não repetido download manual no navegador |
| Teclado e foco | Histórico abre com foco em Fechar, Tab permanece no diálogo e Escape fecha devolvendo foco ao botão de origem | Passou no navegador |
| Tela ampla e estreita | 1440×1000 e 390×844; painel adapta cartões/filtros e menu móvel abre Lançamentos; histórico cabe na tela estreita | Passou nas áreas inspecionadas; tamanho original restaurado |
| Densidade da tabela | Acompanhamento das pessoas mantém rolagem horizontal interna; em 390 px, contêiner de 346 px para tabela de cerca de 1.045 px | Limitação visual conhecida; reorganização pertence à Entrega B, não foi disfarçada como tabela compacta |

Os controles expandidos do simulador sobrepuseram um botão de período durante o ensaio; a ação foi identificada sem efeito na consulta, os controles foram recolhidos e o cenário foi repetido com resultado observado. Não se contou a tentativa sem efeito como validação. Não foi detectada regressão funcional nos cenários acima, mas isso não equivale a garantia de ausência de qualquer defeito ou teste de produção.

### Revisão e próxima etapa

Consumidores de escopo de aprovações, resumo, saldos, histórico e chaves de workspace revisados diretamente. Diff completo `54be4957d4e944f800935b0cafdf2c025a6cfeba..6e08cc0`: 32 arquivos, sem SQL, migração, dependência ou alteração de política; `git diff --check` sem erros. A execução atual modifica apenas estes registros documentais.

Superpowers orientou a execução pelo plano e a verificação antes de concluir; nenhum subagente usado. Nenhum acesso ao Supabase, leitura de credenciais, alteração em dados reais de agosto, push, PR, merge ou deploy nesta etapa. A prova de preservação é local/fictícia; não se afirma ter comparado o banco de produção.

**Próxima etapa:** mediante autorização, preparar a publicação controlada do aplicativo (PR/revisão, versão anterior recuperável e preview identificado). Aprovação específica do release continua obrigatória antes de produção. Nenhum comando Supabase deve integrar a publicação. O redesenho visual completo do painel e novas regras permanecem fora deste pacote.

## Preparação do PR — autorizada em 05/09/2026

O usuário autorizou preparar o PR e a liberação controlada. Isso não autoriza merge, auto-merge, deploy ou testes com escrita em produção nesta etapa.

- Referências Git atualizadas: `origin/main` em `213607ffc7629518f53c86cdb7945d0114632115`, merge do PR #4. Sua árvore é idêntica à base funcional `54be495`; portanto o novo PR não repete a entrega anterior de relatórios. Base do novo PR: `main`; head: `feature/reports-redesign-design`. O PR #1, proposta antiga diferente, não faz parte desta entrega.
- Acrescentado em `vercel.json` somente `git.deploymentEnabled["feature/reports-redesign-design"] = false`. Comparação automática confirmou todas as demais configurações intactas. Impede deploy automático via Git desta branch de revisão; não altera main, contas, autenticação, variáveis ou permissões. Não impede deploy manual nem merge indevido. Referência oficial: https://vercel.com/docs/project-configuration/git-configuration.
- Nova execução completa em cópia sem credenciais `C:\Users\danyel\AppData\Local\Temp\horus-workflow-check-P7uUHP`: Vinext, **209 testes aprovados**, lint, Next e TypeScript; **saída final 0**. PostgreSQL não foi repetido nesta preparação documental/configuracional; os 39 casos do checkpoint anterior continuam identificados separadamente.
- A primeira tentativa de execução fora da restrição do Windows parou antes de copiar os arquivos por diferença de proprietário do worktree. Repetição usou exceção Git apenas para este caminho e processo; nenhuma configuração global foi gravada. O executor voltou a filtrar o ambiente antes dos builds/testes.
- Revisão direta dos contratos críticos e diff; nenhuma alteração em SQL, migrações, dependências, políticas, sessão, fechamento transacional ou escrita de dias. Busca por padrões comuns de segredos no diff adicionado sem ocorrência; isso não é garantia universal de ausência de segredos. Nenhum arquivo de ambiente incluído.
- Produção identificada por metadados Vercel, sem abrir o dashboard real: deployment `dpl_AQaQzaenYVgFKr3kVzT4qS3Hsy7u`, READY, target production, commit `213607ffc7629518f53c86cdb7945d0114632115`, alias `horuscodex.vercel.app`, sem erro de alias. Esse artefato é a referência anterior para reversão somente do aplicativo; reversão não executada.

O PR deve permanecer em rascunho, com evidências e limites acima. Não há workflow GitHub Actions neste repositório; não apresentar ausência de checks como aprovação remota. Preview externo ainda não foi criado nem seu isolamento comprovado. Manter worktree e histórico local para revisão. Supabase e os dados reais de agosto não foram acessados nesta preparação.

### PR aberto e verificado

[PR #5 — Corrige consultas, aprovações e histórico sem alterar o banco](https://github.com/jmarcobrito/horuscodex/pull/5), aberto em rascunho contra `main`. Commit inicial publicado `2308ffe6847a3f4f449079cda3c6fba454807b67`: 8 commits novos e 33 arquivos, com lista remota conferida contra o escopo local. Nenhum SQL ou dependência incluído. O commit posterior apenas registra este resultado e o andamento do plano.

Consulta após a abertura: nenhum status de CI nem execução de workflow de PR para o commit; não são testes aprovados remotamente. A lista Vercel continuou contendo somente a produção anterior READY, e sinalizou esse deployment como `isRollbackCandidate: true`. Nenhum novo deploy desta branch observado. Não houve merge, auto-merge, deploy manual ou alteração no Supabase. Aprovação específica do release e identificação do ambiente de preview continuam pendentes.

## Prévia remota — 05/09/2026, validação limitada ao ambiente disponível

Usuário autorizou preparar e conferir a prévia, não publicar em produção. Skills de deployment/variáveis Vercel orientaram a inspeção do ambiente; Superpowers orientou registrar o resultado observado e suas limitações.

### Ambiente identificado antes da publicação

Na página autenticada de configuração Vercel, todas as nove variáveis do projeto estavam restritas a Production, inclusive SUPABASE_URL, as chaves do Supabase e a flag de fechamento. Aba Shared: “No shared variables linked”. Nenhum valor foi revelado, copiado ou alterado; nenhuma variável de produção foi levada para Preview. Portanto a prévia não tem backend Supabase configurado e não permite validar login/painel autenticado. Não confundir esse ambiente com um banco fictício remoto.

A ferramenta de deploy não expôs os parâmetros necessários e rejeitou a chamada antes de criar qualquer deployment. A publicação foi feita pelo formulário oficial da Vercel: commit exato `ec88a4655ad6b77b8000257a0cb234316ee66e90`, branch de revisão, destino explicitamente Preview, botão “Create Preview Deployment”. Nenhum ajuste da configuração de bloqueio automático foi necessário.

### Resultado

- URL: https://horuscodex-fy9b63sr0-joao-marco-brito-s-projects.vercel.app/
- Deployment: `dpl_7DAPeSkbK1LSVrz1nMK2WohvjGo8`.
- Estado READY, sem erro de alias, associado ao PR #5 e ao SHA exato acima. Interface confirma Preview; metadados retornam `target: null` (não production).
- Build Next/Turbopack concluído na Vercel; log informa build de 14 s e deployment concluído às 22:29:01 UTC (cerca de 25 s desde o início do build). Rotas geradas. Aviso preexistente: engines Node sem limite de versão principal; não alterado nesta etapa.
- Navegador exibiu “Entre no Horus”, campos E-mail/Senha e botões de entrada. Nenhuma credencial digitada, nenhum login ou formulário enviado. Logs da própria prévia registraram GET / com status 200.
- Uma consulta GET à API dashboard da prévia retornou **503, “Banco de dados não configurado.”**, com `private, no-store`. Ausência de backend explícita, não sucesso funcional. Logs limitados a este deployment mostram SupabaseConfigurationError por falta de SUPABASE_URL; não afirmar ausência de erros de execução.
- A consulta da raiz pelo conector retornou 302; não usada como evidência de 200. A evidência de renderização veio do navegador e dos logs acima. Proteções de acesso da Vercel não foram modificadas e nenhum link de bypass foi criado.
- Metadados da produção anterior reconferidos depois: `dpl_AQaQzaenYVgFKr3kVzT4qS3Hsy7u`, READY, commit `213607f`, ainda com alias oficial `horuscodex.vercel.app`. Nenhuma promoção ou merge realizado.

### Limite e próximo portão

Prévia publicada e compilação remota confirmada; **validação autenticada remota não realizada**, porque não existe backend de teste configurado. Os 209 testes e 39 casos PostgreSQL fictícios pertencem aos checkpoints anteriores e não foram executados contra esta URL. Nenhuma leitura ou escrita no Supabase real ocorreu nesta etapa. Banco de teste separado, se desejado, exige definição/autorização própria; não ampliar acesso ao banco real para preencher essa lacuna.

Antes de produção, apresentar este limite e pedir aprovação específica. **Não promover este artefato Preview sem configuração de banco.** A publicação oficial, se autorizada, precisa de build Production do código aprovado com as variáveis Production já existentes, sem comandos Supabase, migrações ou mudanças de credenciais. Depois, somente conferência de leitura; nunca fechar/reabrir/editar agosto como teste. Reversão permanece restrita ao aplicativo e ao deployment anterior identificado. PR continua em rascunho até a decisão de liberação.
