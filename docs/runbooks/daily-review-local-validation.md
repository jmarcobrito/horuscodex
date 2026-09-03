# Horus — conferência diária opcional

Data: 03/09/2026. Base: `5e09cd3`. Escopo aprovado: opção de visualização em Lançamentos, preservando o fluxo de fechamento mensal individual e da equipe.

## Resultado local

- RH: alternância entre **Por colaborador** e **Por dia**. O filtro de pessoa permanece guardado ao alternar; a conferência diária mostra a equipe disponível, não apenas a pessoa filtrada.
- Data com seleção direta e navegação anterior/próxima dentro do mês. A mudança de mês em Lançamentos mantém o modo escolhido e começa no primeiro dia; não muda o mês de Fechamento.
- Resumo diário separado do mensal: pessoas com lançamento, pessoas sem lançamento nesta consulta e horas trabalhadas no dia. Não atribui meta, saldo mensal ou abonos mensais ao dia.
- Entrada, saída, intervalo, total e histórico visíveis, inclusive no celular. A consulta diária não oferece edição ou fechamento.
- Cadastros inativos com histórico continuam consultáveis. Sem lançamento não é classificado como falta.
- Fechamento mantém seleção individual ou conjunta, revisão mensal e as proteções já existentes. Não foram alterados componentes, regras ou integração do fechamento.
- DEV preserva a visão RH e a simulação de colaborador somente leitura. A opção da equipe não aparece no perfil de colaborador.

## Evidências

- TDD: quatro testes novos falharam inicialmente pela ausência da seleção diária e da interface; depois passaram. O teste de preservação do perfil de colaborador passou desde o início, como regressão.
- Validação final: **48 testes passaram**, zero falhas ou testes ignorados; Vinext, ESLint, Next e TypeScript terminaram com código 0.
- Cópia isolada de verificação: `C:\Users\danyel\AppData\Local\Temp\horus-workflow-check-h2pCOA`. Os arquivos de implementação e o novo teste foram comparados com o projeto após a última alteração; conteúdo correspondente.
- A primeira compilação Next foi impedida pelo acesso às fontes públicas Google Fonts. Após permissão de rede para essa finalidade, as compilações finais passaram; nenhuma credencial foi adicionada à cópia.
- Navegador com dados inteiramente fictícios: dias vazios, Ana em 03/08, Bruno inativo em 04/08, filtro de pessoa preservado, troca de mês independente, histórico e restauração de foco, fechamento individual e conjunto, simulação DEV e confirmação real desabilitada sem operação validada.
- Navegar por dias e abrir histórico deixou iguais os dias e versões fictícios; o registro de chamadas desse ensaio continha somente consultas e nenhum fechamento.
- Layout verificado em 375×812, 900×900 e 1365×900. Corrigida a herança de estilos que escondia horários ou deslocava o total em telas menores. Campos diários visíveis e alinhados; sem transbordamento horizontal na conferência. Sem erros de console na verificação final.
- Revisão direta com checklist Superpowers, sem subagentes, conforme preferência do usuário. Nenhuma alteração em banco, API, permissões, dependências ou configuração de publicação. `git diff --check` sem erros.

## Limites de segurança mantidos

Não houve acesso ao Supabase de produção, migração, backup, exportação, alteração de lançamentos reais, fechamento/reabertura real, push ou publicação. Os dados reais de agosto não foram usados como teste.

A nova seleção diária apenas filtra os registros já carregados. Ela não resolve nem contorna as condições de backend registradas em [monthly-workflow-release-gates.md](monthly-workflow-release-gates.md), inclusive a gravação implícita na consulta real do dashboard e a comprovação de completude dos resultados. Esse endpoint real não foi chamado.

**A liberação do fechamento real e da publicação continua pendente de validação e autorização separadas.** Os testes fictícios não comprovam integridade ou prontidão do banco real.
