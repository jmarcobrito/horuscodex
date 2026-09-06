# Horus — checkpoint da implementação do Painel mensal

Data: 05/09/2026. Branch: `feature/reports-redesign-design`, no worktree `safer-month-closing`.

## Situação

Implementação local das tarefas 1–5 realizada; tarefa 6 iniciada e **não concluída**. Não publicar esta revisão como validada. Nenhum push, PR, merge ou deploy executado nesta entrega. Continuação sem subagentes, conforme usuário.

## Código implementado

- Projeções puras para pessoa/setor/situação, seis contagens mensais, históricos de inativos e banco atual sem influência do filtro de situação.
- Navegação contextual para pessoa, dia, pendências, fechamento e extrato. Navegação normal conserva períodos por aba.
- Timestamp somente da resposta aceita; requestId e token de navegação protegem resultados atrasados e mudanças de identidade.
- Painel da opção 1 com seletor compacto, intervalo recolhível, conferência da equipe e detalhes antigos preservados.
- Filtros recebidos visíveis nos destinos, possibilidade de limpar e reset de seleção/reconhecimento ao mudar escopo do fechamento.
- Fixture dedicada de seis situações, 40 pessoas e consulta vazia; snapshot integral e contador de leituras/gravações no ensaio.

Commits anteriores deste checkpoint: `b10514f` (projeções), `b55219e` (navegação/timestamp), `98f970d` (layout), `9b6dd4a` (destinos filtrados).

## Evidências desta execução

| Verificação | Resultado | Limite |
| --- | --- | --- |
| Base antes de implementar | 17 testes passaram | Suítes de projeção, fechamento e workspaces |
| TDD | Falhas esperadas observadas antes dos novos módulos/props; testes verdes após implementar | Não substitui testes de navegador |
| Regressões selecionadas atuais | **68 testes, 68 passaram, zero falhas** | Overview, workspaces, período, DEV, registro, estimativas, HTML, proteção histórica, fechamento, conferência diária e servidor fictício |
| Leituras fictícias | Snapshot integral antes/depois idêntico; somente GET; zero chamadas de fechamento | Ensaio Node; repetição interativa ainda pendente |
| ESLint dos arquivos TypeScript/React alterados | Saída 0, sem erros/avisos | Ambiente filtrado por buildSafeEnv, sem servidor real |
| TypeScript | `tsc --noEmit --incremental false`, saída 0 | Checagem local em ambiente filtrado, não substitui compilação isolada |
| Diff de preservação | Sem alterações em db, app/api, supabase, package.json, lockfile, closing-model ou closing-client | Nenhuma regra transacional alterada |
| Verificação isolada, após limpeza autorizada | **Vinext, 223 testes, lint global, Next e TypeScript passaram por etapas** | Executor inicial encerrou com erro ao baixar fontes; Next repetido na mesma cópia com rede autorizada, saída 0; TypeScript posterior, saída 0. Não alegar execução única ininterrupta |
| Navegador e Product Design QA | **Matriz funcional parcialmente executada; QA visual pendente** | Comparação iniciada; fontes substitutas e densidade das capturas impedem aprovação visual. `design-qa.md`: final result: blocked |
| PostgreSQL fictício | **PostgreSQL 17.11: 39 testes passaram, zero falhas; servidor encerrado** | Cluster novo `horus-closing-db-TzpEIE`; nunca recebeu conexão Supabase nem PGDATA existente |

## Incidente de espaço local

`npm run verify:workflow` criou `C:/Users/danyel/AppData/Local/Temp/horus-workflow-check-PTS2z0`, mas a cópia de `node_modules/webpack/lib/ConcatenationScope.js` falhou por falta de espaço. C: reportou zero bytes livres.

A cópia temporária incompleta, criada exclusivamente nesta execução, foi removida após verificar o caminho absoluto exato e a presença do código original. Aproximadamente 970 MB foram recuperados. Ela é recriável a partir do repositório; nenhuma fonte original foi removida. Não houve limpeza de outras cópias, previews, pastas pessoais ou dados reais.

Primeira tentativa PostgreSQL: inicialização do servidor não confirmada em `horus-closing-db-lymC1c`. Segunda tentativa: `initdb` falhou explicitamente por disco cheio em `horus-closing-db-lTfOPI` e removeu seu próprio cluster incompleto. Após liberar a cópia temporária, uma nova tentativa criou o cluster fictício `horus-closing-db-TzpEIE` na porta loopback 59242. Não confundir essas tentativas com mudança no banco do sistema.

## Retomada obrigatória

