# Horus — Painel: Resumo do mês

Data: 05/09/2026. Visual escolhido pelo usuário: opção 1. Estado: especificação aprovada pelo usuário; plano detalhado em `../plans/2026-09-05-horus-month-overview.md`. Aplicativo ainda não alterado nesta entrega.

## Resultado esperado

O RH abre o Painel, escolhe mês e pessoas, identifica o que precisa conferir e chega ao fechamento sem perder o contexto. O Painel é uma porta de entrada para consulta: nunca fecha, aprova, edita ou recalcula registros.

Esta especificação detalha a primeira parte da Entrega B de `2026-09-05-horus-audit-corrections-design.md`, após a publicação da Entrega A pelo PR #5. A reorganização completa de Relatórios e da tela de Fechamento não entra neste pacote; somente os ajustes de navegação e filtros necessários para receber o contexto do Painel.

## Referência visual selecionada

Primeira imagem gerada e exibida na rodada de três propostas; não a segunda nem a terceira. Arquivo local preservado:

`C:/Users/danyel/.codex/generated_images/01a05e3c-f25a-7182-ae03-4a9d592eaf05/exec-0ec5299b-b81f-412d-a953-92f21925d726.png`

Direção: **Resumo do mês**. Hierarquia: cabeçalho compacto, situação do fechamento, aviso de pendências, tabela da equipe, banco de horas atual. A imagem usa dados fictícios e não define cálculos, elegibilidade, pessoas ou números fixos em produção. A faixa de proposta fica apenas no ensaio fictício. Não criar seletor de empresa, capacidade não existente apenas porque o mock mostra uma seta junto ao nome.

Identidade existente: fundo claro, menu azul-marinho, destaque roxo, fontes Sora/Manrope. Não substituir o projeto por um starter nem redesenhar autenticação ou menu de perfis. Sem fotos, ilustrações ou novos ativos raster; marca existente reaproveitada. Ícones novos devem ser de uma biblioteca licenciada, sem desenhos SVG manuais ou emojis. Não adicionar dependência de pacote: se necessários, usar somente os arquivos oficiais dos poucos ícones escolhidos, com licença e origem preservadas.

## Preservação obrigatória

- Nenhum SQL, migração, schema, RLS, grant, função transacional, credencial ou variável de ambiente alterado.
- Nenhum INSERT, UPDATE, DELETE, UPSERT, RPC de mutação, recálculo, importação ou limpeza de dados como parte desta entrega ou de seus testes reais.
- Nenhuma conversão de histórico, atribuição retroativa de setor ou criação automática de registro mensal. Agosto permanece como está.
- Somente dados já autorizados pela API atual; filtros de apresentação não ampliam permissões.
- Testes de escrita exclusivamente em fixtures/banco local fictício. Nunca fechar ou reabrir um mês real para validar a interface.
- Sem mudanças em edição diária, histórico imutável, aprovação, regras do banco de horas ou política mensal.
- Preservar fechamento individual e coletivo, revisão, confirmação, resultado por pessoa, tratamento de resultado incerto e proteção contra repetição.
- Preservar DEV na visão RH e DEV como colaborador somente para consulta. Colaborador comum não recebe Painel do RH.
- Sem push, PR, merge ou deploy nesta etapa documental. Publicação futura requer verificação e autorização específica; reversão somente do aplicativo.

## Layout e comportamento

### 1. Cabeçalho e filtros

Título “Painel”; apoio “Confira a equipe antes de fechar o mês.” Mês com anterior/próximo e escolha direta. “Outro intervalo” expande os campos existentes de início/fim e “Aplicar intervalo”; não aplica enquanto o usuário digita. Reutilizar validação de datas e limites do `PeriodPicker`.

Pessoa e setor são filtros combinados da consulta do Painel, com padrões “Todas as pessoas” e “Todos os setores”. Disponibilizar “Sem setor definido” para `sectorId: null`. Usar os nomes recebidos, sem buscar ou inferir lotação histórica. Opções derivadas de `data.contractors`, não de uma lista administrativa carregada por fora. Cadastros inativos com histórico relevante continuam visíveis e identificados como inativos.

Os filtros ficam guardados no contexto RH/DEV-RH do Painel e não se propagam automaticamente a outras abas ou identidades. Setor incompatível com pessoa selecionada limpa apenas a pessoa, com aviso. Ao trocar período, remover seleção que não exista mais nas opções, também com aviso. Alteração de situação não remove filtros de pessoa/setor.

