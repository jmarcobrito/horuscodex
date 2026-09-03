# Proteções de gravação mensal — validação local

Data: 03/09/2026. Base local: `07d445fa3eb0948c6935a28f431ad77f9fe2f6bc`.

**Escopo autorizado:** preparar e testar localmente as proteções descritas em [closing-integration-validation.md](closing-integration-validation.md). Sem conectar ao Supabase real, migrar dados, alterar configurações, fazer push/merge ou deploy.

## Resultado funcional

- Fechamento recusa autorizações pendentes, inclusive sem lançamento e em ajuste; recusa ocorrências pendentes que atravessem o mês.
- Gravação diária, autorização, ocorrência, recálculo e fechamento usam o mesmo bloqueio transacional por organização/pessoa. Se fechar primeiro, a alteração é recusada; se a alteração confirmar primeiro, o fechamento considera o resultado confirmado.
- Autorizações e ocorrências são gravadas, calculadas e auditadas em uma única operação. Uma falha desfaz toda a operação.
- Aprovar um dia existente preserva seus horários, intervalo, observação, identificadores e autoria original. A mudança de elegibilidade ganha uma nova versão com antes/depois completos.
- Solicitar autorização novamente mantém o identificador anterior. Solicitações já decididas não são substituídas silenciosamente.
- Reabertura continua sendo uma ação explícita do RH, com justificativa; não existe reabertura automática para contornar bloqueios.
- Interface, escolha de mês, consulta por dia e fechamento por pessoa/equipe não foram alterados nesta etapa. Os contratos das rotas continuam retornando `{id,status}`; erros conhecidos usam mensagens simples em português.

## Testes e preservação

O PostgreSQL 17.11 foi iniciado exclusivamente em clusters novos com pessoas `test-*`, endereços `example.com` e registros fictícios. Nenhuma URL, credencial ou dado de produção foi utilizado. Os servidores de teste foram encerrados ao final.

Antes da correção, o conjunto ampliado de 19 casos registrou **5 aprovados e 14 falhas esperadas**: falhas de proteção reproduzidas e operações atômicas ainda inexistentes. Um problema de codificação de argumentos no Windows foi corrigido no executor antes de validar esse resultado: SQL é enviado por stdin em UTF-8.

Com o candidato, o conjunto final registrou **27 casos aprovados, nenhuma falha, saída 0**:

- Instalação e repetição da instalação preservaram o conteúdo completo das 14 tabelas protegidas, inclusive metadados e histórico; permissões e configuração de RLS das tabelas permaneceram iguais.
- Fechamento repetido não duplicou lote nem evento de fechamento; fechar outra pessoa não alterou dias/versões.
- Recálculo, alteração e exclusão de lançamento, autorização ou ocorrência de mês fechado foram recusados nos caminhos exercitados.
- Falhas injetadas na auditoria de fechamento, solicitação/decisão de autorização e criação/decisão de ocorrência desfizeram todos os efeitos da operação.
- Aprovação retroativa criou uma versão completa; repetir a decisão foi recusado sem mudanças.
- Datas/minutos inválidos, outro colaborador e ator de outra empresa foram recusados.
- Cancelamento de ocorrência própria e reabertura explícita foram preservados; dias e versões anteriores continuaram intactos.
- Concorrência foi exercitada em sessões distintas, sincronizadas pelo bloqueio real: edição versus fechamento nas duas ordens, criação de autorização/ocorrência depois de fechar, e aprovação de autorização/ocorrência antes de fechar. Não depende de atraso arbitrário para ordenar as operações.

O executor compara o JSON integral, ordenado por identificador, de: organizações, políticas, usuários, meses, dias, versões, lotes de saldo, movimentações, folgas, auditoria, ocorrências, autorizações, dias não úteis e reservas de folga. **Preservação demonstrada com dados fictícios não é auditoria da integridade real de agosto.**

Na aplicação, **67 testes aprovados, nenhuma falha ou teste ignorado**, incluindo 10 testes novos que executam os handlers reais e substituem somente autenticação/transporte externos. O teste proíbe rede e escrita direta em tabelas; exige uma única chamada atômica. As funções reais são testadas separadamente no PostgreSQL, não simuladas. Isso não equivale a homologação ponta a ponta da autenticação e do transporte PostgREST reais.

