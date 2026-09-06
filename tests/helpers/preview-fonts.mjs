/** Extract only the two existing product fonts from an isolated Next build. */
export function extractPreviewFonts(css) {
  const faces = [...css.matchAll(/@font-face\{[^}]+\}/g)].map(match => match[0])
    .filter(face => /font-family:(?:Manrope|Sora)(?: Fallback)?;/.test(face));
  if (!faces.some(face => face.includes("font-family:Manrope;")) || !faces.some(face => face.includes("font-family:Sora;"))) {
    throw new Error("Compile a cópia isolada antes de verificar as fontes do ensaio.");
  }
  const files = new Set();
  const rewritten = faces.map(face => face.replace(/url\(([^)]+)\)/g, (_match, url) => {
    const local = /^\.\.\/media\/([a-zA-Z0-9_.-]+\.woff2)$/.exec(url);
    if (!local) throw new Error("O ensaio aceita somente fontes locais compiladas.");
    files.add(local[1]);
    return `url(/__preview-fonts/${local[1]})`;
  }));
  return { files: [...files], css: rewritten.join("\n") + '\n:root{--font-manrope:Manrope,"Manrope Fallback";--font-sora:Sora,"Sora Fallback"}' };
}
