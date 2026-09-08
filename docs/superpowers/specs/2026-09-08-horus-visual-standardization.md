# Horus — padronização visual

## Objetivo e autorização

Consolidar as duas auditorias de UI de 08/09/2026 em um plano implementável. A aprovação desta etapa é para elaborar o plano. Não iniciar implementação ou publicação automaticamente.

## Restrições globais

- Preservar integralmente os dados do Supabase, especialmente o histórico de agosto.
- Não executar migrações, alterações de esquema, SQL de escrita, seeds, limpeza, restauração ou alteração de registros reais.
- Não alterar cálculos, classificações, consultas, filtros, exportações, permissões, autenticação, fechamento ou reabertura de mês.
- Preservar nomes das ações, caminhos de navegação, períodos independentes e proteções de somente leitura do desenvolvedor.
- Testar ações somente na prévia isolada com dados fictícios e sem credenciais do Supabase.
- Preservar identidade roxa, marca, fontes existentes e estrutura de navegação.
- Não enviar capturas com dados pessoais a GitHub, Figma ou serviços de geração de imagens.
- Executar sequencialmente na própria tarefa, sem subagentes.

## Direção visual proposta

| Elemento | Padrão inicial a validar na prévia |
| --- | --- |
| Ícones | Uma biblioteca, sem caracteres usados como desenhos; 18 px em controles e 20 px na navegação; traço 1,75 |
| Controles principais | Altura mínima de 44 px; botão só com ícone de 44 × 44 px; raio de 8 px |
| Ações compactas de linha | Altura mínima de 36 px, sem cortar o texto |
| Títulos | Página: 30 px/700 no desktop e 26 px em tela estreita; seção: 20 px/650 |
| Texto | 14 px nos controles e nas células dos relatórios; 13 px nos cabeçalhos da tabela; 12 px mínimo nas informações auxiliares revisadas |
| Espaçamento | Escala 4/8/12/16/24/32 px; cartões com recuo de 24 px no desktop e 16 px em tela estreita |
| Cores | Texto principal atual; apoio mais legível; roxo para seleção/ação; alerta apenas quando houver algo a sinalizar |
| Foco | Um contorno visível, sem acumular anel, sombra e borda de mesma intensidade |

Estes valores são decisões propostas, não características já implementadas. Não fazer uma troca global indiscriminada de CSS que alcance formulários e telas ainda não verificados.

## Requisitos e critérios

R1. Setas dos filtros centralizadas em ambos os estados; girar só o ícone. Preservar Escape, setas do teclado, rótulos acessíveis e opção selecionada.

R2. Mês entre duas setas próximas e simétricas em Painel, Lançamentos, Relatórios e Fechamento. Botões e campo com mesma altura. Manter meses mínimos/máximos, modo ocupado e aplicação explícita do intervalo.

R3. Cabeçalhos, filtros e opções abertos com hierarquia consistente. Manter os nomes de telas e controles; não reorganizar rotas ou permissões.

R4. Relatórios com letras legíveis, contraste conferido, durações comparáveis e rolagem horizontal restrita à tabela. Não modificar valores, formatação das datas/horas nem colunas retornadas pelo servidor.

R5. Título, orientação e botões de Exportar alinhados na mesma margem. Preservar todas as opções, mensagens, bloqueio de clique repetido e confirmação do pacote.

R6. Reduzir espaço auxiliar excessivo sem esconder filtros. Cartões vazios de Aprovações mais compactos, sem sugerir que o histórico foi apagado e sem esconder categorias.

R7. Indicador Com pendências neutro quando o valor for zero; destacado quando positivo; seleção continua identificável em ambos os casos. Não alterar a contagem nem a classificação.

R8. Mesma família de ícones e padrão de cantos/foco. Estados desabilitado, carregando, vazio, erro e somente leitura precisam continuar distinguíveis.

## Fora do escopo

Redesign completo, novas funcionalidades, novos gráficos, alterações no backend, reorganização de navegação, novas regras de RH, mudanças na planilha exportada e deploy nesta etapa de planejamento.

## Evidências locais

- Auditoria inicial: `C:/Users/danyel/Documents/Codex/2026-09-01/recordo-do-projeto-que-a-gente/output/ui-audit-2026-09-08/auditoria-ui.md`.
- Auditoria complementar: `C:/Users/danyel/Documents/Codex/2026-09-01/recordo-do-projeto-que-a-gente/output/ui-audit-2026-09-08-complemento/auditoria-complementar.md`.
- Base local inspecionada: `fcad09c814131b60af46699e3f0c2694c8ec6d0d`. Não presume que continue sendo a versão publicada na execução.

As imagens permanecem fora do repositório; a especificação registra os achados sem copiar dados de colaboradores.