### Limpeza autorizada e retomada — 05/09/2026

Após autorização explícita do usuário, cinco cópias temporárias antigas de testes foram removidas: `horus-workflow-check-WE4ZpV`, `horus-workflow-check-mPdaSf`, `horus-workflow-check-inaN9G`, `horus-workflow-check-h2pCOA` e `horus-workflow-check-R2eNkn`, todas diretamente sob `C:/Users/danyel/AppData/Local/Temp/`.

Antes da exclusão: caminhos absolutos conferidos, ausência de `.git`, arquivos de ambiente e reparse points; script do executor isolado presente; processos em execução e os previews locais identificados. Previews preservados: porta 4176 no worktree original e porta 4177 na cópia `horus-workflow-check-rKqKtA`. A cópia `horus-workflow-check-7Ft62s`, com vínculo, foi excluída da limpeza. Nenhum cluster PostgreSQL nem diretório de dados real foi removido.

Após a remoção, todos os cinco caminhos reportaram inexistência. Espaço livre passou de 1.219.334.144 para 6.041.964.544 bytes (aproximadamente 4,82 GB recuperados). Remoção definitiva de artefatos reproduzíveis; as fontes e evidências versionadas permanecem no repositório.

### Nova execução isolada

Código funcional conferido: `6278a00`, sem alterações funcionais nesta retomada. Cópia: `C:/Users/danyel/AppData/Local/Temp/horus-workflow-check-pFhQnz`, sem arquivos de ambiente, credenciais ou `.git`; ambiente filtrado por `buildSafeEnv`.

- `npm run verify:workflow`: Vinext concluído, **223 testes passaram, zero falhas**, lint global concluído. O processo chegou ao Next e saiu com código 1 por falha ao baixar Manrope/Sora de Google Fonts, não por falha dos testes.
- Após permissão de rede, somente Next foi repetido na mesma cópia, com o mesmo ambiente filtrado: compilação, TypeScript e geração de rotas concluídos, **saída 0**. Nenhum mock de fonte nem alteração de configuração foi utilizado para fazer o build passar.
- TypeScript independente após esse build: `--noEmit --incremental false`, **saída 0**.
- Ensaio Vite fictício na porta **4178**, a partir dessa cópia, com porta estrita e CSP de WebSocket ajustada em memória exclusivamente para 4178. Banner confirmado antes das interações. Previews anteriores não foram encerrados.

### Evidências interativas desta retomada

| Cenário | Resultado observado | Limite |
| --- | --- | --- |
| Meses independentes | Lançamentos em setembro; voltar ao Painel manteve agosto; Conferir Ana abriu agosto, somente Ana, e focou o título | Fixture de seis situações |
| Histórico diário | Histórico de 03/08 abriu versões, antes/depois e justificativa; edição de mês fechado permaneceu desabilitada | Nenhuma edição executada |
| Seis indicadores | Cada situação filtrou a pessoa correspondente; limpar situação restaurou a lista | Contagens não foram substituídas por constantes |
| Pessoa/setor/inativo | Engenharia mostrou Bruno inativo e Diego; filtro Bruno manteve uma linha. Trocar para sem setor limpou pessoa incompatível com aviso e mostrou Fábio | Comportamento de normalização explicitamente observado |
| Conferência por dia | Começou em 01/08; em 03/08, via setas, Engenharia mostrou Bruno com lançamento e Diego sem lançamento | Preenchimento automatizado direto de data não disparou a mudança esperada; ainda conferir manualmente o campo nativo |
| Limpar contexto diário | Removeu restrição de setor e manteve agosto; lista sem lançamento voltou à equipe autorizada | Não houve escrita |
| Banco por setor | Engenharia: disponível 00:00, reservado 00:00, débito 03:00; extrato mostrou apenas Bruno | Situação Sem lançamentos restringiu tabela a Diego, mas não retirou débito de Bruno do banco do setor |
| Erro/retry | Falha fictícia exibiu mensagem e Tentar novamente; retry recuperou Painel com horário atualizado | Sem repetição de mutações |
| Preservação integral em consultas | **unchanged=true; onlyReads=true; 10 GET; 0 writes; 0 closings** ao concluir percurso de consultas | Snapshot completo do servidor fictício; separado dos cenários de fechamento abaixo |
| Intervalo parcial | Cenário inicial parcial mostrou totais/contexto mensal, sem seis contagens; Ir para fechamento desabilitado; Escolher mês completo focou seletor | Digitação e retorno completo pelo campo nativo ainda pendentes; setas ficam desabilitadas sem mês escolhido |
| Seleção do fechamento | Selecionar prontos marcou somente Bruno; limpar filtros recebidos zerou seleção | Escopo completo recebido do Painel; troca entre dois setores ainda pendente |
| Estados não selecionáveis | Carla pendente, Elisa sem registro e Fábio indisponível desabilitados; Diego sem lançamentos desabilitado até reconhecimento explícito | Apenas fixtures |
| Fechamento coletivo | Bruno + Diego reconhecido: revisão de duas pessoas, confirmação e resultado fechado para ambos; dois POST fictícios, um por pessoa | Fixture reiniciada após o cenário; nenhum mês real fechado |
| Fechamento individual | Revisão/confirmar Bruno mostrou uma pessoa e resultado fechado | Fixture separada |
| Resultado incerto | Uma tentativa fictícia, resultado não confirmado, aviso para consultar situação e Envio encerrado desabilitado; log sem reenvio | Aplicar/reiniciar restaura controles; modo Incerto configurado depois do reset para este teste |
| Resultado parcial | No cenário Normal, Ana fechada e Bruno impedido; dois POST fictícios, sem reenvio; resultado discriminou pessoas | Contagem de closingCalls somente da mutação fictícia efetivada, diferente da contagem de tentativas POST |
| DEV durante leitura atrasada | Iniciada consulta contextual RH de agosto; alternado para colaborador antes do retorno; resultado final Meu mês de Ana, somente leitura, sem Painel RH nem filtros recebidos | Snapshot integral igual, 2 GET, zero gravações/fechamentos; não cobre duas navegações contextuais concorrentes |
| Colaborador comum | Menu apenas Meu mês, Banco de horas e Solicitações | Fixture PJ, sem acessar conta real |
| Muitas pessoas / vazio | 40 pessoas: 41 linhas incluindo cabeçalho, sem truncar lista; consulta vazia: zero contagens e explicação | Sem afirmar QA visual desses estados |
| Console | Nenhum erro/aviso retornado pela captura do navegador ao final | Somente aba do ensaio |

