# Horus — QA visual do Painel mensal

final result: blocked

## Alvo e estado

- Fonte visual escolhida: `C:/Users/danyel/.codex/generated_images/01a05e3c-f25a-7182-ae03-4a9d592eaf05/exec-0ec5299b-b81f-412d-a953-92f21925d726.png` (opção 1, Resumo do mês).
- Fonte aberta e inspecionada nesta implementação. Dimensão exibida: 1487 × 1058 px.
- Implementação: `app/Overview.tsx`, integrada ao HorusApp existente; somente local, não publicada.
- Capturas realizadas em `C:/Users/danyel/Documents/Codex/2026-09-01/recordo-do-projeto-que-a-gente/artifacts/month-overview/`: `desktop-current.png` e `mobile-current.png`. Preview de ensaio isolado 4178; não entregue como interface validada.
- Desktop: viewport CSS 1487 × 1058; devicePixelRatio reportado aproximadamente 1; arquivo capturado 1472 × 1048. Mobile: viewport CSS 390 × 844; arquivo 375 × 811. Medidas dos arquivos verificadas com leitor de imagem. **Densidade/crop não normalizados; não classificar como comparação 1:1.**
- Fonte e captura desktop foram abertas no mesmo input de comparação. Capturas iniciais também existem, mas `mobile-initial.png` veio com conteúdo transitório e dimensões 375 × 267: não usar como evidência de layout.
- Estado a comparar: RH, agosto fictício, tabela sem filtros, detalhes fechados. Usar o cenário dedicado “Painel — seis situações”.

## Bloqueio

A falta de espaço foi resolvida por limpeza explicitamente autorizada de cinco cópias temporárias antigas, recuperando cerca de 4,82 GB. Fontes, previews anteriores e dados reais preservados. Nova cópia isolada `horus-workflow-check-pFhQnz`: 223 testes, lint e Vinext passaram; Next passou após repetir o download das fontes com permissão de rede; TypeScript passou. Evidências no runbook.

O bloqueio atual é a confiabilidade da comparação visual, não o disco nem o build. O ensaio importa o CSS do produto, mas não o layout Next que define as variáveis de fontes. O estilo computado de body e h1 reportou `ui-sans-serif, system-ui, ...`, não Manrope/Sora. Além disso, as dimensões de captura diferem do viewport pedido e da referência. Corrigir o ambiente de ensaio/captura antes de concluir fidelidade, sem alterar o aplicativo de produção para compensar um problema do teste.

Não houve rodada pós-correção visual; nenhuma correção de CSS funcional foi feita nesta retomada. Seguindo o gate Product Design, esta interface não pode ser entregue como pronta.

## Achados e limites

- [P2] Fontes de apresentação substituídas no ensaio. Evidência: família computada e screenshot desktop pareado. Isso impede verificar pesos, quebras e densidade reais. Próxima ação: disponibilizar Manrope/Sora na fixture de maneira local e definir as mesmas variáveis do layout, sem baixar dados do sistema ou alterar configuração de produção.
- [P2] Evidência visual não normalizada. O arquivo não corresponde ao viewport CSS informado; a primeira captura após mudança de tamanho chegou a mostrar conteúdo transitório. Repetir captura estável com dimensões/densidade verificadas e abrir fonte/captura juntas. Não transformar artefatos de captura em defeitos atribuídos ao produto.
- Densidade a reavaliar após normalização: a referência mostra cinco linhas e banco no primeiro quadro; o ensaio possui seis pessoas, detalhes por linha, aviso de estimativa e faixa de teste. Essas diferenças de conteúdo/estrutura são explícitas; não alegar equivalência pixel a pixel nem apontar deslocamentos exatos antes de normalizar fontes e enquadramento.
- Texto de intervalo parcial a revisar: “Revise e confirme o fechamento na próxima tela” aparece junto da orientação de escolher mês completo, embora o botão esteja corretamente desabilitado. Tornar a orientação contextual mais clara na próxima correção de apresentação.

## Superfícies obrigatórias pendentes

| Superfície | Estado |
| --- | --- |
| Fontes e tipografia | Bloqueada: fallback observado na fixture; famílias reais precisam ser carregadas para julgar pesos, tamanhos e quebras |
| Espaçamento e layout | Hierarquia de fechamento/tabela/banco presente; comparação de proporções depende de captura normalizada. Mobile respondeu com conteúdo reorganizado, sem aprovação visual completa |
| Cores e contraste | Roxo, fundo claro, sidebar escura e pendências âmbar presentes. Rótulos explícitos verificados; contraste quantitativo e estados de foco ainda pendentes |
| Ativos e ícones | Marca/menu existentes preservados conforme escopo; nenhuma substituição de ativos implementada nesta retomada. Inspeção focada de nitidez/coerência ainda pendente |
| Texto e conteúdo | Seis estados, estimativa, inativo, consulta parcial, erro e avisos de preservação observados no navegador. Dados fictícios diferentes da referência, por desenho do teste |

## Interações verificadas

Meses independentes; navegação contextual para pessoa com foco no título; histórico diário; seis filtros de situação; pessoa/setor e inativo; lista sem setor; conferência diária por setas e limpeza do contexto; banco filtrado sem influência da situação; erro/retry; seleção de fechamento zerada ao limpar filtros; reconhecimento de mês vazio; revisão/confirmação fictícias individual e coletiva; resultados parcial/incerto sem reenvio; DEV trocado durante leitura atrasada; colaborador comum sem Painel RH; lista de 40 pessoas e consulta vazia.

No percurso de consulta: snapshot integral igual, 10 GET, zero gravações e fechamentos. Fechamentos testados depois em fixtures separadas. Console do ensaio não reportou erros/avisos ao final. Isso não comprova todas as regras da matriz nem a aparência final; ver limites no runbook.

Viewport desktop não apresentou largura de página excedente. Em 390 px, largura de documento reportada 375 px; esse dado isolado não exclui conteúdo cortado em componentes. Foco programático no h1 confirmado; percurso completo por teclado, contraste e zoom 200% ainda não executados. Viewport temporário restaurado ao padrão ao encerrar a conferência.

## Checklist de retomada

1. Reutilizar cópia isolada 4178 e código `6278a00`; não refazer limpeza nem conectar Supabase.
2. Resolver fontes e dimensões de captura no ensaio. Não trocar a fonte do produto para fazer o teste coincidir.
3. Completar casos pendentes da matriz registrados no runbook: campo nativo/intervalo, concorrência contextual, pessoa ausente e troca de escopos.
4. Capturar desktop normalizado, 390 px, zoom 200% e foco/teclado; verificar contraste e overflow por componente.
5. Colocar fonte e captura no mesmo input de comparação; fazer recortes focados de tipografia/controles/tabela. Esses recortes ainda não foram feitos e são necessários porque a captura completa está reduzida.
6. Corrigir achados P0/P1/P2, capturar novamente e registrar resultado. Não declarar fidelidade aprovada até isso ocorrer.

Histórico: rodada inicial pareada realizada (fonte + desktop-initial); captura estável desktop-current comparada novamente com a fonte no mesmo input. Não houve correção entre essas capturas; são investigação da primeira rodada, não uma aprovação pós-fix. Bloqueios de fonte/densidade acima permanecem. Não há alegação de conformidade de acessibilidade nem de interface pronta para publicação.
