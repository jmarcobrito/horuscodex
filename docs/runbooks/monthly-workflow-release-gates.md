# Horus — condições para integrar o backend e publicar

Data: 03/09/2026. Referência de código local: `5d447c4`.

**Estado: BLOQUEADO — não autorizado/testado nesta etapa.**

Responsável: próxima etapa de backend, após autorização específica. Este documento registra o que falta; não autoriza execução, configuração ou publicação.

## Regra de preservação

Todos os lançamentos reais, especialmente agosto, suas versões, justificativas e movimentações históricas devem ser preservados. Não executar migração, seed, reset, importação, restauração, fechamento, reabertura ou correção de dados reais como teste. Não criar backup/exportação nem ampliar acesso sem autorização.

| Condição | Evidência necessária para liberar | O que não é suficiente |
| --- | --- | --- |
| Consultas sem gravação implícita | Demonstrar em backend isolado que dashboard, histórico e revisão não escrevem, preservando o tratamento correto de vencimento nas operações de saldo. | Remover `refresh_hour_balance_statuses` sem garantir que crédito vencido não fique utilizável. O dashboard real não foi chamado neste ensaio. |
| Mês fechado protegido em todos os caminhos | Testes de fechamento concorrente com edição diária, autorização e ocorrência, sem alteração parcial. | Botão desabilitado ou leitura prévia do status no frontend. |
| Registro, cálculo, versão e auditoria consistentes | Falhas injetadas entre etapas, demonstração de consistência por operação e conciliação entre saldo e mês. | Sequência de várias gravações sem teste de falha. Não corrigir dados reais para passar no teste. |
| Repetição e resposta incerta | Chamadas simultâneas e timeout seguidos de consulta de reconciliação, sem duplicação de lotes/movimentações; resultado individual confirmado. | Presumir atomicidade de toda a equipe. A API atual é por pessoa. Reabertura não pode ser compensação automática. |
| Escopo e completude | Organização/permissões verificadas; contagem e paginação demonstrando todos os registros e pendências do mês, incluindo inativos e metadados mensais. | Usar listas limitadas a 100 ou ao limite de retorno do serviço como prova de “sem pendências”. |
| Preservação comprovada | Comparação autorizada, somente leitura, dos conjuntos protegidos antes/depois de uma mudança permitida, considerando gravações legítimas no intervalo. | Contagens antigas da auditoria, dados do ensaio, cópia/exportação não autorizada ou inferência de que o histórico está íntegro sem verificar. |
| Liberação deliberada | Revisão das mudanças e evidências, autorização específica para publicar e outra decisão explícita para fechar um mês real. | Um “sim” à execução deste plano local não autoriza deploy, ativação de flag ou fechamento de agosto. |

## Sequência proposta para uma etapa posterior

1. Desenhar a validação em backend isolado com dados inventados, sem credenciais de produção.
2. Demonstrar cada condição acima. Se forem necessárias mudanças em função, tabela, política, permissão ou configuração, apresentar antes a menor proposta, seu efeito e a forma de teste.
3. Revisar preservação e resultados; definir separadamente eventual verificação somente leitura em produção.
4. Solicitar autorização específica de publicação. Manter confirmação real indisponível até integração validada.
5. Tratar a decisão operacional de fechar agosto separadamente da publicação de código.

`HORUS_MONTH_CLOSING_WRITE_ENABLED` não foi ativada nem alterada nesta implementação. Não há instrução neste documento para ativá-la. Não executar `db:push`, rotinas SQL, restauração ou fechamento com base neste registro.
