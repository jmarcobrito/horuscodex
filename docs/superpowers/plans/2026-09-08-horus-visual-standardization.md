# Horus Visual Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. A preferência do usuário é execução sequencial, sem subagentes.

**Goal:** Corrigir a consistência visual do Horus, começando por leitura, margens e controles, sem mudar dados ou regras de negócio.

**Architecture:** Reutilizar os componentes existentes e aplicar CSS com escopo específico. Criar apenas um adaptador pequeno de ícones; não dividir HorusApp/HorusViews nem redesenhar o fluxo. Validar primeiro na prévia isolada já existente, com dados fictícios.

**Tech Stack:** React 19, TypeScript, Next/Vinext, CSS existente, node:test e runnerImport do Vite. Lucide React será a única dependência de interface adicional proposta, instalada com versão exata e lockfile na execução.

**Spec:** `docs/superpowers/specs/2026-09-08-horus-visual-standardization.md` — ler integralmente junto com este plano.

## Global Constraints

- Preservar integralmente os dados do Supabase, especialmente o histórico de agosto.
- Não executar migrações, alterações de esquema, SQL de escrita, seeds, limpeza, restauração ou alteração de registros reais.
- Não alterar cálculos, classificações, consultas, filtros, exportações, permissões, autenticação, fechamento ou reabertura de mês.
- Preservar nomes das ações, caminhos de navegação, períodos independentes e proteções de somente leitura do desenvolvedor.
- Testar ações somente na prévia isolada com dados fictícios e sem credenciais do Supabase.
- Preservar identidade roxa, marca, fontes existentes e estrutura de navegação.
- Não enviar capturas com dados pessoais a GitHub, Figma ou serviços de geração de imagens.
- Executar sequencialmente na própria tarefa, sem subagentes.

---

## Estado e limites desta entrega

Plano aprovado e implementação visual local executada em 08/09/2026. Resultados e pendências em `../verification/2026-09-08-horus-ui.md`. A validação de zoom real 200% e a aprovação visual ainda não estão concluídas. Sem PR, push, merge ou deploy. As caixas não marcadas incluem verificações ainda parciais e etapas de publicação condicionais.

Checkout inspecionado: `C:/Users/danyel/Documents/Codex/2026-09-01/recordo-do-projeto-que-a-gente/work/horuscodex/.worktrees/safer-month-closing`, HEAD `fcad09c814131b60af46699e3f0c2694c8ec6d0d`. O estado estava limpo antes de adicionar estes documentos. O mapa Graphify não existe neste checkout; o plano foi fundamentado em leitura direta dos componentes e testes, sem criar grafo ou memória.

## Mapa de arquivos e impacto

| Arquivo | Responsabilidade / limite de alteração |
| --- | --- |
| `app/globals.css` | Escalas, espaçamentos, alinhamento, foco, leitura e responsividade; consolidar regras sobrepostas dos seletores tocados |
| `app/UiIcon.tsx` (novo) | Ícones decorativos de biblioteca, sem comportamento |
| `app/SelectMenu.tsx` | Troca do desenho da seta/check, preservando todo o estado e navegação de teclado |
| `app/PeriodPicker.tsx` | Ícones e classes de apresentação; contratos e callbacks intocados |
| `app/HorusApp.tsx` | Somente ícones dos itens de navegação; sem modificar handlers, workspace ou autorização |
| `app/Overview.tsx` | Atributo visual da contagem; sem mudar o modelo ou os filtros |
| `app/HorusViews.tsx` | Estado vazio compacto opcional para RequestsView; demais Empty preservados |
| `app/reports/ReportTable.tsx` | Atributo de apresentação para colunas de duração; cellValue e dados intocados |
| `package.json`, `package-lock.json` | Somente dependência exata de ícones; não atualizar framework ou outras bibliotecas |
| `tests/ui-visual-contract.test.mjs` (novo) | Contratos de marcação e invariantes de apresentação com fixtures |
| `tests/browser/ui-layout-contract.js` (novo) | Medições de layout na prévia, sem escrita de registros |
| `tests/period-picker-view.test.mjs`, `tests/overview-view.test.mjs`, `tests/approvals-view.test.mjs`, `tests/reports-view.test.mjs` | Estender cobertura; preservar as verificações de segurança existentes |

