# Horus — validação local do fluxo mensal

Data: 03/09/2026. Código validado: `5d447c43c00ec3e52ae7ea8dc66bcb9365ce2d68`.
Branch mantida: `docs/monthly-workflow-repair`.
Base desta implementação: `8430207`. Esta entrega é **local**, não uma publicação.

## Resultado e preservação

- Mês independente em Painel, Lançamentos, Fechamento e Relatórios.
- Resumo filtrado pela mesma pessoa dos lançamentos, incluindo inativos com histórico.
- “Editar este dia” mantém pessoa/data fixas; “Histórico deste dia” separa carregamento, erro, vazio e versões.
- Fechamento distingue situação desconhecida, ausência de registro mensal, mês sem lançamentos, pendências, pronto para revisar e fechado.
- Seleção e revisão funcionam sem gravar. A confirmação só funciona com o callback fictício injetado pelo ensaio.
- A página real não fornece esse callback. A rota e a flag de fechamento não foram alteradas.
- RH, colaborador e DEV mantêm seus perfis. A visualização DEV como colaborador continua somente leitura.
- Nenhuma chamada ao Supabase ou ao dashboard de produção foi realizada nesta execução. Não houve fechamento real, migração, alteração de permissões, exportação, backup, importação ou restauração.
- Os dados reais de agosto não foram lidos nem alterados por este trabalho. Não se está alegando uma comparação de integridade atual do banco.

## Verificações executadas

A infraestrutura de isolamento foi criada antes da integração. O comando `node scripts/verify-workflow-isolated.mjs checks` (equivalente ao novo `npm run verify:workflow`) cria uma cópia dos arquivos controlados pelo Git, exclui ambientes/configurações sensíveis e usa uma lista permitida de variáveis. Copia dependências já instaladas, sem instalação nem credenciais. Não inicia o servidor da aplicação real.

A primeira montagem com atalho de dependências foi recusada pelo Turbopack. A cópia integral das dependências corrigiu essa incompatibilidade. A primeira busca das fontes públicas foi bloqueada pela rede; após autorização de rede, o build passou sem credenciais de produção.

Cópia da verificação final: `C:/Users/danyel/AppData/Local/Temp/horus-workflow-check-inaN9G`. Após os últimos ajustes, os arquivos correspondentes foram sincronizados e toda a sequência abaixo foi repetida nessa mesma cópia, com `buildSafeEnv`. Todos os subprocessos terminaram com código 0.

| Verificação final | Resultado observado |
| --- | --- |
| Build Vinext | Passou |
| Todos os arquivos `tests/*.test.mjs` | 43 testes, 43 aprovados, 0 falhas, 0 ignorados |
| ESLint em app, db, tests, worker e proxy | Passou, sem erros |
| Build Next/Vercel | Passou; páginas e rotas geradas |
| TypeScript sem emissão | Passou |
| Diferenças de Git | Sem erros de whitespace; sem mudanças em migrações, autenticação, rotas de gravação, flags ou configuração de publicação |

Testes foram escritos e observados falhando antes das respectivas correções. A revisão final incluiu o diff e os limites de segurança; não houve revisão independente por outro agente, conforme a preferência de executar sem subagentes.

## Ensaio no navegador

Origem única: `http://127.0.0.1:4175`, iniciada pelo modo `preview` do mesmo script de isolamento.
Cópia do ensaio: `C:/Users/danyel/AppData/Local/Temp/horus-workflow-check-mPdaSf`.
Somente pessoas e registros fictícios. A faixa “TESTE LOCAL — dados fictícios; sem Supabase” permanece visível.

