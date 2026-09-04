# Horus — central de relatórios em linguagem natural

Data: 04/09/2026.

Situação: desenho aprovado na conversa e formalizado para revisão antes do plano de implementação. Este documento não autoriza alteração no Supabase, publicação ou deploy.

## 1. Resultado esperado

O RH e o perfil DEV conseguem consultar e exportar informações do Horus sem precisar interpretar códigos internos. A área de Relatórios passa a ter três consultas claras:

1. **Lançamentos de horas:** o que cada colaborador registrou, dia por dia.
2. **Banco de horas:** créditos, débitos, reservas, utilizações, liberações e vencimentos.
3. **Histórico de alterações:** quem realizou uma ação, o que aconteceu, quando e qual pessoa ou registro foi afetado.

O fluxo principal é:

**Escolher relatório → escolher período → filtrar → conferir resultados → exportar a mesma visão.**

## 2. Problemas confirmados na versão atual

A auditoria visual e do código encontrou estes problemas:

- A tabela expõe códigos internos como `TIME_ENTRY_CREATED` e `TimeEntry`.
- “Lançamentos” e “Banco de horas” aparecem principalmente como cartões de download; somente o histórico de auditoria fica visível na tela.
- A tabela visível de auditoria não respeita o período selecionado. Em setembro, ela continua apresentando registros de agosto.
- Todo o histórico é carregado numa página extensa, sem paginação.
- A exportação aceita apenas período e formato CSV.
- O CSV contém códigos internos, minutos brutos e pouca organização para uso administrativo.
- Não existe setor no cadastro de colaboradores, portanto o filtro pedido não pode ser implementado corretamente apenas no frontend.

## 3. Princípios obrigatórios

- Preservar todos os lançamentos, versões, fechamentos, saldos, solicitações e registros de auditoria existentes.
- Relatórios são somente leitura e nunca alteram dados ao consultar, filtrar, paginar ou exportar.
- Não renomear nem regravar códigos históricos no banco. A linguagem natural é uma camada de apresentação.
- Fazer qualquer mudança de estrutura de forma aditiva, sem `delete`, `truncate`, recriação de tabela ou atualização em massa.
- Manter os controles de organização e perfil já existentes.
- O perfil colaborador não ganha acesso aos relatórios administrativos.
- O perfil DEV mantém a mesma central disponível na Visão RH. Ao visualizar como colaborador, a central administrativa não aparece.
- Tela e exportação usam exatamente o mesmo conjunto de filtros e a mesma interpretação dos dados.
- Preservar a identidade visual atual do Horus; este trabalho reorganiza o módulo, não substitui cores, tipografia ou navegação global.

## 4. Arquitetura da informação

A tela de Relatórios terá três abas permanentes:

### 4.1. Lançamentos de horas

Explicação visível: “Confira os horários registrados, as horas calculadas e as observações de cada dia.”

Colunas principais:

- Data trabalhada;
- Colaborador;
- Setor;
- Entrada;
- Saída;
- Intervalo;
- Horas trabalhadas;
- Horas consideradas;
- Situação do dia;
- Observação.

### 4.2. Banco de horas

Explicação visível: “Acompanhe de onde vieram os créditos e débitos e como foram reservados, utilizados ou vencidos.”

A visualização principal apresenta as movimentações do período, com:

- Data;
- Colaborador;
- Setor;
- Tipo de movimentação;
- Crédito ou débito;
- Quantidade de horas;
- Origem ou descrição;
- Situação relacionada.

Um resumo acima da tabela mostra totais de crédito, débito, reserva e utilização dentro dos filtros aplicados. Os lotes e seus saldos remanescentes entram na planilha detalhada para rastreabilidade.

### 4.3. Histórico de alterações

“Histórico de alterações” substitui “Auditoria” como nome principal. A palavra auditoria pode aparecer apenas na explicação: “Esta é a trilha de auditoria do Horus.”

Colunas principais:

- Data e hora;
- Quem realizou;
- O que aconteceu;
- Pessoa afetada;
- Registro relacionado;
- Motivo.

