# Horus — validação da publicação de 03/09/2026

## Escopo e autorização

O usuário autorizou concluir as pendências, atualizar o PR #3 e publicar no Horus oficial. Essa autorização não inclui fechar/reabrir meses reais nem alterar registros históricos. Agosto e todo o histórico são protegidos igualmente.

## Alterações verificadas

- Seletores de mês por seção, consulta diária opcional do RH e fechamento mensal por pessoa/equipe preservados.
- Leituras completas paginadas, incluindo pessoas inativas; falhas não são apresentadas como histórico vazio ou totais completos.
- Dashboard e resolução de sessão não gravam dados. Vinculação de identidade ocorre apenas após login explícito verificado.
- Autorizações, ocorrências e folgas usam operações atômicas com auditoria; edição de dia mantém o limite aprovado.
- Fechamento, edição e decisões concorrentes compartilham bloqueio por organização/pessoa. Mês fechado bloqueia mudanças em suas fontes.
- Operações de saldo verificam prazo e política por si mesmas. Consultar a tela não atualiza lotes.

## Instalação e preservação

Somente a nova migração será aplicada; as quatro migrações históricas não serão repetidas na produção existente. Nenhuma rotina de preenchimento ou correção de dados faz parte da instalação.

A transação confere as seis funções operacionais existentes, obtém bloqueios com espera máxima de dois segundos e compara impressões digitais de todas as linhas nas 14 tabelas protegidas, além de grants e RLS, antes/depois. Impressões permanecem na própria transação; nenhum conteúdo de linha é exportado. Divergência cancela integralmente a instalação.

Metadados de produção foram consultados somente por leitura: tabelas, colunas, constraints, permissões e corpos das funções são compatíveis com a base local. As novas funções continuam restritas ao servidor; os papéis de usuário não são alterados.

## Evidências locais

- PostgreSQL 17.11 fictício: 39 testes passaram. Instalação repetida preserva todas as linhas e permissões; concorrência e falhas de auditoria verificadas. A proteção também recusou uma instalação propositalmente adulterada e desfez a alteração fictícia.
- Aplicação: 83 testes passaram, incluindo consulta de 1.105 registros, escopo PJ/DEV, histórico de inativos, navegação diária e fechamento por pessoa.
- Builds Vinext e Next, lint e tipos concluídos com código zero em cópia sem credenciais (`horus-workflow-check-DVkJCf`).
- Código e dados dos testes são fictícios. Nenhum teste de escrita foi executado no Supabase real.
- Revisão direta do diff e busca por padrões de credenciais: sem segredo detectado nos arquivos da publicação.

## Publicação

Supabase: migração `20260903171101_monthly_write_protection` aplicada com sucesso. A comparação transacional de todas as linhas e permissões passou. O nome do arquivo local foi alinhado ao identificador atribuído pelo Supabase, sem alteração nas funções verificadas.

As 15 funções de proteção/negócio foram conferidas após a instalação: caminho de busca vazio, execução negada a anon/authenticated e permitida ao servidor. A publicação da aplicação segue pelo PR: https://github.com/jmarcobrito/horuscodex/pull/3. Domínio oficial: https://horuscodex.vercel.app.

Não fechar ou reabrir um mês real para verificar o deploy. Isso continua sendo uma decisão operacional explícita do RH.

## Observação preexistente

O Supabase sinalizou proteção contra senhas vazadas desativada. Nenhuma configuração de autenticação foi enfraquecida ou modificada nesta entrega. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