Botão “Atualizar consulta” repete somente a leitura do período ativo. Informar horário de conclusão da última resposta aceita, no fuso da organização; não usar horário fixo do mock nem marcar resposta atrasada como atualização. Na carga inicial sem esse horário disponível, usar “Consulta carregada”, sem inventar um instante de atualização do banco. Carregamento/erro não mostra os números anteriores como resultado atual.

### 2. Situação do fechamento

Em um mês completo, mostrar “Fechamento de [mês]”, quantidade de pessoas no escopo e seis estados separados, calculados a partir de `buildClosingRows(data)`, antes de aplicar o filtro de situação da tabela:

| Estado existente | Rótulo | Interpretação |
| --- | --- | --- |
| CLOSED | Fechados | Registro mensal fechado |
| READY | Prontos para revisar | Pode seguir para revisão, não fechamento automático |
| PENDING | Com pendências | Há impedimento identificado pelo modelo existente |
| NO_ENTRIES | Sem lançamentos | Existe registro mensal, mas não há lançamentos |
| NO_RECORD | Sem registro mensal | Não foi encontrado registro mensal; não presumir aberto/fechado |
| UNKNOWN | Situação indisponível | Metadados ausentes/inconsistentes; não presumir elegibilidade |

Cada pessoa pertence a um estado. As seis contagens somam o total do escopo pessoa/setor; nunca usar percentual de horas para decidir prontidão. Uma consulta sem pessoas tem total zero; falha de consulta tem estado de erro, não seis zeros.

Os indicadores funcionam como filtros da tabela dentro do Painel. Seleção tem nome acessível, estado anunciado e opção “Limpar filtro de situação”. Eles não selecionam pessoas para fechamento. Contagens permanecem referentes ao escopo pessoa/setor para permitir comparar os grupos.

Ação principal **“Ir para fechamento”** abre a tela existente no mês do Painel, levando filtros explícitos de pessoa/setor/situação. Mostrar no destino o escopo recebido e como limpá-lo. Nenhuma pessoa marcada automaticamente. Manter “Selecione uma pessoa ou a equipe” e a confirmação existente. Filtrar nunca inclui alguém oculto numa seleção anterior: mudanças de filtro/mês limpam seleção e reconhecimento de mês sem lançamentos.

### 3. Aviso de pendências

O aviso conta pessoas cujo estado de fechamento é PENDING, dentro do escopo pessoa/setor, e diz “[n] pessoas com pendências neste mês”. Não confundir com número total de solicitações nem com os estados sem registro/indisponível.

“Ver pendências do mês” abre **Fechamento do mês**, filtrado por PENDING, no mês e escopo selecionados. Isso cobre inclusive dia pendente sem solicitação correspondente, que não deve desaparecer numa lista genérica de aprovações. A partir dali, o botão existente de cada impedimento abre a pendência específica via `openClosingIssue`. Não transformar este aviso numa nova fila de todas as datas.

Ocultar o aviso quando não há PENDING; ainda exibir NO_RECORD, NO_ENTRIES e UNKNOWN separadamente. Não declarar “tudo certo” só porque não há PENDING.

### 4. Conferência da equipe

Tabela principal com cinco colunas: **Pessoa** (setor na segunda linha), **Dias com lançamento**, **Horas trabalhadas**, **Situação do mês**, **Conferir**. Não exibir e-mail ou percentual de produtividade nessa visão resumida.

Dias são datas distintas por pessoa; horas vêm dos lançamentos do período. Não preencher números fictícios nem esconder horas realmente lidas porque o registro mensal está ausente. O traço ilustrativo do mock não prevalece sobre dados conhecidos. Zero só quando a leitura foi concluída e o conjunto está vazio; indisponibilidade deve ser escrita.

Em mês completo, a população acompanha `buildClosingRows`, incluindo inativos com histórico relevante, e recebe filtros de pessoa/setor/situação. Exibir toda a população filtrada, não apenas as cinco linhas ilustrativas da imagem. Ordenação estável por nome; não criar paginação que esconda registros sem necessidade nesta entrega.

“Conferir” abre Lançamentos no modo por colaborador, com a pessoa e o mês da linha. Ali continuam resumo mensal, carga, abonos e histórico diário existentes. Um bloco recolhível “Detalhes do mês” por linha conserva, no Painel, as informações secundárias hoje disponíveis: última data trabalhada, último envio, intervalo entre trabalho e registro, registros após a data trabalhada e carga estimada quando aplicável. Os detalhes não modificam a tabela principal nem criam regras novas.