Cada linha pode ser expandida para mostrar detalhes úteis em linguagem natural. Identificadores e códigos internos ficam numa seção técnica secundária, destinada ao perfil DEV e à planilha de rastreabilidade.

## 5. Filtros

Os filtros principais, sempre visíveis, são:

- **Período:** mês completo ou intervalo de datas;
- **Pessoa:** toda a equipe ou um colaborador;
- **Setor:** todos, um setor ou “Sem setor definido”;
- **Tipo:** opções contextuais ao relatório selecionado.

O filtro Pessoa representa o colaborador ao qual o registro pertence ou que foi afetado pela ação. No Histórico de alterações, “Quem realizou a ação” fica em **Mais filtros**, pois pode ser diferente da pessoa afetada.

Tipos por relatório:

| Relatório | Tipos apresentados |
| --- | --- |
| Lançamentos | Regular, retroativo, dia não útil, com observação |
| Banco de horas | Crédito, débito, reserva, utilização, liberação, vencimento, ajuste |
| Histórico de alterações | Lançamento, fechamento do mês, aprovação, solicitação, cadastro, acesso, política |

Regras de interação:

- Alterar um filtro atualiza a consulta e retorna à primeira página.
- Lançamentos usam a data trabalhada; Banco de horas usa a data da movimentação; Histórico de alterações usa a data e hora da ação.
- Os filtros aplicados aparecem como marcadores removíveis acima da tabela.
- Há uma ação única “Limpar filtros”.
- A interface mostra quantidade total de resultados e intervalo da página atual.
- A tabela usa paginação no servidor, inicialmente com 50 linhas por página.
- A ordenação inicial é da informação mais recente para a mais antiga.
- Uma resposta de consulta antiga não pode substituir uma escolha de filtro mais recente.
- Período, contagem, tabela e exportação pertencem sempre à mesma consulta.

## 6. Linguagem natural

Um único módulo de apresentação traduz ações, tipos, situações e entidades para português. Tela, CSV, Excel e PDF reutilizam esse módulo.

Exemplos:

| Código interno | Texto apresentado |
| --- | --- |
| `TIME_ENTRY_CREATED` | Criou um lançamento de horas |
| `TIME_ENTRY_UPDATED` | Alterou um lançamento de horas |
| `TIMESHEET_CLOSED` | Fechou o mês do colaborador |
| `TIMESHEET_REOPENED` | Reabriu o mês do colaborador |
| `CONTRACTOR_CREATED` | Cadastrou um colaborador |
| `CONTRACTOR_STATUS_CHANGED` | Alterou a situação de um colaborador |
| `ORGANIZATION_POLICY_CHANGED` | Alterou uma política da organização |
| `NON_BUSINESS_AUTH_REQUESTED` | Solicitou autorização para trabalhar em dia não útil |
| `NON_BUSINESS_AUTH_APPROVE` | Aprovou trabalho em dia não útil |
| `NON_BUSINESS_AUTH_REJECT` | Recusou trabalho em dia não útil |
| `OCCURRENCE_REQUESTED` | Registrou uma ocorrência |
| `OCCURRENCE_APPROVE` | Aprovou uma ocorrência |
| `OCCURRENCE_REJECT` | Recusou uma ocorrência |
| `LEAVE_REQUEST_CREATED` | Solicitou uma folga |
| `LEAVE_REQUEST_APPROVE` | Aprovou uma folga |
| `LEAVE_REQUEST_REJECT` | Recusou uma folga |
| `LEAVE_REQUEST_CANCEL` | Cancelou uma folga |
| `LEAVE_REQUEST_UTILIZE` | Registrou a utilização de uma folga |

O levantamento de implementação deve enumerar todos os códigos realmente produzidos pelas rotas e funções atuais. Um código novo ou desconhecido nunca aparece cru na tabela principal: o texto padrão será “Registrou uma alteração no Horus”, mantendo o código original apenas nos detalhes técnicos.

Entidades também recebem nomes naturais, por exemplo:

- `TimeEntry` → Lançamento de horas;
- `MonthlyTimesheet` → Fechamento do mês;
- `HourBalanceLot` → Saldo do banco de horas;
- `LeaveRequest` → Solicitação de folga;
- `Occurrence` → Ocorrência;
- `NonBusinessAuthorization` → Autorização de dia não útil;
- `User` → Colaborador ou usuário.

