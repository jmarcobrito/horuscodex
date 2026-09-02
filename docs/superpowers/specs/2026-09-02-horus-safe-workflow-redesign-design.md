# Horus: redesenho seguro do fluxo mensal

**Data:** 2 de setembro de 2026  
**Estado:** direção aprovada; aguardando revisão desta especificação  
**Produto:** Horus — controle de ponto e fechamento mensal  

## 1. Objetivo

Tornar o Horus mais claro para colaboradores, RH e Desenvolvedor sem colocar em risco o histórico já armazenado no Supabase.

A mudança separa cadastro de pessoas, conferência mensal e fechamento. O fechamento deixa de ser uma ação escondida dentro de **Equipe** e passa a ter um espaço próprio, com prévia, pendências e confirmação. A entrega será gradual: primeiro a experiência e a leitura, depois o backend transacional e, por último, a liberação controlada das escritas.

O branch atual `feat/safer-month-closing` será mantido como referência, mas não será publicado como um pacote único.

## 2. Problemas confirmados

### 2.1 Fechamento misturado com gestão de pessoas

Na produção, a tela **Equipe** reúne ações de acesso, inativação, exclusão e fechamento. Isso dificulta entender:

- qual mês será fechado;
- o que será alterado;
- se existem pendências;
- se o histórico continuará disponível;
- o que fazer quando o fechamento não puder prosseguir.

### 2.2 Histórico existente pode parecer ausente

O banco contém lançamentos de colaboradores ativos e inativos. Porém, partes do painel filtram primeiro apenas as pessoas atualmente ativas e só depois calculam os totais. Assim, um lançamento antigo pode continuar no banco e deixar de aparecer em uma visão histórica.

O estado atual verificado em produção, por leitura somente, contém 244 lançamentos, 41 versões de lançamentos, 21 folhas mensais e 302 eventos de auditoria. Esses números são uma fotografia e podem crescer com o uso normal.

### 2.3 Entrega proposta com risco concentrado

O branch atual reúne mudanças de interface, APIs e duas migrações grandes. Os testes da aplicação passam, mas os testes SQL não fazem parte do comando normal de testes. A primeira migração também altera permissões padrão de futuras funções do schema `public`, uma mudança mais ampla do que o fluxo exige.

### 2.4 Linguagem técnica e ações pouco orientadas

A nova tela proposta acerta ao separar o fechamento, mas ainda mostra códigos internos, como `REVIEW_LEAVE`, e não transforma cada pendência em um próximo passo claro. O fechamento em grupo também pode ter sucesso parcial, o que exige comunicação e recuperação mais cuidadosas.

## 3. Princípios obrigatórios

1. **Histórico é intocável.** Migrações e fechamento não apagam lançamentos, versões, auditorias ou folhas antigas.
2. **Inativar não é excluir.** Inativação encerra o acesso futuro, mas preserva toda a participação histórica.
3. **Período histórico independe do acesso atual.** Uma pessoa inativa continua aparecendo nos meses em que possui dados.
4. **Prévia não altera dados.** Conferir o fechamento nunca grava, recalcula ou bloqueia registros.
5. **Fechamento é transacional.** Ou todas as alterações de uma pessoa e de um mês são concluídas, incluindo auditoria, ou nenhuma é mantida.
6. **Reabertura gera reversão.** Ela acrescenta registros compensatórios e auditoria; não apaga o fechamento anterior.
7. **Nova funcionalidade nasce desligada.** Banco, backend e interface podem ser publicados sem permitir fechamento real.
8. **Produção exige autorização específica.** Aprovar esta especificação não autoriza migração, fechamento real ou publicação.
9. **Mudanças pequenas e reversíveis.** Interface, estrutura do banco, APIs e ativação são liberadas em etapas separadas.
10. **A linguagem da interface é humana.** Códigos técnicos ficam em logs e auditoria, nunca como instrução principal ao usuário.

## 4. Perfis e limites de acesso

### 4.1 Colaborador

O papel interno continua sendo `PJ`, evitando migração de dados e risco de incompatibilidade. Na interface, o nome apresentado será **Colaborador**.

O colaborador pode:

- consultar o próprio mês;
- criar e corrigir lançamentos enquanto o mês estiver aberto;
- consultar banco de horas;
- enviar e acompanhar solicitações;
- visualizar claramente quando o mês estiver fechado.

O colaborador não pode consultar dados de outras pessoas, fechar meses nem reabrir folhas.

### 4.2 RH

O RH pode:

- acompanhar indicadores do período;
- revisar lançamentos e solicitações;
- consultar pendências de fechamento;
- fechar ou reabrir um mês quando as regras permitirem;
- cadastrar, inativar e reativar colaboradores;
- consultar relatórios históricos.

