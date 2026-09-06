// Run with Playwright CLI run-code --filename against the isolated RH preview.
// Catches a too-narrow action column that splits the short "Conferir" label.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI consumes a function expression, not a module export.
async page => {
  await page.getByText('TESTE LOCAL — dados fictícios; sem Supabase', {exact:true}).waitFor();
  await page.getByRole('heading', {name:'Painel', exact:true}).waitFor();
  const actions = page.getByRole('button', {name:/^Conferir (Ana|Bruno|Carla|Diego|Elisa|Fábio)/});
  if (!await actions.count()) throw Error('Missing fictional overview rows');
  const results = [];
  for (const button of await actions.all()) {
    const result = await button.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
      const box = element.getBoundingClientRect();
      const cell = element.closest('td').getBoundingClientRect();
      return {label:element.getAttribute('aria-label'), lines:lines.size, right:box.right, cellRight:cell.right, viewport:innerWidth};
    });
    if (result.lines !== 1) throw Error(result.label + ': expected one text line, got ' + result.lines);
    if (result.right > result.cellRight + 1 || result.right > result.viewport + 1) throw Error(result.label + ': action overflows its cell or viewport');
    results.push(result);
  }
  return results;
}
