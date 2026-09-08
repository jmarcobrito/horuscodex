/* global document, innerWidth, innerHeight, getComputedStyle */

// Read-only DOM inspection. Run only against the isolated, fictitious preview.
export default function inspectHorusLayout() {
  if (!document.body.innerText.includes("TESTE LOCAL — dados fictícios; sem Supabase")) throw Error("Verificação restrita à prévia fictícia");
  if (document.documentElement.scrollWidth > innerWidth + 1) throw Error("Página transborda horizontalmente");
  const sidebar = document.querySelector(".sidebar");
  if (sidebar && sidebar.scrollHeight > sidebar.clientHeight + 1 && !["auto", "scroll"].includes(getComputedStyle(sidebar).overflowY)) {
    throw Error("Menu lateral excede a altura disponível sem permitir rolagem");
  }
  const periods = [];
  for (const controls of document.querySelectorAll(".month-selector-controls")) {
    if (!controls.getClientRects().length) continue;
    const [left, input, right] = controls.children;
    const a = left.getBoundingClientRect(), b = input.getBoundingClientRect(), c = right.getBoundingClientRect();
    if (Math.abs((b.left - a.right) - (c.left - b.right)) > 1) throw Error("Espaços das setas diferentes");
    if ([a, b, c].some(r => Math.abs(r.height - 44) > 1)) throw Error("Alturas de período diferentes");
    periods.push({ leftGap: b.left - a.right, rightGap: c.left - b.right, height: b.height });
  }
  let arrows = 0;
  for (const box of document.querySelectorAll(".select-menu-chevron")) {
    if (!box.getClientRects().length) continue;
    const svg = box.querySelector("svg");
    if (!svg) throw Error("Ícone ausente");
    const a = box.getBoundingClientRect(), b = svg.getBoundingClientRect();
    if (Math.abs(a.x + a.width / 2 - b.x - b.width / 2) > 1 || Math.abs(a.y + a.height / 2 - b.y - b.height / 2) > 1) throw Error("Seta descentralizada");
    arrows++;
  }
  for (const menu of document.querySelectorAll(".select-menu-popover")) {
    const rect = menu.getBoundingClientRect();
    if (rect.top < 7 || rect.bottom > innerHeight - 7) throw Error("Lista de opções ultrapassa a altura disponível");
  }
  for (const option of document.querySelectorAll(".select-menu-popover button")) {
    // SelectMenu positions its list using 48 px per option. Typography must retain that size.
    if (Math.abs(option.getBoundingClientRect().height - 48) > 1) throw Error("Opção excede a altura prevista pelo menu");
  }
  const reportCell = document.querySelector("#report-panel>.ledger-panel td");
  const exportBody = document.querySelector(".report-export-panel .request-list");
  return { width: innerWidth, periods, arrows, reportFont: reportCell ? getComputedStyle(reportCell).fontSize : null, exportPadding: exportBody ? getComputedStyle(exportBody).padding : null };
}