Quando houver dados suficientes, a linha será composta como frase, por exemplo: “Rafael Santos alterou o lançamento de 03/09/2026 de Ana Beatriz.” Se a relação não puder ser identificada num registro antigo, a interface mostra a limitação sem inventar pessoa, data ou motivo.

## 7. Setores

### 7.1. Modelo

Criar uma tabela de setores da organização e uma referência opcional no cadastro de usuário:

- Setor: identificador, organização, nome, situação, criação e atualização;
- Usuário: `sector_id` opcional;
- Nome de setor único por organização, sem diferenciar maiúsculas e minúsculas;
- Setor em uso é inativado, não excluído;
- Colaboradores existentes começam com setor indefinido;
- Nenhum setor é inferido automaticamente por e-mail, nome ou histórico de lançamento.

O RH administra a lista e atribui o setor no cadastro de cada colaborador. Essas ações exigem confirmação normal e ficam registradas no histórico administrativo.

A lista fica em **Administração → Setores**. A associação fica em **Pessoas → Editar colaborador**. “Configurar políticas”, removido de Relatórios, passa a ficar em Administração junto das demais regras da organização.

### 7.2. Sem histórico temporal de setor

Por decisão do usuário, o setor é uma classificação fixa do colaborador. Não será criada tabela de vigência nem cópia de setor em cada lançamento. Relatórios antigos associam o registro ao setor atualmente definido no cadastro.

Essa decisão pressupõe que colaboradores não mudam de setor. Se essa regra organizacional mudar no futuro, será necessário um desenho separado para setores com vigência histórica; não se deve reconstruir esse histórico por suposição.

## 8. Consulta e paginação no servidor

Criar uma consulta administrativa específica para relatórios. Ela recebe:

- relatório selecionado;
- data inicial e final;
- colaborador opcional;
- setor opcional;
- tipo opcional;
- responsável opcional, somente para o histórico;
- página e tamanho da página.

O servidor valida cada filtro, aplica o escopo da organização e verifica o perfil antes de consultar. A resposta contém filtros normalizados, colunas e linhas da visão, totais resumidos, total de resultados e informações de paginação.

O Histórico de alterações resolve a pessoa afetada a partir da entidade e dos dados anteriores/novos já registrados. Não haverá atualização dos registros antigos. Quando não for possível resolver a pessoa afetada, o campo fica “Não identificado”.

Consultas de relatórios não chamarão funções que alterem status, recalculam meses ou produzam auditoria. Qualquer atualização derivada necessária ao negócio continua restrita aos fluxos de gravação correspondentes.

## 9. Exportações

O botão **Exportar** oferece:

1. **Excel — relatório atual:** aba Resumo, aba Dados e aba Rastreabilidade técnica, respeitando a visão e os filtros atuais.
2. **Excel — pacote completo:** Resumo geral, Lançamentos, Banco de horas, Lotes e saldos e Histórico de alterações, todos sob o mesmo período, pessoa e setor.
3. **CSV:** dados da visão atual, com cabeçalhos e valores em linguagem natural.
4. **PDF resumido:** identificação do relatório, filtros, totais e informações essenciais para conferência e impressão.

### 9.1. Excel

- Título, organização, período, filtros, data/hora e responsável pela geração;
- Cabeçalhos fixos e filtros automáticos;
- Colunas com larguras adequadas e quebra de texto onde necessário;
- Datas e horários como valores próprios, não texto acidental;
- Horas apresentadas em `hh:mm`, com valores numéricos de suporte quando necessário;
- Totais por pessoa e setor;
- Identificadores e códigos internos somente na aba de rastreabilidade;
- Sem macros, fórmulas externas ou conteúdo executável.

### 9.2. CSV

- Codificação UTF-8 com compatibilidade para Excel em português;
- Separador consistente;
- Uma linha por registro;
- Datas e horários padronizados;
- Apenas a visão atual e os filtros aplicados;
- Nenhum código interno nas colunas operacionais.

### 9.3. PDF