Nenhuma mudança planejada em `app/api/`, `db/`, `worker/`, políticas, clientes de requisição, modelos de domínio, variáveis de ambiente ou configuração Supabase/Vercel.

## Preparação segura

- [x] Confirmar a aprovação para executar e ler as instruções atuais do repositório. Usar `superpowers:using-git-worktrees` se for necessário criar outro checkout; não limpar nem substituir o checkout atual.
- [x] Registrar branch, HEAD e arquivos modificados. Preservar alterações alheias. Conferir diferenças em relação à base deste plano antes de aplicar os trechos abaixo.
- [x] Inspecionar o fluxo isolado existente: `scripts/verify-workflow-isolated.mjs`, `tests/browser/main.tsx`, `tests/helpers/workflow-server.ts` e `tests/isolated-verification.test.mjs`.
- [x] Executar a base de verificação isolada. Não usar `npm test` diretamente em uma pasta com ambientes reais: o script existente de isolamento copia apenas fontes permitidas e retira credenciais do ambiente.

Comandos de referência para a execução, dentro do checkout aprovado:

```powershell
npm run verify:workflow
npm run preview:workflow
```

O isolador copia arquivos retornados por `git ls-files`; arquivos novos precisam estar explicitamente adicionados ao índice antes da verificação. Nunca usar `git add .`. A adição deve listar somente os arquivos da tarefa. O script cria uma pasta temporária nova; não apagar pastas amplas nem prévias anteriores do usuário.

## Task 1: Leitura, hierarquia e margens dos relatórios

**Files:** modificar `app/globals.css`, `app/reports/ReportTable.tsx`; criar `tests/ui-visual-contract.test.mjs`; estender `tests/reports-view.test.mjs`.

**Interfaces:** consumir `ReportTable({report, isDev, onPageChange})` sem alterar a assinatura. Produzir `data-numeric="true"` apenas nas colunas de duração. O retorno de `cellValue` não muda.

- [x] Adicionar ao novo teste o contrato abaixo e executá-lo na cópia isolada, esperando falha pela ausência do atributo.

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runnerImport } from 'vite';

