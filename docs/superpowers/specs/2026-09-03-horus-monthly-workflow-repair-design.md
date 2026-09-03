# Horus — correção do fluxo mensal

Data: 03/09/2026.

Situação: fluxo aprovado na conversa; formalização escrita para revisão antes do plano de implementação. Não é uma autorização para publicar ou alterar o Supabase.

## 1. Resultado esperado

O RH consegue escolher o mês na própria tela, conferir os lançamentos, resolver pendências e entender exatamente quem será incluído no fechamento. O colaborador consegue consultar seus meses e distinguir a edição de um dia da consulta de seu histórico. O DEV mantém a visão RH e a simulação de colaborador somente para consulta.

O fluxo completo é:

**Escolher mês → conferir pessoas e horas → resolver pendências → revisar fechamento → confirmar → conferir resultado por pessoa.**

O fechamento real só poderá ser liberado depois da validação das regras de gravação e de autorização específica. Uma tela de conferência, sozinha, não será novamente apresentada como um fechamento concluído.

## 2. Regras globais obrigatórias

- Não gravar, corrigir, excluir, substituir, recriar, importar ou fechar dados reais durante desenvolvimento e testes.
- Preservar os lançamentos de agosto, suas versões anteriores e todo o histórico já existente.
- Não aplicar migrações nem alterar tabelas, funções, políticas, permissões ou configurações do Supabase nesta etapa.
- Não ativar `HORUS_MONTH_CLOSING_WRITE_ENABLED` em produção.
- Não fazer deploy, push ou abrir publicação automática sem autorização específica posterior.
- Usar dados fictícios em ambiente de teste isolado, sem credenciais nem chamadas ao Supabase de produção.
- Não mudar as permissões dos perfis RH, colaborador e DEV como efeito colateral de uma correção visual.
- Manter históricos de pessoas inativas consultáveis; inatividade não apaga nem oculta seus registros do período.
- Não adicionar bibliotecas, serviços, mapas persistentes ou dependências sem necessidade comprovada.
- Executar o trabalho nesta tarefa, sem subagentes, respeitando a preferência já dada pelo usuário.
- Usar português claro: “mês”, “colaborador”, “Editar este dia”, “Histórico deste dia” e “Fechar mês da equipe”.

Essas regras também se aplicam à futura execução do plano. A aprovação deste documento não autoriza fechar agosto da empresa como teste.

## 3. Base da decisão

A auditoria de 02/09/2026 confirmou, na sessão DEV em Visão RH:

- Seletor de período presente somente no Painel.
- Lançamentos sem filtro por pessoa e sem seleção de mês.
- Edição restrita a uma pessoa/data, com justificativa do RH e versões preservadas pelo salvamento atual.
- Histórico exibindo um falso estado “Sem alterações” durante o carregamento.
- Fechamento sem ação de fechar e sem apresentação das pendências que o impedem.

A consulta daquela data identificou histórico de lançamentos e alterações, meses em aberto, registro mensal ausente e pendências de autorização. As contagens internas não são publicadas neste documento. A auditoria é evidência datada, não uma verificação atual de integridade de todo o banco.

A base local desta especificação é o commit `481405dd1c201be19cde64fd7446e766b38a98d6`, árvore `8391f0f97fd96e902d5a697c5da48bf5414aa6ab`. Antes de executar o plano, conferir diferenças com a versão atual do repositório; não substituir mudanças posteriores.

## 4. Seleção de mês

### Comportamento

- Painel, Lançamentos/Meu mês, Fechamento e Relatórios têm seletor de mês/ano visível no cabeçalho, com escolha direta e navegação anterior/próximo.
- Cada tela mantém o próprio período enquanto a sessão da aplicação estiver aberta. Alterar o mês em Lançamentos não muda silenciosamente o mês guardado no Painel.
- Na primeira abertura de uma tela, aproveitar o mês que a pessoa estava consultando. Nas seguintes, restaurar a última escolha daquela tela.
- As escolhas da visão RH e da simulação DEV ficam separadas. Trocar o colaborador simulado nunca pode manter dados da pessoa anterior sob o nome da nova pessoa.
- Nenhuma preferência de período é salva no banco. Não é necessário criar tabela ou coluna.
- Painel e Relatórios podem continuar oferecendo intervalo de datas como opção separada. Lançamentos/Meu mês e Fechamento trabalham com mês completo.
- Se a origem for um intervalo que não equivale a um mês completo e a tela ainda não tiver mês definido, pedir “Escolha o mês” naquela tela; não escolher silenciosamente um mês do intervalo.
- Fechamento nunca aceita um intervalo que atravesse meses.