Cadastro e acesso ficam separados do fechamento mensal.

### 4.3 Desenvolvedor

O acesso `DEV` será preservado e protegido. Não haverá restrição permanente nova.

O Desenvolvedor terá dois modos explícitos:

- **Visão RH:** usa os recursos administrativos autorizados pelo papel `DEV`.
- **Visualizar como colaborador:** reproduz a experiência de um colaborador escolhido em modo somente leitura.

O aviso **Modo de visualização — somente leitura** vale somente para a simulação. Ele impede que o Desenvolvedor crie ou altere dados em nome do colaborador. Ao voltar para a Visão RH, o acesso normal do Desenvolvedor permanece disponível.

O papel `DEV` não pode ser rebaixado, inativado ou alterado pela própria interface.

## 5. Arquitetura de informação e nomenclatura

### 5.1 Navegação do RH e do Desenvolvedor em Visão RH

1. **Painel** — resumo do período e itens que precisam de atenção.
2. **Lançamentos** — consulta e revisão dos registros de ponto.
3. **Aprovações** — solicitações que aguardam decisão.
4. **Fechamento do mês** — conferência, pendências, fechamento e reabertura.
5. **Pessoas** — cadastro, acesso, situação ativa ou inativa.
6. **Relatórios** — histórico e exportações.
7. **Administração** — configurações e recursos exclusivos do Desenvolvedor.

### 5.2 Navegação do colaborador

1. **Meu mês**
2. **Banco de horas**
3. **Solicitações**

### 5.3 Termos principais

| Termo antigo ou técnico | Termo apresentado |
| --- | --- |
| Prestador / PJ | Colaborador |
| Equipe | Pessoas |
| Fechar competência | Revisar e fechar mês |
| Competência | Mês ou período, conforme o contexto |
| `READY` | Pronto para fechar |
| `BLOCKED` | Precisa de revisão |
| `CLOSED` | Mês fechado |
| Reopen | Reabrir mês |

Os valores internos podem permanecer em inglês e em formato técnico. A tradução acontece na camada de apresentação.

## 6. Fluxos principais

### 6.1 Fluxo do colaborador

1. A pessoa entra em **Meu mês**.
2. O cabeçalho mostra o mês selecionado e seu estado: aberto ou fechado.
3. A página mostra horas lançadas, horas consideradas e situação do período.
4. Enquanto o mês estiver aberto, a pessoa pode lançar ou corrigir horários.
5. Se houver inconsistência, a orientação informa o problema e a ação possível em linguagem simples.
6. Quando o RH fechar o mês, os lançamentos ficam disponíveis para consulta, mas não para alteração.

### 6.2 Fluxo de conferência do RH

1. O RH entra em **Fechamento do mês** e escolhe o período.
2. A tela carrega uma prévia somente de leitura, sem depender do carregamento geral do Painel.
3. As pessoas aparecem em três grupos:
   - **Prontas para fechar**;
   - **Precisam de revisão**;
   - **Mês fechado**.
4. Cada pessoa mostra horas consideradas, saldo previsto e pendências.
5. Cada pendência apresenta uma orientação e um atalho para o local de correção.
6. O RH abre **Revisar fechamento** para ver os detalhes antes de confirmar.
7. A confirmação informa o mês, a pessoa, o saldo que será gerado e o bloqueio dos lançamentos.
8. O backend repete todas as validações dentro da transação.
9. Em caso de sucesso, a pessoa passa para **Mês fechado** e o evento entra na auditoria.
10. Em caso de mudança desde a prévia, nada é alterado e a interface pede uma nova revisão.

### 6.3 Reabertura

1. O RH abre os detalhes de um mês fechado.
2. Seleciona **Reabrir mês**.
3. Informa uma justificativa obrigatória.
4. A prévia mostra os efeitos que serão revertidos.
5. O backend cria movimentações compensatórias e registra a auditoria na mesma transação.
6. O período volta ao estado aberto sem remover a fotografia do fechamento anterior.

### 6.4 Fechamento em grupo

O fechamento em grupo não fará parte da primeira liberação operacional. Ele só será ativado depois que o fechamento individual estiver estável em produção.

Quando liberado, cada pessoa continuará sendo uma transação independente. A resposta deve listar claramente:

- fechamentos concluídos;
- pessoas que voltaram para revisão;
- pessoas que falharam sem qualquer alteração.

O grupo nunca será apresentado como uma única operação totalmente atômica.

## 7. Divisão técnica da solução

### 7.1 Camada de apresentação

Responsável por navegação, nomes, agrupamentos, confirmações e mensagens. Ela nunca decide sozinha que um mês pode ser fechado.

