# Painel mensal — preparação de publicação

Estado: **revisão local concluída; envio de PR/publicação autorizados pelo usuário e em execução**. As seções anteriores abaixo registram checkpoints históricos; o fechamento desta revisão está na seção final.

## Atualização após autorização de Playwright — 06/09/2026

Zoom real de 200% validado em perfil temporário separado, somente com o ensaio fictício. O teste revelou quebra do rótulo “Conferir”; corrigida com largura mínima de 112 px para a coluna de ação, sem mudar backend ou regras de fechamento. Teste executável `tests/browser/overview-action-layout.js` falhou antes e passou depois nas seis pessoas a 200%, 1487 px e 390 px.

Depois da correção, as cinco etapas foram repetidas na cópia isolada com `buildSafeEnv`: Vinext, 226 testes (zero falhas, 10.314 ms), lint, Next e TypeScript, todas com saída 0. O lint inicialmente sinalizou a expressão de função exigida pelo Playwright CLI; adicionada justificativa restrita a essa linha do script de teste e repetido o lint global, sem erros ou avisos. Nenhuma regra do aplicativo ou configuração global de lint foi relaxada.

`design-qa.md` agora está **passed**, com capturas pareadas, métricas de zoom e limites. Snapshot fictício integral preservado (5 leituras, zero gravações e fechamentos no checkpoint). Arquivos protegidos comparados novamente com `origin/main`: nenhuma diferença. Nenhum acesso ao Supabase, alteração de dependências do Horus ou deploy nesta rodada.

Ao concluir, o zoom do perfil temporário foi restaurado a 100% e somente a sessão `horus-zoom-200` foi encerrada. Perfil pessoal, abas do usuário e preview 4178 preservados. A ferramenta Playwright foi obtida no cache de ferramentas; não foi adicionada ao pacote do Horus.

## Base conferida em 06/09/2026

- GitHub `main`: `d0d56b6b22ab188960e026168d4025bddeed58f8`, consultado pela API do GitHub, igual à referência local `origin/main`.
- Candidato funcional: `e9d756220316915d5129f520b2e3d177eba62108`, branch `feature/reports-redesign-design`.
- PRs anteriores #2, #3, #4 e #5 já incorporados. O PR #1 antigo não faz parte desta entrega.
- Comparação cumulativa do candidato: 34 arquivos, 10 deles no aplicativo; demais são testes e documentação. Esta documentação de preparação é posterior a essa contagem.
- Diferença vazia nos caminhos protegidos: `db`, `app/api`, `supabase`, dependências/lockfile, `vercel.json`, `app/closing-model.ts`, `app/closing-client.ts`, `app/page.tsx`, `app/dashboard-types.ts` e `app/reports`.
- Nenhuma configuração de ambiente alterada. Nenhum acesso ao Supabase nesta rodada.

## Verificação desta retomada

- Cópia isolada reutilizada: `C:/Users/danyel/AppData/Local/Temp/horus-workflow-check-pFhQnz`.
- Comparados por hash 131 arquivos rastreados de aplicativo, testes, scripts e configurações selecionadas: zero diferenças; raiz da cópia sem `.env*` e sem `.git`.
- Suíte completa repetida com `buildSafeEnv`: 226 testes passaram, zero falhas, cancelamentos ou testes pulados. Duração reportada: 30.834 ms.
- Mensagens de erro emitidas pelos cenários negativos são esperadas; não são consultas ao serviço real.
- Lint global e TypeScript independente: saída 0. Vinext e Next de produção: saída 0; TypeScript independente repetido após os builds, também saída 0. Processos com ambiente filtrado; nenhuma inicialização do servidor real. Vinext emitiu aviso informativo de tempo gasto em plugins, sem falha de compilação.
- Ensaio local 4178 acessível, banner de dados fictícios confirmado; aba preservada para continuidade.
- Evidências visuais/interativas anteriores permanecem no runbook de 05/09 e em `design-qa.md`; não foram integralmente repetidas nesta rodada.