O navegador foi devolvido ao tamanho padrão e a fixture restaurada para RH/seis situações. A aba foi preservada para retomada, não entregue como interface aprovada. Capturas locais e limites em `design-qa.md`.

### Pendências atuais (não repetir a limpeza)

- Normalizar o ensaio visual: usar as fontes reais do produto sem conectar o backend; confirmar captura/densidade equivalentes à referência. Só então ajustar diferenças reais de layout, sem inferir proporções de captura reduzida.
- Concluir comparação pareada, foco/teclado, zoom 200%, contraste e checagem de overflow nos componentes, além da largura da página.
- Concluir digitação no seletor nativo e aplicação/retorno de intervalo; a tentativa automatizada não comprovou esses caminhos.
- Duas navegações contextuais fora de ordem, pessoa ausente na resposta, troca entre escopos diferentes de fechamento, estado de detalhes expandido e demais casos pendentes do plano.
- Só depois concluir QA e apresentar preview como validado. Nenhuma publicação nesta etapa.

1. Garantir espaço livre suficiente para dependências, builds e fixtures; não apagar diretórios anteriores sem verificar conteúdo/processos e autorização.
2. Conferir git status e este checkpoint; não reiniciar o planejamento ou refazer os commits existentes.
3. Rodar novamente `npm run verify:workflow` com todos os arquivos novos rastreados. Usar as proteções do executor existente, sem copiar `.env`.
4. Iniciar a cópia fictícia em uma porta livre, com CSP/ambiente restritos; não encerrar o preview do usuário.
5. Executar a matriz interativa do plano: agosto no Painel versus setembro em Lançamentos; filtros combinados; limpeza; saldo filtrado; intervalo; erro/retry; respostas fora de ordem; troca de identidade; pessoa ausente no retorno.
6. Exercitar seleção vazia ao trocar escopo, reconhecimento de mês sem lançamentos, fechamento individual/equipe e resultado parcial/incerto somente em fixtures separadas. Não usar pessoas reais para testar.
7. Comparar visual pareado com a opção 1, desktop/390px/zoom/teclado/foco, registrar console e corrigir P0/P1/P2.
8. Só depois de passar nas verificações concluir esta etapa e apresentar preview local. PR/publicação exigem autorização específica posterior.

## Preservação prioritária

### Retomada e correções — 06/09/2026

Partida: checkpoint `7b2fb3c`, worktree limpo. Preservado o escopo de apresentação/ensaios; sem publicação.