### 7.2 Consulta de prévia

Um endpoint próprio e sem efeitos colaterais entrega a prévia do período. A consulta deve:

- carregar somente quando a área de fechamento for aberta;
- aceitar filtros de período e pessoa;
- devolver estado, totais, pendências e uma versão de revisão;
- traduzir erros internos para códigos de domínio estáveis;
- tolerar falha isolada de uma pessoa sem apagar a tela inteira.

A implementação deve evitar uma chamada separada por pessoa quando uma consulta em lote puder calcular o período de forma segura.

### 7.3 Fechamento individual

O endpoint de fechamento recebe pessoa, período e versão de revisão. A função transacional:

1. valida o ator e a organização;
2. bloqueia a folha da pessoa e do período;
3. recalcula a prévia;
4. rejeita uma revisão desatualizada;
5. registra a fotografia do fechamento;
6. acrescenta as movimentações necessárias;
7. altera o estado da folha;
8. registra a auditoria;
9. confirma tudo em conjunto.

Nenhuma etapa atualiza ou remove lançamentos de ponto.

### 7.4 Reabertura individual

A reabertura usa o mesmo limite transacional. Ela acrescenta reversões e um novo evento de auditoria, preservando as linhas anteriores.

### 7.5 Pessoas e histórico

A situação ativa ou inativa controla acesso e disponibilidade para novos períodos. Consultas históricas usam a existência de registros no período, e não o estado atual da pessoa.

O total de **Colaboradores ativos** continua medindo apenas quem está ativo hoje. Já lançamentos, totais e relatórios de um período incluem todas as pessoas com dados naquele período.

## 8. Estratégia de banco de dados

As migrações atuais serão reestruturadas antes de qualquer uso em produção.

### 8.1 Migração estrutural aditiva

- adiciona somente tabelas, colunas e índices necessários;
- usa colunas opcionais ou valores padrão compatíveis;
- não troca em massa as chaves estrangeiras legadas;
- não altera permissões padrão do schema inteiro;
- não cria exclusão em cascata nova;
- possui teste de esquema executado automaticamente.

### 8.2 Reconciliação e preenchimento conservador

- dados derivados só são criados quando a origem determina o resultado sem aproximação;
- registros ambíguos recebem o estado **Precisa de revisão**;
- nenhum período antigo de vários dias é dividido por média;
- contagens, somas e assinaturas das tabelas históricas permanecem iguais.

### 8.3 Funções transacionais

- cada função possui permissões concedidas explicitamente apenas ao papel necessário;
- funções críticas fixam o `search_path` e validam ator, organização e papel;
- fechamento e reabertura usam bloqueios e controle de concorrência;
- nenhuma função de fechamento executa `DELETE`, `TRUNCATE` ou remoção de tabela.

## 9. Segurança

- As credenciais administrativas do Supabase permanecem apenas no servidor.
- O navegador não recebe `service_role`.
- Rotas de escrita exigem sessão válida, papel permitido e verificação de mesma origem.
- O parâmetro de visualização como colaborador só é aceito para consultas e somente por `DEV`.
- Endpoints de escrita ignoram identidade simulada e usam sempre o ator autenticado real.
- Não haverá endpoint de exclusão de colaborador.
- Os advisors de segurança e desempenho serão comparados antes e depois de cada migração.
- O aviso atual de proteção contra senhas vazadas será tratado como melhoria de segurança separada, sem ser misturado ao fechamento mensal.

## 10. Tratamento de erros

Toda falha deve responder a três perguntas:

1. O que impediu a ação?
2. Algum dado foi alterado?
3. Qual é o próximo passo?

Exemplos de mensagens:

- **Há uma solicitação aguardando decisão.** Nenhum dado foi alterado. Abra Aprovações para revisar.
- **Os lançamentos mudaram desde a sua conferência.** Nenhum fechamento foi realizado. Atualize a prévia e revise novamente.
- **Não foi possível concluir o fechamento.** Nenhuma alteração parcial foi mantida. Tente novamente ou consulte o suporte.

Detalhes técnicos e identificadores ficam nos logs e na auditoria, não na mensagem principal.

## 11. Acessibilidade e qualidade visual

- A navegação deve ser utilizável por teclado.
- Todo diálogo recebe foco ao abrir, mantém o foco dentro dele e devolve o foco ao controle de origem ao fechar.
- Estados não dependem apenas de cor; usam texto e ícone da biblioteca já adotada pelo produto.
- Controles têm nomes acessíveis sem símbolos decorativos no anúncio.
- Mensagens de carregamento e resultado usam regiões de status apropriadas.
- O layout será validado nos tamanhos de 1440 px, 1024 px e 390 px.
- Contraste, foco visível e ordem de leitura serão verificados; uma captura de tela isolada não será considerada prova de conformidade.