Vinext build, Next build, ESLint e TypeScript concluíram com saída 0 em cópia isolada, sem arquivos de ambiente ou credenciais herdadas. Após ampliar os cenários de concorrência, o lint dos suportes alterados e os 10 testes das rotas foram repetidos com saída 0. Foram comparados 103 arquivos de código/configuração entre o trabalho local e a cópia verificada: nenhuma diferença. Os blocos originais de cálculo/saldo das quatro funções foram comparados e permaneceram iguais após as proteções acrescentadas. O diff passou sem erros de whitespace.

## Revisão das alterações

Revisão direta conforme o roteiro do Superpowers, sem subagentes, respeitando a preferência do usuário.

- `recalculate_timesheet`: acrescenta bloqueio e recusa de mês fechado antes dos cálculos.
- `save_time_entry`: valida o ator e bloqueia pessoa/mês antes de criar mês ou gravar dia.
- `close_timesheet`: valida o ator, adquire bloqueio antes da linha mensal e inclui as pendências omitidas. As fórmulas, compensação FIFO, criação de lotes e snapshot não foram reescritos.
- `reopen_timesheet`: valida o ator e usa a mesma ordem de bloqueios; lógica de estorno existente preservada.
- Quatro operações novas executam com `security invoker` e `search_path = ''`. Funções existentes mantêm as características anteriores. Os catálogos locais verificaram execução negada a `anon`/`authenticated` e permitida a `service_role` nas 12 funções envolvidas. Não se alteraram os acessos das pessoas ao sistema.
- Bloqueio por pessoa é deliberadamente mais amplo que por mês: cobre solicitações quando ainda não existe registro mensal e ocorrências entre meses. Pessoas diferentes têm chaves diferentes. Escritas diretas antigas podem ser abortadas em disputa de bloqueios; as novas operações mantêm ordem consistente.
- Triggers não executam correção de dados ao serem instalados. Barram gravações futuras sobre meses fechados e transferência da identidade dos registros protegidos.
- Nenhuma migração histórica, dependência, flag, configuração Vercel ou arquivo de ambiente foi alterado.

Avaliação desta revisão: as três proteções aprovadas estão implementadas e verificadas no candidato local. Não foi encontrado bloqueio novo para concluir esse escopo local. Não há liberação para merge ou produção: dependência das novas funções e critérios restantes estão descritos abaixo. O branch e a área de trabalho foram preservados, sem commit, push ou alteração do PR nesta etapa.

## Limitações e produção

**Não está liberado para merge/deploy.** As rotas locais agora dependem de funções que ainda não existem no Supabase. O SQL está em `db/proposals/monthly-write-protection/`, fora das migrações automáticas. Não publicar somente as rotas nem executar estes arquivos diretamente em produção.

Continuam pendentes os [critérios de liberação](monthly-workflow-release-gates.md):

1. Consulta sem gravação implícita e tratamento correto de vencimentos nas operações de saldo.
2. Completude/paginação de listas e pendências, incluindo histórico de pessoas inativas.
3. Revisão da aplicação coordenada dessas proteções e autorização específica para qualquer ação remota.

A revisão também identificou uma regra preexistente que não foi alterada nesta correção: `save_time_entry` reconhece a autorização aprovada, mas não limita uma edição posterior aos minutos aprovados. Essa regra de cálculo precisa ser avaliada antes da liberação; o teste de aprovação atômica não prova que edições posteriores preservam o limite. A atribuição de créditos de ocorrência ao mês inicial e as fórmulas FIFO existentes também foram mantidas deliberadamente, sem inventar rateio ou corrigir saldos históricos.

Não foram executados advisors remotos, consulta autenticada de produção, migração, fechamento/reabertura real, backup, exportação, mudança de acesso ou deploy. A evidência aqui é exclusivamente local. A escolha futura de fechar um mês real é uma decisão operacional separada de publicar código.