“Conferir por dia” abre o modo diário já existente em Lançamentos, com o mesmo mês. Filtros de pessoa/setor recebidos devem aparecer e restringir tanto a lista de registros quanto a lista de pessoas sem lançamento. Dia inicial é o primeiro dia do mês selecionado, indicado pelo seletor diário existente, sem presumir que seja o dia de hoje. Trocar dia não fecha o mês. Manter aviso “Sem lançamentos não significa falta”.

### 5. Banco de horas

Faixa compacta abaixo da tabela: “Banco de horas · posição atual”, disponível, reservado e débitos em aberto. Seguir `dashboardDisplay` para créditos; débitos são a soma dos lotes DEBIT retornados, como no leitor atual. Nunca usar saldo líquido como saldo disponível.

Pessoa/setor restringem os lotes, usando o conjunto correspondente em `data.contractors`; o filtro de situação mensal da tabela não restringe o banco. Mostrar “Pessoa/setor selecionados · posição atual”, pois o saldo independe do mês. Valores não representam saldo histórico de agosto.

“Ver extrato” abre a visão existente de Banco de horas com pessoa/setor explícitos e os mesmos filtros aplicados a lotes e movimentações. Preservar a separação já existente entre saldos atuais e movimentações do período. Não criar novo extrato, endpoint ou exportação.

### 6. Intervalos que não são um mês completo

Preservar a consulta por intervalo e os cálculos corrigidos da Entrega A. Exibir horas/dias dos lançamentos do intervalo e contexto mensal em seção explicitamente separada, sem ratear carga ou abonos.

Não chamar `buildClosingRows` para intervalo incompleto ou de vários meses. Substituir os indicadores por “Escolha um mês completo para conferir o fechamento”; situação mensal da tabela fica “Consulte um mês completo”. Ações de fechamento, Conferir por pessoa e Conferir por dia ficam desabilitadas com essa explicação e atalho ao seletor de mês. Nunca escolher silenciosamente o primeiro mês do intervalo.

Pessoa/setor, atualização e extrato continuam utilizáveis. Nesse modo a tabela inclui ativos e inativos com registros no intervalo; mantém ausência e indisponibilidade distintas. Filtro de situação mensal é limpo ao sair do modo mensal, sem apagar pessoa/setor válidos.

## Integração no código existente

Base inspecionada: worktree `safer-month-closing`, HEAD `ed47ca7`; código funcional publicado pelo merge `d0d56b6`, com documentação local posterior. Antes de implementar, conferir estado e base novamente. Nenhum grafo Graphify existe neste worktree; relações abaixo foram conferidas diretamente no código, sem criar grafo ou memória.

- `app/HorusViews.tsx`: retirar apenas a responsabilidade de renderizar o Overview para um componente dedicado `app/Overview.tsx`; preservar os demais consumidores e auxiliares compartilhados.
- `app/overview-model.ts`: projeções puras para população, filtros, contagens e linhas. Reutilizar `dashboardDisplay`, `buildClosingRows`, tipos e regras existentes. Não mutar o `DashboardData` recebido.
- `app/HorusApp.tsx`: coordenar filtros do Painel e ações explícitas de navegação com mês/pessoa/setor/modo/situação. Não executar `mutate` nessas ações. Entrada normal pelo menu continua respeitando o período salvo de cada aba.
- `app/workspace-state.ts`: manter requestId, isolamento por perfil/identidade/aba/escopo e rejeição de período errado. Horário de leitura deve ser metadado cliente de resposta aceita, nunca mudança no contrato de API. Uma resposta antiga não pode restaurar pessoa ou modo de conferência de um clique anterior.
- `app/PeriodPicker.tsx`: variante compacta somente para o Painel, sem alterar a apresentação/comportamento padrão das outras telas. Reutilizar o formulário de intervalo existente.
- `app/ClosingOverview.tsx`, `app/HorusViews.tsx`/EntriesView/BalanceView: receber os filtros contextuais e opção de limpar escopo; não reescrever telas nem contratos de gravação. Elegibilidade segue o modelo completo, com seleção restrita às linhas visíveis e limpa ao mudar o escopo.
- `app/globals.css`: estilos do Overview com classes próprias e variante compacta, sem seletores globais que mudem RH/PJ, modais, Relatórios ou formulários.