### Carregamento e falhas

- O mês do cabeçalho, os filtros, os totais e a lista pertencem sempre à mesma resposta.
- Uma consulta antiga não pode sobrescrever a resposta de um mês ou perfil escolhido depois.
- Durante a troca, informar qual mês está carregando. Não mostrar dados de agosto identificados como setembro.
- Se houver erro, mostrar “Não foi possível carregar este mês” e permitir tentar novamente. Não substituir erro por “Sem lançamentos”.
- Dados anteriores, se mantidos na tela, permanecem identificados pelo mês original; nenhuma ação de edição ou fechamento usa uma seleção ainda não carregada.

## 5. Lançamentos e edição diária

- RH: filtro por colaborador, com opção “Toda a equipe”. Incluir pessoas inativas que tenham registros no mês.
- O resumo e a lista respeitam o mesmo filtro. Identificar “Resumo da equipe” ou “Resumo de [nome]”; não mostrar o total geral sob o filtro de uma pessoa.
- Colaborador: somente seus próprios registros. Não acrescentar acesso a outras pessoas.
- Botões por linha: “Editar este dia” e “Histórico deste dia”, com nome acessível contendo a data e, no RH, a pessoa.
- Diálogo de edição: identificar pessoa e data no título/resumo. Pessoa e data continuam bloqueadas.
- Campos editáveis: entrada, saída, intervalo e observação. O RH continua informando justificativa.
- Mostrar claramente que a ação corrige um único dia e recalcula o resumo correspondente; não é uma alteração coletiva do mês.
- Respeitar o estado da pessoa e do mês daquele lançamento, não o estado agregado de toda a equipe. Quando a regra existente impedir edição, mostrar o motivo antes da tentativa.
- Não criar edição em massa, exclusão de dias ou importação de registros nesta correção.
- O sucesso só é mostrado depois da confirmação do servidor. Falha na atualização do resumo após salvar não deve ser apresentada como se a gravação não tivesse ocorrido: distinguir “salvo” de “resumo ainda não atualizado” para evitar repetição acidental.

## 6. Histórico de um dia

Separar explicitamente quatro estados:

| Estado | Mensagem/comportamento |
| --- | --- |
| Carregando | “Carregando histórico deste dia…” |
| Erro | “Não foi possível carregar o histórico”, com nova tentativa |
| Consulta concluída sem versões | “Este dia ainda não teve alterações” |
| Versões encontradas | Comparação antes/depois e identificação da alteração |

- Exibir data da alteração, justificativa e responsável quando disponíveis.
- Comparar entrada, saída, intervalo e observação; não limitar a comparação ao total de horas.
- Se o nome do responsável não estiver disponível, indicar a limitação; não atribuir automaticamente a alteração ao colaborador.
- Abrir o histórico de outro dia cancela ou ignora a resposta anterior. Nunca apresentar versões de um dia sob o título de outro.
- Ler o histórico não cria versões, não salva o lançamento e não recalcula o mês.

## 7. Fechamento do mês

### Conferência

O cabeçalho informa mês e ano. A relação contém pessoa, situação, horas trabalhadas, horas consideradas, carga exigida, saldo previsto e pendências que afetam o fechamento. O saldo previsto é identificado como previsão, diferente de um saldo já consolidado no banco de horas.

Usar estados de apresentação, sem renomear dados históricos no banco:

| Situação exibida | Significado e próximo passo |
| --- | --- |
| Sem registro mensal | Não existe registro daquele mês. Não tratar como mês aberto nem gerar déficit automaticamente. |
| Sem lançamentos | Existe registro mensal, mas não há dias lançados; exige conferência antes de inclusão. Abonos e outras informações existentes continuam visíveis. |
| Com pendências | Há impedimentos identificados; mostrar quais são e como chegar à sua resolução. |
| Pronto para revisar | Existem dados mensais e não foram encontrados os impedimentos verificados; ainda depende de confirmação e validação do servidor. |
| Fechado | Consultar o resultado, a data e o responsável disponíveis. Não permitir nova gravação por simples repetição do comando. |

