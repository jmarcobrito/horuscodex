# Horus — correções prioritárias e evolução do painel

Data: 05/09/2026. Estado: proposta para execução; não implementada.

## Objetivo

Permitir que o RH consulte informações coerentes, encontre pendências e confira o histórico antes de fechar o mês. Preservar o ponto dos colaboradores e o fechamento individual ou coletivo.

Base: auditoria em `../../../../../../../audits/2026-09-05-horus/auditoria.md`, na pasta da tarefa. Código conferido no commit `54be4957d4e944f800935b0cafdf2c025a6cfeba`. A auditoria anterior passou em 159 testes de aplicação, 39 cenários PostgreSQL e duas suítes PostgreSQL adicionais. Esses resultados são históricos, não validação de uma implementação futura.

## Restrições globais

- Nenhuma migração, alteração de schema, RLS, grants, política ou função SQL nesta primeira entrega.
- Nenhuma edição, exclusão, importação, recálculo, fechamento ou reabertura de dados reais para testar.
- Preservar integralmente agosto e as versões históricas; corrigir a leitura não autoriza regravar a origem.
- Consultar não pode gravar: zero INSERT, UPDATE, DELETE, UPSERT ou RPC de mutação.
- Manter autorização no servidor, isolamento de organização e restrição do colaborador aos próprios dados.
- Manter a visualização DEV como colaborador somente para consulta.
- Não criar registros mensais nem lançamentos artificiais para permitir fechamento.
- Não adicionar dependências. Manter Node >=22.13.0 e as ferramentas existentes.
- Linguagem natural em português; ausência de lançamento não significa falta.
- Cada área conserva seu período; ações explícitas de navegação contextual podem abrir pessoa e mês de destino.
- Não fazer deploy, merge ou operações remotas durante o planejamento.

## Estratégia escolhida para o plano

Separar correção funcional de reorganização visual. Uma reescrita completa amplia risco; corrigir só os rótulos deixa comportamentos incoerentes. A primeira entrega combina ajustes pequenos de consulta, proteção da entrada HTTP e apresentação. A segunda reorganiza o painel, consumindo dados já corrigidos.

### Entrega A — correções funcionais, sem migrações

1. **Folga com banco:** retirar a criação dessa modalidade pelo formulário de ocorrência; oferecer “Solicitar folga com banco de horas”, que abre o formulário existente. Bloquear novas ocorrências BANK_LEAVE/CONSUMES_BALANCE na API, sem alterar registros existentes. Não criar conversões automáticas. Preservar o ciclo existente de solicitação, reserva, aprovação e utilização; não prometer consumo imediato ao apenas solicitar.
2. **Aprovações:** opção padrão “Todas as datas”, situação “Pendências”. Opção alternativa “Período escolhido”, com seletor visível e independente. Aplicar o mesmo escopo aos três tipos; incluir “Requer ajuste” nas pendências, distinguindo quem deve agir. “Todas as datas” não significa o mês atual nem um intervalo artificialmente grande.
3. **Carga mensal:** somar folhas existentes e estimativas de meses faltantes por pessoa/mês, usando a política atual apenas como estimativa claramente identificada. Pessoas inativas conservam suas folhas e lançamentos; não presumir carga histórica faltante para elas. Não inventar datas de admissão ou lotação histórica.
4. **Intervalos livres:** manter horas trabalhadas/consideradas dos lançamentos dentro das datas; exibir abono, carga e projeção mensais em contexto separado e explicitamente rotulado. Não ratear abonos nem converter regra mensal em regra diária.
5. **Banco e rótulos:** distinguir total de créditos válidos, reservado e livre para usar; os cartões não alteram lotes. Substituir “Preenchimento” por “Horas em relação à carga mensal” e acrescentar “Dias com lançamento”. Mostrar o escopo atual do banco, independentemente do mês de consulta.
6. **Datas e histórico diário:** usar o fuso da organização; comparar também horas consideradas e autorização; resolver o nome do autor no servidor. Dados antigos ausentes continuam “Não informado”, nunca preenchidos retroativamente.

### Entrega B — painel e conferência, após A

Esta é uma direção de produto, não autorização de implementação visual nesta etapa. Um plano próprio deve seguir a validação de A, reaproveitando os componentes atuais.

| Bloco | Conteúdo | Ação |
|---|---|---|
| Cabeçalho | Mês, pessoa/setor e atualização | Atualizar a consulta sem interferir nas outras abas |
| Fechamento | Fechados; prontos para revisar; com pendências; sem registro; estado desconhecido | Abrir fechamento filtrado; nunca fechar ao clicar no indicador |
| Precisa da sua atenção | Solicitações para decidir e ajustes aguardados | Abrir a pendência específica com contexto |
| Conferência da equipe | Pessoa, setor, dias com lançamento, horas, abonos e situação | “Conferir” abre a pessoa no mês selecionado |
| Banco | Livre, reservado, déficit e próximos vencimentos | Abrir extrato com escopo explícito |
| Conferência diária | “Conferir por dia” | Alternar visualização, sem substituir fechamento mensal |

Fechamento: usar `buildClosingRows` como fonte de situação; não recalcular prontidão pelo percentual de horas. Preservar seleção de uma pessoa ou equipe, revisão e confirmação. Melhorar comparação e filtros, sem alterar `makeClosingCommand` nem o contrato transacional.

Relatórios: manter os três tipos, descrições, pessoa/setor/tipo/datas, Excel/CSV/PDF e igualdade entre consulta/exportação. Compactar controles sem retirar filtros; a tabela deve aparecer mais cedo. Não atribuir setores automaticamente.

Critérios visuais futuros: verificar RH e DEV, janela ampla e estreita, teclado, foco, zoom, mensagens de erro e carga. Não alegar conformidade de acessibilidade apenas por captura de tela. Não adicionar gráficos decorativos.

### Entrega C — regras e manutenção, escopo separado

Exigem proposta e aprovação próprias: reabertura com justificativa, fechamento sem registro mensal, abono entre meses, corrigir/reenviar uma autorização, atomicidade das alterações administrativas e mudanças na política do banco. Sem retroatividade em agosto. Configuração de setores, recuperação operacional e automação de CI também são trabalhos separados, não devem entrar ocultos neste pacote.

## Condição de liberação

Cada correção deve demonstrar o caso que falhava e o caso corrigido com dados fictícios, preservar autorizações e regressões existentes, e passar pelos testes de fechamento isolados. PR e preview somente após autorização de execução. Promoção a produção requer resultado dos testes, revisão do diff e aprovação específica do release. Reversão é da versão do aplicativo, nunca reset/restauração do banco.