- Documento resumido, não uma reprodução ilimitada da tabela;
- Título, período, filtros e data de geração;
- Totais e agrupamentos essenciais;
- Paginação, cabeçalho e rodapé;
- Mensagem clara quando não houver resultados;
- Sem dados técnicos ou identificadores internos.

Os nomes dos arquivos seguem um padrão legível, por exemplo: `horus-lancamentos-2026-09.xlsx`.

O pacote completo aplica somente os filtros comuns — período, pessoa e setor. O filtro Tipo pertence à aba atual e não é transferido silenciosamente para relatórios com categorias incompatíveis. A interface informa isso antes de gerar o pacote.

## 10. Estados da interface e erros

| Estado | Comportamento |
| --- | --- |
| Carregando | Manter filtros visíveis e informar “Carregando relatório…” |
| Sem resultados | “Nenhum registro encontrado com estes filtros”, com ação para limpar filtros |
| Filtro inválido | Identificar o campo e não executar consulta parcial |
| Falha de consulta | “Não foi possível carregar o relatório”, com nova tentativa |
| Exportando | Desabilitar repetição e informar o formato em preparação |
| Exportação vazia | Informar que não há dados nos filtros escolhidos antes de gerar arquivo |
| Falha de exportação | Manter os filtros e permitir nova tentativa sem recarregar a página |

Nenhuma falha de consulta ou exportação pode aparecer como “Sem dados”. Nenhuma exportação será iniciada com filtros diferentes dos apresentados na tela.

## 11. Acesso e privacidade

- RH, ADMIN e DEV podem consultar e exportar relatórios da própria organização.
- PJ não pode acessar a consulta nem as rotas de exportação administrativas.
- A interface não é a única proteção; todas as rotas verificam autenticação, perfil e organização.
- Parâmetros de pessoa e setor são conferidos contra a organização do usuário autenticado.
- Dados técnicos ficam fora da visualização e do PDF; quando necessários, ficam na rastreabilidade do Excel e nos detalhes do perfil DEV.
- Respostas e downloads usam cache privado ou desabilitado.

## 12. Preservação do banco de dados

A futura migração de setores deve conter apenas criação da nova tabela, índices, permissões compatíveis com o modelo atual e adição da referência opcional em usuários. Ela não pode atualizar colaboradores existentes nem tocar em tabelas de ponto e banco de horas.

Antes e depois da migração, comparar contagem e hash dos conjuntos protegidos, incluindo:

- lançamentos de horas;
- versões de lançamentos;
- fechamentos mensais;
- lotes e movimentações do banco de horas;
- solicitações e reservas de folga;
- ocorrências;
- autorizações de dia não útil;
- auditoria existente.

Também verificar permissões, políticas de acesso, funções e gatilhos relevantes. Um desvio interrompe a publicação. O rollback não apaga a tabela nem a coluna adicionadas; a versão anterior da aplicação pode ignorá-las com segurança.

Não executar testes de criação, alteração, exclusão, fechamento ou reabertura sobre dados reais. O teste final de produção é somente leitura.

## 13. Organização da futura implementação

Separar o módulo atual em unidades com responsabilidade única:

- **Central de Relatórios:** seleção da aba e composição da tela;
- **Barra de Filtros:** período, pessoa, setor, tipo e filtros adicionais;
- **Tabela de Resultados:** colunas contextuais, paginação e estados;
- **Linguagem do Horus:** tradução central de ações, entidades, situações e tipos;
- **Consulta de Relatórios:** validação, segurança, filtros e paginação no servidor;
- **Exportadores:** transformação comum dos dados e renderização específica de Excel, CSV e PDF;
- **Administração de Setores:** lista controlada e associação no cadastro do colaborador.

A lógica de consulta e transformação não ficará dentro do componente visual. A mesma camada de dados alimentará tela e exportações para impedir divergências.

## 14. Testes e critérios de aceite

### 14.1. Comportamento

- Cada aba explica claramente sua finalidade e mostra dados próprios.
- O período selecionado restringe a tabela e a exportação.
- Setembro não exibe registros de agosto, salvo quando o usuário escolhe explicitamente um intervalo que os inclua.
- Pessoa, setor, tipo e data funcionam isoladamente e em combinação.
- “Quem realizou” e “Pessoa afetada” têm significados distintos no histórico.
- Limpar filtros restaura a visão inicial.
- Paginação não duplica, omite ou mistura registros.
- Respostas fora de ordem não alteram a seleção atual.