## 12. Estratégia de testes

### 12.1 Aplicação

- navegação e nomenclatura por perfil;
- isolamento do colaborador;
- modo Desenvolvedor somente leitura durante simulação;
- histórico de pessoa inativa em períodos passados;
- traduções de estados, bloqueios e erros;
- confirmação individual e reabertura;
- proteção contra pedidos de escrita de outra origem.

### 12.2 Banco

Os testes SQL passam a fazer parte da verificação normal e cobrem:

- migração sobre o schema de referência;
- ausência de alteração em lançamentos históricos;
- prévia sem efeitos colaterais;
- fechamento atômico;
- falha com reversão integral;
- revisão desatualizada;
- reabertura por movimentação compensatória;
- isolamento entre organizações;
- permissões das funções;
- concorrência sobre a mesma pessoa e o mesmo mês.

### 12.3 Experiência

- percurso completo do colaborador;
- percurso completo do RH;
- alternância de Visão RH para visualização como colaborador;
- teclado, foco, mensagens e telas vazias;
- comparação visual com os padrões existentes do Horus.

## 13. Liberação em etapas

### Etapa 0 — referência e proteção

- preservar o branch atual sem publicá-lo;
- registrar o baseline atualizado de produção;
- verificar backup e restauração;
- automatizar testes SQL e assinaturas do histórico.

### Etapa 1 — experiência sem escrita nova

- publicar nomenclatura e navegação;
- separar Pessoas de Fechamento do mês;
- corrigir a presença de pessoas inativas nas consultas históricas;
- preservar o modo Desenvolvedor;
- manter o novo fechamento real desligado.

### Etapa 2 — banco e backend desligados

- validar migrações menores em uma branch nova do Supabase;
- usar dados sintéticos, pois branches não recebem dados de produção;
- executar testes de schema, fluxo, segurança e reconciliação;
- publicar estruturas e APIs com a funcionalidade desligada.

### Etapa 3 — conferência em produção

- executar apenas consultas de prévia;
- comparar resultados novos com os totais existentes;
- testar RH, colaborador e Desenvolvedor sem fechamento real;
- corrigir qualquer divergência antes de avançar.

### Etapa 4 — fechamento individual controlado

- obter autorização final específica;
- habilitar para um grupo controlado;
- realizar um fechamento previamente escolhido pelo RH;
- reconciliar histórico, folha, banco de horas e auditoria;
- monitorar erros e desempenho.

### Etapa 5 — liberação para o RH

- habilitar o fechamento individual para o RH;
- manter fechamento em grupo desligado;
- avaliar o uso real antes de decidir sobre a ação em grupo.

Cada etapa possui sua própria decisão de avançar ou recuar. O sucesso de uma etapa não autoriza automaticamente a seguinte.

## 14. Recuo e recuperação

- Se a interface falhar, o código volta à versão anterior e as estruturas aditivas permanecem sem uso.
- Se uma migração falhar antes da confirmação, a transação inteira é revertida e não é repetida automaticamente.
- Se a reconciliação divergir, as escritas permanecem pausadas e a investigação ocorre primeiro em clone ou branch.
- Uma restauração completa só pode ser iniciada com autorização explícita do responsável pela produção.
- Não será criada migração de recuo que apague fotografias, auditorias, movimentações, usuários ou lançamentos.

## 15. Critérios de sucesso

A solução é considerada pronta quando:

1. o RH encontra o fechamento em uma seção própria e entende o próximo passo sem instrução externa;
2. o fechamento nunca aparece dentro de Pessoas;
3. colaboradores inativos continuam visíveis nos períodos em que possuem histórico;
4. a visualização do Desenvolvedor continua disponível e não permite escrita em nome do colaborador;
5. códigos técnicos não aparecem como orientação principal;
6. todos os testes da aplicação e do banco fazem parte de uma única verificação obrigatória;
7. a prévia não altera qualquer dado;
8. fechamento e reabertura são atômicos e auditados;
9. a reconciliação confirma que lançamentos, versões e auditorias anteriores foram preservados;
10. nenhuma etapa de produção acontece sem backup verificado e autorização específica.

## 16. Fora do escopo

- renomear o enum `PJ` no banco;
- redesenhar toda a identidade visual do Horus;
- alterar regras trabalhistas ou fórmulas sem nova validação do RH;
- corrigir todos os avisos históricos de índices na mesma entrega;
- ativar fechamento em grupo na primeira liberação;
- excluir organizações, usuários ou histórico;
- migrar dados reais de colaboradores para uma branch de desenvolvimento.

