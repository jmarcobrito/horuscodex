# Horus — Fundação segura do novo fluxo

Esta etapa reorganiza a experiência do Horus sem alterar a estrutura do banco
de dados. Ela prepara o produto para a evolução do fechamento mensal, mas não
ativa nenhuma escrita nova em produção.

## Regra máxima

Os dados preenchidos pelos colaboradores são históricos operacionais da empresa.
Nenhuma etapa pode apagar, substituir ou recriar lançamentos, versões,
fechamentos, movimentações ou auditorias existentes.

## O que esta etapa entrega

- Navegação separada e clara para RH, colaborador e Desenvolvedor.
- Área **Fechamento do mês** separada de **Pessoas**, somente para conferência.
- Inativação e reativação como únicas ações de ciclo de vida de pessoas.
- Totais históricos que continuam considerando pessoas inativas com dados no período.
- Proteção de mesma origem em toda ação que altera dados.
- Consulta de baseline que abre uma transação somente leitura e termina com `rollback`.

## Limite desta entrega

- Não aplicar migrações.
- Não executar `npm run db:push`.
- Não ativar `HORUS_MONTH_CLOSING_WRITE_ENABLED`.
- Não publicar em produção sem uma autorização específica posterior.
- Não alterar manualmente tabelas ou usuários no Supabase.

## Porta de liberação — go/no-go

- [x] `npm run test:safety` passou.
- [x] `npm run lint` passou.
- [x] `npx tsc --noEmit` passou.
- [x] `npm test` passou.
- [x] Não existe handler `DELETE` para pessoas.
- [x] O fechamento real responde 503 com a flag ausente.
- [x] DEV alterna entre Visão RH e simulação somente leitura.
- [x] Pessoa inativa com histórico aparece no período correspondente.
- [x] Nenhuma migração foi aplicada.
- [x] Nenhum deploy de produção foi realizado.

Os itens acima devem ser executados novamente antes de integrar este branch. Se
qualquer item falhar, a decisão é **NO-GO**.

## Próxima etapa, ainda bloqueada

O próximo trabalho precisa de plano e aprovação próprios: backend aditivo e
transacional para prévia, fechamento e reabertura do mês. A flag de escrita
permanece desligada até esse backend passar por testes e por uma verificação do
histórico antes e depois da mudança.