test('duration cells remain unchanged and carry presentation metadata', async () => {
  const { module: { ReportTable } } = await runnerImport('./app/reports/ReportTable.tsx', { configFile: false, envDir: false });
  const html = renderToStaticMarkup(createElement(ReportTable, {
    report: { kind: 'entries', timezone: 'America/Sao_Paulo',
      columns: [{ key: 'workedMinutes', label: 'Horas trabalhadas' }],
      rows: [{ id: 'visual-only', workedMinutes: 487 }],
      summary: { workedMinutes: 487, consideredMinutes: 487 },
      pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 } },
    isDev: false, onPageChange() {},
  }));
  assert.match(html, /<td[^>]*data-numeric="true"[^>]*>08:07<\/td>/);
  assert.match(html, /scope="col"/);
});
```

- [x] Adicionar o metadado em `th` e `td`, sem mudar ordem ou conteúdo das colunas. Usar a expressão `column.key.toLowerCase().includes("minutes") || undefined` no atributo `data-numeric`.
- [x] Consolidar nos blocos existentes de CSS, em vez de empilhar overrides contraditórios, a escala abaixo. Manter as fontes e a cor principal do produto.

```css
:root {
  --ui-control-height: 44px;
  --ui-control-radius: 8px;
  --ui-card-padding: 24px;
  --ui-support-text: #62677d;
}
.page-heading h1 { font-size: 30px; font-weight: 700; line-height: 1.2; }
.panel-heading h2, .overview-team-heading h2,
.overview-closing-heading h2 { font-size: 20px; font-weight: 650; }
.report-export-panel .request-list { padding: 16px var(--ui-card-padding) var(--ui-card-padding); }
.report-export-panel .panel-heading { padding-inline: var(--ui-card-padding); }
.report-export-panel .request-list > p { font-size: 12px; color: var(--ui-support-text); }
#report-panel > .ledger-panel th { font-size: 13px; letter-spacing: 0; color: #555a70; }
#report-panel > .ledger-panel td { font-size: 14px; line-height: 1.5; }
#report-panel > .ledger-panel [data-numeric="true"] {
  text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
}
@media (max-width: 600px) {
  :root { --ui-card-padding: 16px; }
  .page-heading h1 { font-size: 26px; }
}
```

- [x] Reduzir o espaço auxiliar dos filtros ajustando `.report-filter-panel .request-list` para `gap:12px; padding:16px var(--ui-card-padding)`, sem ocultar filtros ou mover ExportMenu para dentro do scroller da tabela.
- [ ] Na prévia, comparar as três abas de relatório: datas, horas, sinais negativos, observações longas, tabela vazia, carregamento e erro. Manter todos os formatos e confirmações de exportação.
- [ ] Executar a suíte de relatórios e contratos; registrar antes/depois com a mesma largura. Medir contraste dos textos novos nos fundos efetivos, sem concluir conformidade global somente por captura.
- [ ] Revisar o diff para garantir que nenhuma transformação de valor foi alterada; criar commit limitado aos arquivos desta tarefa.

## Task 2: Setas, seletores e ícones consistentes

**Files:** criar `app/UiIcon.tsx`; modificar `app/SelectMenu.tsx`, `app/PeriodPicker.tsx`, `app/HorusApp.tsx`, `app/globals.css`, `package.json`, `package-lock.json`; estender `tests/ui-visual-contract.test.mjs` e `tests/period-picker-view.test.mjs`.

**Interfaces:** produzir `UiIcon({name, size?})`, decorativo e sem handlers. `SelectMenu` e `PeriodPicker` preservam todas as props. Itens de navegação passam a usar `UiIconName`, mantendo IDs e labels.

- [x] Instalar somente `lucide-react` com `npm install --save-exact lucide-react`, registrando a versão exata resolvida no manifesto e lockfile. Se o gerenciador tentar atualizar outras dependências, interromper e limitar o diff. Não instalar framework de componentes.
- [ ] Adicionar este teste e confirmar falha antes de criar o adaptador. **Desvio registrado:** os ícones foram verificados por testes dos consumidores, com falha anterior e aprovação posterior, em vez deste exemplo isolado.

```js
test('UI icons are decorative, sized and do not create controls', async () => {
  const { module: { UiIcon } } = await runnerImport('./app/UiIcon.tsx', { configFile: false, envDir: false });
  const html = renderToStaticMarkup(createElement(UiIcon, { name: 'down' }));
  assert.match(html, /<svg/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /width="18"/);
  assert.doesNotMatch(html, /<button|tabindex="0"/);
});
```

- [x] Criar o adaptador, usando os desenhos da biblioteca, não SVG artesanal:

```tsx
import { House, Clock, ClipboardCheck, CalendarCheck, Users, FileText,
  Settings, Wallet, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const icons = { home: House, entries: Clock, requests: ClipboardCheck,
  closing: CalendarCheck, people: Users, reports: FileText, admin: Settings,
  balance: Wallet, down: ChevronDown, previous: ChevronLeft, next: ChevronRight, check: Check };
export type UiIconName = keyof typeof icons;
export function UiIcon({ name, size = 18 }: { name: UiIconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
```

Fonte de API: [documentação oficial do Lucide React](https://lucide.dev/guide/react), consultada em 08/09/2026. O projeto não tinha dependência de ícones instalada na elaboração do plano.

- [x] Em SelectMenu, substituir somente `⌄` por `<UiIcon name="down" />` e o check por `<UiIcon name="check" size={16} />`. Manter o span externo e girar apenas seu `svg`; preservar openMenu, positionMenu, foco, portal, Escape e teclas direcionais.
- [x] Em PeriodPicker, substituir os desenhos das setas mantendo seus aria-labels e callbacks. No summary Outro intervalo, usar `<UiIcon name="down" />` seguido do mesmo texto; atualizar apenas a asserção estrutural do teste que exigia texto imediatamente após `<summary>`, mantendo a proteção de intervalo compacto.
- [x] Nos arrays de HorusApp, mapear os IDs atuais aos nomes do adaptador e renderizar `<UiIcon name={item.icon} size={20} />` dentro de `.nav-icon`. Não alterar `navigationItems`, `openSection`, `switchToRh`, `switchToContractor`, visibilidade DEV ou formulários.
- [x] Consolidar os seletores de período e filtro:

```css
.month-selector-controls,
.overview-period .month-selector-controls {
  display: grid; grid-template-columns: 44px minmax(0, 180px) 44px;
  gap: 8px; width: fit-content; max-width: 100%; align-items: center;
}
.month-selector-controls button,
.overview-period .month-selector-controls button {
  width: 44px; height: 44px; display: grid; place-items: center; border-radius: 8px;
}
.month-selector-controls input[type="month"],
.overview-period .month-selector-controls input {
  width: 100%; min-width: 0; height: 44px; border-radius: 8px;
}
.select-menu-trigger { min-height: 44px; font-size: 14px; border-radius: 8px; }
.select-menu-popover button strong { font-size: 14px; }
.select-menu-popover button small { font-size: 12px; }
.select-menu-chevron { display: grid; place-items: center; }
.select-menu-chevron svg { display: block; transition: transform .18s ease; }
.select-menu-trigger.open .select-menu-chevron { transform: none; }
.select-menu-trigger.open .select-menu-chevron svg { transform: rotate(180deg); }
.overview-range summary { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; list-style: none; }
.overview-range summary::-webkit-details-marker { display: none; }
.overview-range[open] > summary svg { transform: rotate(180deg); }
.select-menu-trigger:focus-visible { outline: 2px solid #6254ca; outline-offset: 3px; box-shadow: none; }
@media (prefers-reduced-motion: reduce) {
  .select-menu-chevron svg { transition: none; }
}
```

- [x] Ajustar os overrides existentes `.dark`, `.admin-user-field` e os breakpoints de período para não reintroduzir fontes de 9 px ou controles menores involuntariamente. Validar os consumidores em modal com dados fictícios; não alterar seu comportamento.
- [ ] Confirmar visualmente setas abertas/fechadas, check selecionado, controle ocupado, teclado e limites 2000–2200. Comparar RH, colaborador e DEV com os testes já existentes.
- [ ] Executar a verificação isolada, revisar alterações somente de apresentação e criar commit desta tarefa.

## Task 3: Estados vazios compactos e cores dos indicadores

**Files:** modificar `app/Overview.tsx`, `app/HorusViews.tsx`, `app/globals.css`; estender `tests/overview-view.test.mjs`, `tests/approvals-view.test.mjs`, `tests/ui-visual-contract.test.mjs`.

**Interfaces:** Overview mantém props e contagens; adiciona `data-count` à marcação. Empty passa a aceitar `compact?: boolean`, padrão false, usado exclusivamente nos três grupos vazios de RequestsView.

- [x] Adicionar os contratos abaixo, com falha esperada antes da alteração:

```js
test('compact empty state describes this consultation, not deleted history', async () => {
  const { module: { Empty } } = await runnerImport('./app/HorusViews.tsx', { configFile: false, envDir: false });
  const html = renderToStaticMarkup(createElement(Empty, {
    text: 'Nenhuma ocorrência com estes filtros.', compact: true,
  }));
  assert.match(html, /empty-state-compact/);
  assert.match(html, /Sem resultados nesta consulta/);
  assert.match(html, /Nenhuma ocorrência com estes filtros/);
});
```

Em `tests/overview-view.test.mjs`, acrescentar um teste independente com a fixture explicitamente sem solicitações:

```js
test('zero pending count is exposed only as presentation metadata', async () => {
  const { module: { Overview } } = await runnerImport('./app/Overview.tsx', { configFile: false, envDir: false });
  const data = makeWorkflowDashboard();
  data.requests = []; data.occurrences = []; data.authorizations = [];
  const html = renderToStaticMarkup(createElement(Overview, props(data)));
  assert.match(html, /data-count="0"[^>]*class="overview-status overview-status-PENDING"/);
  assert.match(html, /Com pendências/);
});
```

- [x] Acrescentar `data-count={model.counts![status]}` antes de `className` no botão de indicador. Não recalcular nada. Aplicar a regra neutra antes da regra de seleção para que `aria-pressed="true"` continue vencendo:

```css
.overview-status-PENDING[data-count="0"] { color: var(--ink); }
.overview-status[aria-pressed="true"] { color: #5140c9; background: #f0ecff; }
```

- [x] Substituir a função Empty por esta variante retrocompatível e adicionar `compact` somente às três chamadas em RequestsView:

```tsx
export function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={'empty-state' + (compact ? ' empty-state-compact' : '')}>
    <strong>{compact ? 'Sem resultados nesta consulta' : 'Sem dados'}</strong>
    <p>{text}</p>
  </div>;
}
```

Na chamada de folgas, tornar o texto igualmente contextual: `Nenhuma solicitação de folga com estes filtros.` Manter as três categorias, contadores e mensagem geral de ausência de pendências.

```css
.request-section .empty-state-compact {
  min-height: 0; padding: 16px; text-align: left;
}
.request-section .empty-state-compact strong { font-size: 14px; }
.request-section .empty-state-compact p { font-size: 12px; color: var(--ui-support-text); }
```

- [ ] Na prévia, verificar grupo vazio e preenchido, pendência zero e positiva, item selecionado zero, carregando e erros. Não reduzir altura dos cartões com dados nem trocar aprovação por mera seleção visual.
- [ ] Executar os testes de Overview, aprovações, regras, DEV e somente leitura na cópia isolada. Revisar o diff e criar commit.

## Task 4: Verificação visual cruzada e regressão

**Files:** criar `tests/browser/ui-layout-contract.js`; usar sem modificar `tests/browser/main.tsx`, `tests/browser/preview.css` e `tests/helpers/workflow-server.ts`, a menos que um novo cenário estritamente fictício seja indispensável.

**Interfaces:** o contrato abaixo consome o DOM da prévia sem fazer requisições ou alterar estado. Produz medições e falha se o alinhamento ou largura da página estiver incorreto.

- [x] Salvar esta função como contrato de medição, executável pelo mecanismo de navegador já autorizado na tarefa. Não iniciar outro navegador/CLI sem seguir a política de escolha de navegador.

```js
// Executar como função de inspeção de DOM na prévia isolada, sem chamadas de escrita.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
() => {
  if (!document.body.innerText.includes('TESTE LOCAL — dados fictícios; sem Supabase')) {
    throw Error('Verificação restrita à prévia fictícia');
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) throw Error('Página transborda horizontalmente');
  const measurements = [];
  for (const controls of document.querySelectorAll('.month-selector-controls')) {
    const [left, input, right] = controls.children;
    const a = left.getBoundingClientRect(), b = input.getBoundingClientRect(), c = right.getBoundingClientRect();
    if (Math.abs((b.left - a.right) - (c.left - b.right)) > 1) throw Error('Espaços das setas diferentes');
    if ([a, b, c].some(r => Math.abs(r.height - 44) > 1)) throw Error('Alturas de período diferentes');
    measurements.push({ leftGap: b.left - a.right, rightGap: c.left - b.right, height: b.height });
  }
  for (const box of document.querySelectorAll('.select-menu-chevron')) {
    const svg = box.querySelector('svg');
    if (!svg) throw Error('Ícone ausente');
    const a = box.getBoundingClientRect(), b = svg.getBoundingClientRect();
    if (Math.abs(a.x + a.width / 2 - b.x - b.width / 2) > 1 ||
        Math.abs(a.y + a.height / 2 - b.y - b.height / 2) > 1) throw Error('Seta descentralizada');
  }
  return measurements;
};
```

- [ ] Capturar antes/depois da mesma fixture nas larguras 1440, 1024, 768 e 390 px. No desktop, testar também zoom de 200%; restaurar o zoom e a largura ao finalizar. Não inferir conformidade móvel a partir de screenshot desktop.
- [ ] Conferir Painel, Lançamentos por pessoa/dia, Fechamento, três relatórios, Aprovações, Pessoas/Administração como consumidores de controles e as duas visões DEV. Somente ambiente fictício para simular fechamento, gravação ou aprovação.
- [ ] Verificar teclado: Tab/Shift+Tab, Enter, Escape e setas nos menus; foco visível em fundos claro/escuro, desabilitado sem parecer ativo e movimento reduzido. Conferir contraste dos textos e indicadores com ferramenta de medição, não por aparência isolada.
- [ ] Executar `npm run verify:workflow` com todos os arquivos novos explicitamente adicionados ao índice. Exigir build Vinext, testes, lint, build Next e TypeScript aprovados. Registrar comandos, resultado e versão testada, sem inventar contagem de testes ou resultados.
- [x] Confirmar que a composição de filtros, os cálculos, os nomes e os conteúdos exportados continuam iguais pelos testes existentes. Não enfraquecer contratos para acomodar regressões; ajustar somente seletores de testes que dependiam de um glifo decorativo.
- [x] Revisar `git diff --name-only` e o diff completo. Qualquer alteração em API, banco, políticas, autenticação, clientes ou regras bloqueia esta entrega visual até ser removida/reavaliada. Verificar que não há credenciais, imagens reais ou dados pessoais staged.
- [ ] Produzir resumo antes/depois e concluir a revisão visual. Criar commit dos testes/documentação desta etapa.

## Task 5: Aprovação visual e entrega, sem publicação automática

**Files:** atualizar este plano com resultados reais e adicionar evidências fictícias em `docs/superpowers/verification/2026-09-08-horus-ui.md`.

- [ ] Mostrar a prévia ao usuário com as mesmas telas auditadas e uma lista curta do que mudou. Não chamar a versão de pronta enquanto houver defeitos de leitura, corte, foco ou fluxo.
- [ ] Solicitar aprovação do acabamento antes de publicação. Autorização para planejar não autoriza merge ou deploy; não usar aprovações antigas de outras entregas como autorização desta.
- [ ] Se a publicação for aprovada, preparar PR apenas com mudanças visuais/testes/documentação. Conferir a base atual, CI e artefatos antes do merge. Não anexar capturas reais.
- [ ] Após deploy autorizado, conferir somente leitura do site oficial e a presença dos estilos novos no artefato entregue. Validar visualmente, sem aprovar solicitações ou fechar um mês real para testar.
- [ ] Se a versão publicada apresentar regressão, usar o mecanismo de retorno à versão anterior do aplicativo conforme autorização operacional; nunca restaurar ou alterar banco para desfazer uma mudança visual.

## Cobertura e autorrevisão do plano

| Requisito | Tarefa |
| --- | --- |
| R1 Setas de filtros | 2 e 4 |
| R2 Seletor de mês | 2 e 4 |
| R3 Hierarquia e escala | 1, 2 e 4 |
| R4 Leitura dos relatórios | 1 e 4 |
| R5 Margens da exportação | 1 e 4 |
| R6 Densidade e vazios | 1, 3 e 4 |
| R7 Cor de pendência zero | 3 e 4 |
| R8 Ícones, foco e estados | 2 e 4 |
| Preservação dos dados | Restrições, preparação e tarefas 4–5 |

As assinaturas novas estão definidas neste documento. Os exemplos usam fixtures, renderização local ou inspeção de DOM. Os passos de publicação são condicionais e não fazem parte da autorização atual.