- Incluir pessoas inativas com registros relevantes. A lista não se limita aos cadastros atualmente ativos.
- Não deduzir existência de um mês a partir de `OPEN`, pois o código atual usa esse valor também como ausência de registro.
- Relacionar os lançamentos de dias não úteis às autorizações e as ocorrências pendentes ao mês/pessoa corretos.
- Cada pendência abre a consulta apropriada mantendo a pessoa e a data. Não aprovar automaticamente pelo simples ato de navegar ou revisar.
- A inclusão de uma pessoa sem lançamentos exige decisão explícita. Nesta etapa de consulta não criar um registro mensal nem atribuir dívida a ela.
- Quando não houver fechados, usar “Nenhum colaborador com este mês fechado”; não “Sem dados” isoladamente.

### Confirmação e resultado

- Ação principal: “Revisar fechamento”, seguida de “Fechar mês da equipe” na confirmação.
- A confirmação apresenta mês, pessoas incluídas, quantidade, pendências e efeitos esperados sobre o banco de horas.
- Informar que fechar registra a situação mensal e movimentações calculadas; não apaga nem reescreve os horários originais dos dias trabalhados.
- Impedir envio duplicado enquanto a ação estiver em andamento e exigir proteção equivalente no servidor.
- Exibir resultado por pessoa: fechado, já fechado, impedido ou falhou. “Equipe fechada” só aparece se todas as pessoas explicitamente incluídas estiverem confirmadas como fechadas.
- Uma falha ou resposta incerta não pode virar mensagem genérica de sucesso. Consultar o resultado antes de oferecer repetição; não refazer automaticamente operações financeiras.
- O backend atual opera por pessoa. Esta especificação não promete uma operação coletiva “todos ou nenhum”. Uma eventual implementação transacional coletiva exige desenho técnico e autorização próprios.
- Reabertura não será ligada junto com fechamento. Ela fica fora desta liberação e não pode ser usada como mecanismo automático de desfazer falhas.

### Limite de autorização

O fluxo pode ser desenvolvido e exercitado com dados fictícios. Não pode chamar o fechamento real nem ser publicado como funcional antes de resolver os bloqueios de integração abaixo. Simulação de teste deve ser identificada como teste e não poderá existir como alternativa silenciosa a uma falha de produção.

## 8. Integração e bloqueios antes da liberação real

A auditoria encontrou três pontos que impedem tratar a correção como somente visual:

1. `getDashboardData` chama `refresh_hour_balance_statuses`; consultar pode atualizar vencimentos de lotes. A consulta futura deve ser livre de gravações, preservando a regra de vencimento nas operações que efetivamente usam saldos. Não remover a chamada e deixar o restante da aplicação consumindo saldos vencidos por engano.
2. Rotas de autorização de dia não útil e ocorrência podem recalcular um mês sem conferir seu fechamento nesses caminhos. Precisam impedir alteração não autorizada de mês fechado e tratar concorrência com o fechamento.
3. Algumas operações distribuem atualização do registro, recálculo e auditoria em chamadas separadas. É necessário demonstrar consistência sob falha, repetição e concorrência antes de liberar novas ações reais.

Esses pontos devem entrar como condições de liberação no plano, não como comandos para modificar o Supabase agora. Se a solução exigir alterar uma função, transação, política ou estrutura no banco, interromper essa parte e apresentar a mudança e seus efeitos para autorização específica. Não afirmar que um controle visual ou uma consulta prévia no frontend resolve concorrência no backend.

## 9. Organização da futura implementação

Reutilizar React, os estilos, o seletor existente e os testes disponíveis. Separar responsabilidades sem reescrever a aplicação inteira:

- **Controle de período:** componente reutilizável, com valor controlado pela tela; sem consultas ou gravações próprias.
- **Estado de consulta:** período por tela/perfil, resposta correspondente, carregamento, erro e descarte de respostas antigas.
- **Consulta de lançamentos:** filtro por pessoa e cálculo coerente do resumo exibido.
- **Histórico diário:** estado de leitura independente do carregamento geral da aplicação.
- **Conferência do fechamento:** classificação explícita de existência de mês, pendências e situação; confirmação e apresentação de resultados desacopladas do mecanismo de gravação.
- **Transporte de teste:** respostas fictícias injetadas apenas no ambiente de testes; nenhuma chave de produção, chamada externa, rota pública de desvio de login ou opção de liberar permissões pelo navegador.