Nenhuma alteração prevista em `db/`, `app/api/`, Supabase, configuração de deploy ou dependências. Se um requisito exigir uma dessas mudanças, parar e apresentar o motivo em vez de ampliar silenciosamente o pacote.

## Estados, acesso e fidelidade

No desktop, preservar a hierarquia da opção 1 com a tabela usando toda a largura útil. Em janela estreita, filtros empilham e indicadores quebram em linhas; linhas da equipe apresentam os mesmos rótulos/dados em formato compacto legível. Evitar rolagem horizontal da página; não esconder dados essenciais por CSS. Nenhum gráfico decorativo.

Manter menu DEV e sua seleção de colaborador; a imagem de RH não autoriza removê-los. Não transportar filtros RH para PJ nem revelar população RH na visualização PJ. Filtros não substituem autorização do servidor.

Carregamento, vazio, erro, ausência de registro e metadados indisponíveis são estados distintos. Controles funcionam por teclado, têm foco visível e rótulos; estado não depende apenas de cor. “Outro intervalo” e detalhes recolhíveis anunciam expansão e preservam foco. Navegação contextual anuncia destino/mês/pessoa e move foco para o título da área carregada, sem saltos por resposta atrasada.

Comparação visual deve usar a imagem escolhida e captura do ensaio fictício no mesmo tamanho de viewport; números variáveis não precisam reproduzir o mock. Diferenças deliberadas: controles DEV existentes, zero conhecido versus traço ilustrativo, rótulos mais precisos e detalhes secundários preservados. Nada de capturas com registros reais em serviços de geração de imagens.

## Critérios de aceitação para a implementação futura

1. Seis grupos mensais coerentes com `buildClosingRows`, incluindo zeros, inativos relevantes, metadados ausentes/duplicados, sem registro e sem lançamento; contagens não dependem de percentual de horas.
2. Pessoa/setor combinados coerentes em indicadores/tabela/banco, sem confundir filtro de situação da tabela com posição atual do banco; sem setor definido suportado.
3. Navegação normal preserva mês de cada aba; ações explícitas abrem o mês/pessoa corretos mesmo se o destino já estava em outro mês. Voltar preserva o contexto do Painel.
4. Nenhuma navegação/atualização/filtro dispara escrita. Comparar fixtures antes/depois e registrar chamadas HTTP, aceitando apenas leituras nesse fluxo.
5. Respostas atrasadas, período errado e falha de atualização não repõem dados/horários/filtros antigos como atuais.
6. Conferência diária preservada, com escopo visível; histórico continua por dia. Ausência de lançamento não vira falta.
7. Fechamento individual/coletivo continua com seleção explícita, revisão e confirmação; filtros limpam seleção antiga; nenhuma pessoa oculta incluída. Resultado parcial/incerto continua sem reenvio automático.
8. Intervalos livres não inventam estado ou fechamento mensal; carga/abonos permanecem contexto mensal sem rateio. Estimativas antigas não são gravadas.
9. RH, DEV/RH, DEV/PJ somente leitura e PJ comum preservam acesso e isolamento; exportações e demais telas não sofrem regressões.
10. Verificação visual e de interação em desktop/estreito, zoom, teclado/foco, carregamento, vazio e erro com dados fictícios. Comparar contra o alvo escolhido e registrar limites, sem chamar captura isolada de certificação de acessibilidade.
11. Repetir testes de aplicação, lint, TypeScript e builds pelo executor isolado existente; testes PostgreSQL de fechamento somente em cluster fictício novo. As 209 aprovações da Entrega A são histórico, não testes desta alteração futura.
12. Revisão do diff confirma ausência de SQL, migração, credencial ou modificação nos dados. Preview funcional local antes de solicitar qualquer publicação.

## Revisão desta especificação

Fonte visual exata resolvida e inspecionada. Contratos existentes de consulta, estados mensais, população e navegação lidos. Ausência de registro, intervalo livre, saldo atual, seleção oculta e resposta atrasada tratados explicitamente. Sem pendências vagas, datas fixas de produção ou números do mock como requisito funcional.

Product Design orientou a fidelidade ao visual escolhido e o reaproveitamento do produto. Brainstorming do Superpowers exige revisão deste documento antes do plano de implementação. Não foi criado aplicativo paralelo, executado teste contra dados reais, alterado código funcional ou feito deploy. Próxima etapa após revisão do usuário: plano de implementação com tarefas e testes, usando writing-plans; sem subagentes.
