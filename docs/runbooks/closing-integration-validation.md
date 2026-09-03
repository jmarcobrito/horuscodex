# Integração do fechamento — validação de 03/09/2026

**Decisão: integração cliente implementada; backend reprovado nos testes locais. Não fazer merge/deploy nem ativar fechamento.**

Atualização posterior de 03/09/2026: os três contraexemplos deste registro foram corrigidos e testados **somente no candidato local**. Ver [nova validação](monthly-write-protection-local-validation.md), com 27 testes SQL e 67 testes da aplicação aprovados. A evidência histórica abaixo permanece; a correção não foi aplicada ao Supabase e não libera publicação.

Continuação do [PR #3](https://github.com/jmarcobrito/horuscodex/pull/3), a partir de `731e825`. Esta evidência substitui a afirmação anterior de que faltava ligar a confirmação à API; não substitui os critérios de proteção do backend.

## O que foi implementado

- `app/page.tsx` fornece à interface a autorização de fechamento pela flag de servidor já existente. Seu valor não foi alterado. Colaboradores não recebem essa operação; DEV mantém a visão RH e a simulação de colaborador somente leitura.
- `app/closing-client.ts` envia `POST /api/timesheets` com `action: CLOSE`, pessoa e mês. Processa uma pessoa de cada vez, valida a identidade da resposta e informa cada resultado. Não promete que toda a equipe será fechada em uma única transação.
- Seleção vazia ou inválida não envia. IDs repetidos não duplicam chamadas. Chamadas simultâneas no mesmo adaptador são bloqueadas. Não há repetição nem reabertura automática.
- Falha de transporte, resposta incompatível, erro inesperado ou espera superior a 15 segundos produz resultado incerto e interrompe os próximos envios. Cancelar a espera não desfaz uma operação no servidor.
- Texto distingue “Fechar mês de [pessoa]”, “Fechar mês da equipe”, consulta indisponível para gravação e ensaio fictício. O resultado parcial não aparece como sucesso da equipe.
- A visualização “Por dia” permanece opcional e somente leitura; não altera o mês nem a seleção de fechamento.

## Verificação da aplicação

Execução isolada por `scripts/verify-workflow-isolated.mjs checks`: cópia dos arquivos rastreados, sem arquivos de ambiente, configurações de serviços ou credenciais herdadas. Nenhum servidor autenticado foi iniciado.

- 57 testes automatizados aprovados, nenhuma falha ou teste ignorado; 9 casos novos do adaptador e sua apresentação.
- Verificações incluem identidade da resposta, seleção individual/equipe, falha parcial, prazo de resposta, clique concorrente, bloqueio PJ, preservação dos dias/versões fictícios e distinção real/teste.
- O transporte do ensaio usa o contrato HTTP da rota, mas não chama a rota autenticada nem o Supabase. A rota real desabilitada foi exercitada separadamente e respondeu 503. Não se trata de homologação ponta a ponta da autenticação em produção.
- Conferência no navegador local: fechamento de Ana Exemplo; fechamento dos dois selecionados; falha parcial de Bruno Teste; botão desabilitado quando o fechamento está desligado; DEV alternando RH/colaborador sem ações na simulação; consulta de 03/08/2026 com horários e histórico, sem edição na visão diária.

Os dois builds (Vinext e Next), ESLint e TypeScript concluíram com saída 0. Foram comparados 105 arquivos de código/configuração com a cópia testada: nenhuma diferença. A interface do ensaio também corresponde ao código atual (57 arquivos de aplicação, dados e suporte ao ensaio comparados). Revisão feita diretamente, sem subagentes, conforme a preferência do usuário.

## Testes reais de SQL, apenas em banco local novo

Foi usado PostgreSQL 17.11 para Windows, obtido pelos [binários oficiais](https://www.postgresql.org/download/windows/) distribuídos pela EDB. Sem instalação de serviço, sem URL remota, sem credenciais do Supabase e sem dependência nova da aplicação.

`scripts/verify-closing-postgres.mjs` aceita apenas `--bin` com a pasta absoluta dos executáveis. Cria seu próprio diretório temporário e porta em `127.0.0.1`; não aceita banco existente ou URL de conexão. Aplica as quatro migrações históricas somente nesse banco novo e carrega `tests/backend/closing-regression.sql`, com pessoas `test-*` e endereços `example.com`. O servidor de teste é encerrado ao terminar; arquivos fictícios permanecem locais.

Resultado: **3 testes aprovados e 3 reprovados; saída 1**, exatamente como deve ocorrer enquanto as falhas persistirem.

| Caso local | Resultado observado |
| --- | --- |
| Fechar e repetir o mesmo mês | Aprovado: retorno idempotente, um lote e um evento de fechamento; representação completa dos dias e versões sem alteração. |
| Fechar outra pessoa | Aprovado: operação independente, dias e versões preservados. |
| Falha injetada na auditoria do fechamento | Aprovado: a transação desfez cálculo, saldo e status; mês permaneceu aberto. |
| Autorização pendente sem lançamento | Reprovado: a função aceitou fechar o mês, em vez de rejeitar a pendência. |
| Aprovação após fechamento | Reprovado: a sequência de gravações usada pela rota de autorizações conseguiu atualizar o lançamento e recalcular o mês fechado. |
| Edição iniciada antes de um fechamento concorrente | Reprovado: a edição aguardou o bloqueio do dia e depois conseguiu gravar, mesmo com o mês já fechado. |

O teste de aprovação reproduz os comandos de escrita da rota como `service_role`, no PostgreSQL local. Não executa a rota HTTP real. O teste concorrente usa duas sessões sincronizadas por bloqueio de linha, sem depender de um atraso arbitrário para ordenar fechamento e edição.

## Causas e menor proposta de correção

1. **Pendências:** `close_timesheet`, na migração operacional, verifica lançamentos aguardando autorização, mas não solicitações pendentes sem lançamento. Também considera somente o mês inicial das ocorrências. Proposta: conferir autorizações `REQUESTED`/`NEEDS_ADJUSTMENT` e ocorrências sobrepostas ao mês dentro da transação de fechamento.
2. **Alterações após fechar:** `recalculate_timesheet` não rejeita mês fechado; a rota de autorizações escreve autorização, lançamento, recálculo e auditoria em operações separadas, sem a proteção mensal. Proposta: uma operação transacional para cada decisão, bloqueando e validando o mês antes de qualquer escrita; preservar versão e auditoria. Aplicar a mesma regra às ocorrências. Apenas verificar o status no JavaScript não resolve concorrência nem falha parcial.
3. **Concorrência:** `save_time_entry` lê o status mensal antes de bloquear o lançamento, sem manter o bloqueio mensal. Proposta: adquirir o bloqueio do mês antes da validação e mantê-lo até finalizar a gravação, em ordem compatível com fechamento e demais operações.

Essas mudanças exigem revisar funções e rotas de escrita. **São proposta, não SQL aplicado e não autorização para alterar o Supabase real.** Não exigem apagar, recriar ou corrigir registros históricos. A preservação deve ser demonstrada novamente por testes de falha e concorrência antes de qualquer decisão de aplicação.

Também permanecem os critérios já registrados: consulta sem `refresh_hour_balance_statuses` implícito, vencimento tratado corretamente nas operações de saldo, completude/paginação de listas e escopo de organização/perfil. Corrigir apenas estes três contraexemplos não libera automaticamente a produção. Ver [condições de liberação](monthly-workflow-release-gates.md).

## Limites de preservação e publicação

Não houve chamada ao Supabase real, migração remota, alteração de flag, fechamento/reabertura real, backup/exportação, mudança de acesso ou deploy nesta etapa. Nenhum arquivo de `supabase/`, `app/api/` ou `db/` foi alterado pela integração. Os testes SQL criam e alteram exclusivamente registros fictícios no banco temporário.

Não foi auditada a integridade dos registros reais de agosto nesta etapa; a preservação observada nos testes não é prova sobre o conteúdo do banco de produção. A regra permanece: não usar dados reais como teste e não publicar a nova versão enquanto as condições de segurança estiverem pendentes.