| Cenário | Evidência observada |
| --- | --- |
| Meses independentes | Lançamentos avançou para setembro; Painel continuou em agosto. Fechamento manteve seu mês. Relatórios avançou para setembro sem mudar Lançamentos de agosto. |
| Intervalo parcial | Primeira entrada em Lançamentos pediu escolha explícita. Escolha pelo teclado abriu agosto. Navegar em seguida para Aprovações não deixou uma tela sem saída. |
| Calendário | Dezembro avançou para janeiro de 2027 no navegador. Bissexto, limites e datas inválidas cobertos nos testes de período. |
| Resposta antiga e erro | Agosto atrasado não substituiu setembro. Falha mostrou “Não foi possível carregar” e “Tentar novamente”, não lista vazia. A repetição refez somente a consulta. |
| Pessoa e dia | Bruno inativo mostrou 05:00, enquanto a equipe tinha 13:00. Correção de Ana para intervalo de 90 minutos mudou o dia para 07:30, mantendo Bruno com 05:00. Cadastro inativo e mês fechado desabilitaram edição com motivo visível. |
| Falha após salvar | Mensagem “Salvo. Não foi possível atualizar…”; após repetir consulta, o registro de chamadas continha um único POST e consultas GET. |
| Histórico | Observados carregamento, falha, vazio e versões 2/3 com entrada, saída, intervalo, observação e total antes/depois. Na troca imediata Ana → Bruno com respostas lentas, o diálogo permaneceu identificado como Bruno e terminou vazio, sem versões de Ana. |
| Pendência | Abriu autorização de Ana em 03/08/2026, sem enviar automaticamente. Criar e aprovar a autorização fictícia, com confirmação, e voltar ao fechamento tornou Ana pronta para revisar. |
| Seleção | Iniciou vazia. “Selecionar prontos” não incluiu Carla sem lançamentos. Carla só ficou selecionável após ciência explícita; a revisão mostrou seu abono de 01:00 e previsão de −07:00. |
| Resultado | Sucesso mostrou cada pessoa e “Equipe selecionada fechada”; falha parcial não anunciou sucesso total; falha de transporte mostrou “Resultado não confirmado”. Não houve compensação ou reenvio automático. |
| Clique duplo | Gerou exatamente um comando fictício de fechamento para os dois IDs selecionados. Resultado permaneceu visível após a correção do botão. |
| Confirmação real | Removido o callback do ensaio, confirmar ficou desabilitado, com explicação da validação de backend pendente. |
| Durante envio | Mês e fechar diálogo desabilitados; Escape não interrompeu o envio. Resultado continuou disponível após a atualização. |
| Perfis | RH e PJ consultados. DEV abriu RH, Administração, Ana e Bruno; cada simulação mostrou só a pessoa escolhida. Registro de chamadas do cenário DEV teve apenas GETs. |
| Teclado | Tab/Shift+Tab circularam dentro do diálogo; Escape fechou primeiro o menu interno, depois o diálogo; histórico devolveu foco ao botão de origem. |
| Tela estreita | Inspecionadas capturas a 375 × 812; mês, seleção e ação de revisão caberam. Confirmação apresentou texto e botões dentro do diálogo, sem overflow horizontal. Override de viewport removido ao final. |
| Preservação fictícia | Testes compararam dias/versões antes e depois de consulta, histórico e fechamento fictício: iguais. Na correção diária, apenas o dia escolhido mudou e a versão anterior permaneceu. Transporte rejeitou URL externa e rota desconhecida. |

Capturas foram inspecionadas e exibidas nesta tarefa: conferência em desktop, tela de 375 pixels e confirmação em tela estreita. Não foram incluídas imagens binárias no repositório. A fonte do ensaio não é prova de identidade tipográfica exata com a produção, pois ele não importa o layout Next que busca fontes remotas.

Durante alterações com recarga quente, o ambiente de demonstração emitiu avisos de raiz React já inicializada. A página foi recarregada antes dos ensaios finais; esse comportamento do ponto de entrada de teste não é código importado pela aplicação publicada.

## Ajustes encontrados na própria verificação

1. Manter o botão concluído desabilitado evita que um segundo clique atinja outro controle após o resultado.
2. Renderizar o menu de seleção dentro do diálogo preserva foco e comportamento de Escape.
3. Telas não mensais usam o período inicial conhecido quando se chega de uma tela mensal ainda sem escolha; telas mensais continuam exigindo escolha explícita.
4. Resposta com mensagem de tipo inválido é classificada como incerta.
5. Controles e perfil ativo do ensaio reiniciam junto com os dados fictícios, sem misturar estados entre sessões.

## Limites e próximos passos

- Os testes não provam transações, concorrência, paginação, políticas ou integridade atuais do Supabase.
- Autenticação real, download real de CSV, administração de acessos e decisões reais não foram exercitados. A navegação e os links de relatório mantêm o período local; o ensaio não publica relatórios.
- Ocorrências são classificadas pelo modelo; o percurso completo de decisão no navegador foi exercitado com autorização de dia não útil, não com todos os tipos de ocorrência/folga.
- A única adaptação de dados é selecionar/projetar campos de registros mensais já existentes. Não há mudança de esquema.
- Não basta habilitar a flag ou ligar o botão a uma rota: primeiro cumprir [as condições de backend](monthly-workflow-release-gates.md).
- Cópias locais, commits e worktree foram preservados. Nada foi enviado ao GitHub ou à Vercel.

## Método aplicado

Superpowers orientou execução por tarefas, testes antes das correções, investigação de falhas e verificação antes de declarar resultado. O roteiro de revisão foi aplicado aqui, sem delegação. Vibe-workflow orientou investigação proporcional e correções de causa; Graphify não foi criado/atualizado e não houve mudança de memória ou configuração global. A skill Supabase foi usada para confirmar que o DTO utiliza campos existentes, sem consultar o banco real. O navegador conectado foi usado para o ensaio local, sem desativar o isolamento do ambiente.