Arquivos existentes que concentram o impacto: `app/HorusApp.tsx`, `app/HorusViews.tsx`, `app/ClosingOverview.tsx`, `app/dashboard-types.ts`, `db/dashboard.ts`, `app/api/timesheets/route.ts`, `app/api/non-business-authorizations/route.ts` e `app/api/occurrences/route.ts`. O plano definirá os novos componentes e testes antes de editar esses arquivos.

## 10. Acessibilidade e uso

- Preservar a identidade visual atual; não criar outro redesign de cores e tipografia.
- Controles de mês, pessoa e ações utilizáveis por teclado e com nomes claros.
- Diálogos devem receber foco ao abrir, manter a navegação de teclado dentro deles e devolver o foco ao controle que os abriu.
- Informar carregamento, erro, confirmação e resultado de modo acessível, sem depender apenas da cor.
- Verificar telas estreitas: seletor e ação principal não podem desaparecer nem obrigar rolagem horizontal para executar a tarefa principal.
- Não alegar conformidade completa de acessibilidade apenas por capturas de tela.

## 11. Critérios de teste e aceite

Os testes de comportamento devem primeiro reproduzir os defeitos atuais e depois demonstrar a correção. Usar dados fictícios com meses diferentes e resultados visivelmente distintos.

| Área | Cenários obrigatórios |
| --- | --- |
| Período | Trocar mês em cada tela; primeira abertura; retorno à tela; virada de ano; intervalo incompatível; respostas fora de ordem; falha de consulta. |
| Perfis | RH; colaborador restrito aos seus dados; DEV em RH; simulação DEV sem escrita e sem mistura de pessoas. |
| Lançamentos | Toda a equipe; pessoa filtrada; inativo com histórico; resumo coerente; mês fechado; edição de um único dia. |
| Histórico | Carregando; erro; vazio verdadeiro; múltiplas versões; troca rápida entre dias; observação e intervalo alterados. |
| Fechamento | Sem registro mensal; sem lançamentos; pendências; mês já fechado; revisão de pessoas; confirmação; envio repetido; falha parcial; resultado incerto. |
| Preservação | Navegar, filtrar, consultar histórico e abrir revisão não produzem gravações; testes não possuem acesso ao projeto de produção. |
| Backend futuro | Gravação simultânea com fechamento; autorização/ocorrência após fechamento; consistência de saldo, status e auditoria; repetição idempotente. |
| Usabilidade | Teclado, foco em diálogos, visão estreita e mensagens de erro úteis. |

Além dos testes novos, executar as verificações existentes apropriadas, após revisar seus comandos: testes, análise de tipos, lint e build. Não executar os comandos de banco sugeridos automaticamente pela ferramenta de inspeção. Testes simulados validam a interface, não provam a integridade transacional de um backend real.

## 12. Portas de aprovação

1. **Agora:** revisar este documento, que formaliza o fluxo aprovado. Apenas documentação local.
2. **Depois da revisão:** escrever o plano detalhado com tarefas, arquivos e testes; execução na própria tarefa, sem subagentes.
3. **Implementação local:** corrigir e testar no ambiente isolado permitido pelo plano. Nenhuma alteração de produção ou do Supabase.
4. **Integração real:** resolver e comprovar os bloqueios do backend. Qualquer necessidade de mudança no banco exige autorização específica antes da ação.
5. **Publicação:** apresentar resultados, limitações e diferenças para aprovação de deploy. Publicar não significa executar o fechamento da empresa.

Não declarar o fluxo inteiro concluído enquanto a interface estiver pronta mas a integração de fechamento real continuar bloqueada.

## 13. Revisão desta especificação

- Escopo separado entre desenho, testes locais, integração e publicação.
- Ausência de autorização para mudanças no banco declarada em todas as portas relevantes.
- Seleção independente por tela definida, incluindo primeira abertura e intervalos.
- Registros ausentes, meses abertos e meses fechados não tratados como a mesma situação.
- Fechamento coletivo sem promessa incompatível com a API individual existente.
- Nenhuma reabertura, exclusão ou criação automática de dívida como solução de interface.
- Critérios de aceite cobrem as reclamações e os riscos identificados na auditoria.

Vibe-workflow aplicado proporcionalmente: consulta Graphify sem grafo disponível, seguida de evidência no código; nenhuma geração de grafo ou memória; diagnósticos curtos mantidos sem compressão RTK; escolhas de solução simples conforme Ponytail; comunicação clara conforme Caveman; desenho, teste e revisão orientados pelo Superpowers.