Correções: orientação contextual do intervalo parcial; aviso de pessoa ausente derivado da consulta atual; formulário de intervalo com recorte e posicionamento móvel corrigidos; pesos de títulos e espaçamento ajustados. Ensaio passou a reutilizar Manrope/Sora compiladas localmente e ganhou omissão de Ana apenas da próxima resposta, sem modificar o armazenamento fictício.

#### Verificação final desta rodada

Na cópia isolada existente `C:/Users/danyel/AppData/Local/Temp/horus-workflow-check-pFhQnz`, arquivos alterados sincronizados explicitamente. Executadas em sequência as mesmas cinco etapas de verificação, em processos filhos com `buildSafeEnv`: **Vinext, 226 testes (226 passaram; zero falhas), lint global, Next e TypeScript independente — saída final 0**. Não foi criada outra cópia de dependências e não foi alegada uma nova execução do comando que cria a cópia.

Houve uma tentativa intermediária com duas falhas de renderização por ordem de inicialização de `activeSlot` introduzida nesta rodada. Corrigida antes da repetição integral final. Não considerar a tentativa intermediária aprovada. Os testes novos de fonte, omissão fictícia e aviso tiveram falha esperada antes da implementação e passaram depois.

Nenhum teste PostgreSQL foi repetido: a evidência anterior de 39 testes permanece histórica, e código transacional/SQL não foi modificado.

| Caso acrescentado/repetido | Resultado |
| --- | --- |
| Resposta sem Ana | Aviso explícito e nenhum registro de outra pessoa; próxima resposta restaura Ana; snapshot integral do servidor fictício inalterado |
| Duas navegações contextuais | Ana com atraso seguida de Bruno; destino permaneceu em Bruno. Aviso antigo encontrado e corrigido; repetição sem aviso indevido |
| Troca de mês durante consulta | Setembro permaneceu como mês ativo após consulta de agosto atrasada |
| Preservação no percurso de leitura | Snapshot igual, somente leituras; checkpoint capturado com 4 GET, zero writes, zero closings. Não confundir com toda a soma de sessões ou com os fechamentos fictícios da rodada anterior |
| Troca de escopo do fechamento | Engenharia: Bruno + Diego reconhecido = 2 selecionados; Arquitetura = 0; retorno Engenharia = 0 e Diego novamente bloqueado até reconhecimento |
| Intervalo nativo | Campo final 15/08 aplicado; fechamento desabilitado e mensagem correta; retorno a agosto completo com ações disponíveis. Na automação IAB, fill isolado não disparava o evento: usado passo pelas setas do campo |
| Detalhes por teclado | Enter expandiu e recolheu detalhes de Ana; datas, carga, percentual e indicadores de envio legíveis |
| Celular | Recorte do formulário identificado e corrigido; confirmação visual no IAB e Chrome, 390 px, sem ultrapassar a lateral |
| Reflow reduzido | 744 × 530 medidos: filtros/CTA reorganizados; não tratado como zoom real |
| Console final Chrome | Nenhum erro/aviso na sessão nova de validação |

O ensaio próprio de 4178 foi reiniciado com CSP inline persistente para o WebSocket dessa porta; previews anteriores 4176/4177 não foram encerrados. Fontes vêm de arquivos estáticos da compilação, sem servir Next real nem ler ambiente.

**Pendência atual específica:** zoom real de 200%. Atalhos da automação não mudaram viewport/DPR. A solicitação anterior de ajuste manual foi superada pela preferência do usuário por execução pelo agente; autorização para Playwright direto em navegador de teste isolado foi solicitada. Override de tamanho restaurado. A comparação pareada nítida e os recortes foram realizados no Chrome após distorções de captura do IAB. Ver `design-qa.md`. Não reiniciar o plano, refazer limpeza ou conectar banco para resolver esse teste.

Próximo passo: concluir esse teste e a revisão dos itens compostos ainda abertos no plano; só então liberar QA e seguir o PR/release. Preparação local registrada em `2026-09-06-month-overview-release.md`: base atual do GitHub confirmada, caminhos protegidos sem diferenças e nova repetição dos 226 testes, lint, Vinext, Next e TypeScript com saída 0. Não há deploy desta rodada.

Nenhuma conexão, consulta, gravação ou alteração de configuração foi feita no Supabase nesta execução. Histórico de agosto não foi manipulado. Cópias de apresentação nunca substituem o payload original em gravações. O ensaio PostgreSQL usa somente clusters locais fictícios novos e encerra o servidor ao concluir. O ambiente de produção continua na versão previamente publicada.