### 14.2. Linguagem

- Todos os códigos produzidos pelo sistema atual possuem texto natural.
- Nenhum código cru aparece na tabela principal, no CSV ou no PDF.
- Código desconhecido usa fallback compreensível e permanece disponível na rastreabilidade.
- Datas, horas, créditos, débitos e situações têm nomes consistentes entre tela e arquivos.

### 14.3. Exportação

- Excel abre com as abas esperadas, filtros, cabeçalhos fixos, tipos de células e totais corretos.
- Pacote completo mantém o mesmo período, pessoa e setor em todas as abas.
- CSV preserva caracteres acentuados e escapa separadores e quebras de linha.
- PDF contém filtros e totais corretos, paginação e nenhuma informação técnica indevida.
- Arquivo vazio não é gerado silenciosamente.

### 14.4. Segurança e dados

- PJ recebe bloqueio nas consultas e exportações administrativas.
- RH, ADMIN e DEV permanecem limitados à própria organização.
- IDs de pessoa ou setor de outra organização são rejeitados.
- Filtrar, paginar e exportar não produz escrita no banco.
- Migração aditiva preserva contagens e hashes dos dados históricos protegidos.
- Colaborador sem setor continua aparecendo e pode ser filtrado como “Sem setor definido”.

### 14.5. Interface e acessibilidade

- Abas, filtros, paginação e exportação funcionam por teclado.
- Carregamento, erro, vazio e sucesso não dependem apenas da cor.
- A tabela mantém cabeçalhos associados e nomes acessíveis.
- No celular, filtros podem ser recolhidos, mas relatório e ação Exportar continuam disponíveis.
- Não há rolagem horizontal necessária para escolher filtros ou exportar; a tabela pode usar rolagem própria quando necessário.

Executar ainda análise de tipos, lint, testes existentes, testes novos e build. Testes de exportação devem abrir e validar os arquivos gerados, não apenas verificar que uma resposta HTTP foi retornada.

## 15. Sequência de liberação

1. Implementar e testar com dados fictícios locais.
2. Validar a migração de setores em banco isolado, com verificação de preservação.
3. Validar os três relatórios, filtros e exportações em preview.
4. Apresentar a versão para conferência do usuário.
5. Somente com autorização específica, aplicar a migração aditiva com comparação antes/depois.
6. Publicar a aplicação.
7. Fazer verificação de produção somente leitura.

Falhas na migração, integridade, permissões, build, consulta ou exportação impedem a publicação. Não haverá correção manual de dados reais como atalho.

## 16. Fora de escopo

- Gerador livre de relatórios e escolha arbitrária de colunas;
- Agendamento ou envio automático por e-mail;
- Painel analítico com gráficos avançados;
- Histórico temporal de mudanças de setor;
- Importação de planilhas;
- Edição de ponto, banco de horas ou fechamento dentro de Relatórios;
- Exclusão de setores em uso;
- Mudanças nas regras de cálculo de horas.

## 17. Portas de aprovação

1. **Agora:** revisão desta especificação escrita.
2. **Após aprovação:** criação do plano detalhado de implementação, com arquivos, testes e sequência segura.
3. **Implementação local:** código e testes em ambiente isolado; sem alteração de produção.
4. **Preview:** conferência funcional e visual.
5. **Banco e produção:** somente após autorização específica e verificação de preservação.

Este documento não autoriza implementação, mudança no Supabase, push, pull request, merge ou deploy.

## 18. Revisão da especificação

- Não há marcador provisório nem decisão essencial em aberto.
- Tela, consulta e exportação usam o mesmo significado de filtros.
- A diferença entre responsável e pessoa afetada está explícita.
- O modelo de setor é controlado, opcional para dados existentes e sem histórico temporal.
- Preservação de dados é uma condição de implementação e publicação.
- O escopo cabe em um plano de implementação dividido entre interface, consulta, exportação e migração aditiva.