## Descrição preparada para o futuro PR

**Título:** Melhora o Painel mensal e a navegação da conferência do RH

O Painel passa a organizar a conferência pelo mês escolhido, com filtros por pessoa e setor, seis situações mensais e acesso direto ao fechamento, lançamentos por pessoa, conferência por dia e extrato. Os destinos recebem o contexto explicitamente, mantendo a seleção independente de mês em cada área.

O fechamento continua exigindo revisão e confirmação. Pessoas ocultadas por mudança de filtro não permanecem selecionadas. Consulta por intervalo não permite fechamento mensal. O banco de horas é identificado como posição atual, sem apresentá-lo como saldo histórico do mês consultado.

O acesso DEV continua oferecendo a visão RH e a simulação de colaborador somente leitura. Não há ampliação das permissões, alteração do backend nem migração. Lançamentos e históricos existentes não são regravados.

Este texto está **apenas preparado localmente**. Não afirmar no PR que a validação visual foi concluída enquanto `design-qa.md` estiver bloqueado.

## Pendências para liberar

1. Zoom real de 200% concluído; evidências e correção posterior registradas em `design-qa.md`.
2. Consolidar os itens compostos restantes do plano na revisão final de release. A aprovação visual não substitui essa revisão.
3. Atualizar a comparação contra `main` antes de publicar; se a base avançar, revisar a diferença nova e repetir as verificações afetadas.
4. Criar o novo PR, verificar sua revisão e verificações do GitHub e seguir a autorização de release. A branch atual tem publicação automática desabilitada em `vercel.json`; enviar a branch não equivale a deploy.
5. Confirmar a versão entregue pela Vercel. Qualquer verificação autenticada de produção precisa respeitar a restrição vigente de não acessar o Supabase; não testar gravações em dados reais.

Reversão, se necessária: somente a versão do aplicativo. Nunca restaurar, limpar, recalcular ou substituir o banco de produção como parte deste pacote.

## Revisão final para publicação — 06/09/2026

- Candidato funcional: `51162d6`. Documentação de encerramento posterior não altera o aplicativo.
- Base remota reconfirmada: `d0d56b6b22ab188960e026168d4025bddeed58f8`. Branch remota `feature/reports-redesign-design`: `a606dbce021a0b90b5886a14d9126e9344d38c40`, ancestral do candidato; envio será fast-forward, sem force push.
- Produção anterior confirmada na Vercel: `dpl_8yF1qeUaDMMQcYSqJEDWKHuZff5r`, READY, main `d0d56b6`, domínio `horuscodex.vercel.app`.
- Revisão do escopo: 36 arquivos antes desta consolidação, 10 do aplicativo; caminhos protegidos sem diferença e `git diff --check` aprovado. Nenhuma alteração em ambiente, dependências ou configuração de deploy.
- Paridade: 132 arquivos rastreados de app/testes/scripts/configurações comparados por hash com `horus-workflow-check-pFhQnz`, zero diferenças; sem `.env*`/`.git` na raiz da cópia.
- Verificação fresca: Vinext, 226 testes (226 passaram, zero falhas, cancelamentos ou pulados; 12.709 ms), lint global, Next e TypeScript independente, todos saída 0. Ambiente filtrado por `buildSafeEnv`; nenhuma conexão ao Supabase.
- Itens compostos do plano consolidados por evidência unitária/renderizada/interativa. QA nativo 200% já aprovado após a correção; não foi repetido nesta rodada documental.
- Não há workflow GitHub Actions versionado neste repositório. Verificações locais não serão apresentadas como CI remoto. A publicação automática da feature está desabilitada; merge na main será acompanhado na Vercel antes de afirmar produção atualizada.
- Limite: não executar sessão autenticada nem gravações em produção. Sem afirmar que o funcionamento de dados reais foi auditado nesta publicação.

PR antigo #1 preservado, sem mudança. Worktree, branch e previews permanecem disponíveis para retomada. Resultado remoto de PR/merge/deploy será registrado após confirmação das plataformas.
