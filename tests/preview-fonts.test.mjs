import assert from "node:assert/strict";
import test from "node:test";

test("preview reuses only local compiled font faces, not application CSS or remote URLs", async () => {
  const { extractPreviewFonts } = await import("./helpers/preview-fonts.mjs");
  const result = extractPreviewFonts('body{color:red}@font-face{font-family:Manrope;src:url(../media/manrope.woff2)}@font-face{font-family:Sora;src:url(../media/sora.woff2)}');
  assert.deepEqual(result.files, ["manrope.woff2", "sora.woff2"]);
  assert.match(result.css, /url\(\/__preview-fonts\/manrope\.woff2\)/);
  assert.match(result.css, /--font-manrope:Manrope/);
  assert.match(result.css, /--font-sora:Sora/);
  assert.doesNotMatch(result.css, /body\{color:red/);
  assert.throws(() => extractPreviewFonts('@font-face{font-family:Manrope;src:url(https://example.com/a.woff2)}'));
  assert.throws(() => extractPreviewFonts('@font-face{font-family:Manrope;src:url(../media/../../secret.woff2)}'));
  assert.throws(() => extractPreviewFonts('body{color:red}'));
});
